import { t } from '@extension/i18n';
import { useState, useCallback } from 'react';

interface DatabaseTableViewProps {
  rows: Record<string, unknown>[];
  primaryKey: string | string[];
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (key: unknown) => void;
}

const getRowKey = (row: Record<string, unknown>, primaryKey: string | string[]): unknown => {
  if (Array.isArray(primaryKey)) {
    return primaryKey.map(k => row[k]);
  }
  return row[primaryKey];
};

const isTimestampField = (key: string, value: unknown): boolean => {
  if (typeof value !== 'number' || value < 1e12) return false;
  return /(?:At|timestamp|createdAt|updatedAt)$/i.test(key);
};

const formatTimestamp = (value: number): string =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

const ValueDisplay = ({ fieldKey, value }: { fieldKey: string; value: unknown }) => {
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return <span className="italic text-slate-700">null</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span className={`font-mono text-[10px] font-bold ${value ? 'text-emerald-400' : 'text-slate-500'}`}>
        {value ? 'TRUE' : 'FALSE'}
      </span>
    );
  }

  if (typeof value === 'number') {
    if (isTimestampField(fieldKey, value)) {
      return <span className="font-mono text-slate-400">{formatTimestamp(value)}</span>;
    }
    return <span className="font-mono text-slate-300">{value}</span>;
  }

  if (typeof value === 'string') {
    const display = value.length > 120 ? value.slice(0, 120) + '...' : value;
    return <span className="break-all text-slate-300">{display}</span>;
  }

  if (Array.isArray(value)) {
    if (!expanded) {
      return (
        <button
          onClick={() => setExpanded(true)}
          className="font-mono text-slate-500 transition-colors hover:text-slate-300">
          [{value.length} items]
        </button>
      );
    }
    return (
      <div>
        <button
          onClick={() => setExpanded(false)}
          className="mb-1 font-mono text-slate-500 transition-colors hover:text-slate-300">
          [{value.length} items] ▾
        </button>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-400">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  if (typeof value === 'object') {
    if (!expanded) {
      return (
        <button
          onClick={() => setExpanded(true)}
          className="font-mono text-slate-500 transition-colors hover:text-slate-300">
          {'{...}'}
        </button>
      );
    }
    return (
      <div>
        <button
          onClick={() => setExpanded(false)}
          className="mb-1 font-mono text-slate-500 transition-colors hover:text-slate-300">
          {'{...}'} ▾
        </button>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-slate-400">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  return <span className="text-slate-400">{String(value)}</span>;
};

export const DatabaseTableView = ({ rows, primaryKey, onEdit, onDelete }: DatabaseTableViewProps) => {
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const handleDelete = useCallback(
    (key: unknown) => {
      const keyStr = JSON.stringify(key);
      if (confirmDeleteKey === keyStr) {
        onDelete(key);
        setConfirmDeleteKey(null);
      } else {
        setConfirmDeleteKey(keyStr);
      }
    },
    [confirmDeleteKey, onDelete],
  );

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
        {t('dbTableEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const key = getRowKey(row, primaryKey);
        const keyStr = JSON.stringify(key);

        return (
          <div key={keyStr ?? idx} className="group border border-terminal-border p-3">
            <div className="space-y-1.5">
              {Object.entries(row).map(([fieldKey, value]) => (
                <div key={fieldKey} className="flex gap-2 text-[11px]">
                  <span className="min-w-0 shrink-0 font-mono text-[9px] uppercase tracking-wider text-slate-600">
                    {fieldKey}
                  </span>
                  <div className="min-w-0 flex-1">
                    <ValueDisplay fieldKey={fieldKey} value={value} />
                  </div>
                </div>
              ))}
            </div>

            {/* Card actions */}
            <div className="mt-3 flex gap-3 border-t border-slate-800/50 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => onEdit(row)}
                className="font-mono text-[9px] uppercase tracking-widest text-primary transition-colors hover:text-white">
                {t('commonEdit')}
              </button>
              {confirmDeleteKey === keyStr ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-red-400">
                    {t('dbTableConfirmDelete')}
                  </span>
                  <button
                    onClick={() => handleDelete(key)}
                    className="font-mono text-[9px] uppercase tracking-widest text-red-400 transition-colors hover:text-red-300">
                    {t('commonYes')}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteKey(null)}
                    className="font-mono text-[9px] uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300">
                    {t('commonNo')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDelete(key)}
                  className="font-mono text-[9px] uppercase tracking-widest text-slate-500 transition-colors hover:text-red-400">
                  {t('commonDelete')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
