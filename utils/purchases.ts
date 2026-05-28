import Purchases, { PurchasesPackage } from "react-native-purchases";
import { db, auth } from "../firebaseConfig";

export async function initializePurchases() {
  // Already initialized in App.tsx, nothing needed here
}

export async function getProducts(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (e) {
    console.error("[RC] getProducts error:", e);
    return [];
  }
}

export async function purchaseSubscription(productId: string): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const pkg = packages.find(p => p.product.identifier === productId);
    if (!pkg) throw new Error("Product not found: " + productId);

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPremium = customerInfo.entitlements.active["premium_access"] !== undefined;

    if (isPremium) {
      const user = auth.currentUser;
      if (user) {
        await db.collection("users").doc(user.uid).set({
          isPremium: true,
          subscriptionStatus: "active",
          subscriptionProductId: productId,
          platform: "ios",
        }, { merge: true });
      }
    }
    return isPremium;
  } catch (e: any) {
    if (e.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active["premium_access"] !== undefined;

    if (isPremium) {
      const user = auth.currentUser;
      if (user) {
        await db.collection("users").doc(user.uid).set({
          isPremium: true,
          subscriptionStatus: "active",
          platform: "ios",
        }, { merge: true });
      }
    }
    return isPremium;
  } catch (e) {
    console.error("[RC] restore error:", e);
    return false;
  }
}

export async function disconnectPurchases() {
  // RevenueCat doesn't need disconnecting
}