import type { APIRequestContext } from "@playwright/test";

export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const FIREBASE_TEST_PROJECT_ID = "demo-dopamine-dungeon";
const apiKey = "demo-api-key";
const emulatorAccounts = new Map<
  string,
  {
    disabled: boolean;
    email: string;
    emailVerified: boolean;
    localId: string;
    providerUserInfo: Array<{ providerId: string }>;
  }
>();

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
  emulatorAccounts.clear();
}

export async function getAuthEmulatorAccount(
  request: APIRequestContext,
  email: string
) {
  return emulatorAccounts.get(email.toLowerCase());
}

export async function findAuthEmulatorAccountByEmail(
  request: APIRequestContext,
  email: string
) {
  const response = await request.get(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/projects/${FIREBASE_TEST_PROJECT_ID}/accounts:batchGet?key=${apiKey}`,
    { headers: { Authorization: "Bearer owner" } }
  );
  const body = await expectOk(response);
  return (body.users || []).find(
    (account: { email?: string }) => account.email?.toLowerCase() === email.toLowerCase()
  );
}

export async function lookupAuthEmulatorAccount(
  request: APIRequestContext,
  idToken: string
) {
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { data: { idToken } }
  );
  const { users = [] } = await expectOk(response);
  return users[0];
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
  const account = await expectOk(response);
  emulatorAccounts.set(email.toLowerCase(), {
    disabled: false,
    email,
    emailVerified: false,
    localId: account.localId,
    providerUserInfo: [{ providerId: "password" }],
  });
  return account;
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

export async function createGoogleOnlyUser(
  request: APIRequestContext,
  email: string,
  subject = `google-${Date.now()}`
) {
  const fakeIdToken = JSON.stringify({
    sub: subject,
    email,
    email_verified: true,
  });
  const postBody = new URLSearchParams({
    id_token: fakeIdToken,
    providerId: "google.com",
  }).toString();
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`,
    {
      data: {
        postBody,
        requestUri: "http://127.0.0.1:4173",
        returnIdpCredential: true,
        returnSecureToken: true,
      },
    }
  );
  const account = await expectOk(response);
  emulatorAccounts.set(email.toLowerCase(), {
    disabled: false,
    email,
    emailVerified: true,
    localId: account.localId,
    providerUserInfo: [{ providerId: "google.com" }],
  });
  return { ...account, subject };
}

export async function addPasswordProvider(
  request: APIRequestContext,
  idToken: string,
  email: string,
  password: string
) {
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
    {
      data: {
        idToken,
        email,
        password,
        returnSecureToken: true,
      },
    }
  );
  const account = await expectOk(response);
  const cached = emulatorAccounts.get(email.toLowerCase());
  if (cached) {
    cached.providerUserInfo = [
      { providerId: "google.com" },
      { providerId: "password" },
    ];
  }
  return account;
}

export async function addPasswordProviderByLocalId(
  request: APIRequestContext,
  localId: string,
  email: string,
  password: string,
  emailVerified = true
) {
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/projects/${FIREBASE_TEST_PROJECT_ID}/accounts:update?key=${apiKey}`,
    {
      headers: { Authorization: "Bearer owner" },
      data: {
        localId,
        email,
        emailVerified,
        password,
      },
    }
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

export async function requestPasswordResetThroughEmulator(
  request: APIRequestContext,
  email: string
) {
  const response = await request.post(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    { data: { requestType: "PASSWORD_RESET", email } }
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
  const account = emulatorAccounts.get(email.toLowerCase());
  if (account) account.emailVerified = true;
}

export async function getVerificationCode(
  request: APIRequestContext,
  email: string
) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const codesResponse = await request.get(
      `${AUTH_EMULATOR_URL}/emulator/v1/projects/${FIREBASE_TEST_PROJECT_ID}/oobCodes`
    );
    const { oobCodes } = await expectOk(codesResponse);
    const verification = oobCodes.find(
      (code: { email: string; requestType: string }) =>
        code.email === email && code.requestType === "VERIFY_EMAIL"
    );

    if (verification?.oobCode) return verification.oobCode as string;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`No email verification code found for ${email}.`);
}

export async function getPasswordResetCode(
  request: APIRequestContext,
  email: string
) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const codesResponse = await request.get(
      `${AUTH_EMULATOR_URL}/emulator/v1/projects/${FIREBASE_TEST_PROJECT_ID}/oobCodes`
    );
    const { oobCodes } = await expectOk(codesResponse);
    const reset = oobCodes.find(
      (code: { email: string; requestType: string }) =>
        code.email === email && code.requestType === "PASSWORD_RESET"
    );

    if (reset?.oobCode) return reset.oobCode as string;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`No password reset code found for ${email}.`);
}

export async function hasPasswordResetCode(
  request: APIRequestContext,
  email: string
) {
  const codesResponse = await request.get(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${FIREBASE_TEST_PROJECT_ID}/oobCodes`
  );
  const { oobCodes = [] } = await expectOk(codesResponse);
  return oobCodes.some(
    (code: { email: string; requestType: string }) =>
      code.email === email && code.requestType === "PASSWORD_RESET"
  );
}

export async function createVerifiedUser(
  request: APIRequestContext,
  email: string,
  password: string
) {
  const account = await signUpWithPassword(request, email, password);
  await sendVerificationEmail(request, account.idToken);
  await verifyEmailThroughEmulator(request, email);
  return account;
}
