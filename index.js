const axios = require("axios");
const fs = require("fs");
const readline = require("readline");
const querystring = require("querystring");
const config = require("./config.json");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const UserAgentManager = require('./userAgentManager');
const userAgentManager = new UserAgentManager();

const urlId = config.urlId;
const multiplier = config.multiplier;
const tileSequence = config.tileSequence;
const BASE_URL = "https://tonclayton.fun";

async function readFileLines(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const lines = [];
    for await (const line of rl) {
        if (line.trim()) lines.push(line.trim());
    }
    return lines;
}

function createApiClient(initData, proxy = null, userAgent = null) {
    const axiosConfig = {
        baseURL: BASE_URL,
        headers: {
            Host: "tonclayton.fun",
            "Init-Data": initData,
            Origin: BASE_URL,
        },
    };

    if (userAgent) {
        axiosConfig.headers['User-Agent'] = userAgent;
    }

    if (proxy) {
        if (proxy.startsWith("socks4://") || proxy.startsWith("socks5://")) {
            axiosConfig.httpsAgent = new SocksProxyAgent(proxy);
        } else {
            axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
        }
    }

    return axios.create(axiosConfig);
}

function log(message, color = "white") {
    const colors = {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
    };
    console.log(colors[color] + message + "\x1b[0m");
}

async function safeRequest(api, method, url, data = {}, retries = 5) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await api[method](url, data);
            return response.data;
        } catch (error) {
            const statusCode = error.response?.status;

            if (attempt < retries - 1 && statusCode >= 500) {
                log(`Retrying request... Attempt ${attempt + 1}`, "white");
                await wait(5000);
            }
            // else {
            //     log(`Request failed: ${error.message}`, "red");
            //     throw error;
            // }
        }
    }
}

const apiFunctions = {
    login: (api) => safeRequest(api, "post", `/api/${urlId}/user/authorization`),
    claimDailyReward: (api) => safeRequest(api, "post", `/api/${urlId}/user/daily-claim`),
    getPartnerTasks: (api) => safeRequest(api, "get", `/api/${urlId}/tasks/partner-tasks`),
    getDailyTasks: (api) => safeRequest(api, "get", `/api/${urlId}/tasks/daily-tasks`),
    getOtherTasks: (api) => safeRequest(api, "get", `/api/${urlId}/tasks/default-tasks`, {}),
    completeTask: (api, taskId) => safeRequest(api, "post", `/api/${urlId}/tasks/complete`, { task_id: taskId }),
    claimTaskReward: (api, taskId) => safeRequest(api, "post", `/api/${urlId}/tasks/claim`, { task_id: taskId }),
    playGame: async (api, gameName) => {
        const gameData = await safeRequest(api, "post", `/api/${urlId}/game/start`);
        await playGameWithProgress(api, gameName, gameData.session_id);
    },
};

async function playGameWithProgress(api, gameName, sessionId) {
    let tileValue = 4;
    for (let i = 0; i < tileSequence.length; i++) {
        process.stdout.write(`\r\x1b[36m${gameName} game progress: ${i + 1}/${tileSequence.length} `);

        await wait(Math.floor(getRandomNumber(3000, 7000)));
        await safeRequest(api, "post", `/api/${urlId}/game/save-tile`, {
            session_id: sessionId,
            maxTile: tileSequence[i],
        });

        tileValue = tileSequence[i];
        log(`Tile saved: ${tileSequence[i]}`, "cyan");
    }

    process.stdout.write(`\r\x1b[36m${gameName} game finished!\x1b[0m\n`);
    const overGameData = await safeRequest(api, "post", `/api/${urlId}/game/over`, {
        session_id: sessionId,
        multiplier: multiplier,
        maxTile: tileValue,
    });

    log(
        `Token reward: ${overGameData?.earn} | Xp reward: ${overGameData?.xp_earned} | Level: ${overGameData?.level}`,
        "cyan"
    );
}

async function processAccount(initData, firstName, proxy, userAgent) {
    try {
        const api = createApiClient(initData, proxy, userAgent);
        let loginData = await apiFunctions.login(api);
        log("Logged in successfully", "green");

        if (loginData.dailyReward.can_claim_today && loginData.dailyReward.is_subscribed) {
            await apiFunctions.claimDailyReward(api);
            log("Daily reward claimed", "yellow");
        } else {
            log("Daily reward not available", "yellow");
        }

        await processTasks(api, apiFunctions.getPartnerTasks, "partner");
        await processTasks(api, apiFunctions.getDailyTasks, "daily");
        await processTasks(api, apiFunctions.getOtherTasks, "other");

        loginData = await apiFunctions.login(api);

        const dailyAttempts = loginData.user.daily_attempts;
        log(`Available game attempts: ${dailyAttempts}`, "cyan");

        for (let i = 1; i <= dailyAttempts; i++) {
            await apiFunctions.playGame(api, "1024");
            log(`1024 game ${i} Done`, "green");
        }

        log(`Account ${firstName} processed successfully`, "green");
    } catch (error) {
        log(`Error processing account ${firstName}: ${error.message}`, "red");
    }
}

async function processTasks(api, taskGetter, taskType) {
    log(`Fetching ${taskType} tasks...`, "cyan");

    let tasks = await taskGetter(api);

    if (Array.isArray(tasks)) {
        for (const task of tasks) {
            const { is_completed, is_claimed, task_id, task: taskDetails } = task;

            if (task_id === 2) {
                continue;
            }

            if (!is_completed && !is_claimed) {
                log(`Completing ${taskType} task: ${taskDetails.title} (ID: ${task_id})`, "yellow");
                const completeResult = await apiFunctions.completeTask(api, task_id);
                log(completeResult.message, "green");
            } else {
                log(`${taskType} task already completed: ${taskDetails.title} (ID: ${task_id})`, "yellow");
            }
        }

        tasks = await taskGetter(api);

        for (const task of tasks) {
            const { is_completed, is_claimed, task_id, task: taskDetails } = task;

            if (is_completed && !is_claimed) {
                log(`Claiming reward for ${taskType} task: ${taskDetails.title} (ID: ${task_id})`, "yellow");
                const claimResult = await apiFunctions.claimTaskReward(api, task_id);
                log(claimResult.message, "green");
                console.log(`Reward received: ${claimResult.reward_tokens}`);
            }
        }
    } else {
        log(`Not available ${taskType} tasks`, "yellow");
    }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function scheduleNextRun() {
    const randomDelay = getRandomNumber(600000, 2400000);
    const totalDelay = 7200000 + randomDelay;
    const startTime = Date.now();
    const endTime = startTime + totalDelay;

    const timerInterval = setInterval(() => updateTimer(endTime, timerInterval), 1000);

    setTimeout(() => {
        clearInterval(timerInterval);
        main();
    }, totalDelay);
}

const getRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

function updateTimer(endTime, timerInterval) {
    const currentTime = Date.now();
    const remainingTime = endTime - currentTime;

    if (remainingTime <= 0) {
        clearInterval(timerInterval);
        return;
    }

    const { hours, minutes, seconds } = getTimeRemaining(remainingTime);
    process.stdout.write(`\r--- Restarting in ${hours}h ${minutes}m ${seconds}s ---`);
}

function getTimeRemaining(timeDifference) {
    const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
    return { hours, minutes, seconds };
}

async function main() {
    const tokens = await readFileLines("data.txt");
    const proxies = await readFileLines("proxy.txt");

    for (let i = 0; i < tokens.length; i++) {
        const initData = tokens[i];
        const proxy = proxies[i] || null;
        const firstName = JSON.parse(decodeURIComponent(querystring.parse(initData).user))?.first_name;
        const userAgent = userAgentManager.getUserAgent(initData);

        log(`Processing account: ${firstName} ${proxy ? `using proxy ${proxy}` : ""}`, "cyan");
        await processAccount(initData, firstName, proxy, userAgent);
        await wait(20000);
    }

    scheduleNextRun();
}

main();
