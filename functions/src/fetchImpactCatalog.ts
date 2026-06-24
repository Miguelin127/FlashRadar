import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import axios from "axios";
import { db } from "./firebaseAdmin";
import { isBlockedContent } from "./contentFilter";

const IMPACT_ACCOUNT_SID = defineSecret("IMPACT_ACCOUNT_SID");
const IMPACT_AUTH_TOKEN = defineSecret("IMPACT_AUTH_TOKEN");

const CATALOGS = [
  { catalogId: "23231", store: "Best Choice Products", storeKey: "bestchoice" },
];

const DISCOUNT_FLOOR = 25;
const PAGE_SIZE = 100;

function decodeMerchantUrl(impactUrl: string): string {
  try {
    const u = new URL(impactUrl);
    const inner = u.searchParams.get("u");
    return inner ? decodeURIComponent(inner) : impactUrl;
  } catch {
    return impactUrl;
  }
}

export const fetchImpactCatalog = onSchedule(
  {
    schedule: "every 12 hours",
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: [IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN],
  },
  async () => {
    console.log("IMPACT CATALOG FUNCTION STARTED");

    const sid = IMPACT_ACCOUNT_SID.value();
    const token = IMPACT_AUTH_TOKEN.value();
    if (!sid || !token) {
      console.log("IMPACT CREDS MISSING");
      return;
    }

    const authHeader =
      "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");

    let grandWritten = 0;
    let grandSkipped = 0;

    for (const cat of CATALOGS) {
      console.log(`--- Ingesting catalog ${cat.catalogId} (${cat.store}) ---`);

      let nextUri: string | null = `/Mediapartners/${sid}/Catalogs/${cat.catalogId}/Items?PageSize=${PAGE_SIZE}`;
      let pageNum = 0;
      let catWritten = 0;
      let catSkipped = 0;

      while (nextUri) {
        pageNum++;
        const url: string = `https://api.impact.com${nextUri}`;

        let res: any = null;
        let attempt = 0;
        while (attempt < 4) {
          attempt++;
          try {
            res = await axios.get(url, {
              timeout: 30000,
              headers: { Authorization: authHeader, Accept: "application/json" },
            });
            break;
          } catch (e: any) {
            console.log(
              `IMPACT AXIOS ERROR (catalog ${cat.catalogId}, page ${pageNum}, attempt ${attempt}):`,
              e?.response?.status ?? e?.code ?? "no-status",
              e?.message ?? ""
            );
            if (attempt >= 4) { res = null; break; }
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
        if (!res) {
          console.log(`Catalog ${cat.catalogId}: giving up on page ${pageNum} after retries`);
          break;
        }

        const items: any[] = res.data?.Items || [];
        if (items.length === 0) {
          console.log(`Catalog ${cat.catalogId}: no items on page ${pageNum}`);
          break;
        }

        const batch = db.batch();
        let batchCount = 0;

        for (const item of items) {
          const catalogItemId = item?.CatalogItemId;
          if (!catalogItemId) { catSkipped++; continue; }

          const price = parseFloat(item?.CurrentPrice);
          const originalPrice = parseFloat(item?.OriginalPrice);
          const discountPercent = parseInt(item?.DiscountPercentage, 10);

          if (!price || price <= 0) { catSkipped++; continue; }
          if (isNaN(discountPercent) || discountPercent < DISCOUNT_FLOOR) { catSkipped++; continue; }
          if (item?.StockAvailability && item.StockAvailability !== "InStock") { catSkipped++; continue; }
          if (item?.Currency && item.Currency !== "USD") { catSkipped++; continue; }

          const title = item?.Name || `${cat.store} Deal`;
          if (isBlockedContent(title) || item?.Adult === "true") { catSkipped++; continue; }

          // Skip out-of-season holiday inventory (catalog is heavy on Christmas).
          const catText = `${item?.Category || ""} ${title}`.toLowerCase();
          const SEASONAL = ["christmas", "holiday", "xmas", "advent", "nativity", "ornament", "santa", "wreath", "garland", "menorah", "hanukkah"];
          if (SEASONAL.some((w) => catText.includes(w))) { catSkipped++; continue; }

          const affiliateUrl = item?.Url;
          if (!affiliateUrl) { catSkipped++; continue; }

          const merchantUrl = decodeMerchantUrl(affiliateUrl);
          const imageUrl = item?.ImageUrl || null;
          const id = `BCP_${cat.catalogId}_${catalogItemId}`;

          batch.set(
            db.collection("deals_live").doc(id),
            {
              id,
              title,
              price,
              originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
              discountPercent,
              store: cat.store,
              storeKey: cat.storeKey,
              source: "impact",
              affiliateUrl,
              merchantUrl,
              url: affiliateUrl,
              imageUrl,
              image: imageUrl,
              category: item?.Category || "Other",
              live: true,
              isActive: true,
              hot: discountPercent >= 30,
              rare: discountPercent >= 50,
              enrichmentStatus: "enriched",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          batchCount++;
          catWritten++;
        }

        if (batchCount > 0) await batch.commit();
        console.log(`Catalog ${cat.catalogId} page ${pageNum}: wrote ${batchCount}, running total ${catWritten}`);

        await new Promise((r) => setTimeout(r, 350));
        const np: string | undefined = res.data?.["@nextpageuri"];
        nextUri = np && np.length > 0 ? np : null;
      }

      console.log(`Catalog ${cat.catalogId} (${cat.store}) DONE: written ${catWritten}, skipped ${catSkipped}`);
      grandWritten += catWritten;
      grandSkipped += catSkipped;
    }

    console.log(`IMPACT CATALOG DONE. Total written ${grandWritten}, total skipped ${grandSkipped}`);
  }
);
