// One persistent recovery dialog per reading window, shared by managed runtimes.
export function mountRuntimeRecovery({
  save,
  beforeOpen = () => document.activeElement,
  runLabel = "Run",
}) {
  const dialog = document.createElement("dialog");
  dialog.id = "runtime-recovery-dialog";
  dialog.className = "runtime-recovery-dialog";
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-labelledby", "runtime-recovery-title");
  dialog.setAttribute("aria-describedby", "runtime-recovery-description");
  dialog.innerHTML =
    '<h2 id="runtime-recovery-title" tabindex="-1" autofocus>Code runner files could not be loaded</h2><p id="runtime-recovery-description"></p><p id="runtime-recovery-dialog-error" role="alert" hidden></p><div class="runtime-recovery-actions"><button type="button" class="primary" data-runtime-reload>Reload lesson</button><button type="button" data-runtime-stay>Stay on lesson</button></div>';
  dialog.querySelector("#runtime-recovery-description").textContent =
    `Reload the lesson while online to load the current runner files. Your work is saved before reloading. Then choose ${runLabel}.`;
  document.body.append(dialog);
  const reloadButton = dialog.querySelector("[data-runtime-reload]"),
    stay = dialog.querySelector("[data-runtime-stay]"),
    error = dialog.querySelector('[role="alert"]');
  let origin,
    pending = false,
    waiting,
    sequence = 0,
    saving = false;
  function clearWait() {
    if (waiting) {
      waiting.node.removeEventListener("close", waiting.listener);
      waiting = null;
    }
  }
  function open() {
    if (dialog.open) return;
    const preferred = beforeOpen();
    const other = document.querySelector("dialog:modal");
    if (other && other !== dialog) {
      pending = true;
      clearWait();
      const listener = () => {
        waiting = null;
        if (pending) open();
      };
      waiting = { node: other, listener };
      other.addEventListener("close", listener, { once: true });
      return;
    }
    pending = false;
    clearWait();
    origin = preferred;
    error.hidden = true;
    error.textContent = "";
    dialog.showModal();
    dialog.querySelector("h2").focus({ preventScroll: true });
  }
  function close(restore = true) {
    pending = false;
    clearWait();
    sequence++;
    if (dialog.open) dialog.close();
    if (restore && origin?.isConnected) origin.focus({ preventScroll: true });
  }
  async function reload() {
    if (saving) return;
    open();
    const attempt = ++sequence;
    saving = true;
    error.hidden = true;
    reloadButton.disabled = true;
    reloadButton.textContent = "Saving work…";
    try {
      await save();
      if (attempt !== sequence || !dialog.open) return;
      reloadButton.textContent = "Reloading…";
      const url = new URL(location.href);
      url.searchParams.delete("gpu-release");
      url.searchParams.delete("download");
      if (url.href === location.href) location.reload();
      else location.assign(url.href);
    } catch (failure) {
      if (attempt === sequence && dialog.open) {
        error.textContent =
          "Reload cancelled: " +
          failure.message +
          " Keep this lesson open until your work can be saved or exported.";
        error.hidden = false;
      }
    } finally {
      saving = false;
      reloadButton.disabled = false;
      reloadButton.textContent = "Reload lesson";
    }
  }
  reloadButton.addEventListener("click", reload);
  stay.addEventListener("click", () => close());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey)
      return;
    const first = reloadButton.disabled ? stay : reloadButton;
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === dialog.querySelector("h2"))
    ) {
      event.preventDefault();
      stay.focus();
    } else if (!event.shiftKey && document.activeElement === stay) {
      event.preventDefault();
      first.focus();
    }
  });
  return { open, close, reload };
}
