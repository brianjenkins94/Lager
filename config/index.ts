import * as path from "path";
import convict from "convict";

const options = {
	"env": {
		"format": ["production", "development", "test"],
		"default": "development",
		"env": "NODE_ENV",
		"arg": "env"
	},
	"debug": {
		"format": "Boolean",
		"default": false,
		"env": "DEBUG",
		"arg": "debug"
	},
	"logDirectory": {
		"format": "String",
		"default": path.join(process.env.HOME, "Desktop", "logs"),
		"env": "LOG_DIRECTORY",
		"arg": "log-directory"
	}
};

export const config = convict(options);

// Perform validation
config.validate({ "allowed": "strict" });
