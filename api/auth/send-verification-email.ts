import { adminAuth, verifyFirebaseToken } from "../../src/server/auth.js";
import { neonAuthEmailRateLimitStore } from "../../src/server/neonAuthEmailRateLimit.js";
import { createVerificationEmailHandler } from "../../src/server/verificationEmail.js";

export default createVerificationEmailHandler({
  verifyToken: verifyFirebaseToken,
  auth: adminAuth,
  limiter: neonAuthEmailRateLimitStore,
  environment: process.env,
});
