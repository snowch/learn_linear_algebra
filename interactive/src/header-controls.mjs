// Copyright © 2026 Christopher Snow.
// Official Material Symbols Rounded SVGs © Google, Apache-2.0.
// The accompanying header-controls.LICENSE.txt is bundled with this module.
const symbols = {
  light_mode: {
    viewBox: "0 -960 960 960",
    body: '<path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM80-440q-17 0-28.5-11.5T40-480q0-17 11.5-28.5T80-520h80q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440H80Zm720 0q-17 0-28.5-11.5T760-480q0-17 11.5-28.5T800-520h80q17 0 28.5 11.5T920-480q0 17-11.5 28.5T880-440h-80ZM480-760q-17 0-28.5-11.5T440-800v-80q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v80q0 17-11.5 28.5T480-760Zm0 720q-17 0-28.5-11.5T440-80v-80q0-17 11.5-28.5T480-200q17 0 28.5 11.5T520-160v80q0 17-11.5 28.5T480-40ZM226-678l-43-42q-12-11-11.5-28t11.5-29q12-12 29-12t28 12l42 43q11 12 11 28t-11 28q-11 12-27.5 11.5T226-678Zm494 495-42-43q-11-12-11-28.5t11-27.5q11-12 27.5-11.5T734-282l43 42q12 11 11.5 28T777-183q-12 12-29 12t-28-12Zm-42-495q-12-11-11.5-27.5T678-734l42-43q11-12 28-11.5t29 11.5q12 12 12 29t-12 28l-43 42q-12 11-28 11t-28-11ZM183-183q-12-12-12-29t12-28l43-42q12-11 28.5-11t27.5 11q12 11 11.5 27.5T282-226l-42 43q-11 12-28 11.5T183-183Zm297-297Z"/>',
  },
  dark_mode: {
    viewBox: "0 -960 960 960",
    body: '<path d="M480-120q-151 0-255.5-104.5T120-480q0-138 90-239.5T440-838q13-2 23 3.5t16 14.5q6 9 6.5 21t-7.5 23q-17 26-25.5 55t-8.5 61q0 90 63 153t153 63q31 0 61.5-9t54.5-25q11-7 22.5-6.5T819-479q10 5 15.5 15t3.5 24q-14 138-117.5 229T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Zm-10-270Z"/>',
  },
  cloud_download: {
    viewBox: "0 -960 960 960",
    body: '<path d="M440-474v-242q-76 14-118 73.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-48-22-89.5T600-680v-93q74 35 117 103.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260q-91 0-155.5-63T40-377q0-78 47-139t123-78q17-72 85-137t145-65q33 0 56.5 23.5T520-716v242l36-35q11-11 27.5-11t28.5 12q11 11 11 28t-11 28L508-348q-12 12-28 12t-28-12L348-452q-11-11-11.5-27.5T348-508q11-11 27.5-11.5T404-509l36 35Zm40-44Z"/>',
  },
  check: {
    viewBox: "0 -960 960 960",
    body: '<path d="m389-369 299-299q10.91-11 25.45-11Q728-679 739-668t11 25.58q0 14.58-10.61 25.19L415-292q-10.91 11-25.45 11Q375-281 364-292L221-435q-11-11-11-25.5t11-25.5q11-11 25.67-11 14.66 0 25.33 11l117 117Z"/>',
  },
  info: {
    viewBox: "0 0 24 24",
    body: '<path d="M11 17h2v-6h-2v6Zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Zm-1-11h2V7h-2v2Z"/>',
  },
};
const icon = (name) =>
  `<svg data-symbol="${name}" width="24" height="24" viewBox="${symbols[name].viewBox}" aria-hidden="true" focusable="false">${symbols[name].body}</svg>`;
const set = (node, name, value) => {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
};

/** Decorate existing controls; their handlers, storage and verified state stay native. */
export function mountHeaderControls({ statusOnly = false } = {}) {
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const offline =
    document.getElementById("app-status-open") ||
    (statusOnly && document.getElementById("status-open"));
  let theme = document.querySelector(
    "header #theme,header #theme-toggle,header .theme-toggle,header .theme-button",
  );
  let legacySelect;
  const resolved = () =>
    ["dark", "light"].includes(root.dataset.theme)
      ? root.dataset.theme
      : system.matches
        ? "dark"
        : "light";
  if (theme?.tagName === "SELECT") {
    legacySelect = theme;
    const originalLabel = theme.closest("label");
    const action = document.createElement("button");
    action.id = "header-theme-toggle";
    action.type = "button";
    (originalLabel || theme).before(action);
    const settings = document.createElement("label");
    settings.className = "header-theme-settings";
    settings.append("Theme preference ", theme);
    const disclosure = document.createElement("details");
    disclosure.className = "header-theme-disclosure";
    const heading = document.createElement("summary");
    heading.textContent = "Theme settings";
    disclosure.append(heading, settings);
    document.getElementById("app-status-details").before(disclosure);
    originalLabel?.remove();
    theme = action;
    theme.addEventListener("click", () => {
      legacySelect.value = resolved() === "dark" ? "light" : "dark";
      legacySelect.dispatchEvent(new Event("change", { bubbles: true }));
      render();
    });
  }
  if (!theme && offline) {
    theme = document.createElement("button");
    theme.id = "header-theme-toggle";
    theme.type = "button";
    offline.after(theme);
    const base = new URL(
      document.querySelector('meta[name="gpu-base"]')?.content || "./",
      location.href,
    );
    const key = base.pathname + ":header-theme";
    let preference;
    try {
      preference = sessionStorage.getItem(key) || localStorage.getItem(key);
    } catch {
      /* Works for this visit. */
    }
    const apply = (value) => {
      preference = ["dark", "light"].includes(value) ? value : undefined;
      root.dataset.theme = preference || (system.matches ? "dark" : "light");
      root.style.colorScheme = root.dataset.theme;
    };
    apply(preference);
    theme.addEventListener("click", () => {
      apply(resolved() === "dark" ? "light" : "dark");
      try {
        sessionStorage.setItem(key, preference);
        localStorage.setItem(key, preference);
      } catch {
        /* Keep the current visit usable. */
      }
    });
    system.addEventListener("change", () => {
      if (!preference) apply();
    });
  }
  if (theme && document.readyState !== "complete") {
    theme.disabled = true;
    addEventListener(
      "load",
      () => {
        theme.disabled = false;
      },
      { once: true },
    );
  }
  const header = offline?.closest("header") || theme?.closest("header");
  let queued = false;
  const schedule = () => {
    if (!queued) {
      queued = true;
      queueMicrotask(() => {
        queued = false;
        render();
      });
    }
  };
  function decorate(control, action, symbol, state = "none", description = "") {
    if (!control) return;
    for (const node of [...control.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        const label = document.createElement("span");
        label.hidden = true;
        node.replaceWith(label);
        label.append(node);
      }
    }
    control.classList.add("lab-header-control");
    control.dataset.headerAction = action;
    const visualKey = symbol + ":" + state;
    let visual = control.querySelector(":scope > .lab-header-visual");
    if (!visual || visual.dataset.key !== visualKey) {
      visual?.remove();
      visual = document.createElement("span");
      visual.className = "lab-header-visual";
      visual.setAttribute("aria-hidden", "true");
      visual.dataset.key = visualKey;
      visual.innerHTML =
        icon(symbol) +
        (state === "saved"
          ? `<span class="lab-header-badge" data-badge="saved">${icon("check")}</span>`
          : state === "update"
            ? '<span class="lab-header-badge" data-badge="update"></span>'
            : "");
      control.append(visual);
    }
    let caption = control.querySelector(":scope > .lab-header-label");
    if (!caption) {
      caption = document.createElement("span");
      caption.className = "lab-header-label";
      caption.setAttribute("data-header-label", "");
      caption.setAttribute("aria-hidden", "true");
      control.append(caption);
    }
    const captionText =
      action === "theme" ? "Theme" : statusOnly ? "App status" : "Offline";
    if (caption.textContent !== captionText) caption.textContent = captionText;
    const label =
      action === "theme"
        ? `Switch to ${resolved() === "dark" ? "light" : "dark"} theme`
        : statusOnly
          ? "App status"
          : "App status and offline access";
    set(control, "aria-label", label);
    set(control, "title", description ? label + ": " + description : label);
  }
  function render() {
    decorate(
      theme,
      "theme",
      resolved() === "dark" ? "light_mode" : "dark_mode",
    );
    if (!statusOnly && document.getElementById("app-status-summary"))
      set(offline, "aria-describedby", "app-status-summary offline-status");
    const state = offline?.dataset.offlineState || "none";
    const description = statusOnly
      ? ""
      : ["app-status-summary", "offline-status"]
          .map((id) =>
            document
              .getElementById(id)
              ?.textContent?.trim()
              .replace(/[.!?]+$/, ""),
          )
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(". ");
    decorate(
      offline,
      statusOnly ? "status" : "offline",
      statusOnly ? "info" : "cloud_download",
      state,
      description,
    );
  }
  const observer = new MutationObserver(schedule);
  if (header)
    observer.observe(header, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-offline-state", "aria-label", "title"],
    });
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
  system.addEventListener("change", schedule);
  render();
  if (offline) offline.disabled = false;
}
