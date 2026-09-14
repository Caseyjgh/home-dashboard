import assert from "node:assert/strict";
import { test } from "node:test";
import { requestJson } from "../src/lib/client-request.ts";

test("JSON request preserves HTTP errors for refresh cooldown handling", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ retryAfter: 300 }, { status: 429 }));
  const { response, data } = await requestJson("/api/calendar/refresh");
  assert.equal(response.status, 429);
  assert.equal(data.retryAfter, 300);
});

test("deadline aborts a stalled body and does not retry mutations", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    calls++;
    return new Response(new ReadableStream({
      start(controller) {
        signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
      },
    }));
  });
  await assert.rejects(requestJson("/api/calendar/refresh", { method: "POST" }, 10), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("component cancellation aborts the active request", async (t) => {
  t.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  const lifetime = new AbortController();
  const pending = requestJson("/api/calendar", { signal: lifetime.signal });
  lifetime.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("settled requests remove the external abort listener", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  const lifetime = new AbortController();
  const remove = t.mock.method(lifetime.signal, "removeEventListener");
  await requestJson("/api/calendar", { signal: lifetime.signal });
  assert.equal(remove.mock.callCount(), 1);
});
