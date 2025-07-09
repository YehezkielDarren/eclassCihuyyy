const { EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const config = require("../config.js");

puppeteer.use(StealthPlugin());

async function handleNilaiCommand(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const userCookiePath = `${config.COOKIES_FOLDER_NAME}/${userId}.json`;
  const courseCode = interaction.options.getString("kode_matkul");
  const nilaiUrl = `https://eclass.ukdw.ac.id/e-class/id/kelas/nilai/${courseCode.toUpperCase()}`;

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

module.exports = handleNilaiCommand;
