// Copyright © 2026 Christopher Snow. Exercise the actual publication gate.
import test from "node:test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, readFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { buildOffline } from "../scripts/offline.mjs";
import { verifyOfflineBuild } from "../scripts/verify-offline-build.mjs";
import { retainPublishedReleases } from "../scripts/retain-releases.mjs";
test("publishing markers are excluded; missing or corrupted uploaded assets stop publication", async () => {
  const temp = await mkdtemp(join(tmpdir(), "offline-artifact-")),
    source = join(temp, "source"),
    artifact = join(temp, "artifact");
  try {
    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "index.html"),
      "<html><head></head><body><header><!-- app-status-control --></header><main>Lesson</main></body></html>",
    );
    await writeFile(join(source, ".nojekyll"), "");
    await writeFile(
      join(source, ".required-data.txt"),
      "required hidden payload",
    );
    const release = await buildOffline(source);
    assert.ok(!release.files.some((f) => f.path === ".nojekyll"));
    assert.ok(release.files.some((f) => f.path === ".required-data.txt"));
    await cp(source, artifact, { recursive: true });
    await verifyOfflineBuild(artifact);
    await assert.rejects(
      verifyOfflineBuild(artifact, "b".repeat(40)),
      /commit/,
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ["scripts/verify-offline-build.mjs", artifact, "b".repeat(40)],
          { stdio: "pipe" },
        ),
      /Command failed/,
    );
    const file = join(artifact, "releases", release.id, ".required-data.txt");
    await rm(file);
    await assert.rejects(
      verifyOfflineBuild(artifact),
      /missing .*required-data.txt/,
    );
    await writeFile(file, "wrong bytes");
    await assert.rejects(verifyOfflineBuild(artifact), /failed verification/);
    await cp(join(source, "releases", release.id, ".required-data.txt"), file);
    await verifyOfflineBuild(artifact);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
test("old release retention repairs only the known empty publishing marker, preserving real asset verification", async () => {
  const directory = await mkdtemp(join(tmpdir(), "offline-old-marker-")),
    body = Buffer.from("<p>Open old lesson</p>"),
    hash = (b) => createHash("sha256").update(b).digest("hex");
  const release = {
    schema: 1,
    id: "a".repeat(64),
    commit: null,
    date: null,
    bytes: body.length,
    files: [
      { path: "index.html", bytes: body.length, sha256: hash(body) },
      { path: ".nojekyll", bytes: 0, sha256: hash("") },
    ],
  };
  const requested = [];
  try {
    const fetcher = async (url) => {
      requested.push(url.pathname);
      return url.pathname.endsWith("/release.json")
        ? new Response(JSON.stringify(release))
        : url.pathname.endsWith("/index.html")
          ? new Response(body)
          : new Response("", { status: 404 });
    };
    assert.deepEqual(
      await retainPublishedReleases(directory, "https://example.test/course/", {
        fetcher,
        currentId: "b".repeat(64),
      }),
      [release.id],
    );
    assert.ok(!requested.some((p) => p.endsWith("/.nojekyll")));
    assert.deepEqual(
      await readFile(join(directory, "releases", release.id, "index.html")),
      body,
    );
    const saved = JSON.parse(
      await readFile(join(directory, "releases", release.id, "release.json")),
    );
    assert.equal(saved.files.length, 1);
    assert.equal(saved.files[0].sha256, hash(body));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
