import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { Cooldown } from "../src/cooldown.ts";

describe("Cooldown", () => {
  it("returns valid key", () => {
    const c = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    );
    for (let i = 0; i < 100; i++) {
      assert.ok(["a", "b", "c"].includes(c.pick()));
    }
  });

  it("single entry always returns that key", () => {
    const c = new Cooldown(new Map([["x", 5]]));
    for (let i = 0; i < 10; i++) {
      assert.strictEqual(c.pick(), "x");
    }
  });

  it("does not crash after 1k picks", () => {
    const c = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 1],
        ["c", 1],
      ]),
    );
    for (let i = 0; i < 1000; i++) {
      c.pick();
    }
    assert.ok(["a", "b", "c"].includes(c.pick()));
  });

  it("probabilities sum to 1", () => {
    const c = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    );
    for (let round = 0; round < 100; round++) {
      c.pick();
      const sum = [...c.probabilities().values()].reduce((s, p) => s + p, 0);
      assert.ok(Math.abs(sum - 1) < 1e-10, `got ${sum}`);
    }
  });

  it("neutral correction when counter equals desired", () => {
    const c = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
    );
    const before = c.probabilities();
    // no picks yet: counters = 0, desired = 0, excess = 0
    const ratioBefore = (before.get("a") ?? 0) / (before.get("b") ?? 0);
    assert.ok(
      Math.abs(ratioBefore - 1 / 2) < 1e-10,
      `initial ratio should be weight-proportional: ${ratioBefore}`,
    );
  });

  it("excess of +1 halves effective weight", () => {
    const c = new Cooldown(new Map([["a", 1]]));
    c.pick(); // a: counter=1, desired=1, excess=0
    // add a second key with same weight to observe ratio
    const c2 = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 1],
      ]),
    );
    // initial: both excess=0, probs equal
    const p0 = c2.probabilities();
    assert.ok(Math.abs((p0.get("a") ?? 0) - 0.5) < 1e-10);
  });

  it("picked key counter increments by 1, others unchanged", () => {
    const c = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    );
    for (let round = 0; round < 100; round++) {
      const before = c.countersSnapshot();
      const picked = c.pick();
      const after = c.countersSnapshot();

      for (const k of before.keys()) {
        const expected =
          k === picked ? (before.get(k) ?? 0) + 1 : (before.get(k) ?? 0);
        assert.strictEqual(
          after.get(k),
          expected,
          `key "${k}": ${before.get(k)} -> ${after.get(k)}, expected ${expected}`,
        );
      }
    }
  });

  it("excess of +1 halves probability relative to a key on target", () => {
    const c = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 1],
      ]),
    );
    c.pick(); // T=1, picked key has counter=1, other has counter=0
    const after1 = c.probabilities();
    // picked key: excess +0.5 → correction 2^(-0.5) ≈ 0.707
    // other key:  excess -0.5 → correction 2^(+0.5) ≈ 1.414
    // ratio picked/other = 0.707/1.414 = 0.5
    const snap = c.countersSnapshot();
    const picked = [...snap.entries()].find(([, v]) => v === 1)![0];
    const other = [...snap.entries()].find(([, v]) => v === 0)![0];
    const ratio = (after1.get(picked) ?? 0) / (after1.get(other) ?? 0);
    assert.ok(
      Math.abs(ratio - 0.5) < 1e-10,
      `ratio ${picked}/${other}: ${ratio}`,
    );
  });

  it("zero weight has zero probability", () => {
    const c = new Cooldown(
      new Map([
        ["a", 0],
        ["b", 1],
      ]),
    );
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(c.probabilities().get("a"), 0);
      c.pick();
    }
  });

  it("all zero weights returns uniform probabilities", () => {
    const c = new Cooldown(
      new Map([
        ["a", 0],
        ["b", 0],
      ]),
    );
    const probs = c.probabilities();
    assert.ok(Math.abs((probs.get("a") ?? 0) - 0.5) < 1e-10);
    assert.ok(Math.abs((probs.get("b") ?? 0) - 0.5) < 1e-10);
  });

  it("long-run frequencies converge to weights", () => {
    const c = new Cooldown(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 5],
      ]),
    );
    const counts = { a: 0, b: 0, c: 0 };
    const N = 1000;
    for (let i = 0; i < N; i++) {
      counts[c.pick() as keyof typeof counts]++;
    }

    // expected: a=12.5%, b=25%, c=62.5%
    const shareA = counts.a / N;
    const shareB = counts.b / N;
    const shareC = counts.c / N;

    // ratio a:b should be ~1:2
    const ratioAB = shareA / shareB;
    assert.ok(
      Math.abs(ratioAB - 0.5) < 0.05,
      `a/b ratio: ${ratioAB.toFixed(3)}, expected ~0.5`,
    );

    // ratio b:c should be ~2:5 = 0.4
    const ratioBC = shareB / shareC;
    assert.ok(
      Math.abs(ratioBC - 0.4) < 0.05,
      `b/c ratio: ${ratioBC.toFixed(3)}, expected ~0.4`,
    );
  });
});
