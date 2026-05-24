// flashradar/context/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { View, Text, Platform } from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../firebaseConfig";

WebBrowser.maybeCompleteAuthSession();

// ── Google OAuth client IDs ─────────────────────────────────────────────────
// Get these from Google Cloud Console → OAuth 2.0 Client IDs
const GOOGLE_IOS_CLIENT_ID = "2868928124-l7iretmorlvhjtjfs4f5hffo4tk0m7om.apps.googleusercontent.com";
const GOOGLE_ANDROID_CLIENT_ID = "2868928124-t06eluv2f4cm4o7dfpthd7ltj1j8m5ik.apps.googleusercontent.com";
const GOOGLE_WEB_CLIENT_ID = "2868928124-mc285lh7neu7iul1vespr2k5jo8uteok.apps.googleusercontent.com";

export const ADMIN_EMAILS = new Set([
  "miguelx.x127@gmail.com",
  "miguel@flashradarapp.com",
]);

type AuthContextType = {
  user: firebase.User | null;
  ready: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function ensureReferralCode(uid: string) {
  try {
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) return;
    const data = snap.data();
    if (!data?.referralCode) {
      const code = Math.random().toString(36).substring(2, 5).toUpperCase() +
        Math.floor(Math.random() * 90 + 10);
      await userRef.set({ referralCode: code, referralsCount: 0 }, { merge: true });
    }
  } catch (e) { console.warn("Referral setup skipped:", e); }
}

async function createUserProfile(user: firebase.User) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isPremium: false,
      subscriptionStatus: "none",
    }, { merge: true });
  }
  await ensureReferralCode(user.uid);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [ready, setReady] = useState(false);

  // Google auth session
  const redirectUri = "https://auth.expo.io/@miguelin1/flashradar-app";  // Expo proxy  // Expo proxy  // Expo proxy
  const [_, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  // Handle Google response
  useEffect(() => {
    if (googleResponse?.type === "success") {
      const { id_token } = googleResponse.params;
      const credential = firebase.auth.GoogleAuthProvider.credential(id_token);
      auth.signInWithCredential(credential).then(cred => {
        if (cred.user) createUserProfile(cred.user);
      }).catch(console.error);
    }
  }, [googleResponse]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setReady(true);
      if (firebaseUser) await createUserProfile(firebaseUser);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    await auth.signInWithEmailAndPassword(email, password);
  };

  const signUp = async (email: string, password: string) => {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    if (!cred.user) return;
    const storedCode = await AsyncStorage.getItem("pendingReferral");
    if (storedCode) {
      const refSnap = await db.collection("users")
        .where("referralCode", "==", storedCode).limit(1).get();
      if (!refSnap.empty) {
        const refDoc = refSnap.docs[0];
        await refDoc.ref.set({
          referralsCount: (refDoc.data().referralsCount || 0) + 1,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await db.collection("users").doc(cred.user.uid).set({
          referredBy: refDoc.id,
          referralCodeUsed: storedCode,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await AsyncStorage.removeItem("pendingReferral");
    }
    await createUserProfile(cred.user);
  };

  const signOut = async () => { await auth.signOut(); };

  const signInWithGoogle = async () => {
    await googlePromptAsync();
  };

  const signInWithApple = async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const { identityToken } = credential;
    if (!identityToken) throw new Error("No identity token from Apple");
    const appleCredential = new firebase.auth.OAuthProvider("apple.com")
      .credential({ idToken: identityToken });
    const cred = await auth.signInWithCredential(appleCredential);
    if (cred.user) await createUserProfile(cred.user);
  };

  const isAdmin = ADMIN_EMAILS.has(user?.email ?? "");

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 18 }}>Loading FlashRadar…</Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, ready, isAdmin, signIn, signUp, signOut, signInWithGoogle, signInWithApple }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}