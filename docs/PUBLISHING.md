# Publishing Guide

Step-by-step instructions for releasing this plugin and submitting it to the Obsidian Community Plugin directory.

## Prerequisites

- Node.js 20+ installed
- GitHub CLI (`gh`) authenticated
- All tests passing: `npm test`
- TypeScript compiles: `npx tsc --noEmit --skipLibCheck`
- Build succeeds: `node esbuild.config.mjs production`

---

## Part 1: Creating a Release

### Step 1: Decide the version number

Follow [semantic versioning](https://semver.org/):
- **Patch** (2.1.1): bug fixes
- **Minor** (2.2.0): new features, backward compatible
- **Major** (3.0.0): breaking changes

### Step 2: Update `minAppVersion` (if needed)

If you use new Obsidian APIs, update `minAppVersion` in `manifest.json`:

```json
{
  "minAppVersion": "0.15.0"
}
```

### Step 3: Bump the version

This updates `manifest.json`, `package.json`, and `versions.json` in one command:

```bash
npm version patch   # or: npm version minor / npm version major
```

This runs `version-bump.mjs` automatically (configured in `package.json` scripts).

### Step 4: Push the version commit and tag

```bash
git push && git push --tags
```

Pushing the tag triggers the release workflow (`.github/workflows/release.yml`), which automatically runs tests, builds the plugin, and creates a GitHub Release with `main.js`, `manifest.json`, and `styles.css` attached.

### Step 5: Verify the release

Go to https://github.com/BWurster/explain-selection-with-ai/releases and confirm:
- [ ] Tag matches version in `manifest.json` exactly (no `v` prefix)
- [ ] `main.js` is attached
- [ ] `manifest.json` is attached
- [ ] `styles.css` is attached

### Manual release (fallback)

If the workflow fails or you need to create a release manually:

```bash
npm install --legacy-peer-deps
node esbuild.config.mjs production

gh release create <VERSION> \
  main.js \
  manifest.json \
  styles.css \
  --title "<VERSION>" \
  --notes "Release notes here"
```

Replace `<VERSION>` with the exact version string from `manifest.json` (e.g. `2.1.0`). **Do NOT prefix with `v`** — Obsidian expects the tag to match the version exactly.

---

## Part 3: Submitting to Obsidian Community Plugins

This is a one-time process for the initial submission. After approval, users can install your plugin directly from Obsidian's settings.

### Step 1: Review the developer policies

Read and ensure compliance with the [Obsidian Developer Policies](https://docs.obsidian.md/Developer+policies).

Key requirements:
- Plugin must not exfiltrate user data
- Must not include obfuscated code
- Must not use `eval()` or `Function()` constructors
- README must clearly explain what the plugin does
- Must have a license file

### Step 2: Ensure your repo has the required files

At the repo root:
- [ ] `manifest.json` with correct `id`, `name`, `version`, `minAppVersion`, `author`, `description`
- [ ] `main.js` (built, in a GitHub Release)
- [ ] `README.md` with clear description
- [ ] `LICENSE` file
- [ ] At least one GitHub Release with `main.js` and `manifest.json` attached

### Step 3: Fork the obsidian-releases repo

Go to https://github.com/obsidianmd/obsidian-releases and fork it.

### Step 4: Add your plugin entry

Edit `community-plugins.json` in your fork. Add your plugin entry **at the end** of the JSON array:

```json
{
  "id": "explain-selection-with-ai",
  "name": "Explain Selection With AI",
  "author": "Chunhua Liao",
  "description": "Use OpenAI, OpenRouter, Ollama, or any OpenAI-compatible LLM endpoint to explain selected text in context.",
  "repo": "BWurster/explain-selection-with-ai"
}
```

Fields:
- `id`: must match `id` in your `manifest.json`
- `name`: display name in the plugin browser
- `author`: your name
- `description`: short description (shown in search results)
- `repo`: GitHub `owner/repo` format

### Step 5: Submit a pull request

Create a PR from your fork to `obsidianmd/obsidian-releases:master`.

When creating the PR, switch to **preview mode** and go through the submission checklist that appears. It includes items like:
- [ ] Plugin follows developer policies
- [ ] Plugin has a README
- [ ] Plugin has been tested
- [ ] Plugin ID is unique

### Step 6: Wait for review

The Obsidian team will review your submission. This typically takes a few days to a couple of weeks. They may request changes.

### Step 7: After approval

Once merged, your plugin will appear in **Settings > Community Plugins > Browse** in Obsidian within a few hours.

Announce your plugin:
- [Obsidian Forum](https://forum.obsidian.md/c/share-showcase/9) (Share & Showcase)
- [Obsidian Discord](https://discord.gg/veuWUTm) in `#updates` (requires `developer` role)

---

## Part 4: Publishing Updates

After the initial submission, updates are automatic:

1. Bump version: `npm version patch` (or minor/major)
2. Push: `git push && git push --tags`
3. The release workflow creates the GitHub Release automatically

Obsidian checks your GitHub releases for new versions. Users will see the update in their plugin settings automatically. No PR needed for updates.

---

## Part 5: Beta Testing (Before Official Submission)

If you want beta testers before submitting officially:

1. Create a GitHub Release as described above
2. Tell testers to install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat) (Beta Reviewer's Auto-update Tool)
3. In BRAT settings, they add your repo: `BWurster/explain-selection-with-ai`
4. BRAT installs and auto-updates the plugin from your GitHub Releases

This lets you gather feedback before the official community submission.

---

## Quick Reference

| Task | Command |
|---|---|
| Install deps | `npm install --legacy-peer-deps` |
| Run tests | `npm test` |
| Type check | `npx tsc --noEmit --skipLibCheck` |
| Build | `node esbuild.config.mjs production` |
| Bump patch | `npm version patch` |
| Bump minor | `npm version minor` |
| Push with tags | `git push && git push --tags` |
| Manual release (fallback) | `gh release create <VER> main.js manifest.json styles.css --title "<VER>"` |
| Deploy locally | `bash local-deploy.sh` |
