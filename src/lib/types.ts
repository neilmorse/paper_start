export type VenueType = "journal" | "conference";
export type Rank = "A" | "B" | "C";

export interface Domain {
  sub: string;
  name: string;
  nameEn: string;
  venueCount: number;
}

export interface Venue {
  key: string;
  abbr: string;
  name: string;
  type: VenueType;
  rank: Rank;
  domain: string;
  domainSub: string | null;
  sourceIds: string[];
  issns: string[];
  aliases: string[];
  dblpKey: string;
  confidence: string;
  worksCount: number | null;
}

export interface CcfCatalog {
  version: string;
  generatedAt: string;
  domains: Domain[];
  venues: Venue[];
}

export interface Biblio {
  volume?: string | null;
  issue?: string | null;
  first_page?: string | null;
  last_page?: string | null;
}

export interface Paper {
  id: string;
  doi: string | null;
  title: string;
  display_name: string;
  publication_year: number | null;
  cited_by_count: number;
  type: string | null;
  authors: string[];
  venue: string | null;
  sourceId: string;
  sourceType: string | null;
  biblio: Biblio | null;
  oaUrl: string | null;
  url: string | null;
  referenced_works: string[];
  refsTotal: number;
  refsTruncated: boolean;
  countries: string[];
  firstAuthorCountry: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

export interface SearchFilters {
  ranks: Rank[];
  domains: string[];
  types: VenueType[];
  yearFrom?: number;
  yearTo?: number;
}

export interface LibrarySnapshot {
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  sourceId: string;
  rank?: string;
  domain?: string | null;
  type: string | null;
  biblio: Biblio | null;
  doi: string | null;
  url: string | null;
  citedByCount: number;
  countries?: string[];
}

export interface LibraryItem {
  workId: string;
  savedAt: string;
  snapshot: LibrarySnapshot;
  tags: string[];
  status: "unread" | "reading" | "done";
  note: string;
}

export const DEFAULT_FILTERS: SearchFilters = { ranks: ["A"], domains: [], types: [] };

export const EXAMPLE_QUERIES = ["graph neural network", "large language model", "diffusion model"];