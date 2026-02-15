import { useState, useCallback, useEffect } from 'react';
import type { Extension, Artifact } from '@extension/shared';

export const useExtensions = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_EXTENSIONS' });
    setExtensions(response?.extensions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createExtension = useCallback(
    async (data: { name: string; urlPattern: string; description?: string }) => {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_EXTENSION',
        payload: { ...data, enabled: true },
      });
      await refresh();
      return response?.extension as Extension;
    },
    [refresh],
  );

  const updateExtension = useCallback(
    async (id: string, data: Partial<Extension>) => {
      await chrome.runtime.sendMessage({ type: 'UPDATE_EXTENSION', payload: { id, ...data } });
      await refresh();
    },
    [refresh],
  );

  const deleteExtension = useCallback(
    async (id: string) => {
      await chrome.runtime.sendMessage({ type: 'DELETE_EXTENSION', payload: { id } });
      await refresh();
    },
    [refresh],
  );

  const toggleExtension = useCallback(
    async (id: string) => {
      const ext = extensions.find(e => e.id === id);
      if (!ext) return;
      await updateExtension(id, { enabled: !ext.enabled });
    },
    [extensions, updateExtension],
  );

  const getArtifacts = useCallback(async (extensionId: string): Promise<Artifact[]> => {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_EXTENSION_ARTIFACTS',
      payload: { extensionId },
    });
    return response?.artifacts ?? [];
  }, []);

  return {
    extensions,
    loading,
    createExtension,
    updateExtension,
    deleteExtension,
    toggleExtension,
    getArtifacts,
    refresh,
  };
};
