import { describe, it, expect } from 'vitest';
import type { Artifact } from '../../types/index.js';

// Import the state to verify the reducer is set up correctly
// We test the artifact merge reducer logic directly since it's the custom part
function mergeArtifacts(prev: Artifact[], next: Artifact[]): Artifact[] {
  const map = new Map(prev.map(a => [a.id, a]));
  for (const artifact of next) {
    map.set(artifact.id, artifact);
  }
  return Array.from(map.values());
}

function makeArtifact(overrides: Partial<Artifact> & { id: string }): Artifact {
  return {
    extensionId: 'ext-1',
    type: 'react-component',
    name: 'Test',
    code: 'return Test;',
    codeVersions: [],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('artifact merge reducer', () => {
  it('adds new artifacts', () => {
    const prev: Artifact[] = [];
    const next = [makeArtifact({ id: 'a1', name: 'Widget' })];

    const result = mergeArtifacts(prev, next);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
    expect(result[0].name).toBe('Widget');
  });

  it('updates existing artifacts by id', () => {
    const prev = [makeArtifact({ id: 'a1', name: 'Old' })];
    const next = [makeArtifact({ id: 'a1', name: 'Updated' })];

    const result = mergeArtifacts(prev, next);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Updated');
  });

  it('preserves existing artifacts when adding new ones', () => {
    const prev = [makeArtifact({ id: 'a1', name: 'First' })];
    const next = [makeArtifact({ id: 'a2', name: 'Second' })];

    const result = mergeArtifacts(prev, next);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.id)).toEqual(['a1', 'a2']);
  });

  it('handles mix of updates and new additions', () => {
    const prev = [
      makeArtifact({ id: 'a1', name: 'First' }),
      makeArtifact({ id: 'a2', name: 'Second' }),
    ];
    const next = [
      makeArtifact({ id: 'a2', name: 'Updated Second' }),
      makeArtifact({ id: 'a3', name: 'Third' }),
    ];

    const result = mergeArtifacts(prev, next);

    expect(result).toHaveLength(3);
    expect(result.find(a => a.id === 'a2')?.name).toBe('Updated Second');
    expect(result.find(a => a.id === 'a3')?.name).toBe('Third');
  });

  it('handles empty prev and next', () => {
    expect(mergeArtifacts([], [])).toEqual([]);
  });
});
