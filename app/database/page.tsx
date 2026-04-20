'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { RoleName } from '@/types/auth';

// ssr: false — DatabaseView uses browser-only APIs
const DatabaseView = dynamic(() => import('@/views/DatabaseView'), { ssr: false });

export default function DatabasePage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  return (
    <DatabaseView
      userRole={(user?.role ?? 'Estimator') as RoleName}
      addToast={addToast as (t: { type: string; message: string; details?: string }) => void}
    />
  );
}
