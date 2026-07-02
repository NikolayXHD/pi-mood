import type { Rule } from "./rule.ts";

export function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export function fmtTokens(n: number): string {
  if (n === 0) return "—";
  if (n < 1000) return `${n}t`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}kt`;
  return `${Math.round(n / 1000)}kt`;
}

export function fmtTime(ago: number, active: boolean): string {
  if (!active) return "—";
  if (ago === 0) return "now";
  return `${ago} ago`;
}

export function fmtRule(rule: Rule | null): string {
  if (!rule) return "—";
  return `«${trunc(rule.heading, 30)}»`;
}

export function statusLine(
  tokens: number,
  ago: number,
  rule: Rule | null,
): string {
  const active = rule !== null;
  return `mood: ${fmtTokens(tokens)} · ${fmtTime(ago, active)} · ${fmtRule(rule)}`;
}
