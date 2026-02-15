import { db } from './index.js';
import { v4 as uuidv4 } from 'uuid';
import type { Extension, Artifact } from '../types/index.js';

const MIGRATION_KEY = 'v2_migration_complete';

export async function migrateV1ToV2(): Promise<void> {
  // Check if migration has already been performed
  const migrated = await db.settings.get(MIGRATION_KEY);
  if (migrated?.value) return;

  const components = await db.components.toArray();
  if (components.length === 0) {
    // No data to migrate — just mark as done
    await db.settings.put({ key: MIGRATION_KEY, value: true });
    return;
  }

  console.log(`[Conjure] Migrating ${components.length} components to Extensions...`);

  for (const component of components) {
    const now = Date.now();
    const extensionId = uuidv4();

    const extension: Extension = {
      id: extensionId,
      name: component.name,
      urlPattern: component.urlPattern,
      enabled: component.enabled,
      createdAt: component.createdAt,
      updatedAt: now,
    };

    const artifact: Artifact = {
      id: uuidv4(),
      extensionId,
      type: 'react-component',
      name: component.name,
      code: component.code,
      codeVersions: component.codeVersions ?? [{ code: component.code, timestamp: component.createdAt }],
      enabled: true,
      createdAt: component.createdAt,
      updatedAt: now,
    };

    await db.extensions.add(extension);
    await db.artifacts.add(artifact);
  }

  await db.settings.put({ key: MIGRATION_KEY, value: true });
  console.log('[Conjure] Migration complete');
}
