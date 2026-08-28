import { adminAuth, adminDb, verifyFirebaseToken } from "../../src/server/auth.js";
import { createVerificationEmailHandler } from "../../src/server/verificationEmail.js";

export default createVerificationEmailHandler({
  verifyToken: verifyFirebaseToken,
  auth: adminAuth,
  db: adminDb,
  environment: process.env,
});
