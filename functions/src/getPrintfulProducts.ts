import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

export const getPrintfulProducts = onRequest(async (req, res) => {
  try {
    const productId = req.url.includes("id=")
      ? req.url.split("id=")[1]
      : null;

    let url = "https://api.printful.com/store/products";

    if (productId) {
      url = `https://api.printful.com/store/products/${productId}`;
    }

    console.log("FINAL URL:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      },
    });

    const data = await response.json();

    res.set("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
