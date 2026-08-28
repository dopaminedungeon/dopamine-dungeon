import { adminAuth, adminDb } from "../../src/server/auth.js";
import {
  createPasswordRecoveryEmailHandler,
  PASSWORD_RECOVERY_MIN_RESPONSE_MS,
} from "../../src/server/passwordRecoveryEmail.js";

export default createPasswordRecoveryEmailHandler({
  auth: adminAuth,
  db: adminDb,
  fingerprintSecret: process.env.PASSWORD_RECOVERY_FINGERPRINT_SECRET || "",
  minimumResponseMs: PASSWORD_RECOVERY_MIN_RESPONSE_MS,
  environment: process.env,
});
