import type Anthropic from "@anthropic-ai/sdk";

/** A chat turn as the Build screen shows it. `by` is the speaker's name in shared sessions. */
export type DisplayTurn = { role: "user" | "assistant"; content: string; by?: string };

const SPEAKER = /^\[([^\]]+)\]:\s?/;

/** Prefix a founder's message with their name so the coach knows who is speaking (shared sessions). */
export function tagSpeaker(name: string, text: string): string {
  return `[${name}]: ${text}`;
}

/** Flatten stored MessageParams into display turns (text only), splitting off the speaker tag. */
export function toDisplayTurns(messages: Anthropic.MessageParam[]): DisplayTurn[] {
  return messages.flatMap((m) => {
    const text =
      typeof m.content === "string"
        ? m.content
        : m.content
            .map((b) => (b.type === "text" ? b.text : ""))
            .filter(Boolean)
            .join("\n");
    if (!text.trim()) return [];
    if (m.role === "user") {
      const match = text.match(SPEAKER);
      if (match) return [{ role: "user" as const, content: text.slice(match[0].length), by: match[1] }];
    }
    return [{ role: m.role as "user" | "assistant", content: text }];
  });
}
