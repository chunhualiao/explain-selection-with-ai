import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("README CI badge", () => {
	it("uses this fork's master workflow for the badge and Actions links", () => {
		const readme = readFileSync(resolve(__dirname, "../README.md"), "utf8");
		const workflowUrl =
			"https://github.com/chunhualiao/explain-selection-with-ai/actions/workflows/ci.yml";

		expect(readme).toContain(
			`[![CI](${workflowUrl}/badge.svg?branch=master)](${workflowUrl})`
		);
		expect(readme).toContain(
			`[GitHub Actions](https://github.com/chunhualiao/explain-selection-with-ai/actions)`
		);
		expect(readme).not.toContain(
			"https://github.com/BWurster/explain-selection-with-ai/actions"
		);
	});
});
