// Copyright © 2026 Christopher Snow. Real course execution and actual worker update protocol.
const { chromium, expect } = require("playwright/test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  { createServer } = require("node:http");
const options = {
  headless: true,
  executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
  viewport: { width: 390, height: 950 },
  acceptDownloads: true,
};
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
};
function serve(resolveFile, intercept = async () => false) {
  const server = createServer(async (req, res) => {
    try {
      if (await intercept(req, res)) return;
      const file = resolveFile(new URL(req.url, "http://local")),
        body = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Length": body.length,
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return {
    server,
    async start() {
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      return (
        "http://127.0.0.1:" +
        server.address().port +
        "/sensitivity-analysis-lab/"
      );
    },
    async stop() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}
function relative(url) {
  let name = url.pathname.replace(/^\/sensitivity-analysis-lab\//, "");
  if (name.startsWith("/") || name.includes("..")) throw Error();
  return name || "index.html";
}
async function saveAndReload(page) {
  await page.evaluate(async () => {
    const script = document.querySelector('script[src*="/offline.mjs"]').src;
    await (
      await import(new URL("./experiment-state.mjs", script))
    ).saveReadingState();
  });
  await page.reload();
}
async function updates() {
  const { buildOffline } = await import("../scripts/offline.mjs"),
    directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "sensitivity-updates-"),
    ),
    roots = {},
    releases = {};
  let phase = "a",
    slow = true,
    slowStarted = false,
    releaseSlow,
    failUpdate = false,
    outage = false,
    controlStarted = false,
    releaseControl;
  for (const version of ["a", "b"]) {
    const root = (roots[version] = path.join(directory, version));
    await fs.mkdir(path.join(root, "assets"), { recursive: true });
    for (const file of [
      "offline.mjs",
      "release-contract.mjs",
      "release-metadata.mjs",
      "experiment-state.mjs",
      "runtime-recovery.mjs",
      "app-status.css",
      "runtime-recovery.css",
    ])
      await fs.copyFile("src/" + file, path.join(root, file));
    await fs.writeFile(
      path.join(root, "index.html"),
      '<html><head><link rel="stylesheet" href="app-status.css"><script type="module" src="fixture.mjs"></script></head><body><header><!-- app-status-control --></header><main><textarea id="source">starter</textarea><pre id="output">recorded fixture output</pre><details id="notes"><summary>Notes</summary>Reading</details></main></body></html>',
    );
    await fs.writeFile(
      path.join(root, "fixture.mjs"),
      `import{registerReading}from'./experiment-state.mjs';document.body.dataset.version='${version}';window.veto=false;registerReading('fixture',{isBusy:()=>window.veto,save:()=>({output:document.querySelector('#output').textContent}),restore:value=>document.querySelector('#output').textContent=value.output});`,
    );
    await fs.writeFile(
      path.join(root, "assets/transfer-fixture.txt"),
      ("verified transfer fixture " + version).repeat(64),
    );
    releases[version] = await buildOffline(root);
  }
  const host = serve(
      (url) => {
        const name = relative(url),
          pin = name.match(/^releases\/([a-f0-9]{64})\//);
        const version = pin
          ? Object.keys(releases).find((v) => releases[v].id === pin[1])
          : phase;
        return path.join(roots[version], name);
      },
      async (req, res) => {
        const name = relative(new URL(req.url, "http://local"));
        if (outage) {
          res.writeHead(503).end("Fixture server disconnected");
          return true;
        }
        if (!controlStarted && name.endsWith("/offline.mjs")) {
          controlStarted = true;
          await new Promise(resolve => { releaseControl = resolve; });
        }
        if (!name.endsWith("assets/transfer-fixture.txt")) return false;
        if (failUpdate && name.includes(releases.b.id)) {
          res.writeHead(503).end("Temporary fixture failure");
          return true;
        }
        if (slow && name.includes(releases.a.id)) {
          slowStarted = true;
          const body = await fs.readFile(
            path.join(roots.a, "assets/transfer-fixture.txt"),
          );
          res.writeHead(200, { "Content-Length": body.length });
          res.write(body.subarray(0, 10));
          await new Promise((resolve) => (releaseSlow = resolve));
          if (!res.destroyed) res.end(body.subarray(10));
          return true;
        }
        return false;
      },
    ),
    base = await host.start(),
    browser = await chromium.launch(options),
    context = await browser.newContext();
  try {
    const p = await context.newPage();
    await p.goto(base + "#one", { waitUntil: "commit" });
    await expect(p.locator("#app-status-open")).toBeDisabled();
    await expect.poll(() => controlStarted).toBe(true);
    releaseControl();
    await expect(p.locator("#app-status-open")).toBeEnabled({ timeout: 30000 });
    await p.locator("#source").fill("First window note");
    await p
      .locator("#output")
      .evaluate((n) => (n.textContent = "first genuine fixture state"));
    await p.locator("#notes").evaluate((n) => (n.open = true));
    await p.locator("#app-status-open").click();
    await expect(p.locator("#download-update")).toBeVisible({ timeout: 30000 });
    await p.locator("#download-update").click();
    await expect.poll(() => slowStarted).toBe(true);
    await p.locator("#cancel-download").click();
    await expect(p.locator("#cancel-download")).toBeHidden({ timeout: 30000 });
    await expect(p.locator("#offline-status")).not.toContainText(
      "Downloaded and ready to use offline",
    );
    slow = false;
    releaseSlow();
    await expect(p.locator("#download-update")).toBeEnabled();
    await p.locator("#download-update").click();
    await expect(p.locator("#offline-status")).toContainText(
      "Downloaded and ready to use offline",
      { timeout: 30000 },
    );
    await p.keyboard.press("Escape");
    const q = await context.newPage();
    await q.goto(base + "#two");
    await q.locator("#source").fill("Second window note");
    phase = "b";
    failUpdate = true;
    await p.locator("#app-status-open").click();
    await p.locator("#app-status-details").evaluate((n) => (n.open = true));
    await p.locator("#check-update").click();
    await expect(p.locator("#download-update")).toHaveText(
      "Update offline copy",
      { timeout: 30000 },
    );
    await p.locator("#download-update").click();
    await expect(p.locator("#app-status-error")).not.toBeEmpty({
      timeout: 30000,
    });
    await expect(p.locator("#restart-update")).toBeHidden();
    outage = true;
    await context.setOffline(true);
    await saveAndReload(q);
    await expect(q.locator("body")).toHaveAttribute("data-version", "a");
    await expect(q.locator("#source")).toHaveValue("Second window note");
    outage = false,
    controlStarted = false,
    releaseControl;
    failUpdate = false;
    await context.setOffline(false);
    await expect(p.locator("#restart-update")).toBeVisible({ timeout: 30000 });
    await q.evaluate(() => (window.veto = true));
    await p.locator("#restart-update").click();
    await expect(p.locator("#app-status-error")).not.toBeEmpty({
      timeout: 20000,
    });
    await expect(p.locator("body")).toHaveAttribute("data-version", "a");
    await q.evaluate(() => (window.veto = false));
    await q.evaluate(() => {
      window.originalOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = () => {
        throw Error("Storage deliberately blocked");
      };
    });
    await p.locator("#restart-update").click();
    await expect(p.locator("#app-status-error")).toContainText(
      /storage|save/i,
      { timeout: 20000 },
    );
    await expect(q.locator("#source")).toHaveValue("Second window note");
    await q.evaluate(() => (indexedDB.open = window.originalOpen));
    await p.locator("#restart-update").click();
    await expect(p.locator("body")).toHaveAttribute("data-version", "b", {
      timeout: 30000,
    });
    await expect(q.locator("body")).toHaveAttribute("data-version", "b", {
      timeout: 30000,
    });
    await expect(p.locator("#source")).toHaveValue("First window note");
    await expect(q.locator("#source")).toHaveValue("Second window note");
    await expect(p.locator("#output")).toHaveText(
      "first genuine fixture state",
    );
    assert.equal(await p.locator("#notes").evaluate((n) => n.open), true);
    await context.setOffline(true);
    await p.reload();
    await expect(p.locator("body")).toHaveAttribute("data-version", "b");
    console.log(
      "PASS cancelled/resumed verified save, failed update preserves usable previous copy, actual two-release worker protocol; active-experiment and storage veto; atomic all-window restart; independent notes, results and disclosures restored; updated release opens offline.",
    );
  } finally {
    releaseSlow?.();
    await context.close();
    await browser.close();
    await host.stop();
    await fs.rm(directory, { recursive: true, force: true });
  }
}
updates().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
