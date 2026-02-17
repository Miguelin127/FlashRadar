import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FlipItem } from "../utils/FlipItem";

// Safe admin init
initializeApp();
const db = getFirestore();

/**
 * Save a FlipItem to Firestore
 */
export async function saveFlipToFirestore(flip: FlipItem) {
  if (!flip.userId) {
    throw new Error("FlipItem missing userId");
  }

  const ref = db
    .collection("users")
    .doc(flip.userId)
    .collection("flips")
    .doc(flip.id);

  await ref.set(
    {
      ...flip,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true }
  );

  return true;
}
