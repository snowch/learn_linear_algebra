# Learn Linear Algebra learner review

The review used the stated lesson prerequisites and followed the main route, all 21 lesson routes, experiment controls and results, interpretation and practice, Python, the quick reference, navigation and progress controls. Previously, essential explanations occupied a separate tab, the interface repeated headings and chapter markers, and the diagrams and results sometimes omitted the exact quantity the learner needed. Python could start just by opening its panel. A later lesson could display an earlier lesson’s Python output.

Each lesson now introduces the terms needed for its question, names the settings supplied by the lab, identifies the exact controls to use and asks about a named result. The diagram, result and explanation stay in the same flow. Optional disclosures cover diagram descriptions, Python, the quick reference and moving progress. Checks show when the current settings miss the experiment’s goal. Invalid fields, unsupported factorization inputs, Python errors and answers to the understanding questions have their own feedback. Diagram equations and captions state what the current calculation shows and provide a text result alongside the SVG.

## Functional verification

Chromium replayed the supplied settings and edits through the normal controls. Each row records the evidence inspected in the walkthrough.

| Lesson | Observed evidence |
| --- | --- |
| Vectors and linear combinations | Lowering coefficient a from 1 to 0 to −1 produced endpoints (3, 2), (2, 0) and (1, −2). |
| Matrix arithmetic | Reversing the product changed row 1, column 2 from 2 to 1. Transposing the diagonal A gave A again. |
| Matrix transformations | Collapse to a line changed the area scale from 1 to 0. |
| Span and dimension | The parallel and independent pairs reported dimensions 1 and 2. The independent pair reached (2, 1). |
| Gaussian elimination | Applying the instructed row addition gave [0, −5, −10] and retained (1, 2). Zero scaling left the rows intact. Undo restored the starting rows. |
| Solution sets | The starting lines met at (2, 1). The preset had infinitely many solutions and editing its right-hand side produced no solution. |
| Vector spaces | Shifting y = x by one moved both zero and the sample sum outside the set. |
| Linear dependence | Editing w changed its representation from u + v to 2u − v. |
| Basis and coordinates | Changing v changed the coordinates from (2, 1) to (1, 1) for the same target. |
| Subspaces | The parabola included zero. Scaling (1, 1) by 2 moved it outside the curve. |
| Homogeneous systems | The starter had nullity 1. The two parameter values selected different solutions. The identity had nullity 0. |
| Spaces of matrices | Changing c changed trace 3 to 0 and retained dimension 3. |
| Null, row and column spaces | Ax changed from (3, 3) to (0, 0) for the nonzero input (−2, 1). |
| Orthogonality | The new coordinates gave dot product 0 and angle 90°. |
| Projections | The projection changed from (2, 2) to (0, 0) with residual (1, −1). |
| Least squares | Selecting the best-fit line reduced SSE from 1.5 to 0.4. |
| Determinants | The determinant changed from 2 to −2 while the area scale stayed 2. |
| Eigenvalues | At 45° the candidate satisfied Av = 3v for the supplied matrix. |
| Matrix decompositions | Cholesky produced factors for the starting matrix and explained the unmet assumption for the rank-one matrix. |
| Singular value decomposition | Retaining one singular value gave rank limit 1 and Frobenius error 1. |
| PCA | Choosing the principal direction increased centered variance kept from 52.083% to 96.921%. |

All 21 lesson routes kept the essential instructions and explanations visible without page overflow in Chromium at 320 and 820 pixels with dark system preference and at 390 and 1440 pixels with light system preference. The lab uses its existing light color palette in both modes. Keyboard checks covered sliders, presets, row submission, focus after Apply and draft recovery. The DOM suite exercised all 21 experiment checks and all 42 understanding questions.

The browser ran the optional vector example through Pyodide and changed it to compute (1, −2) while the independent diagram stayed at (3, 2). Python output stayed in the originating lesson. The worker also ran all 21 generated Python examples and 39 edge cases using cached Pyodide packages. Saved-work tests exercised migration, reload, conflicting import, restoration, and recovery from a storage quota error without overwriting the durable draft.

## Evidence of learning

These checks establish that the content, controls, feedback and saved state behave as described. This review did not measure learner understanding or test physical devices or screen readers.
