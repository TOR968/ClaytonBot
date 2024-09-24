require("dotenv").config();
const axios = require("axios");

const BASE_URL = "https://tonclayton.fun";
const HEADERS = {
    Host: "tonclayton.fun",
    "Init-Data": process.env.INIT_DATA,
    Origin: "https://tonclayton.fun",
    Referer: "https://tonclayton.fun/games/game-512",
};

const api = axios.create({
    baseURL: BASE_URL,
    headers: HEADERS,
});

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

async function login() {
    const response = await api.post("/api/user/login", {});
    return response.data;
}

async function claimDailyReward() {
    const response = await api.post("/api/user/daily-claim", {});
    return response.data;
}

async function claimTokens() {
    const response = await api.post("/api/user/claim", {});
    return response.data;
}

async function startFarming() {
    const response = await api.post("/api/user/start", {});
    return response.data;
}

async function getDailyTasks() {
    const response = await api.post("/api/user/daily-tasks", {});
    return response.data;
}

async function completeTask(taskId) {
    const response = await api.post(`/api/user/daily-task/${taskId}/complete`, {});
    return response.data;
}

async function claimTaskReward(taskId) {
    const response = await api.post(`/api/user/daily-task/${taskId}/claim`, {});
    return response.data;
}

async function simulateGameplay(gameName) {
    const duration = 30;
    for (let i = 0; i <= duration; i++) {
        process.stdout.write(
            `\r\x1b[36m${gameName} game in progress: ${i}s / ${duration}s [${"=".repeat(i)}${" ".repeat(
                duration - i
            )}]\x1b[0m`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log();
}

async function play1024() {
    await api.post("/api/game/start", {});

    await simulateGameplay("1024");

    await api.post("/api/game/save-tile", { maxTile: 1024 });
    log(`1024 tile saved: 1024`, "cyan");

    const endResponse = await api.post("/api/game/over", {});
    return endResponse.data;
}

async function main() {
    try {
        let loginData = await login();
        log("Logged in successfully", "green");

        if (loginData.dailyReward && loginData.dailyReward.can_claim_today) {
            const dailyRewardResult = await claimDailyReward();
            log("Daily reward claimed", "yellow");
            console.log(dailyRewardResult);
        } else {
            log("Daily reward not available", "yellow");
        }

        if (loginData.user.can_claim) {
            const claimData = await claimTokens();
            log(`Tokens claimed: ${claimData.claim}`, "magenta");

            const farmingResult = await startFarming();
            log("Farming started", "blue");
            console.log(farmingResult);
        } else {
            log("Token claim not available", "magenta");
        }

        loginData = await login();
        const dailyAttempts = loginData.user.daily_attempts;
        log(`Available game attempts: ${dailyAttempts}`, "cyan");

        for (let i = 1; i <= dailyAttempts; i++) {
            const game1024Result = await play1024();
            log(`1024 game ${i} result:`, "green");
            console.log(game1024Result);
        }

        log("Fetching daily tasks...", "cyan");
        let tasks = await getDailyTasks();

        for (const task of tasks) {
            if (!task.is_completed && !task.is_reward) {
                log(`Completing task: ${task.task_type} (ID: ${task.id})`, "yellow");
                const completeResult = await completeTask(task.id);
                log(completeResult.message, "green");
            } else {
                log(`Task already completed: ${task.task_type} (ID: ${task.id})`, "yellow");
            }
        }

        tasks = await getDailyTasks();

        for (const task of tasks) {
            if (task.is_completed && !task.is_reward) {
                log(`Claiming reward for task: ${task.task_type} (ID: ${task.id})`, "yellow");
                const claimResult = await claimTaskReward(task.id);
                log(claimResult.message, "green");
                console.log(`Reward received: ${claimResult.reward}`);
            }
        }
    } catch (error) {
        log(`Error occurred: ${error.message}`, "red");
    }
}

main();
