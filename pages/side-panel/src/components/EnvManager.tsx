import { t } from '@extension/i18n';
import { useState, useEffect, useCallback } from 'react';

interface EnvManagerProps {
  extensionId: string;
}

export const EnvManager = ({ extensionId }: EnvManagerProps) => {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  const loadEnvVars = useCallback(async () => {
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: 'EXT_DB_STORAGE_GET',
        payload: { extensionId, key: '_env' },
      })) as { data?: Record<string, string> };
      setEnvVars(resp.data ?? {});
    } catch {
      setEnvVars({});
    } finally {
      setLoading(false);
    }
  }, [extensionId]);

  useEffect(() => {
    loadEnvVars();
  }, [loadEnvVars]);

  const saveEnvVars = useCallback(
    async (updated: Record<string, string>) => {
      await chrome.runtime.sendMessage({
        type: 'EXT_DB_STORAGE_SET',
        payload: { extensionId, key: '_env', data: updated },
      });
      setEnvVars(updated);
    },
    [extensionId],
  );

  const handleAdd = useCallback(async () => {
    const key = newKey.trim();
    if (!key) return;
    const updated = { ...envVars, [key]: newValue };
    await saveEnvVars(updated);
    setNewKey('');
    setNewValue('');
    setAdding(false);
  }, [envVars, newKey, newValue, saveEnvVars]);

  const handleDelete = useCallback(
    async (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _, ...rest } = envVars;
      await saveEnvVars(rest);
      setRevealed(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [envVars, saveEnvVars],
  );

  const handleEditStart = useCallback(
    (key: string) => {
      setEditingKey(key);
      setEditValue(envVars[key] ?? '');
    },
    [envVars],
  );

  const handleEditSave = useCallback(async () => {
    if (!editingKey) return;
    const updated = { ...envVars, [editingKey]: editValue };
    await saveEnvVars(updated);
    setEditingKey(null);
    setEditValue('');
  }, [editingKey, editValue, envVars, saveEnvVars]);

  const toggleReveal = useCallback((key: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const entries = Object.entries(envVars);

  if (loading) {
    return (
      <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
        {t('envLoading')}
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-600">{t('envTitle')}</span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-primary font-mono text-[10px] uppercase tracking-widest transition-colors hover:text-white">
            {t('envAddButton')}
          </button>
        )}
      </div>

      {adding && (
        <div className="border-terminal-border space-y-2 border bg-black/20 p-3">
          <input
            value={newKey}
            onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            placeholder={t('envKeyPlaceholder')}
            className="bg-background-dark border-terminal-border w-full border px-3 py-1.5 font-mono text-[11px] text-slate-300 placeholder-slate-700"
          />
          <input
            type="password"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder={t('envValuePlaceholder')}
            className="bg-background-dark border-terminal-border w-full border px-3 py-1.5 font-mono text-[11px] text-slate-300 placeholder-slate-700"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newKey.trim()}
              className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40">
              {t('commonSave')}
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewKey('');
                setNewValue('');
              }}
              className="border-terminal-border border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300">
              {t('commonCancel')}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding ? (
        <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
          {t('envEmpty')}
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="border-terminal-border flex items-center gap-2 border bg-black/20 px-3 py-2">
              <span className="min-w-0 flex-shrink-0 font-mono text-[11px] font-medium text-slate-300">{key}</span>
              <span className="text-slate-700">=</span>

              {editingKey === key ? (
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleEditSave();
                      if (e.key === 'Escape') setEditingKey(null);
                    }}
                    className="bg-background-dark border-terminal-border min-w-0 flex-1 border px-2 py-0.5 font-mono text-[11px] text-slate-300"
                  />
                  <button
                    onClick={handleEditSave}
                    className="text-primary text-[14px] transition-colors hover:text-white">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </button>
                  <button
                    onClick={() => setEditingKey(null)}
                    className="text-[14px] text-slate-600 transition-colors hover:text-slate-300">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500">
                    {revealed.has(key) ? value : '*'.repeat(Math.min(value.length, 24))}
                  </span>
                  <button
                    onClick={() => toggleReveal(key)}
                    className="flex-shrink-0 text-slate-600 transition-colors hover:text-slate-300"
                    title={revealed.has(key) ? 'Hide' : 'Reveal'}>
                    <span className="material-symbols-outlined text-[14px]">
                      {revealed.has(key) ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <button
                    onClick={() => handleEditStart(key)}
                    className="flex-shrink-0 text-slate-600 transition-colors hover:text-slate-300"
                    title={t('commonEdit')}>
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(key)}
                    className="flex-shrink-0 text-slate-600 transition-colors hover:text-red-400"
                    title={t('commonDelete')}>
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
