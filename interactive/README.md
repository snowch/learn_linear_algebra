# Learn Linear Algebra — Interactive course

A browser-local course with 21 complete lessons, 21 interactive experiment challenges, 42 diagnostic questions, explanatory notes, prerequisites, and optional executable Python. The interface is designed around visual exploration. No lesson requires Python, a notebook, or a server-side calculation session.

## Course

1. Vectors and linear combinations
2. Matrix arithmetic, products, shapes, and transpose
3. Matrix transformations
4. Span and dimension
5. Gaussian elimination with exact fractions
6. Solution sets
7. Vector spaces
8. Linear dependence
9. Basis and coordinates
10. Subspaces
11. Homogeneous systems
12. Spaces of matrices
13. Null, row, and column spaces
14. Orthogonality and Gram–Schmidt
15. Orthogonal projections
16. Least squares and distance
17. Determinants
18. Eigenvalues, eigenvectors, and diagonalization
19. QR, pivoted LU, Cholesky, and eigendecomposition
20. Singular value decomposition and rank truncation
21. PCA and applications

A searchable sidebar, mobile chapter selector, prerequisite links, previous/next controls, and a mathematical/Python quick reference connect the lessons. Every lesson includes an experiment challenge and two questions with targeted hints and misconception-specific feedback. Equivalent mathematical results are accepted: elimination does not require one prescribed sequence, and basis challenges accept alternative valid bases.

## Run

Serve `dist/` using a static HTTP server. The Sites manifest points to that directory. Use HTTP(S), rather than `file://`, so ES modules and workers can load. There are no application dependencies or build steps. A modern browser with JavaScript, ES modules, SVG, BigInt, and Web Workers is required; WebAssembly is needed only for optional Python.

## Visual calculations

Most geometric experiments use real two-dimensional vectors and 2 × 2 matrices so their structure is visible. Explanations and questions explicitly generalize to rectangular matrices and higher dimensions. The matrix-space lab shows a three-dimensional parameter space using 2 × 2 matrix objects. Least squares uses five observations. PCA offers three datasets and lets learners compare centered covariance analysis with uncentered energy analysis.

The exact row-operation engine uses reduced BigInt fractions. Legal row operations, undo, and one-step suggestions preserve the system. Invalid zero scaling and same-row addition are rejected. History is bounded to 50 undo steps and oversized fractions are rejected with a recovery message. All remaining diagrams use JavaScript numerical routines; factor labels usually show three decimals, while reconstruction errors use unrounded factors. SVD handles rank-zero/rank-one inputs, repeated singular values, and reflections. Eigenvalue examples distinguish complex spectra and defective matrices. Cholesky explicitly rejects inputs that do not meet its assumptions.

## Optional Python

Open Python workspace to inspect the generated example. The first Run Python starts pinned Pyodide 0.27.7 from jsDelivr in a dedicated worker and loads the packages used by the program. The generated editor text follows the diagram settings until the learner edits it. Edits are saved per lesson and run separately from the diagram. Restore code from settings replaces the editor with a fresh example and saves a recovery copy of the previous draft. Results stay with the lesson and identify output from earlier code. Navigation and progress imports never execute code.

Stop terminates the runtime; starting again creates a fresh one. Navigating to a different lesson stops an active execution. Startup times out after 90 seconds and execution after 60 seconds. Downloads require network access; visual exploration and course assessment do not depend on Python loading. Google Fonts is optional and has system fallbacks.

## Progress and privacy

The existing `basis-lab-v1` localStorage key is retained with schema version 2. Previously completed pilot lessons retain their completed status; existing exploration state and Python edits are preserved. New lessons require an experiment check plus two questions for completion. Progress records successful checks, rather than locking chapters or preventing later experimentation.

JSON export and import support moving progress between browsers. Import validates known states, merges completed checks and fills untouched lessons while keeping conflicting local edits. All saved state remains in the current browser. Storage failures show a warning, preserve the previous saved snapshot and leave export available. Learner-authored Python can use browser networking APIs.

## Validation

- `npm test`: 18 mathematical/curriculum tests, including QR, pivoted LU, SVD, eigenvector and kernel identities for all 625 small integer 2 × 2 matrices. Also checks exact fractions, degenerate solution sets, projection properties, PCA centering, every scene, all challenge witnesses, prerequisites, and saved-state validation.
- `node scripts/verify-dom.mjs /absolute/path/to/linkedom-worker.mjs` exercises all 21 lesson routes and 63 checks, old-progress migration, search, mobile selection, navigation, the reference, Python worker controls, recovery after storage failure, merging progress, and reload persistence. CI installs LinkeDOM 0.18.12 for this check. The published site has no dependency on LinkeDOM.
- `node scripts/verify-course-python.mjs /absolute/path/to/pyodide-runtime`: all 21 generated Python examples and 39 edge cases through the actual application worker, plus SymPy/NumPy exact-fraction, SVD reconstruction, and PCA variance assertions. The directory needs the pinned core assets, lockfile, and SymPy, mpmath, and NumPy wheels from jsDelivr. The script substitutes local cached assets for runtime loading; it does not test browser networking.
- `node --check dist/app.js` and `node --check dist/python-worker.js`: syntax checks.

See the [learner review](learner-review.md) for the Chromium walkthrough and verification scope.

## Attribution

Course scope and the redesign are informed by [Chris Snow's Learn Linear Algebra](https://snowch.github.io/learn_linear_algebra/notebooks/00-start-here.html). Explanations, questions, diagrams, mathematical implementations, and code here are newly written. Original notebook text, plots, and source were not copied. The original course's quick reference and leftover topics are integrated into the new reference, matrix-arithmetic, projection, and least-squares material.

## GitHub Pages publication

The interactive version is published at https://snowch.github.io/learn_linear_algebra/interactive/ from `interactive/dist/` in `snowch/learn_linear_algebra`. The Pages workflow checks the interactive course with Node 24 and renders the original notebooks from their stored outputs for both pull requests and main. Successful main builds include both courses in the Pages deployment. The `basis-lab-v1` storage and export identifier is retained for backward compatibility.

## Self-hosted Python dependencies

Run `python tools/vendor-python.py` before serving `dist/`. The committed
checksum lock bundles Pyodide 0.27.7, NumPy, SymPy and mpmath inside this course.
The worker loads packages only from `dist/vendor/pyodide/`, with no CDN fallback.
Upstream licence files remain in the wheels and `PYODIDE-LICENSE`. Build-time
package downloads do not send learner code to a package service.
