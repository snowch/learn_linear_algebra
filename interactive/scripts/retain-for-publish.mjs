// Copyright © 2026 Christopher Snow. Abort publication if older open lessons cannot be preserved.
import { readFile, writeFile } from "node:fs/promises";
import { retainLegacyAssets } from "./retain-legacy-assets.mjs";
import { retainPublishedReleases } from "./retain-releases.mjs";
const directory = process.argv[2] || "dist";
const release = JSON.parse(await readFile(directory + "/release.json", "utf8"));
release.legacyAssets = await retainLegacyAssets(
  directory,
  process.env.PUBLISHED_COURSE_URL,
  release,
);
release.retainedReleases = await retainPublishedReleases(
  directory,
  process.env.PUBLISHED_COURSE_URL,
  { currentId: release.id },
);
for (const name of ["release.json", "releases/" + release.id + "/release.json"])
  await writeFile(directory + "/" + name, JSON.stringify(release));
console.log(
  "Preserved",
  release.legacyAssets.length,
  "legacy assets and",
  release.retainedReleases.length,
  "prior releases.",
);
