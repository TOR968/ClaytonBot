const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

class UserAgentManager {
    constructor(
        tokensFile = "data.txt",
        userAgentsFile = "user_agents.json",
        userAgentsListFile = "user_agents_list.txt"
    ) {
        this.tokensFile = tokensFile;
        this.userAgentsFile = userAgentsFile;
        this.userAgentsListFile = userAgentsListFile;
    }

    readFileLines(filePath) {
        try {
            return fs
                .readFileSync(filePath, "utf-8")
                .split("\n")
                .filter((line) => line.trim() !== "");
        } catch (error) {
            console.error(`File reading error ${filePath}: ${error.message}`);
            return [];
        }
    }

    generateUserAgent(availableUserAgents) {
        if (availableUserAgents.length === 0) {
            return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
        }

        const randomIndex = Math.floor(Math.random() * availableUserAgents.length);
        return availableUserAgents[randomIndex].trim();
    }

    extractFirstName(initData) {
        try {
            return JSON.parse(decodeURIComponent(querystring.parse(initData).user))?.first_name;
        } catch (error) {
            console.error("Name extraction error:", error);
            return null;
        }
    }

    initializeUserAgents() {
        const tokens = this.readFileLines(this.tokensFile);
        const availableUserAgents = this.readFileLines(this.userAgentsListFile);

        let userAgents = {};
        if (fs.existsSync(this.userAgentsFile)) {
            try {
                userAgents = JSON.parse(fs.readFileSync(this.userAgentsFile, "utf-8"));
            } catch (error) {
                console.warn("Failure to read existing user_agents.json, creation of a new one");
            }
        }

        tokens.forEach((token) => {
            const firstName = this.extractFirstName(token);
            if (firstName && !userAgents[firstName]) {
                userAgents[firstName] = this.generateUserAgent(availableUserAgents);
            }
        });

        fs.writeFileSync(this.userAgentsFile, JSON.stringify(userAgents, null, 2), "utf-8");

        return userAgents;
    }

    getUserAgent(token) {
        const userAgents = this.initializeUserAgents();
        const firstName = this.extractFirstName(token);

        return firstName ? userAgents[firstName] : null;
    }
}

module.exports = UserAgentManager;