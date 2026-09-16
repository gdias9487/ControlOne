import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Boxes,
  Briefcase,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { APP_NAME } from '@shared/constants';
import type { BusinessModule } from '@shared/business-profile';
import { cn, unwrapApi } from '@/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAccessStatus } from '@/hooks/use-access';
import { useBusinessProfile } from '@/hooks/use-business-profile';
import { Button } from '@/components/ui/button';
import appLogo from '@/assets/logo.png';

export function Sidebar() {
  const { settings } = useTheme();
  const queryClient = useQueryClient();
  const access = useAccessStatus();
  const { copy, hasModule, usesPlansLabel } = useBusinessProfile();

  const links: Array<{
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
    module: BusinessModule;
  }> = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
    { to: '/caixa', label: 'Caixa', icon: Store, module: 'pos' },
    { to: '/vendas', label: 'Vendas', icon: ShoppingBag, module: 'sales' },
    {
      to: '/produtos',
      label: copy.navLabel,
      icon: usesPlansLabel ? Briefcase : Package,
      module: 'products',
    },
    { to: '/planos-ativos', label: 'Planos ativos', icon: CalendarCheck, module: 'customerPlans' },
    { to: '/servicos', label: 'Serviços', icon: Wrench, module: 'services' },
    { to: '/estoque', label: 'Estoque', icon: Boxes, module: 'inventory' },
    { to: '/clientes', label: 'Clientes', icon: Users, module: 'customers' },
    { to: '/financeiro', label: 'Despesas', icon: Wallet, module: 'finance' },
    { to: '/relatorios', label: 'Relatórios', icon: BarChart3, module: 'reports' },
    { to: '/configuracoes', label: 'Configurações', icon: Settings, module: 'settings' },
  ];

  async function logout() {
    unwrapApi(await window.cleideApi.access.logout());
    await queryClient.invalidateQueries({ queryKey: ['access-status'] });
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex h-[88px] shrink-0 items-center border-b px-6">
        <div className="flex items-center gap-3">
          <img
            src={settings?.logoUrl || appLogo}
            alt={settings?.storeName || APP_NAME}
            className="h-10 w-10 shrink-0 rounded-full object-contain shadow-soft"
          />
          <div>
            <p className="font-display text-2xl font-semibold leading-tight tracking-tight">
              {settings?.storeName || APP_NAME}
            </p>
            <p className="text-sm text-muted-foreground">
              {settings?.businessType || 'Gestão do negócio'}
            </p>
          </div>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {links
          .filter((link) => hasModule(link.module))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all outline-none ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 hover:bg-muted hover:text-foreground',
                  isActive && 'bg-primary text-primary-foreground shadow-soft hover:bg-primary hover:text-primary-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
      </nav>
      <div className="space-y-2 border-t p-4">
        {access.data?.enabled ? (
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">Sistema offline · Windows</p>
      </div>
    </aside>
  );
}
