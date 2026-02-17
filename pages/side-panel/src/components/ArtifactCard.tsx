import { CodeBlock } from './CodeBlock';
import { t } from '@extension/i18n';
import { useState } from 'react';
import type { Artifact } from '@extension/shared';

interface WorkerStatus {
  status: string;
  artifactId: string;
  error?: string;
}

interface ArtifactCardProps {
  artifact: Artifact;
  workerStatus?: WorkerStatus;
  onStartWorker?: (artifact: Artifact) => void;
  onStopWorker?: (extensionId: string) => void;
  onViewWorker?: (artifact: Artifact) => void;
}

const TYPE_BADGES: Record<string, { label: string; badgeClass: string }> = {
  'react-component': {
    label: t('artifactTypeReact'),
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  'js-script': {
    label: t('artifactTypeScript'),
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  css: {
    label: t('artifactTypeCss'),
    badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  },
  'background-worker': {
    label: t('artifactTypeWorker'),
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
};

export const ArtifactCard = ({
  artifact,
  workerStatus,
  onStartWorker,
  onStopWorker,
  onViewWorker,
}: ArtifactCardProps) => {
  const [showCode, setShowCode] = useState(false);
  const typeInfo = TYPE_BADGES[artifact.type] ?? {
    label: artifact.type.toUpperCase(),
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  const isWorker = artifact.type === 'background-worker';
  const isRunning = workerStatus?.status === 'running';
  const isTerminated = isWorker && !isRunning && workerStatus?.error;

  // Determine card background tint
  const cardBg = isRunning
    ? 'bg-emerald-500/[0.02] border-y border-emerald-500/10'
    : isTerminated
      ? 'bg-red-500/[0.02] border-y border-red-500/10'
      : 'hover:bg-white/[0.02] border-y border-transparent hover:border-terminal-border';

  return (
    <div
      className={`group cursor-pointer px-4 py-3 transition-colors ${cardBg}`}
      role="button"
      tabIndex={0}
      onClick={() => setShowCode(s => !s)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') setShowCode(s => !s);
      }}>
      {isTerminated ? (
        /* Error / Terminated state */
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`sharp-badge border font-mono text-[9px] ${typeInfo.badgeClass} px-2 py-0.5`}>
                {typeInfo.label}
              </span>
              <span className="text-[12px] font-medium text-slate-200">{artifact.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px] text-red-500">warning</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-red-500">
                {t('artifactStatusTerminated')}
              </span>
            </div>
          </div>

          {/* Error box */}
          {workerStatus?.error && (
            <div className="border-l-2 border-red-500/50 bg-black/60 p-2">
              <p className="font-mono text-[10px] leading-relaxed text-red-400/80">ERR: {workerStatus.error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={e => {
                e.stopPropagation();
                onStartWorker?.(artifact);
              }}
              className="font-mono text-[10px] uppercase tracking-tighter text-emerald-400 underline-offset-4 transition-all hover:text-emerald-300 hover:underline">
              {t('artifactActionRestart')}
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                setShowCode(!showCode);
              }}
              className="font-mono text-[10px] uppercase tracking-tighter text-slate-500 underline-offset-4 transition-all hover:text-slate-300 hover:underline">
              {showCode ? t('artifactActionHide') : t('artifactActionLogs')}
            </button>
          </div>
        </div>
      ) : (
        /* Normal state */
        <div className="flex items-start justify-between">
          <div className="flex w-full flex-col gap-1.5">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`sharp-badge border font-mono text-[9px] ${typeInfo.badgeClass} px-2 py-0.5`}>
                  {typeInfo.label}
                </span>
                <span className="text-[12px] font-medium text-slate-200">{artifact.name}</span>
              </div>

              {/* Status indicator for workers */}
              {isWorker && isRunning && (
                <div className="flex items-center gap-1.5">
                  <div className="pulse-dot h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-500">
                    {t('artifactStatusRunning')}
                  </span>
                </div>
              )}
            </div>

            {/* XPath target */}
            {artifact.elementXPath && (
              <p className="font-mono text-[10px] text-slate-500">XPath: {artifact.elementXPath}</p>
            )}

            {/* Dependencies */}
            {artifact.dependencies && Object.keys(artifact.dependencies).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(artifact.dependencies).map(([pkg, version]) => (
                  <span
                    key={pkg}
                    className="sharp-badge border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[9px] text-violet-400">
                    {pkg}@{version}
                  </span>
                ))}
              </div>
            )}

            {/* Actions (workers only) */}
            {isWorker && (
              <div className="mt-1 flex items-center justify-between">
                <>
                  <div className="flex items-center gap-3">
                    {isRunning ? (
                      <>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onStartWorker?.(artifact);
                          }}
                          className="font-mono text-[10px] uppercase tracking-tighter text-slate-500 underline-offset-4 transition-all hover:text-primary hover:underline">
                          {t('commonReload')}
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onStopWorker?.(artifact.extensionId);
                          }}
                          className="font-mono text-[10px] uppercase tracking-tighter text-red-500/70 underline-offset-4 transition-all hover:text-red-400 hover:underline">
                          {t('commonStop')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onStartWorker?.(artifact);
                        }}
                        className="font-mono text-[10px] uppercase tracking-tighter text-emerald-400 underline-offset-4 transition-all hover:text-emerald-300 hover:underline">
                        {t('commonStart')}
                      </button>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onViewWorker?.(artifact);
                      }}
                      className="font-mono text-[10px] uppercase tracking-tighter text-slate-500 underline-offset-4 transition-all hover:text-primary hover:underline">
                      {t('commonView')}
                    </button>
                  </div>
                  {isRunning && (
                    <span className="font-mono text-[9px] text-slate-600">
                      PID: {workerStatus?.artifactId?.slice(-4) ?? '----'}
                    </span>
                  )}
                </>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code preview */}
      {showCode && (
        <CodeBlock
          code={artifact.code}
          language={artifact.type === 'react-component' ? 'jsx' : artifact.type === 'css' ? 'css' : 'javascript'}
          className="mt-2"
          maxHeight="12rem"
        />
      )}
    </div>
  );
};

export type { WorkerStatus };
