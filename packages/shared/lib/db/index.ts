import { createDB } from './schema.js';
import { v4 as uuidv4 } from 'uuid';
import type { Extension, Artifact, AgentConversation, AgentChatMessage } from '../types/index.js';

const db = createDB();

export { db };
export { extensionDBManager } from './extension-db-manager.js';

// --- Agent Conversation CRUD ---

// Cast to AgentConversation table — same underlying Dexie table, different TS shape
const agentConversations = db.conversations as unknown as import('dexie').Table<AgentConversation, string>;

export async function createAgentConversation(extensionId: string): Promise<AgentConversation> {
  const conversation: AgentConversation = {
    id: uuidv4(),
    extensionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await agentConversations.add(conversation);
  return conversation;
}

export async function getAgentConversation(extensionId: string): Promise<AgentConversation | undefined> {
  return agentConversations.where('extensionId').equals(extensionId).first();
}

export async function addAgentMessage(extensionId: string, message: AgentChatMessage): Promise<void> {
  let conversation = await getAgentConversation(extensionId);
  if (!conversation) {
    conversation = await createAgentConversation(extensionId);
  }
  conversation.messages.push(message);
  await agentConversations.update(conversation.id, {
    messages: conversation.messages,
    updatedAt: Date.now(),
  });
}

export async function updateLastAgentMessage(extensionId: string, message: AgentChatMessage): Promise<void> {
  const conversation = await getAgentConversation(extensionId);
  if (!conversation || conversation.messages.length === 0) return;
  conversation.messages[conversation.messages.length - 1] = message;
  await agentConversations.update(conversation.id, {
    messages: conversation.messages,
    updatedAt: Date.now(),
  });
}

export async function clearAgentConversation(extensionId: string): Promise<void> {
  await db.conversations.where('extensionId').equals(extensionId).delete();
}

// Settings helpers
export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const entry = await db.settings.get(key);
  return entry?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

// --- Extension CRUD ---

export async function createExtension(data: Omit<Extension, 'id' | 'createdAt' | 'updatedAt'>): Promise<Extension> {
  const now = Date.now();
  const extension: Extension = {
    ...data,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
  await db.extensions.add(extension);
  return extension;
}

export async function getExtension(id: string): Promise<Extension | undefined> {
  return db.extensions.get(id);
}

export async function getAllExtensions(): Promise<Extension[]> {
  return db.extensions.toArray();
}

export async function getExtensionsByUrl(url: string): Promise<Extension[]> {
  const all = await db.extensions.toArray();
  return all.filter(e => e.enabled && matchUrlPattern(e.urlPattern, url));
}

export async function updateExtension(id: string, data: Partial<Extension>): Promise<void> {
  await db.extensions.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteExtension(id: string): Promise<void> {
  await db.extensions.delete(id);
  // Delete all artifacts belonging to this extension
  await db.artifacts.where('extensionId').equals(id).delete();
  // Clean up agent checkpoints
  await db.agentCheckpoints.where('thread_id').equals(id).delete();
  await db.agentCheckpointWrites.where('thread_id').equals(id).delete();
}

// --- Artifact CRUD ---

export async function createArtifact(
  data: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt' | 'codeVersions'>,
): Promise<Artifact> {
  const now = Date.now();
  const artifact: Artifact = {
    ...data,
    id: uuidv4(),
    codeVersions: [{ code: data.code, timestamp: now }],
    createdAt: now,
    updatedAt: now,
  };
  await db.artifacts.add(artifact);
  return artifact;
}

export async function getArtifact(id: string): Promise<Artifact | undefined> {
  return db.artifacts.get(id);
}

export async function getArtifactsByExtension(extensionId: string): Promise<Artifact[]> {
  return db.artifacts.where('extensionId').equals(extensionId).toArray();
}

export async function updateArtifact(id: string, data: Partial<Artifact>): Promise<void> {
  const now = Date.now();
  const updates: Partial<Artifact> = { ...data, updatedAt: now };

  if (data.code) {
    const existing = await db.artifacts.get(id);
    if (existing) {
      const versions = existing.codeVersions ?? [];
      versions.push({ code: data.code, timestamp: now });
      updates.codeVersions = versions;
    }
  }

  await db.artifacts.update(id, updates);
}

export async function deleteArtifact(id: string): Promise<void> {
  await db.artifacts.delete(id);
}

// URL pattern matching
declare const URLPattern:
  | {
      new (pattern: string): { test(url: string): boolean };
    }
  | undefined;

function matchUrlPattern(pattern: string, url: string): boolean {
  try {
    if (typeof URLPattern !== 'undefined') {
      const p = new URLPattern(pattern);
      return p.test(url);
    }
  } catch {
    // Fall through to glob matching
  }
  // Fallback to glob-style matching
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return regex.test(url);
}
