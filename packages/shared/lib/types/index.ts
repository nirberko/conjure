export type InjectionMode = 'append' | 'prepend' | 'after' | 'before';

export interface ComponentVersion {
  code: string;
  timestamp: number;
}

// Kept for Dexie schema table definition (removing would require a DB migration)
export interface Component {
  id: string;
  name: string;
  urlPattern: string;
  cssSelector: string;
  injectionMode: InjectionMode;
  code: string;
  codeVersions: ComponentVersion[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  componentId: string;
  messages: ChatMessage[];
  createdAt: number;
}

// --- Agent Chat History Types ---

export interface ToolCallDisplay {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'done' | 'error' | 'skipped';
}

export interface ThinkingData {
  content: string;
  durationMs: number;
}

export type MessageDisplayItem =
  | { kind: 'thinking'; data: ThinkingData }
  | { kind: 'tool_call'; data: ToolCallDisplay };

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallDisplay[];
  thinking?: ThinkingData;
  displayItems?: MessageDisplayItem[];
}

export interface AgentConversation {
  id: string;
  extensionId: string;
  messages: AgentChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  key: string;
  value: unknown;
}

// --- Extension System Types ---

export interface Extension {
  id: string;
  name: string;
  description?: string;
  urlPattern: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ArtifactType = 'react-component' | 'js-script' | 'css' | 'background-worker';

export interface Artifact {
  id: string;
  extensionId: string;
  type: ArtifactType;
  name: string;
  code: string;
  codeVersions: { code: string; timestamp: number }[];
  elementXPath?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// --- Agent Types ---

export interface AgentAction {
  type: 'generate' | 'edit' | 'deploy' | 'verify' | 'inspect' | 'remove';
  artifactId?: string;
  description: string;
}

export interface TabInfo {
  tabId: number;
  url: string;
  title?: string;
}

export type AgentEventType =
  | 'AGENT_THINKING'
  | 'AGENT_TOOL_CALL'
  | 'AGENT_TOOL_RESULT'
  | 'AGENT_RESPONSE'
  | 'AGENT_ERROR'
  | 'AGENT_DONE';

export interface AgentEvent {
  type: AgentEventType;
  data: {
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: unknown;
    error?: string;
  };
  timestamp: number;
}

export interface AgentConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export type AIProvider = 'openai' | 'anthropic' | 'google';

// --- Extension DB Types ---

export interface ExtensionSchema {
  extensionId: string;
  version: number;
  tables: Record<string, string>; // tableName -> Dexie index spec
  updatedAt: number;
}

export type ExtDBOperation =
  | { type: 'put'; table: string; data: Record<string, unknown> }
  | { type: 'add'; table: string; data: Record<string, unknown> }
  | { type: 'get'; table: string; key: string | number }
  | { type: 'getAll'; table: string }
  | { type: 'update'; table: string; key: string | number; changes: Record<string, unknown> }
  | { type: 'delete'; table: string; key: string | number }
  | { type: 'where'; table: string; index: string; value: unknown; limit?: number }
  | { type: 'bulkPut'; table: string; data: Record<string, unknown>[] }
  | { type: 'bulkDelete'; table: string; keys: (string | number)[] }
  | { type: 'count'; table: string }
  | { type: 'clear'; table: string };

// --- Worker Log Types ---

export interface WorkerLog {
  level: 'log' | 'error';
  args: unknown[];
  timestamp: number;
}

// --- Message Types ---

export type MessageType =
  | 'GET_SETTINGS'
  | 'SET_SETTINGS'
  | 'ACTIVATE_PICKER'
  | 'PICKER_RESULT'
  // Extension system messages
  | 'GET_ALL_EXTENSIONS'
  | 'CREATE_EXTENSION'
  | 'UPDATE_EXTENSION'
  | 'DELETE_EXTENSION'
  | 'GET_EXTENSION_ARTIFACTS'
  | 'LOAD_EXTENSIONS'
  // Agent messages
  | 'AGENT_RUN'
  | 'AGENT_STOP'
  | 'GET_AGENT_STATUS'
  | 'AGENT_STREAM_EVENT'
  // Background worker messages
  | 'START_BACKGROUND_WORKER'
  | 'STOP_BACKGROUND_WORKER'
  | 'RELOAD_BACKGROUND_WORKER'
  | 'GET_ALL_WORKER_STATUSES'
  | 'GET_WORKER_LOGS'
  | 'CLEAR_WORKER_LOGS'
  | 'WORKER_CUSTOM_MESSAGE'
  // Content script messages
  | 'INSPECT_DOM'
  | 'INSPECT_STYLES'
  | 'READ_PAGE_TEXT'
  | 'INJECT_ARTIFACT'
  | 'REMOVE_ARTIFACT'
  | 'VERIFY_DEPLOYMENT'
  | 'WORKER_MESSAGE'
  // Extension DB messages
  | 'EXT_DB_CREATE_TABLES'
  | 'EXT_DB_REMOVE_TABLES'
  | 'EXT_DB_QUERY'
  | 'EXT_DB_GET_SCHEMA'
  | 'EXT_DB_STORAGE_GET'
  | 'EXT_DB_STORAGE_SET'
  // Database browser messages
  | 'DB_BROWSE_LIST_TABLES'
  | 'DB_BROWSE_GET_ROWS'
  | 'DB_BROWSE_PUT_ROW'
  | 'DB_BROWSE_DELETE_ROW'
  // User input collection
  | 'USER_INPUT_RESULT';

export interface UserInputField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number';
  required?: boolean;
  description?: string;
  placeholder?: string;
  envKey?: string;
}

export interface UserInputRequest {
  fields: UserInputField[];
  title?: string;
  submitLabel?: string;
}

export const REQUEST_USER_INPUT_TOOL_NAME = 'request_user_input';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}
