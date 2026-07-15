import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { parse, type Rule } from "../src/rule.ts";
import { Session } from "../src/session.ts";
import type { Integration, MoodData, RestoredState } from "../src/integration.ts";

function stubIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    loadRules: () => [],
    resolveInjectionFrequency: () => 5,
    persistMood: () => {},
    buildContextMessages: (m) => m,
    restore: () => null,
    showStatus: () => {},
    countTokens: () => 0,
    ...overrides,
  };
}

function newSession(
  rules: Rule[],
  every: number,
  overrides: Partial<Integration> = {},
): Session {
  return new Session(
    stubIntegration({
      loadRules: () => rules,
      resolveInjectionFrequency: () => every,
      ...overrides,
    }),
  );
}

function restoredState(
  calls: number,
  lastInjection: number,
  heading?: string,
  body?: string,
): RestoredState {
  return {
    calls,
    lastInjection,
    totalTokens: 0,
    currentRule:
      heading !== undefined
        ? { heading, body: body ?? "", weight: 0 }
        : null,
  };
}

describe("Session", () => {
  const rules = parse("## A @3\nbody A\n## B @5\nbody B\n# NoWeight\nignored");

  it("maybeInjectMoodMessage does not inject on first call", () => {
    const s = newSession(rules, 5);
    s.maybeInjectMoodMessage();
    assert.strictEqual(s.calls, 1);
    assert.strictEqual(s.lastInjection, 0);
    assert.strictEqual(s.currentRule, null);
  });

  it("maybeInjectMoodMessage does not inject on non-boundary calls", () => {
    const s = newSession(rules, 5);
    s.maybeInjectMoodMessage();
    for (let i = 0; i < 3; i++) {
      s.maybeInjectMoodMessage();
    }
    assert.strictEqual(s.calls, 4);
    assert.strictEqual(s.lastInjection, 0);
    assert.strictEqual(s.currentRule, null);
  });

  it("maybeInjectMoodMessage injects every N calls", () => {
    const persisted: MoodData[] = [];
    const s = newSession(rules, 3, {
      persistMood: (data) => persisted.push(data),
    });
    s.maybeInjectMoodMessage();
    assert.strictEqual(s.currentRule, null);
    s.maybeInjectMoodMessage();
    assert.strictEqual(s.currentRule, null);
    s.maybeInjectMoodMessage();
    assert.ok(s.currentRule !== null);
    assert.strictEqual(persisted.length, 1);
    s.maybeInjectMoodMessage();
    s.maybeInjectMoodMessage();
    s.maybeInjectMoodMessage();
    assert.ok(s.currentRule !== null);
    assert.strictEqual(s.calls, 6);
    assert.strictEqual(persisted.length, 2);
  });

  it("restore applies state from integration", () => {
    const s = newSession(rules, 5, {
      restore: () => restoredState(3, 2, "Rule", "body"),
    });
    s.restore();
    assert.strictEqual(s.calls, 3);
    assert.strictEqual(s.lastInjection, 2);
    assert.strictEqual(s.currentRule!.heading, "Rule");
  });

  it("restore keeps defaults when integration returns null", () => {
    const s = newSession(rules, 5, { restore: () => null });
    s.restore();
    assert.strictEqual(s.calls, 0);
    assert.strictEqual(s.totalTokens, 0);
    assert.strictEqual(s.currentRule, null);
  });

  it("restore + maybeInjectMoodMessage resumes at correct boundary", () => {
    const s = newSession(rules, 5, {
      restore: () => restoredState(3, 3, "X", "y"),
    });
    s.restore();
    assert.strictEqual(s.calls, 3);
    assert.strictEqual(s.lastInjection, 3);
    s.maybeInjectMoodMessage();
    assert.strictEqual(s.currentRule!.heading, "X");
    assert.strictEqual(s.lastInjection, 3);
    s.maybeInjectMoodMessage();
    assert.ok(s.currentRule !== null);
    assert.strictEqual(s.calls, 5);
    assert.strictEqual(s.lastInjection, 5);
  });

  it("empty rules does nothing", () => {
    const s = newSession([], 5);
    for (let i = 0; i < 10; i++) {
      s.maybeInjectMoodMessage();
    }
    assert.strictEqual(s.calls, 0);
  });

  it("every=1 injects on every call and switches rules", () => {
    const s = newSession(rules, 1);
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      s.maybeInjectMoodMessage();
      assert.ok(s.currentRule !== null);
      seen.add(s.currentRule!.heading);
      assert.strictEqual(s.lastInjection, i + 1);
    }
    assert.ok(seen.size >= 2);
  });

  it("buildContextMessages delegates to integration", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hi", timestamp: 1 },
    ];
    const s = newSession(rules, 5, {
      buildContextMessages: () => [
        { role: "user", content: "hi", timestamp: 1 },
        { role: "user", content: "extra", timestamp: 2 },
      ],
    });
    const result = s.buildContextMessages(messages);
    assert.strictEqual(result.length, 2);
  });

  it("buildContextMessages returns unmodified when integration passes through", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hi", timestamp: 1 },
    ];
    const s = newSession(rules, 5);
    const result = s.buildContextMessages(messages);
    assert.strictEqual(result, messages);
  });
});
