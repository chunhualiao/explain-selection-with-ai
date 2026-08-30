# Local Testing Guide

Instructions for installing and testing the development version of the plugin in your local Obsidian app.

## Step 1: Find your Obsidian Vault

You need to know the path to your Obsidian vault on your computer. Common locations:
- `/Users/<username>/Documents/MyVault`
- `/Users/<username>/Library/Mobile Documents/iCloud~md~obsidian/Documents/MyVault` (if using iCloud)

## Step 2: Build the Plugin

Before installing, you must compile the TypeScript source code into a single JavaScript file that Obsidian can load.

```bash
cd /tmp/explain-selection-with-ai
npm install --legacy-peer-deps
node esbuild.config.mjs production
```

This creates a `main.js` file at the root of the project directory.

## Step 3: Install to your Vault

Plugins live in the `.obsidian/plugins/` folder inside your vault.

1. Create the plugin directory:
   ```bash
   mkdir -p "/path/to/your/vault/.obsidian/plugins/explain-selection-with-ai"
   ```

2. Copy the required files:
   ```bash
   cp main.js manifest.json styles.css "/path/to/your/vault/.obsidian/plugins/explain-selection-with-ai/"
   ```

## Step 4: Enable in Obsidian

1. Open Obsidian.
2. Go to **Settings > Community Plugins**.
3. If you haven't enabled community plugins yet, click **Turn on community plugins**.
4. Find **Explain Selection With AI** in the list of installed plugins.
5. Toggle the switch to **On**.

## Step 5: Verify Features

Follow the checklist in [docs/SMOKE_TESTS.md](SMOKE_TESTS.md) to verify that all features (OpenRouter, model picker, prompt customization) are working correctly.

## Step 6: Automatic Reload during Development

If you want to make changes and see them reflected immediately in Obsidian:

1. Install the **Hot Reload** plugin from the Obsidian community store.
2. Run the development build:
   ```bash
   npm run dev
   ```
3. Every time you save a file in `src/`, `main.js` will be rebuilt and Obsidian will automatically reload the plugin.

---

## iPhone Testing

To test on your iPhone:
1. Follow the installation steps above on your Mac.
2. Ensure your vault is synced to your iPhone (via iCloud or Obsidian Sync).
3. Wait for the sync to complete.
4. On your iPhone, go to **Settings > Community Plugins** and enable the plugin.
