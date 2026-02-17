// functions/src/seedKeepaAsinPool.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

export const seedKeepaAsinPool = onSchedule(
  {
    schedule: "every 24 hours",
    region: "us-central1",
  },
  async () => {
    logger.info("🛑 seedKeepaAsinPool DISABLED — ASIN-based pipeline in use");
    return;
  }
);
