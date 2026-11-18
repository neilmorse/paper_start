// LLM：通用 OpenAI 兼容客户端（非流式）。双插槽隔离：LLM 只产 background/gap 两节，
// 矩阵/时间线/参考文献永远由元数据确定性生成——幻觉不污染结构化部分。
// 无 key 优雅降级（503），前端置灰 AI 入口；隐私声明见 About/README。
export function llmConfigured(): boolean {
  return Boolean(
    Deno.env.get("LLM_BASE_URL") && Deno.env.get("LLM_MODEL") && Deno.env.get("LLM_API_KEY"),
  );
}

const MAX_BODY = 64 * 1024;
const MAX_SLOT = 4000; // 两槽合计 ≤8000 字符
const TIMEOUT_MS = 50000; // 平台 Function 超时上限未文档化，部署后实测再调
const MAX_PAPERS = 20;
const ABSTRACT_CHARS = 600;

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...extra } });

export function stripFences(s: string): string {
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(s.trim());
  return m ? m[1] : s.trim();
}

interface ProposalPaper {
  title?: string;
  venue?: string | null;
  year?: number | null;
  cited?: number;
  abstract?: string;
}

export async function handleAi(subpath: string, req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
  }
  const body = await req.text();
  if (body.length > MAX_BODY) return json({ ok: false, error: "payload_too_large" }, 413);
  if (!llmConfigured()) return json({ ok: false, error: "service_not_configured" }, 503);
  if (subpath !== "/ai/proposal") return json({ ok: false, error: "not_implemented", subpath }, 501);

  let input: any;
  try {
    input = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "invalid_input" }, 400);
  }
  const papers: ProposalPaper[] = Array.isArray(input?.papers) ? input.papers.slice(0, MAX_PAPERS) : [];
  if (!papers.length || typeof input?.query !== "string" || !input.query.trim()) {
    return json({ ok: false, error: "invalid_input" }, 400);
  }
  const list = papers
    .map(
      (p, i) =>
        `[${i + 1}] ${p.title ?? ""}（${p.venue ?? "未知来源"}, ${p.year ?? "n.d."}, 引用 ${p.cited ?? 0}）\n摘要：${(p.abstract ?? "").slice(0, ABSTRACT_CHARS)}`,
    )
    .join("\n");
  const messages = [
    {
      role: "system",
      content:
        '你是中文学术开题助手。仅输出 JSON 对象 {"background": string, "gap": string}，不要输出其他文本。background 用中文概述该研究领域背景与意义（≤600字）；gap 用中文归纳开放问题与研究空白（≤600字）。只能基于给定文献，不得编造文献或引用。',
    },
    { role: "user", content: `检索主题：${input.query}\n\n文献列表：\n${list}` },
  ];

  let res: Response;
  try {
    res = await fetch(Deno.env.get("LLM_BASE_URL")!.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LLM_API_KEY")}`,
      },
      body: JSON.stringify({ model: Deno.env.get("LLM_MODEL"), messages, stream: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // AbortSignal.timeout 触发=真超时；其余 fetch 异常（TLS/连接失败）=不可达，语义分开便于排障
    const aborted = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
    return json({ ok: false, error: aborted ? "ai_timeout" : "ai_unreachable" }, aborted ? 504 : 502);
  }
  if (!res.ok) return json({ ok: false, error: "ai_upstream_error" }, 502);
  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return json({ ok: false, error: "ai_bad_response" }, 502);
  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(content));
  } catch {
    return json({ ok: false, error: "ai_bad_response" }, 502);
  }
  if (typeof parsed?.background !== "string" || typeof parsed?.gap !== "string") {
    return json({ ok: false, error: "ai_bad_response" }, 502);
  }
  return json({
    ok: true,
    background: parsed.background.slice(0, MAX_SLOT),
    gap: parsed.gap.slice(0, MAX_SLOT),
    model: Deno.env.get("LLM_MODEL"),
  });
}