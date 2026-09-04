import { adminAuth } from "../../src/server/auth.js";
import { neonAuthEmailRateLimitStore } from "../../src/server/neonAuthEmailRateLimit.js";
import {
  createPasswordRecoveryEmailHandler,
  PASSWORD_RECOVERY_MIN_RESPONSE_MS,
} from "../../src/server/passwordRecoveryEmail.js";

export default createPasswordRecoveryEmailHandler({
  auth: adminAuth,
  limiter: neonAuthEmailRateLimitStore,
  fingerprintSecret: process.env.PASSWORD_RECOVERY_FINGERPRINT_SECRET || "",
  minimumResponseMs: PASSWORD_RECOVERY_MIN_RESPONSE_MS,
  environment: process.env,
});
