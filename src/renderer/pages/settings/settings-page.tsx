import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  HardDriveDownload,
  HardDriveUpload,
  ImagePlus,
  KeyRound,
  Moon,
  Palette,
  RefreshCw,
  ShieldCheck,
  Store,
  Sun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UpdaterStatusDto } from '@shared/types';
import { Header } from '@/layouts/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useTheme } from '@/contexts/theme-context';
import { toast } from '@/hooks/use-toast';
import { unwrapApi } from '@/utils';
import { useAccessStatus } from '@/hooks/use-access';

const SECTIONS = [
  {
    id: 'negocio',
    title: 'Perfil do estabelecimento',
    description: 'Nome, logo, contato e estoque mínimo',
    icon: Store,
  },
  {
    id: 'acesso',
    title: 'Controle de acesso',
    description: 'Senha do dono e do caixa',
    icon: KeyRound,
  },
  {
    id: 'aparencia',
    title: 'Aparência',
    description: 'Tema claro ou escuro',
    icon: Palette,
  },
  {
    id: 'atualizacoes',
    title: 'Atualizações',
    description: 'Versão do app e novas releases',
    icon: RefreshCw,
  },
  {
    id: 'licenca',
    title: 'Licença',
    description: 'ID da máquina e chave de ativação',
    icon: ShieldCheck,
  },
  {
    id: 'backup',
    title: 'Backup',
    description: 'Cópia e restauração dos dados',
    icon: HardDriveDownload,
  },
] as const;

type SettingsSectionId = (typeof SECTIONS)[number]['id'];

function isSettingsSection(value: string | undefined): value is SettingsSectionId {
  return SECTIONS.some((section) => section.id === value);
}

export function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  if (section && !isSettingsSection(section)) {
    return <Navigate to="/configuracoes" replace />;
  }
  const current = isSettingsSection(section) ? section : null;

  if (!current) {
    return <SettingsHub />;
  }

  const meta = SECTIONS.find((item) => item.id === current);
  return (
    <div className="page-enter flex min-h-full flex-col">
      <SettingsSectionHeader title={meta?.title ?? 'Configurações'} subtitle={meta?.description} />
      <div className="p-6">
        {current === 'negocio' ? <BusinessSettings /> : null}
        {current === 'acesso' ? <AccessSettingsCard /> : null}
        {current === 'aparencia' ? <AppearanceSettings /> : null}
        {current === 'atualizacoes' ? <UpdatesSettings /> : null}
        {current === 'licenca' ? <LicenseSettings /> : null}
        {current === 'backup' ? <BackupSettings /> : null}
      </div>
    </div>
  );
}

function SettingsHub() {
  const navigate = useNavigate();
  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Configurações" subtitle="Escolha uma opção para abrir" />
      <div className="mx-auto w-full max-w-2xl space-y-2 p-6">
        {SECTIONS.map((item) => (
          <SettingsOptionRow
            key={item.id}
            icon={item.icon}
            title={item.title}
            description={item.description}
            onClick={() => navigate(`/configuracoes/${item.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function SettingsSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  return (
    <Header
      title={title}
      subtitle={subtitle}
      actions={
        <Button type="button" variant="outline" onClick={() => navigate('/configuracoes')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      }
    />
  );
}

function SettingsOptionRow({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border bg-card px-4 py-4 text-left shadow-soft transition-colors hover:bg-muted/60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function BusinessSettings() {
  const { settings, refreshSettings } = useTheme();
  const [form, setForm] = useState({
    storeName: '',
    businessType: '',
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Perfil do estabelecimento</CardTitle>
        <CardDescription>Essas informações aparecem no sistema e nos cupons.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
          <Label>Tipo de comércio</Label>
          <Input
            value={form.businessType}
            onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
            placeholder="Ex.: Joias, roupas, cosméticos..."
          />
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
        <div className="space-y-2">
          <Label>Estoque mínimo padrão</Label>
          <Input
            type="number"
            value={form.defaultMinStock}
            onChange={(e) => setForm((f) => ({ ...f, defaultMinStock: Number(e.target.value) }))}
          />
        </div>
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
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Aparência</CardTitle>
        <CardDescription>Alternar entre tema claro e escuro.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          Tema {theme === 'dark' ? 'escuro' : 'claro'}
        </div>
        <Switch
          checked={theme === 'dark'}
          onCheckedChange={(checked) => void setTheme(checked ? 'dark' : 'light')}
        />
      </CardContent>
    </Card>
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Atualizações</CardTitle>
        <CardDescription>
          O app verifica novas versões no GitHub ao abrir. Use o Setup instalado para atualizar
          pelo próprio ControlOne.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Licença</CardTitle>
        <CardDescription>
          Controle de ativação por máquina. Em desenvolvimento a licença fica liberada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
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
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Backup e restauração</CardTitle>
          <CardDescription>Os backups são salvos com data e hora no nome do arquivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pasta atual: {settings?.backupFolder ?? 'Padrão do sistema'}
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
        </CardContent>
      </Card>
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
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerConfirm, setOwnerConfirm] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [cashierConfirm, setCashierConfirm] = useState('');
  const [currentOwnerPassword, setCurrentOwnerPassword] = useState('');
  const [action, setAction] = useState<'owner' | 'cashier' | 'disable' | null>(null);
  const [accessTried, setAccessTried] = useState(false);

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
      if (cashierPassword !== cashierConfirm) throw new Error('As senhas do caixa não coincidem.');
      return unwrapApi(await window.cleideApi.access.setup({ ownerPassword, cashierPassword }));
    },
    onSuccess: async () => {
      resetFields();
      await queryClient.invalidateQueries({ queryKey: ['access-status'] });
      toast({ title: 'Controle de acesso ativado' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!currentOwnerPassword.trim()) {
        throw new Error('Informe a senha atual do dono.');
      }
      if (action === 'owner') {
        if (!ownerPassword.trim()) throw new Error('Informe a nova senha do dono.');
        if (ownerPassword !== ownerConfirm) throw new Error('As senhas do dono não coincidem.');
      }
      if (action === 'cashier') {
        if (!cashierPassword.trim()) throw new Error('Informe a nova senha do caixa.');
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

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!currentOwnerPassword.trim()) {
        throw new Error('Informe a senha atual do dono.');
      }
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

  return (
    <>
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Controle de acesso</CardTitle>
          <CardDescription>
            {access.data?.enabled
              ? 'O app pede senha ao abrir. O caixa só vê a frente de caixa.'
              : 'Opcional. Enquanto estiver desligado, qualquer pessoa no PC entra como dono.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {access.data?.enabled ? (
            <>
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                Controle de acesso <span className="font-semibold">ativado</span>. O app pede senha
                ao abrir e o caixa só vê a frente de caixa.
              </p>
              {action == null ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setAction('owner')}>
                    Alterar senha do dono
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setAction('cashier')}>
                    Alterar senha do caixa
                  </Button>
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
              </div>
              <Button
                type="button"
                disabled={setupMutation.isPending}
                onClick={() => {
                  setAccessTried(true);
                  if (
                    !ownerPassword.trim() ||
                    !ownerConfirm.trim() ||
                    !cashierPassword.trim() ||
                    !cashierConfirm.trim()
                  ) {
                    return;
                  }
                  setupMutation.mutate();
                }}
              >
                <KeyRound className="h-4 w-4" />
                Ativar acesso
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
