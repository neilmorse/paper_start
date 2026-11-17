// OpenAlex HTTP 客户端：key/mailto 注入、≤5rps 限速、重试 2、响应落盘缓存、预算守卫。
// 预算以响应头 x-ratelimit-remaining-usd 为权威；缓存命中零花费。缓存文件不含 key。
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CACHE_DIR = join(ROOT, "data", "cache", "openalex");
const API = "https://api.openalex.org";
const MAILTO = process.env.OPENALEX_MAILTO || "neilmorse@foxmail.com";
const KEY = process.env.OPENALEX_API_KEY || "";
const MIN_INTERVAL_MS = 220;
const MAX_RETRY = 2;
const RESERVE_USD = 0.05;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BudgetError extends Error {
  constructor(remaining) {
    super(`OpenAlex 日预算接近耗尽（剩余 $${remaining}，保留 $${RESERVE_USD}），停止付费请求`);
    this.name = "BudgetError";
    this.remaining = remaining;
  }
}

export function parseRateLimit(headers) {
  const get = (name) => {
    const v = headers.get ? headers.get(name) : headers[name];
    return v == null ? null : Number(v);
  };
  return {
    remainingUsd: get("x-ratelimit-remaining-usd"),
    limitUsd: get("x-ratelimit-limit-usd"),
    costUsd: get("x-ratelimit-cost-usd"),
    resetSeconds: get("x-ratelimit-reset"),
  };
}

const state = { remainingUsd: null, spentUsd: 0, requests: 0, cacheHits: 0 };
let lastRequest = 0;

export function budgetState() {
  return { ...state };
}
export function budgetExhausted() {
  return state.remainingUsd !== null && state.remainingUsd < RESERVE_USD;
}

function cacheFile(endpoint, params) {
  const sig = createHash("sha256")
    .update(endpoint + "?" + new URLSearchParams(params).toString())
    .digest("hex")
    .slice(0, 20);
  return join(CACHE_DIR, `${sig}.json`);
}

export async function openalexGet(endpoint, params = {}) {
  const file = cacheFile(endpoint, params);
  if (existsSync(file)) {
    state.cacheHits++;
    const cached = JSON.parse(await readFile(file, "utf8"));
    return cached.body;
  }
  if (!KEY) throw new Error("OPENALEX_API_KEY 未配置（写入项目 .env）");
  if (budgetExhausted()) throw new BudgetError(state.remainingUsd);

  const u = new URL(API + endpoint);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  u.searchParams.set("mailto", MAILTO);
  u.searchParams.set("api_key", KEY);

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequest);
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
      const rl = parseRateLimit(r.headers);
      if (rl.remainingUsd !== null) state.remainingUsd = rl.remainingUsd;
      if (r.status === 429) {
        lastErr = new Error("OpenAlex 429（速率/额度）");
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!r.ok) throw new Error(`OpenAlex HTTP ${r.status}：${(await r.text()).slice(0, 200)}`);
      const body = await r.json();
      state.requests++;
      if (rl.costUsd !== null) state.spentUsd += rl.costUsd;
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(
        file,
        JSON.stringify({ endpoint, params, fetchedAt: new Date().toISOString(), costUsd: rl.costUsd, body }, null, 2),
      );
      return body;
    } catch (e) {
      lastErr = e;
      if (e instanceof BudgetError) throw e;
      if (attempt < MAX_RETRY) await sleep(800 * (attempt + 1));
    }
  }
  throw lastErr;
}