import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import { PiIntegration, type MoodData } from "../src/integration.ts";

function msg(id: string, ts: number): SessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: new Date(ts).toISOString(),
    message: {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
      timestamp: ts,
      api: "anthropic-messages" as const,
      provider: "anthropic",
      model: "claude",
      usage: {
        input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop" as const,
    },
  };
}

function mood(
  id: string,
  parentId: string,
  ts: number,
  heading: string,
  body: string,
): SessionEntry {
  return {
    type: "custom",
    id,
    parentId,
    timestamp: new Date(ts).toISOString(),
    customType: "mood",
    data: { heading, body } satisfies MoodData,
  };
}

function compaction(
  id: string,
  firstKeptEntryId: string,
  ts: number,
): SessionEntry {
  return {
    type: "compaction",
    id,
    parentId: null,
    timestamp: new Date(ts).toISOString(),
    summary: "summary",
    firstKeptEntryId,
    tokensBefore: 0,
  };
}

function messages(texts: string[]): AgentMessage[] {
  return texts.map((t, i) => ({
    role: "user" as const,
    content: t,
    timestamp: i,
  }));
}

function fakeCtx(entries: SessionEntry[]): ExtensionContext {
  return {
    cwd: "/fake",
    sessionManager: { getBranch: () => entries },
    ui: { setStatus: () => {} },
  } as unknown as ExtensionContext;
}

function fakePi(): ExtensionAPI {
  return { appendEntry: () => {} } as unknown as ExtensionAPI;
}

function makeIntegration(entries: SessionEntry[]): PiIntegration {
  return new PiIntegration(fakePi(), fakeCtx(entries));
}

describe("PiIntegration.buildContextMessages", () => {
  it("returns messages unchanged when no moods", () => {
    const integration = makeIntegration([msg("a1", 1)]);
    const msgs = messages(["hi"]);
    assert.strictEqual(integration.buildContextMessages(msgs), msgs);
  });

  it("inserts mood after its parent message", () => {
    const integration = makeIntegration([
      msg("a1", 1),
      mood("m1", "a1", 2, "Rule", "body"),
      msg("a2", 3),
    ]);
    const msgs = messages(["q1", "q2"]);
    const result = integration.buildContextMessages(msgs);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].role, "user");
    assert.strictEqual(result[1].role, "custom");
    assert.strictEqual(result[2].role, "user");
  });

  it("skips mood whose parent is in compacted region", () => {
    const integration = makeIntegration([
      msg("a1", 1),
      msg("a2", 2),
      mood("m1", "a2", 3, "Old", "gone"),
      compaction("c1", "a3", 4),
      msg("a3", 5),
      msg("a4", 6),
    ]);
    const msgs = messages(["q3", "q4"]);
    const result = integration.buildContextMessages(msgs);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].role, "user");
    assert.strictEqual(result[1].role, "user");
  });

  it("inserts mood after parent in non-compacted tail", () => {
    const integration = makeIntegration([
      msg("a1", 1),
      compaction("c1", "a2", 2),
      msg("a2", 3),
      mood("m1", "a2", 4, "Live", "rule"),
      msg("a3", 5),
    ]);
    const msgs = messages(["q2", "q3"]);
    const result = integration.buildContextMessages(msgs);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].role, "user");
    assert.strictEqual(result[1].role, "custom");
    assert.strictEqual(result[2].role, "user");
  });

  it("multiple moods at correct positions", () => {
    const integration = makeIntegration([
      msg("a1", 1),
      mood("m1", "a1", 2, "First", "body1"),
      msg("a2", 3),
      mood("m2", "a2", 4, "Second", "body2"),
      msg("a3", 5),
    ]);
    const msgs = messages(["q1", "q2", "q3"]);
    const result = integration.buildContextMessages(msgs);
    assert.strictEqual(result.length, 5);
    assert.strictEqual(result[0].role, "user");
    assert.strictEqual(result[1].role, "custom");
    assert.strictEqual(result[2].role, "user");
    assert.strictEqual(result[3].role, "custom");
    assert.strictEqual(result[4].role, "user");
  });

  it("handles empty messages array", () => {
    const integration = makeIntegration([]);
    const msgs: AgentMessage[] = [];
    const result = integration.buildContextMessages(msgs);
    assert.strictEqual(result.length, 0);
  });


});
