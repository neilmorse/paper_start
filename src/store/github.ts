import { create } from "zustand";
import { fetchRepos } from "@/src/lib/github";
import type { RepoHit } from "@/src/lib/types";

export interface RepoLookup {
  status: "loading" | "ready" | "error";
  repos: RepoHit[];
  error: string | null;
}

interface GithubState {
  byWorkId: Record<string, RepoLookup>;
  lookup: (workId: string, title: string) => Promise<void>;
}

// GitHub 错误不触发 demo 兜底（与 OpenAlex 额度无关），仅灰字提示。
const ERR: Record<string, string> = {
  github_rate_limited: "GitHub 查询限流（共享出口额度），请稍后再试。",
  github_unreachable: "GitHub 服务暂不可达。",
  invalid_input: "标题过短，无法检索仓库。",
};

export const useGithubStore = create<GithubState>((set, get) => ({
  byWorkId: {},
  lookup: async (workId, title) => {
    const cur = get().byWorkId[workId];
    if (cur?.status === "loading" || cur?.status === "ready") return;
    set({ byWorkId: { ...get().byWorkId, [workId]: { status: "loading", repos: [], error: null } } });
    try {
      const repos = await fetchRepos(title);
      set({ byWorkId: { ...get().byWorkId, [workId]: { status: "ready", repos, error: null } } });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "github_unreachable";
      set({ byWorkId: { ...get().byWorkId, [workId]: { status: "error", repos: [], error: ERR[code] ?? "GitHub 查询失败。" } } });
    }
  },
}));