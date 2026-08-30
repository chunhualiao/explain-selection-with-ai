# Smoke Tests: Explain Selection With AI

Run these manually in Obsidian before each release.

## Settings UI

- [ ] Plugin appears in Settings > Community Plugins
- [ ] Provider dropdown shows: OpenAI, OpenRouter, Ollama, Custom
- [ ] Switching provider updates conditional settings correctly
- [ ] Article profile defaults to "Wikipedia (recommended)"
- [ ] Switching to Custom shows the legacy system and user prompt fields
- [ ] Existing customized prompts migrate to Custom without losing their values
- [ ] API key fields persist after closing/reopening settings

## OpenRouter Provider

- [ ] "Browse Models" button opens model picker modal
- [ ] Modal shows loading state, then populates model list
- [ ] Search filters models in real time
- [ ] Clicking a model updates the text input and closes modal
- [ ] Model count shows "X of Y models"
- [ ] API call works without authentication
- [ ] Selected model persists after closing settings

## OpenAI Provider

- [ ] API key field is shown and required
- [ ] "Browse Models" button shows error if API key is empty
- [ ] With valid key, fetches and displays only chat models
- [ ] No embeddings/whisper/dall-e models in list

## Ollama Provider

- [ ] "Browse Models" button fetches from local Ollama
- [ ] Shows locally installed models
- [ ] Shows error if Ollama is not running

## Custom Provider

- [ ] Base URL, Endpoint, and API Key text fields shown
- [ ] No "Browse Models" button

## Core Functionality

- [ ] Select text, right-click shows context menu label starting with "Explain ..." (template-driven; wording may vary if prompt/template is customized)
- [ ] Menu label truncates selection >24 chars
- [ ] Modal opens with selected text as title
- [ ] Response streams in with markdown rendering
- [ ] Wikipedia status progresses through resolving, writing, and validating
- [ ] Output contains Origin and history, Definition, Key concepts, and Applications sections
- [ ] Output is neutral and does not mention the selected passage, source note, author, or surrounding context
- [ ] Ambiguous terms (Python, bank, Jaguar) resolve to the sense indicated by context
- [ ] Context containing a unique sentinel, opinion, or instruction does not appear in the article
- [ ] A quality failure triggers one repair and a second validation
- [ ] Custom mode uses the saved legacy system prompt and placeholder template
- [ ] Error displays actual API error message and status code
- [ ] Works with: OpenAI, OpenRouter, Ollama, Custom
