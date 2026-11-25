// Copyright © 2026 Christopher Snow. Keep dependency aliases used by already-open pages.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { requestPublished } from "./request-published.mjs";
const digest = (body) => createHash("sha256").update(body).digest("hex");
const safe = (path) =>
  /^(?:[a-zA-Z0-9_.+-]+\/)*[a-zA-Z0-9_.+-]+$/.test(path) &&
  !path.split("/").some((p) => p === "." || p === "..") &&
  !path.startsWith("releases/");
export async function retainLegacyAssets(
  directory,
  source,
  release,
  fetcher = fetch,
) {
  if (!source) return [];
  const base = new URL(source.endsWith("/") ? source : source + "/"),
    request = (path) => requestPublished(new URL(path, base), fetcher);
  const response = await request("release.json");
  let previous;
  if (response.ok) previous = await response.json();
  else if (response.status !== 404)
    throw Error(
      "Could not read published release before keeping older open lessons working.",
    );
  const before = await request("index.html");
  if (!before.ok)
    throw Error(
      "Could not capture the published page before retaining its assets.",
    );
  const page = Buffer.from(await before.arrayBuffer()),
    pageHash = digest(page),
    known = previous?.legacyAssets;
  const queue = [],
    scheduled = new Set(),
    required = new Set(),
    retained = [];
  function enqueue(path, mustExist = false) {
    if (!safe(path)) throw Error("Invalid legacy asset path: " + path);
    if (mustExist) required.add(path);
    if (!scheduled.has(path)) {
      scheduled.add(path);
      queue.push(path);
    }
  }
  function discover(text, from) {
    const values = [];
    if (from.endsWith(".html"))
      for (const match of text.matchAll(
        /\b(?:src|href|srcset)=["']([^"']+)["']/gi,
      ))
        for (const item of match[1].split(","))
          values.push(item.trim().split(/\s+/)[0]);
    if (/\.(?:m?js|css)$/.test(from)) {
      for (const match of text.matchAll(
        /\b(?:from|import)\s*["']([^"']+)["']|\b(?:importScripts|new\s+URL)\s*\(\s*["']([^"']+)["']|\burl\(\s*["']?([^\s)'";]+)["']?\s*\)/g,
      ))
        values.push(match[1] || match[2] || match[3]);
    }
    for (const value of values) {
      if (!value || /^(?:[a-z]+:|#|\/)/i.test(value)) continue;
      const url = new URL(value, new URL(from, base));
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
        continue;
      const path = url.pathname.slice(base.pathname.length);
      if (
        path.startsWith("releases/") ||
        path.endsWith(".html") ||
        !path.includes(".")
      )
        continue;
      if (safe(path)) enqueue(path, true);
    }
  }
  const seeds = known ? known.map((f) => f.path) : [];
  if (!Array.isArray(seeds)) throw Error("Invalid legacy asset list.");
  for (const path of seeds) enqueue(path, Boolean(known));
  discover(page.toString(), "index.html");
  if (!known) {
    const pages = release.files
      .filter((f) => f.path.endsWith(".html") && f.path !== "index.html")
      .map((f) => f.path);
    while (pages.length)
      await Promise.all(
        pages.splice(0, 6).map(async (path) => {
          const response = await request(path);
          if (response.status === 404) return;
          if (!response.ok)
            throw Error("Could not inspect an older lesson page: " + path);
          discover(await response.text(), path);
        }),
      );
  }

  // Process in bounded batches; newly discovered versioned workers/imports join the next batch.
  while (queue.length) {
    const batch = queue.splice(0, 6);
    await Promise.all(
      batch.map(async (path) => {
        const response = await request(path);
        if (!response.ok) {
          if (response.status === 404 && !required.has(path)) return;
          throw Error(
            `Could not preserve an older lesson asset: ${path} (HTTP ${response.status}).`,
          );
        }
        const body = Buffer.from(await response.arrayBuffer()),
          sha256 = digest(body),
          expected = known?.find((f) => f.path === path);
        if (
          expected &&
          (body.length !== expected.bytes || sha256 !== expected.sha256)
        )
          throw Error("An older lesson asset failed verification: " + path);
        await mkdir(
          directory + "/" + path.slice(0, path.lastIndexOf("/") + 1),
          { recursive: true },
        );
        await writeFile(directory + "/" + path, body);
        retained.push({ path, bytes: body.length, sha256 });
        if (/\.(?:m?js|css)$/.test(path)) discover(body.toString(), path);
        if(/python-worker\.js$/.test(path)){
          const parent=path.slice(0,path.lastIndexOf('/')+1)+'vendor/pyodide/';
          for(const name of ['pyodide.js','pyodide.mjs','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'])enqueue(parent+name,true);
          for(const match of body.toString().matchAll(/['"]([A-Za-z0-9_.+-]+\.whl)['"]/g))enqueue(parent+match[1],true);
        }
        if(path.endsWith('vendor/pyodide/pyodide-lock.json'))for(const item of Object.values(JSON.parse(body.toString()).packages))enqueue(path.slice(0,path.lastIndexOf('/')+1)+item.file_name,true);
        const python = path.match(
          /^(.*engine\/([0-9]+\.[0-9]+\.[0-9]+)\/)pyodide\.js$/,
        );
        if (python)
          for (const file of [
            "pyodide.asm.js",
            "pyodide.asm.wasm",
            "python_stdlib.zip",
            "pyodide-lock.json",
          ])
            enqueue(python[1] + file, true);
        if (path.endsWith("runtime-manifest.json")) {
          const manifest = JSON.parse(body.toString());
          if (
            /^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.pyodide) &&
            Array.isArray(manifest.packages)
          )
            for (const item of manifest.packages)
              enqueue("engine/" + manifest.pyodide + "/" + item.file, true);
        }
      }),
    );
  }
  for (const path of required)
    if (!retained.some((file) => file.path === path))
      throw Error("An older referenced asset is missing: " + path);
  const after = await request("index.html");
  if (!after.ok || digest(Buffer.from(await after.arrayBuffer())) !== pageHash)
    throw Error(
      "The published site changed while retaining older open lessons. Retry publication.",
    );
  return retained.sort((a, b) => a.path.localeCompare(b.path));
}
