
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const API_URL = "https://apis.emmyhenztech.name.ng/api/spotidown";
const CACHE_DIR = path.join(__dirname, "cache");

module.exports = {
  config: {
    name: "spotify",
    aliases: ["sp", "music"],
    version: "1.0.0",
    author: "Denish",
    countDown: 10,
    role: 0,
    shortDescription: "Send Spotify audio",
    longDescription: "Search Spotify and send audio only.",
    category: "Music",
    guide: {
      en: "{pn} <song name or Spotify URL>"
    }
  },

  onStart: async function ({ args, event, api }) {
    const query = args.join(" ").trim();

    if (!query) return;

    let filePath;

    try {
      await fs.ensureDir(CACHE_DIR);

      const response = await axios.get(API_URL, {
        params: { url: query },
        timeout: 30000
      });

      const data = response.data;

      if (!data?.status || !data.result) {
        throw new Error("Spotify search failed");
      }

      const result = data.result;

      // Only use an actual download URL supplied by the API.
      let audioUrl = result.first_track_download;

      // Some responses may provide a direct track URL.
      if (!audioUrl && result.download_url) {
        audioUrl = result.download_url;
      }

      if (!audioUrl) {
        throw new Error("No audio download URL available");
      }

      filePath = path.join(
        CACHE_DIR,
        `spotify_${Date.now()}.mp3`
      );

      const audioResponse = await axios.get(audioUrl, {
        responseType: "stream",
        timeout: 60000
      });

      const contentType =
        audioResponse.headers["content-type"] || "";

      if (
        !contentType.includes("audio") &&
        !contentType.includes("octet-stream")
      ) {
        throw new Error("The download URL did not return audio");
      }

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);

        audioResponse.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
        audioResponse.data.on("error", reject);
      });

      if (!(await fs.pathExists(filePath))) {
        throw new Error("Audio file was not created");
      }

      const stats = await fs.stat(filePath);

      if (stats.size < 1000) {
        throw new Error("Audio file is invalid");
      }

      await api.sendMessage(
        {
          attachment: fs.createReadStream(filePath)
        },
        event.threadID,
        undefined,
        event.messageID
      );

    } catch (error) {
      console.error("[SPOTIFY]", error.message);
    } finally {
      if (filePath) {
        await fs.remove(filePath).catch(() => {});
      }
    }
  }
};
        
