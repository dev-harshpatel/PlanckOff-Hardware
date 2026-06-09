import { createClient } from '@supabase/supabase-js';

// Legacy singleton — used by services that run in both browser and server contexts.
// New code should use lib/supabase/client.ts (browser) or lib/supabase/server.ts (server).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
