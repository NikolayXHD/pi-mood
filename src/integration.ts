import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  CustomMessageEntry,
  ExtensionAPI,
  ExtensionContext,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";
import { estimateTokens, CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { parse, type Rule } from "./rule.ts";

export type ChatEvent =
  | { kind: "assistant" }
  | { kind: "mood"; content: string; tokens: number }
  | { kind: "other" };

export interface Integration {
  loadRules(): Rule[];
  resolveInjectionFrequency(): number;
  chatEvents(): ChatEvent[];
  injectMoodMessage(text: string): void;
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

  chatEvents(): ChatEvent[] {
    const result: ChatEvent[] = [];
    for (const e of this.ctx.sessionManager.getEntries()) {
      if (
        e.type === "message" &&
        (e as SessionMessageEntry).message.role === "assistant"
      ) {
        result.push({ kind: "assistant" });
      } else if (e.type === "custom_message" && e.customType === "mood") {
        const ce = e as CustomMessageEntry;
        const content = typeof ce.content === "string" ? ce.content : "";
        result.push({
          kind: "mood",
          content,
          tokens: estimateTokens({
            role: "custom",
            customType: "mood",
            content: [{ type: "text", text: content }],
            display: false,
            timestamp: Number(ce.timestamp),
          }),
        });
      } else {
        result.push({ kind: "other" });
      }
    }
    return result;
  }

  injectMoodMessage(text: string): void {
    this.pi.sendMessage(
      { customType: "mood", content: text, display: false },
      { deliverAs: "steer" },
    );
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
