import { injectArtifact } from './injector.js';
import type { Artifact } from '@extension/shared';

export const loadComponentsForPage = async () => {
  const url = window.location.href;

  // Load extensions and their artifacts
  chrome.runtime.sendMessage({ type: 'LOAD_EXTENSIONS', payload: { url } }, (response: { artifacts?: Artifact[] }) => {
    if (!response?.artifacts) return;

    for (const artifact of response.artifacts) {
      if (artifact.enabled) {
        injectArtifact(artifact);
      }
    }
  });
};
