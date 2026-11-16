const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

module.exports = {
config: {
name: "monitor",
aliases: ["m"],
version: "3.0",
author: "Denish",
role: 0,
shortDescription: {
en: "Displays bot system information and a random anime image."
},
longDescription: {
en: "Shows uptime, ping, RAM usage, Node.js version and platform."
},
category: "info",
guide: {
en: "Use {p}monitor to check bot system status."
}
},

onStart: async function ({ api, event }) {
const startTime = Date.now();

const searchList = [
  "lelouch",
  "tanjiro",
  "ichigo",
  "aizen",
  "luffy",
  "zoro"
];

const randomSearch =
  searchList[Math.floor(Math.random() * searchList.length)];

const cacheDir = path.join(__dirname, "cache");
const imgPath = path.join(
  cacheDir,
  `monitor_${Date.now()}.jpg`
);

try {
  // Fetch random anime image.
  const res = await axios.get(
    "https://dens-pin-api.vercel.app/api/pinterest-images",
    {
      params: { query: randomSearch },
      timeout: 30000
    }
  );

  const images = res.data?.images || [];

  if (
    res.data?.status !== true ||
    !Array.isArray(images) ||
    images.length === 0
  ) {
    throw new Error("No anime images found");
  }

  const selected =
    images[Math.floor(Math.random() * images.length)];

  if (!selected?.url) {
    throw new Error("Invalid image URL");
  }

  // Download image.
  const imgResponse = await axios.get(selected.url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxRedirects: 5
  });

  const contentType =
    imgResponse.headers["content-type"] || "";

  if (!contentType.toLowerCase().includes("image/")) {
    throw new Error("Invalid image response");
  }

  await fs.ensureDir(cacheDir);
  await fs.outputFile(imgPath, imgResponse.data);

  // Calculate uptime.
  const uptimeSec = Math.floor(process.uptime());

  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;

  const uptimeStr = [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    `${seconds}s`
  ].filter(Boolean).join(" ");

  // Calculate command response time.
  const ping = Date.now() - startTime;

  // RAM usage.
  const memory = process.memoryUsage();
  const ramUsage = (memory.rss / 1024 / 1024).toFixed(1);

  // Additional system information.
  const nodeVersion = process.version;
  const platform = os.platform();

  // Build monitor dashboard.
  const message =
    `╭────────────────────╮\n` +
    `       SYSTEM MONITOR\n` +
    `╰────────────────────╯\n\n` +

    `  ◉  STATUS\n` +
    `     Online\n\n` +

    `  ◷  UPTIME\n` +
    `     ${uptimeStr}\n\n` +

    `  ↯  RESPONSE TIME\n` +
    `     ${ping} ms\n\n` +

    `  ▣  RAM USAGE\n` +
    `     ${ramUsage} MB\n\n` +

    `  ⚙  NODE.JS\n` +
    `     ${nodeVersion}\n\n` +

    `  ◈  PLATFORM\n` +
    `     ${platform}\n\n` +

    `  ──────────────────\n` +
    `     SERVICE RUNNING`;

  await api.sendMessage(
    {
      body: message,
      attachment: fs.createReadStream(imgPath)
    },
    event.threadID,
    event.messageID
  );

} catch (error) {
  console.error(
    "Monitor command error:",
    error.response?.data || error.message || error
  );

  return api.sendMessage(
    "❌ Unable to fetch monitor information. Please try again later.",
    event.threadID,
    event.messageID
  );

} finally {
  await fs.unlink(imgPath).catch(() => {});
}

}
};
