import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyB7gxV9ssBg7T8p0ttjfiFLzXi6w6dPkOs",
  authDomain: "flashradar-71c93.firebaseapp.com",
  projectId: "flashradar-71c93",
  storageBucket: "flashradar-71c93.appspot.com",
  messagingSenderId: "2868928124",
  appId: "1:2868928124:web:de1db7082e461f70e033f9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
