import { injectArtifactsBatch } from './injector.js';
import type { Artifact } from '@extension/shared';

export const loadComponentsForPage = async () => {
  const url = window.location.href;

  // Load extensions and their artifacts — use batch injection so import maps
  // are set up before any module scripts execute
  chrome.runtime.sendMessage({ type: 'LOAD_EXTENSIONS', payload: { url } }, (response: { artifacts?: Artifact[] }) => {
    if (!response?.artifacts) return;

    const enabled = response.artifacts.filter(a => a.enabled);
    if (enabled.length > 0) {
      injectArtifactsBatch(enabled);
    }
  });
};
