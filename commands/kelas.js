const { EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");
const fs = require("fs");
const config = require("../config.js");

async function handleDaftarKelasCommand(interaction) {
  await interaction.deferReply();
  let browser = null;
  try {
    browser = await puppeteer.launch(config.PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setUserAgent(config.USER_AGENT);
    const userId = interaction.user.id;
    const userCookiePath = `${config.COOKIES_DIR}/${userId}.json`;

    if (fs.existsSync(userCookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(userCookiePath));
      await page.setCookie(...cookies);
    }
    await page.goto(config.DASHBOARD_URL, { waitUntil: "networkidle2" });
    if (page.url().includes("login")) {
      await interaction.editReply(
        "Sesi Anda tidak valid atau belum ada. Silakan jalankan `/login-eclass` terlebih dahulu."
      );
      if (browser) await browser.close();
      return;
    }

    const studentCourses = await page.$$eval("div.kelas_box", (elements) => {
      /* ... logika scraping ... */
    });
    let assistantCourses = [];
    try {
      await page.waitForSelector('div[style*="border:1px solid #ccc"]', {
        timeout: 3000,
      });
      assistantCourses = await page.$$eval(
        'div[style*="border:1px solid #ccc"]',
        (elements) => {
          /* ... logika scraping ... */
        }
      );
    } catch (e) {
      /* ... */
    }

    const embed = new EmbedBuilder(); /* ... logika embed ... */
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    /* ... error handling ... */
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = handleDaftarKelasCommand;
