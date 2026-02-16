import { ArtifactCard } from './ArtifactCard';
import { WorkerDetail } from './WorkerDetail';
import { t } from '@extension/i18n';
import { useState, useEffect, useCallback } from 'react';
import type { WorkerStatus } from './ArtifactCard';
import type { Artifact } from '@extension/shared';

interface ArtifactListProps {
  extensionId: string;
}

export const ArtifactList = ({ extensionId }: ArtifactListProps) => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [workerStatuses, setWorkerStatuses] = useState<Record<string, WorkerStatus>>({});
  const [loading, setLoading] = useState(true);
  const [activeWorkerArtifact, setActiveWorkerArtifact] = useState<Artifact | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [artifactsResp, statusResp] = await Promise.all([
      chrome.runtime.sendMessage({
        type: 'GET_EXTENSION_ARTIFACTS',
        payload: { extensionId },
      }),
      chrome.runtime.sendMessage({ type: 'GET_ALL_WORKER_STATUSES' }),
    ]);
    setArtifacts(artifactsResp?.artifacts ?? []);
    setWorkerStatuses(statusResp?.statuses ?? {});
    setLoading(false);
  }, [extensionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStartWorker = async (artifact: Artifact) => {
    await chrome.runtime.sendMessage({
      type: 'START_BACKGROUND_WORKER',
      payload: { artifactId: artifact.id },
    });
    setTimeout(refresh, 500);
  };

  const handleStopWorker = async (extId: string) => {
    await chrome.runtime.sendMessage({
      type: 'STOP_BACKGROUND_WORKER',
      payload: { extensionId: extId },
    });
    setTimeout(refresh, 500);
  };

  if (activeWorkerArtifact) {
    return (
      <WorkerDetail
        artifact={activeWorkerArtifact}
        workerStatus={workerStatuses[activeWorkerArtifact.extensionId]}
        onBack={() => setActiveWorkerArtifact(null)}
        onStartWorker={async art => {
          await handleStartWorker(art);
        }}
        onStopWorker={async extId => {
          await handleStopWorker(extId);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
        {t('artifactListLoading')}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto py-2">
        {/* Section header */}
        <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-600">
          {t('artifactListHeader')}
        </div>

        {artifacts.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
            {t('artifactListEmpty')}
          </div>
        ) : (
          <div className="space-y-px">
            {artifacts.map(artifact => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                workerStatus={workerStatuses[artifact.extensionId]}
                onStartWorker={handleStartWorker}
                onStopWorker={handleStopWorker}
                onViewWorker={artifact.type === 'background-worker' ? setActiveWorkerArtifact : undefined}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-terminal-border bg-black/40 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                {t('artifactListNodeActive')}
              </span>
            </div>
            <span className="font-mono text-[9px] text-slate-700">v4.0.1-RC</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
