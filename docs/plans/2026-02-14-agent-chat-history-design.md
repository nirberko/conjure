# Agent Chat History Persistence — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist AgentChatPanel conversation history to IndexedDB so messages (including tool calls) survive tab close/reopen.

**Architecture:** Reuse the existing `conversations` Dexie table with new `AgentConversation` / `AgentChatMessage` types and an `extensionId` index (schema v3). The `useAgentChat` hook loads history on mount and fire-and-forget persists on each message event. One conversation per extension.

**Tech Stack:** Dexie.js (IndexedDB), React hooks, Chrome extension messaging

---

### Task 1: Add shared types

**Files:**
- Modify: `packages/shared/lib/types/index.ts` (after line 32, after existing `Conversation` interface)

**Step 1: Add the new types**

Add after the existing `Conversation` interface:

```ts
// --- Agent Chat History Types ---

export interface ToolCallDisplay {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'done' | 'error';
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallDisplay[];
}

export interface AgentConversation {
  id: string;
  extensionId: string;
  messages: AgentChatMessage[];
  createdAt: number;
  updatedAt: number;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/nirberko/projects/signpdf && pnpm --filter @extension/shared exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/shared/lib/types/index.ts
git commit -m "feat: add AgentConversation and AgentChatMessage types for chat history"
```

---

### Task 2: Update DB schema to v3

**Files:**
- Modify: `packages/shared/lib/db/schema.ts` (add v3 schema with extensionId index)

**Step 1: Add v3 schema**

After the existing `db.version(2).stores(...)` block, add:

```ts
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
```

**Step 2: Update the `WebForgeDB` type**

Import `AgentConversation` alongside the existing types. The `conversations` table now holds both `Conversation` and `AgentConversation` records (they share the same table).

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/nirberko/projects/signpdf && pnpm --filter @extension/shared exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/lib/db/schema.ts
git commit -m "feat: add DB schema v3 with extensionId index on conversations"
```

---

### Task 3: Add agent conversation CRUD functions

**Files:**
- Modify: `packages/shared/lib/db/index.ts` (add 5 new functions after existing conversation CRUD)

**Step 1: Add imports**

Update the import line to include `AgentConversation` and `AgentChatMessage`:

```ts
import type { Component, Conversation, ComponentData, ChatMessage, Extension, Artifact, AgentConversation, AgentChatMessage } from '../types/index.js';
```

**Step 2: Add the CRUD functions**

After the existing `addMessage` function (line 95), add:

```ts
// --- Agent Conversation CRUD ---

export async function createAgentConversation(extensionId: string): Promise<AgentConversation> {
  const conversation: AgentConversation = {
    id: uuidv4(),
    extensionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.conversations.add(conversation);
  return conversation;
}

export async function getAgentConversation(extensionId: string): Promise<AgentConversation | undefined> {
  return db.conversations.where('extensionId').equals(extensionId).first() as Promise<AgentConversation | undefined>;
}

export async function addAgentMessage(extensionId: string, message: AgentChatMessage): Promise<void> {
  let conversation = await getAgentConversation(extensionId);
  if (!conversation) {
    conversation = await createAgentConversation(extensionId);
  }
  conversation.messages.push(message);
  await db.conversations.update(conversation.id, {
    messages: conversation.messages,
    updatedAt: Date.now(),
  });
}

export async function updateLastAgentMessage(extensionId: string, message: AgentChatMessage): Promise<void> {
  const conversation = await getAgentConversation(extensionId);
  if (!conversation || conversation.messages.length === 0) return;
  conversation.messages[conversation.messages.length - 1] = message;
  await db.conversations.update(conversation.id, {
    messages: conversation.messages,
    updatedAt: Date.now(),
  });
}

export async function clearAgentConversation(extensionId: string): Promise<void> {
  await db.conversations.where('extensionId').equals(extensionId).delete();
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/nirberko/projects/signpdf && pnpm --filter @extension/shared exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/shared/lib/db/index.ts
git commit -m "feat: add agent conversation CRUD functions for chat history"
```

---

### Task 4: Wire useAgentChat hook to DB

**Files:**
- Modify: `pages/side-panel/src/hooks/useAgentChat.ts` (add DB load on mount, persist on events)

**Step 1: Add imports**

```ts
import {
  getAgentConversation,
  addAgentMessage,
  updateLastAgentMessage,
  clearAgentConversation,
} from '@extension/shared';
import type { AgentChatMessage } from '@extension/shared';
```

**Step 2: Add loading state and load on mount**

Add `isLoading` state and a new `useEffect` that runs on mount to load history:

```ts
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  getAgentConversation(extensionId)
    .then(conversation => {
      if (conversation && conversation.messages.length > 0) {
        const restored = conversation.messages.map(m => ({
          ...m,
          toolCalls: m.toolCalls?.map(tc => ({ ...tc, status: tc.status === 'pending' ? 'done' as const : tc.status })),
        }));
        setMessages(restored);
        const maxId = conversation.messages.reduce((max, m) => {
          const num = parseInt(m.id.replace('msg-', ''), 10);
          return num > max ? num : max;
        }, 0);
        messageIdCounter.current = maxId;
      }
    })
    .catch(err => console.error('[WebForge] Failed to load chat history:', err))
    .finally(() => setIsLoading(false));
}, [extensionId]);
```

**Step 3: Persist user messages in sendMessage**

After `setMessages(prev => [...prev, userMsg])`, add:

```ts
addAgentMessage(extensionId, userMsg as AgentChatMessage).catch(err =>
  console.error('[WebForge] Failed to persist user message:', err),
);
```

**Step 4: Persist assistant messages in the stream listener**

In the `tool_call` case, after `setMessages(...)`, add:

```ts
// Persist the assistant message with tool calls
const msgToSave = prev => {
  // We need the updated message — use a helper
};
```

Actually, the cleaner approach: create a helper that persists after each `setMessages`. Use `setMessages` with a callback and persist the resulting last assistant message:

In the `tool_call` case, after the `setMessages` call, add:
```ts
setMessages(prev => {
  const updated = /* existing logic */;
  const lastMsg = updated[updated.length - 1];
  if (lastMsg?.role === 'assistant') {
    updateLastAgentMessage(extensionId, lastMsg as AgentChatMessage).catch(err =>
      console.error('[WebForge] Failed to persist tool_call:', err),
    );
  }
  return updated;
});
```

For `tool_result`, same pattern — persist via `updateLastAgentMessage` after state update.

For `response` and `error`, persist via `addAgentMessage` after the new message is created.

For `done`, persist the last assistant message via `updateLastAgentMessage`.

**Step 5: Wire clearChat to DB**

Update `clearChat`:
```ts
const clearChat = useCallback(() => {
  setMessages([]);
  pendingToolCalls.current = [];
  setIsRunning(false);
  clearAgentConversation(extensionId).catch(err =>
    console.error('[WebForge] Failed to clear conversation:', err),
  );
}, [extensionId]);
```

**Step 6: Return isLoading**

Update the return:
```ts
return { messages, isRunning, isLoading, artifacts, sendMessage, stopAgent, clearChat };
```

**Step 7: Verify TypeScript compiles**

Run: `cd /Users/nirberko/projects/signpdf && pnpm --filter side-panel exec tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add pages/side-panel/src/hooks/useAgentChat.ts
git commit -m "feat: wire useAgentChat to IndexedDB for chat history persistence"
```

---

### Task 5: Add loading state to AgentChatPanel UI

**Files:**
- Modify: `pages/side-panel/src/components/AgentChatPanel.tsx`

**Step 1: Destructure isLoading**

Update line 107:
```ts
const { messages, isRunning, isLoading, sendMessage, stopAgent, clearChat } = useAgentChat(extensionId);
```

**Step 2: Show loading state**

In the messages area, before the empty state check, add:

```tsx
{isLoading && (
  <div className="py-8 text-center text-sm text-gray-500">
    Loading conversation...
  </div>
)}
```

Update the empty state condition:
```tsx
{messages.length === 0 && !isRunning && !isLoading && (
```

**Step 3: Verify build**

Run: `cd /Users/nirberko/projects/signpdf && pnpm --filter side-panel exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add pages/side-panel/src/components/AgentChatPanel.tsx
git commit -m "feat: add loading state while restoring chat history"
```

---

### Task 6: Clean up — delete duplicate ToolCallDisplay from hook

**Files:**
- Modify: `pages/side-panel/src/hooks/useAgentChat.ts` (remove local interface definitions)
- Modify: `pages/side-panel/src/components/AgentChatPanel.tsx` (update import)

**Step 1: Remove local ToolCallDisplay and AgentMessage interfaces from useAgentChat.ts**

Delete the local `AgentMessage` and `ToolCallDisplay` interfaces (lines 4-17). Instead, import from shared:

```ts
import type { AgentChatMessage as AgentMessage, ToolCallDisplay } from '@extension/shared';
```

Re-export for consumers:
```ts
export type { AgentChatMessage as AgentMessage, ToolCallDisplay } from '@extension/shared';
```

**Step 2: Update AgentChatPanel import**

No changes needed — it already imports from `useAgentChat` which will re-export.

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/nirberko/projects/signpdf && pnpm --filter side-panel exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add pages/side-panel/src/hooks/useAgentChat.ts pages/side-panel/src/components/AgentChatPanel.tsx
git commit -m "refactor: use shared AgentChatMessage type, remove duplicate interfaces"
```

---

### Task 7: Manual smoke test

**Step 1: Build the extension**

Run: `cd /Users/nirberko/projects/signpdf && pnpm build`

**Step 2: Load in Chrome and verify**

1. Open side panel, navigate to an extension
2. Send a message — verify it appears
3. Close the side panel tab
4. Reopen — verify message history is restored with tool calls
5. Click "Clear" — verify history is wiped
6. Close and reopen — verify empty state shows
