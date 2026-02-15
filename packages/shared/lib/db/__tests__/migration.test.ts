import { db, getSetting, getAllExtensions, getArtifactsByExtension } from '../index.js';
import { migrateV1ToV2 } from '../migration.js';
import { describe, it, expect } from 'vitest';

describe('migrateV1ToV2', () => {
  it('skips when already complete', async () => {
    await db.settings.put({ key: 'v2_migration_complete', value: true });

    // Should return immediately
    await migrateV1ToV2();

    // No extensions should have been created
    const extensions = await getAllExtensions();
    expect(extensions).toHaveLength(0);
  });

  it('marks as complete when no components exist', async () => {
    await migrateV1ToV2();

    const value = await getSetting<boolean>('v2_migration_complete');
    expect(value).toBe(true);
  });

  it('migrates components to extensions and artifacts', async () => {
    // Insert a legacy component
    await db.components.add({
      id: 'comp-1',
      name: 'My Widget',
      urlPattern: 'https://example.com/*',
      cssSelector: '#root',
      injectionMode: 'append',
      code: 'function W() { return null; }\nreturn W;',
      codeVersions: [{ code: 'function W() { return null; }\nreturn W;', timestamp: 1000 }],
      enabled: true,
      createdAt: 1000,
      updatedAt: 1000,
    });

    await migrateV1ToV2();

    const extensions = await getAllExtensions();
    expect(extensions).toHaveLength(1);
    expect(extensions[0].name).toBe('My Widget');
    expect(extensions[0].urlPattern).toBe('https://example.com/*');

    const artifacts = await getArtifactsByExtension(extensions[0].id);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].type).toBe('react-component');
    expect(artifacts[0].name).toBe('My Widget');

    const migrated = await getSetting<boolean>('v2_migration_complete');
    expect(migrated).toBe(true);
  });
});
