const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { parse } = require("url");

module.exports = {
  config: {
    name: "autodown",
    version: "7.0",
    author: "ItachiXD",
    countDown: 5,
    role: 0,
    shortDescription: "Auto-download social media videos",
    longDescription:
      "Automatically downloads videos from TikTok, YouTube, Instagram, Facebook, X, Pinterest and other supported platforms using SOCIALDL APIs.",
    category: "media",
    guide: "Send any supported video link directly in chat."
  },

  onStart: async () => {},

  onChat: async function ({ event, api }) {
    let filePath = null;

    try {
      const text = event.body || "";

      const urlMatch = text.match(/https?:\/\/[^\s]+/i);
      if (!urlMatch) return;

      const url = urlMatch[0].replace(/[),.!?]+$/, "");

      let parsed;

      try {
        parsed = new URL(url);
      } catch {
        return;
      }

      if (!["http:", "https:"].includes(parsed.protocol)) {
        return;
      }

      const hostname = parsed.hostname.toLowerCase();

      // Detect platform
      let platform = "social";

      if (
        hostname.includes("youtube.com") ||
        hostname.includes("youtu.be")
      ) {
        platform = "youtube";
      } else if (
        hostname.includes("tiktok.com")
      ) {
        platform = "tiktok";
      }

      // Starting reaction
      api.setMessageReaction(
        "🪄",
        event.messageID,
        () => {},
        true
      );

      // Get download information
      const data = await getDownloadData(url, platform);

      if (!data || !data.download_url) {
        throw new Error("No downloadable video found.");
      }

      const videoUrl = data.download_url;

      if (!/^https?:\/\//i.test(videoUrl)) {
        throw new Error("Invalid download URL.");
      }

      // Cache folder
      const cacheDir = path.join(__dirname, "cache");

      await fs.promises.mkdir(cacheDir, {
        recursive: true
      });

      filePath = path.join(
        cacheDir,
        `video_${Date.now()}.mp4`
      );

      // Download video
      const response = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 87000000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"
        }
      });

      const buffer = Buffer.from(response.data);

      // 87 MB limit
      if (buffer.length > 87000000) {
        throw new Error("Video exceeds the 87 MB limit.");
      }

      if (!buffer.length) {
        throw new Error("Downloaded file is empty.");
      }

      // Save video
      await fs.promises.writeFile(filePath, buffer);

      // Success reaction
      api.setMessageReaction(
        "✅",
        event.messageID,
        () => {},
        true
      );

      // Reply with video
      api.sendMessage(
        {
          body: `✅ Downloaded Successfully\n\nPlatform: ${data.platform || platform}\n${data.title ? "Title: " + data.title : ""}`,
          attachment: fs.createReadStream(filePath)
        },
        event.threadID,
        async () => {
          try {
            await fs.promises.unlink(filePath);
          } catch (error) {
            console.error("Cache cleanup error:", error.message);
          }

          api.setMessageReaction(
            "✅",
            event.messageID,
            () => {},
            true
          );
        },
        event.messageID
      );

    } catch (err) {
      console.error("AutoDownload error:", err.message);

      api.setMessageReaction(
        "❌",
        event.messageID,
        () => {},
        true
      );

      api.sendMessage(
        "❌ Unable to download this video. The API may be unavailable, or the link may not be supported.",
        event.threadID,
        null,
        event.messageID
      );

      if (filePath) {
        try {
          await fs.promises.unlink(filePath);
        } catch {}
      }
    }
  }
};


/* =========================================
   SOCIALDL API CONFIGURATION
========================================= */

const SOCIAL_API =
  "https://social-chi-amber.vercel.app/api/download";

const TIKTOK_API =
  "https://clip-forge-red.vercel.app/api/tiktok";

const YOUTUBE_MP4_API =
  "https://eliteprotech-apis.zone.id/download/ytmp4";


/* =========================================
   MAIN DOWNLOAD ROUTER
========================================= */

async function getDownloadData(url, platform) {
  if (platform === "youtube") {
    return getYouTubeData(url);
  }

  if (platform === "tiktok") {
    return getTikTokData(url);
  }

  return getSocialData(url);
}


/* =========================================
   SOCIAL MEDIA API
========================================= */

async function getSocialData(url) {
  const response = await axios.get(SOCIAL_API, {
    params: { url },
    timeout: 120000
  });

  const data = response.data;

  if (!data || data.success === false) {
    throw new Error(
      data?.message || data?.error || "Social API failed."
    );
  }

  const formats = Array.isArray(data.formats)
    ? data.formats
    : [];

  const best =
    data.best?.download_url ||
    data.best?.url ||
    data.download_url ||
    data.video_url ||
    data.url ||
    formats.map(item =>
      item?.download_url || item?.url || item?.link
    ).find(Boolean);

  if (!best) {
    throw new Error("No social video URL found.");
  }

  return {
    download_url: best,
    title: data.title || data.metadata?.title || "Social Video",
    platform: data.platform || "Social Media"
  };
}


/* =========================================
   TIKTOK API
========================================= */

async function getTikTokData(url) {
  const response = await axios.get(TIKTOK_API, {
    params: { url },
    timeout: 120000
  });

  const data = response.data;

  if (!data || data.success === false) {
    throw new Error(
      data?.message || data?.error || "TikTok API failed."
    );
  }

  const formats = Array.isArray(data.formats)
    ? data.formats
    : [];

  const downloadUrl =
    data.hd_video_url ||
    data.hd_url ||
    data.video_hd_url ||
    data.video_url ||
    data.download_url ||
    data.url ||
    formats.find(item =>
      item?.url && !/mp3|audio/i.test(
        `${item.format || ""} ${item.type || ""} ${item.mime || ""}`
      )
    )?.url;

  if (!downloadUrl) {
    throw new Error("TikTok video URL not found.");
  }

  return {
    download_url: downloadUrl,
    title:
      data.title ||
      data.desc ||
      data.description ||
      "TikTok Video",
    platform: "TikTok"
  };
}


/* =========================================
   YOUTUBE MP4 API
========================================= */

async function getYouTubeData(url) {
  const response = await axios.get(YOUTUBE_MP4_API, {
    params: { url },
    timeout: 120000
  });

  const data = response.data;

  if (
    !data ||
    data.status === false ||
    !data.result?.url
  ) {
    throw new Error(
      data?.message || "YouTube MP4 API failed."
    );
  }

  return {
    download_url: data.result.url,
    title: data.result.title || "YouTube Video",
    platform: "YouTube"
  };
}
