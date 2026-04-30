import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { upsertCompanySettings, getCompanySettings } from '@/lib/db/companySettings';

const BUCKET = 'company-logos';

async function ensureBucket() {
  const db = createSupabaseAdminClient();
  const { data: buckets } = await db.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    await db.storage.createBucket(BUCKET, { public: true });
  }
}

export const POST = withAuth(async (req: NextRequest, { user }: AuthContext) => {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  const file = formData.get('logo');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No logo file provided.' }, { status: 400 });
  }

  const mimeType = file.type || 'image/png';
  if (!mimeType.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image.' }, { status: 400 });
  }

  const ext = mimeType.split('/')[1] ?? 'png';
  const filename = `logo.${ext}`;
  const storagePath = `${user.id}/${filename}`;

  await ensureBucket();

  const db = createSupabaseAdminClient();
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  const logoUrl = urlData.publicUrl;

  const { error: dbError } = await upsertCompanySettings(user.id, { logoUrl });
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { logoUrl } });
});

export const DELETE = withAuth(async (_req: NextRequest, { user }: AuthContext) => {
  const { data: settings } = await getCompanySettings(user.id);
  const existingUrl = settings?.logoUrl ?? '';

  if (existingUrl) {
    const db = createSupabaseAdminClient();
    const storagePath = `${user.id}/`;
    const { data: files } = await db.storage.from(BUCKET).list(user.id);
    if (files && files.length > 0) {
      await db.storage
        .from(BUCKET)
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }
  }

  const { error } = await upsertCompanySettings(user.id, { logoUrl: '' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
});
