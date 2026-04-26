// ============================================================
// agent-web-search-pro v2 — Shared Type System
// ============================================================

// ─── Legacy types (preserved for backward compatibility) ───

export type ExposureMode = "both";
export type SearchMode = "search" | "read-url" | "site-search";
export type ProviderName = "tavily" | "jina-reader" | "curl-jina-reader" | "degraded" | "hybrid";

export interface AgentWebSearchProState {
  currentStep: number;
  startedAt: string;
  exposureMode: ExposureMode;
  lastQuery?: string;
  lastUrl?: string;
  lastMode?: SearchMode;
  lastResultCount?: number;
  lastSummary?: string;
  lastProvider?: ProviderName;
}

export interface SearchSource {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  score?: number;
  deepReadApplied?: boolean;
}

export interface SearchRequestMeta {
  mode: SearchMode;
  query?: string;
  url?: string;
  site?: string;
  language?: string;
  limit: number;
  deepRead: boolean;
  sort?: string;
}

export interface SearchResultPayload {
  mode: SearchMode;
  provider: ProviderName;
  summary: string;
  results: SearchSource[];
  citations: Array<{ title: string; url: string }>;
  degraded: boolean;
  error?: string;
  request: SearchRequestMeta;
  resultCount: number;
  citationsCount: number;
  topResultsPreview: string[];
  responseTimeMs?: number;
  deepReadCount?: number;
  evidenceStatus: "sufficient" | "partial" | "none";
  shouldNotInferFacts: boolean;
  authoritative: boolean;
  antiHallucinationWarning?: string;
}

export interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

export interface ExtensionConfig {
  providers?: {
    tavily?: {
      apiKey?: string;
    };
    jinaReader?: {
      baseUrl?: string;
    };
  };
}

// ─── V2 Research Workflow Types ───

/** Output of plan_reresearch stage */
export interface ResearchPlan {
  originalQuery: string;
  aspects: string[];
  initialSubQueries: string[];
  suggestedSiteTypes: string[];
  suggestedEngines: string[];
  planningNotes?: string;
  /** Target confidence threshold for early termination */
  confidenceThreshold?: number;
  /** Maximum consecutive rounds with no new knowledge before stopping */
  stagnationLimit?: number;
}

/** A single search candidate discovered during search phase */
export interface SearchCandidate {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  score?: number;
  deepReadApplied?: boolean;
}

/** A page recommended for deep browsing */
export interface RecommendedPage {
  url: string;
  title: string;
  snippet: string;
  reason: string;
  score?: number;
}

/** Analysis result for a single browsed page */
export interface PageAnalysis {
  url: string;
  title: string;
  summary: string;
  keyFacts: string[];
  keyQuotes: string[];
  relevanceScore: number;
  extractedContent?: string;
  fetchError?: string;
}

/** A piece of adopted knowledge in the research pool */
export interface KnowledgeItem {
  sourceUrl: string;
  title: string;
  summary: string;
  keyFacts: string[];
  relevanceScore: number;
  adopted: boolean;
  round?: number;
}

/** Result of sufficiency judgment */
export interface SufficiencyResult {
  sufficient: boolean;
  confidence: number;
  coveredAspects: string[];
  missingAspects: string[];
  gaps: string[];
  answer?: string;
  sources?: Array<{ title: string; url: string; relevance: string }>;
  nextSuggestedSubQueries?: string[];
}

// ─── Phase 2: Structured Gap & Loop Types ───

/** Category of a research gap */
export type GapType =
  | "factual"        // missing concrete facts/data
  | "comparison"     // missing side-by-side comparison
  | "verification"   // claim needs cross-source verification
  | "depth"          // surface-level, needs deeper exploration
  | "breadth"        // missing alternative perspectives
  | "recency"        // needs latest/updated information
  | "context";       // missing contextual/background information

/** Structured representation of a single research gap */
export interface ResearchGap {
  /** Human-readable description of what's missing */
  description: string;
  /** Which research aspect this gap belongs to */
  aspect: string;
  /** Gap category for prioritization */
  type: GapType;
  /** How critical this gap is (0-1, higher = more important to fill) */
  priority: number;
  /** Suggested follow-up query to address this gap */
  suggestedQuery?: string;
  /** Which round this gap was first identified in */
  identifiedInRound?: number;
  /** Whether a follow-up query has already been attempted for this gap */
  queried: boolean;
}

/** Why the research loop stopped */
export type TerminationReason =
  | "sufficient_answer"      // confidence threshold met
  | "max_rounds_reached"     // hit maxRounds limit
  | "no_actionable_gaps"     // remaining gaps have low priority or already queried
  | "no_new_knowledge"       // latest round added no new adopted knowledge
  | "error";                 // unrecoverable error occurred

/** A query that has been executed during research */
export interface AskedQuery {
  query: string;
  round: number;
  /** Which gap(s) this query was generated from */
  sourceGapDescriptions?: string[];
  /** How many knowledge items resulted from this query */
  knowledgeCount: number;
}

/** Record of a single research round */
export interface RoundRecord {
  round: number;
  query: string;
  candidatesFound: number;
  pagesBrowsed: number;
  knowledgeAdopted: number;
  confidence: number;
  gapsRemaining: number;
  actionableGaps: number;
}

/** Cross-round research state (Phase 2 expanded) */
export interface ResearchState {
  originalQuery: string;
  plan?: ResearchPlan;
  knowledge: KnowledgeItem[];
  searchedUrls: string[];
  askedQueries: AskedQuery[];
  roundRecords: RoundRecord[];
  round: number;
  maxRounds: number;
  isComplete: boolean;
  terminationReason?: TerminationReason;
}

// ─── V2 Tool Output Types ───

export type PlanResearchOutput = {
  originalQuery: string;
  researchPlan: ResearchPlan;
};

export interface SearchRoundOutput {
  searchMeta: {
    query: string;
    engines: string[];
    siteFilter?: string;
    deepRead: boolean;
    timestamp: string;
    responseTimeMs?: number;
  };
  webResults: SearchCandidate[];
  recommendedToBrowse: RecommendedPage[];
  researchStatus: "has_candidates" | "no_results" | "degraded";
}

export interface BrowsePagesOutput {
  browseMeta: {
    focusQuery: string;
    urlsRequested: number;
    urlsSucceeded: number;
    urlsFailed: number;
    timestamp: string;
  };
  pageAnalyses: PageAnalysis[];
  adoptedKnowledge: KnowledgeItem[];
  rejectedPages: Array<{ url: string; reason: string }>;
  /** Phase 1.5: Fallback attempt records when primary URLs fail */
  fallbackAttempts?: Array<{ originalFailedUrl: string; fallbackUrl: string; fallbackSuccess: boolean }>;
  /** Phase 1.5: Number of successful fallback replacements */
  fallbackUsed?: number;
}

export interface SynthesizeResearchOutput {
  sufficient: boolean;
  confidence: number;
  coveredAspects: string[];
  missingAspects: string[];
  /** Phase 2: structured gaps instead of plain strings */
  gaps: ResearchGap[];
  answer?: string;
  sources?: Array<{ title: string; url: string; relevance: string }>;
  nextSuggestedSubQueries?: string[];
}
