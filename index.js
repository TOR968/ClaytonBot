const axios = require("axios");
const fs = require("fs");
const readline = require("readline");
const querystring = require("querystring");

const BASE_URL = "https://tonclayton.fun";

async function readFromFile(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    const items = [];
    for await (const line of rl) {
        if (line.trim()) {
            items.push(line.trim());
        }
    }
    return items;
}

function createApiClient(initData, proxy) {
    const axiosConfig = {
        baseURL: BASE_URL,
        headers: {
            Host: "tonclayton.fun",
            "Init-Data": initData,
            Origin: BASE_URL,
            Referer: `${BASE_URL}/games/game-512`,
        },
    };

    if (proxy) {
        const [protocol, proxyUrl] = proxy.split("://");
        const [auth, hostPort] = proxyUrl.split("@");
        const [username, password] = auth.split(":");
        const [host, port] = hostPort.split(":");

        axiosConfig.proxy = {
            protocol,
            host,
            port,
            auth: {
                username,
                password,
            },
        };
    }

    return axios.create(axiosConfig);
}

function log(message, color = "white") {
    const colors = {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
    };
    console.log(colors[color] + message + "\x1b[0m");
}

async function safeRequest(api, method, url, data, retries = 3) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            const response = await api[method](url, data);
            return response.data;
        } catch (error) {
            const statusCode = error.response?.status;

            if (statusCode === 409) {
                log(`Conflict error (409) detected: ${error.response.data.message}`, "yellow");
                return;
            }

            if (statusCode === 500) {
                log("Tasks are not available at the moment", "yellow");
                return;
            }

            if (statusCode === 429) {
                log("Too many requests... Waiting before retry", "white");
                await new Promise((resolve) => setTimeout(resolve, 60000));
                attempt++;
            } else if (attempt < retries - 1 && statusCode >= 500) {
                log(`Retrying request... Attempt ${attempt + 1}`, "white");
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, 5000));
            } else {
                log(`Request failed: ${error.message}`, "red");
                throw error;
            }
        }
    }
}

const apiFunctions = {
    login: (api) => safeRequest(api, "post", "/api/user/login", {}),
    claimDailyReward: (api) => safeRequest(api, "post", "/api/user/daily-claim", {}),
    claimTokens: (api) => safeRequest(api, "post", "/api/user/claim", {}),
    startFarming: (api) => safeRequest(api, "post", "/api/user/start", {}),
    getTaskBot: (api) => safeRequest(api, "post", "/api/user/task-bot", {}),
    claimTaskBotReward: (api) => safeRequest(api, "post", "/api/user/task-bot-claim", {}),
    getPartnerTasks: (api) => safeRequest(api, "post", "/api/user/partner/get", {}),
    completePartnerTask: (api, taskId) => safeRequest(api, "post", `/api/user/partner/complete/${taskId}`, {}),
    claimPartnerTaskReward: (api, taskId) => safeRequest(api, "post", `/api/user/partner/reward/${taskId}`, {}),
    getDailyTasks: (api) => safeRequest(api, "post", "/api/user/daily-tasks", {}),
    completeTask: (api, taskId) => safeRequest(api, "post", `/api/user/daily-task/${taskId}/complete`, {}),
    claimTaskReward: (api, taskId) => safeRequest(api, "post", `/api/user/daily-task/${taskId}/claim`, {}),
    playGame: async (api, gameName) => {
        await safeRequest(api, "post", "/api/game/start-game", {});
        await playGameWithProgress(api, gameName);
    },
};

async function playGameWithProgress(api, gameName) {
    const tileSequence = [8, 16, 32, 64, 128, 256, 512, 1024];
    const duration = tileSequence.length;

    for (let i = 0; i < tileSequence.length; i++) {
        const currentTile = tileSequence[i];

        process.stdout.write(`\r\x1b[36m${gameName} game in progress: ${i + 1} / ${duration} - `);

        await new Promise((resolve) => setTimeout(resolve, 10000));

        await safeRequest(api, "post", "/api/game/save-tile-game", { maxTile: currentTile });
        log(`Tile saved: ${currentTile}`, "cyan");
    }

    process.stdout.write(`\r\x1b[36m${gameName} game finished!\x1b[0m\n`);
    return await safeRequest(api, "post", "/api/game/over-game", {});
}

async function processAccount(initData, firstName, proxy) {
    try {
        const api = createApiClient(initData, proxy);
        let loginData = await apiFunctions.login(api);
        log("Logged in successfully", "green");

        if (loginData.dailyReward.can_claim_today && loginData.dailyReward.is_subscribed) {
            await apiFunctions.claimDailyReward(api);
            log("Daily reward claimed", "yellow");
        } else {
            log("Daily reward not available", "yellow");
        }

        if (loginData.user.can_claim) {
            await apiFunctions.claimTokens(api);
            log("Tokens claimed", "magenta");
            await apiFunctions.startFarming(api);
            log("Farming started", "blue");

            loginData = await apiFunctions.login(api);
        } else {
            log("Token claim not available", "magenta");
        }

        const dailyAttempts = loginData.user.daily_attempts;
        log(`Available game attempts: ${dailyAttempts}`, "cyan");

        for (let i = 1; i <= dailyAttempts; i++) {
            await apiFunctions.playGame(api, "1024");
            log(`1024 game ${i} Done`, "green");
        }

        const taskBotStatus = await apiFunctions.getTaskBot(api);

        if (taskBotStatus && taskBotStatus.bot !== undefined && taskBotStatus.claim !== undefined) {
            log(
                `Bot task status: ${taskBotStatus.bot ? "Not available" : "Available"}, Claim status: ${
                    taskBotStatus.claim ? "Not available" : "Available"
                }`,
                "cyan"
            );

            if (taskBotStatus.bot && !taskBotStatus.claim) {
                log("Claiming task bot reward...", "yellow");

                const rewardResponse = await apiFunctions.claimTaskBotReward(api);

                log(`Bot task reward claimed: ${rewardResponse.claimed}`, "green");
            } else if (!taskBotStatus.bot) {
                log("Bot task not available", "red");
            } else if (taskBotStatus.claim) {
                log("Bot task reward already claimed", "blue");
            }
        } else {
            log("Invalid task bot status response", "yellow");
        }

        log("Fetching partners tasks...", "cyan");
        let partnerTasks = await apiFunctions.getPartnerTasks(api);

        if (Array.isArray(partnerTasks)) {
            for (const task of partnerTasks) {
                const { is_completed, is_rewarded, task_id, task_name } = task;

                if (!is_completed && !is_rewarded) {
                    log(`Completing task: ${task_name} (ID: ${task_id})`, "yellow");
                    const completeResult = await apiFunctions.completePartnerTask(api, task_id);
                    log(completeResult.message, "green");
                } else {
                    log(`Task already completed: ${task_name} (ID: ${task_id})`, "yellow");
                }
            }

            partnerTasks = await apiFunctions.getPartnerTasks(api);

            for (const task of partnerTasks) {
                const { is_completed, is_rewarded, task_id, task_name } = task;

                if (is_completed && !is_rewarded) {
                    log(`Claiming reward for task: ${task_name} (ID: ${task_id})`, "yellow");
                    const claimResult = await apiFunctions.claimPartnerTaskReward(api, task_id);
                    log(claimResult.message, "green");
                }
            }

            log("All partner tasks completed", "green");
        } else {
            log("Not available partner tasks", "yellow");
        }

        log("Fetching daily tasks...", "cyan");

        let tasks = await apiFunctions.getDailyTasks(api);

        if (Array.isArray(tasks)) {
            for (const task of tasks) {
                if (!task.is_completed && !task.is_reward) {
                    log(`Completing task: ${task.task_type} (ID: ${task.id})`, "yellow");
                    const completeResult = await apiFunctions.completeTask(api, task.id);
                    log(completeResult.message, "green");
                } else {
                    log(`Task already completed: ${task.task_type} (ID: ${task.id})`, "yellow");
                }
            }

            tasks = await apiFunctions.getDailyTasks(api);

            for (const task of tasks) {
                if (task.is_completed && !task.is_reward) {
                    log(`Claiming reward for task: ${task.task_type} (ID: ${task.id})`, "yellow");
                    const claimResult = await apiFunctions.claimTaskReward(api, task.id);
                    log(claimResult.message, "green");
                    console.log(`Reward received: ${claimResult.reward}`);
                }
            }
        } else {
            log("Not available daily tasks", "yellow");
        }

        log(`Account ${firstName} processed successfully`, "green");
    } catch (error) {
        log(`Error processing account ${firstName}: ${error.message}`, "red");
    }
}

async function main() {
    const tokens = await readFromFile("data.txt");
    const proxies = await readFromFile("proxy.txt");

    for (let i = 0; i < tokens.length; i++) {
        const initData = tokens[i];
        const proxy = proxies[i] || null;

        const parsed = querystring.parse(initData);
        const userDecoded = decodeURIComponent(parsed.user);
        const userObject = JSON.parse(userDecoded);
        const firstName = userObject?.first_name;

        log(`Processing account: ${firstName} ${proxy ? `using proxy ${proxy}` : ""}`, "cyan");
        await processAccount(initData, firstName, proxy);

        await new Promise((resolve) => setTimeout(resolve, 20000));
    }
}

main();
