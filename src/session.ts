import { Cooldown } from "./cooldown.ts";
import type { Rule } from "./rule.ts";
import type { Integration } from "./integration.ts";
import { buildMoodText, parseMoodText } from "./text.ts";
import { statusLine } from "./format.ts";

export class Session {
  cooldown: Cooldown;
  calls = 0;
  every = 0;
  lastInjection = 0;
  totalTokens = 0;
  currentRule: Rule | null = null;

  private integration: Integration;
  private ruleMap = new Map<string, Rule>();

  constructor(integration: Integration) {
    this.integration = integration;
    this.every = integration.resolveInjectionFrequency();
    const rules = integration.loadRules();
    for (const r of rules) {
      this.ruleMap.set(r.heading, r);
    }
    this.cooldown = new Cooldown(
      new Map(rules.map((r) => [r.heading, r.weight])),
    );
  }

  maybeInjectMoodMessage() {
    if (this.ruleMap.size === 0) {
      return;
    }
    this.calls++;
    if (this.calls % this.every !== 0) {
      return;
    }
    this.currentRule = this.pickRule();
    this.lastInjection = this.calls;
    const text = buildMoodText(this.currentRule!);
    this.totalTokens += this.integration.countTokens(text);
    this.integration.injectMoodMessage(text);
  }

  showStatus() {
    const ago = this.calls - this.lastInjection;
    this.integration.showStatus(
      statusLine(this.totalTokens, ago, this.currentRule),
    );
  }

  private pickRule(): Rule {
    const key = this.cooldown!.pick();
    return this.ruleMap.get(key)!;
  }

  restore(): void {
    let calls = 0;
    let lastInjection = 0;
    let lastRule: { heading: string; body: string } | null = null;
    let totalTokens = 0;
    let found = false;

    for (const e of this.integration.chatEvents()) {
      if (e.kind === "assistant") {
        calls++;
      }
      if (e.kind === "mood") {
        found = true;
        lastInjection = calls;
        totalTokens += e.tokens;
        const r = parseMoodText(e.content);
        if (r) {
          lastRule = r;
        }
      }
    }

    if (!found) {
      return;
    }

    this.calls = calls;
    this.lastInjection = lastInjection;
    this.totalTokens = totalTokens;
    if (lastRule) {
      this.currentRule = {
        heading: lastRule.heading,
        body: lastRule.body,
        weight: 0,
      };
    }
  }
}
