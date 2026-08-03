import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  FolderOpen,
  HardDriveDownload,
  HardDriveUpload,
  ImagePlus,
  KeyRound,
  Moon,
  Sun,
} from 'lucide-react';
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

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { theme, settings, setTheme, refreshSettings } = useTheme();
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
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  const licenseQuery = useQuery({
    queryKey: ['license-status'],
    queryFn: async () => unwrapApi(await window.cleideApi.license.status()),
  });

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
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Configurações" subtitle="Negócio, tema, logo e backups" />
      <div className="grid gap-4 p-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do negócio</CardTitle>
            <CardDescription>Essas informações aparecem no sistema e nos relatórios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-xl bg-muted">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : null}
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultMinStock: Number(e.target.value) }))
                }
              />
            </div>
            <Button onClick={() => saveMutation.mutate()}>Salvar alterações</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
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

          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Backup e restauração</CardTitle>
              <CardDescription>
                Os backups são salvos com data e hora no nome do arquivo.
              </CardDescription>
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
    </div>
  );
}
