// functions/src/utils/saveFlipResult.ts

import * as admin from "firebase-admin";
import type { FlipItem } from "./FlipItem";

const db = admin.firestore();

export async function saveFlipResult(
  userId: string,
  flip: FlipItem
): Promise<void> {
  const ref = db
    .collection("users")
    .doc(userId)
    .collection("flips")
    .doc(flip.id);

  await ref.set(
    {
      ...flip,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt:
        flip.createdAt ??
        admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
