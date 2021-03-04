import * as fs from "fs";
import * as path from "path";

import { config } from "./config";

let peakResidentSetSize = process.memoryUsage().rss;

const intervalReference = setInterval(function checkMemory() {
	const currentResidentSetSize = process.memoryUsage().rss;

	if (currentResidentSetSize > peakResidentSetSize) {
		peakResidentSetSize = currentResidentSetSize;
	}

	return Math.floor(currentResidentSetSize / 1024 / 1024) + "MB";
}, 100);

(async function() {
	const rules = [];

	(function recurse(directory) {
		for (const file of fs.readdirSync(directory)) {
			if (fs.statSync(path.join(directory, file)).isDirectory()) {
				recurse(path.join(directory, file));
			} else {
				rules.push(path.join(directory, file));
			}
		}
	})(path.join(__dirname, "rules"));

	// Run rules

	const files = fs.readdirSync(path.join(__dirname, "cache")).filter(function(file) {
		return !file.startsWith(".");
	});

	for (const rule of rules) {
		console.log("Running rule " + rule.substring(path.join(__dirname, "rules").length + 1) + ":\n");

		const defaultExport = await require(rule).default;

		if (defaultExport.name !== "skip") {
			await defaultExport({
				"cacheDirectory": path.join(__dirname, "cache"),
				"files": files,
				"outputDirectory": config.get("reportDirectory")
			});
		} else {
			console.warn("Rule skipped.");
		}

		console.log();
	}

	console.log("Peak memory used: " + Math.floor(peakResidentSetSize / 1024 / 1024) + "MB");

	clearInterval(intervalReference);
})();
