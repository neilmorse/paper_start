import { apiGet } from "./api";
import type { RepoHit } from "./types";

export async function fetchRepos(title: string): Promise<RepoHit[]> {
  const b = await apiGet<{ ok: boolean; repos?: RepoHit[] }>("/github", { title });
  return b.repos ?? [];
}