import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parse } from "../src/rule.ts";
import { buildMoodText, parseMoodText } from "../src/text.ts";

describe("Injection", () => {
  const rules = parse("## A @3\nbody A\n## B @5\nbody B\n# NoWeight\nignored");

  it("buildMoodText wraps rule in <system-reminder>", () => {
    const rule = rules[0];
    const text = buildMoodText(rule);
    assert.ok(text.startsWith("<system-reminder>"));
    assert.ok(text.endsWith("</system-reminder>"));
    assert.ok(text.includes(rule.heading));
    assert.ok(text.includes(rule.body));
    assert.ok(
      text.includes(
        "Keep this refresher to yourself. Remember to respect the rule:",
      ),
    );
  });

  it("roundtrip: parseMoodText(buildMoodText(rule)) returns same heading and body", () => {
    for (const rule of rules) {
      const parsed = parseMoodText(buildMoodText(rule));
      assert.ok(parsed !== null, `failed to parse: ${rule.heading}`);
      assert.strictEqual(parsed!.heading, rule.heading);
      assert.strictEqual(parsed!.body, rule.body);
    }
  });

  it("parseMoodText returns null for unrecognized format", () => {
    assert.strictEqual(parseMoodText("random text"), null);
    assert.strictEqual(parseMoodText("<system-reminder>incomplete"), null);
    assert.strictEqual(parseMoodText(""), null);
  });
});
