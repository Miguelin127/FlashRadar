// ~/Desktop/FlashRadar/FlashRadarProject/start-firestore.js
import { spawn } from "child_process";

console.log("🚀 Forcing Firestore Emulator to bind to 0.0.0.0:8080...");

spawn("firebase", ["emulators:start", "--only", "firestore"], {
  stdio: "inherit",
  env: {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: "0.0.0.0:8080"
  }
});

// keep process alive
setInterval(() => {}, 1000);
