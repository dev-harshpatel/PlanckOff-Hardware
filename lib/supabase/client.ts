'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase browser client — use inside Client Components and hooks.
 * Uses the public anon key (safe to expose to the browser).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
