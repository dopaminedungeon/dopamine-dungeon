import type { APIRequestContext } from "@playwright/test";

export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const FIREBASE_TEST_PROJECT_ID = "demo-dopamine-dungeon";
const apiKey = "demo-api-key";

async function expectOk(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
  if (!response.ok()) {
    throw new Error(
      `Auth emulator request failed: ${response.status()} ${await response.text()}`
    );
  }
  return response.json();
}

export async function clearAuthEmulator(request: APIRequestContext) {
  const response = await request.delete(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${FIREBASE_TEST_PROJECT_ID}/accounts`
  );
  if (!response.ok()) {
    throw new Error(`Failed to clear Auth emulator users: ${response.status()}`);
  }
}

export async function signUpWithPassword(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    { data: { email, password, returnSecureToken: true } }
  );
  return expectOk(response);
}

export async function signInWithPassword(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    { data: { email, password, returnSecureToken: true } }
  );
  return expectOk(response);
}

export async function sendVerificationEmail(
  request: APIRequestContext,
  idToken: string
) {
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    { data: { requestType: "VERIFY_EMAIL", idToken } }
  );
  await expectOk(response);
}

export async function verifyEmailThroughEmulator(
  request: APIRequestContext,
  email: string
) {
  const codesResponse = await request.get(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${FIREBASE_TEST_PROJECT_ID}/oobCodes`
  );
  const { oobCodes } = await expectOk(codesResponse);
  const verification = oobCodes.find(
    (code: { email: string; requestType: string }) =>
      code.email === email && code.requestType === "VERIFY_EMAIL"
  );

  if (!verification?.oobCode) {
    throw new Error(`No email verification code found for ${email}.`);
  }

  const confirmationResponse = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
    { data: { oobCode: verification.oobCode } }
  );
  await expectOk(confirmationResponse);
}

export async function createVerifiedUser(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const account = await signUpWithPassword(request, email, password);
  await sendVerificationEmail(request, account.idToken);
  await verifyEmailThroughEmulator(request, email);
}
