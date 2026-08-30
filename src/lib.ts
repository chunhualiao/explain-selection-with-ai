// lib.ts — Pure logic extracted from main.ts (no Obsidian imports)

export interface ExplainSelectionWithAiPluginSettings {
	dropdownValue: string;
	baseURL: string;
	endpoint: string;
	apiKey: string;
	openRouterModel: string;
	openRouterApiKey: string;
	openRouterReferer: string;
	openRouterTitle: string;
	systemPrompt: string;
	userPromptTemplate: string;
	promptProfile: PromptProfile;
	promptProfileVersion: number;
}

export type PromptProfile = "wikipedia" | "custom";

export const CURRENT_PROMPT_PROFILE_VERSION = 1;
export const LEGACY_SYSTEM_PROMPT = "You are a helpful assistant.";
export const LEGACY_USER_PROMPT_TEMPLATE =
	'Explain "{{selection}}" in the context of "{{context}}"';

export const DEFAULT_SETTINGS: ExplainSelectionWithAiPluginSettings = {
	dropdownValue: "openai",
	baseURL: "https://api.openai.com/v1/",
	endpoint: "gpt-4o-mini",
	apiKey: "",
	openRouterModel: "anthropic/claude-sonnet-4",
	openRouterApiKey: "",
	openRouterReferer: "",
	openRouterTitle: "Obsidian Explain Selection",
	systemPrompt: LEGACY_SYSTEM_PROMPT,
	userPromptTemplate: LEGACY_USER_PROMPT_TEMPLATE,
	promptProfile: "wikipedia",
	promptProfileVersion: CURRENT_PROMPT_PROFILE_VERSION,
};

/**
 * Upgrade legacy settings without overwriting user-authored prompts.
 * Untouched legacy defaults move to the Wikipedia profile; customized prompts
 * remain available through the explicit Custom profile.
 */
export function migrateSettings(
	data: Partial<ExplainSelectionWithAiPluginSettings> | null | undefined
): ExplainSelectionWithAiPluginSettings {
	if (
		data?.promptProfileVersion === CURRENT_PROMPT_PROFILE_VERSION &&
		(data.promptProfile === "wikipedia" || data.promptProfile === "custom")
	) {
		return { ...DEFAULT_SETTINGS, ...data };
	}

	const legacySystemPrompt = data?.systemPrompt ?? LEGACY_SYSTEM_PROMPT;
	const legacyUserPrompt = data?.userPromptTemplate ?? LEGACY_USER_PROMPT_TEMPLATE;
	const promptsAreUntouched =
		legacySystemPrompt === LEGACY_SYSTEM_PROMPT &&
		legacyUserPrompt === LEGACY_USER_PROMPT_TEMPLATE;

	return {
		...DEFAULT_SETTINGS,
		...data,
		systemPrompt: legacySystemPrompt,
		userPromptTemplate: legacyUserPrompt,
		promptProfile: promptsAreUntouched ? "wikipedia" : "custom",
		promptProfileVersion: CURRENT_PROMPT_PROFILE_VERSION,
	};
}

export interface ModelInfo {
	id: string;
	name?: string;
	pricing?: {
		prompt: string;
		completion: string;
	};
}

/**
 * Replace {{selection}} and {{context}} placeholders in a template string.
 */
export function buildPrompt(template: string, selection: string, context: string): string {
	// Use a replacer function to avoid special replacement patterns ($&, $1, etc.)
	return template
		.replace(/\{\{selection\}\}/g, () => selection)
		.replace(/\{\{context\}\}/g, () => context);
}

/**
 * Build a menu label from the user's prompt template.
 * Truncates selection and removes/simplifies context placeholder for display.
 */
export function buildMenuLabel(template: string, selection: string, maxLength = 50): string {
	const truncatedSelection =
		selection.length > 24 ? selection.substring(0, 24) + "..." : selection;
	
	// Replace placeholders - template controls formatting (quotes, etc.)
	let label = template
		.replace(/\{\{selection\}\}/g, () => truncatedSelection)
		.replace(/\{\{context\}\}/g, () => "...");
	
	// Truncate entire label if too long
	if (label.length > maxLength) {
		label = label.substring(0, maxLength - 3) + "...";
	}
	
	return label;
}

/**
 * Determine baseURL, apiKey, model, and optional headers based on provider selection.
 */
export function getProviderConfig(settings: ExplainSelectionWithAiPluginSettings): {
	baseURL: string;
	apiKey: string;
	model: string;
	defaultHeaders?: Record<string, string>;
} {
	const isOpenRouter = settings.dropdownValue === "openrouter";

	const baseURL = isOpenRouter
		? "https://openrouter.ai/api/v1"
		: settings.baseURL;
	const apiKey = isOpenRouter
		? settings.openRouterApiKey
		: settings.apiKey;
	const model = isOpenRouter
		? settings.openRouterModel
		: settings.endpoint;

	const defaultHeaders: Record<string, string> = {};
	if (isOpenRouter) {
		if (settings.openRouterReferer) {
			defaultHeaders["HTTP-Referer"] = settings.openRouterReferer;
		}
		if (settings.openRouterTitle) {
			defaultHeaders["X-Title"] = settings.openRouterTitle;
		}
	}

	return {
		baseURL,
		apiKey: apiKey === "" ? "-" : apiKey,
		model,
		defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
	};
}

/**
 * Filter OpenAI model list to chat models only, sorted alphabetically.
 */
export function filterOpenAIModels(models: Array<{ id: string }>): ModelInfo[] {
	const chatPrefixes = ["gpt-", "o1", "o3", "o4", "chatgpt-"];
	const excludePrefixes = ["dall-e", "tts-", "whisper", "embedding", "text-embedding", "babbage", "davinci"];

	const filtered: ModelInfo[] = models
		.filter((m) => {
			const id = m.id;
			const matchesChat = chatPrefixes.some((p) => id.startsWith(p));
			const excluded = excludePrefixes.some((p) => id.startsWith(p));
			return matchesChat && !excluded;
		})
		.map((m) => ({ id: m.id }));

	filtered.sort((a, b) => a.id.localeCompare(b.id));
	return filtered;
}

/**
 * Parse OpenRouter API response into ModelInfo[], sorted alphabetically.
 */
export function parseOpenRouterModels(data: any): ModelInfo[] {
	const models: ModelInfo[] = ((data && data.data) || []).map((m: any) => ({
		id: m.id,
		name: m.name || undefined,
		pricing: m.pricing?.prompt && m.pricing?.completion
			? { prompt: m.pricing.prompt, completion: m.pricing.completion }
			: undefined,
	}));
	models.sort((a, b) => a.id.localeCompare(b.id));
	return models;
}

/**
 * Parse Ollama API response into ModelInfo[], sorted alphabetically.
 */
export function parseOllamaModels(data: any): ModelInfo[] {
	const models: ModelInfo[] = ((data && data.models) || []).map((m: any) => ({
		id: m.name,
	}));
	models.sort((a, b) => a.id.localeCompare(b.id));
	return models;
}

/**
 * Strip /v1/ suffix from a URL to derive the Ollama base URL.
 */
export function deriveOllamaBaseUrl(baseURL: string): string {
	if (!baseURL) {
		return "http://localhost:11434";
	}
	return baseURL.replace(/\/v1\/?$/, "");
}

/**
 * Filter models by search query (case-insensitive match on id or name).
 */
export function filterModels(models: ModelInfo[], query: string): ModelInfo[] {
	if (!query) {
		return models;
	}
	const lower = query.toLowerCase();
	return models.filter(
		(m) =>
			m.id.toLowerCase().includes(lower) ||
			(m.name && m.name.toLowerCase().includes(lower))
	);
}

/**
 * Sanitize selection into a valid Obsidian filename.
 */
export function sanitizeFileName(name: string): string {
	// Remove forbidden characters: * " \ / < > : | ?
	return name
		.replace(/[*"\\/<>:|?]/g, "")
		.substring(0, 100) // Truncate to reasonable length
		.trim() || "AI Explanation";
}
