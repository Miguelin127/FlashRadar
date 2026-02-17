import { httpsCallable } from "firebase/functions";
import { getFunctions } from "firebase/functions";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

// ✅ Create Functions instance locally
const functions = getFunctions();

// Callable Cloud Function
const previewDeal = httpsCallable(functions, "previewDeal");

export async function autoInsertDeal(url: string) {
  const res = await previewDeal({ url });

  const { title, image } = res.data as {
    title: string | null;
    image: string | null;
  };

  if (!title) {
    throw new Error("Preview failed: no title");
  }

  // Infer store from URL
  const u = url.toLowerCase();
  let store = "Unknown";

  if (u.includes("amazon")) store = "Amazon";
  else if (u.includes("walmart")) store = "Walmart";
  else if (u.includes("target")) store = "Target";
  else if (u.includes("homedepot")) store = "Home Depot";

  await addDoc(collection(db, "deals_online"), {
    title,
    store,
    url,
    image,               // ✅ REAL OG IMAGE
    price: null,
    source: "online",
    live: true,
    timestamp: serverTimestamp(),
  });
}
