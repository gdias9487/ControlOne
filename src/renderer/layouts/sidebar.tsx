import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Boxes,
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
import { cn, unwrapApi } from '@/utils';
import { useTheme } from '@/contexts/theme-context';
import { useAccessStatus } from '@/hooks/use-access';
import { Button } from '@/components/ui/button';
import appLogo from '@/assets/logo.png';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/caixa', label: 'Caixa', icon: Store },
  { to: '/vendas', label: 'Vendas', icon: ShoppingBag },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/servicos', label: 'Serviços', icon: Wrench },
  { to: '/estoque', label: 'Estoque', icon: Boxes },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/financeiro', label: 'Despesas', icon: Wallet },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar() {
  const { settings } = useTheme();
  const queryClient = useQueryClient();
  const access = useAccessStatus();

  async function logout() {
    unwrapApi(await window.cleideApi.access.logout());
    await queryClient.invalidateQueries({ queryKey: ['access-status'] });
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card/80 backdrop-blur-sm">
      <div className="border-b px-5 py-6">
        <div className="flex items-center gap-3">
            <img
              src={settings?.logoUrl || appLogo}
              alt={settings?.storeName || APP_NAME}
              className="h-10 w-10 shrink-0 rounded-full object-contain shadow-soft"
            />
            <div>
            <p className="font-display text-xl font-semibold tracking-tight">
              {settings?.storeName || APP_NAME}
            </p>
              <p className="text-xs text-muted-foreground">
                {settings?.businessType || 'Gestão do negócio'}
              </p>
            </div>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {links.map(({ to, label, icon: Icon }) => (
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
