# Offline access in Linear Algebra V2

Uses the [shared verified offline/update protocol](https://github.com/snowch/cuda-cpp-lab/blob/main/docs/offline-update-design.md). The only added header control is the App status/offline icon. Existing lessons, layout, navigation, runner controls and saved-work keys are preserved.

Save offline copy verifies every lesson and dependency by byte length and SHA-256 before reporting readiness. This includes optional Python, its pinned local packages, fonts, charts and worked examples. External documentation links require internet. Online visits remain current; checking versions does not download the course. Update offline copy stages a complete release and offers Restart to update. A failed/cancelled update preserves the verified previous copy and can resume.

Restart requires every open window to acknowledge a durable, read-back-verified snapshot. Active runs, file reads, text composition and unavailable storage veto restart. Preserve settings, code, notes, progress, genuine output and figures; restore without executing Python. Runtime-file failures use a persistent recovery dialog; Python exceptions stay with the editor. Removing course files preserves learner work and other apps.

Publication verifies the downloaded artifact, retains immutable releases and legacy aliases for open pages, and excludes the deployment marker from the promised offline files. Scope is this course's Pages path; Linear Algebra V2 does not cache the original book.

Tests cover cold offline startup and unvisited lessons, real Python, edited code, saved output, interruption/resumption, A→B updates, two-window busy/storage vetoes, repair, removal, path isolation and publication integrity. Browser checks do not prove learning effectiveness or physical-device storage retention.
