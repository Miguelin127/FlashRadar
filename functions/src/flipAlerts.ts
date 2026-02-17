// FlashRadarProject/functions/src/flipAlerts.ts

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { evaluateFlipAlert } from "./utils/flipAlertEvaluator";
import { db } from "./firebaseAdmin"; // assumes admin SDK init
import { FlipItem } from "./utils/FlipItem";


export const onFlipPriceUpdate = onDocumentUpdated(
  "users/{userId}/flipItems/{flipId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only act if price history changed
    if (
      JSON.stringify(before.priceHistory) ===
      JSON.stringify(after.priceHistory)
    ) {
      return;
    }

    const result = evaluateFlipAlert({
      existingFlip: before as FlipItem,
      updatedPriceHistory: after.priceHistory,
      platformInputs: after.platformStats,
    });

    if (!result.shouldNotify) return;

    // Create alert document
    await db
      .collection("users")
      .doc(event.params.userId)
      .collection("alerts")
      .add({
        flipId: event.params.flipId,
        type: "FLIP_READY",
        message: "Price reached optimal buy zone",
        createdAt: new Date(),
        read: false,
        data: {
          previousVerdict: before.verdict,
          newVerdict: result.newFlip.verdict,
        },
      });

    // Update flip verdict + confidence
    await event.data?.after.ref.update({
      verdict: result.newFlip.verdict,
      confidence: result.newFlip.confidence,
      updatedAt: new Date(),
    });
  }
);
