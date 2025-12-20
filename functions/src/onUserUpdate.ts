// functions/src/onUserUpdate.ts
import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";
import fetch from "node-fetch";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const debounceMap = new Map<string, boolean>();

export const onUserUpdate = functions.firestore
  .document("users/{userId}")
  .onUpdate(
    async (
      change: functions.Change<FirebaseFirestore.DocumentSnapshot>,
      context: functions.EventContext
    ) => {
      const userId = context.params.userId;
      const before = change.before.data();
      const after = change.after.data();
      if (!after) return null;

      // 🧩 Prevent recursive loops
      if (debounceMap.get(userId)) {
        console.log(`⏸️ Skipping duplicate update for ${userId}`);
        return null;
      }
      debounceMap.set(userId, true);
      setTimeout(() => debounceMap.delete(userId), 2000);

      const updates: Record<string, any> = {};
      const now = Date.now();
      const lastGeoUpdate = after.lastGeoUpdate || 0;

      // 🧭 Default radius
      if (!after.radius || after.radius <= 0) {
        updates.radius = 10;
        console.log(`🧭 Default radius set to 10 for ${userId}`);
      }

      const { location, zip } = after;
      const locationChanged =
        !before?.location ||
        before.location.latitude !== after.location?.latitude ||
        before.location.longitude !== after.location?.longitude;

      const timeElapsed = now - lastGeoUpdate;
      const oneDay = 24 * 60 * 60 * 1000;

      // ⏳ Skip heavy lookups if location unchanged & cache still fresh
      if (!locationChanged && timeElapsed < oneDay) {
        console.log(`⚡ Using cached geodata for ${userId} (last update ${(timeElapsed / 1000 / 60).toFixed(1)} min ago)`);
        return null;
      }

      // 🌎 Reverse-geocode if coordinates exist
      if (location?.latitude && location?.longitude) {
        try {
          const { latitude, longitude } = location;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { "User-Agent": "FlashRadar/1.0 (contact@flashradar.app)" } }
          );
          const geo = await res.json();

          if (geo?.address) {
            const a = geo.address;
            const city = a.city || a.town || a.village || "Unknown";
            const state = a.state || a.region || "Unknown";
            const country = a.country || "United States";
            const postal = a.postcode || "00000";

            // 🌐 Smart radius scaling
            let smartRadius = 10;
            if (["Chicago", "New York", "Los Angeles", "Miami", "Houston"].includes(city))
              smartRadius = 5;
            else if (["Illinois", "Texas", "California"].includes(state))
              smartRadius = 10;
            else smartRadius = 25;

            // 🕐 Timezone lookup
            let timezone = "America/Chicago";
            try {
              const tzRes = await fetch(
                `https://timeapi.io/api/TimeZone/coordinate?latitude=${latitude}&longitude=${longitude}`
              );
              const tzData = await tzRes.json();
              if (tzData?.timeZone) timezone = tzData.timeZone;
            } catch (err) {
              console.warn("⚠️ Timezone lookup failed:", err);
            }

            // 📍 Preferred radius classification
            const preferredRadius =
              smartRadius <= 5
                ? "urban"
                : smartRadius <= 15
                ? "suburban"
                : "rural";

            const fullAddress = `${city}, ${state} ${postal}, ${country}`;

            Object.assign(updates, {
              city,
              state,
              zip: postal,
              country,
              fullAddress,
              radius: smartRadius,
              timezone,
              preferredRadius,
              lastGeoUpdate: now,
            });

            console.log(
              `🏙️ ${userId} → ${city}, ${state} [${timezone}] — radius:${smartRadius} (${preferredRadius})`
            );
          }
        } catch (err) {
          console.error("⚠️ Reverse geocode failed:", err);
        }
      }

      // 📬 Forward-geocode if ZIP provided & city missing
      else if (zip && !after.city) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=us&format=jsonv2`,
            { headers: { "User-Agent": "FlashRadar/1.0 (contact@flashradar.app)" } }
          );
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const loc = data[0];
            const city =
              loc.address?.city ||
              loc.address?.town ||
              loc.address?.village ||
              loc.display_name?.split(",")[0] ||
              "Unknown";
            const state = loc.address?.state || loc.address?.region || "Unknown";
            const country = loc.address?.country || "United States";
            const latitude = parseFloat(loc.lat);
            const longitude = parseFloat(loc.lon);

            // 🕐 Timezone lookup
            let timezone = "America/Chicago";
            try {
              const tzRes = await fetch(
                `https://timeapi.io/api/TimeZone/coordinate?latitude=${latitude}&longitude=${longitude}`
              );
              const tzData = await tzRes.json();
              if (tzData?.timeZone) timezone = tzData.timeZone;
            } catch (err) {
              console.warn("⚠️ Timezone lookup failed:", err);
            }

            // Smart radius logic
            let smartRadius = 10;
            if (["Chicago", "New York", "Los Angeles", "Miami", "Houston"].includes(city))
              smartRadius = 5;
            else if (["Illinois", "Texas", "California"].includes(state))
              smartRadius = 10;
            else smartRadius = 25;

            const preferredRadius =
              smartRadius <= 5
                ? "urban"
                : smartRadius <= 15
                ? "suburban"
                : "rural";

            const fullAddress = `${city}, ${state} ${zip}, ${country}`;

            Object.assign(updates, {
              city,
              state,
              country,
              fullAddress,
              radius: smartRadius,
              timezone,
              preferredRadius,
              location: { latitude, longitude },
              lastGeoUpdate: now,
            });

            console.log(
              `📍 ZIP ${zip} → ${city}, ${state} [${timezone}] (${preferredRadius})`
            );
          }
        } catch (err) {
          console.error("⚠️ ZIP lookup failed:", err);
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.collection("users").doc(userId).set(updates, { merge: true });
        console.log(`🔁 User ${userId} auto-corrected:`, updates);
      }

      return null;
    }
  );
