// flashradar/context/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { View, Text } from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

import { auth, db } from "../firebaseConfig";
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
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) return;

    const data = snap.data();
    if (!data?.referralCode) {
      const code =
        Math.random().toString(36).substring(2, 5).toUpperCase() +
        Math.floor(Math.random() * 90 + 10);

      await userRef.set(
        {
          referralCode: code,
          referralsCount: 0,
        },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn("Referral setup skipped:", e);
  }
}

// ─────────────────────────── AUTH PROVIDER ───────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setReady(true);

      if (firebaseUser) {
        await ensureReferralCode(firebaseUser.uid);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await auth.signInWithEmailAndPassword(email, password);
  };

  const signUp = async (email: string, password: string) => {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const newUser = cred.user;
    if (!newUser) return;

    const storedCode = await AsyncStorage.getItem("pendingReferral");

    if (storedCode) {
      const refSnap = await db
        .collection("users")
        .where("referralCode", "==", storedCode)
        .limit(1)
        .get();

      if (!refSnap.empty) {
        const refDoc = refSnap.docs[0];

        await refDoc.ref.set(
          {
            referralsCount: (refDoc.data().referralsCount || 0) + 1,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await db
          .collection("users")
          .doc(newUser.uid)
          .set(
            {
              referredBy: refDoc.id,
              referralCodeUsed: storedCode,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }

      await AsyncStorage.removeItem("pendingReferral");
    }

    await ensureReferralCode(newUser.uid);
  };

  const signOut = async () => {
    await auth.signOut();
  };

  // ✅ SAFE LOADING UI (NO MORE BLACK SCREEN)
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18 }}>
          Loading FlashRadar…
        </Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────── HOOK ───────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
