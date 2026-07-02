import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parse } from "../src/rule.ts";

describe("parse", () => {
  it("only weighted rules appear", () => {
    const r = parse("## A @3\nbody A\n## B\nbody B\n## C @5\nbody C");
    assert.strictEqual(r.length, 2);
    assert.strictEqual(r[0].heading, "A");
    assert.strictEqual(r[0].weight, 3);
    assert.strictEqual(r[0].body, "body A");
    assert.strictEqual(r[1].heading, "C");
    assert.strictEqual(r[1].weight, 5);
    assert.strictEqual(r[1].body, "body C");
  });

  it("nested — parent includes child heading + body", () => {
    const r = parse(
      "## Process @3\nproc body\n### Sub @2\nsub body\n## Code @5\ncode",
    );
    assert.strictEqual(r.length, 3);
    assert.strictEqual(r[0].heading, "Sub");
    assert.strictEqual(r[0].body, "sub body");
    assert.strictEqual(r[1].heading, "Process");
    assert.strictEqual(r[1].body, "proc body\n### Sub\nsub body");
    assert.strictEqual(r[2].heading, "Code");
  });

  it("@N stripped from child heading in parent body", () => {
    const r = parse("## Parent @3\np body\n### Child @4\nc body");
    assert.strictEqual(r.length, 2);
    assert.ok(
      r[1].body.includes("### Child"),
      "parent body has child heading",
    );
    assert.ok(!r[1].body.includes("@4"), "parent body does NOT have @4");
  });

  it("no @N = not a rule", () => {
    const r = parse("## A\nno weight\n## B @2\nwith weight");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].heading, "B");
  });

  it("empty body skipped", () => {
    const r = parse("## A @2\n## B @3\nbody B");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].heading, "B");
  });

  it("top-level # Title without @N ignored", () => {
    const r = parse("# Title\n## Rule @3\nbody");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].heading, "Rule");
  });

  it("whitespace in body trimmed", () => {
    const r = parse("## A @2\n\nbody\n\n\n");
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].body, "body");
  });

  it("@N at end of heading with various spacing", () => {
    const r = parse("## A@3\nbody\n## B @5\nbody\n## C  @2\nbody");
    assert.strictEqual(r[0].heading, "A");
    assert.strictEqual(r[0].weight, 3);
    assert.strictEqual(r[1].heading, "B");
    assert.strictEqual(r[1].weight, 5);
    assert.strictEqual(r[2].heading, "C");
    assert.strictEqual(r[2].weight, 2);
  });

  it("deep nesting", () => {
    const r = parse("## A @5\na\n### B @3\nb\n#### C @2\nc\n## D @4\nd");
    assert.strictEqual(r.length, 4);
    assert.strictEqual(r[0].heading, "C");
    assert.strictEqual(r[1].heading, "B");
    assert.strictEqual(r[2].heading, "A");
    assert.ok(
      r[2].body.includes("### B") && r[2].body.includes("#### C"),
      "A includes B and C",
    );
  });

  it("EOF — unterminated last section flushed", () => {
    const r = parse("## A @2\nbody");
    assert.strictEqual(r.length, 1);
  });

  it("no rules at all", () => {
    const r = parse("just text\nno headings");
    assert.strictEqual(r.length, 0);
  });
});
