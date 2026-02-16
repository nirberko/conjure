import { CodeBlock } from './CodeBlock';
import { t } from '@extension/i18n';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { WorkerStatus } from './ArtifactCard';
import type { Artifact, WorkerLog } from '@extension/shared';

interface WorkerDetailProps {
  artifact: Artifact;
  workerStatus?: WorkerStatus;
  onBack: () => void;
  onStartWorker: (artifact: Artifact) => void;
  onStopWorker: (extensionId: string) => void;
}

type Tab = 'logs' | 'code' | 'versions';
type LogLevel = 'all' | 'log' | 'error';

const formatTimestamp = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatUptime = (startedAt: number): string => {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const formatLogArgs = (args: unknown[]): string =>
  args
    .map(a => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');

export const WorkerDetail = ({ artifact, workerStatus, onBack, onStartWorker, onStopWorker }: WorkerDetailProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('logs');
  const [logs, setLogs] = useState<WorkerLog[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedVersionIdx, setSelectedVersionIdx] = useState<number | null>(null);
  const [startTime] = useState(Date.now);
  const [uptime, setUptime] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const isRunning = workerStatus?.status === 'running';
  const isError = !!workerStatus?.error;

  // Fetch logs via polling
  const fetchLogs = useCallback(async () => {
    const resp = await chrome.runtime.sendMessage({
      type: 'GET_WORKER_LOGS',
      payload: { extensionId: artifact.extensionId },
    });
    if (resp?.logs) {
      setLogs(resp.logs);
    }
  }, [artifact.extensionId]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Update uptime
  useEffect(() => {
    if (!isRunning) {
      setUptime('--');
      return;
    }
    const update = () => setUptime(formatUptime(startTime));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Detect manual scroll
  const handleLogScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(nearBottom);
  };

  const handleClearLogs = async () => {
    await chrome.runtime.sendMessage({
      type: 'CLEAR_WORKER_LOGS',
      payload: { extensionId: artifact.extensionId },
    });
    setLogs([]);
  };

  const handleReload = () => onStartWorker(artifact);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (searchFilter) {
      const text = formatLogArgs(log.args).toLowerCase();
      if (!text.includes(searchFilter.toLowerCase())) return false;
    }
    return true;
  });

  const statusLabel = isRunning
    ? t('workerStatusRunning')
    : isError
      ? t('workerStatusError')
      : t('workerStatusStopped');
  const statusColor = isRunning ? 'text-emerald-500' : isError ? 'text-red-500' : 'text-slate-500';
  const statusDot = isRunning ? 'bg-emerald-500 animate-pulse' : isError ? 'bg-red-500' : 'bg-slate-600';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'logs', label: t('workerTabLogs') },
    { id: 'code', label: t('workerTabCode') },
    { id: 'versions', label: t('workerTabVersions') },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-terminal-border bg-black/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-slate-500 transition-colors hover:text-primary">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="sharp-badge border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-400">
                {t('workerBadge')}
              </span>
              <span className="text-[12px] font-medium text-slate-200">{artifact.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className={`font-mono text-[9px] uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="mt-2 flex items-center gap-4 font-mono text-[9px] text-slate-600">
          <span>{t('workerPidLabel', artifact.id.slice(-4))}</span>
          <span>{t('workerUptimeLabel', uptime)}</span>
          <span>{t('workerExtLabel', artifact.extensionId.slice(0, 8))}</span>
        </div>

        {/* Controls */}
        <div className="mt-2 flex items-center gap-3">
          {isRunning ? (
            <>
              <button
                onClick={handleReload}
                className="font-mono text-[10px] uppercase tracking-tighter text-slate-500 underline-offset-4 transition-all hover:text-primary hover:underline">
                {t('commonReload')}
              </button>
              <button
                onClick={() => onStopWorker(artifact.extensionId)}
                className="font-mono text-[10px] uppercase tracking-tighter text-red-500/70 underline-offset-4 transition-all hover:text-red-400 hover:underline">
                {t('commonStop')}
              </button>
            </>
          ) : (
            <button
              onClick={() => onStartWorker(artifact)}
              className="font-mono text-[10px] uppercase tracking-tighter text-emerald-400 underline-offset-4 transition-all hover:text-emerald-300 hover:underline">
              {t('commonStart')}
            </button>
          )}
        </div>

        {/* Error display */}
        {isError && workerStatus?.error && (
          <div className="mt-2 border-l-2 border-red-500/50 bg-black/60 p-2">
            <p className="font-mono text-[10px] leading-relaxed text-red-400/80">ERR: {workerStatus.error}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <nav className="flex border-b border-terminal-border bg-black/20 px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'border-b border-primary text-primary'
                : 'border-b border-transparent text-slate-600 hover:text-slate-400'
            }`}>
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-0 h-[1px] w-full bg-primary blur-[2px]" />}
            {tab.id === 'logs' && logs.length > 0 && activeTab !== 'logs' && (
              <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-primary/60" />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'logs' && (
          <div className="flex h-full flex-col">
            {/* Log toolbar */}
            <div className="flex items-center gap-2 border-b border-terminal-border bg-black/30 px-3 py-1.5">
              <select
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value as LogLevel)}
                className="rounded border border-terminal-border bg-black/40 px-2 py-0.5 font-mono text-[10px] text-slate-400 outline-none">
                <option value="all">{t('workerLogFilterAll')}</option>
                <option value="log">{t('workerLogFilterLog')}</option>
                <option value="error">{t('workerLogFilterError')}</option>
              </select>
              <div className="flex flex-1 items-center gap-1 border border-terminal-border bg-black/40 px-2 py-0.5">
                <span className="material-symbols-outlined text-[12px] text-slate-600">search</span>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder={t('workerLogSearchPlaceholder')}
                  className="w-full bg-transparent font-mono text-[10px] text-slate-400 placeholder-slate-700 outline-none"
                />
              </div>
              <button
                onClick={handleClearLogs}
                className="font-mono text-[9px] uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-400">
                {t('commonClear')}
              </button>
            </div>

            {/* Log entries */}
            <div
              ref={logContainerRef}
              onScroll={handleLogScroll}
              className="flex-1 overflow-y-auto bg-black/20 p-2 font-mono text-[10px]">
              {filteredLogs.length === 0 ? (
                <div className="py-8 text-center text-[10px] uppercase tracking-widest text-slate-700">
                  {logs.length === 0 ? t('workerLogEmpty') : t('workerLogNoMatch')}
                </div>
              ) : (
                filteredLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 py-0.5 leading-relaxed hover:bg-white/[0.02]">
                    <span className="shrink-0 text-slate-700">{formatTimestamp(log.timestamp)}</span>
                    <span
                      className={`shrink-0 font-bold uppercase ${
                        log.level === 'error' ? 'text-red-500' : 'text-slate-600'
                      }`}>
                      {log.level === 'error' ? 'ERR' : 'LOG'}
                    </span>
                    <span className={log.level === 'error' ? 'text-red-400/80' : 'text-slate-400'}>
                      {formatLogArgs(log.args)}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>

            {/* Log footer */}
            <div className="border-t border-terminal-border bg-black/40 px-3 py-1">
              <span className="font-mono text-[9px] text-slate-700">
                {t('workerLogEntryCount', [String(filteredLogs.length), String(logs.length)])}
              </span>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="h-full overflow-y-auto">
            <CodeBlock code={artifact.code} language="javascript" maxHeight="100%" className="h-full" />
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="flex h-full flex-col">
            {artifact.codeVersions.length === 0 ? (
              <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-700">
                {t('workerVersionsEmpty')}
              </div>
            ) : (
              <>
                {/* Version list */}
                <div
                  className="overflow-y-auto border-b border-terminal-border"
                  style={{ maxHeight: selectedVersionIdx !== null ? '30%' : '100%' }}>
                  {[...artifact.codeVersions].reverse().map((version, i) => {
                    const actualIdx = artifact.codeVersions.length - 1 - i;
                    const isSelected = selectedVersionIdx === actualIdx;
                    const isCurrent = actualIdx === artifact.codeVersions.length - 1;
                    return (
                      <button
                        key={actualIdx}
                        onClick={() => setSelectedVersionIdx(isSelected ? null : actualIdx)}
                        className={`flex w-full items-center justify-between px-4 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-l-2 border-primary/20 bg-primary/5'
                            : 'border-l-2 border-transparent hover:bg-white/[0.02]'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">v{actualIdx + 1}</span>
                          {isCurrent && (
                            <span className="sharp-badge border border-primary/30 bg-primary/10 px-1.5 py-0 font-mono text-[8px] text-primary">
                              {t('workerVersionCurrent')}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[9px] text-slate-600">
                          {new Date(version.timestamp).toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Version code preview */}
                {selectedVersionIdx !== null && (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <CodeBlock
                      code={artifact.codeVersions[selectedVersionIdx].code}
                      language="javascript"
                      maxHeight="100%"
                      className="h-full"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
