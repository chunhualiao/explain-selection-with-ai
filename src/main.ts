import {
	App,
	Modal,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownRenderer,
	requestUrl,
	Editor,
	Notice,
} from "obsidian";
import OpenAI from "openai";
import {
	ExplainSelectionWithAiPluginSettings,
	DEFAULT_SETTINGS,
	ModelInfo,
	buildPrompt,
	buildMenuLabel,
	getProviderConfig,
	filterOpenAIModels,
	parseOpenRouterModels,
	parseOllamaModels,
	deriveOllamaBaseUrl,
	filterModels,
	sanitizeFileName,
} from "./lib";

// In-memory model cache per provider
const modelCache: Record<string, ModelInfo[]> = {};

async function fetchModelsForProvider(
	provider: string,
	apiKey?: string,
	baseURL?: string
): Promise<ModelInfo[]> {
	if (modelCache[provider]) return modelCache[provider];

	let models: ModelInfo[];
	switch (provider) {
		case "openrouter": {
			const response = await requestUrl({
				url: "https://openrouter.ai/api/v1/models",
				method: "GET",
			});
			models = parseOpenRouterModels(response.json);
			break;
		}
		case "openai": {
			if (!apiKey) {
				throw new Error("OpenAI API key is required to fetch models.");
			}
			const response = await requestUrl({
				url: "https://api.openai.com/v1/models",
				method: "GET",
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			});
			models = filterOpenAIModels(response.json.data || []);
			break;
		}
		case "ollama": {
			const ollamaUrl = deriveOllamaBaseUrl(baseURL || "");
			const response = await requestUrl({
				url: `${ollamaUrl}/api/tags`,
				method: "GET",
			});
			models = parseOllamaModels(response.json);
			break;
		}
		default:
			throw new Error(`No model fetching for provider: ${provider}`);
	}
	
	// Cache the fetched models
	modelCache[provider] = models;
	return models;
}

class ModelPickerModal extends Modal {
	private provider: string;
	private apiKey?: string;
	private baseURL?: string;
	private onSelect: (modelId: string) => void;

	constructor(
		app: App,
		provider: string,
		onSelect: (modelId: string) => void,
		apiKey?: string,
		baseURL?: string
	) {
		super(app);
		this.provider = provider;
		this.onSelect = onSelect;
		this.apiKey = apiKey;
		this.baseURL = baseURL;
	}

	async onOpen() {
		const { contentEl } = this;
		this.setTitle("Select Model");

		// Inject styles
		const style = document.createElement("style");
		style.textContent = `
			.model-picker-search {
				width: 100%;
				padding: 8px 12px;
				margin-bottom: 8px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
				background: var(--background-primary);
				color: var(--text-normal);
				font-size: 14px;
			}
			.model-picker-search:focus {
				border-color: var(--interactive-accent);
				outline: none;
			}
			.model-picker-list {
				max-height: 400px;
				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
				border-radius: 6px;
			}
			.model-picker-item {
				padding: 8px 12px;
				cursor: pointer;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			.model-picker-item:last-child {
				border-bottom: none;
			}
			.model-picker-item:hover {
				background: var(--background-modifier-hover);
			}
			.model-picker-item-id {
				font-weight: 500;
				color: var(--text-normal);
				font-size: 13px;
			}
			.model-picker-item-name {
				font-size: 11px;
				color: var(--text-muted);
				margin-top: 2px;
			}
			.model-picker-status {
				padding: 16px;
				text-align: center;
				color: var(--text-muted);
			}
			.model-picker-error {
				padding: 16px;
				text-align: center;
				color: var(--text-error);
			}
			.model-picker-count {
				font-size: 11px;
				color: var(--text-muted);
				margin-bottom: 4px;
			}
		`;
		contentEl.appendChild(style);

		const searchInput = contentEl.createEl("input", {
			cls: "model-picker-search",
			attr: { type: "text", placeholder: "Search models..." },
		});

		const countEl = contentEl.createEl("div", { cls: "model-picker-count" });
		const listEl = contentEl.createEl("div", { cls: "model-picker-list" });

		// Show loading
		listEl.createEl("div", {
			cls: "model-picker-status",
			text: "Loading models...",
		});

		let allModels: ModelInfo[] = [];

		const renderModels = (filter: string) => {
			listEl.empty();
			const filtered = filterModels(allModels, filter);

			countEl.setText(`${filtered.length} of ${allModels.length} models`);

			if (filtered.length === 0) {
				listEl.createEl("div", {
					cls: "model-picker-status",
					text: filter ? "No models match your search." : "No models found.",
				});
				return;
			}

			for (const model of filtered) {
				const item = listEl.createEl("div", { cls: "model-picker-item" });
				item.createEl("div", {
					cls: "model-picker-item-id",
					text: model.id,
				});
				if (model.name && model.name !== model.id) {
					item.createEl("div", {
						cls: "model-picker-item-name",
						text: model.name,
					});
				}
				item.addEventListener("click", () => {
					this.onSelect(model.id);
					this.close();
				});
			}
		};

		try {
			allModels = await fetchModelsForProvider(
				this.provider,
				this.apiKey,
				this.baseURL
			);
			renderModels("");
		} catch (err: unknown) {
			listEl.empty();
			const errMsg =
				err instanceof Error ? err.message : "Failed to fetch models.";
			listEl.createEl("div", {
				cls: "model-picker-error",
				text: `Error: ${errMsg}`,
			});
			countEl.setText("");
		}

		searchInput.addEventListener("input", () => {
			renderModels(searchInput.value);
		});

		// Auto-focus search
		searchInput.focus();
	}

	onClose() {
		this.contentEl.empty();
	}
}

export default class ExplainSelectionWithAiPlugin extends Plugin {
	settings: ExplainSelectionWithAiPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "explain-selection-with-ai",
			name: "Explain selection with AI",
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice("Select some text first");
					return;
				}
				this.openExplainModal(editor, selection);
			},
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				menu.addItem((item) => {
					const selection = editor.getSelection();
					if (!selection) return;

					const menuLabel = buildMenuLabel(
						this.settings.userPromptTemplate,
						selection
					);
					item.setTitle(menuLabel)
						.setIcon("document")
						.onClick(async () => {
							const sel = editor.getSelection();
							if (!sel) return;
							this.openExplainModal(editor, sel);
						});
				});
			})
		);

		this.addSettingTab(new ExplainSelectionWithAiSettingTab(this.app, this));
	}

	onunload() {}

	private openExplainModal(editor: Editor, selection: string) {
		const cursor = editor.getCursor();
		const lineText = editor
			.getLine(cursor.line)
			.substring(
				cursor.ch - 500 > 0 ? cursor.ch - 500 : 0,
				cursor.ch + 500 <
					editor.getLine(cursor.line).length
					? cursor.ch + 500
					: editor.getLine(cursor.line).length
			);

		const providerConfig = getProviderConfig(this.settings);

		const openai = new OpenAI({
			baseURL: providerConfig.baseURL,
			apiKey: providerConfig.apiKey,
			dangerouslyAllowBrowser: true,
			defaultHeaders: providerConfig.defaultHeaders,
		});

		const modal = new ExplainSelectionWithAiModal(
			this.app,
			openai,
			providerConfig.model,
			selection,
			lineText,
			this,
			editor
		);
		modal.open();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export class ExplainSelectionWithAiModal extends Modal {
	userSelection: string;
	selectionContext: string;
	openai: OpenAI;
	endpoint: string;
	app: App;
	plugin: ExplainSelectionWithAiPlugin;
	editor: Editor;

	constructor(
		app: App,
		openai: OpenAI,
		endpoint: string,
		userSelection: string,
		selectionContext: string,
		plugin: ExplainSelectionWithAiPlugin,
		editor: Editor
	) {
		super(app);

		this.app = app;
		this.plugin = plugin;
		this.userSelection = userSelection;
		this.selectionContext = selectionContext;
		this.openai = openai;
		this.endpoint = endpoint;
		this.editor = editor;

		this.setTitle(userSelection);
	}

	async onOpen() {
		const { contentEl } = this;

		let rollingText = "";
		let promptTokens = 0;
		let completionTokens = 0;
		const startTime = Date.now();
		let firstTokenTime: number | null = null;
		let lastRenderTime = 0;
		const RENDER_THROTTLE_MS = 50; // Throttle rendering to avoid UI lock on long outputs

		const contentBox = contentEl.createEl("div", { cls: "selectable_text" });

		// Action row starts fully hidden (display:none) so no border/padding/space
		// is visible while the AI streams. We show it only after streaming completes.
		const actionRow = contentEl.createEl("div", {
			attr: {
				style: "display: none; gap: 10px; margin-top: 20px; padding-top: 15px; padding-bottom: 5px; border-top: 1px solid var(--background-modifier-border); align-items: center;",
			},
		});

		const saveButton = actionRow.createEl("button", {
			text: "Save as Note & Link",
			cls: "mod-cta",
		});

		try {
			const systemPrompt = this.plugin.settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt;
			const userPromptTemplate = this.plugin.settings.userPromptTemplate || DEFAULT_SETTINGS.userPromptTemplate;
			const userPrompt = buildPrompt(userPromptTemplate, this.userSelection, this.selectionContext);

			const completion = await this.openai.chat.completions.create({
				model: this.endpoint,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				stream: true,
				stream_options: { include_usage: true } as any,
			});

			for await (const chunk of completion) {
				if (chunk.choices[0]?.delta?.content) {
					if (firstTokenTime === null) {
						firstTokenTime = Date.now();
					}
					rollingText += chunk.choices[0].delta.content;
					
					// Throttle rendering to avoid UI lock on long outputs
					const now = Date.now();
					if (now - lastRenderTime >= RENDER_THROTTLE_MS) {
						contentBox.empty();
						MarkdownRenderer.render(this.app, rollingText, contentBox, "/", this.plugin);
						lastRenderTime = now;
					}
				}

				if ((chunk as any).usage) {
					promptTokens = (chunk as any).usage.prompt_tokens;
					completionTokens = (chunk as any).usage.completion_tokens;
				}
			}
			
			// Final render to ensure all content is displayed
			contentBox.empty();
			MarkdownRenderer.render(this.app, rollingText, contentBox, "/", this.plugin);

			const endTime = Date.now();
			const totalDuration = endTime - startTime;
			const ttft = firstTokenTime ? firstTokenTime - startTime : 0;
			const tps = completionTokens > 0 ? (completionTokens / (totalDuration / 1000)).toFixed(2) : "0.00";

			// Build metadata block -- always include model & timing;
			// tokens/cost only when the provider returned usage data.
			let tokenInfo = "";
			let costInfo = "";
			if (promptTokens > 0 || completionTokens > 0) {
				tokenInfo = `\n- **Tokens:** ${promptTokens + completionTokens} (${promptTokens} prompt, ${completionTokens} completion)`;

				const provider = this.plugin.settings.dropdownValue;
				const cachedModels = modelCache[provider] || [];
				const modelInfo = cachedModels.find(m => m.id === this.endpoint);
				if (modelInfo?.pricing) {
					const pRate = parseFloat(modelInfo.pricing.prompt);
					const cRate = parseFloat(modelInfo.pricing.completion);
					const totalCost = (promptTokens * pRate) + (completionTokens * cRate);
					costInfo = `\n- **Cost:** $${totalCost.toFixed(6)}`;
				}
			}

			const speedInfo = completionTokens > 0
				? `, Speed: ${tps} tok/s`
				: "";
			const timingInfo = `\n- **Timing:** ${(totalDuration / 1000).toFixed(2)}s total (TTFT: ${ttft}ms${speedInfo})`;
			const metadata = `\n\n---\n**Metadata**\n- **Model:** ${this.endpoint}${tokenInfo}${costInfo}${timingInfo}\n- **Date:** ${new Date().toISOString()}`;

			// Re-render content with metadata visible in the modal
			const fullText = rollingText + metadata;
			contentBox.empty();
			MarkdownRenderer.render(this.app, fullText, contentBox, "/", this.plugin);

			// Show the entire action row (was display:none)
			actionRow.style.display = "flex";
			saveButton.addEventListener("click", async () => {
				const fileName = sanitizeFileName(this.userSelection);
				const activeFile = this.app.workspace.getActiveFile();
				let parentPath = "";
				if (activeFile && activeFile.parent) {
					parentPath = activeFile.parent.path;
					if (parentPath === "/") parentPath = "";
				}

				const fullPath = parentPath
					? `${parentPath}/${fileName}.md`
					: `${fileName}.md`;

				try {
					const exists = await this.app.vault.adapter.exists(fullPath);

					if (exists) {
						// Note already exists — let the user choose
						const choiceEl = contentEl.createEl("div", {
							attr: {
								style: "margin-top: 15px; padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background-color: var(--background-secondary);",
							},
						});
						choiceEl.createEl("p", {
							text: `A note named "${fileName}.md" already exists.`,
							attr: { style: "margin: 0 0 10px 0; font-weight: bold;" },
						});
						const btnRow = choiceEl.createEl("div", {
							attr: { style: "display: flex; gap: 10px;" },
						});

						const handleChoice = async (mode: "append" | "new") => {
							choiceEl.remove();
							try {
								let finalPath = fullPath;
								if (mode === "append") {
									const existing = await this.app.vault.adapter.read(fullPath);
									const separator = "\n\n---\n\n";
									await this.app.vault.adapter.write(fullPath, existing + separator + fullText);
									new Notice(`Appended to ${fullPath}`);
								} else {
									let counter = 1;
									while (await this.app.vault.adapter.exists(finalPath)) {
										finalPath = parentPath
											? `${parentPath}/${fileName} ${counter}.md`
											: `${fileName} ${counter}.md`;
										counter++;
									}
									await this.app.vault.create(finalPath, fullText);
									new Notice(`Saved to ${finalPath}`);
								}
								const linkName = finalPath.replace(/\.md$/, "");
								const alias = this.userSelection ?? "";
								const hasProblemChars =
									alias.length === 0 ||
									alias.includes("|") ||
									alias.includes("]") ||
									alias.includes("\n");
								const wikiLink = hasProblemChars
									? `[[${linkName}]]`
									: `[[${linkName}|${alias}]]`;
								this.editor.replaceSelection(wikiLink);
								this.close();
							} catch (err) {
								new Notice("Failed to save note.");
								console.error(err);
							}
						};

						const appendBtn = btnRow.createEl("button", {
							text: "Append to existing",
							cls: "mod-cta",
						});
						appendBtn.addEventListener("click", () => handleChoice("append"));

						const newBtn = btnRow.createEl("button", {
							text: "Create numbered copy",
						});
						newBtn.addEventListener("click", () => handleChoice("new"));
						return;
					}

					await this.app.vault.create(fullPath, fullText);
					new Notice(`Saved to ${fullPath}`);

					const linkName = fullPath.replace(/\.md$/, "");
					const selectionAlias = this.userSelection;
					const hasUnsafeAliasChars =
						!selectionAlias || /[|\]\n\r]/.test(selectionAlias);
					const wikiLink = hasUnsafeAliasChars
						? `[[${linkName}]]`
						: `[[${linkName}|${selectionAlias}]]`;
					this.editor.replaceSelection(wikiLink);

					this.close();
				} catch (err) {
					new Notice("Failed to save note.");
					console.error(err);
				}
			});
		} catch (err: unknown) {
			contentBox.toggleClass("selectable_text", false);

			const content = contentBox.createEl("p");
			let errorMessage = "There was an issue with the request. Please ensure plugin configuration settings are correct and try again.";

			if (err instanceof Error) {
				errorMessage += `\n\nError: ${err.message}`;
			}
			if (err && typeof err === "object" && "status" in err) {
				errorMessage += ` (Status: ${(err as { status: number }).status})`;
			}

			content.setText(errorMessage);
			content.toggleClass("error_text", true);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ExplainSelectionWithAiSettingTab extends PluginSettingTab {
	plugin: ExplainSelectionWithAiPlugin;

	constructor(app: App, plugin: ExplainSelectionWithAiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("LLM provider")
			.setDesc(
				"Select the LLM provider you want to use."
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("openai", "OpenAI (remote)")
					.addOption("openrouter", "OpenRouter")
					.addOption("ollama", "Ollama (local)")
					.addOption("custom", "Custom")
					.setValue(this.plugin.settings.dropdownValue)
					.onChange(async (value) => {
						this.plugin.settings.dropdownValue = value;
						if (value === "custom") {
							this.plugin.settings.baseURL = "";
							this.plugin.settings.endpoint = "";
							this.plugin.settings.apiKey = "";
						} else if (value === "openai") {
							this.plugin.settings.baseURL = "https://api.openai.com/v1/";
							this.plugin.settings.endpoint = "gpt-4o-mini";
							this.plugin.settings.apiKey = "";
						} else if (value === "ollama") {
							this.plugin.settings.baseURL = "http://localhost:11434/v1/";
							this.plugin.settings.endpoint = "llama3";
							this.plugin.settings.apiKey = "";
						} else if (value === "openrouter") {
							this.plugin.settings.baseURL = "https://openrouter.ai/api/v1";
						}
						await this.plugin.saveSettings();
						this.displayConditionalSettings(containerEl);
					});
			});

		// Prompt settings
		new Setting(containerEl)
			.setName("System prompt")
			.setDesc("The system prompt sent to the LLM.")
			.addTextArea((text) => {
				text
					.setPlaceholder("You are a helpful assistant.")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 3;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName("User prompt template")
			.setDesc("Template for the user prompt. Use {{selection}} and {{context}} as placeholders.")
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_SETTINGS.userPromptTemplate)
					.setValue(this.plugin.settings.userPromptTemplate)
					.onChange(async (value) => {
						this.plugin.settings.userPromptTemplate = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 3;
				text.inputEl.cols = 50;
			});

		this.displayConditionalSettings(containerEl);
	}

	private createModelSettingWithBrowse(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		placeholder: string,
		getValue: () => string,
		setValue: (v: string) => Promise<void>,
		provider: string,
		getApiKey?: () => string,
		getBaseURL?: () => string
	) {
		const setting = new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.setClass("conditional-setting");

		let textInputEl: HTMLInputElement;

		setting.addText((text) => {
			text
				.setPlaceholder(placeholder)
				.setValue(getValue())
				.onChange(async (value) => {
					await setValue(value);
				});
			textInputEl = text.inputEl;
		});

		setting.addButton((button) => {
			button.setButtonText("Browse Models").onClick(() => {
				const modal = new ModelPickerModal(
					this.app,
					provider,
					async (modelId: string) => {
						textInputEl.value = modelId;
						textInputEl.dispatchEvent(new Event("input"));
						await setValue(modelId);
					},
					getApiKey ? getApiKey() : undefined,
					getBaseURL ? getBaseURL() : undefined
				);
				modal.open();
			});
		});

		return setting;
	}

	displayConditionalSettings(containerEl: HTMLElement) {
		const existingConditionalSettings = containerEl.querySelectorAll('.conditional-setting');
		existingConditionalSettings.forEach(setting => setting.remove());

		if (this.plugin.settings.dropdownValue === 'openai') {
			new Setting(containerEl)
				.setName('API Key')
				.setDesc('Enter your OpenAI API key. (required)')
				.addText(text => {
					text
						.setPlaceholder("sk-...")
						.setValue(this.plugin.settings.apiKey)
						.onChange(async (value) => {
							this.plugin.settings.apiKey = value;
							await this.plugin.saveSettings();
						});
				})
				.setClass('conditional-setting');

			this.createModelSettingWithBrowse(
				containerEl,
				"OpenAI model",
				"Select or type the OpenAI model you want to use.",
				"gpt-4o-mini",
				() => this.plugin.settings.endpoint,
				async (v) => {
					this.plugin.settings.endpoint = v;
					await this.plugin.saveSettings();
				},
				"openai",
				() => this.plugin.settings.apiKey
			);

		} else if (this.plugin.settings.dropdownValue === 'openrouter') {
			new Setting(containerEl)
				.setName('OpenRouter API Key')
				.setDesc('Enter your OpenRouter API key. (required)')
				.addText(text => {
					text
						.setPlaceholder("sk-or-...")
						.setValue(this.plugin.settings.openRouterApiKey)
						.onChange(async (value) => {
							this.plugin.settings.openRouterApiKey = value;
							await this.plugin.saveSettings();
						});
				})
				.setClass('conditional-setting');

			this.createModelSettingWithBrowse(
				containerEl,
				"Model",
				"Select or type the OpenRouter model name.",
				"anthropic/claude-sonnet-4",
				() => this.plugin.settings.openRouterModel,
				async (v) => {
					this.plugin.settings.openRouterModel = v;
					await this.plugin.saveSettings();
				},
				"openrouter"
			);

			new Setting(containerEl)
				.setName('HTTP-Referer (optional)')
				.setDesc('Your site URL for OpenRouter app attribution and rankings.')
				.addText(text => {
					text
						.setPlaceholder("https://your-site.com")
						.setValue(this.plugin.settings.openRouterReferer)
						.onChange(async (value) => {
							this.plugin.settings.openRouterReferer = value;
							await this.plugin.saveSettings();
						});
				})
				.setClass('conditional-setting');
			new Setting(containerEl)
				.setName('X-Title (optional)')
				.setDesc('Your app name for OpenRouter attribution.')
				.addText(text => {
					text
						.setPlaceholder("Obsidian Explain Selection")
						.setValue(this.plugin.settings.openRouterTitle)
						.onChange(async (value) => {
							this.plugin.settings.openRouterTitle = value;
							await this.plugin.saveSettings();
						});
				})
				.setClass('conditional-setting');

		} else if (this.plugin.settings.dropdownValue === 'ollama') {
			this.createModelSettingWithBrowse(
				containerEl,
				"Ollama model",
				"Select or type the Ollama model you want to use. Make sure Ollama is running.",
				"llama3",
				() => this.plugin.settings.endpoint,
				async (v) => {
					this.plugin.settings.endpoint = v;
					await this.plugin.saveSettings();
				},
				"ollama",
				undefined,
				() => this.plugin.settings.baseURL
			);

		} else if (this.plugin.settings.dropdownValue === 'custom') {
			new Setting(containerEl)
				.setName('Base URL')
				.setDesc('Enter your custom base URL.')
				.addText(text => {
					text
						.setValue(this.plugin.settings.baseURL)
						.onChange(async (value) => {
							this.plugin.settings.baseURL = value;
							await this.plugin.saveSettings();
						});
				})
				.setClass('conditional-setting');

			new Setting(containerEl)
				.setName('Endpoint')
				.setDesc('Enter your custom endpoint / model name.')
				.addText(text => {
					text
						.setValue(this.plugin.settings.endpoint)
						.onChange(async (value) => {
							this.plugin.settings.endpoint = value;
							await this.plugin.saveSettings();
						});
				})
				.setClass('conditional-setting');

			new Setting(containerEl)
				.setName('API Key')
				.setDesc('Enter your custom API key. (Optional)')
				.addText(text => {
					text
						.setValue(this.plugin.settings.apiKey)
						.onChange(async (value) => {
							this.plugin.settings.apiKey = value;
							await this.plugin.saveSettings();
						});
				})
				.setClass('conditional-setting');
		}
	}
}
