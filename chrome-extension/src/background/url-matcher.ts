import { dispatchWorkerTrigger } from './worker-manager.js';
import { getAllExtensions, getArtifactsByExtension } from '@extension/shared';
import type { Artifact } from '@extension/shared';

export const matchUrlPattern = (pattern: string, url: string): boolean => {
  try {
    if (typeof URLPattern !== 'undefined') {
      const p = new URLPattern(pattern);
      return p.test(url);
    }
  } catch {
    // Fall through to glob matching
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return regex.test(url);
};

export const getMatchingExtensionArtifacts = async (url: string): Promise<Artifact[]> => {
  const extensions = await getAllExtensions();
  const matching = extensions.filter(e => e.enabled && matchUrlPattern(e.urlPattern, url));

  const allArtifacts: Artifact[] = [];
  for (const ext of matching) {
    const artifacts = await getArtifactsByExtension(ext.id);
    allArtifacts.push(...artifacts.filter(a => a.enabled));
  }
  return allArtifacts;
};

export const setupTabListener = () => {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    // Inject extension artifacts and dispatch URL triggers to background workers
    const artifacts = await getMatchingExtensionArtifacts(tab.url);
    for (const artifact of artifacts) {
      if (artifact.type === 'background-worker') {
        // Dispatch URL navigation trigger to the running worker
        dispatchWorkerTrigger(artifact.extensionId, 'url_navigation', {
          url: tab.url,
          tabId,
          title: tab.title,
        });
      } else {
        chrome.tabs
          .sendMessage(tabId, {
            type: 'INJECT_ARTIFACT',
            payload: artifact,
          })
          .catch(() => {});
      }
    }
  });
};
