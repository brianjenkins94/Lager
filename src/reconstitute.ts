import * as fs from "fs";
import * as path from "path";
import * as BFJ from "bfj";

import { condenseLossy } from "./util";

/**
 * Reconstitutes condensed JSON lines back into JSON lines.
 *
 * @param uniqueKeys - An object of objects of JSON lines, binned by schema, then by key
 */
export function reconstitute(uniqueKeys) {
	const reconstitutedObjects = [];

	for (const stringifiedKeys of Object.keys(uniqueKeys)) {
		const length = (function recurse(uniqueKey) {
			for (const [key, value] of Object.entries(uniqueKey)) {
				if (Array.isArray(value)) {
					if (value.length > 1) {
						return value.length;
					}
				} else if (typeof value === "object" && value !== null) {
					recurse(value);
				} else {
					throw new Error("This should never happen.");
				}
			}
		})(uniqueKeys[stringifiedKeys]) || 1;

		for (let x = 0; x < length; x++) {
			const reconstitutedObject = (function recurse(uniqueKey) {
				const object = {};

				for (const [key, value] of Object.entries(uniqueKey)) {
					if (Array.isArray(value)) {
						object[key] = value[x] ?? value[0];
					} else if (typeof value === "object" && value !== null) {
						object[key] = recurse(value);
					} else {
						object[key] = value;
					}
				}

				return object;
			})(uniqueKeys[stringifiedKeys]);

			reconstitutedObjects.push(reconstitutedObject);
		}
	}

	return reconstitutedObjects;
}

if (require.main === module) {
	(async function() {
		for (const file of fs.readdirSync(path.join(__dirname, "..", "cache"))) {
			if (!file.endsWith(".lossless.json")) {
				continue;
			}

			console.log("Processing file: " + file);

			const uniqueKeys = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "cache", file), "utf8"));

			fs.appendFileSync(path.join(__dirname, "..", "report", "reconstituted.lossless.json"), "==> " + file + " <==\n\n" + (await BFJ.stringify(reconstitute(uniqueKeys))).replace(/(^\[|\]$)/g, "").replace(/\},\{/g, "}\n{") + "\n\n");

			fs.appendFileSync(path.join(__dirname, "..", "report", "reconstituted.lossy.json"), "==> " + file + " <==\n\n" + (await BFJ.stringify(reconstitute(condenseLossy(uniqueKeys)))).replace(/(^\[|\]$)/g, "").replace(/\},\{/g, "}\n{") + "\n\n");
		}
	})();
}
