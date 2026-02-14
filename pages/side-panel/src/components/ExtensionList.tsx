import { useState, useEffect, useCallback } from 'react';
import type { Extension } from '@extension/shared';

interface ExtensionListProps {
  extensions: Extension[];
  loading: boolean;
  onSelect: (extension: Extension) => void;
  onCreate: (data: { name: string; urlPattern: string; description?: string }) => Promise<Extension>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

// Fetch artifact types for an extension to show as tags
function useExtensionTags(extensions: Extension[]) {
  const [tags, setTags] = useState<Record<string, string[]>>({});

  const refresh = useCallback(async () => {
    const result: Record<string, string[]> = {};
    for (const ext of extensions) {
      try {
        const resp = await chrome.runtime.sendMessage({
          type: 'GET_EXTENSION_ARTIFACTS',
          payload: { extensionId: ext.id },
        });
        const artifacts = resp?.artifacts ?? [];
        const types = [...new Set(artifacts.map((a: { type: string }) => a.type))] as string[];
        result[ext.id] = types;
      } catch {
        result[ext.id] = [];
      }
    }
    setTags(result);
  }, [extensions]);

  useEffect(() => {
    if (extensions.length > 0) refresh();
  }, [extensions, refresh]);

  return tags;
}

const TAG_COLORS: Record<string, string> = {
  'react-component': 'text-primary/80',
  'js-script': 'text-amber-500/80',
  css: 'text-slate-600',
  'background-worker': 'text-emerald-500/80',
};

const TAG_LABELS: Record<string, string> = {
  'react-component': 'React',
  'js-script': 'JS',
  css: 'CSS',
  'background-worker': 'Worker',
};

export function ExtensionList({ extensions, loading, onSelect, onCreate, onToggle, onDelete }: ExtensionListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const tags = useExtensionTags(extensions);

  const handleCreate = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const ext = await onCreate({
      name: newName.trim(),
      urlPattern: newUrl.trim(),
      description: newDesc.trim() || undefined,
    });
    setNewName('');
    setNewUrl('');
    setNewDesc('');
    setShowCreate(false);
    onSelect(ext);
  };

  if (loading) {
    return (
      <div className="p-4 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
        Loading extensions...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* New Extension button */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="hover:text-primary group flex w-full items-center justify-center py-3 transition-colors">
          <span className="material-symbols-outlined group-hover:text-primary text-[24px] text-slate-600 transition-transform group-hover:rotate-90">
            add
          </span>
          <span className="group-hover:text-primary ml-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            New Extension
          </span>
        </button>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="border-terminal-border space-y-4 border p-4">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Extension name..."
            className="minimal-input"
            autoFocus
          />
          <input
            type="text"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="URL pattern (e.g. https://*.github.com/*)"
            className="minimal-input"
          />
          <input
            type="text"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="minimal-input"
          />
          <div className="flex gap-4">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newUrl.trim()}
              className="text-primary font-mono text-[10px] uppercase tracking-widest underline-offset-4 transition-all hover:underline disabled:no-underline disabled:opacity-30">
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="font-mono text-[10px] uppercase tracking-widest text-slate-500 underline-offset-4 transition-all hover:text-slate-300 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Extension cards */}
      {extensions.length === 0 && !showCreate && (
        <div className="py-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
          No extensions yet. Create one to get started.
        </div>
      )}

      <div className="space-y-3">
        {extensions.map(ext => (
          <div
            key={ext.id}
            className="border-terminal-border group cursor-pointer border p-4 transition-colors hover:border-slate-700"
            onClick={() => onSelect(ext)}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[13px] font-semibold tracking-tight text-white">{ext.name}</h3>
                <code className="mt-1 block truncate font-mono text-[9px] tracking-tighter text-slate-600">
                  {ext.urlPattern}
                </code>
              </div>
              {/* Toggle */}
              <label
                className="relative mt-1 inline-flex cursor-pointer items-center"
                onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={ext.enabled}
                  onChange={() => onToggle(ext.id)}
                  className="peer sr-only"
                />
                <div className="toggle-bg h-1 w-6 rounded-full bg-slate-800" />
                <div className="toggle-dot absolute left-0 h-2 w-2 rounded-full bg-slate-600" />
              </label>
            </div>
            {/* Bottom row: tags + hover actions */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-3">
                {(tags[ext.id] ?? []).map(type => (
                  <span
                    key={type}
                    className={`text-[9px] font-bold uppercase tracking-widest ${TAG_COLORS[type] ?? 'text-slate-600'}`}>
                    {TAG_LABELS[type] ?? type}
                  </span>
                ))}
              </div>
              <div
                className="flex gap-3 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onSelect(ext)}
                  className="text-slate-600 transition-colors hover:text-white"
                  title="Edit">
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                </button>
                <button
                  onClick={() => onDelete(ext.id)}
                  className="text-slate-600 transition-colors hover:text-red-400"
                  title="Delete">
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
