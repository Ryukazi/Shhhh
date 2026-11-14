const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "monitor",
    aliases: ["m"],
    version: "2.0",
    author: "Denish",
    role: 0,
    shortDescription: {
      en: "Displays bot uptime, ping, and a random anime image."
    },
    longDescription: {
      en: "Shows bot uptime, response ping, and a random anime picture."
    },
    category: "info",
    guide: {
      en: "Use {p}monitor to check uptime, ping, and get a random anime image."
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
      // Fetch images from the new Dens Pinterest API.
      const apiUrl =
        "https://dens-pin-api.vercel.app/api/pinterest-images";

      const res = await axios.get(apiUrl, {
        params: { query: randomSearch },
        timeout: 30000
      });

      const images = res.data?.images || [];

      if (
        res.data?.status !== true ||
        !Array.isArray(images) ||
        images.length === 0
      ) {
        return api.sendMessage(
          "❌ No anime images found from Pinterest API.",
          event.threadID,
          event.messageID
        );
      }

      // Select a random result.
      const selected =
        images[Math.floor(Math.random() * images.length)];

      if (!selected?.url) {
        throw new Error("Invalid image URL received");
      }

      // Download the actual JPG image.
      const imgResponse = await axios.get(selected.url, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxRedirects: 5
      });

      const contentType =
        imgResponse.headers["content-type"] || "";

      if (!contentType.includes("image/")) {
        throw new Error("Pinterest API did not return an image");
      }

      // Save image to cache.
      await fs.ensureDir(cacheDir);
      await fs.outputFile(imgPath, imgResponse.data);

      // Calculate uptime.
      const uptimeSec = Math.floor(process.uptime());

      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      let uptimeStr =
        `${days} days, ${hours} hours, ` +
        `${minutes} minutes, ${seconds} seconds`;

      if (days === 0) {
        uptimeStr =
          `${hours} hours, ${minutes} minutes, ${seconds} seconds`;
      }

      if (days === 0 && hours === 0) {
        uptimeStr = `${minutes} minutes, ${seconds} seconds`;
      }

      if (days === 0 && hours === 0 && minutes === 0) {
        uptimeStr = `${seconds} seconds`;
      }

      // Calculate command response time.
      const ping = Date.now() - startTime;

      const animeName =
        randomSearch.charAt(0).toUpperCase() +
        randomSearch.slice(1);

      // Send monitor information and image.
      await api.sendMessage(
        {
          body:
            `👋 Hello! Your bot has been running for:\n` +
            `⏱️ Uptime: ${uptimeStr}\n\n` +
            `📡 Current Ping: ${ping}ms\n` +
            `🎨 Random Anime Pic: ${animeName}\n` +
            `🖼️ Image: ${images.length} results available`,
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
        "⚠️ An error occurred while fetching monitor information.",
        event.threadID,
        event.messageID
      );

    } finally {
      // Remove temporary image.
      await fs.unlink(imgPath).catch(() => {});
    }
  }
};
