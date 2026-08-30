import {
  ExplainSelectionWithAiPluginSettings,
  DEFAULT_SETTINGS,
  buildPrompt,
  buildMenuLabel,
  getProviderConfig,
  filterOpenAIModels,
  parseOpenRouterModels,
  parseOllamaModels,
  deriveOllamaBaseUrl,
  filterModels,
  sanitizeFileName,
  ModelInfo,
} from "../src/lib";

// Helper to create settings with overrides
function makeSettings(overrides: Partial<ExplainSelectionWithAiPluginSettings> = {}): ExplainSelectionWithAiPluginSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

// ─── buildPrompt ────────────────────────────────────────────────

describe("buildPrompt", () => {
  it("replaces both {{selection}} and {{context}}", () => {
    const result = buildPrompt('Explain "{{selection}}" in "{{context}}"', "foo", "bar");
    expect(result).toBe('Explain "foo" in "bar"');
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    const result = buildPrompt("{{selection}} and {{selection}}", "X", "Y");
    expect(result).toBe("X and X");
  });

  it("handles empty selection and context", () => {
    const result = buildPrompt("sel={{selection}} ctx={{context}}", "", "");
    expect(result).toBe("sel= ctx=");
  });

  it("passes through template with no placeholders", () => {
    expect(buildPrompt("no placeholders here", "a", "b")).toBe("no placeholders here");
  });

  it("handles special characters (quotes, newlines, regex chars)", () => {
    const sel = 'he said "hello"\nnewline $1 (parens) [brackets]';
    const ctx = "context with $& and \\1";
    const result = buildPrompt("{{selection}} | {{context}}", sel, ctx);
    expect(result).toBe(`${sel} | ${ctx}`);
  });
});

// ─── buildMenuLabel ─────────────────────────────────────────────

describe("buildMenuLabel", () => {
  it("builds label from template with short selection", () => {
    const result = buildMenuLabel('Explain "{{selection}}" in context', "hello");
    expect(result).toBe('Explain "hello" in context');
  });

  it("truncates long selection to 24 chars", () => {
    const longSelection = "this is a very long selection that exceeds the limit";
    const result = buildMenuLabel('Explain "{{selection}}"', longSelection);
    expect(result).toBe('Explain "this is a very long sele..."');
  });

  it("replaces {{context}} with ellipsis", () => {
    const result = buildMenuLabel('{{selection}} in {{context}}', "test");
    expect(result).toBe('test in ...');
  });

  it("truncates entire label if too long", () => {
    const result = buildMenuLabel(
      'This is a very long template with {{selection}} and more text here',
      "word",
      30
    );
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith("...")).toBe(true);
  });

  it("handles template without placeholders", () => {
    const result = buildMenuLabel("Static menu label", "ignored");
    expect(result).toBe("Static menu label");
  });
});

// ─── getProviderConfig ──────────────────────────────────────────

describe("getProviderConfig", () => {
  it("returns correct config for OpenAI provider", () => {
    const settings = makeSettings({
      dropdownValue: "openai",
      baseURL: "https://api.openai.com/v1/",
      apiKey: "sk-test",
      endpoint: "gpt-4o",
    });
    const config = getProviderConfig(settings);
    expect(config.baseURL).toBe("https://api.openai.com/v1/");
    expect(config.apiKey).toBe("sk-test");
    expect(config.model).toBe("gpt-4o");
    expect(config.defaultHeaders).toBeUndefined();
  });

  it("returns correct config for OpenRouter provider with headers", () => {
    const settings = makeSettings({
      dropdownValue: "openrouter",
      openRouterApiKey: "sk-or-test",
      openRouterModel: "anthropic/claude-sonnet-4",
      openRouterReferer: "https://my-site.com",
      openRouterTitle: "My App",
    });
    const config = getProviderConfig(settings);
    expect(config.baseURL).toBe("https://openrouter.ai/api/v1");
    expect(config.apiKey).toBe("sk-or-test");
    expect(config.model).toBe("anthropic/claude-sonnet-4");
    expect(config.defaultHeaders).toEqual({
      "HTTP-Referer": "https://my-site.com",
      "X-Title": "My App",
    });
  });

  it("omits headers when OpenRouter referer/title are empty", () => {
    const settings = makeSettings({
      dropdownValue: "openrouter",
      openRouterApiKey: "sk-or-test",
      openRouterModel: "model",
      openRouterReferer: "",
      openRouterTitle: "",
    });
    const config = getProviderConfig(settings);
    expect(config.defaultHeaders).toBeUndefined();
  });

  it("includes only provided OpenRouter headers", () => {
    const settings = makeSettings({
      dropdownValue: "openrouter",
      openRouterApiKey: "key",
      openRouterModel: "m",
      openRouterReferer: "https://ref.com",
      openRouterTitle: "",
    });
    const config = getProviderConfig(settings);
    expect(config.defaultHeaders).toEqual({ "HTTP-Referer": "https://ref.com" });
  });

  it("returns correct config for Ollama provider", () => {
    const settings = makeSettings({
      dropdownValue: "ollama",
      baseURL: "http://localhost:11434/v1/",
      endpoint: "llama3",
      apiKey: "",
    });
    const config = getProviderConfig(settings);
    expect(config.baseURL).toBe("http://localhost:11434/v1/");
    expect(config.apiKey).toBe("-");
    expect(config.model).toBe("llama3");
    expect(config.defaultHeaders).toBeUndefined();
  });

  it("returns correct config for custom provider", () => {
    const settings = makeSettings({
      dropdownValue: "custom",
      baseURL: "https://custom.api/v1",
      endpoint: "my-model",
      apiKey: "custom-key",
    });
    const config = getProviderConfig(settings);
    expect(config.baseURL).toBe("https://custom.api/v1");
    expect(config.apiKey).toBe("custom-key");
    expect(config.model).toBe("my-model");
  });

  it("returns '-' when apiKey is empty (non-OpenRouter)", () => {
    const settings = makeSettings({
      dropdownValue: "openai",
      apiKey: "",
    });
    expect(getProviderConfig(settings).apiKey).toBe("-");
  });
});

// ─── filterOpenAIModels ─────────────────────────────────────────

describe("filterOpenAIModels", () => {
  it("keeps gpt- models", () => {
    const models = [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }, { id: "gpt-3.5-turbo" }];
    const result = filterOpenAIModels(models);
    expect(result.map((m) => m.id)).toEqual(["gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"]);
  });

  it("keeps o1, o3 models", () => {
    const models = [{ id: "o1-mini" }, { id: "o1-preview" }, { id: "o3-mini" }];
    const result = filterOpenAIModels(models);
    expect(result).toHaveLength(3);
  });

  it("excludes dall-e, tts, whisper, embedding models", () => {
    const models = [
      { id: "gpt-4o" },
      { id: "dall-e-3" },
      { id: "tts-1" },
      { id: "whisper-1" },
      { id: "text-embedding-ada-002" },
      { id: "embedding-v1" },
      { id: "babbage-002" },
      { id: "davinci-002" },
    ];
    const result = filterOpenAIModels(models);
    expect(result).toEqual([{ id: "gpt-4o" }]);
  });

  it("returns sorted results", () => {
    const models = [{ id: "gpt-4o" }, { id: "chatgpt-4o-latest" }, { id: "gpt-3.5-turbo" }];
    const result = filterOpenAIModels(models);
    expect(result.map((m) => m.id)).toEqual(["chatgpt-4o-latest", "gpt-3.5-turbo", "gpt-4o"]);
  });

  it("handles empty input", () => {
    expect(filterOpenAIModels([])).toEqual([]);
  });
});

// ─── parseOpenRouterModels ──────────────────────────────────────

describe("parseOpenRouterModels", () => {
  it("parses valid response with id and name", () => {
    const data = {
      data: [
        { id: "anthropic/claude-3", name: "Claude 3" },
        { id: "openai/gpt-4", name: "GPT-4" },
      ],
    };
    const result = parseOpenRouterModels(data);
    expect(result).toEqual([
      { id: "anthropic/claude-3", name: "Claude 3" },
      { id: "openai/gpt-4", name: "GPT-4" },
    ]);
  });

  it("handles missing name field", () => {
    const data = { data: [{ id: "model-1" }] };
    const result = parseOpenRouterModels(data);
    expect(result).toEqual([{ id: "model-1", name: undefined }]);
  });

  it("returns sorted results", () => {
    const data = {
      data: [
        { id: "z-model", name: "Z" },
        { id: "a-model", name: "A" },
      ],
    };
    const result = parseOpenRouterModels(data);
    expect(result[0].id).toBe("a-model");
    expect(result[1].id).toBe("z-model");
  });

  it("handles empty data array", () => {
    expect(parseOpenRouterModels({ data: [] })).toEqual([]);
  });

  it("handles missing data field", () => {
    expect(parseOpenRouterModels({})).toEqual([]);
  });
});

// ─── parseOllamaModels ─────────────────────────────────────────

describe("parseOllamaModels", () => {
  it("parses valid response", () => {
    const data = { models: [{ name: "llama3" }, { name: "mistral" }] };
    const result = parseOllamaModels(data);
    expect(result).toEqual([{ id: "llama3" }, { id: "mistral" }]);
  });

  it("returns sorted results", () => {
    const data = { models: [{ name: "zebra" }, { name: "alpha" }] };
    const result = parseOllamaModels(data);
    expect(result[0].id).toBe("alpha");
  });

  it("handles empty models array", () => {
    expect(parseOllamaModels({ models: [] })).toEqual([]);
  });

  it("handles missing models field", () => {
    expect(parseOllamaModels({})).toEqual([]);
  });
});

// ─── deriveOllamaBaseUrl ────────────────────────────────────────

describe("deriveOllamaBaseUrl", () => {
  it("strips /v1/ suffix", () => {
    expect(deriveOllamaBaseUrl("http://localhost:11434/v1/")).toBe("http://localhost:11434");
  });

  it("strips /v1 suffix (no trailing slash)", () => {
    expect(deriveOllamaBaseUrl("http://localhost:11434/v1")).toBe("http://localhost:11434");
  });

  it("returns default localhost if empty", () => {
    expect(deriveOllamaBaseUrl("")).toBe("http://localhost:11434");
  });

  it("handles URL without /v1/", () => {
    expect(deriveOllamaBaseUrl("http://myhost:1234")).toBe("http://myhost:1234");
  });
});

// ─── filterModels ───────────────────────────────────────────────

describe("filterModels", () => {
  const models: ModelInfo[] = [
    { id: "gpt-4o", name: "GPT 4o" },
    { id: "claude-3", name: "Claude Three" },
    { id: "llama3" },
  ];

  it("filters by id match (case-insensitive)", () => {
    const result = filterModels(models, "GPT");
    expect(result).toEqual([{ id: "gpt-4o", name: "GPT 4o" }]);
  });

  it("filters by name match (case-insensitive)", () => {
    const result = filterModels(models, "three");
    expect(result).toEqual([{ id: "claude-3", name: "Claude Three" }]);
  });

  it("empty query returns all models", () => {
    expect(filterModels(models, "")).toEqual(models);
  });

  it("no matches returns empty array", () => {
    expect(filterModels(models, "nonexistent")).toEqual([]);
  });

  it("partial match works", () => {
    const result = filterModels(models, "lam");
    expect(result).toEqual([{ id: "llama3" }]);
  });
});

// ─── sanitizeFileName ──────────────────────────────────────────

describe("sanitizeFileName", () => {
  it("removes forbidden characters", () => {
    expect(sanitizeFileName('test:*?"<>|/\\name')).toBe("testname");
  });

  it("truncates long names", () => {
    const longName = "a".repeat(200);
    expect(sanitizeFileName(longName).length).toBe(100);
  });

  it("handles empty or forbidden-only names", () => {
    expect(sanitizeFileName(":::")).toBe("AI Explanation");
    expect(sanitizeFileName("")).toBe("AI Explanation");
  });
});
