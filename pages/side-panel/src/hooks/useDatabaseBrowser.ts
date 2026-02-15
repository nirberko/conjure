import { useState, useCallback, useEffect } from 'react';

export interface TableInfo {
  name: string;
  primaryKey: string | string[];
  count: number;
}

export const useDatabaseBrowser = (extensionId: string) => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);

  const fetchTables = useCallback(async (dbId: string) => {
    setLoadingTables(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DB_BROWSE_LIST_TABLES',
        payload: { dbId },
      });
      setTables(response?.tables ?? []);
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const fetchRows = useCallback(
    async (tableName: string, p: number, dbId: string) => {
      if (!tableName) return;
      setLoadingRows(true);
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'DB_BROWSE_GET_ROWS',
          payload: { dbId, tableName, page: p, pageSize },
        });
        setRows(response?.rows ?? []);
        setTotalCount(response?.totalCount ?? 0);
      } finally {
        setLoadingRows(false);
      }
    },
    [pageSize],
  );

  // Load tables on mount and when extensionId changes
  useEffect(() => {
    setSelectedTable('');
    setPage(0);
    setRows([]);
    setTotalCount(0);
    fetchTables(extensionId);
  }, [extensionId, fetchTables]);

  // Load rows when table or page changes
  useEffect(() => {
    if (selectedTable) {
      fetchRows(selectedTable, page, extensionId);
    } else {
      setRows([]);
      setTotalCount(0);
    }
  }, [selectedTable, page, extensionId, fetchRows]);

  const selectTable = useCallback((tableName: string) => {
    setSelectedTable(tableName);
    setPage(0);
  }, []);

  const refresh = useCallback(async () => {
    await fetchTables(extensionId);
    if (selectedTable) {
      await fetchRows(selectedTable, page, extensionId);
    }
  }, [extensionId, selectedTable, page, fetchTables, fetchRows]);

  const putRow = useCallback(
    async (tableName: string, data: Record<string, unknown>) => {
      await chrome.runtime.sendMessage({
        type: 'DB_BROWSE_PUT_ROW',
        payload: { dbId: extensionId, tableName, data },
      });
      await refresh();
    },
    [extensionId, refresh],
  );

  const deleteRow = useCallback(
    async (tableName: string, key: unknown) => {
      await chrome.runtime.sendMessage({
        type: 'DB_BROWSE_DELETE_ROW',
        payload: { dbId: extensionId, tableName, key },
      });
      await refresh();
    },
    [extensionId, refresh],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
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
  };
};
