# Privacy Policy for Conjure

**Last updated:** February 15, 2026

Conjure ("the Extension") is an AI-powered Chrome extension that lets users create and inject custom UI components, scripts, and styles into websites using natural language. This privacy policy explains what data the Extension collects, how it is used, and how it is protected.

## Data Storage

All data created and managed by Conjure is stored **locally on your device** using the browser's IndexedDB storage. This includes:

- Extensions you create (names, descriptions, URL patterns)
- Generated code artifacts (React components, JavaScript, CSS, background workers)
- Agent conversation history
- AI provider settings (provider type, model name, API keys)

**No data is synced to remote servers, cloud services, or the Extension developer's infrastructure.** Your data stays on your device and is never transmitted to us.

## AI Provider Communication

Conjure integrates with third-party AI providers to generate code based on your instructions. When you interact with the AI agent, the following data is sent to **the AI provider you choose**:

- Your natural language prompts and messages
- Conversation context from the current session
- Page content (DOM structure, text, styles) when the agent uses inspection tools

Conjure supports these AI providers:

- **OpenAI** — [Privacy Policy](https://openai.com/privacy)
- **Anthropic** — [Privacy Policy](https://www.anthropic.com/privacy)
- **Google Generative AI** — [Privacy Policy](https://policies.google.com/privacy)

**Important:**
- You must provide your own API key to use any provider.
- Your API keys are stored locally and are only sent to the provider you select.
- No data is sent to any AI provider until you explicitly initiate a conversation.
- Conjure's developers never have access to your API keys or conversations.

## Browser Permissions

The Extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `scripting` | Inject your generated components and scripts into web pages |
| `activeTab` | Access the current tab for page inspection when you use the agent |
| `sidePanel` | Display the Conjure side panel interface |
| `offscreen` | Run background workers in an isolated sandboxed environment |
| `<all_urls>` (host) | Allow injection of your extensions on any website you configure |

## What We Do NOT Collect

- No analytics or telemetry
- No usage tracking or event logging
- No browsing history
- No cookies
- No bookmarks or passwords
- No user accounts or authentication
- No personal information or identifiers
- No data is sent to Conjure's developers or any third party (other than your chosen AI provider)

## Page Content Access

The AI agent can inspect page content (DOM structure, text, computed styles) **only when you actively interact with the agent** and it uses inspection tools. This data is:

- Used solely to help the agent understand the page context for generating code
- Sent only to your selected AI provider as part of the conversation
- Never stored beyond the current conversation session's local checkpoint
- Never transmitted to any other party

## Background Workers

Extensions you create may include background workers that run in an isolated offscreen document. These workers:

- Execute only code that you generated and approved
- Run in a sandboxed environment separate from web pages
- Only activate based on URL patterns and triggers you define

## Data Retention and Deletion

All data is stored locally in your browser. You can delete your data at any time by:

- Removing individual extensions and artifacts through the Conjure interface
- Clearing the browser's IndexedDB storage for the Extension
- Uninstalling the Extension (removes all associated local data)

## Children's Privacy

Conjure is not directed at children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be noted by updating the "Last updated" date at the top of this document.

## Contact

If you have questions about this privacy policy, please open an issue on our [GitHub repository](https://github.com/nicenathapong/conjure).