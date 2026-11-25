import { requestPublished } from "./request-published.mjs";
// Keep exact bytes for open tabs while a newer course is published.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateRelease } from "../src/release-contract.mjs";
const matches = (bytes, file) =>
  bytes.length === file.bytes &&
  createHash("sha256").update(bytes).digest("hex") === file.sha256;
export async function retainPublishedReleases(
  directory,
  source,
  { keep = 2, fetcher = fetch, currentId } = {},
) {
  if (!source) return [];
  const base = new URL(source.endsWith("/") ? source : source + "/");
  const request = (path) => requestPublished(new URL(path, base), fetcher);
  const currentResponse = await request("release.json");
  if (currentResponse.status === 404) return [];
  if (!currentResponse.ok)
    throw Error(
      "Could not read the published release before retaining open-tab files.",
    );
  const current = validateRelease(await currentResponse.json());
  const history = current.retainedReleases ?? [];
  if (
    !Array.isArray(history) ||
    history.some((id) => !/^[a-f0-9]{64}$/.test(id))
  )
    throw Error("Invalid published release history.");
  const ids = [...new Set([current.id, ...history])]
    .filter((id) => id !== currentId)
    .slice(0, keep);
  for (const id of ids) {
    let release = current;
    if (id !== current.id) {
      const response = await request(`releases/${id}/release.json`);
      if (!response.ok)
        throw Error("Could not retain a previous release manifest.");
      release = validateRelease(await response.json());
      if (release.id !== id) throw Error("Previous release identity mismatch.");
    }
    // The first Python releases mistakenly required an empty publishing marker.
    // It is never a learner dependency. Keep every actual asset byte unchanged.
    release = validateRelease({
      ...release,
      files: release.files.filter(
        (file) =>
          !(
            file.path === ".nojekyll" &&
            file.bytes === 0 &&
            file.sha256 === createHash("sha256").update("").digest("hex")
          ),
      ),
    });
    const pending = [...release.files];
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(6, pending.length) }, async () => {
        while (pending.length) {
          const file = pending.shift();
          let bytes;
          try {
            const local = await readFile(`${directory}/${file.path}`);
            if (matches(local, file)) bytes = local;
          } catch {}
          if (!bytes) {
            let response = await request(`releases/${id}/${file.path}`);
            if (!response.ok && id === current.id)
              response = await request(file.path);
            if (!response.ok)
              throw Error(
                `Could not retain ${file.path} for an open lesson (HTTP ${response.status}).`,
              );
            bytes = Buffer.from(await response.arrayBuffer());
            if (!matches(bytes, file))
              throw Error(
                `Published file failed verification while retaining ${file.path}.`,
              );
          }
          const target = `${directory}/releases/${id}/${file.path}`;
          await mkdir(target.slice(0, target.lastIndexOf("/")), {
            recursive: true,
          });
          await writeFile(target, bytes);
        }
      }),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    await writeFile(
      `${directory}/releases/${id}/release.json`,
      JSON.stringify(release),
    );
  }
  return ids;
}
