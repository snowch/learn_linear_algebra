// Copyright © 2026 Christopher Snow. Promote only checked main-branch artifacts.
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function validateSourceRun(run, jobs, workflowId) {
  if (
    run.workflow_id !== workflowId ||
    run.event !== "push" ||
    run.head_branch !== "main" ||
    run.status !== "completed" ||
    !/^[a-f0-9]{40}$/.test(run.head_sha) ||
    !jobs.some((j) => j.name === "check" && j.conclusion === "success")
  )
    throw Error(
      "Use a completed main-branch course run whose check job passed.",
    );
  return run.head_sha;
}
export async function waitForArtifact(
  name,
  {
    lookup,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
    timeout = 60000,
  },
) {
  const end = now() + timeout;
  let stable = 0;
  while (now() < end) {
    try {
      const matches = (await lookup()).filter(
        (a) => a.name === name && !a.expired,
      );
      if (matches.length > 1) throw Error("Duplicate Pages artifacts.");
      stable = matches.length === 1 ? stable + 1 : 0;
      if (stable === 2) return;
    } catch (error) {
      if (error.message === "Duplicate Pages artifacts.") throw error;
      stable = 0;
    }
    await sleep(2000);
  }
  throw Error(
    "Pages artifact was not consistently visible before the publication deadline.",
  );
}
async function api(path) {
  const response = await fetch(
    (process.env.GITHUB_API_URL || "https://api.github.com") +
      "/repos/" +
      process.env.GITHUB_REPOSITORY +
      "/" +
      path,
    {
      headers: {
        Authorization: "Bearer " + process.env.GH_TOKEN,
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok)
    throw Error("GitHub artifact API returned HTTP " + response.status);
  return response.json();
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] === "source") {
    const id = process.argv[3];
    if (!/^\d+$/.test(id)) throw Error("Invalid source run ID.");
    const [run, jobs, workflow] = await Promise.all([
      api("actions/runs/" + id),
      api("actions/runs/" + id + "/jobs?per_page=100&filter=all"),
      api("actions/workflows/pages.yml"),
    ]);
    const commit = validateSourceRun(run, jobs.jobs, workflow.id);
    await appendFile(process.env.GITHUB_OUTPUT, "commit=" + commit + "\n");
    console.log("Verified checked source run", id, commit);
  } else if (process.argv[2] === "wait") {
    const name = process.argv[3];
    if (!/^github-pages-\d+$/.test(name))
      throw Error("Invalid Pages artifact name.");
    await waitForArtifact(name, {
      lookup: async () =>
        (
          await api(
            "actions/runs/" +
              process.env.GITHUB_RUN_ID +
              "/artifacts?per_page=100",
          )
        ).artifacts,
    });
    console.log("Pages artifact is consistently visible:", name);
  } else throw Error("Choose source or wait.");
}
