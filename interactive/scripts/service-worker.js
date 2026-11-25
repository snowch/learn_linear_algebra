// Copyright © 2026 Christopher Snow.
// The build prepends the dependency-free release validator. No precache on install.
const BASE = new URL(self.registration.scope);
const PREFIX = `linear-algebra-v2:${BASE.href}:`;
const META = PREFIX + "status-v1";
const STATE = new URL("__app_status_state__", BASE).href;
const MANIFEST = new URL("__release_manifest__", BASE).href;
const RESTART_NAVIGATION = new URL("__restart_navigation__", BASE).href;
const cacheName = (id) => PREFIX + "release-" + id;
let operation = null,
  pruning = null,
  operationDownload = null;
let operationFinished = Promise.resolve(),
  finishOperation;
function beginOperation(purpose = "download") {
  operation = new AbortController();
  operation.purpose = purpose;
  operationFinished = new Promise((resolve) => {
    finishOperation = resolve;
  });
}
function endOperation() {
  operation = null;
  operationDownload = null;
  finishOperation?.();
}
async function interruptPageRetention() {
  // Optional retention must never reject a learner's explicit course update.
  // Abort its network work and wait for the lock before starting the download.
  if (operation?.purpose !== "remember") return;
  const finished = operationFinished;
  operation.abort();
  await finished;
}
let restarting = false;
let navigationGate, releaseNavigation;
const seen = new Map();
const verifying = new Map();
function invalidateVerification(id) {
  const scan = verifying.get(id);
  if (scan) {
    scan.invalidated = true;
    verifying.delete(id);
  }
}
async function legacyResponse(path) {
  for (const name of await caches.keys()) {
    if (
      !name.startsWith(PREFIX) ||
      name === META ||
      name.startsWith(PREFIX + "release-")
    )
      continue;
    const cache = await caches.open(name);
    if (!(await cache.match(new URL("__offline_complete__", BASE)))) continue;
    const response = await cache.match(new URL(path, BASE));
    if (response) return response;
  }
  return null;
}
async function readState() {
  const cache = await caches.open(META);
  return (await cache.match(STATE))?.json() ?? {};
}
async function writeState(state) {
  await (
    await caches.open(META)
  ).put(STATE, new Response(JSON.stringify(state)));
}
async function manifest(id) {
  if (!id) return null;
  const response = await (await caches.open(cacheName(id))).match(MANIFEST);
  return response ? validateRelease(await response.json()) : null;
}
async function verified(response, file) {
  if (!response?.ok) return false;
  const data = await response.arrayBuffer();
  return data.byteLength === file.bytes && (await digest(data)) === file.sha256;
}
async function complete(release, progress) {
  if (!release) return false;
  // Many open tabs request status together after a download. Share that scan,
  // including its byte/hash checks, rather than rereading every video per tab.
  // Retain no result after it finishes: the next check must detect eviction.
  let scan = verifying.get(release.id);
  if (!scan) {
    scan = { listeners: new Set(), bytes: 0, work: null };
    scan.work = Promise.resolve().then(async () => {
      try {
        const cache = await caches.open(cacheName(release.id));
        // Bound memory while overlapping CacheStorage I/O for the complete book.
        // Join failed batches before retries can start another scan.
        for (let start = 0; start < release.files.length; start += 4) {
          const batch = release.files.slice(start, start + 4);
          const checks = await Promise.allSettled(
            batch.map(async (file) =>
              verified(await cache.match(new URL(file.path, BASE)), file),
            ),
          );
          for (const check of checks) {
            if (check.status === "rejected") throw check.reason;
            if (!check.value) return false;
          }
          scan.bytes += batch.reduce((sum, file) => sum + file.bytes, 0);
          // Each waiting RPC receives real verification progress, so cold disk
          // reads reset its inactivity timer without extending stalled work.
          for (const listener of scan.listeners) {
            try {
              listener({ bytes: scan.bytes, total: release.bytes });
            } catch {
              /* A closed tab cannot cancel another tab's scan. */
            }
          }
        }
        // A file checked early can be evicted while a later recording is hashed.
        const present = new Set(
          (await cache.keys()).map((request) => request.url),
        );
        return release.files.every((file) =>
          present.has(new URL(file.path, BASE).href),
        );
      } finally {
        if (verifying.get(release.id) === scan) verifying.delete(release.id);
      }
    });
    verifying.set(release.id, scan);
  }
  if (progress) {
    scan.listeners.add(progress);
    if (scan.bytes) {
      try {
        progress({ bytes: scan.bytes, total: release.bytes });
      } catch {
        /* The requester may have closed. */
      }
    }
  }
  try {
    const result = await scan.work;
    return result && !scan.invalidated;
  } finally {
    scan.listeners.delete(progress);
  }
}
async function broadcast(message) {
  for (const client of await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  })) {
    if (client.url.startsWith(BASE.href)) client.postMessage(message);
  }
}
function prune(progress) {
  if (operation || restarting) return;
  if (pruning) return pruning;
  // Cleanup owns the cache list until it finishes. Mutating requests reserve
  // their operation immediately, then wait before opening or deleting caches.
  pruning = (async () => {
    const state = await readState();
    const windows = (
      await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    ).filter((client) => client.url.startsWith(BASE.href));
    // Arriving documents have not reported their version. Online documents can
    // differ from the saved offline copy; keep every open document's assets.
    if (windows.some((client) => !seen.has(client.id))) return;
    const keep = new Set(
      [
        state.active,
        state.previous,
        state.pending,
        state.partial,
        state.visited,
        ...windows.map((client) => seen.get(client.id)),
      ]
        .filter(Boolean)
        .map(cacheName),
    );
    // Legacy complete copies remain until explicit removal or migration.
    for (const name of await caches.keys())
      if (name.startsWith(PREFIX + "release-") && !keep.has(name))
        await caches.delete(name);
  })().finally(() => {
    pruning = null;
  });
  return pruning;
}
async function status(running, justVerified, progress) {
  const state = await readState();
  const release = await manifest(state.active || running);
  const pending = await manifest(state.pending);
  const keys = await caches.keys();
  // Old workers saved automatically. Keep their complete cache until the learner
  // explicitly removes it; treat it as consent to preserve offline access on update.
  const legacy = Boolean(await legacyResponse("index.html"));
  const transfer = await downloadInfo();
  return {
    ...state,
    ...transfer,
    freshVerification: 1,
    runningRelease: await manifest(running),
    saved: Boolean(state.saved || legacy),
    legacy,
    offlineReady: Boolean(
      state.saved &&
      ((justVerified && release?.id === justVerified.id) ||
        (await complete(release, progress))),
    ),
    pendingReady: Boolean(
      pending &&
      ((justVerified && pending.id === justVerified.id) ||
        (await complete(pending, progress))),
    ),
    busy: Boolean(operation || restarting || transfer.download?.busy),
  };
}
async function rememberPage(release, paths, signal) {
  signal.throwIfAborted();
  validateRelease(release);
  const cache = await caches.open(cacheName(release.id));
  await cache.put(MANIFEST, new Response(JSON.stringify(release)));
  const requested = new Set(paths);
  // These files have already been loaded by this document. This is a visited-page
  // cache, not a background download of the rest of the app or offline consent.
  for (const file of release.files.filter((f) => requested.has(f.path))) {
    signal.throwIfAborted();
    const key = new URL(file.path, BASE);
    if (await verified(await cache.match(key), file)) continue;
    const response = await fetch(
      new URL(`releases/${release.id}/${file.path}`, BASE),
      {
        cache: "no-cache",
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      },
    );
    if (!(await verified(response.clone(), file)))
      throw new Error(
        "The running page could not be retained. Keep this tab open until you restart to update.",
      );
    await cache.put(key, response);
  }
  // Re-read after I/O so a concurrent explicit download cannot lose its consent.
  const latest = await readState();
  signal.throwIfAborted();
  if (!latest.active) latest.active = release.id;
  latest.visited = release.id;
  await writeState(latest);
}
async function prepare(release, save, port, signal, downloadId, running) {
  validateRelease(release);
  const cache = await caches.open(cacheName(release.id));
  await cache.put(MANIFEST, new Response(JSON.stringify(release)));
  let bytes = 0;
  for (const file of release.files) {
    signal.throwIfAborted();
    const key = new URL(file.path, BASE);
    if (!(await verified(await cache.match(key), file))) {
      const timeout = AbortSignal.timeout(15000);
      const response = await fetch(
        new URL(`releases/${release.id}/${file.path}`, BASE),
        {
          cache: "no-store",
          signal: AbortSignal.any([signal, timeout]),
          credentials: "same-origin",
        },
      );
      if (!response.ok)
        throw new Error(
          "Download paused because a file is unavailable. Completed files are kept; it will resume when you return.",
        );
      if (!(await verified(response.clone(), file)))
        throw new Error(
          "A downloaded file did not match the release. Retry after deployment finishes.",
        );
      signal.throwIfAborted();
      await cache.put(key, response);
    }
    bytes += file.bytes;
    port.postMessage({ progress: { bytes, total: release.bytes } });
    if (downloadId)
      await reportDownload(downloadId, {
        bytes,
        total: release.bytes,
        stage: "verified",
      });
  }
  if (downloadId) {
    await changeDownload(downloadId, { state: "verifying" });
    await broadcast({ type: "STATUS_CHANGED" });
  }
  await markPrepared(
    release,
    save,
    signal,
    () =>
      port.postMessage({
        progress: { bytes: release.bytes, total: release.bytes },
      }),
    running,
  );
}
async function markPrepared(release, save, signal, progress, running) {
  signal.throwIfAborted();
  if (!(await complete(release, progress)))
    throw new Error(
      "The saved files could not be verified. Free storage and retry.",
    );
  signal.throwIfAborted();
  const state = await readState();
  // Cache metadata can be evicted while a pinned page stays open. The caller's
  // running version, not the presence of an active cache, distinguishes an
  // update from saving the current course. Keep it pending until explicit restart.
  const updating = /^[a-f0-9]{64}$/.test(running) && running !== release.id;
  if (updating && (!state.active || state.active === release.id))
    state.active = running;
  if (!updating && save && (!state.active || state.active === release.id)) {
    state.active = release.id;
    state.saved = true;
  } else {
    state.pending = release.id;
    state.pendingSaved = Boolean(
      save || state.saved || (await status()).legacy,
    );
  }
  state.partial = null;
  await writeState(state);
}
// Download consent is separate from the active-release state. In particular,
// cancelling a transfer must not replace a completed course or an editor draft.
const DOWNLOAD_REQUEST = new URL("__download_request_v1__", BASE).href;
let downloadWrites = Promise.resolve();
async function readDownload() {
  const response = await (await caches.open(META)).match(DOWNLOAD_REQUEST);
  if (!response) return null;
  try {
    const job = await response.json();
    return job &&
      typeof job.wanted === "boolean" &&
      ["offline", "update"].includes(job.mode) &&
      /^[a-f0-9]{64}$/.test(job.release) &&
      typeof job.id === "string" &&
      job.id.startsWith("linear-algebra-v2-")
      ? job
      : null;
  } catch {
    return null;
  }
}
function writeDownload(job) {
  const work = downloadWrites.then(async () => {
    await (
      await caches.open(META)
    ).put(DOWNLOAD_REQUEST, new Response(JSON.stringify(job)));
    return job;
  });
  downloadWrites = work.catch(() => {});
  return work;
}
function changeDownload(id, patch) {
  const work = downloadWrites.then(async () => {
    const job = await readDownload();
    if (!job || job.id !== id) return null;
    const fields = typeof patch === "function" ? patch(job) : patch;
    if (!fields) return job;
    const next = { ...job, ...fields };
    await (
      await caches.open(META)
    ).put(DOWNLOAD_REQUEST, new Response(JSON.stringify(next)));
    return next;
  });
  downloadWrites = work.catch(() => {});
  return work;
}
async function nativeDownload(job) {
  if (!job || !self.registration.backgroundFetch) return null;
  try {
    return await self.registration.backgroundFetch.get(job.id);
  } catch {
    return null;
  }
}
async function downloadInfo() {
  const job = await readDownload();
  if (!job) return { downloadVersion: 1, download: null };
  const native = await nativeDownload(job);
  const busy =
    job.state !== "ready" &&
    (operationDownload === job.id ||
      Boolean(job.wanted && native) ||
      Boolean(
        job.wanted &&
        job.state === "planning" &&
        Date.now() - job.started < 30000,
      ));
  const state =
    native && job.wanted
      ? native.result
        ? "verifying"
        : "background"
      : job.wanted && !busy && job.state !== "ready"
        ? "paused"
        : job.state;
  const bytes =
    native && !native.result
      ? Math.min(job.total, job.cachedBytes + native.downloaded)
      : job.bytes;
  return {
    downloadVersion: 1,
    downloadRelease: await manifest(job.release),
    download: {
      ...job,
      state,
      busy,
      bytes,
      stage: native && !native.result ? "downloaded" : "verified",
    },
  };
}
async function newDownload(release, data) {
  const previous = await readDownload();
  if (data.downloadId) {
    if (
      !previous ||
      previous.id !== data.downloadId ||
      !previous.wanted ||
      previous.release !== release.id
    )
      throw new Error(
        "This download was cancelled or replaced. Choose the download again to start it.",
      );
    return previous;
  }
  if (
    previous?.wanted &&
    previous.state === "planning" &&
    Date.now() - previous.started < 30000
  )
    throw new Error(
      "Another window is preparing this download. Wait for it to finish.",
    );
  return writeDownload({
    id: "linear-algebra-v2-" + crypto.randomUUID(),
    release: release.id,
    running: data.running,
    mode: data.mode === "offline" ? "offline" : "update",
    save: Boolean(data.save),
    wanted: true,
    state: "planning",
    started: Date.now(),
    bytes: 0,
    cachedBytes: 0,
    total: release.bytes,
    error: null,
  });
}
async function reportDownload(id, progress) {
  const job = await changeDownload(id, { bytes: progress.bytes });
  if (job) await broadcast({ type: "DOWNLOAD_PROGRESS", id, progress });
}
async function failDownload(id, failure) {
  const message =
    failure.name === "QuotaExceededError"
      ? "Browser storage is full. Free space and resume the download."
      : ["TimeoutError", "TypeError"].includes(failure.name)
        ? "Download paused. Completed files are kept. Reconnect or return to resume."
        : failure.message || String(failure);
  const retry =
    !["AbortError", "QuotaExceededError"].includes(failure.name) &&
    !/match the release|could not be verified/.test(message);
  await changeDownload(id, (job) =>
    job.wanted
      ? {
          state: "paused",
          wanted: retry,
          error: failure.name === "AbortError" ? null : message,
        }
      : null,
  );
}
async function planDownload(data, port) {
  await interruptPageRetention();
  if (operation || restarting)
    throw new Error(
      "Another window is downloading or restarting. Wait for it to finish.",
    );
  beginOperation();
  let job;
  try {
    await pruning;
    operation.signal.throwIfAborted();
    validateRelease(data.release);
    const existing = await readDownload(),
      native = await nativeDownload(existing);
    if (existing?.wanted && native)
      return { backgroundId: existing.id, existing: true };
    if (
      existing?.wanted &&
      existing.state === "planning" &&
      Date.now() - existing.started < 30000 &&
      !data.downloadId
    )
      throw new Error(
        "Another window is preparing this download. Wait for it to finish.",
      );
    job = await newDownload(data.release, data);
    operationDownload = job.id;
    const cache = await caches.open(cacheName(data.release.id));
    await cache.put(MANIFEST, new Response(JSON.stringify(data.release)));
    const state = await readState();
    state.partial = data.release.id;
    await writeState(state);
    const requests = [];
    let bytes = 0,
      total = 0;
    for (const file of data.release.files) {
      operation.signal.throwIfAborted();
      if (await verified(await cache.match(new URL(file.path, BASE)), file))
        bytes += file.bytes;
      else {
        requests.push(
          new URL(`releases/${data.release.id}/${file.path}`, BASE).href,
        );
        total += file.bytes;
      }
      port.postMessage({
        progress: { bytes, total: data.release.bytes, stage: "checking" },
      });
    }
    operation.signal.throwIfAborted();
    if (!requests.length) {
      await markPrepared(
        data.release,
        Boolean(data.save),
        operation.signal,
        (value) => port.postMessage({ progress: value }),
        data.running,
      );
      await changeDownload(job.id, {
        state: "ready",
        wanted: false,
        bytes: data.release.bytes,
        error: null,
      });
      return { ready: true, status: await status(data.running, data.release) };
    }
    await changeDownload(job.id, {
      state: "planning",
      started: Date.now(),
      cachedBytes: bytes,
      bytes,
      error: null,
    });
    return {
      backgroundId: job.id,
      requests,
      downloadTotal: total,
      cachedBytes: bytes,
      total: data.release.bytes,
    };
  } catch (failure) {
    if (job) await failDownload(job.id, failure);
    throw failure;
  } finally {
    endOperation();
    await broadcast({ type: "STATUS_CHANGED" });
  }
}
async function cancelDownload(id) {
  const job = await readDownload();
  if (id && job?.id !== id) return;
  try {
    if (job && job.state !== "ready") await stopDownloadRequest(job.id);
  } finally {
    operation?.abort();
    const native = await nativeDownload(job);
    if (native) await native.abort();
  }
  await broadcast({ type: "STATUS_CHANGED" });
}
async function stopDownloadRequest(id) {
  try {
    await changeDownload(id, { wanted: false, state: "paused", error: null });
  } catch (failure) {
    // Storage pressure must not preserve consent for an automatic retry.
    // Remove only the request; the verified course and learner work are kept.
    const job = await readDownload();
    if (job?.id === id)
      await (await caches.open(META)).delete(DOWNLOAD_REQUEST);
    else throw failure;
  }
}
const backgroundImports = new Map();
async function receiveBackground(event, outcome) {
  const id = event.registration.id;
  if (backgroundImports.has(id)) return backgroundImports.get(id);
  const work = importBackground(event, outcome);
  backgroundImports.set(id, work);
  try {
    return await work;
  } finally {
    if (backgroundImports.get(id) === work) backgroundImports.delete(id);
  }
}
async function importBackground(event, outcome) {
  let job = await readDownload();
  if (
    !job ||
    job.id !== event.registration.id ||
    (!job.wanted && job.state === "ready")
  )
    return;
  if (outcome === "abort" && !job.foregroundOnly)
    await stopDownloadRequest(job.id);
  // A short page-cache operation may already own CacheStorage. Let it finish
  // before importing the browser's responses, including when no page is open.
  while (operation) await operationFinished;
  beginOperation();
  operationDownload = job.id;
  try {
    await pruning;
    job = await readDownload();
    if (
      !job ||
      job.id !== event.registration.id ||
      (!job.wanted && job.state === "ready")
    )
      return;
    const release = await manifest(job.release);
    if (!release)
      throw new Error(
        "The download metadata is missing. Choose the download again.",
      );
    await changeDownload(job.id, { state: "verifying" });
    const expected = new Map(
      release.files.map((file) => [
        new URL(`releases/${release.id}/${file.path}`, BASE).href,
        file,
      ]),
    );
    const cache = await caches.open(cacheName(release.id));
    let bytes = job.cachedBytes,
      validationFailure;
    if (event.registration.recordsAvailable) {
      const records = await event.registration.matchAll();
      const responses = await Promise.all(
        records.map(async (record) => {
          let timer;
          try {
            return {
              record,
              response: await Promise.race([
                record.responseReady,
                new Promise((_, reject) => {
                  timer = setTimeout(
                    () =>
                      reject(
                        new Error("A background response did not finish."),
                      ),
                    10000,
                  );
                }),
              ]),
            };
          } catch {
            return { record };
          } finally {
            clearTimeout(timer);
          }
        }),
      );
      for (const { record, response } of responses) {
        operation.signal.throwIfAborted();
        const file = expected.get(record.request.url);
        if (!file) {
          validationFailure = new Error(
            "A downloaded file did not match the release. Retry after deployment finishes.",
          );
          continue;
        }
        if (!response) {
          if (outcome === "success")
            validationFailure = new Error(
              "A download response is missing. Retry the download.",
            );
          continue;
        }
        let valid = false;
        try {
          valid = await verified(response.clone(), file);
        } catch {
          /* Aborted bodies are incomplete, never verified files. */
        }
        if (!valid) {
          if (outcome === "success")
            validationFailure = new Error(
              "A downloaded file did not match the release. Retry after deployment finishes.",
            );
          continue;
        }
        await cache.put(new URL(file.path, BASE), response);
        bytes += file.bytes;
        await reportDownload(job.id, {
          bytes,
          total: release.bytes,
          stage: "verified",
        });
      }
    }
    if (validationFailure) throw validationFailure;
    const current = await readDownload();
    if (outcome === "success" && current?.id === job.id && current.wanted) {
      await markPrepared(
        release,
        job.save,
        operation.signal,
        undefined,
        job.running,
      );
      await changeDownload(job.id, {
        state: "ready",
        wanted: false,
        bytes: release.bytes,
        error: null,
      });
      await event.updateUI?.({
        title:
          job.mode === "update"
            ? "this course update ready"
            : "this course available offline",
      });
    } else {
      const failed = outcome === "fail",
        reason = event.registration.failureReason;
      const retry =
        (outcome === "abort" && job.foregroundOnly) ||
        (failed &&
          !["aborted", "quota-exceeded", "download-total-exceeded"].includes(
            reason,
          ));
      const error = !failed
        ? null
        : reason === "quota-exceeded"
          ? "Browser storage is full. Free space and resume the download."
          : reason === "download-total-exceeded"
            ? "The download size changed. Retry after deployment finishes."
            : "Download interrupted. Completed files are kept; it will resume when you return.";
      await changeDownload(job.id, (current) => ({
        state: "paused",
        wanted: Boolean(current.wanted && retry),
        error: current.wanted ? error : null,
      }));
    }
  } catch (failure) {
    await failDownload(job.id, failure);
    try {
      await event.updateUI?.({ title: "this course download needs attention" });
    } catch {
      /* The in-app status retains the failure. */
    }
  } finally {
    endOperation();
    await broadcast({ type: "STATUS_CHANGED" });
  }
}
for (const [type, outcome] of [
  ["backgroundfetchsuccess", "success"],
  ["backgroundfetchfail", "fail"],
  ["backgroundfetchabort", "abort"],
]) {
  self.addEventListener(type, (event) =>
    event.waitUntil(receiveBackground(event, outcome)),
  );
}
self.addEventListener("backgroundfetchclick", (event) =>
  event.waitUntil(
    (async () => {
      const windows = (
        await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        })
      ).filter((client) => client.url.startsWith(BASE.href));
      const window =
        windows.find((client) => client.frameType !== "nested") ?? windows[0];
      if (window) {
        await window.focus();
        window.postMessage({ type: "OPEN_APP_STATUS" });
      } else await self.clients.openWindow(new URL("?download=1", BASE).href);
    })(),
  ),
);

// Directory links and explicit index.html identify the same saved document.
function directoryIndex(path) {
  return !path ? "index.html" : path.endsWith("/") ? path + "index.html" : path;
}

async function courseWindows(release) {
  const paths = new Set(
    release.files
      .filter((f) => f.path.endsWith(".html"))
      .map((f) => new URL(f.path, BASE).pathname),
  );
  return (
    await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  ).filter((client) => {
    const url = new URL(client.url);
    return (
      url.origin === BASE.origin && paths.has(directoryIndex(url.pathname))
    );
  });
}
function ask(client, token) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(
        new Error(
          "Another this course window did not respond. Open it and try again, or close it after saving your work.",
        ),
      );
    }, 5000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer);
      channel.port1.close();
      data?.ready
        ? resolve()
        : reject(
            new Error(
              data?.error || "Another window cannot save its work yet.",
            ),
          );
    };
    client.postMessage({ type: "PREPARE_RESTART", token }, [channel.port2]);
  });
}
async function restart(progress) {
  const state = await readState(),
    release = await manifest(state.pending);
  if (!release || !(await complete(release, progress)))
    throw new Error(
      "The update is incomplete. Download it again before restarting.",
    );
  const token = crypto.randomUUID();
  const windows = await courseWindows(release);
  try {
    // Every participant saves and locks its inputs. A missing or old client blocks
    // the transaction; it is never silently navigated and stripped of its work.
    await Promise.all(windows.map((client) => ask(client, token)));
    const current = await courseWindows(release);
    if (
      current.length !== windows.length ||
      current.some((c) => !windows.some((w) => w.id === c.id))
    )
      throw new Error("The open windows changed. Try restarting again.");
    state.previous = state.active;
    state.active = state.pending;
    state.saved = state.pendingSaved;
    state.pending = null;
    state.pendingSaved = false;
    // Reload the exact verified release, even if another version is published
    // meanwhile. The bounded transaction survives a worker process restart.
    await (
      await caches.open(META)
    ).put(
      RESTART_NAVIGATION,
      new Response(
        JSON.stringify({
          token,
          release: release.id,
          clients: windows
            .filter((client) => client.frameType !== "nested")
            .map((client) => client.id),
        }),
      ),
    );
    state.restartToken = token;
    await writeState(state);
    for (const client of windows)
      client.postMessage({ type: "COMMIT_RESTART", token });
  } catch (error) {
    for (const client of windows)
      client.postMessage({ type: "ABORT_RESTART", token });
    throw error;
  }
}
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      if (
        !keys.includes(META) &&
        keys.some(
          (name) =>
            name.startsWith(PREFIX) && !name.startsWith(PREFIX + "release-"),
        )
      )
        await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  const port = event.ports[0];
  if (!port || !event.source?.url.startsWith(BASE.href)) return;
  if (
    typeof event.data === "string" &&
    ["status", "download"].includes(event.data)
  ) {
    event.waitUntil(
      (async () => {
        try {
          if (event.data === "download") {
            if (operation || restarting)
              throw Error("Another download is in progress.");
            beginOperation();
            try {
              const response = await fetch(new URL("release.json", BASE), {
                cache: "no-store",
                signal: operation.signal,
              });
              if (!response.ok)
                throw Error("Could not check the current course.");
              const release = validateRelease(await response.json());
              await prepare(
                release,
                true,
                { postMessage: () => {} },
                operation.signal,
                null,
                release.id,
              );
            } finally {
              endOperation();
            }
          }
          const state = await readState(),
            release = await manifest(state.active);
          const saved =
            Boolean(state.saved && (await complete(release))) ||
            Boolean(await legacyResponse("index.html"));
          port.postMessage({
            done: true,
            saved,
            message: saved
              ? "The complete course is saved on this device."
              : "The course is not saved offline yet.",
          });
        } catch (error) {
          port.postMessage({
            done: true,
            saved: false,
            message: error.message + ". You can retry the download.",
          });
        }
      })(),
    );
    return;
  }
  event.waitUntil(
    (async () => {
      try {
        const data = event.data;
        let result;
        const progress = (value) => port.postMessage({ progress: value });
        if (data.type === "STATUS") {
          // A manual check must examine files after it was requested. Joining a
          // scan that read an early file before eviction can return an old result.
          // Wait for those scans, forwarding progress, then begin/join a new scan.
          if (data.fresh)
            await Promise.allSettled(
              [...verifying.values()].map(async (scan) => {
                scan.listeners.add(progress);
                try {
                  await scan.work;
                } finally {
                  scan.listeners.delete(progress);
                }
              }),
            );
          if (/^[a-f0-9]{64}$/.test(data.running))
            seen.set(event.source.id, data.running);
          result = await status(data.running, null, progress);
          await prune(progress);
        } else if (data.type === "REMEMBER_PAGE") {
          if (operation || restarting)
            throw new Error("A download or restart is already in progress.");
          beginOperation("remember");
          try {
            await pruning;
            await rememberPage(data.release, data.paths, operation.signal);
            result = {};
          } finally {
            endOperation();
            await broadcast({ type: "STATUS_CHANGED" });
          }
        } else if (data.type === "DOWNLOAD_PLAN") {
          result = await planDownload(data, port);
        } else if (data.type === "BACKGROUND_STARTED") {
          const job = await readDownload();
          if (!job || job.id !== data.id || !job.wanted)
            throw new Error("This download was cancelled or replaced.");
          await changeDownload(job.id, { state: "background", error: null });
          result = {};
        } else if (data.type === "FALLBACK_BACKGROUND") {
          const job = await readDownload();
          if (!job || job.id !== data.id || !job.wanted) {
            result = await downloadInfo();
          } else {
            await changeDownload(job.id, { foregroundOnly: true, error: null });
            const native = await nativeDownload(job);
            if (native) {
              if (!native.result) await native.abort();
              await receiveBackground({ registration: native }, "abort");
            } else await changeDownload(job.id, { state: "paused" });
            result = await downloadInfo();
            await broadcast({ type: "STATUS_CHANGED" });
          }
        } else if (data.type === "CANCEL") {
          await cancelDownload(data.id);
          result = {};
        } else if (data.type === "PREPARE") {
          if (!data.recogniseOnly) await interruptPageRetention();
          if (operation || restarting)
            throw new Error(
              "Another window is downloading or restarting. Wait for it to finish.",
            );
          beginOperation();
          let job;
          try {
            await pruning;
            operation.signal.throwIfAborted();
            validateRelease(data.release);
            const existing = await readDownload(),
              state = await readState();
            const retaining =
              !data.requestDownload &&
              !data.downloadId &&
              data.save &&
              data.release.id === data.running;
            // Older pages recognise complete running copies through PREPARE. That
            // best-effort promotion must not replace another update's selection,
            // even if the page checked status before a competing request began.
            if (retaining && data.recogniseOnly) {
              const protectedSelection =
                state.pending ||
                state.partial ||
                (state.active && state.active !== data.release.id) ||
                existing?.wanted ||
                (existing && existing.state !== "ready");
              // Recognition is verification-only. A cache eviction between the
              // page's presence check and this lock must never start a download.
              const verifiedCopy =
                !protectedSelection && (await complete(data.release, progress));
              if (verifiedCopy) {
                await (
                  await caches.open(cacheName(data.release.id))
                ).put(MANIFEST, new Response(JSON.stringify(data.release)));
                state.active = data.release.id;
                state.saved = true;
                await writeState(state);
              }
              result = await status(
                data.running,
                verifiedCopy ? data.release : null,
                progress,
              );
            } else if (
              retaining &&
              (state.pending ||
                (state.partial && state.partial !== data.release.id) ||
                (existing?.wanted && existing.release !== data.release.id))
            ) {
              // Older clients also use PREPARE for an explicit first save. Keep
              // that contract while protecting another selected/resumable update.
              result = await status(data.running, null, progress);
            } else {
              if (
                existing?.wanted &&
                !existing.foregroundOnly &&
                (await nativeDownload(existing))
              )
                throw new Error(
                  "The browser is already downloading this course.",
                );
              if (data.requestDownload || data.downloadId) {
                job = await newDownload(data.release, data);
                operationDownload = job.id;
                await changeDownload(job.id, {
                  state: "foreground",
                  error: null,
                });
              }
              state.partial = data.release.id;
              await writeState(state);
              await prepare(
                data.release,
                Boolean(data.save),
                port,
                operation.signal,
                job?.id,
                data.running,
              );
              if (job)
                await changeDownload(job.id, {
                  state: "ready",
                  wanted: false,
                  bytes: data.release.bytes,
                  error: null,
                });
              // prepare() has just verified every byte. Reuse that result for this
              // response instead of scanning the new release again. Later STATUS
              // requests still verify storage afresh to detect eviction.
              result = await status(data.running, data.release, () =>
                progress({
                  bytes: data.release.bytes,
                  total: data.release.bytes,
                }),
              );
            }
          } catch (failure) {
            if (job) await failDownload(job.id, failure);
            throw failure;
          } finally {
            endOperation();
            await broadcast({ type: "STATUS_CHANGED" });
          }
        } else if (data.type === "RESTART") {
          if (operation || restarting || (await downloadInfo()).download?.busy)
            throw new Error("Wait for the current operation to finish.");
          restarting = true;
          navigationGate = new Promise((resolve) => {
            releaseNavigation = resolve;
          });
          try {
            await pruning;
            await restart(progress);
            result = {};
          } finally {
            restarting = false;
            releaseNavigation();
          }
        } else if (data.type === "REMOVE") {
          if (operation || restarting || (await downloadInfo()).download?.busy)
            throw new Error(
              "Cancel the download or wait for the restart before removing files.",
            );
          beginOperation();
          try {
            await pruning;
            for (const name of await caches.keys())
              if (name.startsWith(PREFIX)) await caches.delete(name);
            await self.registration.unregister();
            await broadcast({ type: "OFFLINE_REMOVED" });
            result = {};
          } finally {
            endOperation();
          }
        } else throw new Error("Unsupported App status request");
        port.postMessage({ result });
      } catch (error) {
        port.postMessage({
          error:
            error.name === "AbortError"
              ? "Download cancelled. Verified files can be resumed."
              : error.message,
        });
      }
    })(),
  );
});
async function offlineNavigationResponse(request, state = {}) {
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  let previous;
  try {
    const referrer = new URL(request.referrer);
    if (
      referrer.origin === BASE.origin &&
      referrer.pathname.startsWith(BASE.pathname) &&
      referrer.href !== request.url
    )
      previous = referrer.href;
  } catch {
    /* A direct visit may have no previous course page. */
  }
  let pendingReady = false;
  try {
    pendingReady = Boolean(
      state.pendingSaved && (await complete(await manifest(state.pending))),
    );
  } catch {
    /* Recovery must work even when storage is unavailable. */
  }
  let saved = state.saved,
    unknownPage = false;
  try {
    saved ||= Boolean(await legacyResponse("index.html"));
    const release = await manifest(state.active || state.visited);
    const path = directoryIndex(
      new URL(request.url).pathname
        .slice(BASE.pathname.length)
        .replace(/^releases\/[a-f0-9]{64}\//, ""),
    );
    unknownPage = Boolean(
      saved && release && !release.files.some((file) => file.path === path),
    );
  } catch {
    /* Unavailable metadata must not prevent recovery. */
  }
  const title = pendingReady
    ? "Your saved update is ready"
    : unknownPage
      ? "This page isn’t in the saved course"
      : saved
        ? "This offline copy needs repair"
        : "This lesson isn’t saved offline";
  const explanation = pendingReady
    ? "The saved update has not been opened yet."
    : unknownPage
      ? "This address is not included in the offline copy."
      : saved
        ? "The saved files for this lesson are missing or incomplete."
        : "The whole course has not been saved for offline use.";
  const instruction = pendingReady
    ? "Return to a course page and open App status. Choose Restart to update to open the saved course."
    : unknownPage
      ? "Reconnect and try this address again, or return to a saved lesson."
      : saved
        ? "Reconnect, return to a course page and open App status. Choose Repair offline copy, or Update offline copy if a newer version is offered. Wait for “Downloaded and ready to use offline”."
        : "Reconnect, return to a course page and open App status. Choose Save offline copy, then wait for “Downloaded and ready to use offline” before disconnecting.";
  const backLink = `<a id="recovery-back"${previous ? ' class="primary"' : ""} href="${escape(previous || BASE.href)}">${previous ? "Back to previous lesson" : "Course overview"}</a>`;
  const retryLink = `<a${previous ? "" : ' class="primary"'} href="${escape(request.url)}">Try again</a>`;
  const fontFace = "";
  return new Response(
    `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="data:,"><title>${title} · this course</title>
<script>
try{const saved=localStorage.getItem('sml:theme');document.documentElement.dataset.theme=['light','dark'].includes(saved)?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch{}
// This page has no editable work, but must participate safely when another
// course window restarts a saved update. It cannot depend on cached scripts.
let restartToken,restartTimer;
function unlock(){clearTimeout(restartTimer);restartToken=null;document.body.inert=false;}
navigator.serviceWorker?.addEventListener('message',({data,ports})=>{
  if(data?.type==='PREPARE_RESTART'){
    if(restartToken||document.readyState!=='complete'){ports[0].postMessage({ready:false,error:'Wait for the recovery page to finish loading, then retry.'});return;}
    restartToken=data.token;document.body.inert=true;restartTimer=setTimeout(unlock,12000);ports[0].postMessage({ready:true});
  }
  if(data?.type==='ABORT_RESTART'&&data.token===restartToken)unlock();
  if(data?.type==='COMMIT_RESTART'&&data.token===restartToken)location.reload();
  if(data?.type==='OPEN_APP_STATUS'){
    const target=new URL(document.getElementById('recovery-back').href);target.searchParams.set('download','1');location.assign(target.href);
  }
});
</script>
<style>
${fontFace}
:root{color-scheme:light;--bg:#f7faf9;--ink:#193237;--muted:#536e71;--line:#d5e2e1;--accent:#146653}
:root[data-theme=dark]{color-scheme:dark;--bg:#142326;--ink:#e4efeb;--muted:#a7bfbd;--line:#3b5356;--accent:#a3ddc2}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;--bg:#142326;--ink:#e4efeb;--muted:#a7bfbd;--line:#3b5356;--accent:#a3ddc2}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.65 Plex,system-ui,sans-serif}header{border-bottom:1px solid var(--line);padding:20px max(20px,calc((100% - 720px)/2))}.brand{color:var(--ink);font-size:24px;font-weight:700;text-decoration:none}header small{display:block;color:var(--muted);font-size:14px}main{max-width:760px;padding:clamp(24px,6vw,48px) 20px;margin:auto}h1{font-size:clamp(30px,5vw,40px);line-height:1.2;margin:0 0 24px;max-width:24ch}p{max-width:64ch}nav{display:flex;flex-wrap:wrap;gap:12px;margin:32px 0}nav a{display:inline-block;min-height:48px;padding:10px 18px;border:1px solid var(--accent);border-radius:6px;color:var(--accent);text-underline-offset:4px}.primary{background:var(--accent);color:var(--bg);font-weight:650;text-decoration:none}:focus-visible{outline:3px solid var(--accent);outline-offset:4px}.instruction{border-top:1px solid var(--line);padding-top:24px}
</style></head><body><header><a class="brand" href="${escape(BASE.href)}">this course</a><small>Python runs on your device</small></header><main><h1>${title}</h1><p>${explanation}</p><nav aria-label="Continue reading">${previous ? backLink + retryLink : retryLink + backLink}</nav><p class="instruction">${instruction}</p></main></body></html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname))
    return;
  let path = directoryIndex(url.pathname.slice(BASE.pathname.length));
  // Metadata is network-only, including requests from legacy cached documents.
  if (path === "release.json" || path.endsWith("/release.json")) {
    event.respondWith(fetch(new Request(event.request, { cache: "no-store" })));
    return;
  }
  if (path === "sw.js" || path === "offline.js") return;
  const softNavigation =
    event.request.headers.get("X-Lab-Navigation") === "1" &&
    path.endsWith(".html") &&
    !path.startsWith("releases/");
  event.respondWith(
    (async () => {
      if ((event.request.mode === "navigate" || softNavigation) && restarting)
        await navigationGate;
      const pinned = path.match(/^releases\/([a-f0-9]{64})\/(.+)$/);
      const documentPin = url.searchParams.get("gpu-release");
      const explicit =
        pinned?.[1] ||
        (/^[a-f0-9]{64}$/.test(documentPin || "") ? documentPin : null);
      const topNavigation =
        softNavigation ||
        (event.request.mode === "navigate" &&
          event.request.destination === "document");
      const state = await readState().catch(() => ({}));
      let restartTarget;
      if (topNavigation) {
        try {
          const ticket = await (
            await caches.open(META)
          ).match(RESTART_NAVIGATION);
          const transaction = ticket ? await ticket.json() : null;
          if (
            transaction?.token === state.restartToken &&
            transaction?.release === state.active &&
            transaction?.clients.includes(
              event.replacesClientId || event.clientId,
            )
          )
            restartTarget = transaction.release;
        } catch {
          /* Reading online must also work when browser storage is unavailable. */
        }
      }
      if (topNavigation && !explicit && !restartTarget) {
        // Keep normal online visits fresh. Open lessons retain immutable assets;
        // this never reloads or activates another window.
        try {
          const response = await fetch(
            new Request(event.request, {
              cache: "no-store",
              signal: AbortSignal.timeout(8000),
            }),
          );
          if (response.status < 500) {
            // Buffer the small HTML body within the deadline so an interrupted
            // response can still fall back instead of leaving half a document.
            if (
              response.ok &&
              response.headers.get("Content-Type")?.includes("text/html")
            )
              await response.clone().arrayBuffer();
            return response;
          }
        } catch {
          /* Offline/unreachable host: use the retained course below. */
        }
      }
      // New course documents use immutable URLs for every runtime/source request.
      // Bare URLs belong to pre-migration pages and keep their complete old set.
      if (
        !pinned &&
        !explicit &&
        !restartTarget &&
        (!topNavigation || !state.saved)
      ) {
        const legacy = await legacyResponse(path);
        if (legacy)
          return mediaRangeResponse(event.request.headers.get("Range"), legacy);
      }
      if (!pinned && !explicit && !topNavigation) {
        // Pre-migration modules use bare paths; new modules use immutable URLs.
        // Never replace an old page's executable dependency with a new version.
        try {
          const response = await fetch(event.request);
          if (response.ok) return response;
        } catch {}
        const legacy = await legacyResponse(path);
        if (legacy) return legacy;
        return new Response(
          "This older page needs its original runner files. Reopen the course online.",
          { status: 503 },
        );
      }
      const id = explicit || restartTarget || state.active || state.visited;
      if (pinned) path = pinned[2];
      if (id) {
        const cache = await caches.open(cacheName(id)).catch(() => null);
        let cached = await cache?.match(new URL(path, BASE)).catch(() => null);
        if (cached && (event.request.mode === "navigate" || softNavigation)) {
          const original = (await manifest(id).catch(() => null))?.files.find(
            (file) => file.path === path,
          );
          if (original && !(await verified(cached.clone(), original))) {
            cached = null;
            invalidateVerification(id);
            await broadcast({ type: "STATUS_CHANGED" });
          }
        }
        if (cached)
          return mediaRangeResponse(event.request.headers.get("Range"), cached);
        if (
          topNavigation &&
          !explicit &&
          !restartTarget &&
          !state.saved &&
          state.visited &&
          state.visited !== id
        ) {
          const visited = await (
            await caches.open(cacheName(state.visited))
          ).match(new URL(path, BASE));
          if (visited) return visited;
        }
        // Missing assets from a selected release must never fall through to a
        // different root deployment. The immutable release URL may repair them.
        const release = await manifest(id).catch(() => null),
          file = release?.files.find((f) => f.path === path);
        let response;
        try {
          response = await fetch(new URL(`releases/${id}/${path}`, BASE), {
            cache: "no-store",
          });
        } catch (failure) {
          if (!file) throw failure;
        }
        if (file) {
          if (!response || !(await verified(response.clone(), file))) {
            // Pages may remove an older immutable directory. An unchanged file
            // from the live root is safe only when its original hash still matches.
            try {
              response = await fetch(new URL(path, BASE), {
                cache: "no-store",
              });
            } catch {
              /* Report unavailable bytes below. */
            }
            if (!response || !(await verified(response.clone(), file))) {
              invalidateVerification(id);
              await broadcast({ type: "STATUS_CHANGED" });
              return topNavigation
                ? offlineNavigationResponse(event.request, state)
                : new Response(
                    "This release file could not be verified. Reload the lesson online, or use App status to repair the saved copy.",
                    { status: 503, headers: { "Content-Type": "text/plain" } },
                  );
            }
            // A live alias has a different response URL. Strip it so relative
            // module/CSS imports still resolve against the requested release URL.
            response = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          }
          try {
            await cache?.put(new URL(path, BASE), response.clone());
          } catch {
            /* Optional on-demand cache; explicit downloads report storage errors. */
          }
        }
        if (topNavigation && !response?.ok)
          return offlineNavigationResponse(event.request, state);
        return mediaRangeResponse(event.request.headers.get("Range"), response);
      }
      try {
        const response = await fetch(event.request);
        return topNavigation && response.status >= 500
          ? offlineNavigationResponse(event.request, state)
          : response;
      } catch (error) {
        // Preserve old complete installations during the protocol migration.
        for (const name of await caches.keys()) {
          if (
            name.startsWith(PREFIX) &&
            name !== META &&
            !name.startsWith(PREFIX + "release-")
          ) {
            const response = await (
              await caches.open(name)
            ).match(new URL(path, BASE));
            if (response) return response;
          }
        }
        throw error;
      }
    })()
      .catch(async (failure) => {
        if (
          softNavigation ||
          (event.request.mode === "navigate" &&
            event.request.destination === "document")
        )
          return offlineNavigationResponse(
            event.request,
            await readState().catch(() => ({})),
          );
        throw failure;
      })
      .then((response) => {
        if (!softNavigation) return response;
        const headers = new Headers(response.headers);
        headers.set("X-Lab-Navigation", "1");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }),
  );
});
