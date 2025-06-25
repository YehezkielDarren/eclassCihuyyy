const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config.js");

// Membuat direktori cookies jika belum ada
if (!fs.existsSync(config.COOKIES_FOLDER_NAME)) {
  fs.mkdirSync(config.COOKIES_FOLDER_NAME);
  console.log(`Direktori cookies dibuat di: ${config.COOKIES_FOLDER_NAME}`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Membuat koleksi untuk menyimpan semua perintah
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

// Petakan nama file ke nama perintah slash command
const commandMapping = {
  "login.js": "login-eclass",
  "kelas.js": "daftar-kelas",
  "materi.js": "materi",
  "nilai.js": "nilai",
  "logout.js": "logout",
};

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const commandHandler = require(filePath);
  const commandName = commandMapping[file];

  if (commandName) {
    client.commands.set(commandName, commandHandler);
    console.log(`Perintah berhasil dimuat: /${commandName}`);
  } else {
    console.log(`[PERINGATAN] File perintah ${file} tidak memiliki mapping.`);
  }
}

// --- LISTENER UTAMA ---
client.once("ready", () => {
  console.log(`Bot telah login sebagai ${client.user.tag}`);
  console.log("Bot siap menerima perintah!");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Dapatkan fungsi handler dari koleksi berdasarkan nama perintah yang masuk
  const commandHandler = client.commands.get(interaction.commandName);

  if (!commandHandler) {
    console.error(
      `Tidak ada handler ditemukan untuk perintah: ${interaction.commandName}`
    );
    await interaction.reply({
      content: "Terjadi kesalahan, perintah tidak ditemukan.",
      ephemeral: true,
    });
    return;
  }

  try {
    await commandHandler(interaction);
  } catch (error) {
    console.error(
      `Error saat menjalankan perintah ${interaction.commandName}:`,
      error
    );
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Terjadi kesalahan saat menjalankan perintah ini!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "Terjadi kesalahan saat menjalankan perintah ini!",
        ephemeral: true,
      });
    }
  }
});

// Jalankan bot
client.login(config.DISCORD_TOKEN);
