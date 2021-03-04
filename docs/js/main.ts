declare const BrowserFS;

import * as buffer from "buffer";
import * as fs from "fs";
import * as path from "path";

import { mergeDeep, cloneDeep, arrayify } from "../../src/util";

BrowserFS.configure({
	"fs": "MountableFileSystem",
	"options": {
		"/cache": {
			"fs": "IndexedDB",
			"options": {}
		}
	}
}, function(error) {
	if (error) {
		throw new Error(error);
	}
});

// Adapted from https://github.com/ljharb/util.promisify/blob/master/implementation.js
function promisify(original) {
	function promisified(...args) {
		const argumentNames = original[Symbol("customPromisifyArgs")];

		return new Promise((resolve, reject) => {
			original(...args, function(error, ...args) {
				if (error) {
					reject(error);
				} else if (typeof argumentNames !== "undefined" && args.length > 1) {
					const object = {};

					for (let x = 0; x < argumentNames.length; x++) {
						object[argumentNames[x]] = args[x];
					}

					resolve(object);
				} else {
					resolve(args[0]);
				}
			});
		});
	}

	promisified.__proto__ = original.__proto__;

	Object.defineProperty(promisified, Symbol("util.promisify.custom"), {
		"configurable": true,
		"enumerable": false,
		"value": promisified,
		"writable": false
	});

	return Object.defineProperties(promisified, Object.getOwnPropertyDescriptors(original));
}

const __dirname = "/";

// @ts-expect-error
fs.appendFileSync = promisify(fs.appendFile);

class EventEmitter {
	private events = {};

	public on(event, listener) {
		if (this.events[event] === undefined) {
			this.events[event] = [];
		}

		this.events[event].push(listener);

		return () => {
			this.off(event, listener);
		};
	}

	public off(event?, listener?) {
		if (event === undefined && listener === undefined) {
			this.events = {};
		} else if (listener === undefined) {
			delete this.events[event];
		} else if (this.events[event].indexOf(listener) !== -1) {
			this.events[event].splice(this.events[event].indexOf(listener), 1);
		}
	}

	public emit(event, ...args) {
		if (this.events[event] !== undefined) {
			for (const listener of this.events[event]) {
				listener(...args);
			}
		}

		if (event !== "*") {
			this.emit("*", ...args);
		}
	}

	public once(event, listener) {
		return this.on(event, () => {
			this.emit(event);

			this.off(event, listener);
		});
	}
}

const reader = new FileReader();

class Readline extends EventEmitter {
	public constructor(file) {
		super();

		reader.readAsText(file, "utf8");

		reader.addEventListener("load", (event) => {
			for (const line of (event.target.result as string).split(/\r?\n/g)) {
				this.emit("line", line);
			}

			this.emit("close");
		});
	}
}

/**
 * Reads and attempts to parse each line of a given file and invokes the callback on each successfully parsed line.
 *
 * @param file - The file to read
 * @param callback - The callback to invoke on each successfully parsed line
 */
function readline(file, callback) {
	return new Promise(function(resolve, reject) {
		const readline = new Readline(file);

		let lineNumber = 0;

		readline.on("line", function(line) {
			lineNumber += 1;

			if (line === "") {
				return;
			}

			let object;

			try {
				object = JSON.parse(line);
			} catch (error) {
				readline.off("*");

				reject(new Error("Error parsing JSON line " + lineNumber + " in " + file.name));

				return;
			}

			callback(object);
		});

		readline.on("close", function() {
			resolve();
		});
	});
}

document.addEventListener("DOMContentLoaded", function(event) {

	document.getElementById("folderPicker").addEventListener("change", async function(event) {
		const files = {};

		for (const file of event.target["files"]) {
			if (file.name.startsWith(".")) {
				continue;
			}

			// TODO: Remove
			const [fileName] = /^.+?(?=-\d|\.(\d|log)|$)/i.exec(file.name);

			if (files[fileName] === undefined) {
				files[fileName] = [];
			}

			files[fileName].push(file);
		}

		const schema = {};

		for (const fileName of Object.keys(files)) {
			const data = {};

			for (const file of files[fileName]) {
				console.log("Processing file: " + file.name);

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

					console.warn("Skipping " + file.name);
				});
			}

			const uniqueKeys = {};

			for (const stringifiedKeys of Object.keys(data)) {
				for (const datum of data[stringifiedKeys]) {
					schema[fileName][stringifiedKeys] = mergeDeep([schema[fileName][stringifiedKeys], cloneDeep(datum, { "typesOnly": true })]);
				}

				uniqueKeys[stringifiedKeys] = arrayify(JSON.parse(stringifiedKeys));

				//populateUniqueKeys(uniqueKeys[stringifiedKeys], data[stringifiedKeys]);

				//condenseLossless(uniqueKeys[stringifiedKeys]);
			}

			//await stringify(path.join(__dirname, "cache", fileName + ".lossless.json"), uniqueKeys);

			//fs.appendFileSync(path.join(__dirname, "cache", fileName + ".lossless.json"), "\n");
		}
	});

});
