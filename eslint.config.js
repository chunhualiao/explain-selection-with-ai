import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
	js.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				sourceType: "module",
			},
			globals: {
				// Browser globals
				console: "readonly",
				document: "readonly",
				window: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				fetch: "readonly",
				URL: "readonly",
				URLSearchParams: "readonly",
				AbortController: "readonly",
				TextDecoder: "readonly",
				ReadableStream: "readonly",
				// DOM types
				HTMLElement: "readonly",
				HTMLInputElement: "readonly",
				Event: "readonly",
				KeyboardEvent: "readonly",
				MouseEvent: "readonly",
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
		},
	},
	{
		ignores: ["node_modules/**", "main.js", "*.config.js", "*.config.mjs"],
	},
];
