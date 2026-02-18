import { triggerAgent } from '../helpers/agent-trigger.js';
import { expectTableInPage } from '../helpers/dom-assertions.js';
import { test, expect } from '../helpers/extension-fixture.js';
import { setupExtension } from '../helpers/extension-setup.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

test.describe('Agent: Add table to page', () => {
  test.skip(!OPENAI_API_KEY, 'OPENAI_API_KEY not set');

  test('generates and injects a table component', async ({ context, extensionId, fixtureServer }) => {
    // 1. Setup: seed settings and create extension
    const { extensionUUID, setupPage } = await setupExtension(context, extensionId, {
      apiKey: OPENAI_API_KEY!,
    });

    // 2. Navigate: open fixture page, make it the active tab
    const fixturePage = await context.newPage();
    await fixturePage.goto(fixtureServer.url, { waitUntil: 'domcontentloaded' });

    // Verify fixture page loaded
    await expect(fixturePage.locator('#test-marker')).toBeVisible();

    // Close setup page so fixture becomes the active tab
    await setupPage.close();

    // Bring fixture page to front so chrome.tabs.query finds it
    await fixturePage.bringToFront();

    // 3. Trigger: open a new popup page to send agent messages.
    // The triggerPage is intentionally backgrounded (fixturePage.bringToFront below)
    // so Chrome treats the fixture as the active tab. The exposeFunction bridge in
    // triggerAgent() survives page backgrounding — each event is a short CDP round-trip.
    const triggerPage = await context.newPage();
    await triggerPage.goto(`chrome-extension://${extensionId}/popup/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    // Bring fixture back to front before triggering (so AGENT_RUN finds the right tab)
    await fixturePage.bringToFront();

    const result = await triggerAgent(
      triggerPage,
      extensionUUID,
      'Add a simple data table to this page with 3 columns: Name, Email, and Role. Include 3 sample rows of data.',
    );

    // 4. Assert agent ran successfully
    expect(result.success).toBe(true);
    expect(result.events.length).toBeGreaterThan(0);

    // Verify tool calls were made
    const toolCalls = result.events.filter(e => e.type === 'tool_call');
    expect(toolCalls.length).toBeGreaterThan(0);

    // Verify a code generation tool was called
    const codeGenTools = toolCalls.filter(
      e => e.data.toolName === 'generate_react_component' || e.data.toolName === 'generate_js_script',
    );
    expect(codeGenTools.length).toBeGreaterThan(0);

    // 5. Assert DOM: table was injected into the fixture page
    await expectTableInPage(fixturePage);
  });
});
