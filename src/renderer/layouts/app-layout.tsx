import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  PendingRecurringDialog,
  usePendingRecurringPrompt,
} from '@/components/shared/pending-recurring-dialog';
import { LowStockStartupDialog } from '@/components/shared/low-stock-startup-dialog';
import { Sidebar } from './sidebar';

export function AppLayout() {
  const { shouldPrompt } = usePendingRecurringPrompt(true);
  const [pendingOpen, setPendingOpen] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    if (shouldPrompt && !openedRef.current) {
      openedRef.current = true;
      setPendingOpen(true);
    }
  }, [shouldPrompt]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
      <PendingRecurringDialog
        open={pendingOpen}
        onOpenChange={setPendingOpen}
        respectSessionSkip
      />
      {!pendingOpen ? <LowStockStartupDialog /> : null}
    </div>
  );
}
