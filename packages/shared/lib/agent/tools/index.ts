import { createAddDependencyTool } from './add-dependency.js';
import { createDeployArtifactTool } from './deploy-artifact.js';
import { createEditArtifactTool } from './edit-artifact.js';
import { createGenerateBackgroundWorkerTool } from './generate-background-worker.js';
import { createGenerateCssTool } from './generate-css.js';
import { createGenerateJsTool } from './generate-js.js';
import { createGenerateReactTool } from './generate-react.js';
import { createInspectDomTool } from './inspect-dom.js';
import { createInspectStylesTool, createReadPageTextTool } from './inspect-styles.js';
import { createInspectThemeTool } from './inspect-theme.js';
import { createPickElementTool } from './pick-element.js';
import { createRemoveArtifactTool } from './remove-artifact.js';
import { createRequestUserInputTool, REQUEST_USER_INPUT_TOOL_NAME } from './request-user-input.js';
import { createThinkTool } from './think.js';
import type { ToolContext } from '../types.js';

export const createAgentTools = (ctx: ToolContext) => [
  createThinkTool(),
  createGenerateReactTool(ctx),
  createGenerateJsTool(ctx),
  createGenerateCssTool(ctx),
  createGenerateBackgroundWorkerTool(ctx),
  createEditArtifactTool(ctx),
  createInspectDomTool(ctx),
  createInspectStylesTool(ctx),
  createInspectThemeTool(ctx),
  createReadPageTextTool(ctx),
  createDeployArtifactTool(ctx),
  createPickElementTool(ctx),
  createRemoveArtifactTool(ctx),
  createRequestUserInputTool(ctx),
  createAddDependencyTool(ctx),
];

export {
  createAddDependencyTool,
  createGenerateReactTool,
  createGenerateJsTool,
  createGenerateCssTool,
  createGenerateBackgroundWorkerTool,
  createEditArtifactTool,
  createInspectDomTool,
  createInspectStylesTool,
  createInspectThemeTool,
  createReadPageTextTool,
  createDeployArtifactTool,
  createPickElementTool,
  createRemoveArtifactTool,
  createRequestUserInputTool,
  createThinkTool,
  REQUEST_USER_INPUT_TOOL_NAME,
};
