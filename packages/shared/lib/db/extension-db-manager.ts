import { createDB } from './schema.js';
import { Dexie } from 'dexie';
import type { ExtensionSchema, ExtDBOperation } from '../types/index.js';
import type { IndexableType } from 'dexie';

const mainDb = createDB();

class ExtensionDBManager {
  private dbCache = new Map<string, Dexie>();
  private schemaLocks = new Map<string, Promise<void>>();
  private static KV_TABLE = '_kv';
  private static KV_SPEC = '&key';

  private dbName(extensionId: string): string {
    return `conjure_ext_${extensionId}`;
  }

  private async getStoredSchema(extensionId: string): Promise<ExtensionSchema | undefined> {
    return mainDb.extensionSchemas.get(extensionId);
  }

  private async saveSchema(schema: ExtensionSchema): Promise<void> {
    await mainDb.extensionSchemas.put(schema);
  }

  private openDB(extensionId: string, tables: Record<string, string>, version: number): Dexie {
    const name = this.dbName(extensionId);
    const db = new Dexie(name);
    db.version(version).stores(tables);
    return db;
  }

  async getDB(extensionId: string): Promise<Dexie> {
    const cached = this.dbCache.get(extensionId);
    if (cached && cached.isOpen()) return cached;

    const schema = await this.getStoredSchema(extensionId);
    if (!schema || Object.keys(schema.tables).length === 0) {
      throw new Error(`No schema found for extension ${extensionId}. Call createTables first.`);
    }

    const db = this.openDB(extensionId, schema.tables, schema.version);
    await db.open();
    this.dbCache.set(extensionId, db);
    return db;
  }

  async createTables(extensionId: string, tables: Record<string, string>): Promise<ExtensionSchema> {
    return this.withSchemaLock(extensionId, async () => {
      const existing = await this.getStoredSchema(extensionId);
      const currentTables = existing?.tables ?? {};
      const mergedTables = { ...currentTables, ...tables };
      const newVersion = (existing?.version ?? 0) + 1;

      // Close existing DB if open
      const cached = this.dbCache.get(extensionId);
      if (cached) {
        cached.close();
        this.dbCache.delete(extensionId);
      }

      const schema: ExtensionSchema = {
        extensionId,
        version: newVersion,
        tables: mergedTables,
        updatedAt: Date.now(),
      };

      // Open with new schema to trigger upgrade
      const db = this.openDB(extensionId, mergedTables, newVersion);
      await db.open();
      this.dbCache.set(extensionId, db);

      await this.saveSchema(schema);
      return schema;
    });
  }

  async removeTables(extensionId: string, tableNames: string[]): Promise<ExtensionSchema> {
    return this.withSchemaLock(extensionId, async () => {
      const existing = await this.getStoredSchema(extensionId);
      if (!existing) {
        throw new Error(`No schema found for extension ${extensionId}`);
      }

      // Close existing DB
      const cached = this.dbCache.get(extensionId);
      if (cached) {
        cached.close();
        this.dbCache.delete(extensionId);
      }

      const newVersion = existing.version + 1;

      // Dexie convention: set removed tables to null to delete them
      const storesForUpgrade: Record<string, string | null> = {};
      for (const name of Object.keys(existing.tables)) {
        storesForUpgrade[name] = existing.tables[name];
      }
      for (const name of tableNames) {
        storesForUpgrade[name] = null;
      }

      const remainingTables: Record<string, string> = {};
      for (const [name, spec] of Object.entries(existing.tables)) {
        if (!tableNames.includes(name)) {
          remainingTables[name] = spec;
        }
      }

      const db = new Dexie(this.dbName(extensionId));
      db.version(newVersion).stores(storesForUpgrade);
      await db.open();
      this.dbCache.set(extensionId, db);

      const schema: ExtensionSchema = {
        extensionId,
        version: newVersion,
        tables: remainingTables,
        updatedAt: Date.now(),
      };
      await this.saveSchema(schema);
      return schema;
    });
  }

  async query(extensionId: string, operation: ExtDBOperation): Promise<unknown> {
    try {
      return await this.executeQuery(extensionId, operation);
    } catch (err) {
      // Retry once on DatabaseClosedError (schema change race)
      if (err instanceof Error && err.name === 'DatabaseClosedError') {
        this.dbCache.delete(extensionId);
        return this.executeQuery(extensionId, operation);
      }
      throw err;
    }
  }

  private async executeQuery(extensionId: string, operation: ExtDBOperation): Promise<unknown> {
    const db = await this.getDB(extensionId);
    const table = db.table(operation.table);

    switch (operation.type) {
      case 'put':
        return table.put(operation.data);
      case 'add':
        return table.add(operation.data);
      case 'get':
        return table.get(operation.key);
      case 'getAll':
        return table.toArray();
      case 'update':
        return table.update(operation.key, operation.changes);
      case 'delete':
        return table.delete(operation.key);
      case 'where': {
        let collection = table.where(operation.index).equals(operation.value as IndexableType);
        if (operation.limit) {
          collection = collection.limit(operation.limit);
        }
        return collection.toArray();
      }
      case 'bulkPut':
        return table.bulkPut(operation.data);
      case 'bulkDelete':
        return table.bulkDelete(operation.keys);
      case 'count':
        return table.count();
      case 'clear':
        return table.clear();
      default:
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  async getSchema(extensionId: string): Promise<ExtensionSchema | undefined> {
    return this.getStoredSchema(extensionId);
  }

  async ensureKVTable(extensionId: string): Promise<void> {
    const schema = await this.getStoredSchema(extensionId);
    if (schema && schema.tables[ExtensionDBManager.KV_TABLE]) return;
    await this.createTables(extensionId, { [ExtensionDBManager.KV_TABLE]: ExtensionDBManager.KV_SPEC });
  }

  async storageGet(extensionId: string, key: string): Promise<Record<string, unknown>> {
    await this.ensureKVTable(extensionId);
    const db = await this.getDB(extensionId);
    const entry = await db.table(ExtensionDBManager.KV_TABLE).get(key);
    return (entry?.data as Record<string, unknown>) ?? {};
  }

  async storageSet(extensionId: string, key: string, data: Record<string, unknown>): Promise<void> {
    await this.ensureKVTable(extensionId);
    const db = await this.getDB(extensionId);
    await db.table(ExtensionDBManager.KV_TABLE).put({ key, data, updatedAt: Date.now() });
  }

  async deleteDatabase(extensionId: string): Promise<void> {
    const cached = this.dbCache.get(extensionId);
    if (cached) {
      cached.close();
      this.dbCache.delete(extensionId);
    }

    await Dexie.delete(this.dbName(extensionId));
    await mainDb.extensionSchemas.delete(extensionId);
  }

  private async withSchemaLock<T>(extensionId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock to release
    const existing = this.schemaLocks.get(extensionId);
    if (existing) {
      await existing;
    }

    let resolve!: () => void;
    const lock = new Promise<void>(r => {
      resolve = r;
    });
    this.schemaLocks.set(extensionId, lock);

    try {
      return await fn();
    } finally {
      resolve();
      if (this.schemaLocks.get(extensionId) === lock) {
        this.schemaLocks.delete(extensionId);
      }
    }
  }
}

export const extensionDBManager = new ExtensionDBManager();
