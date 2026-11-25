// Copyright © 2026 Christopher Snow.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { retainPublishedReleases } from "../scripts/retain-releases.mjs";
import { retainLegacyAssets } from "../scripts/retain-legacy-assets.mjs";
const oldBody = Buffer.from("<p>An already open lesson</p>");
const file = {
  path: "index.html",
  bytes: oldBody.length,
  sha256: createHash("sha256").update(oldBody).digest("hex"),
};
const release = {
  schema: 1,
  id: "a".repeat(64),
  commit: null,
  date: null,
  files: [file],
  bytes: file.bytes,
};

test("publisher preserves exact older release bytes and rejects corrupt replacements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sensitivity-retain-"));
  try {
    for (const corrupt of [false, true]) {
      const fetcher = async (url) =>
        new Response(
          url.pathname.endsWith("/release.json")
            ? JSON.stringify(release)
            : corrupt
              ? "damaged old lesson"
              : oldBody,
        );
      const retain = () =>
        retainPublishedReleases(
          directory,
          "https://example.test/sensitivity-lab/",
          {
            fetcher,
            currentId: "b".repeat(64),
          },
        );
      if (corrupt) await assert.rejects(retain, /failed verification/);
      else {
        assert.deepEqual(await retain(), [release.id]);
        assert.deepEqual(
          await readFile(join(directory, "releases", release.id, "index.html")),
          oldBody,
        );
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("first offline publication preserves legacy aliases when no release manifest exists", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sensitivity-legacy-"));
  const asset = Buffer.from("old runtime bytes");
  try {
    const fetcher = async (url) =>
      url.pathname.endsWith("/release.json")
        ? new Response("", { status: 404 })
        : new Response(
            url.pathname.endsWith("/index.html")
              ? '<link rel="preload" href="runtime.wasm" as="fetch">'
              : asset,
          );
    const kept = await retainLegacyAssets(
      directory,
      "https://example.test/sensitivity-lab/",
      { files: [{ path: "runtime.wasm" }] },
      fetcher,
    );
    assert.deepEqual(kept, [
      {
        path: "runtime.wasm",
        bytes: asset.length,
        sha256: createHash("sha256").update(asset).digest("hex"),
      },
    ]);
    assert.deepEqual(await readFile(join(directory, "runtime.wasm")), asset);
    assert.deepEqual(
      await retainPublishedReleases(
        directory,
        "https://example.test/sensitivity-lab/",
        { fetcher },
      ),
      [],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("first publication follows old fingerprinted script and worker imports and retries transport failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "legacy-graph-"));
  const files = new Map([
    [
      "index.html",
      new Response('<script type="module" src="app.old.mjs"></script>'),
    ],
    [
      "app.old.mjs",
      new Response(
        "import './editor.old.mjs'; new Worker(new URL('worker.old.js',root));",
      ),
    ],
    ["editor.old.mjs", new Response("export const editor=1;")],
    [
      "worker.old.js",
      new Response("importScripts('./engine/0.27.7/support.js');"),
    ],
    ["engine/0.27.7/support.js", new Response("const python=1;")],
  ]);
  let failed = false;
  try {
    const fetcher = async (url) => {
      const name = url.pathname.replace("/lab/", "");
      if (name === "app.old.mjs" && !failed) {
        failed = true;
        return new Response("temporary outage", { status: 503 });
      }
      return files.has(name)
        ? files.get(name).clone()
        : new Response("", { status: 404 });
    };
    const kept = await retainLegacyAssets(
      directory,
      "https://example.test/lab/",
      { files: [{ path: "new-only.mjs" }] },
      fetcher,
    );
    assert.deepEqual(
      kept.map((f) => f.path),
      [
        "app.old.mjs",
        "editor.old.mjs",
        "engine/0.27.7/support.js",
        "worker.old.js",
      ],
    );
    assert.match(
      await readFile(join(directory, "worker.old.js"), "utf8"),
      /importScripts/,
    );
    assert.equal(failed, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
