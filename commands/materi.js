const { EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const config = require("../config.js");

puppeteer.use(StealthPlugin());

async function handleMateriCommand(interaction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const userCookiePath = `${config.COOKIES_FOLDER_NAME}/${userId}.json`;
  const kodeMatkul = interaction.options.getString("kode_matkul");
  const MATERI_URL = `https://eclass.ukdw.ac.id/e-class/id/materi/index/${kodeMatkul.toUpperCase()}`;

  let browser = null;
  try {
    browser = await puppeteer.launch(config.PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setUserAgent(config.USER_AGENT);

    if (!fs.existsSync(userCookiePath)) {
      await interaction.editReply(
        "Sesi Anda tidak ditemukan. Silakan jalankan `/login-eclass` terlebih dahulu."
      );
      if (browser) await browser.close();
      return;
    }

    console.log(
      `Mencoba memuat sesi dari ${userCookiePath} untuk mengambil materi...`
    );
    const cookies = JSON.parse(fs.readFileSync(userCookiePath));
    await page.setCookie(...cookies);

    await page.goto(MATERI_URL, { waitUntil: "networkidle2" });
    if (page.url().includes("login")) {
      await interaction.editReply(
        "Sesi Anda tidak valid atau sudah kadaluarsa. Silakan jalankan `/login-eclass` lagi."
      );
      if (browser) await browser.close();
      return;
    }

    console.log(
      `Berhasil masuk ke halaman materi untuk ${kodeMatkul}. Mengambil data...`
    );

    // Logika scraping berdasarkan file HTML yang Anda berikan
    const materials = await page.evaluate(() => {
      const data = [];
      // Cari heading <h2> yang mengandung kata "Materi"
      const materiHeader = Array.from(document.querySelectorAll("h2")).find(
        (h2) => h2.innerText.includes("Materi")
      );

      if (!materiHeader) return []; // Jika tidak ada heading Materi, kembalikan array kosong

      // Tabel materi adalah elemen berikutnya setelah heading tersebut
      let currentElement = materiHeader.nextElementSibling;
      while (currentElement && currentElement.tagName !== "TABLE") {
        currentElement = currentElement.nextElementSibling;
      }

      const materialTable = currentElement;

      if (!materialTable || materialTable.tagName !== "TABLE") return [];

      const rows = Array.from(materialTable.querySelectorAll("tbody tr"));

      // Skip baris pertama (header tabel)
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll("td");
        if (cells.length < 4) continue; // Skip baris yang tidak valid

        const titleEl = cells[1].querySelector("b");
        const linkEl = cells[3].querySelector("a");

        if (titleEl && linkEl) {
          data.push({
            title: titleEl.innerText.trim(),
            link: linkEl.href,
            fileInfo: cells[2].innerText.trim().replace(/\s+/g, " "), // Ambil info file (jenis & ukuran)
          });
        }
      }
      return data;
    });

    if (materials.length === 0) {
      await interaction.editReply(
        `Tidak ada materi yang ditemukan untuk mata kuliah \`${kodeMatkul.toUpperCase()}\`. Pastikan kode mata kuliah benar dan halaman materi tidak kosong.`
      );
      if (browser) await browser.close();
      return;
    }

    const courseTitle = await page.$eval("div#content-right > h1", (el) =>
      el.innerText.trim()
    );

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`Materi untuk ${courseTitle}`)
      .setURL(MATERI_URL)
      .setTimestamp();

    materials.forEach((materi) => {
      embed.addFields({
        name: `📁 ${materi.title}`,
        value: `[Download](${materi.link}) (${materi.fileInfo})`,
        inline: false,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(`Error di handleMateriCommand untuk user ${userId}:`, err);
    await interaction.editReply(`❌ Terjadi kesalahan: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = handleMateriCommand;
