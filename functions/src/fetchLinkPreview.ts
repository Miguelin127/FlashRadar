import axios from "axios";
import * as cheerio from "cheerio";

export async function fetchLinkPreview(url: string) {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"
    }
  });

  const $ = cheerio.load(data);

  const image =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text();

  return {
    title,
    image
  };
}
