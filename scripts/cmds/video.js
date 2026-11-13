
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");

const SEARCH_API =
    "https://eliteprotech-apis.zone.id/search/ytsearch";

const DOWNLOAD_API =
    "https://eliteprotech-apis.zone.id/download/ytmp4";

module.exports.config = {
    name: "video",
    aliases: ["v"],
    version: "1.0.0",
    author: "Denish",
    countDown: 5,
    role: 0,
    shortDescription: "YouTube video search",
    longDescription: "Search YouTube videos.",
    category: "media",
    guide: {
        en: "{pn} <video name>"
    }
};

function react(api, id, emoji) {
    try {
        api.setMessageReaction(emoji, id, () => {}, true);
    } catch (_) {}
}

async function searchYouTube(query) {
    const response = await axios.get(SEARCH_API, {
        params: { q: query },
        timeout: 60000
    });

    const data = response.data;
    const videos = data?.results?.videos;

    if (data?.success !== true || !videos?.length) {
        throw new Error("No videos found.");
    }

    return videos;
}

function createTempFile() {
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    return path.join(
        CACHE_DIR,
        `video_${Date.now()}.mp4`
    );
}

// Use this helper with an authorized direct MP4 URL.
async function downloadVideo(url, filePath) {
    const response = await axios.get(url, {
        responseType: "stream",
        timeout: 300000
    });

    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);
        response.data.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
    });

    if (fs.statSync(filePath).size < 1024) {
        throw new Error("Invalid video file.");
    }
}

module.exports.onStart = async function ({
    api,
    event,
    args,
    message
}) {
    const query = args.join(" ").trim();

    if (!query) {
        return message.reply("Usage: video Naruto opening");
    }

    let filePath;

    react(api, event.messageID, "⏳");

    try {
        const videos = await searchYouTube(query);
        const video = videos[0];

        if (!video.url) {
            throw new Error("Invalid video URL.");
        }

        // Obtain a direct MP4 URL from an authorized provider.
        // Then pass that URL to downloadVideo().

        filePath = createTempFile();

        throw new Error(
            "Connect an authorized MP4 provider before downloading."
        );

    } catch (error) {
        console.error("[VIDEO]", error.message);

        react(api, event.messageID, "❌");

        return message.reply(
            "❌ Video download failed: " + error.message
        );

    } finally {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (_) {}
        }
    }
};
