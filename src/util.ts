/**
 * Recursively clones an object, optionally substituting objects for arrays of keys or primitives for their types.
 *
 * @param object - The object to clone
 * @param options
 * @param options.keysOnly - Return arrays of keys in place of objects (default: false)
 * @param options.maxDepth - The maximum depth to traverse (default: Infinity)
 * @param options.typesOnly - Return types in place of primitives (default: false)
 *
 * @returns The cloned object
 */
export function cloneDeep(object, options = {}) {
	options["keysOnly"] = options["keysOnly"] ?? false;
	options["maxDepth"] = options["maxDepth"] ?? Infinity;
	options["typesOnly"] = options["typesOnly"] ?? false;

	if (options["typesOnly"] === true) {
		options["keysOnly"] = false;
	}

	// eslint-disable-next-line complexity
	return (function recurse(object, depth = 0) {
		if (depth >= options["maxDepth"]) {
			if (Array.isArray(object)) {
				return [];
			} else if (typeof object === "object" && object !== null) {
				return {};
			} else {
				return null;
			}
		}

		depth += 1;

		const clone = options["keysOnly"] ? [] : {};

		if (object === null) {
			return clone;
		}

		for (const [key, value] of Object.entries(object)) {
			if (Array.isArray(value)) {
				if (options["keysOnly"] === true) {
					const object = {};

					// XXX: This assumes arrays do not contain mixed data.
					if (typeof value[0] === "object") {
						for (const element of value) {
							object[key] = mergeDeep([object[key], cloneDeep(element, { "keysOnly": true })], { "treatObjectsAsNamedArrays": true });
						}
					} else {
						object[key] = [];
					}

					(clone as any[]).push(object);
				} else if (options["typesOnly"] === true) {
					for (const element of value) {
						if (typeof element === "object" && element !== null) {
							clone[key] = recurse(element, depth);
						}
					}
				} else {
					clone[key] = [];

					for (const element of value) {
						if (typeof element === "object" && element !== null) {
							clone[key].push(recurse(element, depth));
						} else {
							clone[key].push(element);
						}
					}
				}
			} else if (typeof value === "object" && value !== null) {
				if (options["keysOnly"] === true) {
					const object = {};

					object[key] = recurse(value, depth);

					(clone as any[]).push(object);
				} else {
					clone[key] = recurse(value, depth);
				}
			} else if (options["keysOnly"] === true) {
				(clone as any[]).push(key);
			} else if (options["typesOnly"] === true && value !== null) {
				clone[key] = typeof value;
			} else {
				clone[key] = value;
			}
		}

		return clone;
	})(object);
}

/**
 * Recursively merges arguments.
 *
 * @param args - Either an array of arrays or an array of objects to merge
 * @param options
 * @param options.treatObjectsAsNamedArrays - Whether to treat objects as named arrays (default: false)
 *
 * @returns The merged object
 */
export function mergeDeep(args, options = {}) {
	options["treatObjectsAsNamedArrays"] = options["treatObjectsAsNamedArrays"] ?? false;

	function objectify(array) {
		return (function recurse(object) {
			const clone = {};

			for (const element of object) {
				if (Array.isArray(element)) {
					throw new Error("This should never happen. / Not yet implemented?");
				} else if (typeof element === "object" && element !== null) {
					const [key] = Object.keys(element);

					if (options["treatObjectsAsNamedArrays"] === true) {
						clone[key] = recurse(element[key]);
					} else {
						throw new Error("Not yet implemented.");
					}
				} else {
					clone[element as string] = "";
				}
			}

			return clone;
		})(array);
	}

	function merge(target, source) {
		if (target === undefined) {
			target = Array.isArray(source) ? [] : {};
		}

		for (const [key, value] of Object.entries(source)) {
			if (Array.isArray(value)) {
				for (const [key, value] of Object.entries(source)) {
					const [subkey] = Object.keys(value);

					const object = {};

					object[subkey] = [];

					for (const element of value[subkey]) {
						object[subkey].push(element);
					}

					if (object[subkey].length !== 0) {
						target[key] = object;
					}
				}
			} else if (typeof value === "object" && value !== null) {
				target[key] = merge(target[key], value);
			} else {
				target[key] = value;
			}
		}

		return target;
	}

	return args.reduce(function(previous, current) {
		if (previous === undefined) {
			previous = Array.isArray(current) ? [] : {};
		}

		if (Array.isArray(previous) && Array.isArray(current)) {
			previous = cloneDeep(mergeDeep([objectify(previous), objectify(current)]), { "keysOnly": true });
		} else {
			merge(previous, current);
		}

		return previous;
	});
}

/**
 * Gets the key of the given object by a path.
 *
 * @param object - The object to traverse
 * @param path - An array of keys
 *
 * @returns The value of the object at the path
 */
export function getKeyOfObjectByPath(object, path) {
	return path.reduce(function(object, key) {
		return object[key];
	}, object) || object;
}

/**
 * Gets or creates the key of the given object by a path.
 *
 * @param object - The object to traverse
 * @param path - An array of keys
 *
 * @returns The value of the object at the path
 */
export function getOrCreateKeyOfObjectByPath(object, path) {
	return path.reduce(function(object, key) {
		if (object[key] === undefined) {
			object[key] = {};
		}

		return object[key];
	}, object) || object;
}

/**
 * Lossily removes keys identified as noise.
 *
 * @param uniqueKeys - An object of objects of JSON lines, binned by schema, then by key
 *
 * @returns The condensed object
 */
export function condenseLossy(uniqueKeys) {
	const concentrate = {};

	// eslint-disable-next-line complexity
	(function recurse(object, path = []) {
		for (const [key, value] of Object.entries(object)) {
			if (Array.isArray(value)) {
				if (value[0] !== undefined && value[0] !== null && value[1] !== undefined && value[1] !== null) {
					if (typeof value[0] === "number" && typeof value[1] === "number") {
						if ([...new Set(value)].length > 1) {
							continue;
						}
					} else if (typeof value[0] === "string" && typeof value[1] === "string") {
						if ((value[0] !== "" && value[1] !== "") && (!isNaN(Number(value[0])) && !isNaN(Number(value[1])))) {
							if ([...new Set(value)].length > 1) {
								continue;
							}
						} else if ((value[0].length === 24 && value[1].length === 24) && (!isNaN(Date.parse(value[0])) && !isNaN(Date.parse(value[1])))) {
							continue;
						} else if ((value[0] === "" || value[0].length === 22) && (value[1] === "" || value[1].length === 22)) {
							continue;
						}
					} else if (typeof value[0] === "object" && typeof value[1] === "object") {
						const uniqueValues = new Set();

						for (const element of value) {
							uniqueValues.add(JSON.stringify(element));
						}

						const uniqueValuesArray = [];

						for (const element of uniqueValues) {
							uniqueValuesArray.push(JSON.parse(element as string));
						}

						getOrCreateKeyOfObjectByPath(concentrate, path)[key] = uniqueValuesArray;

						continue;
					}
				}

				getOrCreateKeyOfObjectByPath(concentrate, path)[key] = value; // Array.isArray(value[0]) ? [mergeDeep(value)] : [...new Set(value)];
			} else if (typeof value === "object" && value !== null) {
				recurse(value, [...path, key]);
			} else {
				throw new Error("This should never happen.");
			}
		}
	})(uniqueKeys);

	return concentrate;
}

/**
 * Converts the terminal keys of an object into arrays.
 *
 * @param object - The object to arrayify
 *
 * @returns The arrayified object
 */
export function arrayify(object) {
	const arrayifiedObject = {};

	(function arrayify(object, path = []) {
		if (object.length === 0) {
			const key = path.pop();

			getKeyOfObjectByPath(arrayifiedObject, path)[key] = [];
		} else {
			for (const element of object) {
				if (Array.isArray(element)) {
					throw new Error("This should never happen.");
				} else if (typeof element === "object" && element !== null) {
					const [key] = Object.keys(element);

					if (getKeyOfObjectByPath(arrayifiedObject, path)[key] === undefined) {
						getKeyOfObjectByPath(arrayifiedObject, path)[key] = {};
					}

					arrayify(element[key], [...path, key]);
				} else {
					getKeyOfObjectByPath(arrayifiedObject, path)[element] = [];
				}
			}
		}
	})(object);

	return arrayifiedObject;
}
