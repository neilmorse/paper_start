// LLM 桩：M6 实现通用 OpenAI 兼容客户端。M2 仅暴露配置状态 + 校验 method/body。
export function llmConfigured(): boolean {
  return Boolean(
    Deno.env.get("LLM_BASE_URL") && Deno.env.get("LLM_MODEL") && Deno.env.get("LLM_API_KEY"),
  );
}

const MAX_BODY = 64 * 1024;

export async function handleAi(subpath: string, req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  const body = await req.text();
  if (body.length > MAX_BODY) {
    return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }
  if (!llmConfigured()) {
    return Response.json({ ok: false, error: "service_not_configured" }, { status: 503 });
  }
  // M6 实现 /ai/keywords 与 /ai/survey
  return Response.json({ ok: false, error: "not_implemented", subpath }, { status: 501 });
}