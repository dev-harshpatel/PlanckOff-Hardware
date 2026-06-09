# PDF Pipeline — Async Worker & Microservice Design

## When Do You Actually Need This?

You do NOT need to build this immediately. The trigger conditions are:

| Signal | What's happening | Action |
|--------|-----------------|--------|
| Users report "processing timed out" | Hitting Vercel's 300s limit | Stage 1: Make it async (job queue in API server) |
| API is slow for all users during uploads | PDF worker consuming API server threads | Stage 2: Run worker as separate process |
| 50+ uploads per hour regularly | Worker can't keep up, queue depth growing | Stage 3: Add more worker instances |
| Worker crashes take down the API | Need fault isolation | Stage 3: Separate deployment |

Right now, the bottleneck is that PDF processing runs synchronously inside a Next.js function with a hard 300s timeout. Moving to an async model (the job queue pattern) gives you the most benefit and is achievable without a full microservice split. The microservice split (separate deployment) is a later step.

---

## Current Flow — The Problem

```
User uploads files
    │
    ▼
POST /api/projects/[id]/process   ← Vercel function, max 300s, 3008 MB
    │
    ├── Parse door schedule (Excel)       0–5s
    ├── AI: Extract hardware PDF          30–270s  ← blocks everything
    ├── AI: Generate prep strings         5–30s    ← blocks everything
    ├── Merge sets + doors                1–3s
    └── Write to Supabase                 1–3s
    │
    ▼ (user waited 40–300s)
Response with results
```

**Hard limits today:**
- Vercel max function duration: 300 seconds — hard cutoff, no exceptions
- If two users upload at the same time, Tier 2 extraction eats 6000 MB combined — Vercel will OOM
- User closes the tab during processing → lock is released but the Vercel function keeps running and eventually times out, writing stale data
- No way to show the user which phase is running ("extracting hardware... 60%")

---

## Stage 2 Target Flow — Async with Job Queue

The API route becomes a thin enqueuer. All heavy work moves to a worker process.

```
User uploads files
    │
    ▼
POST /api/projects/[id]/process   (returns in < 2s)
    │
    ├── Validate file types + sizes
    ├── Upload raw files → Supabase Storage (temp-uploads/{projectId}/{jobId}/)
    ├── Insert row in processing_jobs (status: 'queued')
    └── Return { jobId, status: 'queued' }
    │
    │                               ← response already back to browser
    ▼
BullMQ Queue (Redis)
    │
    ▼
Worker Process (same server as API in Stage 2, separate in Stage 3)
    │
    ├── Pick up job
    ├── Download files from Supabase Storage
    │
    ├── Phase: schedule (20%)
    │     ├── parseDoorSchedule()
    │     └── UPDATE processing_jobs SET phase='schedule', progress=20
    │
    ├── Phase: hardware (50%)
    │     ├── extractHardwareSetsFromPdf()  ← Tier 1 or 2
    │     └── UPDATE processing_jobs SET phase='hardware', progress=50
    │
    ├── Phase: prep (80%)
    │     ├── generatePrepForAllSets()
    │     └── UPDATE processing_jobs SET phase='prep', progress=80
    │
    ├── Phase: finalizing (95%)
    │     ├── mergeHardwareData()
    │     ├── upsertDoorScheduleImport()
    │     ├── upsertHardwarePdfExtraction()
    │     ├── upsertProjectHardwareFinal()
    │     └── UPDATE processing_jobs SET phase='finalizing', progress=95
    │
    └── UPDATE processing_jobs SET status='done', progress=100, result={...}
    │
    ▼
Frontend (Supabase Realtime subscription on processing_jobs)
    │
    Receives status update → shows progress bar
    When status='done' → auto-refreshes project data
```

---

## Infrastructure Required

### Redis (for BullMQ)

**Upstash Redis** — serverless Redis, free up to 10,000 commands/day:
- No server to manage
- Connect via `REDIS_URL` environment variable
- Persists jobs across restarts
- $0/month for this scale; scales to $10/month at high volume

```bash
# .env
REDIS_URL=rediss://default:password@us1-example.upstash.io:6380
```

### Job Queue Setup

```typescript
// packages/queue/src/index.ts  — shared queue definition
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const pdfQueue = new Queue('pdf-processing', { connection });

export type PdfJobData = {
  jobId: string;
  projectId: string;
  scheduleStoragePath: string;
  hardwarePdfStoragePath: string;
  scheduleFileName: string;
  hardwarePdfFileName: string;
  uploadedBy: string;
};
```

---

## Database Schema for Job Tracking

Add migration `023_processing_jobs.sql`:

```sql
CREATE TABLE processing_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'processing', 'done', 'failed', 'cancelled')),
  phase         text
                CHECK (phase IN ('schedule', 'hardware', 'prep', 'finalizing') OR phase IS NULL),
  progress      integer NOT NULL DEFAULT 0
                CHECK (progress BETWEEN 0 AND 100),
  result        jsonb,     -- { setCount, matchedDoorCount, unmatchedDoorCount, warnings }
  error         text,
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz
);

-- Frontend subscribes to this table via Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE processing_jobs;

-- RLS: service role writes; users can only read their own project jobs
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Index for project-scoped lookups
CREATE INDEX idx_processing_jobs_project ON processing_jobs (project_id, created_at DESC);

-- Auto-clean completed jobs after 7 days
-- (Add to pg_cron schedule or external cron)
-- DELETE FROM processing_jobs WHERE status IN ('done', 'cancelled') AND completed_at < now() - INTERVAL '7 days';
```

---

## The API Route — Thin Enqueuer

After the migration, `/api/projects/[id]/process` does almost nothing:

```typescript
// apps/api/src/routes/process.ts
import { pdfQueue } from '@planckoff/queue';
import { createProcessingJob } from '@planckoff/db/processingJobs';
import { supabaseAdmin } from '@planckoff/db/supabaseAdmin';

app.post('/:id/process', authMiddleware, async (c) => {
  const projectId = c.req.param('id');
  const user = c.get('user');

  const formData = await c.req.formData();
  const scheduleFile = formData.get('excel') as File;
  const pdfFile = formData.get('pdf') as File;

  if (!scheduleFile || !pdfFile) {
    return c.json({ error: 'Both excel and pdf fields are required' }, 400);
  }

  // Validate sizes BEFORE buffering
  if (scheduleFile.size > 50 * 1024 * 1024) {
    return c.json({ error: 'Door schedule file too large. Maximum is 50 MB.' }, 413);
  }
  if (pdfFile.size > 50 * 1024 * 1024) {
    return c.json({ error: 'Hardware PDF too large. Maximum is 50 MB.' }, 413);
  }

  // Generate job ID upfront so storage paths are known
  const jobId = crypto.randomUUID();

  // Upload files to temp storage
  const scheduleBuffer = Buffer.from(await scheduleFile.arrayBuffer());
  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

  const schedulePath = `temp-uploads/${projectId}/${jobId}/schedule_${scheduleFile.name}`;
  const pdfPath = `temp-uploads/${projectId}/${jobId}/hardware.pdf`;

  await Promise.all([
    supabaseAdmin.storage.from('uploads').upload(schedulePath, scheduleBuffer),
    supabaseAdmin.storage.from('uploads').upload(pdfPath, pdfBuffer),
  ]);

  // Create DB record for Realtime + progress tracking
  await createProcessingJob({
    id: jobId,
    projectId,
    scheduleStoragePath: schedulePath,
    hardwarePdfStoragePath: pdfPath,
    scheduleFileName: scheduleFile.name,
    hardwarePdfFileName: pdfFile.name,
    createdBy: user.id,
  });

  // Enqueue — worker picks this up async
  await pdfQueue.add('process', {
    jobId,
    projectId,
    scheduleStoragePath: schedulePath,
    hardwarePdfStoragePath: pdfPath,
    scheduleFileName: scheduleFile.name,
    hardwarePdfFileName: pdfFile.name,
    uploadedBy: user.id,
  });

  // Return immediately — no waiting for AI
  return c.json({ data: { jobId, status: 'queued' } }, 202);
});
```

Total time for this route: < 2 seconds (file upload to Supabase Storage + DB insert + queue push).

---

## The Worker

```typescript
// apps/pdf-worker/src/worker.ts
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { processUploadJob } from './jobs/processUpload';
import type { PdfJobData } from '@planckoff/queue';

const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const worker = new Worker<PdfJobData>(
  'pdf-processing',
  async (job) => {
    return processUploadJob(job.data);
  },
  {
    connection,
    concurrency: 2,           // process 2 jobs at once; adjust based on memory
    limiter: {
      max: 10,
      duration: 60_000,       // max 10 jobs per minute (rate limit AI calls)
    },
  }
);

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

console.log('PDF worker started');
```

```typescript
// apps/pdf-worker/src/jobs/processUpload.ts
import { supabaseAdmin } from '@planckoff/db/supabaseAdmin';
import { updateProcessingJob } from '@planckoff/db/processingJobs';
import { upsertDoorScheduleImport, upsertHardwarePdfExtraction, upsertProjectHardwareFinal } from '@planckoff/db/hardware';
import { parseDoorSchedule } from '../services/doorScheduleService';
import { extractHardwareSetsFromPdf } from '../services/hardwarePdfServiceV2';
import { generatePrepForAllSets } from '../services/hardwarePrepService';
import { mergeHardwareData } from '../services/mergeService';
import type { PdfJobData } from '@planckoff/queue';

export async function processUploadJob(data: PdfJobData): Promise<void> {
  const { jobId, projectId, scheduleStoragePath, hardwarePdfStoragePath,
          scheduleFileName, hardwarePdfFileName, uploadedBy } = data;

  try {
    await updateProcessingJob(jobId, { status: 'processing', startedAt: new Date() });

    // Download files
    const [scheduleData, pdfData] = await Promise.all([
      supabaseAdmin.storage.from('uploads').download(scheduleStoragePath),
      supabaseAdmin.storage.from('uploads').download(hardwarePdfStoragePath),
    ]);
    const scheduleBuffer = Buffer.from(await scheduleData.data!.arrayBuffer());
    const pdfBuffer = Buffer.from(await pdfData.data!.arrayBuffer());

    // Phase 1: Parse door schedule
    await updateProcessingJob(jobId, { phase: 'schedule', progress: 10 });
    const scheduleResult = parseDoorSchedule(scheduleBuffer, scheduleFileName);
    if (scheduleResult.rowCount === 0) {
      throw new Error('No door rows found in the schedule file.');
    }
    await updateProcessingJob(jobId, { progress: 25 });

    // Phase 2: Extract hardware PDF
    await updateProcessingJob(jobId, { phase: 'hardware', progress: 30 });
    const pdfResult = await extractHardwareSetsFromPdf(pdfBuffer, hardwarePdfFileName, projectId);
    if (pdfResult.setCount === 0) {
      throw new Error('No hardware sets found in the PDF.');
    }
    await updateProcessingJob(jobId, { progress: 65 });

    // Phase 3: Generate prep strings
    await updateProcessingJob(jobId, { phase: 'prep', progress: 70 });
    const prepMap = await generatePrepForAllSets(pdfResult.sets);
    const setsWithPrep = pdfResult.sets.map(s => ({ ...s, prep: prepMap[s.setName] }));
    await updateProcessingJob(jobId, { progress: 80 });

    // Phase 4: Merge + persist
    await updateProcessingJob(jobId, { phase: 'finalizing', progress: 85 });
    const mergeResult = mergeHardwareData(setsWithPrep, scheduleResult.rows, projectId);

    // All DB writes (ideally in a stored procedure transaction — see 04-database.md)
    const { data: savedSchedule } = await upsertDoorScheduleImport(projectId, {
      scheduleJson: scheduleResult.rows, fileName: scheduleFileName, uploadedBy,
    });
    const { data: savedPdf } = await upsertHardwarePdfExtraction(projectId, {
      extractedJson: setsWithPrep, fileName: hardwarePdfFileName, uploadedBy,
    });
    await upsertProjectHardwareFinal(projectId, {
      finalJson: mergeResult.sets,
      pdfExtractionId: savedPdf!.id,
      doorScheduleId: savedSchedule!.id,
      generatedBy: uploadedBy,
    });

    // Mark done — Supabase Realtime fires to frontend
    await updateProcessingJob(jobId, {
      status: 'done',
      progress: 100,
      completedAt: new Date(),
      result: {
        setCount: mergeResult.setCount,
        matchedDoorCount: mergeResult.matchedDoorCount,
        unmatchedDoorCount: mergeResult.unmatchedDoorCount,
        warnings: mergeResult.warnings,
      },
    });

    // Cleanup temp files
    await supabaseAdmin.storage.from('uploads').remove([scheduleStoragePath, hardwarePdfStoragePath]);

  } catch (err) {
    await updateProcessingJob(jobId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date(),
    });
    throw err;  // BullMQ will retry based on job config
  }
}
```

---

## Frontend — Progress Tracking

`ProcessingWidgetContext` already shows a progress widget. Replace the current polling approach with a Supabase Realtime subscription on `processing_jobs`:

```typescript
// contexts/ProcessingWidgetContext.tsx — after the migration
useEffect(() => {
  if (!activeJobId) return;

  const channel = supabase
    .channel(`job-${activeJobId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'processing_jobs',
        filter: `id=eq.${activeJobId}` },
      (payload) => {
        const job = payload.new as ProcessingJob;
        setProgress(job.progress);
        setPhase(job.phase);

        if (job.status === 'done') {
          setStatus('done');
          setResult(job.result);
          refreshProjectData();  // trigger project data reload
        } else if (job.status === 'failed') {
          setStatus('failed');
          setError(job.error);
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [activeJobId]);
```

The user sees a live progress bar: "Extracting hardware sets from PDF... 50%" → "Generating prep functions... 80%" → "Done."

---

## Cancellation

```typescript
// DELETE /api/projects/:id/process/:jobId
app.delete('/:id/process/:jobId', authMiddleware, async (c) => {
  const { id: projectId, jobId } = c.req.param();

  // Mark as cancelled in DB — worker checks this between phases
  await updateProcessingJob(jobId, { status: 'cancelled' });

  // Also remove from queue if not yet picked up
  const job = await pdfQueue.getJob(jobId);
  await job?.remove();

  return c.json({ data: { cancelled: true } });
});
```

Worker respects cancellation between phases:
```typescript
// In processUploadJob, before each phase:
const current = await getProcessingJob(jobId);
if (current.status === 'cancelled') {
  await cleanupTempFiles(scheduleStoragePath, hardwarePdfStoragePath);
  return;  // clean exit
}
```

---

## Retry Strategy

BullMQ handles job-level retries automatically. Configure on queue add:

```typescript
await pdfQueue.add('process', jobData, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 10_000,  // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },  // keep last 100 completed jobs for debugging
  removeOnFail: { count: 50 },
});
```

For step-level retries (retry just the failing AI call, not the whole job), implement in the service:

```typescript
// Inside extractHardwareSetsFromPdf:
async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: Error;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err as Error;
      if (i < maxAttempts - 1) await sleep(2000 * (i + 1));
    }
  }
  throw lastErr!;
}
```

---

## Worker Deployment (Stage 3)

In Stage 2, the worker runs as `node apps/pdf-worker/src/worker.ts` alongside the API server on the same Railway instance. In Stage 3, it gets its own Railway service:

**Stage 2 — single Railway service:**
```
Railway Service: planckoff-api
  Process 1: node apps/api/src/server.ts      (web server, port 3001)
  Process 2: node apps/pdf-worker/src/worker.ts (queue worker, no port)
  
  # Procfile or railway.toml
  web: node apps/api/src/server.ts
  worker: node apps/pdf-worker/src/worker.ts
```

**Stage 3 — separate Railway services:**
```
Railway Service: planckoff-api     → node apps/api/src/server.ts
Railway Service: planckoff-worker  → node apps/pdf-worker/src/worker.ts
  Scale independently:
    - API: 1 instance always
    - Worker: 0–5 instances based on queue depth (autoscale)
```

The only config change between Stage 2 and Stage 3 is Railway deployment config. The code is unchanged.

---

## Other CPU-Bound Operations That Follow the Same Pattern

Once BullMQ is set up for PDF processing, these other heavy operations should use the same async job pattern:

| Operation | Current location | Job type to add |
|-----------|-----------------|-----------------|
| PDF report export (jsPDF) | `services/pdfExportService.ts` | `export.pdf` |
| Excel export (ExcelJS) | `services/excelExportService/` | `export.excel` |
| Submittal package generation | `services/pdfExportService.ts` | `export.submittal` |
| Email delivery (future) | `services/emailService.ts` | `email.send` |

All these become: enqueue job → return download URL → notify via Realtime when ready. Same worker, different job types. The queue and worker infrastructure you build for PDF processing handles all of them.

---

## Summary — Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Job queue | BullMQ + Redis (Upstash) | Battle-tested, persistent, retry built-in, Redis is cheap |
| Progress reporting | Supabase Realtime on processing_jobs | Already set up for other Realtime use; no extra infra |
| Temp file storage | Supabase Storage (temp bucket) | Already used for other uploads; auto-cleanup via lifecycle policy |
| Worker deployment | Railway (same service in Stage 2, separate in Stage 3) | Simple, low cost, easy to scale |
| Framework | Inngest? | No — Inngest adds vendor dependency and hides the queue. BullMQ is simpler and you understand exactly what it's doing. |
