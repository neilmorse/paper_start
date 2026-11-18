import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stripFences } from "@/functions/llm.ts";

let handler: (req: Request) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
const env: Record<string, string> = {
  LLM_BASE_URL: "https://llm.example/v1",
  LLM_MODEL: "test-model",
  LLM_API_KEY: "sk-test",
};

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  ({ handler } = await import("@/functions/handler.ts"));
});
afterEach(() => vi.unstubAllGlobals());

const post = (body: unknown) =>
  new Request("http://local/functions/v1/app/ai/proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const validInput = { query: "graph neural network", papers: [{ title: "GAT", venue: "ICLR", year: 2018, cited: 100, abstract: "graph attention" }] };
const llmOk = (content: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });

describe("stripFences", () => {
  it("strips json fences and bare fences, passes plain JSON", () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe("/ai/proposal validation", () => {
  it("GET → 405; missing secrets → 503", async () => {
    expect((await handler(new Request("http://local/functions/v1/app/ai/proposal"))).status).toBe(405);
    delete env.LLM_API_KEY;
    vi.resetModules();
    ({ handler } = await import("@/functions/handler.ts"));
    expect((await handler(post(validInput))).status).toBe(503);
    env.LLM_API_KEY = "sk-test";
  });
  it("413 for oversized body; 400 for bad JSON / empty papers / missing query", async () => {
    const big = new Request("http://local/functions/v1/app/ai/proposal", { method: "POST", body: "x".repeat(64 * 1024 + 1) });
    expect((await handler(big)).status).toBe(413);
    const bad = new Request("http://local/functions/v1/app/ai/proposal", { method: "POST", body: "{bad" });
    expect((await handler(bad)).status).toBe(400);
    expect((await handler(post({ query: "q", papers: [] }))).status).toBe(400);
    expect((await handler(post({ papers: validInput.papers }))).status).toBe(400);
  });
  it("/ai/keywords remains not_implemented", async () => {
    const res = await handler(new Request("http://local/functions/v1/app/ai/keywords", { method: "POST", body: "{}" }));
    expect(res.status).toBe(501);
  });
});

describe("/ai/proposal LLM client", () => {
  it("sends OpenAI-compatible request with Bearer key and model", async () => {
    fetchMock.mockResolvedValue(llmOk('{"background":"b","gap":"g"}'));
    const res = await handler(post(validInput));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, background: "b", gap: "g", model: "test-model" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://llm.example/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("test-model");
    expect(sent.stream).toBe(false);
    expect(sent.messages).toHaveLength(2);
    expect(sent.messages[1].content).toContain("graph attention");
  });
  it("strips fences from model output", async () => {
    fetchMock.mockResolvedValue(llmOk('```json\n{"background":"b2","gap":"g2"}\n```'));
    const body = await (await handler(post(validInput))).json();
    expect(body.background).toBe("b2");
  });
  it("malformed JSON / missing slots → ai_bad_response 502", async () => {
    fetchMock.mockResolvedValue(llmOk("not json at all"));
    expect((await handler(post(validInput))).status).toBe(502);
    fetchMock.mockResolvedValue(llmOk('{"background":"b"}'));
    const res = await handler(post(validInput));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("ai_bad_response");
  });
  it("caps slots at 4000 chars each", async () => {
    fetchMock.mockResolvedValue(llmOk(JSON.stringify({ background: "b".repeat(9000), gap: "g".repeat(9000) })));
    const body = await (await handler(post(validInput))).json();
    expect(body.background).toHaveLength(4000);
    expect(body.gap).toHaveLength(4000);
  });
  it("abort → ai_timeout 504; network/TLS failure → ai_unreachable 502; upstream 500 → ai_upstream_error 502", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect((await handler(post(validInput))).status).toBe(504);
    fetchMock.mockRejectedValue(new Error("tls eof"));
    const unreachable = await handler(post(validInput));
    expect(unreachable.status).toBe(502);
    expect((await unreachable.json()).error).toBe("ai_unreachable");
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const res = await handler(post(validInput));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("ai_upstream_error");
  });
  it("truncates papers to 20 and abstracts to 600 chars", async () => {
    fetchMock.mockResolvedValue(llmOk('{"background":"b","gap":"g"}'));
    const papers = Array.from({ length: 30 }, (_, i) => ({ title: `P${i}`, abstract: "a".repeat(2000) }));
    await handler(post({ query: "q", papers }));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.messages[1].content).toContain("[20]");
    expect(sent.messages[1].content).not.toContain("[21]");
    expect(sent.messages[1].content).not.toContain("a".repeat(601));
  });
});