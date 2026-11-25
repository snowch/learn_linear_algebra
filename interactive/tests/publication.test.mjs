// Copyright © 2026 Christopher Snow.
import test from "node:test";
import assert from "node:assert/strict";
import { validateSourceRun, waitForArtifact } from "../scripts/publication.mjs";
test("promotion requires a completed checked push to main from the course workflow", () => {
  const run = {
      workflow_id: 42,
      event: "push",
      head_branch: "main",
      status: "completed",
      head_sha: "a".repeat(40),
    },
    jobs = [{ name: "check", conclusion: "success" }];
  assert.equal(validateSourceRun(run, jobs, 42), run.head_sha);
  for (const edit of [
    { head_branch: "feature" },
    { event: "pull_request" },
    { status: "in_progress" },
    { workflow_id: 43 },
  ])
    assert.throws(() => validateSourceRun({ ...run, ...edit }, jobs, 42));
  assert.throws(() =>
    validateSourceRun(run, [{ name: "check", conclusion: "failure" }], 42),
  );
});
test("deployment waits through missing and transient artifact listings, requires stable visibility, and stops on timeout or duplicate artifacts", async () => {
  let time = 0,
    calls = 0;
  const item = { name: "github-pages-2", expired: false };
  await waitForArtifact(item.name, {
    lookup: async () => {
      calls++;
      if (calls === 2) throw Error("503");
      return calls < 3 ? [] : [item];
    },
    sleep: async (ms) => {
      time += ms;
    },
    now: () => time,
    timeout: 10000,
  });
  assert.equal(calls, 4);
  await assert.rejects(
    waitForArtifact(item.name, {
      lookup: async () => [],
      sleep: async (ms) => {
        time += ms;
      },
      now: () => time,
      timeout: 4000,
    }),
    /deadline/,
  );
  await assert.rejects(
    waitForArtifact(item.name, {
      lookup: async () => [item, item],
      sleep: async () => {},
      now: () => 0,
      timeout: 1,
    }),
    /Duplicate/,
  );
});
