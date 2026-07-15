import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
  CompactionEntry,
  CustomEntry,
  ExtensionAPI,
  ExtensionContext,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";
import { estimateTokens, CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { parse, type Rule } from "./rule.ts";
import { buildMoodText } from "./text.ts";

export interface MoodData {
  heading: string;
  body: string;
}

export interface RestoredState {
  calls: number;
  lastInjection: number;
  totalTokens: number;
  currentRule: Rule | null;
}

export interface Integration {
  loadRules(): Rule[];
  resolveInjectionFrequency(): number;
  persistMood(data: MoodData): void;
  buildContextMessages(messages: AgentMessage[]): AgentMessage[];
  restore(): RestoredState | null;
  showStatus(text: string): void;
  countTokens(text: string): number;
}

const DEFAULT_INJECTION_FREQUENCY = 5;

export class PiIntegration implements Integration {
  private pi: ExtensionAPI;
  private cwd: string;
  private ctx: ExtensionContext;

  constructor(pi: ExtensionAPI, ctx: ExtensionContext) {
    this.pi = pi;
    this.cwd = ctx.cwd;
    this.ctx = ctx;
  }

  loadRules(): Rule[] {
    const paths = [
      join(homedir(), ".pi/agent/AGENTS.md"),
      join(this.cwd, "AGENTS.md"),
    ];

    const rules: Rule[] = [];
    for (const p of paths) {
      if (!existsSync(p)) {
        continue;
      }
      try {
        const content = readFileSync(p, "utf-8");
        rules.push(...parse(content));
      } catch (err) {
        console.warn(`pi-mood: failed to read ${p}:`, err);
      }
    }
    return rules;
  }

  resolveInjectionFrequency(): number {
    const path = join(this.cwd, CONFIG_DIR_NAME, "mood.json");
    if (existsSync(path)) {
      try {
        const config = JSON.parse(readFileSync(path, "utf-8"));
        if (typeof config.injectionFrequency === "number" && config.injectionFrequency > 0) {
          return config.injectionFrequency;
        }
      } catch {
        console.warn(`pi-mood: failed to parse ${path}`);
      }
    }
    return DEFAULT_INJECTION_FREQUENCY;
  }

  persistMood(data: MoodData): void {
    this.pi.appendEntry("mood", data);
  }

  buildContextMessages(messages: AgentMessage[]): AgentMessage[] {
    const branch = this.ctx.sessionManager.getBranch();

    const moodByParent = new Map<string, MoodData[]>();
    for (const e of branch) {
      if (e.type !== "custom" || e.customType !== "mood") {
        continue;
      }
      const ce = e as CustomEntry<MoodData>;
      if (!ce.data) {
        continue;
      }
      const parent = ce.parentId ?? "";
      const list = moodByParent.get(parent);
      if (list) {
        list.push(ce.data);
      } else {
        moodByParent.set(parent, [ce.data]);
      }
    }
    if (moodByParent.size === 0) {
      return messages;
    }

    let startAt: string | null = null;
    for (let i = branch.length - 1; i >= 0; i--) {
      if (branch[i].type === "compaction") {
        startAt = (branch[i] as CompactionEntry).firstKeptEntryId;
        break;
      }
    }

    // Message entries in the active branch correspond 1:1 to event.messages.
    // Proof: session-manager.js:120-217 — buildSessionContext walks path (same as
    // getBranch) and appendMessage (L175-178) pushes one message per message-entry.
    // Compaction at L179-207 skips entries before firstKeptEntryId, same as below.
    const posById = new Map<string, number>();
    let pos = 0;
    let started = startAt === null;
    for (const e of branch) {
      if (!started) {
        if (e.id === startAt) {
          started = true;
        } else {
          continue;
        }
      }
      if (e.type === "message") {
        posById.set(e.id, pos++);
      }
    }

    const insertions: { at: number; msg: AgentMessage }[] = [];
    for (const [parentId, moods] of moodByParent) {
      const at = posById.get(parentId);
      if (at === undefined || at > messages.length) {
        continue;
      }
      for (const m of moods) {
        const text = buildMoodText({
          heading: m.heading,
          body: m.body,
          weight: 0,
        });
        insertions.push({
          at: at + 1,
          msg: {
            role: "custom" as const,
            customType: "mood" as const,
            content: text,
            display: false,
            timestamp: Date.now(),
          },
        });
      }
    }

    insertions.sort((a, b) => b.at - a.at);
    for (const ins of insertions) {
      messages.splice(ins.at, 0, ins.msg);
    }
    return messages;
  }

  restore(): RestoredState | null {
    let calls = 0;
    let lastInjection = 0;
    let lastRule: { heading: string; body: string } | null = null;
    let totalTokens = 0;
    let found = false;

    for (const e of this.ctx.sessionManager.getBranch()) {
      if (
        e.type === "message" &&
        (e as SessionMessageEntry).message.role === "assistant"
      ) {
        calls++;
      }
      if (e.type === "custom" && e.customType === "mood") {
        found = true;
        lastInjection = calls;
        const ce = e as CustomEntry<MoodData>;
        if (ce.data) {
          const text = buildMoodText({
            heading: ce.data.heading,
            body: ce.data.body,
            weight: 0,
          });
          totalTokens += this.countTokens(text);
          lastRule = { heading: ce.data.heading, body: ce.data.body };
        }
      }
    }

    if (!found) {
      return null;
    }

    return {
      calls,
      lastInjection,
      totalTokens,
      currentRule: lastRule
        ? { heading: lastRule.heading, body: lastRule.body, weight: 0 }
        : null,
    };
  }

  showStatus(text: string): void {
    this.ctx.ui.setStatus("mood", text);
  }

  countTokens(text: string): number {
    return estimateTokens({
      role: "custom",
      customType: "mood",
      content: [{ type: "text", text }],
      display: false,
      timestamp: Date.now(),
    });
  }
}
