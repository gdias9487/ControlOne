import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import type { UpdaterStatusDto } from '@shared/types';
import { Button } from '@/components/ui/button';
import { unwrapApi } from '@/utils';

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatusDto | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!window.cleideApi?.updater) return;
      try {
        const current = unwrapApi(await window.cleideApi.updater.getStatus());
        if (!cancelled) setStatus(current);
      } catch {
        // silencioso no boot
      }
    }

    void load();
    const unsubscribe = window.cleideApi?.updater?.onStatus((next) => {
      setStatus(next);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  if (!status) return null;

  const showAvailable =
    status.state === 'available' &&
    status.availableVersion &&
    status.availableVersion !== dismissedVersion;
  const showDownloading = status.state === 'downloading';
  const showDownloaded = status.state === 'downloaded';

  if (!showAvailable && !showDownloading && !showDownloaded) return null;

  async function download() {
    setBusy(true);
    try {
      unwrapApi(await window.cleideApi.updater.download());
    } catch {
      // status de erro chega via onStatus
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    setBusy(true);
    try {
      unwrapApi(await window.cleideApi.updater.install());
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
      <div className="min-w-0">
        {showAvailable ? (
          <p>
            Nova versão <span className="font-semibold">{status.availableVersion}</span> disponível
            (você está na {status.currentVersion}).
          </p>
        ) : null}
        {showDownloading ? (
          <p>
            Baixando atualização
            {status.percent != null ? `… ${status.percent}%` : '…'}
          </p>
        ) : null}
        {showDownloaded ? (
          <p>
            Versão <span className="font-semibold">{status.availableVersion}</span> pronta. Reinicie
            para instalar.
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showAvailable ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => void download()}>
              <Download className="h-3.5 w-3.5" />
              Atualizar agora
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Dispensar"
              onClick={() => setDismissedVersion(status.availableVersion)}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : null}
        {showDownloading ? (
          <div className="h-2 w-28 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-900">
            <div
              className="h-full bg-emerald-600 transition-all dark:bg-emerald-400"
              style={{ width: `${Math.max(0, Math.min(100, status.percent ?? 0))}%` }}
            />
          </div>
        ) : null}
        {showDownloaded ? (
          <Button size="sm" disabled={busy} onClick={() => void install()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reiniciar e instalar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
