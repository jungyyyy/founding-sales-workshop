import type Anthropic from "@anthropic-ai/sdk";

/** A founder's identifier, as listed in content/founders.json. */
export type FounderSlug = string;

export interface Founder {
  slug: FounderSlug;
  name: string;
}

export interface Artifact {
  id: number;
  key: string;
  version: number;
  title: string;
  content: string;
  is_draft: boolean;
  module: number | null;
  created_by: FounderSlug;
  created_at: string;
  accepted_by: FounderSlug | null;
  accepted_at: string | null;
  authors: FounderSlug[] | null; // both founders when written in a shared build session
}

export interface ArtifactNote {
  id: number;
  artifact_id: number;
  founder_slug: FounderSlug;
  body: string;
  resolved: boolean;
  created_at: string;
}

export interface BuildSession {
  id: number;
  module: number;
  founder_slug: FounderSlug;
  messages: Anthropic.MessageParam[];
  status: "open" | "done";
  shared: boolean;
  participants: FounderSlug[];
  created_at: string;
  updated_at: string;
}

export interface TranscriptTurn {
  role: "seller" | "buyer";
  content: string;
  ts: string;
}

export interface RubricRowScore {
  n: number;
  criterion: string;
  score: 0 | 1 | 2;
  quote: string;
  why: string;
}

export interface DrillScore {
  rows: RubricRowScore[];
  total: number;
  max: number;
  below_threshold: boolean;
  moments: string[];
  fix: string;
  crm_row: { stage: string; key_quotes: string; next_step: string };
  artifact_updates: { key: string; note: string }[];
  unanswered_questions: string[];
  recommend_repeat_with: string | null;
  buyer_feedback?: { realism: number; note: string } | null; // pair mode only
}

export interface Drill {
  id: number;
  module: number;
  persona: string;
  founder_slug: FounderSlug;
  mode: "solo" | "pair";
  buyer_slug: FounderSlug | null;
  transcript: TranscriptTurn[];
  score: DrillScore | null;
  status: "live" | "debriefed";
  started_at: string;
  debriefed_at: string | null;
  // pair drills
  seller_slug: FounderSlug | null;
  participants: FounderSlug[] | null;
  briefs: PairBriefs | null;
  transcript_text: string | null;
  transcript_link: string | null;
}

export interface PairBriefs {
  seller: string; // markdown: public context only
  buyer: string; // markdown: everything plus the hidden agenda
}

export interface CrmRow {
  id: number;
  date: string;
  founder_slug: FounderSlug;
  persona: string;
  module: number;
  stage: string;
  key_quotes: string;
  next_step: string;
  drill_id: number | null;
}

export type ProgressStatus = "locked" | "open" | "briefed" | "built" | "drilled" | "done";

export interface ProgressRow {
  module: number;
  founder_slug: FounderSlug;
  status: ProgressStatus;
  best_score: number | null;
  max_score: number | null;
  carry_fix: string | null;
  updated_at: string;
}

export interface RubricRow {
  n: number;
  criterion: string;
  levels?: string[];
}

export interface ModuleContent {
  number: number;
  slug: string;
  title: string;
  chapter: number;
  pages: string;
  status: "ready" | "stub";
  brief_markdown: string;
  mindsets?: string[];
  seven_questions?: string[];
  build: {
    artifact_key: string;
    shared: boolean;
    artifact_title: string;
    spec_markdown: string;
    artifact_template?: string;
    secondary_artifact_key?: string;
    secondary_artifact_title?: string;
  } | null;
  drill: {
    persona: string;
    channel: string;
    time_limit: string;
    rounds: number;
    scenario: string;
    buyer_opening: string;
  } | null;
  rubric: {
    max: number;
    threshold: number;
    rows: RubricRow[];
    below_threshold_note: string;
  } | null;
}

export interface Persona {
  key: string;
  name: string;
  role: string;
  markdown: string;
}
