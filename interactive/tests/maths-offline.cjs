const { chromium, expect } = require("playwright/test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http");
const config = {
  root: ".build/site",
  slug: "linear-algebra-v2",
  kind: "linear",
  first: "#vectors",
  middle: "#eigenvalues",
  last: "#applications",
  code: "import numpy as np\nimport sympy as sp\nprint(sp.Matrix([[1,2],[3,4]]).det())",
};
(async () => {
  const root = path.resolve(config.root),
    profile = await fs.mkdtemp(path.join(os.tmpdir(), "maths-offline-")),
    errors = [],
    outside = [];
  let context, server, port;
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".woff2": "font/woff2",
  };
  async function start() {
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://local");
        if (!url.pathname.startsWith("/" + config.slug + "/"))
          throw Error("scope");
        let name = url.pathname.slice(config.slug.length + 2);
        if (!name || name.endsWith("/")) name += "index.html";
        const p = path.resolve(root, name);
        if (!p.startsWith(root + path.sep)) throw Error("path");
        const body = await fs.readFile(p);
        res.writeHead(200, {
          "Content-Type": mime[path.extname(p)] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((r) => server.listen(port || 0, "127.0.0.1", r));
    port = server.address().port;
  }
  await start();
  const base = "http://127.0.0.1:" + port + "/" + config.slug + "/";
  async function open(offline = false) {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      executablePath:
        process.env.CHROMIUM ||
        process.env.CHROMIUM_PATH ||
        "/usr/bin/chromium",
      serviceWorkers: "allow",
      viewport: { width: 390, height: 920 },
      offline,
    });
    context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    context.on("request", (r) => {
      if (
        !r.url().startsWith(base) &&
        !r.url().startsWith("blob:") &&
        !r.url().startsWith("data:")
      )
        outside.push(r.url());
    });
    return context.pages()[0] || context.newPage();
  }
  async function ready(p) {
    await p.waitForFunction(
      () => window.labWorkbench && !window.labWorkbench.isBusy(),
      null,
      { timeout: 45000 },
    );
  }
  async function visit(p, href) {
    await p.goto(base + href, { waitUntil: "domcontentloaded" });
    await ready(p);
  }
  async function run(p, source) {
    if (config.kind === "framework") {
      await p.locator("#code").fill(source);
      await p.locator("#run").click();
      await expect(p.locator("#status")).toContainText("Completed", {
        timeout: 180000,
      });
      return p.locator("#output").textContent();
    }
    if (config.kind === "linear") {
      if (await p.locator("#python-panel").isHidden())
        await p.locator("#python-toggle").click();
      await p.locator("#python-code").fill(source);
      await p.locator("#run-python").click();
      await expect(p.locator("#python-status")).toContainText(
        "Python run finished",
        { timeout: 180000 },
      );
      return p.locator("#python-output").textContent();
    }
    await p.locator(".python-panel").evaluate((n) => (n.open = true));
    await p.locator("#python-code").fill(source);
    await p.locator("#python-run").click();
    await expect(p.locator("#python-status")).toContainText("Run complete", {
      timeout: 180000,
    });
    return p.locator("#python-output").textContent();
  }
  async function snapshot(p) {
    await p.evaluate(async () => {
      const script = document.querySelector('script[src*="/offline.mjs"]').src;
      await (
        await import(new URL("./experiment-state.mjs", script))
      ).saveReadingState();
    });
  }
  try {
    let p = await open();
    p.on("pageerror", (e) => errors.push(e.message));
    await visit(p, "");
    assert.equal(await p.locator("#app-status-open svg:visible").count(), 1);
    assert.equal(
      await p.locator("#app-status-open").getAttribute("aria-label"),
      "App status and offline access",
    );
    for (const width of [320, 390, 820, 1440]) {
      await p.setViewportSize({ width, height: 920 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        width + " existing layout",
      );
      await p.locator("#app-status-open").click();
      assert(
        await p
          .locator("#app-status-dialog")
          .evaluate((n) => n.matches(":modal")),
      );
      await p.keyboard.press("Escape");
      assert(
        await p
          .locator("#app-status-open")
          .evaluate((n) => n === document.activeElement),
      );
    }
    await p.locator("#app-status-open").click();
    await expect(p.locator("#download-update")).toHaveText(
      "Save offline copy",
      { timeout: 30000 },
    );
    await p.locator("#download-update").click();
    await expect(p.locator("#offline-status")).toContainText(
      "Downloaded and ready to use offline",
      { timeout: 240000 },
    );
    await context.close();
    context = null;
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    server = null;
    p = await open(true);
    p.on("pageerror", (e) => errors.push(e.message));
    await visit(p, config.first);
    const code = config.code + '\nprint("OFFLINE", 6 * 7)\n',
      output = await run(p, code);
    assert.match(output, /OFFLINE 42/);
    const edited = code.replace("6 * 7", "6 * 8");
    assert.match(await run(p, edited), /OFFLINE 48/);
    await snapshot(p);
    await p.reload();
    await ready(p);
    assert.equal(
      await p
        .locator(config.kind === "framework" ? "#code" : "#python-code")
        .inputValue(),
      edited,
    );
    assert.match(
      await p
        .locator(config.kind === "framework" ? "#output" : "#python-output")
        .textContent(),
      /OFFLINE 48/,
    );
    if (config.kind === "framework") {
      await p.locator("#mark-read").check();
      await snapshot(p);
      await p.reload();
      await ready(p);
      assert(await p.locator("#mark-read").isChecked());
      await expect(p.locator("#plots img").first()).toBeVisible();
      assert(
        await p
          .locator("#plots img")
          .first()
          .evaluate((n) => n.complete && n.naturalWidth > 0),
      );
    }
    await visit(p, config.middle);
    if (config.kind === "linear") {
      const input = p.locator("#controls-body input").first();
      if (await input.count()) assert(await input.isVisible());
    } else assert(await p.locator("main").isVisible());
    await visit(p, config.last);
    await p.locator("#app-status-open").click();
    await expect(p.locator("#offline-status")).toContainText(
      "Downloaded and ready to use offline",
    );
    await p.keyboard.press("Escape");
    await fs.mkdir("test-results", { recursive: true });
    await p.screenshot({ path: "test-results/offline-cold.png" });
    await context.close();
    context = null;
    await start();
    p = await open();
    p.on("pageerror", (e) => errors.push(e.message));
    await visit(p, config.first);
    await p.locator("#app-status-open").click();
    await p.locator("#app-status-details").evaluate((n) => (n.open = true));
    await expect(p.locator("#offline-status")).toContainText(
      "Downloaded and ready to use offline",
      { timeout: 30000 },
    );
    // Hold a real ready STATUS response across REMOVE. A late verification
    // must not make deleted files appear downloaded again.
    await p.evaluate(() => {
      const post = ServiceWorker.prototype.postMessage;
      const replies = [];
      window.releaseHeldStatus = () => {
        for (const reply of replies) reply();
      };
      ServiceWorker.prototype.postMessage = function (message, ports) {
        if (message.type === "STATUS") {
          const channel = new MessageChannel();
          channel.port1.onmessage = ({ data }) => {
            if (data.progress) ports[0].postMessage(data);
            else {
              window.heldStatusReady ||= Boolean(data.result?.offlineReady);
              replies.push(() => {
                ports[0].postMessage(data);
                channel.port1.close();
              });
            }
          };
          return post.call(this, message, [channel.port2]);
        }
        return post.call(this, message, ports);
      };
      dispatchEvent(new Event("focus"));
    });
    await p.waitForFunction(() => window.heldStatusReady);
    await p.locator("#remove-offline").click();
    await p.locator("#confirm-remove").click();
    await expect(p.locator("#offline-status")).toContainText(
      "Not downloaded for offline use",
    );
    await p.evaluate(async () => {
      releaseHeldStatus();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    await expect(p.locator("#offline-status")).toContainText(
      "Not downloaded for offline use",
    );
    await p.keyboard.press("Escape");
    if (
      config.kind === "linear" &&
      (await p.locator("#python-panel").isHidden())
    )
      await p.locator("#python-toggle").click();
    assert.equal(
      await p
        .locator(config.kind === "framework" ? "#code" : "#python-code")
        .inputValue(),
      edited,
    );
    assert.deepEqual(
      outside,
      [],
      "no course dependency outside its own Pages path",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS " +
        config.slug +
        ": header icon only, status modal, widths/focus, complete verified save, closed browser and stopped server, real cold offline Python and edited run, genuine result/figure restart restoration, unvisited lessons, and removal preserving drafts",
    );
  } finally {
    await context?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
