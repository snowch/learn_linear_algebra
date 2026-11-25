// Copyright © 2026 Christopher Snow.
// Shared by the page, worker and build checks. Paths are always app-relative.
export function validateRelease(value) {
  if (
    !value ||
    value.schema !== 1 ||
    !/^[a-f0-9]{64}$/.test(value.id) ||
    !(value.commit === null || /^[a-f0-9]{40}$/.test(value.commit)) ||
    !(value.date === null || /^\d{4}-\d{2}-\d{2}$/.test(value.date)) ||
    !Array.isArray(value.files) ||
    !value.files.length ||
    value.files.length > 10000
  )
    throw new Error("Invalid release metadata");
  const paths = new Set();
  let total = 0;
  for (const file of value.files) {
    if (
      !file ||
      !/^(?:[a-zA-Z0-9_.+-]+\/)*[a-zA-Z0-9_.+-]+$/.test(file.path) ||
      file.path.split("/").some((p) => p === "." || p === "..") ||
      /^(releases\/|sw\.js$|release\.json$)/.test(file.path) ||
      paths.has(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error("Invalid release asset");
    paths.add(file.path);
    total += file.bytes;
  }
  if (
    !paths.has("index.html") ||
    total !== value.bytes ||
    !Number.isSafeInteger(total)
  )
    throw new Error("Invalid release size");
  return value;
}
export async function digest(data) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
