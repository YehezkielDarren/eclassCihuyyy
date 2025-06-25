// File: index.js
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");
require("dotenv").config();
const fs = require("fs");

// --- KONFIGURASI ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LOGIN_URL =
  process.env.LOGIN_URL || "https://eclass.ukdw.ac.id/e-class/id/";
const DASHBOARD_URL = "https://eclass.ukdw.ac.id/e-class/id/kelas/";
const COOKIES_DIR = "./cookies";

if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR);
  console.log(`Direktori cookies dibuat di: ${COOKIES_DIR}`);
}

const PUPPETEER_OPTIONS = {
  headless: true,
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
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36";

// --- Inisialisasi Bot ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Bot telah login sebagai ${client.user.tag}`);
  console.log("Bot siap menerima perintah slash command.");
});

async function performLogin(page, id, password, userCookiePath) {
  console.log(
    `Melakukan login untuk pengguna yang cookie-nya akan disimpan di ${userCookiePath}...`
  );
  await page.setUserAgent(USER_AGENT);
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

  const ID_SELECTOR = "[name='id']";
  const PASSWORD_SELECTOR = "[name='password']";
  const LOGIN_BUTTON_SELECTOR = ".button2.biru.kecil";

  // await page.waitForSelector(ID_SELECTOR, { timeout: 30000 });
  await page.type(ID_SELECTOR, id);
  await page.type(PASSWORD_SELECTOR, password);
  await Promise.all([
    page.click(LOGIN_BUTTON_SELECTOR),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  if (!page.url().includes("/kelas/")) {
    throw new Error(
      `❌ **Login Gagal** untuk \`${id}\`.\nPastikan ID dan password Anda benar.`
    );
  }

  console.log("Login berhasil. Menyimpan cookies...");
  const cookies = await page.cookies();
  fs.writeFileSync(userCookiePath, JSON.stringify(cookies, null, 2));
  console.log(`Cookies berhasil disimpan ke ${userCookiePath}.`);
}

client.on("interactionCreate", async (interaction) => {
  // Hanya proses jika interaksi adalah slash command
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "login-eclass") {
    handleLoginCommand(interaction);
  } else if (commandName == "daftar-kelas") {
    handleDaftarKelasCommand(interaction);
  } else if (commandName == "materi") {
    handleMateriCommand(interaction);
  } else if (commandName == "nilai") {
    handleNilaiCommand(interaction);
  }
});

async function handleNilaiCommand(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const userCookiePath = `${COOKIES_DIR}/${userId}.json`;
  const courseCode = interaction.options.getString("kode_matkul");
  const nilaiUrl = `https://eclass.ukdw.ac.id/e-class/id/kelas/nilai/${courseCode.toUpperCase()}`;

  let browser = null;
  try {
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    if (!fs.existsSync(userCookiePath)) {
      await interaction.editReply(
        "Sesi Anda tidak ditemukan. Silakan jalankan `/login-eclass` terlebih dahulu."
      );
      if (browser) await browser.close();
      return;
    }

    console.log(
      `Mencoba memuat sesi dari ${userCookiePath} untuk mengambil nilai...`
    );
    const cookies = JSON.parse(fs.readFileSync(userCookiePath));
    await page.setCookie(...cookies);

    await page.goto(nilaiUrl, { waitUntil: "networkidle2" });
    if (page.url().includes("login")) {
      await interaction.editReply(
        "Sesi Anda tidak valid atau sudah kadaluarsa. Silakan jalankan `/login-eclass` lagi."
      );
      if (browser) await browser.close();
      return;
    }

    console.log(
      `Berhasil masuk ke halaman nilai untuk ${courseCode}. Mengambil data...`
    );

    await page.waitForSelector("div#content-right > h1", { timeout: 15000 });
    
    // --- LOGIKA SCRAPING BARU YANG LEBIH AKURAT ---
    const gradeData = await page.evaluate(() => {
      const courseTitle =
        document.querySelector("div#content-right > h1")?.innerText.trim() ||
        "Judul Kelas Tidak Ditemukan";

      // Cari heading "Nilai Anda"
      const gradeHeader = Array.from(document.querySelectorAll("h2")).find(
        (h2) => h2.innerText.includes("Nilai Anda")
      );
      if (!gradeHeader) {
        // Jika tidak ada heading "Nilai Anda", kemungkinan halaman kosong
        const emptyNote = document.querySelector("table.data span.note");
        if (
          emptyNote &&
          (emptyNote.innerText.includes("Belum ada data nilai") ||
            emptyNote.innerText.includes("Belum ada item nilai"))
        ) {
          return { isEmpty: true, courseTitle };
        }
        return {
          isEmpty: true,
          courseTitle,
          components: [],
          finalGrade: "N/A",
          letterGrade: "N/A",
        };
      }

      // Tabel nilai adalah elemen berikutnya setelah heading tersebut
      let gradeTable = gradeHeader.nextElementSibling;
      while (gradeTable && gradeTable.tagName !== "TABLE") {
        gradeTable = gradeTable.nextElementSibling;
      }

      if (!gradeTable) {
        return {
          isEmpty: true,
          courseTitle,
          components: [],
          finalGrade: "N/A",
          letterGrade: "N/A",
        };
      }

      const components = [];
      let finalGrade = "N/A";
      let letterGrade = "N/A";
      const rows = gradeTable.querySelectorAll("tbody tr");

      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 2) return; // Skip baris tidak valid

        const firstCellText = cells[0].innerText.trim();

        // Cek untuk baris Nilai Akhir
        if (firstCellText.includes("Nilai")) {
          finalGrade = cells[2]?.innerText.trim() || "N/A";
          letterGrade =
            cells[3]?.innerText.replace("Huruf:", "").trim() || "N/A";
        }
        // Cek untuk baris komponen (bukan header dan bukan baris Total/Nilai)
        else if (
          cells.length >= 6 &&
          firstCellText !== "Nama Item" &&
          !firstCellText.includes("Total")
        ) {
          components.push({
            name: cells[0]?.innerText.trim(),
            weight: cells[1]?.innerText.trim(),
            score: cells[2]?.innerText.trim(),
          });
        }
      });

      return {
        isEmpty: components.length === 0 && finalGrade === "N/A",
        courseTitle,
        components,
        finalGrade,
        letterGrade,
      };
    });

    // --- MEMBUAT TAMPILAN EMBED ---
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71) // Warna hijau untuk nilai
      .setTitle(`Rincian Nilai: ${gradeData.courseTitle}`)
      .setURL(nilaiUrl)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (gradeData.isEmpty) {
      embed.setDescription("ℹ️ Belum ada data nilai untuk kelas ini.");
    } else {
      if (gradeData.components.length > 0) {
        const componentValue = gradeData.components
          .map(
            (c) => `**${c.name}** (Bobot: ${c.weight})\nNilai: **${c.score}**`
          )
          .join("\n\n");
        embed.addFields({ name: "📊 Komponen Nilai", value: componentValue });
      }

      const finalGradeValue = `**${gradeData.finalGrade}** (Nilai Huruf: **${gradeData.letterGrade}**)`;
      embed.addFields({ name: "🏆 Nilai Akhir", value: finalGradeValue });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(`Error di handleNilaiCommand untuk user ${userId}:`, error);
    await interaction.editReply(`❌ Terjadi kesalahan: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

async function handleLoginCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const userCookiePath = `${COOKIES_DIR}/${userId}.json`;
  const username = interaction.options.getString("username");
  const password = interaction.options.getString("password");
  let browser = null;
  try {
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
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

async function handleMateriCommand(interaction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const userCookiePath = `${COOKIES_DIR}/${userId}.json`;
  const kodeMatkul = interaction.options.getString("kode_matkul");
  const MATERI_URL = `https://eclass.ukdw.ac.id/e-class/id/materi/index/${kodeMatkul.toUpperCase()}`;

  let browser = null;
  try {
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

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

async function handleDaftarKelasCommand(interaction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const userCookiePath = `${COOKIES_DIR}/${userId}.json`;
  let browser = null;
  try {
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    if (fs.existsSync(userCookiePath)) {
      console.log(`Mencoba memuat sesi dari ${userCookiePath}...`);
      const cookies = JSON.parse(fs.readFileSync(userCookiePath));
      await page.setCookie(...cookies);
    }

    // Kunjungi halaman dashboard dan cek apakah sesi valid
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle2" });
    if (!page.url().includes("/kelas/")) {
      // Jika dialihkan ke halaman login, berarti cookies tidak valid.
      // Minta pengguna untuk login terlebih dahulu.
      await interaction.editReply(
        "Sesi Anda tidak valid atau belum ada. Silakan jalankan `/login-eclass` terlebih dahulu."
      );
      return; // Hentikan eksekusi
    }
    console.log("Sesi valid. Mengambil daftar kelas...");

    // GANTI SELECTOR INI DENGAN TEMUAN ANDA
    const COURSE_CONTAINER_SELECTOR = "div.kelas_box";

    // Tunggu hingga kontainer pertama muncul
    await page.waitForSelector(COURSE_CONTAINER_SELECTOR, { timeout: 15000 });

    // scrapping element html daftar kelas
    const studentCourses = await page.$$eval(
      COURSE_CONTAINER_SELECTOR,
      (elements) => {
        return elements.map((el) => {
          // el adalah class "kelas_box"
          const titleEl = el.querySelector("h2");
          const linkEl = el.closest("a");

          return {
            title: titleEl ? titleEl.innerText.trim() : "Judul tidak ditemukan",
            link: linkEl ? linkEl.href : "#",
          };
        });
      }
    );
    console.log(`Ditemukan ${studentCourses.length} kelas sebagai mahasiswa.`);

    let assistantCourses = [];
    const ASSISTANT_CONTAINER_SELECTOR = 'div[style*="border:1px solid #ccc"]';

    try {
      await page.waitForSelector(ASSISTANT_CONTAINER_SELECTOR, {
        timeout: 15000,
      });
      console.log("Elemen kelas asisten ditemuka. Mengambil data...");

      assistantCourses = await page.$$eval(
        ASSISTANT_CONTAINER_SELECTOR,
        (elements) => {
          return elements
            .map((el) => {
              const titleEl = el.querySelector('div[style*="width:600px"] h2');
              const codeEl = el.querySelector('div[style*="width:80px"] h2');
              const linkEl = el.querySelector("a.button2.biru"); // Link "Detail Kelas"

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
      console.log(
        `Ditemukan ${assistantCourses.length} kelas sebagai asisten.`
      );
    } catch (err) {
      console.log(
        "Tidak ditemukan bagian kelas sebagai asisten. Melanjutkan..."
      );
    }

    if (studentCourses.length === 0 && assistantCourses.length === 0) {
      await interaction.editReply(
        "Tidak ada mata kuliah yang ditemukan, baik sebagai mahasiswa maupun asisten."
      );
      if (browser) await browser.close();
      return;
    }

    // Buat embed untuk menampilkan hasil
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📚 Daftar Mata Kuliah Anda")
      .setDescription(
        "Berikut adalah semua kelas yang terdaftar di akun E-Class Anda."
      )
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
    console.error(error);
    await interaction.editReply(
      `❌ Terjadi kesalahan saat mengambil daftar kelas: ${error.message}`
    );
  } finally {
    if (browser) await browser.close();
  }
}

// Jalankan bot
client.login(DISCORD_TOKEN);
