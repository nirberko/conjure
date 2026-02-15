import { Dexie } from 'dexie';
import type { Component, Conversation, Settings, Extension, Artifact, ExtensionSchema } from '../types/index.js';
import type { Table } from 'dexie';

export interface AgentCheckpoint {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id?: string;
  type?: string;
  checkpoint: string; // JSON serialized
  metadata: string; // JSON serialized
}

export interface AgentCheckpointWrite {
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  task_id: string;
  idx: number;
  channel: string;
  type?: string;
  value: string; // JSON serialized
}

export type ConjureDB = Dexie & {
  components: Table<Component, string>;
  conversations: Table<Conversation, string>;
  settings: Table<Settings, string>;
  extensions: Table<Extension, string>;
  artifacts: Table<Artifact, string>;
  agentCheckpoints: Table<AgentCheckpoint, [string, string, string]>;
  agentCheckpointWrites: Table<AgentCheckpointWrite, [string, string, string, string, number]>;
  extensionSchemas: Table<ExtensionSchema, string>;
};

export const createDB = (): ConjureDB => {
  const db = new Dexie('conjure') as ConjureDB;

  db.version(1).stores({
    components: 'id, urlPattern, enabled',
    conversations: 'id, componentId',
    componentData: 'id, componentId, pageUrl',
    settings: 'key',
  });

  db.version(2).stores({
    // Preserved from v1
    components: 'id, urlPattern, enabled',
    conversations: 'id, componentId',
    componentData: 'id, componentId, pageUrl',
    settings: 'key',
    // New in v2
    extensions: 'id, urlPattern, enabled, createdAt',
    artifacts: 'id, extensionId, type, name',
    agentCheckpoints: '[thread_id+checkpoint_ns+checkpoint_id], thread_id',
    agentCheckpointWrites: '[thread_id+checkpoint_ns+checkpoint_id+task_id+idx], thread_id',
  });

  db.version(3).stores({
    components: 'id, urlPattern, enabled',
    conversations: 'id, componentId, extensionId',
    componentData: 'id, componentId, pageUrl',
    settings: 'key',
    extensions: 'id, urlPattern, enabled, createdAt',
    artifacts: 'id, extensionId, type, name',
    agentCheckpoints: '[thread_id+checkpoint_ns+checkpoint_id], thread_id',
    agentCheckpointWrites: '[thread_id+checkpoint_ns+checkpoint_id+task_id+idx], thread_id',
  });

  db.version(4).stores({
    components: 'id, urlPattern, enabled',
    conversations: 'id, componentId, extensionId',
    componentData: 'id, componentId, pageUrl',
    settings: 'key',
    extensions: 'id, urlPattern, enabled, createdAt',
    artifacts: 'id, extensionId, type, name',
    agentCheckpoints: '[thread_id+checkpoint_ns+checkpoint_id], thread_id',
    agentCheckpointWrites: '[thread_id+checkpoint_ns+checkpoint_id+task_id+idx], thread_id',
    extensionSchemas: 'extensionId',
  });

  db.version(5).stores({
    componentData: null, // Drop componentData table
  });

  return db;
};
