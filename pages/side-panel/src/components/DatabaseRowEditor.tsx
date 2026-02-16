import { t } from '@extension/i18n';
import { useState, useCallback } from 'react';

interface DatabaseRowEditorProps {
  row: Record<string, unknown> | null; // null = insert mode
  primaryKey: string | string[];
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

const inferFieldType = (value: unknown): 'string' | 'number' | 'boolean' | 'json' => {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'object' && value !== null) return 'json';
  return 'string';
};

export const DatabaseRowEditor = ({ row, primaryKey, onSave, onCancel }: DatabaseRowEditorProps) => {
  const isInsert = row === null;
  const pkFields = Array.isArray(primaryKey) ? primaryKey : [primaryKey];

  const [fields, setFields] = useState<Record<string, string>>(() => {
    if (!row) return {};
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      init[k] = typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v ?? '');
    }
    return init;
  });

  const [fieldTypes, setFieldTypes] = useState<Record<string, 'string' | 'number' | 'boolean' | 'json'>>(() => {
    if (!row) return {};
    const types: Record<string, 'string' | 'number' | 'boolean' | 'json'> = {};
    for (const [k, v] of Object.entries(row)) {
      types[k] = inferFieldType(v);
    }
    return types;
  });

  const [newFieldName, setNewFieldName] = useState('');
  const [error, setError] = useState('');

  const updateField = useCallback((key: string, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  const toggleBoolean = useCallback((key: string) => {
    setFields(prev => ({ ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' }));
  }, []);

  const addField = useCallback(() => {
    const name = newFieldName.trim();
    if (!name || name in fields) return;
    setFields(prev => ({ ...prev, [name]: '' }));
    setFieldTypes(prev => ({ ...prev, [name]: 'string' }));
    setNewFieldName('');
  }, [newFieldName, fields]);

  const removeField = useCallback((key: string) => {
    setFields(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFieldTypes(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    const data: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(fields)) {
      const type = fieldTypes[key] ?? 'string';
      switch (type) {
        case 'number': {
          const n = Number(raw);
          if (raw !== '' && isNaN(n)) {
            setError(t('dbEditorInvalidNumber', key));
            return;
          }
          data[key] = raw === '' ? 0 : n;
          break;
        }
        case 'boolean':
          data[key] = raw === 'true';
          break;
        case 'json':
          try {
            data[key] = JSON.parse(raw);
          } catch {
            setError(t('dbEditorInvalidJson', key));
            return;
          }
          break;
        default:
          data[key] = raw;
      }
    }
    onSave(data);
  }, [fields, fieldTypes, onSave]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-12"
      role="button"
      tabIndex={0}
      onClick={onCancel}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') onCancel();
      }}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-md overflow-y-auto border border-terminal-border bg-background-dark p-5"
        role="presentation"
        onClick={e => e.stopPropagation()}>
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-white">
          {isInsert ? t('dbEditorInsertTitle') : t('dbEditorEditTitle')}
        </h3>

        <div className="space-y-3">
          {Object.entries(fields).map(([key, value]) => {
            const type = fieldTypes[key] ?? 'string';
            const isPk = pkFields.includes(key);

            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                    {key}
                    {isPk && <span className="ml-1 text-primary">PK</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={type}
                      onChange={e =>
                        setFieldTypes(prev => ({
                          ...prev,
                          [key]: e.target.value as 'string' | 'number' | 'boolean' | 'json',
                        }))
                      }
                      className="border border-terminal-border bg-background-dark px-1 py-0.5 font-mono text-[9px] text-slate-500">
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="json">json</option>
                    </select>
                    {!isPk && !isInsert && (
                      <button
                        onClick={() => removeField(key)}
                        className="text-slate-600 transition-colors hover:text-red-400">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {type === 'boolean' ? (
                  <button
                    onClick={() => toggleBoolean(key)}
                    disabled={isPk && !isInsert}
                    className={`font-mono text-[11px] font-bold ${
                      value === 'true' ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                    {value === 'true' ? 'TRUE' : 'FALSE'}
                  </button>
                ) : type === 'json' ? (
                  <textarea
                    value={value}
                    onChange={e => updateField(key, e.target.value)}
                    readOnly={isPk && !isInsert}
                    rows={3}
                    className="minimal-input font-mono text-[11px] !leading-tight"
                  />
                ) : (
                  <input
                    type={type === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={e => updateField(key, e.target.value)}
                    readOnly={isPk && !isInsert}
                    className={`minimal-input font-mono text-[11px] ${isPk && !isInsert ? 'opacity-50' : ''}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Add field */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addField()}
            placeholder={t('dbEditorNewFieldPlaceholder')}
            className="minimal-input flex-1 font-mono text-[11px]"
          />
          <button
            onClick={addField}
            disabled={!newFieldName.trim()}
            className="font-mono text-[10px] uppercase tracking-widest text-primary disabled:opacity-30">
            {t('commonAdd')}
          </button>
        </div>

        {error && <div className="mt-3 text-[10px] font-medium text-red-400">{error}</div>}

        {/* Actions */}
        <div className="mt-5 flex gap-4">
          <button
            onClick={handleSave}
            className="font-mono text-[10px] uppercase tracking-widest text-primary underline-offset-4 transition-all hover:underline">
            {isInsert ? t('commonInsert') : t('commonSave')}
          </button>
          <button
            onClick={onCancel}
            className="font-mono text-[10px] uppercase tracking-widest text-slate-500 underline-offset-4 transition-all hover:text-slate-300 hover:underline">
            {t('commonCancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
