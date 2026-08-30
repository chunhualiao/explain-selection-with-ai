# Obsidian Explain Selection with AI Plugin

[![CI](https://github.com/chunhualiao/explain-selection-with-ai/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/chunhualiao/explain-selection-with-ai/actions/workflows/ci.yml)

An [Obsidian](https://obsidian.md) plugin that explains selected text using AI. Select any text, trigger the plugin via the context menu, command palette, or mobile toolbar, and get a validated AI-powered encyclopedia article rendered as Markdown — right inside Obsidian.

**Maintainers:** Chunhua Liao (primary maintainer) · BWurster (original creator)

## How It Works

1. **Select text** in any note.
2. **Trigger the plugin** using one of the methods below.
3. A context-free call enumerates established meanings for the selected term.
4. The surrounding line is given to a constrained selector that can return only a candidate index and confidence; it cannot author text for the article.
5. The chosen context-free term and sense label are used to write a neutral, standalone encyclopedia article.
6. A quality gate validates completeness, neutrality, unsupported claims, and context leakage; a failing draft is repaired once and validated again.
7. The validated article is displayed as rendered Markdown, followed by metadata (model, profile, tokens, cost, and timing). Unvalidated drafts are never shown or made savable.
8. Optionally click **"Save as Note & Link"** to save the explanation as a new note and replace your selection with a `[[wiki-link]]` to it.

## Ways to Trigger

### Right-click context menu (desktop & mobile)

Select text, right-click (or long-press on mobile), and choose the AI explanation option from the context menu. The menu item shows a preview of your selected text and reflects your configured prompt template.

### Command palette (desktop & mobile)

Open the command palette (`Ctrl/Cmd + P`) and search for **"Explain selection with AI"**. This works whenever text is selected in the editor.

### Mobile toolbar (iOS & Android)

On Obsidian mobile, you can add the command as a toolbar button above the keyboard:

1. Go to **Settings > Mobile**.
2. Tap **Manage toolbar options**.
3. Find **"Explain Selection With AI: Explain selection with AI"** in the list.
4. Add it to your toolbar and drag to reorder as desired.

Now you can select text and tap the toolbar button to trigger the plugin without opening the context menu or command palette.

### Custom hotkey (desktop)

You can assign a keyboard shortcut:

1. Go to **Settings > Hotkeys**.
2. Search for **"Explain selection with AI"**.
3. Click the `+` icon and press your desired key combination.

## Features

### Multiple LLM providers

Choose from four provider options in the plugin settings:

- **OpenAI** — GPT-4o, GPT-4o-mini, o1, and other OpenAI chat models
- **OpenRouter** — Access 400+ models from multiple providers (Anthropic, Google, Meta, Mistral, etc.) through a single API
- **Ollama** — Run models locally on your machine (Llama 3, Mistral, Phi, etc.) with no API key required
- **Custom** — Any OpenAI-compatible endpoint (Hugging Face TGI, vLLM, LiteLLM, etc.) with configurable base URL, model name, and optional API key

### Dynamic model picker

Each provider supports a **"Browse Models"** button in settings that fetches and displays available models from the provider's API. You can search and filter models by name or ID.

### Validated Markdown responses

The provider response is buffered while the quality gate runs. Only a draft that passes validation—or a repaired article that passes the second validation—is displayed in the modal. Accepted text is rendered as full Markdown (headings, lists, code blocks, LaTeX, etc.) using Obsidian's built-in Markdown renderer, so it integrates naturally with your vault's theme and styling.

### Wikipedia article profile and custom prompts

New installations use the **Wikipedia** article profile by default. It runs a staged pipeline:

- **Sense enumeration** receives only the selected term and returns up to eight established, neutral taxonomy candidates.
- **Sense selection** receives those candidates plus untrusted surrounding text and can return only a numeric candidate index and confidence. It cannot create term or sense text.
- **Article writing** receives the chosen context-free candidate, never the raw context. It must produce a neutral, third-person article with Origin and history, Definition, Key concepts, and Applications sections.
- **Validation and repair** checks the draft against structured and deterministic rules. A failing draft is repaired once and must pass a second validation before it can be saved.

The staged profile uses four model calls for a passing draft and six when repair is required, so it may take longer and cost more than a single prompt. Existing customized prompts migrate to an explicit **Custom (legacy)** profile and remain editable. Custom mode preserves the original `{{selection}}` / `{{context}}` behavior, but it does not provide Wikipedia-style or context-isolation guarantees.

### Save as Note & Link

After the AI finishes responding, a **"Save as Note & Link"** button appears. Clicking it:

1. Creates a new note in the same folder as the current note, named after your selection.
2. Replaces the original selection with a `[[wiki-link|display text]]` pointing to the new note.

If a note with that name already exists, you're given two choices:

- **Append to existing** — Adds the new explanation to the end of the existing note, separated by a horizontal rule.
- **Create numbered copy** — Creates a new note with an incremented number suffix (e.g., `My Topic 1.md`).

### Response metadata

When the AI response completes, metadata is displayed at the bottom of the modal (and included in saved notes):

- **Model** — The model ID used for the response
- **Article profile** — Whether the Wikipedia draft passed directly or required repair
- **Tokens** — Prompt and completion token counts (when the provider reports usage)
- **Cost** — Estimated cost in USD (available for OpenRouter models with pricing data)
- **Timing** — Total response duration, time-to-first-token (TTFT), and tokens per second
- **Date** — ISO timestamp of when the response was generated

### OpenRouter attribution

When using OpenRouter, you can optionally set:

- **HTTP-Referer** — Your site URL, used for OpenRouter app attribution and rankings
- **X-Title** — Your app name, displayed on the OpenRouter leaderboard

## Setup

### OpenRouter (recommended)

[OpenRouter](https://openrouter.ai) gives you access to 400+ models through a single API.

1. Get an API key from [openrouter.ai/keys](https://openrouter.ai/keys).
2. In plugin settings, select **OpenRouter** as the provider.
3. Enter your API key.
4. Click **Browse Models** to pick a model (e.g., `anthropic/claude-sonnet-4`, `google/gemini-2.5-pro-preview`, `openai/gpt-4o`).

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com/api-keys).
2. Select **OpenAI** as the provider.
3. Enter your API key.
4. Click **Browse Models** or type a model name (e.g., `gpt-4o`, `gpt-4o-mini`).

### Ollama (local)

1. Install and run [Ollama](https://ollama.com).
2. Pull a model: `ollama pull llama3`
3. Select **Ollama** as the provider.
4. Click **Browse Models** to see your installed models.

No API key is needed — Ollama runs entirely on your machine.

### Custom endpoint

For any OpenAI-compatible API:

1. Select **Custom** as the provider.
2. Enter the base URL (e.g., `http://localhost:8080/v1/`).
3. Enter the model name.
4. Enter an API key if the endpoint requires one.

## Continuous Integration

Every push and pull request triggers automated CI via [GitHub Actions](https://github.com/chunhualiao/explain-selection-with-ai/actions):

- **Test job:** Runs the full unit test suite and TypeScript type checking
- **Build job:** Verifies the plugin compiles and produces a valid `main.js`

The badge at the top of this README shows the current CI status.

## Development

### Project Structure

```
src/               Source code
  main.ts          Plugin entry point (Obsidian-dependent)
  lib.ts           Pure logic (no Obsidian imports, fully unit-testable)
tests/             Unit tests
  lib.test.ts      Tests for lib.ts
docs/              Documentation
  TEST_PLAN.md     4-layer test strategy
  SMOKE_TESTS.md   Manual test checklist for Obsidian runtime
```

Config files (`tsconfig.json`, `jest.config.js`, `esbuild.config.mjs`, `package.json`, `manifest.json`, `versions.json`) live at the project root.

### Build

```bash
npm install --legacy-peer-deps
node esbuild.config.mjs production
```

Outputs `main.js` at root (required by Obsidian).

### Test

```bash
npm test
```

### Type Check

```bash
npx tsc --noEmit --skipLibCheck
```

## License

MIT
