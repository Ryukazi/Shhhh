const axios = require("axios");

module.exports = {
  config: {
    name: "pinterest",
    aliases: ["pin", "pins"],
    version: "3.0",
    author: "Lord Denish",
    countDown: 5,
    role: 0,
    shortDescription: "Get Pinterest images",
    longDescription: "Fetch multiple Pinterest JPG images using Dens Pinterest API",
    category: "fun",
    guide: {
      en: "{p}pinterest <keyword> [amount]",
    },
  },

  onStart: async function ({ message, args }) {
    if (!args.length) {
      return message.reply(
        "❌ Please provide a search keyword.\n📘 Usage: pinterest <keyword> [amount]"
      );
    }

    // Read amount from the last argument if it is a number.
    let amount = 1;
    let queryArgs = [...args];

    const lastArg = queryArgs[queryArgs.length - 1];

    if (/^\d+$/.test(lastArg)) {
      amount = parseInt(lastArg, 10);
      queryArgs.pop();
    }

    amount = Math.max(1, Math.min(amount, 70));

    const query = queryArgs.join(" ").trim();

    if (!query) {
      return message.reply("❌ Please provide a valid search keyword.");
    }

    const apiUrl =
      "https://dens-pin-api.vercel.app/api/pinterest-images";

    try {
      const response = await axios.get(apiUrl, {
        params: { query },
        timeout: 30000
      });

      const images = response.data?.images || [];

      if (
        response.data?.status !== true ||
        !Array.isArray(images) ||
        images.length === 0
      ) {
        return message.reply(
          `❌ No Pinterest images found for: ${query}`
        );
      }

      const selectedImages = images.slice(0, amount);

      // Download image URLs returned by the new API.
      const results = await Promise.allSettled(
        selectedImages.map(async (image) => {
          if (!image.url) {
            throw new Error("Missing image URL");
          }

          const imageResponse = await axios.get(image.url, {
            responseType: "stream",
            timeout: 30000,
            maxRedirects: 5
          });

          const contentType =
            imageResponse.headers["content-type"] || "";

          if (!contentType.includes("image/")) {
            throw new Error("Invalid image response");
          }

          return imageResponse.data;
        })
      );

      const attachments = results
        .filter(result => result.status === "fulfilled")
        .map(result => result.value);

      if (!attachments.length) {
        return message.reply(
          "❌ Couldn't download the Pinterest images. Please try again."
        );
      }

      await message.reply({
        body:
          `📌 Pinterest Results\n` +
          `🔎 Search: ${query}\n` +
          `🖼️ Images: ${attachments.length}/${selectedImages.length}\n` +
          `🌐 Source: dens-pin-api.vercel.app`,
        attachment: attachments
      });

    } catch (error) {
      console.error(
        "Pinterest command error:",
        error.response?.data || error.message
      );

      return message.reply(
        "❌ Pinterest API failed. Please try again later."
      );
    }
  },
};
