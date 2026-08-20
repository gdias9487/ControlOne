import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  PendingRecurringDialog,
  usePendingRecurringPrompt,
} from '@/components/shared/pending-recurring-dialog';
import { LowStockStartupDialog } from '@/components/shared/low-stock-startup-dialog';
import { UpdateBanner } from '@/components/shared/update-banner';
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
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Área de arrastar a janela (barra nativa oculta) */}
      <div className="h-9 shrink-0 [-webkit-app-region:drag]" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <UpdateBanner />
          <Outlet />
        </main>
      </div>
      <PendingRecurringDialog
        open={pendingOpen}
        onOpenChange={setPendingOpen}
        respectSessionSkip
      />
      {!pendingOpen ? <LowStockStartupDialog /> : null}
    </div>
  );
}
