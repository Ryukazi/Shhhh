
const axios = require("axios");
const { Readable } = require("stream");

module.exports = {
  config: {
    name: "anime",
    aliases: ["animes", "animeheaven"],
    version: "2.0.0",
    author: "Denish",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Search anime with poster images"
    },
    longDescription: {
      en: "Search AnimeHeaven and receive anime posters, IDs and links."
    },
    category: "Anime",
    guide: {
      en: "{pn} <anime name>"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const query = args.join(" ").trim();

    if (!query) {
      return message.reply(
        "🎌 ANIME SEARCH\n\n" +
        "Please enter an anime name.\n\n" +
        "Example: ,anime Bleach"
      );
    }

    const apiURL =
      "https://apis.emmyhenztech.name.ng/api/animeheaven-search?query=" +
      encodeURIComponent(query);

    try {
      const response = await axios.get(apiURL, {
        timeout: 20000,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const data = response.data;

      if (!data.status || !data.result) {
        return message.reply("❌ Anime search failed.");
      }

      const results = data.result.results || [];

      if (!results.length) {
        return message.reply(
          `❌ No anime found for "${query}".`
        );
      }

      await new Promise((resolve, reject) => {
        api.sendMessage(
          `🎌 ANIME SEARCH RESULTS\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🔎 Search: ${query}\n` +
          `📚 Results: ${results.length}\n` +
          `━━━━━━━━━━━━━━━━━━`,
          event.threadID,
          err => err ? reject(err) : resolve(),
          event.messageID
        );
      });

      let sent = 0;
      let failed = 0;

      for (let i = 0; i < results.length; i++) {
        const anime = results[i];

        const caption =
          `🎌 ${anime.title}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🔢 Result: ${i + 1}/${results.length}\n` +
          `🆔 Anime ID: ${anime.id}\n` +
          `🔗 Watch: ${anime.url}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `Powered by Denish`;

        try {
          const imageResponse = await axios.get(
            anime.thumbnail,
            {
              responseType: "arraybuffer",
              timeout: 20000,
              headers: {
                "User-Agent": "Mozilla/5.0"
              },
              maxContentLength: 10 * 1024 * 1024
            }
          );

          const contentType =
            imageResponse.headers["content-type"] || "";

          if (!contentType.startsWith("image/")) {
            throw new Error("Invalid image response");
          }

          const buffer = Buffer.from(imageResponse.data);

          if (!buffer.length) {
            throw new Error("Empty image");
          }

          const attachment = Readable.from(buffer);

          attachment.path = `anime-${anime.id}.jpg`;

          await new Promise((resolve, reject) => {
            api.sendMessage(
              {
                body: caption,
                attachment
              },
              event.threadID,
              err => err ? reject(err) : resolve(),
              event.messageID
            );
          });

          sent++;

        } catch (imageError) {
          failed++;

          console.error(
            `Anime image error (${anime.id}):`,
            imageError.message
          );

          await new Promise(resolve => {
            api.sendMessage(
              caption +
              "\n\n⚠️ Poster image unavailable.",
              event.threadID,
              () => resolve(),
              event.messageID
            );
          });
        }
      }

      return message.reply(
        `✅ ANIME SEARCH COMPLETED\n\n` +
        `🎌 Search: ${query}\n` +
        `🖼️ Images sent: ${sent}\n` +
        `⚠️ Image failures: ${failed}\n` +
        `📚 Total results: ${results.length}`
      );

    } catch (error) {
      console.error("Anime Command Error:", error);

      return message.reply(
        "❌ Failed to search anime.\n" +
        "Please try again later."
      );
    }
  }
};
