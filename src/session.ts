import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { Cooldown } from "./cooldown.ts";
import type { Rule } from "./rule.ts";
import type { Integration } from "./integration.ts";
import { buildMoodText } from "./text.ts";
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
    this.integration.persistMood({
      heading: this.currentRule!.heading,
      body: this.currentRule!.body,
    });
  }

  showStatus() {
    const ago = this.calls - this.lastInjection;
    this.integration.showStatus(
      statusLine(this.totalTokens, ago, this.currentRule),
    );
  }

  buildContextMessages(messages: AgentMessage[]): AgentMessage[] {
    return this.integration.buildContextMessages(messages);
  }

  restore(): void {
    const state = this.integration.restore();
    if (!state) {
      return;
    }
    this.calls = state.calls;
    this.lastInjection = state.lastInjection;
    this.totalTokens = state.totalTokens;
    this.currentRule = state.currentRule;
  }

  private pickRule(): Rule {
    const key = this.cooldown!.pick();
    return this.ruleMap.get(key)!;
  }
}
