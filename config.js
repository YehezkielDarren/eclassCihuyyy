require("dotenv").config();

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  LOGIN_URL: process.env.APP_URL || "https://eclass.ukdw.ac.id/e-class/id/",
  DASHBOARD_URL: "https://eclass.ukdw.ac.id/e-class/id/kelas/index",
  COOKIES_FOLDER_NAME: "./cookies",

  PUPPETEER_OPTIONS: {
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--start-maximized",
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  },

  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
};
