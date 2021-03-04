import convict from "convict";
import * as path from "path";

const options = {
	"env": {
		"format": ["production", "development", "test"],
		"default": "development",
		"env": "NODE_ENV",
		"arg": "env"
	},
	"logDirectory": {
		"format": "String",
		"default": process.cwd(),
		"env": "LOG_DIRECTORY",
		"arg": "log-directory"
	},
	"reportDirectory": {
		"format": "String",
		"default": path.join(__dirname, "..", "report"),
		"env": "REPORT_DIRECTORY",
		"arg": "report-directory"
	}
};

export const config = convict(options);

// Perform validation
config.validate({ "allowed": "strict" });
