# Test Plan: Explain Selection With AI (Obsidian Plugin)

## 1. Overview

Testing Obsidian plugins is uniquely challenging because the Obsidian API (`App`, `Modal`, `Plugin`, `Setting`, `MarkdownRenderer`, `requestUrl`, etc.) is only available inside Obsidian's Electron runtime. There is no official mock library or test harness from Obsidian.

This plan defines a **multi-layered testing strategy** that balances coverage with practicality.

## 2. Testing Layers

### Layer 1: Unit Tests (Jest + ts-jest)
**Coverage target: All pure business logic**
**Runs: CI, local, pre-commit**

Extract all logic with zero Obsidian dependencies into `lib.ts`. Test with Jest.

**What belongs in `lib.ts` (no `import` from `"obsidian"`):**

| Function | Purpose |
|---|---|
| `buildPrompt(template, selection, context)` | Replace `{{selection}}` and `{{context}}` placeholders |
| `getProviderConfig(settings)` | Resolve baseURL, apiKey, model, headers per provider |
| `filterOpenAIModels(rawModels)` | Keep only chat models, exclude embeddings/tts/whisper/dall-e |
| `parseOpenRouterModels(apiResponse)` | Parse OpenRouter `/models` response into `ModelInfo[]` |
| `parseOllamaModels(apiResponse)` | Parse Ollama `/api/tags` response into `ModelInfo[]` |
| `deriveOllamaBaseUrl(baseURL)` | Strip `/v1/` to get Ollama API root |
| `filterModels(models, query)` | Search/filter model list by id or name |
| `DEFAULT_SETTINGS` | Settings defaults constant |
| `ExplainSelectionWithAiPluginSettings` | Settings interface |
| `ModelInfo` | Model info interface |

**Test file: `lib.test.ts`**

#### 2.1.1 `buildPrompt` Tests

| Test Case | Input | Expected |
|---|---|---|
| Basic replacement | `("Tell me about {{selection}} in {{context}}", "AI", "tech")` | `"Tell me about AI in tech"` |
| Multiple occurrences | `("{{selection}} and {{selection}}", "AI", "")` | `"AI and AI"` |
| Empty selection | `("About {{selection}}", "", "ctx")` | `"About "` |
| No placeholders | `("Plain prompt", "AI", "ctx")` | `"Plain prompt"` |
| Special chars (regex) | `("{{selection}}", "test $1 (foo) [bar]", "")` | `"test $1 (foo) [bar]"` |
| Newlines in selection | `("{{selection}}", "line1\nline2", "")` | `"line1\nline2"` |
| Quotes in selection | `("{{selection}}", 'He said "hello"', "")` | `'He said "hello"'` |
| Both placeholders empty | `("{{selection}}{{context}}", "", "")` | `""` |

#### 2.1.2 `getProviderConfig` Tests

| Test Case | Provider | Validates |
|---|---|---|
| OpenAI defaults | `dropdownValue: "openai"` | baseURL = `https://api.openai.com/v1/`, uses `apiKey` and `endpoint` |
| OpenRouter defaults | `dropdownValue: "openrouter"` | baseURL = `https://openrouter.ai/api/v1`, uses `openRouterApiKey` and `openRouterModel` |
| OpenRouter with headers | referer + title set | `defaultHeaders` includes both `HTTP-Referer` and `X-Title` |
| OpenRouter empty headers | referer + title empty | `defaultHeaders` is undefined or empty |
| Ollama defaults | `dropdownValue: "ollama"` | baseURL from settings, uses `endpoint` |
| Custom provider | `dropdownValue: "custom"` | Uses raw `baseURL`, `endpoint`, `apiKey` |
| Empty API key fallback | apiKey = "" | Returns `"-"` as apiKey |

#### 2.1.3 `filterOpenAIModels` Tests

| Test Case | Input Models | Expected |
|---|---|---|
| Keeps chat models | `["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]` | All kept |
| Keeps o-series | `["o1-mini", "o1-preview", "o3-mini"]` | All kept |
| Excludes non-chat | `["dall-e-3", "tts-1", "whisper-1", "text-embedding-ada-002"]` | Empty |
| Mixed input | `["gpt-4o", "dall-e-3", "o1-mini", "whisper-1"]` | `["gpt-4o", "o1-mini"]` |
| Sorted output | `["gpt-4o", "gpt-3.5-turbo", "gpt-4o-mini"]` | Alphabetically sorted |
| Empty input | `[]` | `[]` |
| Excludes legacy | `["babbage-002", "davinci-002"]` | Empty |

#### 2.1.4 `parseOpenRouterModels` Tests

| Test Case | Input | Expected |
|---|---|---|
| Valid response | `{data: [{id: "a/b", name: "B"}]}` | `[{id: "a/b", name: "B"}]` |
| Missing name | `{data: [{id: "a/b"}]}` | `[{id: "a/b", name: undefined}]` |
| Sorted output | 3 unsorted models | Alphabetically by id |
| Empty data | `{data: []}` | `[]` |
| Missing data field | `{}` | `[]` |

#### 2.1.5 `parseOllamaModels` Tests

| Test Case | Input | Expected |
|---|---|---|
| Valid response | `{models: [{name: "llama3"}]}` | `[{id: "llama3"}]` |
| Sorted output | 3 unsorted models | Alphabetically by id |
| Empty models | `{models: []}` | `[]` |
| Missing models field | `{}` | `[]` |

#### 2.1.6 `deriveOllamaBaseUrl` Tests

| Test Case | Input | Expected |
|---|---|---|
| Strips /v1/ | `"http://localhost:11434/v1/"` | `"http://localhost:11434"` |
| Strips /v1 (no slash) | `"http://localhost:11434/v1"` | `"http://localhost:11434"` |
| No /v1/ present | `"http://localhost:11434"` | `"http://localhost:11434"` |
| Custom host | `"http://myhost:8080/v1/"` | `"http://myhost:8080"` |
| Empty string | `""` | `"http://localhost:11434"` (default) |

#### 2.1.7 `filterModels` Tests

| Test Case | Input | Expected |
|---|---|---|
| Filter by id | `([{id:"gpt-4o"},{id:"llama3"}], "gpt")` | `[{id:"gpt-4o"}]` |
| Case-insensitive | `([{id:"GPT-4o"}], "gpt")` | `[{id:"GPT-4o"}]` |
| Filter by name | `([{id:"a/b", name:"Claude"}], "claude")` | Match |
| Empty query | all models, `""` | Returns all |
| No matches | `([{id:"gpt-4o"}], "llama")` | `[]` |
| Partial match | `([{id:"anthropic/claude-sonnet-4"}], "sonnet")` | Match |

---

### Layer 2: Integration Tests (Jest + mocked `requestUrl`)
**Coverage target: API fetch + parse pipeline**
**Runs: CI, local**

Mock `requestUrl` from Obsidian to test `fetchModelsForProvider()` end-to-end without real HTTP calls.

**Approach:**
- Keep `fetchModelsForProvider` in `src/main.ts` but refactor to accept a `fetcher` function parameter (dependency injection)
- OR: move fetch logic to `lib.ts` with a generic `fetcher` parameter instead of importing `requestUrl` directly

**Test file: `integration.test.ts`**

| Test Case | Provider | Validates |
|---|---|---|
| OpenRouter fetch + parse | openrouter | Full pipeline: mock HTTP response -> parsed + sorted ModelInfo[] |
| OpenAI fetch + parse + filter | openai | Mock response -> filtered to chat models only -> sorted |
| Ollama fetch + parse | ollama | Mock response -> parsed local models -> sorted |
| OpenRouter API error | openrouter | Throws with meaningful error message |
| OpenAI missing API key | openai | Throws "API key required" error |
| Ollama connection refused | ollama | Throws with connection error |
| Malformed JSON response | any | Handles gracefully, throws descriptive error |

---

### Layer 3: Manual Smoke Tests (in Obsidian)
**Coverage target: UI, Obsidian API integration, real API calls**
**Runs: Before each release**

These CANNOT be automated without a full Obsidian runtime. Document as a checklist.

**File: `SMOKE_TESTS.md`**

#### Settings UI

- [ ] Plugin appears in Settings > Community Plugins
- [ ] Provider dropdown shows: OpenAI, OpenRouter, Ollama, Custom
- [ ] Switching provider updates conditional settings correctly
- [ ] System prompt textarea accepts and saves multi-line input
- [ ] User prompt template textarea accepts and saves input with `{{selection}}` and `{{context}}`
- [ ] API key fields save correctly (persist after closing/reopening settings)

#### OpenRouter Provider

- [ ] "Browse Models" button opens model picker modal
- [ ] Modal shows loading state, then populates model list
- [ ] Search filters models in real time
- [ ] Clicking a model updates the text input and closes modal
- [ ] Model count shows "X of Y models"
- [ ] API call works without authentication (public endpoint)
- [ ] Selected model persists after closing settings

#### OpenAI Provider

- [ ] API key field is shown and required
- [ ] "Browse Models" button requires API key (shows error if empty)
- [ ] With valid key, fetches and displays only chat models
- [ ] No embeddings/whisper/dall-e models in list

#### Ollama Provider

- [ ] "Browse Models" button fetches from local Ollama instance
- [ ] Shows locally installed models
- [ ] Shows error if Ollama is not running

#### Custom Provider

- [ ] Base URL, Endpoint, and API Key text fields shown
- [ ] No "Browse Models" button (text input only)

#### Core Functionality (Right-Click > Explain)

- [ ] Select text in editor, right-click shows context menu item whose label is derived from `userPromptTemplate` (default: starts with "Explain ..." and ends with "...")
- [ ] Menu item label truncates selection longer than 24 chars
- [ ] Clicking opens modal with selected text as title
- [ ] Response streams in with markdown rendering
- [ ] System prompt from settings is used (verify with a distinctive system prompt)
- [ ] User prompt template with placeholders works correctly
- [ ] Error displays actual API error message and status code
- [ ] Works with each provider: OpenAI, OpenRouter, Ollama, Custom

---

### Layer 4: E2E Tests (Optional, Advanced)
**Coverage target: Full plugin lifecycle in real Obsidian**
**Runs: CI (optional), pre-release**

Use one of these approaches if full automation is desired:

#### Option A: Headless Obsidian + Playwright/Puppeteer
- Based on [obsidian-plugin-e2e-test](https://github.com/trashhalo/obsidian-plugin-e2e-test) pattern
- Run Obsidian in a Docker container or headless Electron
- Use Spectron (deprecated) or Playwright to control the app
- **Pros:** Tests real Obsidian behavior
- **Cons:** Heavy setup, brittle, Obsidian version-dependent

#### Option B: obsidian-jest (community)
- Community mock of Obsidian API for Jest
- Lighter weight, but mocks may drift from real API
- **Pros:** Fast, runs in CI easily
- **Cons:** May not catch real Obsidian quirks

**Recommendation:** Layer 4 is optional. Layers 1-3 provide sufficient coverage for this plugin's scope. Invest in E2E only if the plugin grows significantly.

---

## 3. Test Infrastructure

### Directory Structure

```
├── src/
│   ├── main.ts              # Obsidian-dependent code (plugin, modals, settings UI)
│   └── lib.ts               # Pure logic (no obsidian imports) - TESTABLE
├── tests/
│   ├── lib.test.ts          # Unit tests for lib.ts
│   └── integration.test.ts  # Integration tests with mocked fetcher
├── jest.config.js           # Jest configuration
├── tsconfig.json            # TypeScript config (exclude test files from build)
├── package.json             # Added jest, ts-jest, @types/jest
└── docs/
    ├── TEST_PLAN.md         # This file
    └── SMOKE_TESTS.md       # Manual test checklist
```

### CI Pipeline (GitHub Actions)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npx tsc --noEmit --skipLibCheck
```

### Pre-commit Hook (optional)

```bash
#!/bin/sh
npm test && npx tsc --noEmit --skipLibCheck
```

---

## 4. Coverage Goals

| Layer | Target | Minimum |
|---|---|---|
| Unit (lib.ts) | 100% of pure logic functions | 90% line coverage |
| Integration | All provider fetch paths + error paths | All happy + error paths |
| Smoke | All UI interactions | Full checklist before release |
| E2E | Optional | N/A |

---

## 5. What NOT to Unit Test

These depend on Obsidian's runtime and should only be smoke-tested manually:

- `Plugin.onload()` / `onunload()` lifecycle
- `PluginSettingTab.display()` DOM rendering
- `Modal.onOpen()` / `onClose()` DOM rendering
- `MarkdownRenderer.render()` output
- `editor.getSelection()` / `editor.getCursor()` behavior
- `this.loadData()` / `this.saveData()` persistence
- Context menu registration and display

---

## 6. Testing Philosophy

1. **Separate concerns ruthlessly.** If it does not need `import { ... } from "obsidian"`, it goes in `lib.ts`.
2. **Dependency injection over mocking.** Pass `fetcher` functions rather than mocking `requestUrl` globally.
3. **Manual tests are real tests.** Document them, checklist them, run them. They catch what unit tests cannot.
4. **Test behavior, not implementation.** Test what `buildPrompt` returns, not how it replaces strings internally.
5. **Every bug gets a test.** When a bug is found, write a failing test first, then fix.
