import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { auth, db } from "../firebaseConfig";

export async function registerForPushToken(): Promise<string | null> {
  // Must be a real device — simulators don't get push tokens
  if (!Device.isDevice) {
    console.log("[Push] Skipping — not a real device");
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission denied");
    return null;
  }

  // Android channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("deals", {
      name: "Deal Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF7A00",
      sound: "default",
    });
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "10e28c1b-9e8d-4608-b9e1-9b3a263a1aea", // replace with your EAS project ID
  });

  const token = tokenData.data;
  console.log("[Push] Token:", token);

  // Save to Firestore
  const user = auth.currentUser;
  if (user && token) {
    await db.collection("users").doc(user.uid).set(
      {
        pushToken: token,
        pushTokenUpdatedAt: new Date(),
        notificationsEnabled: true,
        platform: Platform.OS,
      },
      { merge: true }
    );
    console.log("[Push] Token saved to Firestore");
  }

  return token;
}
