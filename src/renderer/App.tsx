import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/layouts/app-layout';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { ProductsPage } from '@/pages/products/products-page';
import { ServicesPage } from '@/pages/services/services-page';
import { InventoryPage } from '@/pages/inventory/inventory-page';
import { SalesPage } from '@/pages/sales/sales-page';
import { CustomersPage } from '@/pages/customers/customers-page';
import { FinancePage } from '@/pages/finance/finance-page';
import { ReportsPage } from '@/pages/reports/reports-page';
import { SettingsPage } from '@/pages/settings/settings-page';
import { OnboardingPage } from '@/pages/onboarding/onboarding-page';
import { ActivationPage, useLicenseGate } from '@/pages/activation/activation-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

function AppRoutes() {
  const license = useLicenseGate();
  const { settings } = useTheme();

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

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="servicos" element={<ServicesPage />} />
        <Route path="estoque" element={<InventoryPage />} />
        <Route path="vendas" element={<SalesPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="financeiro" element={<FinancePage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
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
