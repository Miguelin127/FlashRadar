// functions/src/teachAmazonDeals.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import crypto from "crypto";
import { db } from "./firebaseAdmin";

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY!;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY!;
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG!;

const REGION = "us-east-1";
const SERVICE = "ProductAdvertisingAPI";
const HOST = "webservices.amazon.com";
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;

// 🔐 Amazon PA-API signing (STRICT)
function signRequest(payload: string) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = crypto
    .createHash("sha256")
    .update(payload)
    .digest("hex");

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;

  const signedHeaders =
    "content-encoding;content-type;host;x-amz-content-sha256;x-amz-date;x-amz-target";

  const canonicalRequest =
    `POST\n/paapi5/searchitems\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${REGION}/${SERVICE}/aws4_request\n` +
    crypto.createHash("sha256").update(canonicalRequest).digest("hex");

  const kDate = crypto
    .createHmac("sha256", "AWS4" + SECRET_KEY)
    .update(dateStamp)
    .digest();

  const kRegion = crypto
    .createHmac("sha256", kDate)
    .update(REGION)
    .digest();

  const kService = crypto
    .createHmac("sha256", kRegion)
    .update(SERVICE)
    .digest();

  const signingKey = crypto
    .createHmac("sha256", kService)
    .update("aws4_request")
    .digest();

  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return {
    amzDate,
    payloadHash,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${dateStamp}/${REGION}/${SERVICE}/aws4_request, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// 🚀 Scheduled Amazon deal fetch
export const teachAmazonDeals = onSchedule("every 6 hours", async () => {
  const payload = JSON.stringify({
    Keywords: "clearance deals",
    SearchIndex: "All",
    ItemCount: 10,
    Resources: [
      "Images.Primary.Large",
      "ItemInfo.Title",
      "Offers.Listings.Price",
    ],
    PartnerTag: PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: "www.amazon.com",
  });

  const { amzDate, authorization, payloadHash } = signRequest(payload);

  const res = await axios.post(ENDPOINT, payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Encoding": "amz-1.0",
      "X-Amz-Date": amzDate,
      "X-Amz-Target":
        "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
      "X-Amz-Content-Sha256": payloadHash,
      Authorization: authorization,
    },
  });

  const items = res.data?.SearchResult?.Items || [];
  const batch = db.batch();

  items.forEach((item: any) => {
    const asin = item.ASIN;
    const price = item?.Offers?.Listings?.[0]?.Price?.Amount;
    if (!asin || !price) return;

    batch.set(
      db.collection("deals_online").doc(`AMZ_${asin}`),
      {
        id: `AMZ_${asin}`,
        asin,
        title: item?.ItemInfo?.Title?.DisplayValue || "Amazon Item",
        price,
        store: "Amazon",
        image: item?.Images?.Primary?.Large?.URL || null,
        url: item?.DetailPageURL,
        source: "amazon",
        timestamp: Date.now(),
      },
      { merge: true }
    );
  });

  await batch.commit();
  console.log("✅ Amazon deals saved:", items.length);
});
