import type { VercelRequest, VercelResponse } from "@vercel/node";
import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import { workspaces } from "../../../db/schema/workspaces.js";
import { AuthenticationError } from "../apiErrors.js";

const mocks = vi.hoisted(() => {
  const state = {
    conflictTargets: [] as unknown[],
    insertErrors: [] as Array<Error | undefined>,
    insertRows: [] as unknown[][],
    insertValues: [] as unknown[],
    selectRows: [] as unknown[][],
  };

  function selectResult(rows: unknown[]) {
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(rows),
        })),
      })),
    };
  }

  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        state.insertValues.push(values);
        const returning = vi.fn(() => {
          const error = state.insertErrors.shift();
          if (error) return Promise.reject(error);
          return Promise.resolve(state.insertRows.shift() ?? []);
        });

        return {
          onConflictDoNothing: vi.fn((config: unknown) => {
            state.conflictTargets.push(config);
            return { returning };
          }),
          returning,
        };
      }),
    })),
    select: vi.fn(() => selectResult(state.selectRows.shift() ?? [])),
  };

  return {
    db: {
      transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx)
      ),
    },
    getCurrentUser: vi.fn(),
    setCorsHeaders: vi.fn(),
    state,
    tx,
  };
});

vi.mock("../access.js", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("../db.js", () => ({ db: mocks.db }));
vi.mock("../cors.js", () => ({ setCorsHeaders: mocks.setCorsHeaders }));

import workspaceCreateHandler from "./workspace-create.js";

const currentUser = { id: "00000000-0000-4000-8000-000000000010" };
const idempotencyKey = "c43787c4-749a-4bb1-a014-601901d6039f";
const workspace = {
  id: "00000000-0000-4000-8000-000000000011",
  name: "Canonical Workspace",
  slug: "workspace-278d496f-c748-4b7b-a635-04ad09e10f42",
  ownerUserId: currentUser.id,
  creationRequestKey: idempotencyKey,
};
const ownerMembership = {
  id: "00000000-0000-4000-8000-000000000012",
  workspaceId: workspace.id,
  userId: currentUser.id,
  role: "owner",
};

function request(body: Record<string, unknown>) {
  return {
    body,
    headers: { authorization: "Bearer emulator-token" },
    method: "POST",
    query: {},
  } as unknown as VercelRequest;
}

function optionsRequest() {
  return {
    headers: {},
    method: "OPTIONS",
    query: {},
  } as unknown as VercelRequest;
}

function response() {
  const result: { body?: unknown; status?: number } = {};
  const res = {
    end: vi.fn(() => res),
    json: vi.fn((body: unknown) => {
      result.body = body;
      return res;
    }),
    setHeader: vi.fn(() => res),
    status: vi.fn((status: number) => {
      result.status = status;
      return res;
    }),
  } as unknown as VercelResponse;

  return { res, result };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.conflictTargets.length = 0;
  mocks.state.insertErrors.length = 0;
  mocks.state.insertRows.length = 0;
  mocks.state.insertValues.length = 0;
  mocks.state.selectRows.length = 0;
  mocks.getCurrentUser.mockResolvedValue(currentUser);
});

test("advertises POST in the creation endpoint preflight response", async () => {
  const { res, result } = response();

  await workspaceCreateHandler(optionsRequest(), res);

  assert.equal(result.status, 204);
  assert.deepEqual(mocks.setCorsHeaders.mock.calls[0], [res, "POST, OPTIONS"]);
  assert.equal(mocks.getCurrentUser.mock.calls.length, 0);
});

test("creates the Neon workspace and server-owned owner membership in one transaction", async () => {
  mocks.state.selectRows.push([], []);
  mocks.state.insertRows.push([workspace], [ownerMembership]);
  const { res, result } = response();

  await workspaceCreateHandler(
    request({
      name: workspace.name,
      idempotencyKey,
      ownerUid: "firebase-uid-from-client",
      role: "gm",
    }),
    res
  );

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, {
    ok: true,
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
  });
  assert.equal(mocks.db.transaction.mock.calls.length, 1);
  const [workspaceInsert, membershipInsert] = mocks.state.insertValues as Array<
    Record<string, unknown>
  >;
  assert.equal(workspaceInsert.name, workspace.name);
  assert.equal(workspaceInsert.ownerUserId, currentUser.id);
  assert.equal(workspaceInsert.creationRequestKey, idempotencyKey);
  assert.match(String(workspaceInsert.slug), /^workspace-[0-9a-f-]{36}$/);
  assert.equal(String(workspaceInsert.slug).includes(idempotencyKey), false);
  assert.deepEqual(membershipInsert, {
    workspaceId: workspace.id,
    userId: currentUser.id,
    role: "owner",
  });
  assert.deepEqual((mocks.state.conflictTargets[0] as { target: unknown }).target, [
    workspaces.ownerUserId,
    workspaces.creationRequestKey,
  ]);
});

test("fails the request when owner-membership creation fails inside the transaction", async () => {
  mocks.state.selectRows.push([], []);
  mocks.state.insertRows.push([workspace]);
  mocks.state.insertErrors.push(undefined, new Error("membership insert failed"));
  const { res, result } = response();

  await workspaceCreateHandler(request({ name: workspace.name, idempotencyKey }), res);

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { ok: false, error: "Workspace creation failed" });
  assert.equal(mocks.db.transaction.mock.calls.length, 1);
  assert.equal(mocks.state.insertValues.length, 2);
});

test("rejects unauthenticated creation before starting a database transaction", async () => {
  mocks.getCurrentUser.mockRejectedValue(new AuthenticationError("Invalid token"));
  const { res, result } = response();

  await workspaceCreateHandler(request({ name: workspace.name, idempotencyKey }), res);

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { ok: false, error: "Authentication required" });
  assert.equal(mocks.db.transaction.mock.calls.length, 0);
});

test("returns the same workspace for an owner retry without duplicate writes", async () => {
  mocks.state.selectRows.push([workspace], [ownerMembership]);
  const { res, result } = response();

  await workspaceCreateHandler(request({ name: "Changed retry name", idempotencyKey }), res);

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, {
    ok: true,
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
  });
  assert.equal(mocks.state.insertValues.length, 0);
});

test("resolves a concurrent idempotency-key conflict to the committed owner workspace", async () => {
  mocks.state.selectRows.push([], [workspace], [ownerMembership]);
  mocks.state.insertRows.push([]);
  const { res, result } = response();

  await workspaceCreateHandler(request({ name: workspace.name, idempotencyKey }), res);

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, {
    ok: true,
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
  });
  assert.equal(mocks.state.insertValues.length, 1);
});

test("allows the same workspace name with a different owner-scoped request key", async () => {
  const secondIdempotencyKey = "040321ec-af81-4f0d-a09c-a889d22d825a";
  const secondWorkspace = {
    ...workspace,
    id: "00000000-0000-4000-8000-000000000013",
    slug: "workspace-65efc937-47ff-4d58-8479-cfd3201f2d1e",
    creationRequestKey: secondIdempotencyKey,
  };
  const secondMembership = {
    ...ownerMembership,
    id: "00000000-0000-4000-8000-000000000014",
    workspaceId: secondWorkspace.id,
  };
  mocks.state.selectRows.push([], [], [], []);
  mocks.state.insertRows.push(
    [workspace],
    [ownerMembership],
    [secondWorkspace],
    [secondMembership]
  );
  const first = response();
  const second = response();

  await workspaceCreateHandler(request({ name: workspace.name, idempotencyKey }), first.res);
  await workspaceCreateHandler(
    request({ name: workspace.name, idempotencyKey: secondIdempotencyKey }),
    second.res
  );

  assert.equal(first.result.status, 201);
  assert.equal(second.result.status, 201);
  assert.notEqual(
    (first.result.body as { workspace: { id: string } }).workspace.id,
    (second.result.body as { workspace: { id: string } }).workspace.id
  );
  const workspaceInserts = (mocks.state.insertValues as Array<Record<string, unknown>>)
    .filter((value) => "creationRequestKey" in value);
  assert.deepEqual(
    workspaceInserts.map((value) => value.creationRequestKey),
    [idempotencyKey, secondIdempotencyKey]
  );
});

test("scopes a reused request key to the authenticated owner", async () => {
  const otherUser = { id: "00000000-0000-4000-8000-000000000099" };
  const otherWorkspace = {
    ...workspace,
    id: "00000000-0000-4000-8000-000000000015",
    slug: "workspace-7a2fc53d-4b20-45fb-8d0a-8a3fb4d5a80d",
    ownerUserId: otherUser.id,
  };
  const otherMembership = {
    ...ownerMembership,
    id: "00000000-0000-4000-8000-000000000016",
    workspaceId: otherWorkspace.id,
    userId: otherUser.id,
  };
  mocks.getCurrentUser.mockResolvedValue(otherUser);
  mocks.state.selectRows.push([], []);
  mocks.state.insertRows.push([otherWorkspace], [otherMembership]);
  const { res, result } = response();

  await workspaceCreateHandler(request({ name: workspace.name, idempotencyKey }), res);

  assert.equal(result.status, 201);
  assert.deepEqual(result.body, {
    ok: true,
    workspace: {
      id: otherWorkspace.id,
      name: otherWorkspace.name,
      slug: otherWorkspace.slug,
    },
  });
  assert.equal((mocks.state.insertValues[0] as Record<string, unknown>).ownerUserId, otherUser.id);
});
