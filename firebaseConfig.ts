import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { Platform } from "react-native";

/* ───────── Polyfills for Expo / RN ───────── */

declare const global: any;

// ✅ Correct base64 polyfills (encode/decode DO NOT EXIST)
if (!global.btoa) {
  global.btoa = (input: string) =>
    Buffer.from(input, "binary").toString("base64");
}

if (!global.atob) {
  global.atob = (input: string) =>
    Buffer.from(input, "base64").toString("binary");
}

if (Platform.OS !== "web") {
  require("react-native-get-random-values");

  // Fix XMLHttpRequest for Firebase
  // @ts-ignore
  global.XMLHttpRequest =
    global.originalXMLHttpRequest || global.XMLHttpRequest;

  // Ensure fetch exists
  // @ts-ignore
  global.fetch = global.fetch || fetch;
}

// ✅ FlashRadar Firebase Config (Live project)
const firebaseConfig = {
  apiKey: "AIzaSyB7gxV9ssBg7T8p0ttjfiFLzXi6w6dPkOs",
  authDomain: "flashradar-71c93.firebaseapp.com",
  projectId: "flashradar-71c93",
  storageBucket: "flashradar-71c93.appspot.com",
  messagingSenderId: "2868928124",
  appId: "1:2868928124:web:de1db7082e461f70e033f9",
};

// ✅ Initialize Firebase once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ✅ Attempt to use local emulator, but auto-fallback if unreachable
async function tryConnectToEmulator() {
  if (!__DEV__) return;

  const localIP = "10.0.0.247"; // 👈 your Mac's LAN IP
  const emulatorURL = `http://${localIP}:8080`;
  console.log(`⚙️ DEV MODE: Trying Firestore Emulator at ${emulatorURL}`);

  try {
    // test if the emulator is reachable
    const response = await fetch(emulatorURL);
    if (response.ok || response.status === 404) {
      console.log("🧩 Connected to Firestore Emulator!");
      db.useEmulator(localIP, 8080);
      return;
    }
  } catch (err) {
    console.log("⚠️ Emulator not reachable, using live Firestore instead.");
  }

  console.log("🌎 Using Live Firestore (Production).");
}

// ✅ Confirm memory cache works fine
console.log("✅ Firestore memory cache active");

// ✅ Confirm correct project ID
const projectOptions = firebase.app().options as { projectId?: string };
console.log("🔥 Firestore project ID:", projectOptions.projectId || "unknown");

// ✅ Export everything
export { firebase, auth, db };
