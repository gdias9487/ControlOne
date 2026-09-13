import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Store, UserRound } from 'lucide-react';
import { APP_NAME } from '@shared/constants';
import type { AccessRole } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/contexts/theme-context';
import { toast } from '@/hooks/use-toast';
import { unwrapApi } from '@/utils';
import appLogo from '@/assets/logo.png';

export function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { settings } = useTheme();
  const [role, setRole] = useState<AccessRole>('owner');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [tried, setTried] = useState(false);

  async function submit() {
    setTried(true);
    if (!password.trim()) return;
    setPending(true);
    try {
      const status = unwrapApi(await window.cleideApi.access.login({ role, password }));
      await queryClient.invalidateQueries({ queryKey: ['access-status'] });
      setPassword('');
      toast({
        title: status.role === 'cashier' ? 'Caixa liberado' : 'Bem-vindo',
      });
      navigate(status.role === 'cashier' ? '/caixa' : '/', { replace: true });
    } catch (err) {
      toast({
        title: 'Não foi possível entrar',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-elev">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-card shadow-soft">
            <img
              src={settings?.logoUrl || appLogo}
              alt={settings?.storeName || APP_NAME}
              className="h-14 w-14 object-contain"
            />
          </div>
          <div>
            <CardTitle className="font-display text-2xl">
              {settings?.storeName || APP_NAME}
            </CardTitle>
            <CardDescription className="mt-2">
              Escolha o perfil e digite a senha para continuar.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={role === 'owner' ? 'accent' : 'outline'}
              className="h-11"
              onClick={() => setRole('owner')}
            >
              <UserRound className="h-4 w-4" />
              Dono
            </Button>
            <Button
              type="button"
              variant={role === 'cashier' ? 'accent' : 'outline'}
              className="h-11"
              onClick={() => setRole('cashier')}
            >
              <Store className="h-4 w-4" />
              Caixa
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-password">Senha</Label>
            <Input
              id="access-password"
              type="password"
              autoFocus
              value={password}
              invalid={tried && !password.trim()}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={role === 'cashier' ? 'Senha do caixa' : 'Senha do dono'}
            />
          </div>
          <Button className="w-full" disabled={pending} onClick={() => void submit()}>
            <KeyRound className="h-4 w-4" />
            Entrar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
