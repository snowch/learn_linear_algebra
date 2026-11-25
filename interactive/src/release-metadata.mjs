// Copyright © 2026 Christopher Snow.
import { validateRelease } from "./release-contract.mjs";
// GitHub Pages uses a shared cache even for network-only browser requests.
export const MAX_METADATA_AGE = 600;
export async function readReleaseMetadata(
  response,
  { immutable = false } = {},
) {
  if (!response.ok) throw new Error("Release unavailable");
  const rawAge = response.headers.get("Age");
  if (rawAge !== null && !/^\d+$/.test(rawAge.trim()))
    throw new Error("Invalid release cache age");
  const age = Number(rawAge || 0);
  const directives = (response.headers.get("Cache-Control") || "")
    .split(",")
    .map((s) => s.trim());
  const lifetime = directives.find((s) => /^max-age=\d+$/i.test(s));
  const maxAge = lifetime ? Number(lifetime.split("=")[1]) : 0;
  if (
    !immutable &&
    age > 0 &&
    (!Number.isSafeInteger(age) ||
      !Number.isSafeInteger(maxAge) ||
      maxAge <= 0 ||
      maxAge > MAX_METADATA_AGE ||
      age >= maxAge)
  ) {
    throw new Error(
      "Published release metadata is stale or has an unbounded cache lifetime",
    );
  }
  return {
    release: validateRelease(await response.json()),
    cacheLifetime: !immutable && age > 0 ? maxAge : 0,
  };
}
