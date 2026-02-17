// functions/src/utils/saveFlipScore.ts

import * as admin from "firebase-admin";

const db = admin.firestore();

export async function saveFlipScore(
  userId: string,
  flipId: string,
  score: number
): Promise<void> {
  const ref = db
    .collection("users")
    .doc(userId)
    .collection("flips")
    .doc(flipId);

  await ref.set(
    {
      score,
      scoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
