# Smoke Tests: Explain Selection With AI

Run these manually in Obsidian before each release.

## Settings UI

- [ ] Plugin appears in Settings > Community Plugins
- [ ] Provider dropdown shows: OpenAI, OpenRouter, Ollama, Custom
- [ ] Switching provider updates conditional settings correctly
- [ ] System prompt textarea accepts and saves multi-line input
- [ ] User prompt template textarea saves input with `{{selection}}` and `{{context}}`
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
- [ ] Custom system prompt is used
- [ ] User prompt template with placeholders works
- [ ] Error displays actual API error message and status code
- [ ] Works with: OpenAI, OpenRouter, Ollama, Custom
