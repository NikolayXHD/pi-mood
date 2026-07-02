import type { Rule } from "./rule.ts";

const MOOD_PREFIX =
  "<system-reminder>\nKeep this refresher to yourself. Remember to respect the rule:";
const MOOD_SUFFIX = "\n</system-reminder>";
const SEP = "\n\n";

export function buildMoodText(rule: Rule): string {
  return `${MOOD_PREFIX}${SEP}${rule.heading}${SEP}${rule.body}${MOOD_SUFFIX}`;
}

export function parseMoodText(
  content: string,
): { heading: string; body: string } | null {
  const prefix = `${MOOD_PREFIX}${SEP}`;
  if (!content.startsWith(prefix)) return null;
  if (!content.endsWith(MOOD_SUFFIX)) return null;
  const inner = content.slice(prefix.length, -MOOD_SUFFIX.length);
  const idx = inner.indexOf(SEP);
  if (idx === -1) return null;
  const heading = inner.slice(0, idx);
  const body = inner.slice(idx + SEP.length);
  if (heading.length === 0) return null;
  return { heading, body };
}
