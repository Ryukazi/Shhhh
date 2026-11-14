
const axios = require("axios");

module.exports.config = {
  name: "help",
  version: "3.2",
  author: "Lord Denish",
  role: 0,
  category: "info",
  shortDescription: "Clean structured help",
  longDescription: "Shows all commands in long, record-style list",
  guide: "{p}help"
};

module.exports.onStart = async function ({ api, event }) {
  try {
    // UPTIME
    const up = process.uptime();
    const h = Math.floor(up / 3600);
    const m = Math.floor((up % 3600) / 60);
    const s = Math.floor(up % 60);
    const uptime = `${h}h ${m}m ${s}s`;

    // COMMAND LIST
    const commands = global.GoatBot?.commands;

    if (!commands) {
      return api.sendMessage(
        "❌ Cannot find command list.",
        event.threadID,
        event.messageID
      );
    }

    const groups = {};

    for (const [name, info] of commands.entries()) {
      const cat = info.config.category || "Others";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(name);
    }

    // HELP MENU
    let text = "";
    text += "================ HELP MENU ================\n";
    text += `Bot Owner : Lord Denish\n`;
    text += `Total Cmds: ${commands.size}\n`;
    text += `Uptime    : ${uptime}\n`;
    text += "===========================================\n\n";

    for (const [cat, cmds] of Object.entries(groups)) {
      text += `== ${cat.toUpperCase()} ==\n`;
      text += cmds.sort().map(c => `• ${c}`).join("\n");
      text += "\n\n-------------------------------------------\n\n";
    }

    text += "================= END =====================";

    // RANDOM IMAGE TOPICS
    const topics = [
      "ichigo", "luffy", "Aizen", "Shi hao", "Zoro", "Sanji",
      "sinji", "goku", "k dash", "tokyo", "samurai", "retro",
      "night city", "dragon", "black wallpaper", "mountains", "sky",
      "flowers", "fog", "magical fantasy"
    ];

    let imageStream = null;

    // TRY PINTEREST IMAGE
    try {
      const topic = topics[Math.floor(Math.random() * topics.length)];

      const pin = await axios.get(
        `https://dens-pin-api.vercel.app/api/pinterest-images?query=${encodeURIComponent(topic)}`,
        {
          timeout: 15000,
          headers: { "User-Agent": "Mozilla/5.0" }
        }
      );

      const images = pin.data?.images || [];

      if (pin.data?.status && images.length > 0) {
        const selected = images[Math.floor(Math.random() * images.length)];

        if (selected?.url) {
          const response = await axios.get(selected.url, {
            responseType: "stream",
            timeout: 20000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });

          const contentType = response.headers["content-type"] || "";

          if (contentType.includes("image/")) {
            imageStream = response.data;
          } else {
            response.data.destroy();
          }
        }
      }
    } catch (imageError) {
      console.log("[HELP IMAGE ERROR]", imageError.message);
    }

    // SEND WITH IMAGE OR TEXT ONLY
    if (imageStream) {
      return api.sendMessage(
        {
          body: text,
          attachment: imageStream
        },
        event.threadID,
        event.messageID
      );
    }

    // IMAGE FAILED: SEND HELP MENU WITHOUT IMAGE
    return api.sendMessage(
      text,
      event.threadID,
      event.messageID
    );

  } catch (error) {
    console.log("[HELP ERROR]", error);

    return api.sendMessage(
      "❌ Failed to load help menu.",
      event.threadID,
      event.messageID
    );
  }
};
