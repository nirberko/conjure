import { extensionDBManager } from '../extension-db-manager.js';
import { describe, it, expect, afterEach } from 'vitest';

// Clean up extension databases after each test
afterEach(async () => {
  try {
    await extensionDBManager.deleteDatabase('test-ext');
  } catch {
    // May not exist
  }
});

describe('ExtensionDBManager', () => {
  describe('createTables', () => {
    it('creates tables and returns schema', async () => {
      const schema = await extensionDBManager.createTables('test-ext', {
        users: '++id, name, email',
      });

      expect(schema.extensionId).toBe('test-ext');
      expect(schema.version).toBe(1);
      expect(schema.tables.users).toBe('++id, name, email');
    });

    it('merges tables on subsequent calls', async () => {
      await extensionDBManager.createTables('test-ext', {
        users: '++id, name',
      });

      const schema = await extensionDBManager.createTables('test-ext', {
        posts: '++id, userId, title',
      });

      expect(schema.version).toBe(2);
      expect(schema.tables.users).toBeDefined();
      expect(schema.tables.posts).toBeDefined();
    });
  });

  describe('removeTables', () => {
    it('removes specified tables', async () => {
      await extensionDBManager.createTables('test-ext', {
        users: '++id',
        posts: '++id',
      });

      const schema = await extensionDBManager.removeTables('test-ext', ['posts']);

      expect(schema.tables.users).toBeDefined();
      expect(schema.tables.posts).toBeUndefined();
    });

    it('throws for extension with no schema', async () => {
      await expect(extensionDBManager.removeTables('nonexistent', ['table'])).rejects.toThrow('No schema found');
    });
  });

  describe('query operations', () => {
    it('put and get', async () => {
      await extensionDBManager.createTables('test-ext', {
        items: '&id',
      });

      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: 'item-1', value: 'hello' },
      });

      const result = await extensionDBManager.query('test-ext', {
        type: 'get',
        table: 'items',
        key: 'item-1',
      });

      expect(result).toEqual({ id: 'item-1', value: 'hello' });
    });

    it('getAll', async () => {
      await extensionDBManager.createTables('test-ext', {
        items: '&id',
      });

      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '1', v: 'a' },
      });
      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '2', v: 'b' },
      });

      const result = await extensionDBManager.query('test-ext', {
        type: 'getAll',
        table: 'items',
      });

      expect(result).toHaveLength(2);
    });

    it('where', async () => {
      await extensionDBManager.createTables('test-ext', {
        items: '&id, category',
      });

      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '1', category: 'A' },
      });
      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '2', category: 'B' },
      });
      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '3', category: 'A' },
      });

      const result = await extensionDBManager.query('test-ext', {
        type: 'where',
        table: 'items',
        index: 'category',
        value: 'A',
      });

      expect(result).toHaveLength(2);
    });

    it('count', async () => {
      await extensionDBManager.createTables('test-ext', {
        items: '&id',
      });

      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '1' },
      });
      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '2' },
      });

      const count = await extensionDBManager.query('test-ext', {
        type: 'count',
        table: 'items',
      });

      expect(count).toBe(2);
    });

    it('clear', async () => {
      await extensionDBManager.createTables('test-ext', {
        items: '&id',
      });

      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '1' },
      });

      await extensionDBManager.query('test-ext', {
        type: 'clear',
        table: 'items',
      });

      const count = await extensionDBManager.query('test-ext', {
        type: 'count',
        table: 'items',
      });

      expect(count).toBe(0);
    });

    it('delete', async () => {
      await extensionDBManager.createTables('test-ext', {
        items: '&id',
      });

      await extensionDBManager.query('test-ext', {
        type: 'put',
        table: 'items',
        data: { id: '1', v: 'test' },
      });

      await extensionDBManager.query('test-ext', {
        type: 'delete',
        table: 'items',
        key: '1',
      });

      const result = await extensionDBManager.query('test-ext', {
        type: 'get',
        table: 'items',
        key: '1',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('KV storage', () => {
    it('storageSet and storageGet round-trip', async () => {
      await extensionDBManager.storageSet('test-ext', 'myKey', { count: 42 });
      const result = await extensionDBManager.storageGet('test-ext', 'myKey');

      expect(result).toEqual({ count: 42 });
    });

    it('storageGet returns empty object for missing key', async () => {
      // Ensure KV table exists first
      await extensionDBManager.storageSet('test-ext', 'init', {});
      const result = await extensionDBManager.storageGet('test-ext', 'nonexistent');

      expect(result).toEqual({});
    });
  });
});
