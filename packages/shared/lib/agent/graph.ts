import { getAgentSystemPrompt, getPlannerSystemPrompt } from './prompts.js';
import { ExtensionAgentState } from './state.js';
import { createAgentTools } from './tools/index.js';
import { getArtifactsByExtension } from '../db/index.js';
import { HumanMessage } from '@langchain/core/messages';
import { StateGraph, END } from '@langchain/langgraph';
import type { ToolContext } from './types.js';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Sanitize messages to fix incomplete tool call sequences.
 * LLMs require that every assistant message with tool_calls is followed
 * by tool response messages for each tool_call_id. If a previous run
 * was interrupted, the checkpoint may have dangling tool_calls.
 */
function sanitizeMessages(messages: BaseMessage[]): BaseMessage[] {
  const result: BaseMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const toolCalls = ('tool_calls' in msg ? (msg as any).tool_calls : undefined) as Array<{ id: string }> | undefined;

    if (toolCalls && toolCalls.length > 0) {
      // Check if all tool_call_ids have matching tool responses after this message
      const requiredIds = new Set(toolCalls.map(tc => tc.id));
      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j] as any;
        // Check for tool message via _getType() or tool_call_id property
        const toolCallId = next.tool_call_id ?? next.lc_kwargs?.tool_call_id ?? next.kwargs?.tool_call_id;
        if (toolCallId) {
          requiredIds.delete(toolCallId);
        } else {
          break; // Stop looking once we hit a non-tool message
        }
      }

      if (requiredIds.size > 0) {
        // This assistant message has dangling tool_calls — skip it and its orphaned tool responses
        console.log('[WebForge Graph] Removing dangling tool_calls message, missing responses for:', [...requiredIds]);
        continue;
      }
    }

    // Also skip orphaned tool messages whose assistant message was removed
    const isToolMsg = (msg as any).tool_call_id || (msg as any).lc_kwargs?.tool_call_id;
    if (isToolMsg) {
      // Check if the preceding message in result has matching tool_calls
      const prev = result[result.length - 1];
      const prevToolCalls = prev && 'tool_calls' in prev ? (prev as any).tool_calls : undefined;
      if (!prevToolCalls) {
        // Check if ANY previous result message has the tool_calls
        const tcId = (msg as any).tool_call_id ?? (msg as any).lc_kwargs?.tool_call_id;
        const hasParent = result.some(m => {
          const tcs = ('tool_calls' in m ? (m as any).tool_calls : []) as Array<{ id: string }>;
          return tcs?.some(tc => tc.id === tcId);
        });
        if (!hasParent) {
          console.log('[WebForge Graph] Removing orphaned tool response:', tcId);
          continue;
        }
      }
    }

    result.push(msg);
  }

  return result;
}

function createGraph(model: BaseChatModel, toolContext: ToolContext) {
  const tools = createAgentTools(toolContext);
  const modelWithTools = model.bindTools!(tools);

  // --- Node: Planner (chain-of-thought before each action) ---
  async function planner(state: typeof ExtensionAgentState.State) {
    console.log('[WebForge Graph] Planner node entered, iteration:', state.iterationCount);
    const tabInfo = state.activeTabInfo;
    const plannerPrompt = getPlannerSystemPrompt(tabInfo?.url, tabInfo?.title, state.plan);

    const cleanMessages = sanitizeMessages(state.messages);
    console.log('[WebForge Graph] Planner invoking LLM with', cleanMessages.length, 'messages...');
    const response = await model.invoke([{ role: 'system', content: plannerPrompt }, ...cleanMessages]);

    const planContent = typeof response.content === 'string' ? response.content : '';
    console.log('[WebForge Graph] Planner response:', planContent.slice(0, 200));

    return { plan: planContent };
  }

  // --- Node: Router / Orchestrator ---
  async function orchestrator(state: typeof ExtensionAgentState.State) {
    console.log('[WebForge Graph] Orchestrator node entered, iteration:', state.iterationCount);
    const artifacts = await getArtifactsByExtension(state.extensionId);
    const tabInfo = state.activeTabInfo;
    const systemPrompt = getAgentSystemPrompt(tabInfo?.url, tabInfo?.title, state.plan);

    const artifactsSummary =
      artifacts.length > 0
        ? `\n\nCurrent artifacts in this extension:\n${artifacts.map(a => `- [${a.type}] "${a.name}" (id: ${a.id}, enabled: ${a.enabled})`).join('\n')}`
        : '\n\nNo artifacts exist yet in this extension.';

    const cleanMessages = sanitizeMessages(state.messages);
    console.log(
      '[WebForge Graph] Invoking LLM with',
      cleanMessages.length,
      'messages (sanitized from',
      state.messages.length,
      ')...',
    );
    const response = await modelWithTools.invoke([
      { role: 'system', content: systemPrompt + artifactsSummary },
      ...cleanMessages,
    ]);
    console.log(
      '[WebForge Graph] LLM response received, tool_calls:',
      'tool_calls' in response ? (response.tool_calls as unknown[])?.length : 0,
    );

    return {
      messages: [response],
      artifacts,
      iterationCount: state.iterationCount + 1,
    };
  }

  // --- Node: Tool Executor ---
  async function toolExecutor(state: typeof ExtensionAgentState.State) {
    console.log('[WebForge Graph] Tool executor node entered');
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = ('tool_calls' in lastMessage ? lastMessage.tool_calls : []) as Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;

    if (!toolCalls || toolCalls.length === 0) {
      return { messages: [] };
    }

    const toolMap: Record<string, (typeof tools)[number]> = {};
    for (const t of tools) toolMap[t.name] = t;
    const results = [];

    for (const toolCall of toolCalls) {
      console.log(
        '[WebForge Graph] Executing tool:',
        toolCall.name,
        'args:',
        JSON.stringify(toolCall.args).slice(0, 200),
      );
      const toolInstance = toolMap[toolCall.name];
      if (!toolInstance) {
        results.push({
          role: 'tool' as const,
          content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
        continue;
      }

      try {
        const result = await (toolInstance as any).invoke(toolCall.args);
        console.log('[WebForge Graph] Tool result for', toolCall.name, ':', JSON.stringify(result).slice(0, 300));
        results.push({
          role: 'tool' as const,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      } catch (error) {
        console.error('[WebForge Graph] Tool error for', toolCall.name, ':', error);
        results.push({
          role: 'tool' as const,
          content: JSON.stringify({ error: String(error) }),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }
    }

    // Refresh artifacts after tool execution
    const artifacts = await getArtifactsByExtension(toolContext.extensionId);

    return { messages: results, artifacts };
  }

  // --- Conditional Edge: Should Continue? ---
  function shouldContinue(state: typeof ExtensionAgentState.State): 'tool_executor' | typeof END {
    console.log('[WebForge Graph] shouldContinue check, iteration:', state.iterationCount);
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = ('tool_calls' in lastMessage ? lastMessage.tool_calls : []) as unknown[];

    if (toolCalls && toolCalls.length > 0) {
      return 'tool_executor';
    }

    return END;
  }

  // --- Build Graph ---
  const graph = new StateGraph(ExtensionAgentState)
    .addNode('planner', planner)
    .addNode('orchestrator', orchestrator)
    .addNode('tool_executor', toolExecutor)
    .addEdge('__start__', 'planner')
    .addEdge('planner', 'orchestrator')
    .addConditionalEdges('orchestrator', shouldContinue)
    .addEdge('tool_executor', 'planner');

  return graph;
}

export function buildAgentGraph(model: BaseChatModel, toolContext: ToolContext) {
  const graph = createGraph(model, toolContext);
  return graph;
}

export function createUserMessage(content: string) {
  return new HumanMessage(content);
}
