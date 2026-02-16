import { DatabaseRowEditor } from './DatabaseRowEditor';
import { DatabaseTableView } from './DatabaseTableView';
import { useDatabaseBrowser } from '../hooks/useDatabaseBrowser';
import { t } from '@extension/i18n';
import { useState, useCallback } from 'react';

interface DatabaseBrowserProps {
  extensionId: string;
}

export const DatabaseBrowser = ({ extensionId }: DatabaseBrowserProps) => {
  const {
    tables,
    selectedTable,
    rows,
    totalCount,
    page,
    totalPages,
    loadingTables,
    loadingRows,
    selectTable,
    setPage,
    putRow,
    deleteRow,
    refresh,
  } = useDatabaseBrowser(extensionId);

  const [editorRow, setEditorRow] = useState<Record<string, unknown> | null | undefined>(undefined);
  // undefined = closed, null = insert mode, object = edit mode

  const currentTableInfo = tables.find(t => t.name === selectedTable);
  const primaryKey = currentTableInfo?.primaryKey ?? 'id';

  const handleEdit = useCallback((row: Record<string, unknown>) => {
    setEditorRow(row);
  }, []);

  const handleInsert = useCallback(() => {
    setEditorRow(null);
  }, []);

  const handleSave = useCallback(
    async (data: Record<string, unknown>) => {
      if (!selectedTable) return;
      await putRow(selectedTable, data);
      setEditorRow(undefined);
    },
    [selectedTable, putRow],
  );

  const handleDelete = useCallback(
    async (key: unknown) => {
      if (!selectedTable) return;
      await deleteRow(selectedTable, key);
    },
    [selectedTable, deleteRow],
  );

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4">
      {/* Table Selector */}
      {loadingTables ? (
        <div className="py-4 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
          {t('dbLoadingTables')}
        </div>
      ) : (
        <div>
          <label
            htmlFor="db-table-select"
            className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-slate-600">
            {t('dbTableLabel')}
          </label>
          <select
            id="db-table-select"
            value={selectedTable}
            onChange={e => selectTable(e.target.value)}
            className="w-full border border-terminal-border bg-background-dark px-3 py-2 font-mono text-[11px] text-slate-300">
            <option value="">{t('dbTableSelectPlaceholder')}</option>
            {tables.map(t => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      {selectedTable && (
        <div className="flex gap-4">
          <button
            onClick={handleInsert}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors hover:text-white">
            <span className="material-symbols-outlined text-[14px]">add</span>
            {t('dbInsertAction')}
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300">
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            {t('dbRefreshAction')}
          </button>
          <span className="ml-auto font-mono text-[9px] text-slate-600">
            {totalCount === 1 ? t('dbRowCountOne', String(totalCount)) : t('dbRowCountOther', String(totalCount))}
          </span>
        </div>
      )}

      {/* Rows */}
      {selectedTable &&
        (loadingRows ? (
          <div className="py-4 text-center font-mono text-[10px] uppercase tracking-widest text-slate-600">
            {t('dbLoadingRows')}
          </div>
        ) : (
          <DatabaseTableView rows={rows} primaryKey={primaryKey} onEdit={handleEdit} onDelete={handleDelete} />
        ))}

      {/* Pagination */}
      {selectedTable && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="font-mono text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-30">
            {t('dbPaginationPrev')}
          </button>
          <span className="font-mono text-[10px] text-slate-500">
            {t('dbPaginationPage', [String(page + 1), String(totalPages)])}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="font-mono text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-30">
            {t('dbPaginationNext')}
          </button>
        </div>
      )}

      {/* Row Editor Modal */}
      {editorRow !== undefined && (
        <DatabaseRowEditor
          row={editorRow}
          primaryKey={primaryKey}
          onSave={handleSave}
          onCancel={() => setEditorRow(undefined)}
        />
      )}
    </div>
  );
};
