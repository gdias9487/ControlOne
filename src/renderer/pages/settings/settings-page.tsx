import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Copy,
  Download,
  FolderOpen,
  HardDriveDownload,
  HardDriveUpload,
  ImagePlus,
  KeyRound,
  Moon,
  Pencil,
  RefreshCw,
  Sun,
} from 'lucide-react';
import type { UpdaterStatusDto } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { BusinessProfilePicker } from '@/components/shared/business-profile-picker';
import { useTheme } from '@/contexts/theme-context';
import { toast } from '@/hooks/use-toast';
import { unwrapApi } from '@/utils';
import { useAccessStatus } from '@/hooks/use-access';
import { useBusinessProfile } from '@/hooks/use-business-profile';
import {
  BUSINESS_PROFILE_OPTIONS,
  BUSINESS_TYPE_SUGGESTIONS,
  profileHasModule,
  type BusinessProfile,
} from '@shared/business-profile';
import {
  CASHIER_GRANTABLE_MODULES,
  CASHIER_MODULE_LABELS,
  defaultCashierModules,
  type CashierGrantableModule,
} from '@shared/access';

const SECTIONS = [
  {
    id: 'negocio',
    nav: 'Estabelecimento',
    title: 'Geral',
    description: 'Nome, perfil de uso, contato e estoque',
  },
  {
    id: 'acesso',
    nav: 'Acesso',
    title: 'Controle de acesso',
    description: 'Senha do dono e o que o funcionário pode ver',
  },
  {
    id: 'aparencia',
    nav: 'Aparência',
    title: 'Aparência',
    description: 'Tema claro ou escuro',
  },
  {
    id: 'atualizacoes',
    nav: 'Atualizações',
    title: 'Atualizações',
    description: 'Versão do app e novas releases',
  },
  {
    id: 'licenca',
    nav: 'Licença',
    title: 'Licença',
    description: 'ID da máquina e chave de ativação',
  },
  {
    id: 'backup',
    nav: 'Backup',
    title: 'Backup',
    description: 'Cópia e restauração dos dados',
  },
] as const;

type SettingsSectionId = (typeof SECTIONS)[number]['id'];

function isSettingsSection(value: string | undefined): value is SettingsSectionId {
  return SECTIONS.some((section) => section.id === value);
}

function storeInitials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  if (section && !isSettingsSection(section)) {
    return <Navigate to="/configuracoes/negocio" replace />;
  }
  if (!section) {
    return <Navigate to="/configuracoes/negocio" replace />;
  }

  const current = section;
  const meta = SECTIONS.find((item) => item.id === current) ?? SECTIONS[0];

  return (
    <div className="page-enter flex min-h-full flex-col">
      <SettingsProfileHeader />
      <div className="flex min-h-0 flex-1">
        <nav className="w-52 shrink-0 px-6 py-6" aria-label="Seções de configuração">
          <ul className="space-y-1">
            {SECTIONS.map((item) => {
              const active = item.id === current;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/configuracoes/${item.id}`)}
                    className={`block w-full border-l-2 py-2 pl-3 text-left text-sm transition-colors ${
                      active
                        ? 'border-foreground font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.nav}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <section className="min-h-full min-w-0 flex-1 bg-card px-8 py-8">
          <div className="mb-8 max-w-3xl">
            <h2 className="font-display text-xl font-semibold tracking-tight">{meta.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
          </div>
          {current === 'negocio' ? <BusinessSettings /> : null}
          {current === 'acesso' ? <AccessSettingsCard /> : null}
          {current === 'aparencia' ? <AppearanceSettings /> : null}
          {current === 'atualizacoes' ? <UpdatesSettings /> : null}
          {current === 'licenca' ? <LicenseSettings /> : null}
          {current === 'backup' ? <BackupSettings /> : null}
        </section>
      </div>
    </div>
  );
}

function SettingsProfileHeader() {
  const { settings } = useTheme();
  const profileLabel =
    BUSINESS_PROFILE_OPTIONS.find((item) => item.id === settings?.businessProfile)?.title ??
    'Negócio';
  const place = settings?.businessType?.trim() || profileLabel;

  return (
    <header className="px-8 pb-6 pt-8">
      <div className="flex items-center gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold tracking-wide text-muted-foreground">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            storeInitials(settings?.storeName)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {settings?.storeName || 'Configurações'}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            {place}
          </p>
        </div>
      </div>
    </header>
  );
}

function BusinessSettings() {
  const { settings, refreshSettings } = useTheme();
  const [form, setForm] = useState({
    storeName: '',
    businessType: '',
    businessProfile: 'commerce' as BusinessProfile,
    storePhone: '',
    storeEmail: '',
    storeAddress: '',
    defaultMinStock: 5,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [storeNameTried, setStoreNameTried] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      storeName: settings.storeName,
      businessType: settings.businessType ?? '',
      businessProfile: settings.businessProfile ?? 'commerce',
      storePhone: settings.storePhone ?? '',
      storeEmail: settings.storeEmail ?? '',
      storeAddress: settings.storeAddress ?? '',
      defaultMinStock: settings.defaultMinStock,
    });
    setLogoUrl(settings.logoUrl);
    setLogoPath(settings.logoPath);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      unwrapApi(
        await window.cleideApi.settings.update({
          ...form,
          businessType: form.businessType || null,
          businessProfile: form.businessProfile,
          logoPath,
          storeEmail: form.storeEmail || null,
          storePhone: form.storePhone || null,
          storeAddress: form.storeAddress || null,
        }),
      ),
    onSuccess: async () => {
      await refreshSettings();
      toast({ title: 'Configurações salvas' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  async function selectLogo() {
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
    <div className="max-w-2xl space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-xl bg-muted">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" /> : null}
          </div>
          <Button variant="outline" onClick={() => void selectLogo()}>
            <ImagePlus className="h-4 w-4" /> Selecionar logotipo
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Nome do negócio</Label>
          <Input
            value={form.storeName}
            onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
            invalid={storeNameTried && !form.storeName.trim()}
          />
        </div>
        <div className="space-y-2">
          <Label>Como você usa o sistema</Label>
          <BusinessProfilePicker
            value={form.businessProfile}
            onChange={(businessProfile) =>
              setForm((f) => ({
                ...f,
                businessProfile,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Ramo ou especialidade</Label>
          <Input
            value={form.businessType}
            onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
            placeholder={
              form.businessProfile === 'consultancy'
                ? 'Ex.: Personal trainer, consultoria financeira...'
                : 'Ex.: Joias, roupas, cosméticos...'
            }
            list="settings-business-types"
          />
          <datalist id="settings-business-types">
            {BUSINESS_TYPE_SUGGESTIONS[form.businessProfile].map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            value={form.storePhone}
            onChange={(e) => setForm((f) => ({ ...f, storePhone: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input
            value={form.storeEmail}
            onChange={(e) => setForm((f) => ({ ...f, storeEmail: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Endereço</Label>
          <Input
            value={form.storeAddress}
            onChange={(e) => setForm((f) => ({ ...f, storeAddress: e.target.value }))}
          />
        </div>
        {profileHasModule(form.businessProfile, 'inventory') ? (
          <div className="space-y-2">
            <Label>Estoque mínimo padrão</Label>
            <Input
              type="number"
              value={form.defaultMinStock}
              onChange={(e) => setForm((f) => ({ ...f, defaultMinStock: Number(e.target.value) }))}
            />
          </div>
        ) : null}
        <Button
          onClick={() => {
            if (!form.storeName.trim()) {
              setStoreNameTried(true);
              return;
            }
            saveMutation.mutate();
          }}
        >
          Salvar alterações
        </Button>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex max-w-2xl items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        Tema {theme === 'dark' ? 'escuro' : 'claro'}
      </div>
      <Switch
        checked={theme === 'dark'}
        onCheckedChange={(checked) => void setTheme(checked ? 'dark' : 'light')}
      />
    </div>
  );
}

function UpdatesSettings() {
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatusDto | null>(null);
  const [updaterBusy, setUpdaterBusy] = useState(false);

  useEffect(() => {
    if (!window.cleideApi?.updater) return;
    let cancelled = false;
    void (async () => {
      try {
        const status = unwrapApi(await window.cleideApi.updater.getStatus());
        if (!cancelled) setUpdaterStatus(status);
      } catch {
        // ignore
      }
    })();
    const unsubscribe = window.cleideApi.updater.onStatus((status) => {
      setUpdaterStatus(status);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function checkUpdates() {
    setUpdaterBusy(true);
    try {
      const status = unwrapApi(await window.cleideApi.updater.check());
      setUpdaterStatus(status);
      if (status.state === 'available') {
        toast({
          title: 'Atualização disponível',
          description: `Versão ${status.availableVersion}`,
        });
      } else if (status.state === 'not-available') {
        toast({ title: 'Você já está na versão mais recente' });
      } else if (status.state === 'error') {
        toast({
          title: 'Não foi possível verificar',
          description: status.message ?? undefined,
          variant: 'destructive',
        });
      } else if (!status.canCheck) {
        toast({
          title: 'Disponível só na versão instalada',
          description: 'O auto-update não roda em modo desenvolvimento.',
        });
      }
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUpdaterBusy(false);
    }
  }

  async function downloadUpdate() {
    setUpdaterBusy(true);
    try {
      unwrapApi(await window.cleideApi.updater.download());
    } catch (err) {
      toast({ title: 'Erro no download', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUpdaterBusy(false);
    }
  }

  async function installUpdate() {
    setUpdaterBusy(true);
    try {
      unwrapApi(await window.cleideApi.updater.install());
    } catch (err) {
      setUpdaterBusy(false);
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        O app verifica novas versões no GitHub ao abrir. Use o Setup instalado para atualizar
        pelo próprio ControlOne.
      </p>
      <p className="text-sm">
        Versão instalada:{' '}
        <span className="font-medium">{updaterStatus?.currentVersion ?? '...'}</span>
      </p>
      {updaterStatus?.availableVersion ? (
        <p className="text-sm text-muted-foreground">Disponível: {updaterStatus.availableVersion}</p>
      ) : null}
      {updaterStatus?.message ? (
        <p className="text-xs text-muted-foreground">{updaterStatus.message}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={updaterBusy} onClick={() => void checkUpdates()}>
          <RefreshCw className="h-4 w-4" /> Verificar atualizações
        </Button>
        {updaterStatus?.state === 'available' ? (
          <Button disabled={updaterBusy} onClick={() => void downloadUpdate()}>
            <Download className="h-4 w-4" /> Baixar atualização
          </Button>
        ) : null}
        {updaterStatus?.state === 'downloaded' ? (
          <Button disabled={updaterBusy} onClick={() => void installUpdate()}>
            <RefreshCw className="h-4 w-4" /> Reiniciar e instalar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function LicenseSettings() {
  const queryClient = useQueryClient();
  const [licenseKey, setLicenseKey] = useState('');
  const licenseQuery = useQuery({
    queryKey: ['license-status'],
    queryFn: async () => unwrapApi(await window.cleideApi.license.status()),
  });

  const activateMutation = useMutation({
    mutationFn: async () => unwrapApi(await window.cleideApi.license.activate(licenseKey)),
    onSuccess: async () => {
      setLicenseKey('');
      await queryClient.invalidateQueries({ queryKey: ['license-status'] });
      toast({ title: 'Licença atualizada' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro na licença', description: err.message, variant: 'destructive' }),
  });

  async function copyMachineId() {
    const id = licenseQuery.data?.machineId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      toast({ title: 'ID da máquina copiado' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Controle de ativação por máquina. Em desenvolvimento a licença fica liberada.
      </p>
      <p className="text-sm">
        Status:{' '}
        <span className="font-medium">
          {licenseQuery.data?.valid
            ? licenseQuery.data.bypass
              ? 'Liberada (dev)'
              : 'Ativa'
            : 'Pendente'}
        </span>
      </p>
      {licenseQuery.data?.activatedAt ? (
        <p className="text-xs text-muted-foreground">
          Ativada em {new Date(licenseQuery.data.activatedAt).toLocaleString('pt-BR')}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label>ID da máquina</Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={licenseQuery.data?.machineId ?? '...'}
            className="font-mono text-sm"
          />
          <Button type="button" variant="outline" onClick={() => void copyMachineId()}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Nova chave</Label>
        <Input
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="CO1-...."
          className="font-mono text-sm"
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={activateMutation.isPending || licenseKey.trim().length < 10}
        onClick={() => activateMutation.mutate()}
      >
        <KeyRound className="h-4 w-4" /> Atualizar licença
      </Button>
    </div>
  );
}

function BackupSettings() {
  const { settings, refreshSettings } = useTheme();
  const [confirmRestore, setConfirmRestore] = useState(false);

  async function backup() {
    try {
      const result = unwrapApi(await window.cleideApi.settings.backup());
      toast({ title: 'Backup criado', description: result.path });
      await refreshSettings();
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function selectBackupFolder() {
    try {
      const result = unwrapApi(await window.cleideApi.settings.selectBackupFolder());
      if (!result) return;
      toast({ title: 'Pasta de backup definida', description: result.path });
      await refreshSettings();
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function restore() {
    try {
      const safety = unwrapApi(await window.cleideApi.settings.restore());
      toast({
        title: 'Backup restaurado',
        description: `Um backup de segurança foi criado em ${safety.path}`,
      });
      await refreshSettings();
      setConfirmRestore(false);
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
  }

  return (
    <>
      <div className="max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Os backups são salvos com data e hora no nome do arquivo. Pasta atual:{' '}
          {settings?.backupFolder ?? 'Padrão do sistema'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void selectBackupFolder()}>
            <FolderOpen className="h-4 w-4" /> Selecionar pasta
          </Button>
          <Button variant="secondary" onClick={() => void backup()}>
            <HardDriveDownload className="h-4 w-4" /> Criar backup
          </Button>
          <Button variant="destructive" onClick={() => setConfirmRestore(true)}>
            <HardDriveUpload className="h-4 w-4" /> Restaurar backup
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restaurar backup?"
        description="Antes de restaurar, o sistema cria automaticamente um backup do estado atual."
        confirmLabel="Restaurar"
        onConfirm={() => void restore()}
      />
    </>
  );
}

function AccessSettingsCard() {
  const queryClient = useQueryClient();
  const access = useAccessStatus();
  const { refreshSettings } = useTheme();
  const { hasModule, copy } = useBusinessProfile();
  const grantableModules = CASHIER_GRANTABLE_MODULES.filter((module) => hasModule(module));
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerConfirm, setOwnerConfirm] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [cashierConfirm, setCashierConfirm] = useState('');
  const [currentOwnerPassword, setCurrentOwnerPassword] = useState('');
  const [action, setAction] = useState<'owner' | 'cashier' | 'disable' | null>(null);
  const [accessTried, setAccessTried] = useState(false);
  const [setupModules, setSetupModules] = useState<CashierGrantableModule[]>(() =>
    defaultCashierModules(hasModule),
  );
  const savedModules = access.data?.cashierModules ?? defaultCashierModules(hasModule);
  const usesCashier = savedModules.length > 0 || setupModules.length > 0;

  function resetFields() {
    setOwnerPassword('');
    setOwnerConfirm('');
    setCashierPassword('');
    setCashierConfirm('');
    setCurrentOwnerPassword('');
    setAction(null);
    setAccessTried(false);
  }

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (ownerPassword !== ownerConfirm) throw new Error('As senhas do dono não coincidem.');
      if (usesCashier) {
        if (cashierPassword !== cashierConfirm) throw new Error('As senhas do caixa não coincidem.');
      }
      return unwrapApi(
        await window.cleideApi.access.setup({
          ownerPassword,
          cashierPassword: usesCashier ? cashierPassword : undefined,
        }),
      );
    },
    onSuccess: async () => {
      if (setupModules.length > 0) {
        unwrapApi(await window.cleideApi.settings.update({ cashierModules: setupModules }));
        await refreshSettings();
      }
      resetFields();
      await queryClient.invalidateQueries({ queryKey: ['access-status'] });
      toast({ title: 'Controle de acesso ativado' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (action === 'owner') {
        if (ownerPassword !== ownerConfirm) throw new Error('As senhas do dono não coincidem.');
      }
      if (action === 'cashier') {
        if (cashierPassword !== cashierConfirm) throw new Error('As senhas do caixa não coincidem.');
      }
      return unwrapApi(
        await window.cleideApi.access.update({
          currentOwnerPassword,
          ownerPassword: action === 'owner' ? ownerPassword : undefined,
          cashierPassword: action === 'cashier' ? cashierPassword : undefined,
        }),
      );
    },
    onSuccess: async () => {
      const changed = action;
      resetFields();
      await queryClient.invalidateQueries({ queryKey: ['access-status'] });
      toast({
        title: changed === 'cashier' ? 'Senha do caixa atualizada' : 'Senha do dono atualizada',
      });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const modulesMutation = useMutation({
    mutationFn: async (next: CashierGrantableModule[]) => {
      if (next.length === 0) throw new Error('Escolha ao menos um acesso para o funcionário.');
      return unwrapApi(await window.cleideApi.settings.update({ cashierModules: next }));
    },
    onSuccess: async () => {
      await refreshSettings();
      await queryClient.invalidateQueries({ queryKey: ['access-status'] });
      toast({ title: 'Acessos do funcionário atualizados' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function moduleLabel(module: CashierGrantableModule) {
    if (module === 'products') return copy.navLabel;
    return CASHIER_MODULE_LABELS[module];
  }

  function toggleSetupModule(module: CashierGrantableModule, enabled: boolean) {
    setSetupModules((current) =>
      enabled
        ? [...new Set([...current, module])]
        : current.filter((item) => item !== module),
    );
  }

  function toggleSavedModule(module: CashierGrantableModule, enabled: boolean) {
    const next = enabled
      ? [...new Set([...savedModules, module])]
      : savedModules.filter((item) => item !== module);
    modulesMutation.mutate(next);
  }

  const disableMutation = useMutation({
    mutationFn: async () => {
      return unwrapApi(await window.cleideApi.access.disable({ currentOwnerPassword }));
    },
    onSuccess: async () => {
      resetFields();
      await queryClient.invalidateQueries({ queryKey: ['access-status'] });
      toast({ title: 'Controle de acesso desativado' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const ownerPermissions = [
    hasModule('dashboard') ? 'Dashboard e lucros' : null,
    hasModule('pos') ? 'Caixa' : null,
    hasModule('sales') ? 'Vendas' : null,
    hasModule('products') ? 'Produtos' : null,
    hasModule('services') ? 'Serviços' : null,
    hasModule('customerPlans') ? 'Planos dos clientes' : null,
    hasModule('inventory') ? 'Estoque' : null,
    'Clientes',
    'Despesas',
    hasModule('reports') ? 'Relatórios' : null,
    'Configurações',
  ].filter((item): item is string => Boolean(item));

  const employeePermissions = savedModules
    .filter((module) => hasModule(module))
    .map((module) => moduleLabel(module));

  return (
    <div className="max-w-3xl space-y-8">
          {access.data?.enabled ? (
            <>
              <div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Permissões
                  </p>
                  {action == null ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#3b6eea] hover:underline dark:text-sky-300"
                      onClick={() => setAction('owner')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">Ativado</span>
                </p>
                <div className="mt-6 grid gap-8 sm:grid-cols-2">
                  <PermissionGroup title="Dono" items={ownerPermissions} />
                  <PermissionGroup
                    title="Funcionário"
                    items={
                      employeePermissions.length > 0
                        ? employeePermissions
                        : ['Sem acesso liberado']
                    }
                    mutedEmpty={employeePermissions.length === 0}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Acessos do funcionário</p>
                  <p className="text-sm text-muted-foreground">
                    Escolha o que o funcionário pode abrir. Dashboard, despesas, relatórios e
                    configurações continuam só com a senha do dono.
                  </p>
                  {savedModules.length > 0 && !access.data?.hasCashierPassword ? (
                    <p className="mt-2 text-sm text-amber-700">
                      Defina a senha do caixa para o funcionário conseguir entrar.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {grantableModules.map((module) => (
                    <div
                      key={module}
                      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
                    >
                      <p className="text-sm font-medium">{moduleLabel(module)}</p>
                      <Switch
                        checked={savedModules.includes(module)}
                        disabled={modulesMutation.isPending}
                        onCheckedChange={(checked) => toggleSavedModule(module, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {action == null ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setAction('owner')}>
                    Alterar senha do dono
                  </Button>
                  {usesCashier ? (
                    <Button type="button" variant="outline" onClick={() => setAction('cashier')}>
                      Alterar senha do caixa
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" onClick={() => setAction('disable')}>
                    Desativar acesso
                  </Button>
                </div>
              ) : null}

              {action === 'owner' || action === 'cashier' ? (
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-sm font-medium">
                    {action === 'owner' ? 'Alterar senha do dono' : 'Alterar senha do caixa'}
                  </p>
                  <div className="space-y-2">
                    <Label>Senha atual do dono</Label>
                    <Input
                      type="password"
                      value={currentOwnerPassword}
                      onChange={(e) => setCurrentOwnerPassword(e.target.value)}
                      autoFocus
                      invalid={accessTried && !currentOwnerPassword.trim()}
                    />
                  </div>
                  {action === 'owner' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Nova senha do dono</Label>
                        <Input
                          type="password"
                          value={ownerPassword}
                          onChange={(e) => setOwnerPassword(e.target.value)}
                          invalid={accessTried && !ownerPassword.trim()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirmar nova senha</Label>
                        <Input
                          type="password"
                          value={ownerConfirm}
                          onChange={(e) => setOwnerConfirm(e.target.value)}
                          invalid={accessTried && !ownerConfirm.trim()}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Nova senha do caixa</Label>
                        <Input
                          type="password"
                          value={cashierPassword}
                          onChange={(e) => setCashierPassword(e.target.value)}
                          invalid={accessTried && !cashierPassword.trim()}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirmar nova senha</Label>
                        <Input
                          type="password"
                          value={cashierConfirm}
                          onChange={(e) => setCashierConfirm(e.target.value)}
                          invalid={accessTried && !cashierConfirm.trim()}
                        />
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={() => {
                        setAccessTried(true);
                        if (!currentOwnerPassword.trim()) return;
                        if (action === 'owner' && (!ownerPassword.trim() || !ownerConfirm.trim())) return;
                        if (action === 'cashier' && (!cashierPassword.trim() || !cashierConfirm.trim())) return;
                        updateMutation.mutate();
                      }}
                    >
                      Salvar senha
                    </Button>
                    <Button type="button" variant="outline" onClick={() => resetFields()}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}

              {action === 'disable' ? (
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-sm font-medium">Desativar controle de acesso</p>
                  <p className="text-sm text-muted-foreground">
                    Informe a senha atual do dono. Depois disso, qualquer pessoa neste computador
                    entra direto.
                  </p>
                  <div className="space-y-2">
                    <Label>Senha atual do dono</Label>
                    <Input
                      type="password"
                      value={currentOwnerPassword}
                      onChange={(e) => setCurrentOwnerPassword(e.target.value)}
                      autoFocus
                      invalid={accessTried && !currentOwnerPassword.trim()}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={disableMutation.isPending}
                      onClick={() => {
                        setAccessTried(true);
                        if (!currentOwnerPassword.trim()) return;
                        disableMutation.mutate();
                      }}
                    >
                      Desativar
                    </Button>
                    <Button type="button" variant="outline" onClick={() => resetFields()}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Opcional. Enquanto estiver desligado, qualquer pessoa no PC entra como dono.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Senha do dono</Label>
                  <Input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    invalid={accessTried && !ownerPassword.trim()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar dono</Label>
                  <Input
                    type="password"
                    value={ownerConfirm}
                    onChange={(e) => setOwnerConfirm(e.target.value)}
                    invalid={accessTried && !ownerConfirm.trim()}
                  />
                </div>
                <div className="sm:col-span-2 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Acessos do funcionário</p>
                    <p className="text-sm text-muted-foreground">
                      Por padrão: caixa, produtos e estoque. Dashboard, despesas e relatórios
                      ficam só com o dono.
                    </p>
                  </div>
                  {grantableModules.map((module) => (
                    <div
                      key={module}
                      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
                    >
                      <p className="text-sm font-medium">{moduleLabel(module)}</p>
                      <Switch
                        checked={setupModules.includes(module)}
                        onCheckedChange={(checked) => toggleSetupModule(module, checked)}
                      />
                    </div>
                  ))}
                </div>
                {usesCashier ? (
                  <>
                    <div className="space-y-2">
                      <Label>Senha do caixa</Label>
                      <Input
                        type="password"
                        value={cashierPassword}
                        onChange={(e) => setCashierPassword(e.target.value)}
                        invalid={accessTried && !cashierPassword.trim()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar caixa</Label>
                      <Input
                        type="password"
                        value={cashierConfirm}
                        onChange={(e) => setCashierConfirm(e.target.value)}
                        invalid={accessTried && !cashierConfirm.trim()}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <Button
                type="button"
                disabled={setupMutation.isPending}
                onClick={() => {
                  setAccessTried(true);
                  if (!ownerPassword.trim() || !ownerConfirm.trim()) return;
                  if (usesCashier && (!cashierPassword.trim() || !cashierConfirm.trim())) return;
                  setupMutation.mutate();
                }}
              >
                <KeyRound className="h-4 w-4" />
                Ativar acesso
              </Button>
            </>
          )}
    </div>
  );
}

function PermissionGroup({
  title,
  items,
  mutedEmpty = false,
}: {
  title: string;
  items: string[];
  mutedEmpty?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm">
            <Check
              className={`h-4 w-4 shrink-0 ${
                mutedEmpty ? 'text-muted-foreground' : 'text-emerald-500'
              }`}
            />
            <span className={mutedEmpty ? 'text-muted-foreground' : undefined}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
