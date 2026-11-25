// Copyright © 2026 Christopher Snow.
import { saveReadingState } from "./experiment-state.mjs";
import { readReleaseMetadata } from "./release-metadata.mjs";
const $ = (id) => document.getElementById(id);
const base = new URL(
  document.querySelector('meta[name="gpu-base"]').content,
  location.href,
);
const running = document.querySelector('meta[name="gpu-release"]').content;
const dialog = $("app-status-dialog");
let registration,
  worker,
  latest,
  runningRelease,
  snapshot = {},
  checking,
  lastCheck = 0,
  checkingAbort,
  connecting,
  runningMetadata,
  retryingCheck = false;
let freshChecks = 0;
let downloading = false,
  cancelling = false,
  restarting = false,
  mode,
  removed = false,
  refreshGeneration = 0,
  cacheLifetime = 0;
let version = navigator.onLine
  ? "Checking for updates"
  : "Cannot check for updates";
const supported =
  "serviceWorker" in navigator && isSecureContext && "caches" in self;
let unavailable = !supported;
let remembered = false,
  remembering,
  connected = false;
let backgroundDownload,
  backgroundProgress,
  resumeWork,
  resumeTimer,
  downloadCancelled = false,
  localDownloadId,
  downloadWork,
  preparingRestart;
const progressSize = (n) => `${(n / 1000000).toFixed(1)} MB`;
const currentCourseDownloaded = () =>
  Boolean(
    snapshot.offlineReady && (!snapshot.active || snapshot.active === running),
  );
function error(message = "", source = "operation") {
  const element = $("app-status-error");
  if (element.textContent !== message) element.textContent = message;
  element.dataset.source = source;
  const owner = source.startsWith("download")
    ? $(
        mode === "update"
          ? "update-download-feedback"
          : "offline-download-feedback",
      )
    : $("app-status-feedback");
  if (element.parentElement !== owner) owner.append(element);
}
function render() {
  const focused = document.activeElement;
  const job = snapshot.download;
  const locked =
    Boolean(downloadWork || preparingRestart) ||
    downloading ||
    Boolean(job?.busy);
  const active =
    Boolean(preparingRestart) ||
    ((Boolean(downloadWork) || downloading) && !downloadCancelled) ||
    Boolean(job?.busy);
  const stopping = cancelling && active;
  const requested = Boolean(job?.wanted && job.state !== "ready");
  if (
    job &&
    !downloading &&
    !downloadWork &&
    $("app-status-error").dataset.source !== "download-start"
  )
    mode = job.mode;
  const progress = $("download-progress");
  const feedback = $(
    mode === "update"
      ? "update-download-feedback"
      : "offline-download-feedback",
  );
  // Move the single progress/cancel group only when its owning action changes.
  // Repeated status refreshes must preserve focus inside the group.
  if (progress.parentElement !== feedback) feedback.append(progress);
  progress.hidden = cancelling || !(active || requested);
  if (job && !downloading && !preparingRestart)
    showProgress({ bytes: job.bytes, total: job.total, stage: job.stage });
  const notice = $("download-behaviour");
  notice.textContent = job?.error
    ? ""
    : requested && !navigator.onLine
      ? "Waiting for a connection. Completed files are kept."
      : job?.state === "background"
        ? "Your browser can continue this download in the background."
        : preparingRestart || job?.state === "verifying"
          ? "All files must pass verification before the download is ready."
          : "Completed files are kept. Return here to resume if your browser pauses the download.";
  if (
    job?.error &&
    !downloading &&
    !downloadWork &&
    $("app-status-error").dataset.source !== "download-start"
  )
    error(job.error, "download");
  else if ($("app-status-error").dataset.source === "download") error("");
  if (
    $("app-status-error").dataset.source?.startsWith("download") &&
    $("app-status-error").parentElement !== feedback
  )
    feedback.append($("app-status-error"));
  const pending =
    snapshot.pending &&
    (snapshot.pending !== running || snapshot.active !== running);
  const relevantPending =
    pending && (!latest || snapshot.pending === latest.id);
  const available = latest && latest.id !== running;
  const ready = relevantPending && snapshot.pendingReady;
  const incomplete = available && snapshot.partial === latest.id;
  const transferring = active || requested || cancelling;
  const downloaded = currentCourseDownloaded();
  const otherCourseDownloaded = snapshot.offlineReady && !downloaded;
  const hasOfflineCopy = Boolean(snapshot.saved || snapshot.pendingSaved);
  const repair =
    hasOfflineCopy &&
    !downloaded &&
    !otherCourseDownloaded &&
    !available &&
    (!snapshot.active || snapshot.active === running);
  const offlineAction = repair
    ? "Repair offline copy"
    : hasOfflineCopy
      ? "Update offline copy"
      : "Save offline copy";
  const failedCheck = [
    "Cannot check for updates",
    "Couldn’t check for updates",
  ].includes(version);
  const offlineTransfer = transferring && mode === "offline";
  const verifying = Boolean(preparingRestart) || job?.state === "verifying";
  let status = stopping
    ? "Stopping download"
    : active
      ? verifying
        ? mode === "update"
          ? "Checking update"
          : "Checking download"
        : mode === "update"
          ? "Downloading update"
          : "Downloading course"
      : requested
        ? mode === "update"
          ? "Update download paused"
          : "Download paused"
        : ready
          ? "Update downloaded and checked"
          : incomplete
            ? "Update download incomplete"
            : version;
  if (!transferring && !ready && !available) {
    if (downloaded)
      status =
        version === "Up to date"
          ? "Up to date. Downloaded and ready to use offline."
          : "Downloaded and ready to use offline.";
    else if (otherCourseDownloaded && version === "Up to date")
      status = "Up to date online. The offline copy is a different version.";
    else if (!otherCourseDownloaded && (snapshot.saved || snapshot.partial))
      status =
        version === "Up to date"
          ? "Up to date. Offline download incomplete."
          : "Offline download incomplete";
    else if (version === "Up to date")
      status = "Up to date online. Not saved for offline use.";
  }
  const checkingCopy = freshChecks > 0 && hasOfflineCopy && !transferring;
  if (checkingCopy) status = "Checking saved copy";
  if (unavailable && hasOfflineCopy && !transferring && !checkingCopy)
    status = "Couldn’t verify the offline copy";
  // Keep the existing update/offline status slots for older pinned clients,
  // but expose one message under Course status in the current interface.
  $("version-status").textContent = status;
  $("course-ready-icon").toggleAttribute(
    "hidden",
    checkingCopy ||
      transferring ||
      Boolean(ready) ||
      Boolean(available) ||
      !downloaded ||
      version !== "Up to date",
  );
  $("offline-status").textContent = checkingCopy
    ? "Checking saved files"
    : offlineTransfer
      ? status
      : unavailable
        ? "Offline downloads are unavailable"
        : downloaded
          ? "Downloaded and ready to use offline."
          : otherCourseDownloaded
            ? "A different version is saved and ready to use offline."
            : ready
              ? "Downloaded update is ready after restarting."
              : snapshot.saved || snapshot.partial
                ? "Offline download incomplete"
                : "Not downloaded for offline use";
  $("offline-status").dataset.state =
    downloaded || otherCourseDownloaded ? "ready" : "unavailable";
  $("update-section").hidden = offlineTransfer;
  // A failed online check says nothing about offline availability. Keep that
  // fact visible when it is not already stated in the primary status.
  const primaryStatesOffline =
    downloaded ||
    ready ||
    (!otherCourseDownloaded && (snapshot.saved || snapshot.partial));
  const savedCopyAlongsideUpdate =
    available &&
    !transferring &&
    !ready &&
    (downloaded || otherCourseDownloaded);
  $("offline-section").hidden =
    !offlineTransfer &&
    !savedCopyAlongsideUpdate &&
    !(failedCheck && !transferring && !primaryStatesOffline);
  $("app-status-summary").textContent = checkingCopy
    ? "Checking saved copy"
    : ready
      ? "Update ready"
      : transferring
        ? status
        : available || relevantPending
          ? "Update available"
          : version === "Up to date"
            ? "Up to date online"
            : downloaded
              ? "Downloaded"
              : "Check version";
  $("app-status-details").hidden = transferring;
  $("install-help").hidden = transferring;
  $("download-update").hidden =
    locked ||
    !supported ||
    failedCheck ||
    (!available && (downloaded || ready)) ||
    Boolean(available && ready && snapshot.pending === latest.id);
  $("download-update").disabled =
    locked || Boolean(checking) || !(available ? latest : runningRelease);
  $("download-update").textContent = offlineAction;
  $("download-update").classList.toggle(
    "primary",
    !ready && (!available || hasOfflineCopy),
  );
  $("reload-online").hidden =
    !available || !navigator.onLine || Boolean(ready) || active;
  $("reload-online").disabled = locked || Boolean(checking);
  $("reload-online").classList.toggle("primary", !hasOfflineCopy);
  $("restart-update").hidden = !ready;
  $("later-update").hidden = !ready;
  $("restart-note").hidden = !ready;
  $("restart-update").disabled =
    restarting || locked || Boolean(checking) || checkingCopy;
  $("check-update").disabled = Boolean(checking);
  $("check-update").hidden = transferring;
  $("check-update").textContent = "Check for updates";
  $("retry-update").hidden =
    transferring || Boolean(ready) || !(failedCheck || retryingCheck);
  $("retry-update").disabled = Boolean(checking) || retryingCheck;
  $("retry-update").textContent = retryingCheck ? "Checking…" : "Retry";
  const release = runningRelease;
  $("retry-update").classList.toggle(
    "primary",
    $("download-update").hidden && $("restart-update").hidden,
  );
  $("offline-size").textContent = release
    ? otherCourseDownloaded
      ? `${progressSize(release.bytes)} for this version. Your saved offline copy remains available.`
      : repair
        ? `${progressSize(release.bytes)} for the complete course, including Python and statistics packages. Verified files are kept when repairing it.`
        : `${progressSize(release.bytes)} for the complete course, including Python and statistics packages. Save the offline copy before disconnecting.`
    : "Connect to check the download size.";
  $("offline-size").hidden =
    transferring ||
    Boolean(downloaded || ready || available) ||
    $("download-update").hidden;
  $("remove-offline").hidden =
    !supported ||
    !(
      snapshot.saved ||
      snapshot.partial ||
      snapshot.active ||
      snapshot.pending
    );
  const completeOfflineCopy = Boolean(
    snapshot.offlineReady || (snapshot.pendingReady && snapshot.pendingSaved),
  );
  $("remove-offline").textContent = completeOfflineCopy
    ? "Remove offline copy"
    : "Clear saved files";
  $("cancel-remove").textContent = completeOfflineCopy
    ? "Keep offline copy"
    : "Keep saved files";
  $("remove-offline").disabled = locked;
  const cacheNote = cacheLifetime
    ? ` The host may take up to ${Math.ceil(cacheLifetime / 60)} minutes to show a new deployment.`
    : "";
  $("version-detail").textContent =
    transferring || ready
      ? ""
      : !supported
        ? "This browser cannot prepare downloads. You can keep using this course online."
        : unavailable
          ? "Offline downloads are unavailable. Reopen App status to retry."
          : incomplete
            ? `Completed files are kept. Click ${offlineAction} to finish the download.`
            : available
              ? `Choose Reload latest course to read the new version online without downloading the full offline copy. ${hasOfflineCopy ? "The saved offline copy changes only when you update it." : "The complete course is not saved for offline use."} ${offlineAction} saves the complete course, including Python and statistics packages for offline use (${progressSize(latest.bytes)}). Your saved work is kept.`
              : version === "Cannot check for updates"
                ? "Connect to check for updates."
                : version === "Couldn’t check for updates"
                  ? "Couldn’t check for updates. Connect to the internet and retry."
                  : "";
  $("release-detail").textContent = latest
    ? `Published commit ${latest.commit?.slice(0, 7) || latest.id.slice(0, 7)}${latest.date ? " · " + latest.date : ""}. Offline copy size: ${progressSize(latest.bytes)}.${cacheNote}`
    : "";
  // State changes hide the previous action. Keep keyboard users at the next
  // useful control rather than dropping focus behind the modal.
  if (
    dialog.open &&
    dialog.contains(focused) &&
    !focused.getClientRects().length
  ) {
    const next =
      focused.id === "retry-update"
        ? $("course-status")
        : [
            "restart-update",
            "cancel-download",
            "download-update",
            "retry-update",
            "app-status-close",
          ]
            .map($)
            .find(
              (element) => element.getClientRects().length && !element.disabled,
            );
    next?.focus({ preventScroll: true });
  }
}
function rpc(type, data = {}, progress) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(
        new Error("Offline access unavailable. Reopen App status to retry."),
      );
      return;
    }
    const channel = new MessageChannel();
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          channel.port1.close();
          reject(
            new Error(
              "The operation did not respond. Reopen App status and retry.",
            ),
          );
        },
        ["PREPARE", "DOWNLOAD_PLAN"].includes(type) ? 30000 : 15000,
      );
    };
    reset();
    channel.port1.onmessage = ({ data }) => {
      if (data.progress) {
        reset();
        progress?.(data.progress);
        return;
      }
      clearTimeout(timer);
      channel.port1.close();
      data.error ? reject(new Error(data.error)) : resolve(data.result);
    };
    worker.postMessage({ type, running, ...data }, [channel.port2]);
  });
}
async function refresh(fresh = false) {
  if (!worker || removed) return;
  const generation = ++refreshGeneration;
  if (fresh) {
    freshChecks++;
    render();
  }
  try {
    let result = await rpc("STATUS", { fresh });
    // Installed older workers ignore fresh. Their first reply fences earlier
    // scans; the second check therefore examines files after this request.
    if (fresh && !result.freshVerification) result = await rpc("STATUS");
    if (!result.downloadVersion)
      result = { ...result, ...(await legacyInfo(result)) };
    if (generation !== refreshGeneration) return;
    result = await recoverCompletedUpdate(result);
    if (generation !== refreshGeneration) return;
    snapshot = result;
    unavailable = false;
    runningRelease ||= snapshot.runningRelease;
    render();
    remember();
  } catch (failure) {
    if (generation !== refreshGeneration) return;
    snapshot = { ...snapshot, offlineReady: false, pendingReady: false };
    unavailable = true;
    error(failure.message);
    render();
  } finally {
    if (fresh) {
      freshChecks--;
      render();
    }
  }
}
function completedUpdateNeedsRestart(state) {
  // Older installed workers can select a completed update before this pinned
  // page restarts. A finished, consented request identifies that exact release.
  const job = state.download;
  return (
    window === window.top &&
    !removed &&
    !restarting &&
    state.offlineReady &&
    state.active !== running &&
    !state.pending &&
    job?.state === "ready" &&
    job.mode === "update" &&
    !job.wanted &&
    state.downloadRelease?.id === state.active &&
    (job.running === running ||
      (localDownloadId && job.id === localDownloadId) ||
      latest?.id === state.active)
  );
}
async function recoverCompletedUpdate(state) {
  if (preparingRestart) return preparingRestart;
  if (
    downloadCancelled ||
    downloading ||
    downloadWork ||
    state.busy ||
    !completedUpdateNeedsRestart(state)
  )
    return state;
  snapshot = state;
  mode = "update";
  // save:false asks both older and current workers to prepare an explicit
  // restart. The already-saved complete copy retains its offline consent.
  // Use the worker's verified manifest, rather than selecting a newer download.
  preparingRestart = rpc(
    "PREPARE",
    { release: state.downloadRelease, save: false },
    showProgress,
  )
    .catch(async (failure) => {
      // Another tab may be preparing the same restart in the installed worker.
      const current = await rpc("STATUS");
      if (downloadCancelled || current.busy || current.pendingReady)
        return current;
      throw failure;
    })
    .then(async (result) =>
      result.downloadVersion
        ? result
        : { ...result, ...(await legacyInfo(result)) },
    )
    .finally(() => {
      preparingRestart = null;
      render();
    });
  showProgress({ bytes: 0, total: state.downloadRelease.bytes });
  render();
  return preparingRestart;
}
async function metadata(url, signal, options) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
    headers: { "Cache-Control": "no-cache" },
  });
  return readReleaseMetadata(response, options);
}
async function check(force = false) {
  if (checking)
    return checkingAbort?.signal.aborted
      ? checking.then(() => check(force))
      : checking;
  if (!force && Date.now() - lastCheck < 15000) return;
  if (!navigator.onLine) {
    latest = null;
    version = "Cannot check for updates";
    render();
    return;
  }
  lastCheck = Date.now();
  const abort = new AbortController();
  checkingAbort = abort;
  const timer = setTimeout(() => abort.abort(), 8000);
  const previousVersion = version;
  version = "Checking for updates";
  checking = (async () => {
    try {
      const url = new URL("release.json", base);
      url.searchParams.set("check", crypto.randomUUID());
      const result = await metadata(url, abort.signal);
      const release = result.release;
      if (checkingAbort !== abort || abort.signal.aborted) return;
      latest = release;
      cacheLifetime = result.cacheLifetime;
      if (release.id === running) runningRelease = release;
      version = release.id === running ? "Up to date" : "Update available";
    } catch {
      if (checkingAbort === abort) {
        if (abort.signal.reason === "hidden") {
          version =
            previousVersion === "Checking for updates"
              ? "Check for updates"
              : previousVersion;
          lastCheck = 0;
        } else {
          latest = null;
          cacheLifetime = 0;
          version = navigator.onLine
            ? "Couldn’t check for updates"
            : "Cannot check for updates";
        }
      }
    } finally {
      clearTimeout(timer);
      checking = null;
      render();
      if (completedUpdateNeedsRestart(snapshot)) refresh();
    }
  })();
  render();
  return checking;
}
function connect() {
  if (connecting) return connecting;
  connecting = (async () => {
    if (!supported) {
      render();
      return;
    }
    try {
      registration = await navigator.serviceWorker.register(
        new URL("sw.js", base),
        { scope: base.href, updateViaCache: "none" },
      );
      // Never activate a waiting worker over an unprepared legacy tab.
      if (
        registration.active &&
        !registration.active.scriptURL.endsWith("/sw.js")
      ) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            navigator.serviceWorker.removeEventListener(
              "controllerchange",
              changed,
            );
            reject(
              Error(
                "The previous offline worker is still changing. Reopen App status to retry.",
              ),
            );
          }, 15000);
          function changed() {
            if (registration.active?.scriptURL.endsWith("/sw.js")) {
              clearTimeout(timer);
              navigator.serviceWorker.removeEventListener(
                "controllerchange",
                changed,
              );
              resolve();
            }
          }
          navigator.serviceWorker.addEventListener("controllerchange", changed);
          changed();
        });
      }
      worker = registration.active;
      if (!worker) {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Offline access unavailable. Retry when browser storage is enabled.",
                  ),
                ),
              8000,
            ),
          ),
        ]);
        worker = registration.active;
      }
      removed = false;
      await refresh();
      connected = true;
      await remember();
      resumeDownloads();
    } catch (failure) {
      unavailable = true;
      error(failure.message);
      render();
    }
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}
async function remember() {
  if (
    window !== window.top ||
    remembering ||
    downloading ||
    restarting ||
    snapshot.busy ||
    !connected ||
    !worker ||
    !runningRelease ||
    removed ||
    document.readyState !== "complete"
  )
    return remembering;
  const prefix = new URL(`releases/${running}/`, base).href;
  const visited = new Set();
  // The lesson owns retention for its embedded editors too. Separate frame
  // requests can otherwise race the parent's explicit download operation.
  function collect(target) {
    try {
      const url = new URL(target.location.href);
      if (!url.href.startsWith(base.href)) return;
      visited.add(
        url.href.startsWith(prefix)
          ? url.href.slice(prefix.length).split(/[?#]/)[0]
          : url.pathname.slice(base.pathname.length) || "index.html",
      );
      for (const entry of target.performance.getEntriesByType("resource"))
        if (entry.name.startsWith(prefix))
          visited.add(entry.name.slice(prefix.length).split(/[?#]/)[0]);
      for (let index = 0; index < target.frames.length; index++)
        collect(target.frames[index]);
    } catch {
      /* Optional cross-origin frames cannot be retained by this course. */
    }
  }
  collect(window);
  const paths = [...visited];
  remembering = (async () => {
    // A verified saved running copy already contains this page. Avoid optional
    // writes/status broadcasts from every tab when reading the saved course.
    if (!remembered && !currentCourseDownloaded())
      await rpc("REMEMBER_PAGE", { release: runningRelease, paths });
    // Earlier updates cached the whole release without marking it available
    // offline. Recognise those copies through the existing worker protocol.
    // A visited-page cache with missing files must never trigger a book download.
    if (
      !snapshot.saved &&
      !snapshot.offlineReady &&
      !snapshot.busy &&
      !removed &&
      (!snapshot.active || snapshot.active === running)
    ) {
      const name = `linear-algebra-v2:${base.href}:release-${running}`;
      if (await caches.has(name)) {
        const cache = await caches.open(name);
        const present = new Set(
          (await cache.keys()).map((request) => request.url),
        );
        if (
          runningRelease.files.every((file) =>
            present.has(new URL(file.path, base).href),
          )
        ) {
          // Overlapping startup refreshes can leave the UI snapshot empty. Ask
          // the installed worker before promoting an old complete cache; never
          // overwrite an update that is already saved, pending or resumable.
          const current = await rpc("STATUS");
          if (
            !current.saved &&
            !current.offlineReady &&
            !current.busy &&
            !current.partial &&
            !current.pending &&
            !current.download?.wanted &&
            (!current.active || current.active === running)
          ) {
            const result = await rpc("PREPARE", {
              release: runningRelease,
              save: true,
              recogniseOnly: true,
            });
            ++refreshGeneration;
            snapshot = result;
            render();
          }
        }
      }
    }
    remembered = true;
  })()
    .catch(() => {
      // Storage is optional for normal online use; an explicit save/update reports
      // its own error. Never claim offline readiness for this best-effort cache.
    })
    .finally(() => {
      remembering = null;
    });
  return remembering;
}
// An already-installed worker can remain active until its last page closes.
// New pages keep the same durable request in that worker's existing metadata
// cache; the new worker can recover it when it activates naturally.
let legacyWrites = Promise.resolve();
async function legacyRequest() {
  const cache = await caches.open(
    `linear-algebra-v2:${base.href}:status-v1`,
  );
  const response = await cache.match(new URL("__download_request_v1__", base));
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
function legacyChange(id, patch) {
  const work = legacyWrites.then(async () => {
    const cache = await caches.open(
        `linear-algebra-v2:${base.href}:status-v1`,
      ),
      key = new URL("__download_request_v1__", base),
      current = await legacyRequest();
    if (id && current?.id !== id) return null;
    const fields = typeof patch === "function" ? patch(current) : patch;
    if (!fields) return current;
    const next = { ...current, ...fields };
    await cache.put(key, new Response(JSON.stringify(next)));
    return next;
  });
  legacyWrites = work.catch(() => {});
  return work;
}
async function legacyStart(release, mode, id) {
  if (id) {
    const job = await legacyRequest();
    if (!job?.wanted || job.id !== id)
      throw new Error("This download was cancelled or replaced.");
    return job;
  }
  const cache = await caches.open(
    `linear-algebra-v2:${base.href}:release-${release.id}`,
  );
  await cache.put(
    new URL("__release_manifest__", base),
    new Response(JSON.stringify(release)),
  );
  return legacyChange(null, {
    id: "linear-algebra-v2-" + crypto.randomUUID(),
    release: release.id,
    mode,
    save: true,
    wanted: true,
    state: "foreground",
    started: Date.now(),
    bytes: 0,
    cachedBytes: 0,
    total: release.bytes,
    error: null,
  });
}
async function legacyStop(id) {
  try {
    await legacyChange(id, (job) =>
      job && job.state !== "ready"
        ? { wanted: false, state: "paused", error: null }
        : null,
    );
  } catch (failure) {
    const job = await legacyRequest();
    if (!id || job?.id === id)
      await (
        await caches.open(`linear-algebra-v2:${base.href}:status-v1`)
      ).delete(new URL("__download_request_v1__", base));
    else throw failure;
  }
}
async function legacyInfo(status) {
  let job = await legacyRequest();
  if (!job) return { downloadVersion: 0, download: null };
  const response = await (
    await caches.open(
      `linear-algebra-v2:${base.href}:release-${job.release}`,
    )
  ).match(new URL("__release_manifest__", base));
  const release = response
    ? (await readReleaseMetadata(response, { immutable: true })).release
    : null;
  if (
    job.wanted &&
    ((status.pending === job.release && status.pendingReady) ||
      (status.active === job.release && status.offlineReady))
  )
    job = await legacyChange(job.id, {
      wanted: false,
      state: "ready",
      bytes: job.total,
      error: null,
    });
  return {
    downloadVersion: 0,
    downloadRelease: release,
    download: {
      ...job,
      busy: Boolean(job.wanted && status.busy),
      state: job.wanted ? (status.busy ? "foreground" : "paused") : job.state,
      stage: job.wanted && status.busy ? "unknown" : "verified",
    },
  };
}

function showProgress(value) {
  const stage = value.stage || "verified";
  if (stage === "unknown") {
    $("asset-progress").removeAttribute("value");
    $("download-progress-label").textContent = "Download in progress";
    $("offline-progress-text").textContent =
      "Waiting for download status. Completed files are kept.";
    return;
  }
  $("asset-progress").max = value.total;
  $("asset-progress").value = value.bytes;
  $("download-progress-label").textContent =
    stage === "downloaded"
      ? "Downloading files"
      : stage === "checking"
        ? "Checking saved files"
        : "Checking files";
  $("offline-progress-text").textContent =
    `${progressSize(value.bytes)} of ${progressSize(value.total)} ${stage === "downloaded" ? "downloaded" : "checked"}`;
}
// Native Background Fetch is optional: a visible page can take over a stalled job.
let backgroundHandoff,
  backgroundWatchdog,
  backgroundActivity = 0,
  backgroundBytes = -1;
function scheduleBackgroundWatch() {
  clearTimeout(backgroundWatchdog);
  backgroundWatchdog = setTimeout(checkNativeProgress, 5000);
}
async function checkNativeProgress() {
  clearTimeout(backgroundWatchdog);
  const transfer = backgroundDownload,
    job = snapshot.download;
  if (
    !transfer ||
    transfer.result ||
    !job?.wanted ||
    job.id !== transfer.id ||
    job.foregroundOnly ||
    downloadCancelled ||
    backgroundHandoff
  )
    return;
  if (transfer.downloaded !== backgroundBytes) {
    backgroundBytes = transfer.downloaded;
    backgroundActivity = Date.now();
  }
  if (
    document.visibilityState !== "visible" ||
    !navigator.onLine ||
    Date.now() - backgroundActivity < 45000
  ) {
    scheduleBackgroundWatch();
    return;
  }
  backgroundHandoff = (async () => {
    await rpc("FALLBACK_BACKGROUND", { id: job.id });
    if (downloadWork) await downloadWork;
    await refresh();
    const current = snapshot.download;
    if (
      !downloadCancelled &&
      current?.id === job.id &&
      current.wanted &&
      snapshot.downloadRelease
    )
      await download(current.mode === "offline", {
        release: snapshot.downloadRelease,
        id: job.id,
        foregroundOnly: true,
      });
  })()
    .catch((failure) => error(failure.message, "download-start"))
    .finally(() => {
      backgroundHandoff = null;
    });
  await backgroundHandoff;
}
async function watchBackground(id) {
  if (!registration.backgroundFetch) return;
  const transfer = await registration.backgroundFetch.get(id);
  if (!transfer) return;
  if (backgroundDownload?.id === id) return;
  if (backgroundDownload)
    backgroundDownload.removeEventListener("progress", backgroundProgress);
  backgroundDownload = transfer;
  backgroundBytes = transfer.downloaded;
  backgroundActivity = Date.now();
  backgroundProgress = () => {
    if (snapshot.download?.id !== id || snapshot.download.foregroundOnly)
      return;
    if (transfer.result) {
      clearTimeout(backgroundWatchdog);
      refresh();
      return;
    }
    if (transfer.downloaded !== backgroundBytes) {
      backgroundBytes = transfer.downloaded;
      backgroundActivity = Date.now();
    }
    const job = snapshot.download;
    snapshot.download = {
      ...job,
      state: "background",
      busy: true,
      stage: "downloaded",
      bytes: Math.min(job.total, job.cachedBytes + transfer.downloaded),
    };
    render();
    scheduleBackgroundWatch();
  };
  transfer.addEventListener("progress", backgroundProgress);
  backgroundProgress();
}
async function resumeDownloads() {
  if (resumeWork) return resumeWork;
  if (
    window !== window.top ||
    !connected ||
    removed ||
    restarting ||
    downloading ||
    !navigator.onLine ||
    document.visibilityState !== "visible"
  )
    return;
  resumeWork = (async () => {
    await refresh();
    if (backgroundHandoff) return;
    const job = snapshot.download;
    if (!job?.wanted) return;
    if (registration.backgroundFetch) await watchBackground(job.id);
    if (job.busy) {
      if (job.state === "planning") {
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(
          resumeDownloads,
          Math.max(300, 30000 - (Date.now() - job.started) + 300),
        );
      }
      return;
    }
    if (snapshot.downloadRelease)
      await download(job.mode === "offline", {
        release: snapshot.downloadRelease,
        id: job.id,
      });
  })()
    .catch((failure) => error(failure.message))
    .finally(() => {
      resumeWork = null;
    });
  return resumeWork;
}
function download(save, resume) {
  // Automatic resume and a button press can meet while metadata or retention
  // is pending. They must join one request rather than start competing jobs.
  if (downloadWork) return downloadWork;
  downloadCancelled = false;
  localDownloadId = undefined;
  mode = save ? "offline" : "update";
  error();
  downloadWork = performDownload(save, resume).finally(() => {
    downloadWork = null;
    render();
    if (!downloadCancelled && completedUpdateNeedsRestart(snapshot)) refresh();
  });
  render();
  return downloadWork;
}
async function performDownload(save, resume) {
  const release = resume?.release || (save ? runningRelease : latest);
  if (!release || downloading) return;
  if (connecting) await connecting;
  if (!connected) await connect();
  await runningMetadata;
  await remember();
  if (downloadCancelled) return;
  if (save && currentCourseDownloaded() && !resume) return;
  if (!worker || removed || unavailable) await connect();
  downloading = true;
  error();
  render();
  showProgress({ bytes: 0, total: release.bytes });
  let handled = false,
    downloadId = resume?.id;
  const request = {
    release,
    save: true,
    requestDownload: true,
    mode,
    downloadId,
  };
  try {
    if (snapshot.downloadVersion !== 1) {
      const job = await legacyStart(release, mode, downloadId);
      downloadId = job.id;
      localDownloadId = downloadId;
    }
    if (downloadCancelled) {
      if (snapshot.downloadVersion !== 1) await legacyStop(downloadId);
      handled = true;
      return;
    }
    if (
      snapshot.downloadVersion === 1 &&
      registration.backgroundFetch &&
      !resume?.foregroundOnly &&
      !(
        snapshot.download?.release === release.id &&
        snapshot.download.foregroundOnly
      )
    ) {
      const plan = await rpc("DOWNLOAD_PLAN", request, showProgress);
      if (plan.ready) {
        localDownloadId = plan.status.download?.id;
        ++refreshGeneration;
        snapshot = plan.status;
        unavailable = false;
        handled = true;
        return;
      }
      downloadId = plan.backgroundId;
      localDownloadId = downloadId;
      if (downloadCancelled) {
        await rpc("CANCEL", { id: downloadId });
        handled = true;
        return;
      }
      let native;
      try {
        native = await registration.backgroundFetch.get(downloadId);
        if (!native && !plan.existing)
          native = await registration.backgroundFetch.fetch(
            downloadId,
            plan.requests,
            {
              title: "this course course update",
              downloadTotal: plan.downloadTotal,
              icons: [
                {
                  src: new URL("icon.svg", base).href,
                  sizes: "any",
                  type: "image/svg+xml",
                },
              ],
            },
          );
      } catch (failure) {
        // Background permission or storage may be unavailable even when the API
        // exists. Preserve the same request and use the resumable page path.
        if (failure.name === "AbortError") {
          await rpc("CANCEL", { id: downloadId });
          throw failure;
        }
      }
      if (native || plan.existing) {
        if (native) {
          try {
            await rpc("BACKGROUND_STARTED", { id: downloadId });
          } catch {
            /* STATUS recovers a started browser job after a worker restart. */
          }
          await refresh();
          if (
            snapshot.download?.id !== downloadId ||
            (!snapshot.download.wanted && snapshot.download.state !== "ready")
          ) {
            await native.abort();
            handled = true;
            return;
          }
          await watchBackground(downloadId);
        } else await refresh();
        handled = true;
        return;
      }
    }
    const result = await rpc(
      "PREPARE",
      { ...request, downloadId },
      showProgress,
    );
    if (!result.downloadVersion) {
      await legacyChange(downloadId, {
        wanted: false,
        state: "ready",
        bytes: release.bytes,
        error: null,
      });
      snapshot = { ...result, ...(await legacyInfo(result)) };
    } else snapshot = result;
    localDownloadId ||= snapshot.download?.id;
    ++refreshGeneration;
    unavailable = false;
    runningRelease ||= snapshot.runningRelease;
    handled = true;
    error();
  } catch (failure) {
    // The Cancel handler owns its status refresh. Repeating full-course hash
    // scans here keeps the request lock alive after transfer has already stopped.
    if (downloadCancelled) return;
    if (snapshot.downloadVersion !== 1 && downloadId)
      await legacyChange(downloadId, (job) =>
        job?.wanted
          ? {
              state: "paused",
              wanted:
                !downloadCancelled &&
                !/match the release|could not be verified/.test(
                  failure.message,
                ),
              error: downloadCancelled ? null : failure.message,
            }
          : null,
      ).catch(() => {});
    await refresh();
    if (
      !downloadCancelled &&
      !(snapshot.download?.wanted === false && /abort/i.test(failure.message))
    )
      error(failure.message, "download-start");
  } finally {
    downloading = false;
    if (!handled && !downloadCancelled) await refresh();
    render();
  }
}
$("running-version").textContent = `Running build ${running.slice(0, 12)}`;
$("app-status-open").addEventListener("click", () => {
  dialog.showModal();
  check(true).finally(() => {
    if (worker && !removed) refresh(true);
  });
  if (!worker || removed) connect();
  else refresh(true);
});
$("app-status-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () =>
  $("app-status-open").focus({ preventScroll: true }),
);
const recheck = () => {
  check(true);
  refresh(true);
};
$("check-update").addEventListener("click", recheck);
$("retry-update").addEventListener("click", async () => {
  const button = $("retry-update"),
    hadFocus = document.activeElement === button;
  retryingCheck = true;
  try {
    await Promise.all([check(true), refresh(true)]);
  } finally {
    retryingCheck = false;
    render();
    // Disabling a focused button can move focus to body while the request runs.
    // Restore it only if the learner has not moved to another dialog control.
    if (
      hadFocus &&
      dialog.open &&
      (document.activeElement === document.body ||
        document.activeElement === button)
    )
      (button.hidden ? $("course-status") : button).focus({
        preventScroll: true,
      });
  }
});
$("download-update").addEventListener("click", () => {
  // Protect an explicitly saved course from automatic browser eviction where
  // supported. Storage permission does not interrupt or replace byte verification.
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* Saving still works without persistent-storage permission. */
  }
  download(!(latest && latest.id !== running));
});
$("cancel-download").addEventListener("click", async () => {
  downloadCancelled = true;
  cancelling = true;
  clearTimeout(resumeTimer);
  const id = downloading ? localDownloadId : snapshot.download?.id;
  render();
  try {
    try {
      if (snapshot.downloadVersion !== 1) await legacyStop(id);
    } finally {
      await rpc("CANCEL", { id: downloading ? undefined : id });
    }
    await refresh();
  } catch (failure) {
    error(failure.message);
  } finally {
    cancelling = false;
    render();
  }
});
$("later-update").addEventListener("click", () => dialog.close());
$("restart-update").addEventListener("click", async () => {
  error();
  restarting = true;
  $("restart-update").disabled = true;
  try {
    await remembering;
    await rpc("RESTART");
  } catch (failure) {
    error(failure.message);
  } finally {
    restarting = false;
    $("restart-update").disabled = false;
    await refresh();
  }
});
$("remove-offline").addEventListener("click", () => {
  $("remove-confirmation").hidden = false;
  $("cancel-remove").focus();
});
$("cancel-remove").addEventListener("click", () => {
  $("remove-confirmation").hidden = true;
  $("remove-offline").focus();
});
$("confirm-remove").addEventListener("click", async () => {
  try {
    await remembering;
    await rpc("REMOVE");
    snapshot = {};
    removed = true;
    $("remove-confirmation").hidden = true;
    error(
      "Downloaded files removed. Your experiment work and preferences have been kept.",
    );
    render();
    $("download-update").focus();
  } catch (failure) {
    error(failure.message);
  }
});
navigator.serviceWorker?.addEventListener("message", ({ data }) => {
  if (data?.type === "STATUS_CHANGED") refresh();
  if (data?.type === "DOWNLOAD_PROGRESS" && snapshot.download?.id === data.id) {
    snapshot.download = {
      ...snapshot.download,
      bytes: data.progress.bytes,
      stage: data.progress.stage,
      state:
        snapshot.download.state === "background"
          ? "verifying"
          : snapshot.download.state,
    };
    render();
  }
  if (data?.type === "OPEN_APP_STATUS") {
    if (!dialog.open) dialog.showModal();
    check(true);
    refresh(true);
  }
  if (data?.type === "OFFLINE_REMOVED") {
    snapshot = {};
    removed = true;
    render();
  }
});
addEventListener("online", () => {
  lastCheck = 0;
  check(true).finally(() => refresh(true));
  resumeDownloads();
});
addEventListener("offline", () => {
  checkingAbort?.abort("offline");
  latest = null;
  version = "Cannot check for updates";
  render();
});
addEventListener("focus", () => {
  check();
  refresh();
  resumeDownloads();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    check();
    refresh();
    resumeDownloads();
  } else {
    checkingAbort?.abort("hidden");
  }
});
setInterval(() => {
  if (document.visibilityState === "visible" && navigator.onLine) check();
}, 60000);
addEventListener("load", remember, { once: true });
render();
check();
connect();
// Running metadata is immutable and small; it is not a course download.
runningMetadata = metadata(
  new URL(`releases/${running}/release.json`, base),
  AbortSignal.timeout(8000),
  { immutable: true },
)
  .then(({ release: r }) => {
    if (r.id === running) {
      runningRelease = r;
      render();
      remember();
    }
  })
  .catch(() => {});

const downloadLink = new URL(location.href);
if (downloadLink.searchParams.get("download") === "1") {
  dialog.showModal();
  downloadLink.searchParams.delete("download");
  history.replaceState(history.state, "", downloadLink);
}

$("reload-online").onclick = async () => {
  const control = $("reload-online");
  control.disabled = true;
  control.textContent = "Saving work…";
  try {
    await saveReadingState();
    const url = new URL(location.href);
    url.searchParams.delete("gpu-release");
    url.searchParams.delete("download");
    if (url.href === location.href) location.reload();
    else location.assign(url.href);
  } catch (failure) {
    error("Reload cancelled: " + failure.message);
    control.disabled = false;
    control.textContent = "Reload latest course";
  }
};

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkNativeProgress();
});
