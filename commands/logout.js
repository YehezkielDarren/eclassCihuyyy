const fs = require("fs");
const path = require("path");
const config = require("../config.js");

async function handdleLogoutCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const userCookiePath = `${config.COOKIES_FOLDER_NAME}/${userId}.json`;

  if (fs.existsSync(userCookiePath)) {
    try {
      // Hapus file cookie
      fs.unlinkSync(userCookiePath);
      console.log(`Sesi untuk pengguna ${userId} telah dihapus.`);
      await interaction.editReply({
        content:
          "✅ Anda telah berhasil logout. Sesi dan file cookie Anda telah dihapus dari bot.",
      });
    } catch (error) {
      console.error(`Gagal menghapus cookie untuk pengguna ${userId}:`, error);
      await interaction.editReply({
        content:
          "❌ Terjadi kesalahan saat mencoba menghapus sesi Anda. Silakan hubungi admin bot.",
      });
    }
  } else {
    console.log(
      `Pengguna ${userId} mencoba logout tetapi tidak memiliki sesi.`
    );
    await interaction.editReply({
      content:
        "ℹ️ Anda saat ini tidak sedang login. Tidak ada sesi yang perlu dihapus.",
    });
  }
}

module.exports = handdleLogoutCommand;
