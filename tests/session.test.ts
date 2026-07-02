import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parse, type Rule } from "../src/rule.ts";
import { Session } from "../src/session.ts";
import type { Integration } from "../src/integration.ts";
import { buildMoodText } from "../src/text.ts";

function stubIntegration(overrides: Partial<Integration> = {}): Integration {
  return {
    loadRules: () => [],
    resolveInjectionFrequency: () => 5,
    chatEvents: () => [],
    injectMoodMessage: () => {},
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
    const s = newSession(rules, 3);
    s.maybeInjectMoodMessage();
    assert.strictEqual(s.currentRule, null);
    s.maybeInjectMoodMessage();
    assert.strictEqual(s.currentRule, null);
    s.maybeInjectMoodMessage();
    assert.ok(s.currentRule !== null);
    s.maybeInjectMoodMessage();
    s.maybeInjectMoodMessage();
    s.maybeInjectMoodMessage();
    assert.ok(s.currentRule !== null);
    assert.strictEqual(s.calls, 6);
  });

  it("restore sets calls, lastInjection, rule and totalTokens", () => {
    const s = newSession(rules, 5, {
      chatEvents: () => [
        { kind: "assistant" },
        { kind: "assistant" },
        {
          kind: "mood" as const,
          content: buildMoodText({ heading: "Rule", body: "body", weight: 0 }),
          tokens: 100,
        },
        { kind: "assistant" },
      ],
    });

    s.restore();

    assert.strictEqual(s.calls, 3);
    assert.strictEqual(s.lastInjection, 2);
    assert.strictEqual(s.totalTokens, 100);
    assert.strictEqual(s.currentRule!.heading, "Rule");
  });

  it("restore keeps defaults when no mood entry found", () => {
    const s = newSession(rules, 5, {
      chatEvents: () => [
        { kind: "assistant" },
        { kind: "assistant" },
        { kind: "assistant" },
      ],
    });

    s.restore();

    assert.strictEqual(s.calls, 0);
    assert.strictEqual(s.totalTokens, 0);
    assert.strictEqual(s.currentRule, null);
  });

  it("restore + maybeInjectMoodMessage resumes at correct boundary", () => {
    const s = newSession(rules, 5, {
      chatEvents: () => [
        { kind: "assistant" },
        { kind: "assistant" },
        { kind: "assistant" },
        {
          kind: "mood" as const,
          content: buildMoodText({ heading: "X", body: "y", weight: 0 }),
          tokens: 0,
        },
      ],
    });

    s.restore();

    assert.strictEqual(s.calls, 3);
    assert.strictEqual(s.lastInjection, 3);

    // call 4: not a boundary, currentRule unchanged from restore
    s.maybeInjectMoodMessage();
    assert.strictEqual(s.currentRule!.heading, "X");
    assert.strictEqual(s.lastInjection, 3);
    // call 5: boundary, injection fires
    s.maybeInjectMoodMessage();
    assert.ok(s.currentRule !== null);
    assert.strictEqual(s.calls, 5);
    assert.strictEqual(s.lastInjection, 5);
  });

  it("empty rules does nothing in maybeInjectMoodMessage", () => {
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
});
