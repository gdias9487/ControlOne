import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import type { BusinessModule } from '@shared/business-profile';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/layouts/app-layout';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { ProductsPage } from '@/pages/products/products-page';
import { ActivePlansPage } from '@/pages/plans/active-plans-page';
import { ServicesPage } from '@/pages/services/services-page';
import { InventoryPage } from '@/pages/inventory/inventory-page';
import { SalesPage } from '@/pages/sales/sales-page';
import { PosPage } from '@/pages/pos/pos-page';
import { CustomersPage } from '@/pages/customers/customers-page';
import { FinancePage } from '@/pages/finance/finance-page';
import { ReportsPage } from '@/pages/reports/reports-page';
import { SettingsPage } from '@/pages/settings/settings-page';
import { OnboardingPage } from '@/pages/onboarding/onboarding-page';
import { ActivationPage, useLicenseGate } from '@/pages/activation/activation-page';
import { LoginPage } from '@/pages/access/login-page';
import { useAccessStatus } from '@/hooks/use-access';
import { useBusinessProfile } from '@/hooks/use-business-profile';
import { unwrapApi } from '@/utils';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

function ModuleRoute({
  module,
  children,
}: {
  module: BusinessModule;
  children: ReactNode;
}) {
  const { hasModule } = useBusinessProfile();
  if (!hasModule(module)) return <Navigate to="/" replace />;
  return children;
}

function CashierUnavailable() {
  const queryClient = useQueryClient();
  const { settings } = useTheme();

  async function logout() {
    unwrapApi(await window.cleideApi.access.logout());
    await queryClient.invalidateQueries({ queryKey: ['access-status'] });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <p className="text-sm font-medium">{settings?.storeName || 'ControlOne'}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          O caixa não está disponível neste perfil de negócio. Entre como dono para continuar.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={() => void logout()}>
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}

function AppRoutes() {
  const license = useLicenseGate();
  const { settings } = useTheme();
  const access = useAccessStatus();
  const { usesPos } = useBusinessProfile();

  if (license.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando licença...
      </div>
    );
  }

  if (!license.valid) {
    return (
      <ActivationPage
        machineId={license.machineId}
        message={license.message}
        onActivated={() => void license.refresh()}
      />
    );
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!settings.onboardingCompleted) {
    return <OnboardingPage />;
  }

  if (access.isLoading && !access.data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando acesso...
      </div>
    );
  }

  if (access.data?.enabled && !access.data.role) {
    return <LoginPage />;
  }

  if (access.data?.role === 'cashier') {
    if (!usesPos) return <CashierUnavailable />;
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="caixa" element={<PosPage />} />
          <Route path="*" element={<Navigate to="/caixa" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route
          path="produtos"
          element={
            <ModuleRoute module="products">
              <ProductsPage />
            </ModuleRoute>
          }
        />
        <Route
          path="planos-ativos"
          element={
            <ModuleRoute module="customerPlans">
              <ActivePlansPage />
            </ModuleRoute>
          }
        />
        <Route
          path="servicos"
          element={
            <ModuleRoute module="services">
              <ServicesPage />
            </ModuleRoute>
          }
        />
        <Route
          path="estoque"
          element={
            <ModuleRoute module="inventory">
              <InventoryPage />
            </ModuleRoute>
          }
        />
        <Route
          path="caixa"
          element={
            <ModuleRoute module="pos">
              <PosPage />
            </ModuleRoute>
          }
        />
        <Route
          path="vendas"
          element={
            <ModuleRoute module="sales">
              <SalesPage />
            </ModuleRoute>
          }
        />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="financeiro" element={<FinancePage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="configuracoes/:section" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
