const course = {
  slug: "linear-algebra-v2",
  title: "Linear Algebra V2",
};
// Copyright © 2026 Christopher Snow.
import posixPath from "node:path";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
const installHelp = "";
import { validateRelease } from "../src/release-contract.mjs";
const hash = (data) => createHash("sha256").update(data).digest("hex");
async function filesUnder(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      files.push(
        ...(await filesUnder(`${directory}/${entry.name}`, `${path}/`)),
      );
    else files.push(path);
  }
  return files.sort();
}
const markup = "<button id=\"app-status-open\" class=\"offline-status-control\" type=\"button\" aria-label=\"App status and offline access\" aria-describedby=\"app-status-summary\" title=\"App status and offline access\" aria-haspopup=\"dialog\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M19.35 10.04C18.67 6.59 15.64 4 12 4c-2.89 0-5.4 1.64-6.65 4.04C2.34 8.36 0 10.9 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z\"/></svg><span id=\"app-status-summary\" class=\"offline-status-label\">Check version</span></button>";
const panel = `<dialog id="app-status-dialog" aria-labelledby="app-status-title">
<div class="status-heading"><h2 id="app-status-title">App status</h2><button id="app-status-close" type="button" autofocus>Close</button></div>
<div id="app-status-feedback"><p id="app-status-error" role="status"></p></div>
<section id="course-status" aria-labelledby="version-title" tabindex="-1"><h3 id="version-title">Course status</h3>
<div id="update-section" class="course-state"><svg id="course-ready-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" hidden><path d="m5 12 4 4 10-10"/></svg><p id="version-status" role="status">Checking for updates</p></div>
<div id="offline-section"><p id="offline-status" role="status"></p></div>
<p id="version-detail"></p>
<p id="offline-size"></p>
<div class="status-actions"><button id="reload-online" type="button" hidden>Reload latest course</button><button id="restart-update" class="primary" type="button" hidden>Restart to update</button><button id="download-update" class="primary" type="button" hidden>Save offline copy</button><button id="later-update" type="button" hidden>Later</button><button id="retry-update" type="button" hidden>Retry</button></div>
<div id="update-download-feedback"></div>
<div id="offline-download-feedback"><div id="download-progress" hidden><label id="download-progress-label" for="asset-progress">Checking files</label><progress id="asset-progress"></progress><p id="offline-progress-text" role="status"></p><p id="download-behaviour"></p><button id="cancel-download" type="button">Cancel download</button></div></div>
<p id="restart-note" hidden>Restart reloads all open windows for this course and restores your lessons and saved work. Finish any running experiment first.</p></section>
<details id="app-status-details"><summary>Version and download details</summary><p id="running-version"></p><p id="release-detail"></p>
<button id="check-update" type="button">Check for updates</button>
<p>Downloads include all lessons, diagrams, local fonts, Python examples, Pyodide and the bundled mathematics packages. Browser storage overhead is additional. External links need internet access.</p>
<p>Worked examples, method notes and result downloads work offline. External reference websites need internet access.</p>
<button id="remove-offline" type="button" hidden>Remove offline copy</button>
<div id="remove-confirmation" hidden><p>Remove this course’s downloaded files from this browser? Your experiment work, preferences and other apps will be kept.</p><button id="confirm-remove" type="button">Remove downloaded files</button><button id="cancel-remove" type="button">Keep offline copy</button></div></details>
<div id="install-help" hidden></div>
</dialog>`;
export async function buildOffline(
  directory,
  identity = { commit: null, date: null },
) {
  const files = (await filesUnder(directory)).filter(
    (path) =>
      path !== ".nojekyll" &&
      path !== "sw.js" &&
      path !== "release.json" &&
      !path.startsWith("releases/"),
  );
  for (const filePath of files.filter((path) => path.endsWith(".html"))) {
    const path = filePath;
    const base = "../".repeat(path.split("/").length - 1) || "./";
    let html = (await readFile(`${directory}/${path}`, "utf8"))
      .replace("<!-- app-status-control -->", markup)
      .replace("</body>", `${panel}</body>`)
      .replace(
        "</head>",
        `<meta name="gpu-base" content="${base}"><meta name="gpu-release" content="__BUILD_ID__"><script type="module" src="${base}offline.mjs"></script></head>`,
      );
    // Pin executable assets to this release even before a worker controls the page.
    html = html.replace(
      /((?:src|href)=")(?!(?:[a-z]+:|#|\/))([^"?#]+\.[a-z0-9]+)([^"]*)"/gi,
      (_, attribute, url, suffix) => {
        const target = posixPath.posix.normalize(
          posixPath.posix.join(posixPath.posix.dirname(filePath), url),
        );
        if (target.startsWith("../") || target.endsWith(".html"))
          return attribute + url + suffix + '"';
        return `${attribute}${base}releases/__BUILD_ID__/${target}${suffix}"`;
      },
    );
    html = html.replace(
      /srcset="([^"]+)"/gi,
      (_, values) =>
        'srcset="' +
        values
          .split(",")
          .map((entry) => {
            const [url, ...descriptor] = entry.trim().split(/\s+/);
            if (/^(?:[a-z]+:|#|\/)/i.test(url)) return entry;
            const target = posixPath.posix.normalize(
              posixPath.posix.join(posixPath.posix.dirname(filePath), url),
            );
            return [
              base + "releases/__BUILD_ID__/" + target,
              ...descriptor,
            ].join(" ");
          })
          .join(", ") +
        '"',
    );
    await writeFile(`${directory}/${path}`, html);
  }
  const worker = await readFile(
    new URL("./service-worker.js", import.meta.url),
    "utf8",
  );
  const contract = (
    await readFile(
      new URL("../src/release-contract.mjs", import.meta.url),
      "utf8",
    )
  ).replace(/export /g, "");
  const ranges = (
    await readFile(new URL("../src/media-range.mjs", import.meta.url), "utf8")
  ).replace(/export /g, "");
  const workerSource = (contract + "\n" + ranges + "\n" + worker)
    .replaceAll("__COURSE_SLUG__", course.slug)
    .replaceAll("this course", course.title);
  const fingerprint = createHash("sha256").update(workerSource);
  for (const path of files)
    fingerprint
      .update(path)
      .update("\0")
      .update(await readFile(`${directory}/${path}`))
      .update("\0");
  const id = fingerprint.digest("hex");
  const assets = [];
  for (const path of files) {
    let body = await readFile(`${directory}/${path}`);
    if (path.endsWith(".html"))
      body = Buffer.from(body.toString().replaceAll("__BUILD_ID__", id));
    assets.push({ path, bytes: body.length, sha256: hash(body) });
    await writeFile(`${directory}/${path}`, body);
    const target = `${directory}/releases/${id}/${path}`;
    await mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    await writeFile(target, body);
  }
  const release = validateRelease({
    schema: 1,
    id,
    ...identity,
    bytes: assets.reduce((sum, f) => sum + f.bytes, 0),
    files: assets,
  });
  await writeFile(`${directory}/release.json`, JSON.stringify(release));
  await writeFile(
    `${directory}/releases/${id}/release.json`,
    JSON.stringify(release),
  );
  await writeFile(`${directory}/sw.js`, workerSource);
  await writeFile(`${directory}/offline.js`, workerSource);
  return release;
}
