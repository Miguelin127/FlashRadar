// functions/src/types.d.ts

import "firebase-functions/v2";

declare module "firebase-functions/v2/https" {
  interface HttpsOptions {
    /**
     * 👇 Firebase Functions supports rawBody at runtime, but types are missing.
     */
    rawBody?: boolean;
  }
}
