'use client';

import dynamic from 'next/dynamic';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

// ssr: false — DatabaseView imports components that use browser-only APIs (jsPDF, etc.)
const DatabaseView = dynamic(() => import('@/views/DatabaseView'), { ssr: false });

export default function DatabasePage() {
  const { masterInventory, updateInventory, addToInventory, overwriteInventory } = useProject();
  const { user } = useAuth();
  const { addToast } = useToast();

  return (
    <DatabaseView
      inventory={masterInventory}
      userRole={(user?.role ?? 'Estimator') as never}
      onUpdateInventory={updateInventory}
      onAddToInventory={addToInventory}
      onOverwriteInventory={overwriteInventory}
      addToast={addToast}
    />
  );
}
