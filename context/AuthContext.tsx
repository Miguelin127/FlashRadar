// flashradar/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AuthContextType = {
  user: firebase.User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────── REFERRAL HELPER ───────────────────────────
async function ensureReferralCode(uid: string) {
  try {
    const userRef = doc(db, "users", uid);

    // ✅ Wait until Firestore is connected before calling getDoc()
    const waitForConnection = new Promise((resolve) => setTimeout(resolve, 500));
    await waitForConnection;

    const snap = await getDoc(userRef);

    if (!snap.exists()) return;
    const data = snap.data();

    if (!data.referralCode) {
      const newCode =
        Math.random().toString(36).substring(2, 5).toUpperCase() +
        Math.floor(Math.random() * 90 + 10);

      await setDoc(
        userRef,
        { referralCode: newCode, referralsCount: 0 },
        { merge: true }
      );

      console.log("✅ Referral code created for user:", newCode);
    }
  } catch (error: any) {
    if (error.code === "unavailable" || error.message?.includes("offline")) {
      console.warn("⚠️ Firestore offline, will retry referral setup later");
      return;
    }
    console.error("Referral setup error:", error);
  }
}

// ─────────────────────────── REWARD CHECK ───────────────────────────
async function checkReferralReward(referrerId: string) {
  try {
    const referrerRef = doc(db, "users", referrerId);
    const snap = await getDoc(referrerRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const count = data.referralsCount || 0;

    if (count >= 10 && !data.rewardGranted) {
      // 🔐 This field is updated by Cloud Function, not client
      await setDoc(
        referrerRef,
        {
          rewardGranted: true,
          rewardPending: true,
          rewardCheckedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`🏆 Referral milestone reached for ${referrerId}.`);
    }
  } catch (error) {
    console.error("Reward check failed:", error);
  }
}

// ─────────────────────────── MAIN CONTEXT ───────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setReady(true);

      if (firebaseUser) {
        await ensureReferralCode(firebaseUser.uid);
      }
    });
    return unsub;
  }, []);

  // ──────────── Sign In ────────────
  const signIn = async (email: string, password: string) => {
    await auth.signInWithEmailAndPassword(email, password);
  };

  // ──────────── Sign Up + Referral Handling ────────────
  const signUp = async (email: string, password: string) => {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const newUser = userCredential.user;
    if (!newUser) return;

    const storedCode = await AsyncStorage.getItem("pendingReferral");
    if (storedCode) {
      console.log("🎁 Applying referral:", storedCode);
      const refQuery = query(
        collection(db, "users"),
        where("referralCode", "==", storedCode)
      );
      const refSnap = await getDocs(refQuery);

      if (!refSnap.empty) {
        const refDoc = refSnap.docs[0];
        const refId = refDoc.id;
        const refData = refDoc.data();

        await setDoc(
          doc(db, "users", refId),
          { referralsCount: (refData.referralsCount || 0) + 1, updatedAt: serverTimestamp() },
          { merge: true }
        );

        await checkReferralReward(refId);

        await setDoc(
          doc(db, "users", newUser.uid),
          {
            referredBy: refId,
            referralCodeUsed: storedCode,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );

        console.log("✅ Referral applied for new user:", newUser.uid);
      }

      await AsyncStorage.removeItem("pendingReferral");
    }

    await ensureReferralCode(newUser.uid);
  };

  // ──────────── Sign Out ────────────
  const signOut = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────── HOOK ───────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
