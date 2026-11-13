
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, "cache");

const SEARCH_API = "https://eliteprotech-apis.zone.id/search/ytsearch";
const DOWNLOAD_API = "https://eliteprotech-apis.zone.id/download/ytmp3";

module.exports.config = {
    name: "sing",
    aliases: ["s"],
    version: "1.0.0",
    author: "Denish",
    countDown: 5,
    role: 0,
    shortDescription: "YouTube MP3 downloader",
    longDescription: "Search and download songs from YouTube.",
    category: "media",
    guide: {
        en: "{pn} <song name>\nExample: {pn} duka"
    }
};

function react(api, messageID, emoji) {
    try {
        api.setMessageReaction(emoji, messageID, () => {}, true);
    } catch (_) {}
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchYouTube(query) {
    const response = await axios.get(SEARCH_API, {
        params: { q: query },
        timeout: 60000
    });

    const data = response.data;

    if (!data || data.success !== true) {
        throw new Error("YouTube search failed.");
    }

    const videos = data.results && data.results.videos;

    if (!Array.isArray(videos) || videos.length === 0) {
        throw new Error("No songs found.");
    }

    return videos;
}

async function getDownloadInfo(url) {
    const response = await axios.get(DOWNLOAD_API, {
        params: { url },
        timeout: 120000
    });

    const data = response.data;

    if (!data || data.status !== true || !data.download || !data.download.downloadUrl) {
        throw new Error(
            data?.message || data?.error || "MP3 download failed."
        );
    }

    return data.download;
}

function createTempFile() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    return path.join(
        CACHE_DIR,
        `sing_${Date.now()}_${Math.floor(Math.random() * 100000)}.mp3`
    );
}

async function downloadAudio(url, filePath) {
    const response = await axios.get(url, {
        responseType: "stream",
        timeout: 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const contentType = response.headers["content-type"] || "";

    if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
    ) {
        response.data.destroy();
        throw new Error("Invalid audio response.");
    }

    await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        response.data.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
    });

    const stats = fs.statSync(filePath);

    if (stats.size < 1024) {
        throw new Error("Downloaded audio is incomplete.");
    }

    return stats.size;
}

async function sendAudio(message, info, video, filePath) {
    const body =
        `🎵 SONG DOWNLOADER\n\n` +
        `🎧 Title: ${info.title || video.title}\n` +
        `👤 Artist: ${video.author?.name || "Unknown"}\n` +
        `⏱️ Duration: ${info.duration || video.duration || "Unknown"}\n` +
        `📁 Format: MP3\n` +
        `⚙️ API: EliteProTech\n` +
        `👑 Owner: Denish`;

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await message.reply({
                body,
                attachment: fs.createReadStream(filePath)
            });
        } catch (error) {
            if (attempt === 2) throw error;

            console.log(
                `[sing] Upload retry ${attempt + 1}: ${error.message}`
            );

            await sleep(2000);
        }
    }
}

function getError(error) {
    const data = error.response?.data;

    if (typeof data === "string") return data.slice(0, 300);
    if (data?.message) return data.message;
    if (data?.error) return data.error;

    return error.message || "Unknown error.";
}

module.exports.onStart = async function ({ api, event, args, message }) {
    const messageID = event.messageID;
    const query = args.join(" ").trim();

    if (!query) {
        return message.reply(
            "❌ Please enter a song name.\n\nExample: sing duka"
        );
    }

    let filePath;

    react(api, messageID, "⏳");

    try {
        // 1. Search YouTube
        const videos = await searchYouTube(query);
        const video = videos[0];

        if (!video.url) {
            throw new Error("Invalid YouTube search result.");
        }

        // 2. Get MP3 download URL
        const info = await getDownloadInfo(video.url);

        // 3. Download audio
        filePath = createTempFile();

        await downloadAudio(info.downloadUrl, filePath);

        // 4. Send audio to Messenger
        await sendAudio(message, info, video, filePath);

        react(api, messageID, "✅");

    } catch (error) {
        console.error("[sing] Error:", error);

        react(api, messageID, "❌");

        return message.reply(
            "❌ SONG DOWNLOAD FAILED\n\n" +
            "Reason: " + getError(error)
        );

    } finally {
        // 5. Remove temporary audio
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (error) {
                console.error("[sing] Cleanup:", error.message);
            }
        }
    }
};
