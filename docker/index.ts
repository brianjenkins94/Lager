import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { spawnReadline } from "./src/spawnReadline";

function sleep(duration) {
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			resolve();
		}, duration);
	});
}

(async function() {
	console.error("WARN: The Docker CLI portion of this project was abandoned.");

	(function recurse(directory) {
		for (const file of fs.readdirSync(directory)) {
			if (fs.statSync(path.join(directory, file)).isDirectory()) {
				fs.rmdirSync(path.join(directory, file), { "recursive": true });
			} else if (!file.startsWith(".")) {
				fs.unlinkSync(path.join(directory, file));
			}
		}
	})(path.join(__dirname, "logs"));

	//const workflowName = path.basename(workflow, path.extname(workflow));

	//console.log("Running workflow: " + workflowName);

	await spawnReadline("docker", [
		"container",
		"ls",
		"--filter name=\"container-name\""
	], async function(line) {
		if (line.includes("Up")) {
			console.log("Stopping orphaned instance...\n");

			await spawnReadline("docker", ["stop", "container-name"]);

			return null;
		}
	});

	await spawnReadline("docker", ["pull", "********/********:latest"]);

	const { root, dir, base } = path.parse(path.join(__dirname, "logs"));

	const normalizedPath = "/" + path.join("/", root.split(":")[0].toLowerCase(), dir.substring(root.length), base).replace(/\\/g, "/");

	await spawnReadline("docker", [
		"container",
		"run",
		"--name container-name",
		"--rm",
		"--volume \"" + normalizedPath + "\":\"/logs\"",
		"--publish 3000:3000",
		"--env EXAMPLE=true",
		"********/********:latest"
	], function(line) {
		if (line.startsWith("Application running at")) {
			console.log(line + "\n");

			return null;
		}
	});

	for (let x = 0; x < 10; x++) {
		//await require(path.join(__dirname, "workflows", workflow)).default(path.join(__dirname, "documents", "PdfDemoSample.pdf"));
	}

	console.log("Stopping instance...\n");

	spawnSync("docker", ["stop", "container-name"], { "shell": true });

	await spawnReadline("npm", [
		"start",
		"--",
		"--log-directory \"" + path.join(__dirname, "logs").replace(/\\/g, "\\\\") + "\""
	], function(line) {
		console.log(line);
	});

	await spawnReadline("npx", [
		"ts-node",
		"\"" + path.join(__dirname, "..", "src/reconstitute.ts") + "\""
	]);

	await spawnReadline("npm", [
		"run",
		"analyze"
	], function(line) {
		console.log(line);
	});

	const reportDirectory = path.join(__dirname, "..", "report");

	const files = fs.readdirSync(reportDirectory).filter(function(file) {
		return !file.startsWith(".");
	});
})();
