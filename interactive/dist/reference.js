const entry=(term,rule,id)=>`<tr><th scope="row"><a href="#${id}">${term}</a></th><td>${rule}</td></tr>`;
export const quickReference=`<p>Real vectors and matrices are used unless a different field is stated. Matrix shapes, bases, and library conventions are part of the mathematics.</p>
<table class="reference-table"><thead><tr><th scope="col">Idea</th><th scope="col">Rule or interpretation</th></tr></thead><tbody>
${entry('Linear combination','a₁v₁ + ⋯ + aₖvₖ. Coefficients scale entire vectors.','vectors')}
${entry('Matrix shapes','(m × n)(n × p) gives m × p. AB applies B first.','matrices')}
${entry('Transpose','(AB)ᵀ = BᵀAᵀ. Rows and columns exchange roles.','matrices')}
${entry('Linear map','T(au + bv) = aT(u) + bT(v). In particular T(0) = 0.','transformations')}
${entry('Span','All linear combinations, using every allowed scalar—not just the slider range.','span')}
${entry('Independence','Ac = 0 has only c = 0 when the columns of A are independent.','dependence')}
${entry('Row operations','Swap rows; scale one by a nonzero value; add a multiple of a different row. Include the right-hand side.','elimination')}
${entry('Consistency','Ax = b is consistent exactly when rank(A) = rank([A | b]).','solutions')}
${entry('Uniqueness','A consistent system has a unique solution exactly when rank(A) equals its number of unknowns.','solutions')}
${entry('Vector space','A set with addition and scalar multiplication satisfying the vector-space axioms. Vectors can be functions or matrices.','vector-spaces')}
${entry('Basis','An ordered independent spanning set. Every vector has unique basis coordinates.','basis')}
${entry('Subspace','A nonempty subset closed under addition and scalar multiplication. Zero alone is not a sufficient test.','subspaces')}
${entry('Homogeneous system','Ax = 0 always has the zero solution. All of its solutions form null(A).','homogeneous')}
${entry('Matrix-space dimension','Real m × n matrices: mn. Symmetric real n × n matrices: n(n + 1)/2.','matrix-spaces')}
${entry('Rank–nullity','rank(A) + dim(null A) = number of columns of A.','nullspace')}
${entry('Column space','The reachable outputs: span of the original columns. Basis: original columns at pivot indices.','nullspace')}
${entry('Orthogonal complements','null(A) = row(A)⊥ in the input space; null(Aᵀ) = col(A)⊥ in the output space.','nullspace')}
${entry('Dot product and norm','u·v = Σuᵢvᵢ; ‖u‖ = √(u·u). The angle formula requires nonzero vectors.','orthogonality')}
${entry('Line projection','For v ≠ 0, projᵥ(u) = (u·v)/(v·v) v. The residual is orthogonal to v.','projections')}
${entry('Orthogonal projection','P² = P and Pᵀ = P. If Q has orthonormal columns, P = QQᵀ.','projections')}
${entry('Least squares','Minimize ‖Ax − b‖². Aᵀ(Ax̂ − b) = 0. Prefer QR/SVD solvers to explicit normal-equation inversion.','least-squares')}
${entry('2 × 2 determinant','ad − bc. Absolute value is area scale; sign records orientation.','determinants')}
${entry('Eigenvector','Av = λv with v ≠ 0. Negative λ reverses orientation; λ = 0 collapses the vector.','eigenvalues')}
${entry('Diagonalization','A = PDP⁻¹ requires an eigenbasis. Real symmetric A admits an orthonormal one.','eigenvalues')}
${entry('QR and pivoted LU','A = QR; in this course PA = LU. Check the permutation convention.','decompositions')}
${entry('Cholesky','A = LLᵀ for real symmetric positive-definite A.','decompositions')}
${entry('SVD','A = UΣVᵀ. Nonnegative singular values; orthogonal factors can rotate or reflect.','svd')}
${entry('Rank-k error','‖A − Aₖ‖²_F = sum of squared discarded singular values.','svd')}
${entry('PCA','Center the data. Right singular vectors give feature directions; variances are σᵢ²/(n − 1).','applications')}
</tbody></table>
<h3>Numbers and exactness</h3><p>ℤ denotes integers, ℚ rationals, ℝ reals, and ℂ complex numbers. The integers form a ring but not a field: division by a nonzero integer need not stay in ℤ. The rationals, reals, and complex numbers are fields. Finite fields exist for prime-power sizes; arithmetic there is different from real arithmetic. The visual labs here use real coordinates, and elimination stores exact rational fractions.</p>
<h3>Optional Python: the conventions that matter</h3><ul><li>SymPy <code>Matrix</code>: <code>A * B</code> is matrix multiplication; <code>A.T</code> is transpose; <code>A.rref()</code> returns a matrix and pivot indices.</li><li>NumPy arrays: <code>A @ B</code> is matrix multiplication; <code>A * B</code> is elementwise multiplication.</li><li>NumPy <code>svd</code> returns <code>U, s, Vh</code>. Reconstruct real reduced factors with <code>U @ np.diag(s) @ Vh</code>.</li><li>SymPy bases may differ from the normalized bases in the diagrams. Different valid bases describe the same subspace.</li><li>Diagram labels usually show three decimal places. Factorization checks use unrounded values. The optional exact examples construct rational values explicitly.</li></ul>
<h3>Keep exploring</h3><p>Change one assumption at a time. Ask what remains invariant, produce a counterexample, then connect the result to an equation. Your experiment checks accept equivalent mathematical results.</p>`;
