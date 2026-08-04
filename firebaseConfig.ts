import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { Platform } from "react-native";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFunctions } from "firebase/functions";
// @ts-ignore - getReactNativePersistence exists in the RN bundle, missing from web types
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

declare const global: any;

// @ts-ignore
import * as base64 from 'base-64';

if (!global.btoa) {
  global.btoa = (input: string) => base64.encode(input);
}
if (!global.atob) {
  global.atob = (input: string) => base64.decode(input);
}

if (Platform.OS !== "web") {
  require("react-native-get-random-values");
  // @ts-ignore
  global.XMLHttpRequest = global.originalXMLHttpRequest || global.XMLHttpRequest;
  // @ts-ignore
  global.fetch = global.fetch || fetch;
}

const firebaseConfig = {
  apiKey: 'AIzaSyCKn73y--LsPxw5vJBknf8VURDWiO84ZME',
  authDomain: "flashradar-71c93.firebaseapp.com",
  projectId: "flashradar-71c93",
  storageBucket: "flashradar-71c93.appspot.com",
  messagingSenderId: "2868928124",
  appId: "1:2868928124:web:de1db7082e461f70e033f9",
};

// Modular app + persistent auth (MUST init before compat firebase.auth())
const modularApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
if (Platform.OS !== "web") {
  try {
    initializeAuth(modularApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // already initialized (e.g. fast refresh) — safe to ignore
  }
}

// Compat init (reuses the same app/session)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const projectOptions = firebase.app().options as { projectId?: string };
console.log("🔥 Firestore project ID:", projectOptions.projectId || "unknown");

const functions = getFunctions(modularApp, "us-central1");

export { firebase, auth, db, functions };
