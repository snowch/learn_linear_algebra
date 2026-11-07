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

Opening the panel loads pinned Pyodide 0.27.7 from jsDelivr into a dedicated worker. Running an example loads SymPy or NumPy as needed. Code is generated from the current exploration state. Edited code occupies a separate workspace and does not mutate the diagram. Restore exploration values replaces the editor contents with the current example. Edits are stored per lesson. Navigation and progress imports never execute code.

Stop terminates the runtime; starting again creates a fresh one. Navigating to a different lesson stops an active execution. Startup times out after 90 seconds and execution after 60 seconds. Downloads require network access; visual exploration and course assessment do not depend on Python loading. Google Fonts is optional and has system fallbacks.

## Progress and privacy

The existing `basis-lab-v1` localStorage key is retained with schema version 2. Previously completed pilot lessons retain their completed status; existing exploration state and Python edits are preserved. New lessons require an experiment check plus two questions for completion. Progress records successful checks, rather than locking chapters or preventing later experimentation.

JSON export and import support moving progress between browsers. Import validates known states, merges completed checks, limits file/code size, and does not run Python. All saved state remains in the current browser; there are no analytics or application data APIs. Storage failures are surfaced so export remains available. Browser-local Python is not network-isolated: learner-authored Python may use browser networking APIs.

## Validation

- `npm test`: 18 mathematical/curriculum tests, including QR, pivoted LU, SVD, eigenvector and kernel identities for all 625 small integer 2 × 2 matrices. Also checks exact fractions, degenerate solution sets, projection properties, PCA centering, every scene, all challenge witnesses, prerequisites, and saved-state validation.
- `node scripts/verify-dom.mjs /absolute/path/to/linkedom-worker.mjs`: the complete 21-lesson interaction flow, all 63 checks without initializing Python, old-progress migration, search, mobile selection, navigation, reference, code restoration, worker controls, import/export, and reload persistence. The external testing utility is LinkeDOM 0.18.12; no test dependency is shipped to visitors.
- `node scripts/verify-course-python.mjs /absolute/path/to/pyodide-runtime`: all 21 generated Python examples and 39 edge cases through the actual application worker, plus SymPy/NumPy exact-fraction, SVD reconstruction, and PCA variance assertions. The directory needs the pinned core assets, lockfile, and SymPy, mpmath, and NumPy wheels from jsDelivr. The script substitutes local cached assets for runtime loading; it does not test browser networking.
- `node --check dist/app.js` and `node --check dist/python-worker.js`: syntax checks.

The managed environment did not expose the `cua_repl.js` browser tool required by Sites. Browser rendering and real assistive-technology behavior remain unverified; the DOM checks and real Wasm execution checks are distinct from a browser accessibility audit.

## Attribution

Course scope and the redesign are informed by [Chris Snow's Learn Linear Algebra](https://snowch.github.io/learn_linear_algebra/notebooks/00-start-here.html). Explanations, questions, diagrams, mathematical implementations, and code here are newly written. Original notebook text, plots, and source were not copied. The original course's quick reference and leftover topics are integrated into the new reference, matrix-arithmetic, projection, and least-squares material.

## GitHub Pages publication

The interactive version is published at https://snowch.github.io/learn_linear_algebra/interactive/ from `interactive/dist/` in `snowch/learn_linear_algebra`. The existing notebook book remains available at its original routes. The Pages workflow renders those notebooks from their stored outputs, tests the interactive course with Node 24, and includes the interactive assets in the same Pages artifact. The opaque `basis-lab-v1` storage/export identifier is retained for backward compatibility; the product name is Learn Linear Algebra.
