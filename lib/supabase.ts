// Legacy single client — still used by existing services during migration.
// New code should use lib/supabase/client.ts (browser) or lib/supabase/server.ts (server).
// In browser contexts this re-exports the singleton from client.ts to avoid multiple GoTrueClient instances.

import { createSupabaseBrowserClient } from './supabase/client';

export const supabase = createSupabaseBrowserClient();
