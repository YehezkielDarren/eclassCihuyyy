const { EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const config = require("../config.js");

async function handleDaftarKelasCommand(interaction) {
  await interaction.deferReply();
  let browser = null;
  try {
    browser = await puppeteer.launch(config.PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setUserAgent(config.USER_AGENT);
    const userId = interaction.user.id;
    const userCookiePath = `${config.COOKIES_FOLDER_NAME}/${userId}.json`;

    if (fs.existsSync(userCookiePath)) {
      const cookies = JSON.parse(fs.readFileSync(userCookiePath));
      await page.setCookie(...cookies);
    }
    await page.goto(config.DASHBOARD_URL, { waitUntil: "networkidle2" });
    if (!page.url().includes("/kelas/")) {
      await interaction.editReply(
        "Sesi Anda tidak valid atau belum ada. Silakan jalankan `/login-eclass` terlebih dahulu."
      );
      if (browser) await browser.close();
      return;
    }

    const studentCourses = await page.$$eval("div.kelas_box", (elements) => {
      return elements.map((el) => {
        const titleEl = el.querySelector("h2");
        const linkEl = el.closest("a");
        return {
          title: titleEl ? titleEl.innerText.trim() : "Judul tidak ditemukan",
          link: linkEl ? linkEl.href : "#",
        };
      });
    });
    let assistantCourses = [];
    const ASSISTANT_CONTAINER_SELECTOR = 'div[style*="border:1px solid #ccc"]';

    try {
      await page.waitForSelector(ASSISTANT_CONTAINER_SELECTOR, {
        timeout: 3000,
      });
      console.log("Elemen kelas asisten ditemukan. Mengambil data...");

      // Sekarang kita meneruskan argumen ke dalam callback
      assistantCourses = await page.$$eval(
        ASSISTANT_CONTAINER_SELECTOR, // Argumen 1: Selector
        (elements) => {
          // Argumen 2: Fungsi callback
          return elements
            .map((el) => {
              const titleEl = el.querySelector('div[style*="width:600px"] h2');
              const codeEl = el.querySelector('div[style*="width:80px"] h2');
              const linkEl = el.querySelector("a.button2.biru");
              if (titleEl && codeEl && linkEl) {
                return {
                  title: `[${codeEl.innerText.trim()}] ${titleEl.innerText.trim()}`,
                  link: linkEl.href,
                };
              }
              return null;
            })
            .filter((item) => item !== null);
        }
      );
    } catch (e) {
      console.log(
        "Tidak ditemukan bagian kelas sebagai asisten. Ini normal jika Anda bukan asisten."
      );
    }

    if (studentCourses.length === 0 && assistantCourses.length === 0) {
      await interaction.editReply(
        "Tidak ada mata kuliah yang ditemukan, baik sebagai mahasiswa maupun asisten."
      );
      if (browser) await browser.close();
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📚 Daftar Kelas di E-Class")
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();
    if (studentCourses.length > 0) {
      embed.addFields({
        name: "Kelas yang Diikuti (sebagai Mahasiswa)",
        value: studentCourses
          .map((course) => `• [${course.title}](${course.link})`)
          .join("\n"),
        inline: false,
      });
    }

    // Tambahkan field untuk kelas asisten jika ada
    if (assistantCourses.length > 0) {
      embed.addFields({
        name: "Kelas yang Diampu (sebagai Asisten)",
        value: assistantCourses
          .map((course) => `• [${course.title}](${course.link})`)
          .join("\n"),
        inline: false,
      });
    }
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error di handleDaftarKelasCommand:", error);
    await interaction.editReply(`❌ Terjadi kesalahan: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = handleDaftarKelasCommand;
