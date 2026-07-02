import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  trunc,
  fmtTokens,
  fmtTime,
  fmtRule,
  statusLine,
} from "../src/format.ts";

describe("trunc", () => {
  it("returns short string as-is", () => {
    assert.strictEqual(trunc("hello", 10), "hello");
  });

  it("returns exact-fit string as-is", () => {
    assert.strictEqual(trunc("hello", 5), "hello");
  });

  it("truncates long string with …", () => {
    assert.strictEqual(trunc("hello world", 8), "hello w…");
  });
});

describe("fmtTokens", () => {
  it("zero → —", () => {
    assert.strictEqual(fmtTokens(0), "—");
  });

  it("< 1000 → Nt", () => {
    assert.strictEqual(fmtTokens(500), "500t");
  });

  it("1000–9999 → N.Nkt", () => {
    assert.strictEqual(fmtTokens(3500), "3.5kt");
  });

  it("≥ 10000 → Nkt", () => {
    assert.strictEqual(fmtTokens(12500), "13kt");
  });
});

describe("fmtTime", () => {
  it("inactive → —", () => {
    assert.strictEqual(fmtTime(5, false), "—");
  });

  it("ago = 0 → now", () => {
    assert.strictEqual(fmtTime(0, true), "now");
  });

  it("ago > 0 → N ago", () => {
    assert.strictEqual(fmtTime(3, true), "3 ago");
  });
});

describe("fmtRule", () => {
  it("null → —", () => {
    assert.strictEqual(fmtRule(null), "—");
  });

  it("short heading → «heading»", () => {
    assert.strictEqual(
      fmtRule({ heading: "Design", weight: 1, body: "" }),
      "«Design»",
    );
  });

  it("long heading truncated", () => {
    const long = "Design review before implementation review";
    const result = fmtRule({ heading: long, weight: 1, body: "" });
    assert.ok(result.startsWith("«"));
    assert.ok(result.endsWith("…»"));
  });
});

describe("statusLine", () => {
  it("combines all parts", () => {
    const rule = { heading: "Test", weight: 1, body: "" };
    const line = statusLine(500, 3, rule);
    assert.ok(line.startsWith("mood: "));
    assert.ok(line.includes(" · "));
  });

  it("inactive rule shows —", () => {
    const line = statusLine(0, 0, null);
    assert.strictEqual(line, "mood: — · — · —");
  });
});
