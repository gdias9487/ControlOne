import { useEffect, useState } from 'react';
import { Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { APP_NAME } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { unwrapApi } from '@/utils';
import appLogo from '@/assets/logo.png';

interface ActivationPageProps {
  machineId: string;
  message?: string;
  onActivated: () => void;
}

export function ActivationPage({ machineId, message, onActivated }: ActivationPageProps) {
  const [key, setKey] = useState('');
  const [pending, setPending] = useState(false);

  async function copyMachineId() {
    try {
      await navigator.clipboard.writeText(machineId);
      toast({ title: 'ID copiado', description: 'Envie este código para ativar a licença.' });
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: machineId,
        variant: 'destructive',
      });
    }
  }

  async function activate() {
    setPending(true);
    try {
      const status = unwrapApi(await window.cleideApi.license.activate(key));
      if (!status.valid) {
        throw new Error(status.message || 'Licença inválida.');
      }
      toast({ title: 'Licença ativada', description: 'O sistema está liberado neste computador.' });
      onActivated();
    } catch (err) {
      toast({
        title: 'Falha na ativação',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-100 via-slate-100 to-zinc-200 p-6 dark:from-zinc-950 dark:via-zinc-900 dark:to-black">
      <Card className="w-full max-w-lg shadow-elev">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-card shadow-soft">
            <img src={appLogo} alt={APP_NAME} className="h-14 w-14 object-contain" />
          </div>
          <div>
            <CardTitle className="font-display text-2xl">Ativar {APP_NAME}</CardTitle>
            <CardDescription className="mt-2">
              Este computador precisa de uma licença. Envie o ID da máquina e cole a chave
              recebida.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {message ? (
            <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              {message}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label>ID da máquina</Label>
            <div className="flex gap-2">
              <Input value={machineId} readOnly className="font-mono text-sm" />
              <Button type="button" variant="outline" onClick={() => void copyMachineId()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copie e envie este código (WhatsApp, e-mail, etc.).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Chave de licença</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="CO1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              className="font-mono text-sm"
              autoFocus
            />
          </div>

          <Button
            className="w-full"
            disabled={pending || key.trim().length < 10}
            onClick={() => void activate()}
          >
            {pending ? (
              'Validando...'
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Ativar licença
              </>
            )}
          </Button>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A chave funciona apenas neste computador. Em outro PC será necessário autorizar de novo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Hook leve para status de licença no boot. */
export function useLicenseGate() {
  const [status, setStatus] = useState<{
    loading: boolean;
    valid: boolean;
    machineId: string;
    message: string;
  }>({ loading: true, valid: false, machineId: '', message: '' });

  async function refresh() {
    if (!window.cleideApi?.license) {
      setStatus({
        loading: false,
        valid: true,
        machineId: '',
        message: 'API de licença indisponível (modo web).',
      });
      return;
    }
    try {
      const data = unwrapApi(await window.cleideApi.license.status());
      setStatus({
        loading: false,
        valid: data.valid,
        machineId: data.machineId,
        message: data.message,
      });
    } catch (err) {
      setStatus({
        loading: false,
        valid: false,
        machineId: '',
        message: (err as Error).message,
      });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { ...status, refresh };
}
