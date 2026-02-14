import { db } from '../db/index.js';
import { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';
import type {
  Checkpoint,
  CheckpointListOptions,
  CheckpointMetadata,
  CheckpointTuple,
  ChannelVersions,
  PendingWrite,
} from '@langchain/langgraph-checkpoint';

export class DexieCheckpointSaver extends BaseCheckpointSaver {
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { thread_id, checkpoint_ns = '', checkpoint_id } = config.configurable ?? {};

    if (!thread_id) return undefined;

    let row;
    if (checkpoint_id) {
      row = await db.agentCheckpoints
        .where('[thread_id+checkpoint_ns+checkpoint_id]')
        .equals([thread_id, checkpoint_ns, checkpoint_id])
        .first();
    } else {
      const rows = await db.agentCheckpoints
        .where('thread_id')
        .equals(thread_id)
        .filter(r => r.checkpoint_ns === checkpoint_ns)
        .toArray();
      if (rows.length === 0) return undefined;
      rows.sort((a, b) => b.checkpoint_id.localeCompare(a.checkpoint_id));
      row = rows[0];
    }

    if (!row) return undefined;

    const checkpoint = JSON.parse(row.checkpoint) as Checkpoint;
    const metadata = JSON.parse(row.metadata) as CheckpointMetadata;

    // Load pending writes
    const writeRows = await db.agentCheckpointWrites
      .where('thread_id')
      .equals(thread_id)
      .filter(w => w.checkpoint_ns === checkpoint_ns && w.checkpoint_id === row!.checkpoint_id)
      .toArray();

    writeRows.sort((a, b) => a.idx - b.idx);

    const pendingWrites = writeRows.map(w => [w.task_id, w.channel, JSON.parse(w.value)]) as Array<
      [string, string, unknown]
    >;

    const parentConfig = row.parent_checkpoint_id
      ? {
          configurable: {
            thread_id,
            checkpoint_ns,
            checkpoint_id: row.parent_checkpoint_id,
          },
        }
      : undefined;

    return {
      config: {
        configurable: {
          thread_id,
          checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint,
      metadata,
      parentConfig,
      pendingWrites,
    };
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const { thread_id } = config.configurable ?? {};
    if (!thread_id) return;

    const limit = options?.limit;
    const before = options?.before;

    let rows = await db.agentCheckpoints.where('thread_id').equals(thread_id).toArray();

    rows.sort((a, b) => b.checkpoint_id.localeCompare(a.checkpoint_id));

    if (before?.configurable?.checkpoint_id) {
      const beforeId = before.configurable.checkpoint_id;
      rows = rows.filter(r => r.checkpoint_id < beforeId);
    }

    if (limit) {
      rows = rows.slice(0, limit);
    }

    for (const row of rows) {
      const checkpoint = JSON.parse(row.checkpoint) as Checkpoint;
      const metadata = JSON.parse(row.metadata) as CheckpointMetadata;

      const parentConfig = row.parent_checkpoint_id
        ? {
            configurable: {
              thread_id,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.parent_checkpoint_id,
            },
          }
        : undefined;

      yield {
        config: {
          configurable: {
            thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint,
        metadata,
        parentConfig,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const { thread_id, checkpoint_ns = '' } = config.configurable ?? {};
    if (!thread_id) throw new Error('thread_id is required');

    const checkpoint_id = checkpoint.id;
    const parent_checkpoint_id = config.configurable?.checkpoint_id;

    await db.agentCheckpoints.put({
      thread_id,
      checkpoint_ns,
      checkpoint_id,
      parent_checkpoint_id,
      checkpoint: JSON.stringify(checkpoint),
      metadata: JSON.stringify(metadata),
    });

    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id,
      },
    };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const { thread_id, checkpoint_ns = '', checkpoint_id } = config.configurable ?? {};
    if (!thread_id || !checkpoint_id) return;

    for (let idx = 0; idx < writes.length; idx++) {
      const [channel, value] = writes[idx];
      await db.agentCheckpointWrites.put({
        thread_id,
        checkpoint_ns,
        checkpoint_id,
        task_id: taskId,
        idx,
        channel,
        value: JSON.stringify(value),
      });
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    await db.agentCheckpoints.where('thread_id').equals(threadId).delete();
    await db.agentCheckpointWrites.where('thread_id').equals(threadId).delete();
  }
}
