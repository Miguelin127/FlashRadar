import fs from "fs";
import admin from "firebase-admin";

admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

const data = JSON.parse(fs.readFileSync("./seedUsers.json", "utf8"));

(async () => {
  const users = data.users || {};
  for (const [id, user] of Object.entries(users)) {
    await db.collection("users").doc(id).set(user);
    console.log(`✅ Imported user: ${id}`);
  }
  console.log("🎉 All users imported successfully!");
  process.exit(0);
})();
