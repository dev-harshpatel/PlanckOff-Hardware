/**
 * Shared configuration for the hardware PDF extraction pipeline.
 */

export const MODEL = 'google/gemini-2.5-flash';
// Matrix/checkbox transcription needs a stronger vision model — Flash cannot
// reliably distinguish checked vs unchecked cells in a dense grid. Used ONLY
// for the rare matrix-transcription call, never for regular extraction.
export const MATRIX_MODEL = 'google/gemini-2.5-pro';
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;   // 50 MB hard cap
export const TIER1_SIZE_LIMIT = 20 * 1024 * 1024;       // 20 MB — above this, skip Tier 1 (raw PDF → Gemini)
export const TIER2_BATCH_SIZE = 10;                      // pages per AI batch in Tier 2
export const TIER2_MAX_CONCURRENT = 4;                   // parallel AI calls in Tier 2
