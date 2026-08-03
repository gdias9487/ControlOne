import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ImagePlus } from 'lucide-react';
import { APP_NAME } from '@shared/constants';
import { onboardingSchema, type OnboardingInput } from '@shared/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/contexts/theme-context';
import { toast } from '@/hooks/use-toast';
import { unwrapApi } from '@/utils';
import appLogo from '@/assets/logo.png';

const BUSINESS_SUGGESTIONS = [
  'Joias e acessórios',
  'Roupas e moda',
  'Cosméticos',
  'Mercado / mercearia',
  'Eletrônicos',
  'Serviços',
  'Outro',
];

export function OnboardingPage() {
  const { refreshSettings } = useTheme();
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      storeName: '',
      businessType: '',
      storePhone: '',
      storeEmail: '',
      storeAddress: '',
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: OnboardingInput) =>
      unwrapApi(
        await window.cleideApi.settings.update({
          storeName: values.storeName.trim(),
          businessType: values.businessType?.trim() || null,
          storePhone: values.storePhone?.trim() || null,
          storeEmail: values.storeEmail?.trim() || null,
          storeAddress: values.storeAddress?.trim() || null,
          logoPath,
          onboardingCompleted: true,
        }),
      ),
    onSuccess: async () => {
      await refreshSettings();
      toast({ title: 'Negócio cadastrado', description: 'Tudo pronto para começar.' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  async function pickLogo() {
    try {
      const result = unwrapApi(await window.cleideApi.settings.selectLogo());
      if (!result) return;
      setLogoPath(result.relativePath);
      setLogoUrl(result.url);
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, hsl(var(--glow) / 0.18), transparent 34%), radial-gradient(circle at 88% 12%, hsl(210 12% 55% / 0.12), transparent 30%), linear-gradient(160deg, hsl(var(--background)), hsl(var(--muted) / 0.55))',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-16">
        <div className="max-w-md space-y-5 lg:flex-1">
          <div className="inline-flex items-center gap-3 rounded-2xl border bg-card/80 px-3 py-2 shadow-soft backdrop-blur">
            <img
              src={appLogo}
              alt={APP_NAME}
              className="h-9 w-9 shrink-0 rounded-full object-contain"
            />
            <span className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Cadastre seu negócio
          </h1>
          <p className="text-base text-muted-foreground">
            Configure o estabelecimento uma vez. Depois você gerencia produtos, estoque, vendas,
            serviços e financeiro offline.
          </p>
        </div>

        <form
          className="w-full max-w-md space-y-4 rounded-3xl border bg-card/90 p-6 shadow-elev backdrop-blur lg:flex-1"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label>Nome do negócio *</Label>
            <Input
              {...form.register('storeName')}
              placeholder="Ex.: Ateliê da Maria"
              autoFocus
            />
            {form.formState.errors.storeName ? (
              <p className="text-xs text-destructive">{form.formState.errors.storeName.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Tipo de comércio</Label>
            <Input
              {...form.register('businessType')}
              placeholder="Ex.: Joias, roupas, cosméticos..."
              list="business-types"
            />
            <datalist id="business-types">
              {BUSINESS_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input {...form.register('storePhone')} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input {...form.register('storeEmail')} placeholder="contato@negocio.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Endereço</Label>
            <Textarea {...form.register('storeAddress')} placeholder="Opcional" rows={2} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border bg-muted">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <Button type="button" variant="outline" onClick={() => void pickLogo()}>
              Logo (opcional)
            </Button>
          </div>

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            Começar a usar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
