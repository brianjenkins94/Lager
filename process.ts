import { createInterface } from "readline";
import * as fs from "fs";
import * as path from "path";
import { write as stringify } from "bfj";

import { cloneDeep, mergeDeep, getKeyOfObjectByPath, arrayify } from "./src/util";
import { config } from "./config";

/**
 * Reads and attempts to parse each line of a given file and invokes the callback on each successfully parsed line.
 *
 * @param file - The file to read
 * @param callback - The callback to invoke on each successfully parsed line
 */
function readline(file, callback) {
	return new Promise(function(resolve, reject) {
		const readline = createInterface({
			"input": fs.createReadStream(file)
		});

		let lineNumber = 0;

		readline.on("line", function(line) {
			lineNumber += 1;

			let object;

			try {
				object = JSON.parse(line);
			} catch (error) {
				readline.removeAllListeners();

				readline.close();

				reject(new Error("Error parsing JSON line " + lineNumber + " in " + file));

				return;
			}

			callback(object);
		});

		readline.on("close", function() {
			resolve();
		});
	});
}

function populateUniqueKeys(uniqueKeys, data) {
	for (const datum of data) {
		(function recurse(object, path = []) {
			for (const [key, value] of Object.entries(object)) {
				if (Array.isArray(value)) {
					// XXX: This assumes arrays do not contain mixed data.
					if (typeof value[0] === "object") {
						for (const element of value) {
							recurse(element, [...path, key]);
						}
					} else {
						getKeyOfObjectByPath(uniqueKeys, path)[key].push(value);
					}
				} else if (typeof value === "object" && value !== null) {
					recurse(value, [...path, key]);
				} else {
					getKeyOfObjectByPath(uniqueKeys, path)[key].push(value);
				}
			}
		})(datum);
	}

	return uniqueKeys;
}

function condenseLossless(uniqueKeys) {
	(function recurse(object, path = []) {
		for (const [key, value] of Object.entries(object)) {
			if (Array.isArray(value)) {
				if (value[0] !== undefined && value[0] !== null && value[1] !== undefined && value[1] !== null) {
					if (typeof value[0] === "object" && typeof value[1] === "object") {
						const uniqueValues = new Set();

						for (const element of value) {
							uniqueValues.add(JSON.stringify(element));
						}

						const uniqueValuesArray = [];

						for (const element of uniqueValues) {
							uniqueValuesArray.push(JSON.parse(element as string));
						}

						if (uniqueValuesArray.length === 1) {
							getKeyOfObjectByPath(uniqueKeys, path)[key] = uniqueValuesArray;
						}
					} else if ([...new Set(value)].length === 1) {
						getKeyOfObjectByPath(uniqueKeys, path)[key] = [...new Set(value)];
					}
				}
			} else if (typeof value === "object" && value !== null) {
				recurse(value, [...path, key]);
			} else {
				throw new Error("This should never happen.");
			}
		}
	})(uniqueKeys);
}

let peakResidentSetSize = process.memoryUsage().rss;

const intervalReference = setInterval(function checkMemory() {
	const currentResidentSetSize = process.memoryUsage().rss;

	if (currentResidentSetSize > peakResidentSetSize) {
		peakResidentSetSize = currentResidentSetSize;
	}

	return Math.floor(currentResidentSetSize / 1024 / 1024) + "MB";
}, 100);

(async function() {
	const files = {};

	(function recurse(directory) {
		for (const file of fs.readdirSync(directory)) {
			if (fs.statSync(path.join(directory, file)).isDirectory()) {
				recurse(path.join(directory, file));
			} else if (!file.startsWith(".")) {
				// TODO: Remove
				const [fileName] = /^.+?(?=-\d|\.(\d|log)|$)/i.exec(path.basename(file));

				if (files[fileName] === undefined) {
					files[fileName] = [];
				}

				files[fileName].push(path.join(directory, file));
			}
		}
	})(config.get("logDirectory"));

	const schema = {};

	for (const fileName of Object.keys(files)) {
		const data = {};

		for (const file of files[fileName]) {
			console.log("Processing file: " + file);

			if (schema[fileName] === undefined) {
				schema[fileName] = {};
			}

			await readline(file, function(object) {
				const stringifiedKeys = JSON.stringify(cloneDeep(object, { "keysOnly": true }));

				if (data[stringifiedKeys] === undefined) {
					data[stringifiedKeys] = [];

					schema[fileName][stringifiedKeys] = {};
				}

				data[stringifiedKeys].push(object);
			}).catch(function(error) {
				console.error(error.message);

				console.warn("Skipping " + file);
			});
		}

		const uniqueKeys = {};

		for (const stringifiedKeys of Object.keys(data)) {
			for (const datum of data[stringifiedKeys]) {
				schema[fileName][stringifiedKeys] = mergeDeep([schema[fileName][stringifiedKeys], cloneDeep(datum, { "typesOnly": true })]);
			}

			uniqueKeys[stringifiedKeys] = arrayify(JSON.parse(stringifiedKeys));

			populateUniqueKeys(uniqueKeys[stringifiedKeys], data[stringifiedKeys]);

			condenseLossless(uniqueKeys[stringifiedKeys]);
		}

		await stringify(path.join(__dirname, "cache", fileName + ".lossless.json"), uniqueKeys, { "space": "\t" });

		fs.appendFileSync(path.join(__dirname, "cache", fileName + ".lossless.json"), "\n");
	}

	console.log();
	console.log("Writing schema to disk...");
	console.log();

	fs.writeFileSync(path.join(__dirname, "report", "schema.json"), JSON.stringify(schema, undefined, "\t") + "\n");

	console.log("Peak memory used: " + Math.floor(peakResidentSetSize / 1024 / 1024) + "MB");

	clearInterval(intervalReference);
})();
