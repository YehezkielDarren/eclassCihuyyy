const puppeteer = require("puppeteer");
const fs = require("fs");
const config = require("../config.js");

async function performLogin(page, username, password, userCookiePath) {
  console.log(
    `Melakukan login untuk pengguna yang cookie-nya akan disimpan di ${userCookiePath}...`
  );
  await page.setUserAgent(config.USER_AGENT);
  await page.goto(config.LOGIN_URL, { waitUntil: "networkidle2" });

  const ID_SELECTOR = "[name='id']";
  const PASSWORD_SELECTOR = "[name='password']";
  const LOGIN_BUTTON_SELECTOR = ".button2.biru.kecil";

  await page.type(ID_SELECTOR, username);
  await page.type(PASSWORD_SELECTOR, password);

  await Promise.all([
    page.click(LOGIN_BUTTON_SELECTOR),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  if (!page.url().includes("/kelas/")) {
    throw new Error(
      'Login gagal. URL tidak mengandung "/kelas/" setelah mencoba login.'
    );
  }

  console.log("Login berhasil. Menyimpan cookies...");
  const cookies = await page.cookies();
  fs.writeFileSync(userCookiePath, JSON.stringify(cookies, null, 2));
  console.log(`Cookies berhasil disimpan ke ${userCookiePath}`);
}

async function handleLoginCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const userCookiePath = `${config.COOKIES_FOLDER_NAME}/${userId}.json`;

  const username = interaction.options.getString("username");
  const password = interaction.options.getString("password");
  let browser = null;
  try {
    browser = await puppeteer.launch(config.PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await performLogin(page, username, password, userCookiePath);
    await interaction.editReply(
      "✅ Login berhasil dan sesi Anda telah disimpan!"
    );
  } catch (error) {
    console.error(`Error login untuk user ${userId}:`, error);
    await interaction.editReply(`❌ Terjadi kesalahan: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

// Ekspor handler agar bisa dibaca oleh index.js
module.exports = handleLoginCommand;
