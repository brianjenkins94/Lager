import alias from "@rollup/plugin-alias";
import commonJs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
//import nodeBuiltins from "rollup-plugin-node-builtins";
//import nodeGlobals from "rollup-plugin-node-globals";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

export default {
	"input": "docs/js/main.ts",
	"output": {
		"file": "docs/js/main.js",
		"format": "esm"
	},
	"external": [],
	"plugins": [
		alias({
			"entries": [
				{ "find": "buffer", "replacement": "browserfs/dist/shims/buffer" },
				{ "find": "fs", "replacement": "browserfs/dist/shims/fs" },
				{ "find": "path", "replacement": "browserfs/dist/shims/path" }
			]
		}),
		nodeResolve({ "preferBuiltins": false }),
		commonJs(),
		//nodeBuiltins(),
		//nodeGlobals(),
		typescript(),
		inject({
			"BrowserFS": "browserfs"
		})
	],
	"watch": {
		"clearScreen": false
	}
};
