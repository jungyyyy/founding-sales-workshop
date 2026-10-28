import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
/** Lazily constructed so a missing ANTHROPIC_API_KEY fails at request time, not at build time. */
export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY from .env.local
  return client;
}

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

// Effort per role. Chat roles run low for speed; the grader runs high.
export const EFFORT = {
  coach: "low",
  buyer: "low",
  briefs: "medium",
  grader: "high",
} as const;

// Preserved thinking: stored thinking blocks are signed against the exact system prompt they
// were produced under. The coach's system prompt changes whenever the artifact it is building
// is saved, so replayed blocks would be rejected with a 400. With this beta header and setting,
// the API drops stale blocks instead of failing the request.
export const THINKING_BINDING_BETA = "thinking-binding-controls-2026-08-01";
export const THINKING = {
  type: "adaptive",
  block_binding: { prefix_mismatch_behavior: "drop_block" },
} as unknown as Anthropic.ThinkingConfigParam;
export const THINKING_REQUEST_OPTIONS = { headers: { "anthropic-beta": THINKING_BINDING_BETA } };
