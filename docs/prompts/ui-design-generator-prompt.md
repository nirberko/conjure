# UI Design Generator Prompt — Conjure Chrome Extension

Copy the prompt below into a UI design generator (e.g. v0, Galileo, Figma AI, or similar) to generate screens for the Conjure Chrome extension.

---

## Full product prompt (paste this)

**Product:** Conjure — a Chrome extension that lets users inject custom React components, JavaScript, and CSS into any website using AI. Users create “extensions” scoped to URL patterns; each extension has artifacts (components, scripts, styles, or background workers) that the AI agent generates, deploys, and verifies via chat.

**Design direction:** Dark, developer-friendly UI. Dark gray background (#111827 / gray-900), white and light gray text, blue as primary accent (#2563eb / blue-600 for buttons and active states). Clean, minimal, no decorative imagery. Dense but readable; think IDE or DevTools panel, not marketing site.

**Screens to design:**

1. **Popup (small, ~200×120px)**  
   - Appears when the user clicks the extension icon in the toolbar.  
   - Centered content: app name “Conjure” (bold, white), single primary button “Open Side Panel” (blue, rounded).  
   - Dark background, compact vertical layout.

2. **Side panel — main view (narrow panel, ~320–400px wide, full height)**  
   - **Header:** “Conjure” title, no nav in header.  
   - **Tabs:** Two horizontal tabs — “Extensions” (default) and “Settings”. Active tab has blue underline and blue text; inactive gray.  
   - **Extensions tab content:**  
     - “New Extension” button: dashed border, plus icon, gray text, full width.  
     - List of extension cards. Each card: extension name (bold), URL pattern in monospace/code style, optional description (muted). Right side: enable/disable toggle (switch) and a delete (trash) icon. Cards have subtle border, dark gray background, clickable.  
   - **Settings tab content:**  
     - Dropdown or radio group: “AI Provider” — OpenAI, Anthropic, Google.  
     - Text inputs for API key(s), placeholder like “sk-...” or “AI...”.  
     - Model dropdown (e.g. gpt-4o, claude-sonnet-4, gemini-2.5-pro).  
     - “Save” button (blue). Labels above or beside each control; clean form layout.

3. **Side panel — extension detail view (same width)**  
   - **Header:** Back arrow (left), extension name (truncated), URL pattern in small monospace below.  
   - **Sub-tabs:** “Chat” and “Artifacts”. Same tab style as main view (blue underline when active).  
   - **Chat tab:**  
     - Scrollable message list. User messages: right-aligned, blue bubbles. Assistant messages: left-aligned, dark gray bubbles; can include expandable “tool call” blocks (tool name, args, result, status dots: pending / success / error).  
     - At bottom: text input (full width, dark background) and Send button. Optional: “Thinking…” state with animated dots.  
   - **Artifacts tab:**  
     - List of artifact cards. Each card: artifact type badge (e.g. “React”, “JS”, “CSS”, “Worker”), name, and actions: Deploy, Remove; for workers add Start / Stop / Reload and a status pill (Running / Error). Cards stacked vertically, same dark card style as extension list.

**Constraints:**  
- No illustrations or hero images; iconography only where needed (back arrow, plus, trash, send).  
- Side panel must feel like a single narrow column; no multi-column layout.  
- Use system-friendly fonts or a simple sans (e.g. Inter, SF Pro) and monospace for code/URLs.  
- Ensure sufficient contrast for accessibility (WCAG AA).  
- Design for a tall, narrow viewport (Chrome side panel).

Generate [one screen / all screens / a single combined mockup] in a modern, dark theme matching the description above.

---

## Short variant (for character-limited tools)

**Conjure Chrome extension UI — dark theme (gray-900 bg, blue accents).**

1. **Popup:** Centered “Conjure” title + “Open Side Panel” button; dark, compact.  
2. **Side panel — Extensions:** Header “Conjure”, tabs Extensions | Settings. Extensions: “New Extension” dashed button, then cards (name, URL pattern, toggle, delete).  
3. **Side panel — Settings:** AI provider dropdown, API key inputs, model dropdown, Save button.  
4. **Side panel — Extension detail:** Back + name + URL; sub-tabs Chat | Artifacts. Chat: user (blue) / assistant (gray) bubbles, tool-call blocks, input + Send. Artifacts: cards with type badge, name, Deploy/Remove; workers have Start/Stop/Reload and status.

Style: developer/IDE-like, minimal, no decoration, narrow column (~360px), good contrast.

---

## Per-screen prompts (for one screen at a time)

**Popup:** Small Chrome extension popup, dark gray background. Centered: “Conjure” heading and one blue “Open Side Panel” button. Minimal, ~200×120px.

**Side panel — Extensions list:** Chrome side panel, dark theme. Header “Conjure”. Two tabs: Extensions (active, blue underline), Settings. Body: “New Extension” button with dashed border and plus icon; below, list of cards — each with title, monospace URL pattern, enable toggle, delete icon. Narrow column layout.

**Side panel — Settings:** Same panel, Settings tab active. Form: AI Provider (OpenAI / Anthropic / Google), API key field(s), Model dropdown, blue Save button. Dark inputs, clear labels.

**Side panel — Chat:** Extension detail view: back arrow, extension name, URL. Tabs Chat | Artifacts, Chat active. Message list with right-aligned blue user bubbles and left-aligned gray assistant bubbles; expandable tool-call rows. Bottom: text input and Send button.

**Side panel — Artifacts:** Same detail header and tabs, Artifacts active. Vertical list of artifact cards: type badge (React/JS/CSS/Worker), name, Deploy/Remove buttons; for workers, Start/Stop/Reload and status. Dark cards, compact.
