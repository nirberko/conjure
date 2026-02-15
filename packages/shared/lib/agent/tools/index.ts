import { createDeployArtifactTool } from './deploy-artifact.js';
import { createEditArtifactTool } from './edit-artifact.js';
import { createGenerateBackgroundWorkerTool } from './generate-background-worker.js';
import { createGenerateCssTool } from './generate-css.js';
import { createGenerateJsTool } from './generate-js.js';
import { createGenerateReactTool } from './generate-react.js';
import { createInspectDomTool } from './inspect-dom.js';
import { createInspectStylesTool, createReadPageTextTool } from './inspect-styles.js';
import { createPickElementTool } from './pick-element.js';
import { createRemoveArtifactTool } from './remove-artifact.js';
import { createRequestUserInputTool, REQUEST_USER_INPUT_TOOL_NAME } from './request-user-input.js';
import { createThinkTool } from './think.js';
import { createVerifyDeploymentTool } from './verify-deployment.js';
import type { ToolContext } from '../types.js';

export function createAgentTools(ctx: ToolContext) {
  return [
    createThinkTool(),
    createGenerateReactTool(ctx),
    createGenerateJsTool(ctx),
    createGenerateCssTool(ctx),
    createGenerateBackgroundWorkerTool(ctx),
    createEditArtifactTool(ctx),
    createInspectDomTool(ctx),
    createInspectStylesTool(ctx),
    createReadPageTextTool(ctx),
    createDeployArtifactTool(ctx),
    createVerifyDeploymentTool(ctx),
    createPickElementTool(ctx),
    createRemoveArtifactTool(ctx),
    createRequestUserInputTool(ctx),
  ];
}

export {
  createGenerateReactTool,
  createGenerateJsTool,
  createGenerateCssTool,
  createGenerateBackgroundWorkerTool,
  createEditArtifactTool,
  createInspectDomTool,
  createInspectStylesTool,
  createReadPageTextTool,
  createDeployArtifactTool,
  createVerifyDeploymentTool,
  createPickElementTool,
  createRemoveArtifactTool,
  createRequestUserInputTool,
  createThinkTool,
  REQUEST_USER_INPUT_TOOL_NAME,
};
