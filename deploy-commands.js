// File: deploy-commands.js
const { REST, Routes } = require("discord.js");
require("dotenv").config();

// Ganti dengan informasi bot Anda
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commands = [
  {
    name: "login-eclass",
    description: "Mencoba login ke situs E-Class UKDW.",
    options: [
      {
        name: "username",
        type: 3, // Tipe 3 adalah STRING
        description: "Username atau ID Mahasiswa/Staf Anda.",
        required: true,
      },
      {
        name: "password",
        type: 3, // Tipe 3 adalah STRING
        description: "Password E-Class Anda.",
        required: true,
      },
    ],
  },
  {
    name: "daftar-kelas",
    description:
      "Menampilkan daftar matakuliah anda dalam semester ini di E-Class UKDW.",
  },
  {
    name: "materi",
    description: "Menampilkan daftar materi dari sebuah mata kuliah.",
    options: [
      {
        name: "kode_matkul",
        type: 3,
        description:
          "Kode mata kuliah yang ingin dilihat materinya (contoh: TI0243).",
        required: true,
      },
    ],
  },
  {
    name: "nilai",
    description: "Menampilkan rincian nilai dari sebuah mata kuliah.",
    options: [
      {
        name: "kode_matkul",
        type: 3, // STRING
        description:
          "Kode mata kuliah yang ingin dilihat nilainya (contoh: TI0243).",
        required: true,
      },
    ],
  },
  {
    name: "logout",
    description: "Menghapus sesi (cookie) Anda dari bot.",
  },
];

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log("Memulai mendaftarkan slash commands...");

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log("Slash commands berhasil didaftarkan!");
  } catch (error) {
    console.error(error);
  }
})();
