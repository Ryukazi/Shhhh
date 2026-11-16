
const axios = require("axios");

module.exports.config = {
  name: "help",
  version: "5.0",
  author: "Lord Denish",
  role: 0,
  category: "info",
  shortDescription: "Advanced command information",
  longDescription: "Displays all commands or detailed information about a specific command.",
  guide: "{p}help [command]"
};

module.exports.onStart = async function ({ api, event, args }) {
  try {
    const commands = global.GoatBot?.commands;

    if (!commands) {
      return api.sendMessage(
        "ERROR: Cannot find command list.",
        event.threadID,
        event.messageID
      );
    }

    const prefix =
      global.GoatBot?.config?.prefix ||
      global.GoatBot?.config?.PREFIX ||
      global.GoatBot?.config?.commandPrefix ||
      "{p}";

    // FIND COMMAND MODE
    if (args && args.length > 0) {
      const searchName = args[0].toLowerCase();

      let found = null;
      let commandName = "";

      for (const [name, info] of commands.entries()) {
        const aliases = info.config?.aliases || [];

        if (
          name.toLowerCase() === searchName ||
          aliases.some(alias =>
            String(alias).toLowerCase() === searchName
          )
        ) {
          found = info;
          commandName = name;
          break;
        }
      }

      if (!found) {
        return api.sendMessage(
          `COMMAND NOT FOUND: ${searchName}\n\nUse ${prefix}help to see all commands.`,
          event.threadID,
          event.messageID
        );
      }

      const config = found.config || {};

      const description =
        config.longDescription ||
        config.shortDescription ||
        "No description available.";

      const shortDescription =
        config.shortDescription || "Not provided";

      const aliases = config.aliases || [];

      const guide = config.guide
        ? String(config.guide).replace(/\{p\}/g, prefix)
        : `${prefix}${commandName}`;

      const role = config.role ?? 0;

      const detail =
`╭──────────────────────────╮
│    COMMAND INFORMATION  │
╰──────────────────────────╯

NAME        : ${commandName}
AUTHOR      : ${config.author || "Unknown"}
VERSION     : ${config.version || "Unknown"}
CATEGORY    : ${config.category || "Others"}
ROLE        : ${role}

SHORT DESCRIPTION
${shortDescription}

FULL DESCRIPTION
${description}

ALIASES
${aliases.length ? aliases.join(", ") : "None"}

USAGE GUIDE
${guide}

STATUS      : AVAILABLE`;

      return api.sendMessage(
        detail,
        event.threadID,
        event.messageID
      );
    }

    // ALL COMMANDS MODE

    const up = Math.floor(process.uptime());

    const d = Math.floor(up / 86400);
    const h = Math.floor((up % 86400) / 3600);
    const m = Math.floor((up % 3600) / 60);
    const s = up % 60;

    const uptime = [
      d > 0 ? `${d}d` : null,
      h > 0 ? `${h}h` : null,
      m > 0 ? `${m}m` : null,
      `${s}s`
    ].filter(Boolean).join(" ");

    const groups = {};

    for (const [name, info] of commands.entries()) {
      const category = info.config?.category || "Others";

      if (!groups[category]) groups[category] = [];

      groups[category].push(name);
    }

    let text = "";

    text += "╭────────────────────────╮\n";
    text += "│   root@Goatbotv2:~     │\n";
    text += "╰────────────────────────╯\n\n";

    text += "SYSTEM INFORMATION\n";
    text += "────────────────────────\n";
    text += `COMMANDS   : ${commands.size}\n`;
    text += `CATEGORIES : ${Object.keys(groups).length}\n`;
    text += `UPTIME     : ${uptime}\n`;
    text += `STATUS     : RUNNING\n`;
    text += `PREFIX     : ${prefix}\n\n`;

    text += "AVAILABLE COMMANDS\n";
    text += "────────────────────────\n\n";

    const sortedGroups = Object.entries(groups).sort(
      ([a], [b]) => a.localeCompare(b)
    );

    for (const [category, cmds] of sortedGroups) {
      const sortedCommands = cmds.sort((a, b) =>
        a.localeCompare(b)
      );

      text += `[ ${category.toUpperCase()} ]\n`;

      sortedCommands.forEach((name, index) => {
        text += `${String(index + 1).padStart(2, "0")}. ${name}\n`;
      });

      text += "\n";
    }

    text += "USAGE GUIDE\n";
    text += "────────────────────────\n";
    text += `Prefix  : ${prefix}\n`;
    text += `Example : ${prefix}help\n`;
    text += `Details : ${prefix}help autolink\n`;

    // RANDOM PINTEREST IMAGE

    const topics = [
      "ichigo", "luffy", "aizen", "shi hao",
      "zoro", "sanji", "shinji", "goku",
      "k dash", "tokyo", "samurai",
      "retro aesthetic", "night city",
      "dragon", "black wallpaper",
      "mountains", "sky aesthetic",
      "flowers", "fog aesthetic",
      "magical fantasy"
    ];

    let imageStream = null;

    try {
      const topic =
        topics[Math.floor(Math.random() * topics.length)];

      const pin = await axios.get(
        "https://dens-pin-api.vercel.app/api/pinterest-images",
        {
          params: { query: topic },
          timeout: 15000,
          headers: { "User-Agent": "Mozilla/5.0" }
        }
      );

      const images = pin.data?.images || [];

      if (pin.data?.status === true && images.length > 0) {
        const selected =
          images[Math.floor(Math.random() * images.length)];

        if (selected?.url) {
          const response = await axios.get(selected.url, {
            responseType: "stream",
            timeout: 20000,
            maxRedirects: 5,
            headers: { "User-Agent": "Mozilla/5.0" }
          });

          const contentType =
            response.headers["content-type"] || "";

          if (contentType.toLowerCase().includes("image/")) {
            imageStream = response.data;
          } else {
            response.data.destroy();
          }
        }
      }
    } catch (err) {
      console.log("[HELP IMAGE ERROR]", err.message);
    }

    if (imageStream) {
      return api.sendMessage(
        {
          body: text.trimEnd(),
          attachment: imageStream
        },
        event.threadID,
        event.messageID
      );
    }

    return api.sendMessage(
      text.trimEnd(),
      event.threadID,
      event.messageID
    );

  } catch (error) {
    console.log("[HELP ERROR]", error);

    return api.sendMessage(
      "ERROR: Failed to load help menu.",
      event.threadID,
      event.messageID
    );
  }
};
