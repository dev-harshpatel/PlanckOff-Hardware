import type { HardwareItem } from '@/types';

/**
 * Seed data used as a fallback when no inventory exists in the database yet.
 * TODO (Phase 1.3): Remove once Supabase migration is complete — seed via DB migration instead.
 */
export const initialMasterInventory: HardwareItem[] = [
  { id: 'inv-001', name: 'Hinges', quantity: 0, manufacturer: 'Stanley', description: 'Standard butt hinge', finish: 'Satin Chrome' },
  { id: 'inv-002', name: 'Lever Lockset', quantity: 0, manufacturer: 'Schlage', description: 'Office function lock', finish: 'Satin Chrome' },
  { id: 'inv-003', name: 'Door Closer', quantity: 0, manufacturer: 'LCN', description: 'Surface mounted closer', finish: 'Aluminum' },
];
