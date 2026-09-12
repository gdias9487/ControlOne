import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  PendingRecurringDialog,
  usePendingRecurringPrompt,
} from '@/components/shared/pending-recurring-dialog';
import { LowStockStartupDialog } from '@/components/shared/low-stock-startup-dialog';
import { UpdateBanner } from '@/components/shared/update-banner';
import { Button } from '@/components/ui/button';
import { useAccessStatus } from '@/hooks/use-access';
import { useTheme } from '@/contexts/theme-context';
import { unwrapApi } from '@/utils';
import { Sidebar } from './sidebar';

export function AppLayout() {
  const queryClient = useQueryClient();
  const { settings } = useTheme();
  const access = useAccessStatus();
  const isCashier = access.data?.role === 'cashier';
  const { shouldPrompt } = usePendingRecurringPrompt(!isCashier);
  const [pendingOpen, setPendingOpen] = useState(false);
  const openedRef = useRef(false);

  async function logout() {
    unwrapApi(await window.cleideApi.access.logout());
    await queryClient.invalidateQueries({ queryKey: ['access-status'] });
  }

  useEffect(() => {
    if (shouldPrompt && !openedRef.current) {
      openedRef.current = true;
      setPendingOpen(true);
    }
  }, [shouldPrompt]);

  if (isCashier) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <div className="h-9 shrink-0 [-webkit-app-region:drag]" />
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
          <div>
            <p className="text-sm font-medium">{settings?.storeName || 'Caixa'}</p>
            <p className="text-xs text-muted-foreground">Modo caixa</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Área de arrastar a janela (barra nativa oculta) */}
      <div className="h-9 shrink-0 [-webkit-app-region:drag]" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <UpdateBanner />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
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
