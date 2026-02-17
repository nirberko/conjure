import { REACT_VERSION } from '@extension/shared';
import type { Artifact } from '@extension/shared';

const buildImportMap = (artifacts: Artifact[]): Record<string, string> => {
  const imports: Record<string, string> = {
    react: `https://esm.sh/react@${REACT_VERSION}`,
    'react/': `https://esm.sh/react@${REACT_VERSION}/`,
    'react-dom': `https://esm.sh/react-dom@${REACT_VERSION}?external=react`,
    'react-dom/': `https://esm.sh/react-dom@${REACT_VERSION}&external=react/`,
  };

  for (const artifact of artifacts) {
    if (!artifact.dependencies) continue;
    for (const [pkg, version] of Object.entries(artifact.dependencies)) {
      if (imports[pkg]) {
        const incomingUrl = `https://esm.sh/${pkg}@${version}?external=react,react-dom`;
        if (imports[pkg] !== incomingUrl) {
          console.warn(`[Conjure] Import map conflict for "${pkg}": keeping ${imports[pkg]}, ignoring ${incomingUrl}`);
        }
        continue;
      }
      imports[pkg] = `https://esm.sh/${pkg}@${version}?external=react,react-dom`;
    }
  }

  return imports;
};

let importMapInjected = false;

const injectImportMap = (artifacts: Artifact[]): void => {
  if (importMapInjected) return;

  const imports = buildImportMap(artifacts);
  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = JSON.stringify({ imports });

  const firstScript = document.querySelector('script');
  if (firstScript) {
    firstScript.before(script);
  } else {
    (document.head || document.documentElement).appendChild(script);
  }

  importMapInjected = true;
};

const hasImportMap = (): boolean => importMapInjected;

const resetImportMapState = (): void => {
  importMapInjected = false;
};

export { buildImportMap, injectImportMap, hasImportMap, resetImportMapState };
