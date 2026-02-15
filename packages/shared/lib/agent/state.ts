import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { Artifact, TabInfo, AgentAction } from '../types/index.js';

function mergeArtifacts(prev: Artifact[], next: Artifact[]): Artifact[] {
  const map = new Map(prev.map(a => [a.id, a]));
  for (const artifact of next) {
    map.set(artifact.id, artifact);
  }
  return Array.from(map.values());
}

export const ExtensionAgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  extensionId: Annotation<string>(),
  artifacts: Annotation<Artifact[]>({
    reducer: mergeArtifacts,
    default: () => [],
  }),
  activeTabInfo: Annotation<TabInfo | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  pendingActions: Annotation<AgentAction[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  iterationCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
});

export type ExtensionAgentStateType = typeof ExtensionAgentState.State;
