# ClaytonBot

| ✅ | Feature                     |
|----|-----------------------------|
| ✅ | Automates playing a game 1024 |
| ✅ | Performs daily tasks         |
| ✅ | Performs partner tasks         |
| ✅ | Performs bot task         |
| ✅ | Daily check                 |
| ✅ | Collecting coins            |
| ✅ | Multiple accounts            |
| ✅ | Proxy            |

## !!! Before launching the bot, check if you are subscribed to the official Clayton account

## Prerequisites

- Node.js installed on your system
- npm (Node Package Manager)
- An account on the Master Protocol platform
- Git installed on your system (for cloning the repository)

## Installation

1. Clone the repository:
   - Open your terminal or command prompt.
   - Navigate to the directory where you want to install the bot.
   - Run the following command:
     ```
     git clone https://github.com/TOR968/ClaytonBot.git
     ```
   - This will create a new directory named `ClaytonBot` with the project files.

2. Navigate to the project directory:
   - Change into the newly created directory:
     ```
     cd ClaytonBot
     ```

3. Install the required dependencies:
   ```
   npm install
   ```

4. Open the `data.txt` file in a text editor and replace `INIT_DATA` with your actual authentication token:
   ```
   your_actual_token1_here
   your_actual_token2_here
   your_actual_token3_here
   ```

5. If you need a proxy, fill in the file `proxy.txt` if not, leave it blank [example](proxy-example.txt).

## How to Get Your Token

To obtain your authentication token:

1. Log in to the Master Protocol mini-app in telegram web or desktop.
2. Open your browser's Developer Tools (usually F12 or right-click and select "Inspect").
3. Go to the "Network" tab in the Developer Tools.
4. Refresh the page or perform any action on the site.
5. Look for requests to the API (they should start with `https://tonclayton.fun/`).
6. Click on one of these requests and find the "Request Headers" section.
7. Look for a header named **"Init-Data"**. The value of this header is your token.
8. Copy this token and paste it into your `.env` file.

**Important**: Keep your token secret and never share it publicly. It provides access to your account.

## Usage

To run the bot, use the following command in your terminal:

```
node index.js
```

## Activating Developer Console in Telegram Desktop

To run this script using Telegram Desktop:

Open Telegram Desktop
Go to Settings > Advanced > Experimental settings
Find and enable the "Enable webview inspecting" option

![settings](image.png)

On macOS: Right-click and choose "Inspect" in the webview windows, or open from the Develop menu in Safari
On Windows/Linux: Use the keyboard shortcut Ctrl + Shift + I or F12


Restart Telegram Desktop to apply the changes

## Disclaimer

This bot is for educational purposes only. Use it at your own risk and make sure you comply with the terms of service of the platform you're using it on.

## License

This project is open source and available under the [MIT License](LICENSE).
