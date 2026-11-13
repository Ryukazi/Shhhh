
const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "autolink",
    version: "1.0",
    author: "Denish",
    countDown: 5,
    role: 0,
    shortDescription: "Auto-download social media videos",
    longDescription:
      "Automatically downloads videos from supported social media platforms.",
    category: "media",
    guide: "Send any supported video link directly in chat."
  },

  onStart: async () => {},

  onChat: async function ({ event, api }) {
    let filePath = null;

    try {
      const text = event.body || "";
      const match = text.match(/https?:\/\/[^\s]+/i);
      if (!match) return;

      const url = match[0].replace(/[),.!?]+$/, "");

      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }

      if (!["http:", "https:"].includes(parsed.protocol)) return;

      const hostname = parsed.hostname.toLowerCase();

      let platform = "social";

      if (
        hostname.includes("youtube.com") ||
        hostname.includes("youtu.be")
      ) {
        platform = "youtube";
      } else if (hostname.includes("tiktok.com")) {
        platform = "tiktok";
      } else if (
        hostname.includes("pinterest.com") ||
        hostname.includes("pin.it") ||
        hostname.includes("pinterest.")
      ) {
        platform = "pinterest";
      }

      api.setMessageReaction(
        "🪄",
        event.messageID,
        () => {},
        true
      );

      let data;

      if (platform === "pinterest") {
        data = await getPinterestData(url);
      } else {
        data = await getDownloadData(url, platform);
      }

      if (!data || !data.download_url) {
        throw new Error("No downloadable video found.");
      }

      const cacheDir = path.join(__dirname, "cache");

      await fs.promises.mkdir(cacheDir, {
        recursive: true
      });

      filePath = path.join(
        cacheDir,
        `video_${Date.now()}.mp4`
      );

      const response = await axios.get(data.download_url, {
        responseType: "arraybuffer",
        timeout: 180000,
        maxContentLength: 87000000,
        maxBodyLength: 87000000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"
        }
      });

      const buffer = Buffer.from(response.data);

      if (!buffer.length) {
        throw new Error("Downloaded file is empty.");
      }

      if (buffer.length > 87000000) {
        throw new Error("Video exceeds the 87 MB limit.");
      }

      await fs.promises.writeFile(filePath, buffer);

      api.setMessageReaction(
        "✅",
        event.messageID,
        () => {},
        true
      );

      api.sendMessage(
        {
          body:
            `✅ Downloaded Successfully\n\n` +
            `Platform: ${data.platform}\n` +
            `Title: ${data.title || "Video"}\n` +
            (data.quality ? `Quality: ${data.quality}` : ""),
          attachment: fs.createReadStream(filePath)
        },
        event.threadID,
        async () => {
          try {
            await fs.promises.unlink(filePath);
          } catch (err) {
            console.error("Cache cleanup:", err.message);
          }
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
        "❌ Unable to download this video. The API may be unavailable, or the video may exceed the file size limit.",
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
   API CONFIGURATION
========================================= */

const SOCIAL_API =
  "https://social-chi-amber.vercel.app/api/download";

const TIKTOK_API =
  "https://clip-forge-red.vercel.app/api/tiktok";

const YOUTUBE_MP4_API =
  "https://eliteprotech-apis.zone.id/download/ytmp4";

const PINTEREST_API =
  "https://ly-ani.vercel.app/api/download";


/* =========================================
   MAIN ROUTER
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
   PINTEREST API
   Audio + Video HLS playlist
========================================= */

async function getPinterestData(url) {
  const response = await axios.get(PINTEREST_API, {
    params: { url },
    timeout: 180000
  });

  const data = response.data;

  if (!data || data.ok !== true) {
    throw new Error(
      data?.message || "Pinterest API failed."
    );
  }

  const formats = Array.isArray(data.formats)
    ? data.formats
    : [];

  if (!formats.length) {
    throw new Error("No Pinterest formats found.");
  }

  // Prefer the highest available quality.
  const selected = formats
    .filter(item =>
      item?.url &&
      item.has_audio === true
    )
    .sort((a, b) =>
      (b.height || 0) - (a.height || 0)
    )[0];

  if (!selected) {
    throw new Error(
      "No Pinterest audio + video format found."
    );
  }

  return {
    download_url: selected.url,
    title: data.title || "Pinterest Video",
    platform: "Pinterest",
    quality: selected.quality || "Auto"
  };
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
      item?.url &&
      !/mp3|audio/i.test(
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
   YOUTUBE API
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
