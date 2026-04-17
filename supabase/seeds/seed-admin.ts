/**
 * Seed script — creates the initial admin user.
 * Run: npx tsx supabase/seeds/seed-admin.ts
 *
 * Requires .env.local to be present with NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  const email    = 'harsh@planckoff.com';
  const name     = 'Harsh';
  const initials = 'H';
  const role     = 'Administrator';
  const password = 'whothehellitis';

  console.log('🔑  Hashing password…');
  const passwordHash = await bcrypt.hash(password, 12);

  console.log(`👤  Inserting admin: ${email}`);
  const { data, error } = await db
    .from('admins')
    .upsert(
      { email, name, initials, role, password_hash: passwordHash },
      { onConflict: 'email' },
    )
    .select('id, email, name, role')
    .single();

  if (error) {
    console.error('❌  Failed to insert admin:', error.message);
    process.exit(1);
  }

  console.log('✅  Admin seeded successfully:');
  console.log(`    ID:    ${data.id}`);
  console.log(`    Email: ${data.email}`);
  console.log(`    Name:  ${data.name}`);
  console.log(`    Role:  ${data.role}`);
}

seed().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
