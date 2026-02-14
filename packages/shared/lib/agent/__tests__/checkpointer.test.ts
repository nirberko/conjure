import { describe, it, expect } from 'vitest';
import { DexieCheckpointSaver } from '../checkpointer.js';
import type { Checkpoint, CheckpointMetadata } from '@langchain/langgraph-checkpoint';

function makeCheckpoint(id: string): Checkpoint {
  return {
    v: 1,
    id,
    ts: new Date().toISOString(),
    channel_values: {},
    channel_versions: {},
    versions_seen: {},
    pending_sends: [],
  };
}

function makeMetadata(): CheckpointMetadata {
  return {
    source: 'input',
    step: 0,
    writes: {},
    parents: {},
  };
}

describe('DexieCheckpointSaver', () => {
  it('put and getTuple round-trip', async () => {
    const saver = new DexieCheckpointSaver();
    const checkpoint = makeCheckpoint('cp-1');
    const metadata = makeMetadata();

    const config = {
      configurable: {
        thread_id: 'thread-1',
        checkpoint_ns: '',
        checkpoint_id: 'prev-cp',
      },
    };

    const result = await saver.put(config, checkpoint, metadata, {});

    expect(result.configurable?.checkpoint_id).toBe('cp-1');

    const tuple = await saver.getTuple({
      configurable: {
        thread_id: 'thread-1',
        checkpoint_ns: '',
        checkpoint_id: 'cp-1',
      },
    });

    expect(tuple).toBeDefined();
    expect(tuple!.checkpoint.id).toBe('cp-1');
    expect(tuple!.parentConfig?.configurable?.checkpoint_id).toBe('prev-cp');
  });

  it('getTuple returns latest when no checkpoint_id specified', async () => {
    const saver = new DexieCheckpointSaver();

    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('a'),
      makeMetadata(),
      {},
    );
    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('b'),
      makeMetadata(),
      {},
    );

    const tuple = await saver.getTuple({
      configurable: { thread_id: 't1', checkpoint_ns: '' },
    });

    // 'b' > 'a' lexicographically
    expect(tuple!.checkpoint.id).toBe('b');
  });

  it('getTuple returns undefined for missing thread', async () => {
    const saver = new DexieCheckpointSaver();

    const tuple = await saver.getTuple({
      configurable: { thread_id: 'nonexistent' },
    });

    expect(tuple).toBeUndefined();
  });

  it('list returns checkpoints in reverse order', async () => {
    const saver = new DexieCheckpointSaver();

    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('a'),
      makeMetadata(),
      {},
    );
    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('b'),
      makeMetadata(),
      {},
    );
    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('c'),
      makeMetadata(),
      {},
    );

    const items: { checkpoint: Checkpoint }[] = [];
    for await (const tuple of saver.list({ configurable: { thread_id: 't1' } })) {
      items.push(tuple);
    }

    expect(items).toHaveLength(3);
    expect(items[0].checkpoint.id).toBe('c');
    expect(items[1].checkpoint.id).toBe('b');
    expect(items[2].checkpoint.id).toBe('a');
  });

  it('list respects limit option', async () => {
    const saver = new DexieCheckpointSaver();

    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('a'),
      makeMetadata(),
      {},
    );
    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('b'),
      makeMetadata(),
      {},
    );

    const items: { checkpoint: Checkpoint }[] = [];
    for await (const tuple of saver.list(
      { configurable: { thread_id: 't1' } },
      { limit: 1 },
    )) {
      items.push(tuple);
    }

    expect(items).toHaveLength(1);
    expect(items[0].checkpoint.id).toBe('b');
  });

  it('putWrites and pending write retrieval', async () => {
    const saver = new DexieCheckpointSaver();
    const checkpoint = makeCheckpoint('cp-1');

    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      checkpoint,
      makeMetadata(),
      {},
    );

    await saver.putWrites(
      { configurable: { thread_id: 't1', checkpoint_ns: '', checkpoint_id: 'cp-1' } },
      [['messages', { content: 'hello' }]],
      'task-1',
    );

    const tuple = await saver.getTuple({
      configurable: { thread_id: 't1', checkpoint_ns: '', checkpoint_id: 'cp-1' },
    });

    expect(tuple!.pendingWrites).toHaveLength(1);
    expect(tuple!.pendingWrites![0][0]).toBe('task-1');
    expect(tuple!.pendingWrites![0][1]).toBe('messages');
  });

  it('deleteThread cleans up all data', async () => {
    const saver = new DexieCheckpointSaver();

    await saver.put(
      { configurable: { thread_id: 't1', checkpoint_ns: '' } },
      makeCheckpoint('cp-1'),
      makeMetadata(),
      {},
    );

    await saver.putWrites(
      { configurable: { thread_id: 't1', checkpoint_ns: '', checkpoint_id: 'cp-1' } },
      [['ch', 'val']],
      'task-1',
    );

    await saver.deleteThread('t1');

    const tuple = await saver.getTuple({
      configurable: { thread_id: 't1' },
    });

    expect(tuple).toBeUndefined();
  });
});
