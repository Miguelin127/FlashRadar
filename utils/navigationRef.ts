import { createNavigationContainerRef } from "@react-navigation/native";
import { db } from "../firebaseConfig";

export const navigationRef = createNavigationContainerRef<any>();

/**
 * Opens a deal from outside the navigation tree — a notification tap.
 *
 * DealDetail takes the whole deal object rather than an id, so the
 * document has to be fetched first. DealDetail is registered inside
 * three stacks; Explore is the one we route through.
 */
export async function openDealById(dealId: string): Promise<boolean> {
  const id = String(dealId || "").trim();
  if (id === "") return false;

  try {
    const snap = await db.collection("deals_live").doc(id).get();
    if (!snap.exists) {
      console.warn("[push] deal not found: " + id);
      return false;
    }
    const deal = { id: snap.id, ...snap.data() };

    // On a cold start the container is not mounted yet, so the tap
    // would be dropped. Wait briefly rather than lose it.
    for (let i = 0; i < 20 && !navigationRef.isReady(); i++) {
      await new Promise((r) => setTimeout(r, 150));
    }
    if (!navigationRef.isReady()) return false;

    navigationRef.navigate(
      "Explore" as never,
      { screen: "DealDetail", params: { deal } } as never
    );
    return true;
  } catch (e) {
    console.warn("[push] openDealById failed", e);
    return false;
  }
}
