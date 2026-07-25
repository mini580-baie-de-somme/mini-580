import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bearerHeaders, ensureAdminUser, jsonRequest } from "../helpers";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

describe("API — agent memory CRUD", () => {
  let memoryId: string;

  beforeAll(async () => {
    await ensureAdminUser();
  });

  afterAll(async () => {
    if (!memoryId) return;
    const { DELETE } = await import("@/app/api/agent-memory/[id]/route");
    await DELETE(
      jsonRequest(`/api/agent-memory/${memoryId}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: memoryId }) }
    );
  });

  it("creates, lists, patches, and soft-deletes a memory item", async () => {
    const { POST: createPost } = await import("@/app/api/agent-memory/route");
    const createRes = await createPost(
      jsonRequest("/api/agent-memory", {
        method: "POST",
        headers: bearerHeaders(),
        body: JSON.stringify({
          title: "IT — ton sur Telegram",
          rule: "Réponses courtes, pas de tableaux markdown.",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    memoryId = created.id;
    expect(created.title).toBe("IT — ton sur Telegram");
    expect(created.rule).toContain("tableaux");
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();

    const { GET: listGet } = await import("@/app/api/agent-memory/route");
    const listRes = await listGet(
      jsonRequest("/api/agent-memory", {
        headers: bearerHeaders(),
        searchParams: { paginated: "1", q: "Telegram" },
      })
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items.some((i: { id: string }) => i.id === memoryId)).toBe(true);

    const { PATCH } = await import("@/app/api/agent-memory/[id]/route");
    const patchRes = await PATCH(
      jsonRequest(`/api/agent-memory/${memoryId}`, {
        method: "PATCH",
        headers: bearerHeaders(),
        body: JSON.stringify({ rule: "Réponses courtes, listes à puces." }),
      }),
      { params: Promise.resolve({ id: memoryId }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.rule).toContain("puces");

    const { DELETE } = await import("@/app/api/agent-memory/[id]/route");
    const delRes = await DELETE(
      jsonRequest(`/api/agent-memory/${memoryId}`, {
        method: "DELETE",
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: memoryId }) }
    );
    expect(delRes.status).toBe(200);

    const { GET: getOne } = await import("@/app/api/agent-memory/[id]/route");
    const gone = await getOne(
      jsonRequest(`/api/agent-memory/${memoryId}`, {
        headers: bearerHeaders(),
      }),
      { params: Promise.resolve({ id: memoryId }) }
    );
    expect(gone.status).toBe(404);
  });
});
