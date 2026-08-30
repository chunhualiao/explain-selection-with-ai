import {
	CURRENT_PROMPT_PROFILE_VERSION,
	DEFAULT_SETTINGS,
	LEGACY_SYSTEM_PROMPT,
	LEGACY_USER_PROMPT_TEMPLATE,
	migrateSettings,
} from "../src/lib";

describe("prompt profile migration", () => {
	it("uses the Wikipedia profile for new installs", () => {
		const settings = migrateSettings(null);
		expect(settings.promptProfile).toBe("wikipedia");
		expect(settings.promptProfileVersion).toBe(CURRENT_PROMPT_PROFILE_VERSION);
	});

	it("migrates untouched legacy prompts to the Wikipedia profile", () => {
		const settings = migrateSettings({
			systemPrompt: LEGACY_SYSTEM_PROMPT,
			userPromptTemplate: LEGACY_USER_PROMPT_TEMPLATE,
		});

		expect(settings.promptProfile).toBe("wikipedia");
		expect(settings.promptProfileVersion).toBe(CURRENT_PROMPT_PROFILE_VERSION);
	});

	it("preserves customized legacy prompts behind explicit Custom mode", () => {
		const settings = migrateSettings({
			systemPrompt: "Translate technical terms carefully.",
			userPromptTemplate: "Translate {{selection}} using {{context}}",
			endpoint: "custom-model",
		});

		expect(settings.promptProfile).toBe("custom");
		expect(settings.systemPrompt).toBe("Translate technical terms carefully.");
		expect(settings.userPromptTemplate).toBe("Translate {{selection}} using {{context}}");
		expect(settings.endpoint).toBe("custom-model");
	});

	it("preserves an explicit current profile", () => {
		const settings = migrateSettings({
			...DEFAULT_SETTINGS,
			promptProfile: "custom",
			promptProfileVersion: CURRENT_PROMPT_PROFILE_VERSION,
		});

		expect(settings.promptProfile).toBe("custom");
	});
});
