import * as InAppPurchases from "expo-in-app-purchases";
import { db, auth } from "../firebaseConfig";
import firebase from "firebase/compat/app";

const PRODUCT_IDS = [
  "com.miguelin1.flashradarapp.premium.monthly",
  "com.miguelin1.flashradarapp.premium.yearly",
];

export async function initializePurchases() {
  try {
    await InAppPurchases.connectAsync();
  } catch (e) {
    // Already connected
  }
}

export async function getProducts() {
  try {
    const { results } = await InAppPurchases.getProductsAsync(PRODUCT_IDS);
    return results ?? [];
  } catch (e) {
    console.error("[IAP] getProducts error:", e);
    return [];
  }
}

export async function purchaseSubscription(productId: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      InAppPurchases.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
        if (responseCode === InAppPurchases.IAPResponseCode.OK) {
          for (const purchase of results ?? []) {
            if (!purchase.acknowledged) {
              await InAppPurchases.finishTransactionAsync(purchase, true);
            }
            // Update Firestore
            const user = auth.currentUser;
            if (user) {
              await db.collection("users").doc(user.uid).set({
                isPremium: true,
                subscriptionStatus: "active",
                subscriptionProductId: purchase.productId,
                subscriptionPurchaseTime: firebase.firestore.FieldValue.serverTimestamp(),
                platform: "ios",
              }, { merge: true });
            }
          }
          resolve(true);
        } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
          resolve(false);
        } else {
          reject(new Error("Purchase failed with code: " + responseCode));
        }
      });

      await InAppPurchases.purchaseItemAsync(productId);
    } catch (e) {
      reject(e);
    }
  });
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
    if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
      const user = auth.currentUser;
      if (user) {
        await db.collection("users").doc(user.uid).set({
          isPremium: true,
          subscriptionStatus: "active",
          platform: "ios",
        }, { merge: true });
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error("[IAP] restore error:", e);
    return false;
  }
}

export async function disconnectPurchases() {
  try {
    await InAppPurchases.disconnectAsync();
  } catch (e) {}
}
