import {
  createExtension,
  getExtension,
  getAllExtensions,
  updateExtension,
  deleteExtension,
  createArtifact,
  getArtifact,
  getArtifactsByExtension,
  updateArtifact,
  deleteArtifact,
  createAgentConversation,
  getAgentConversation,
  addAgentMessage,
  updateLastAgentMessage,
  clearAgentConversation,
  getSetting,
  setSetting,
} from '../index.js';
import { describe, it, expect } from 'vitest';

describe('Extension CRUD', () => {
  it('creates and retrieves an extension', async () => {
    const ext = await createExtension({
      name: 'Test Extension',
      urlPattern: 'https://example.com/*',
      enabled: true,
    });

    expect(ext.id).toBeDefined();
    expect(ext.name).toBe('Test Extension');
    expect(ext.createdAt).toBeGreaterThan(0);

    const retrieved = await getExtension(ext.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Test Extension');
  });

  it('gets all extensions', async () => {
    await createExtension({ name: 'Ext 1', urlPattern: '*', enabled: true });
    await createExtension({ name: 'Ext 2', urlPattern: '*', enabled: false });

    const all = await getAllExtensions();
    expect(all).toHaveLength(2);
  });

  it('updates an extension', async () => {
    const ext = await createExtension({
      name: 'Original',
      urlPattern: '*',
      enabled: true,
    });

    await updateExtension(ext.id, { name: 'Updated' });
    const updated = await getExtension(ext.id);

    expect(updated!.name).toBe('Updated');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(ext.updatedAt);
  });

  it('deletes extension with cascade to artifacts and checkpoints', async () => {
    const ext = await createExtension({
      name: 'To Delete',
      urlPattern: '*',
      enabled: true,
    });

    await createArtifact({
      extensionId: ext.id,
      type: 'js-script',
      name: 'Script',
      code: 'console.log("hi");',
      enabled: true,
    });

    await deleteExtension(ext.id);

    expect(await getExtension(ext.id)).toBeUndefined();
    expect(await getArtifactsByExtension(ext.id)).toHaveLength(0);
  });
});

describe('Artifact CRUD', () => {
  it('creates artifact with codeVersions', async () => {
    const artifact = await createArtifact({
      extensionId: 'ext-1',
      type: 'react-component',
      name: 'Widget',
      code: 'return () => null;',
      enabled: true,
    });

    expect(artifact.id).toBeDefined();
    expect(artifact.codeVersions).toHaveLength(1);
    expect(artifact.codeVersions[0].code).toBe('return () => null;');
  });

  it('updates artifact and appends code version', async () => {
    const artifact = await createArtifact({
      extensionId: 'ext-1',
      type: 'js-script',
      name: 'Script',
      code: 'v1',
      enabled: true,
    });

    await updateArtifact(artifact.id, { code: 'v2' });
    const updated = await getArtifact(artifact.id);

    expect(updated!.code).toBe('v2');
    expect(updated!.codeVersions).toHaveLength(2);
    expect(updated!.codeVersions[1].code).toBe('v2');
  });

  it('updates artifact without code does not add version', async () => {
    const artifact = await createArtifact({
      extensionId: 'ext-1',
      type: 'css',
      name: 'Style',
      code: 'body { }',
      enabled: true,
    });

    await updateArtifact(artifact.id, { name: 'New Name' });
    const updated = await getArtifact(artifact.id);

    expect(updated!.name).toBe('New Name');
    expect(updated!.codeVersions).toHaveLength(1);
  });

  it('deletes an artifact', async () => {
    const artifact = await createArtifact({
      extensionId: 'ext-1',
      type: 'css',
      name: 'ToDelete',
      code: 'body { }',
      enabled: true,
    });

    await deleteArtifact(artifact.id);
    expect(await getArtifact(artifact.id)).toBeUndefined();
  });

  it('gets artifacts by extension', async () => {
    await createArtifact({ extensionId: 'ext-a', type: 'css', name: 'A1', code: 'a', enabled: true });
    await createArtifact({ extensionId: 'ext-a', type: 'css', name: 'A2', code: 'b', enabled: true });
    await createArtifact({ extensionId: 'ext-b', type: 'css', name: 'B1', code: 'c', enabled: true });

    const extA = await getArtifactsByExtension('ext-a');
    const extB = await getArtifactsByExtension('ext-b');

    expect(extA).toHaveLength(2);
    expect(extB).toHaveLength(1);
  });
});

describe('Agent Conversation', () => {
  it('creates a conversation', async () => {
    const conv = await createAgentConversation('ext-1');

    expect(conv.id).toBeDefined();
    expect(conv.extensionId).toBe('ext-1');
    expect(conv.messages).toEqual([]);
  });

  it('adds messages to conversation', async () => {
    await addAgentMessage('ext-1', {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    });

    const conv = await getAgentConversation('ext-1');
    expect(conv).toBeDefined();
    expect(conv!.messages).toHaveLength(1);
    expect(conv!.messages[0].content).toBe('Hello');
  });

  it('auto-creates conversation when adding message', async () => {
    await addAgentMessage('new-ext', {
      id: 'msg-1',
      role: 'user',
      content: 'First message',
      timestamp: Date.now(),
    });

    const conv = await getAgentConversation('new-ext');
    expect(conv).toBeDefined();
    expect(conv!.messages).toHaveLength(1);
  });

  it('updates last agent message', async () => {
    await addAgentMessage('ext-1', {
      id: 'msg-1',
      role: 'assistant',
      content: 'Thinking...',
      timestamp: Date.now(),
    });

    await updateLastAgentMessage('ext-1', {
      id: 'msg-1',
      role: 'assistant',
      content: 'Done thinking. Here is the result.',
      timestamp: Date.now(),
    });

    const conv = await getAgentConversation('ext-1');
    expect(conv!.messages).toHaveLength(1);
    expect(conv!.messages[0].content).toBe('Done thinking. Here is the result.');
  });

  it('clears conversation', async () => {
    await addAgentMessage('ext-1', {
      id: 'msg-1',
      role: 'user',
      content: 'Test',
      timestamp: Date.now(),
    });

    await clearAgentConversation('ext-1');
    const conv = await getAgentConversation('ext-1');

    expect(conv).toBeUndefined();
  });
});

describe('Settings', () => {
  it('sets and gets a setting', async () => {
    await setSetting('theme', 'dark');
    const value = await getSetting<string>('theme');

    expect(value).toBe('dark');
  });

  it('returns undefined for missing key', async () => {
    const value = await getSetting('nonexistent');

    expect(value).toBeUndefined();
  });

  it('overwrites existing setting', async () => {
    await setSetting('count', 1);
    await setSetting('count', 42);
    const value = await getSetting<number>('count');

    expect(value).toBe(42);
  });
});
