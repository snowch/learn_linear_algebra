// The activity order matches the controls and the result displayed by each lab.
export const experiments = {
  vectors: {
    purpose: 'A vector (x, y) describes a displacement: x units horizontally and y units vertically. A coefficient is a number that scales a vector. A linear combination adds the scaled vectors.',
    question: 'How does changing a coefficient affect the endpoint?',
    prepared: 'Start with v₁ = (1, 2), v₂ = (2, 0), and coefficients a = 1 and b = 1.',
    action: 'Read the endpoint in the Combination result. Move Coefficient a to 0, then to −1. Leave b at 1. The picture and result update as you move the slider.',
    compare: 'Which contribution disappears at a = 0? Which direction does the first contribution point at a = −1? Compare the three endpoints.',
    notes: 'Scaling and adding vectors'
  },
  matrices: {
    purpose: 'A matrix is a rectangular arrangement of numbers. Its shape counts rows first and columns second. The transpose swaps rows and columns.',
    question: 'Does reversing a matrix product change its entries?',
    prepared: 'The lab supplies a 2 × 2 stretch matrix A and shear matrix B and displays A × B.',
    action: 'Read the product, then choose B × A in Operation. Compare the entry in row 1, column 2. Next choose Transpose A to see the rows of A as columns.',
    compare: 'Which entry changes when you reverse the product? What does transposing this particular A change?',
    notes: 'Matrix shapes, products and transpose'
  },
  transformations: {
    purpose: 'A real 2 × 2 matrix maps every input vector to an output vector. Its columns give the outputs for (1, 0) and (0, 1). The determinant is a number computed from the entries. Its absolute value tells you how much the matrix scales area.',
    question: 'What happens to the plane when the two column arrows lie on the same line?',
    prepared: 'The lab starts with a shear matrix and input (1, 1).',
    action: 'Read Transformed vector and Area scale. In Transformation preset, choose Collapse to a line. Leave the input coordinates as they are.',
    compare: 'Compare the two column arrows and the area scales. Why does the collapsed grid cover no area?',
    notes: 'Columns, orientation and area'
  },
  span: {
    purpose: 'The span of two vectors contains every linear combination with real coefficients. The sliders show a limited selection. The shaded region depicts the whole span. Its dimension counts the independent directions.',
    question: 'Can both a line and a plane contain the target (2, 1)?',
    prepared: 'The lab starts with parallel vectors (1, 1) and (2, 2).',
    action: 'Read Span dimension, then choose Independent pair in Vector pair. Move Coefficient a to 2 and Coefficient b to 1 to compare the orange endpoint with the marked target.',
    compare: 'Which span contains the target? Give a reason the parallel pair cannot reach it, even with coefficients larger than the sliders allow.',
    notes: 'Span and independence'
  },
  elimination: {
    purpose: 'An augmented row holds an equation’s coefficients and its right-hand side. A row operation changes one or more whole rows, keeping the solutions when the operation is reversible.',
    question: 'How can you remove the first coefficient from Row 2 without changing the solution?',
    prepared: 'The lab supplies the exact rows [1, 2 | 5] and [2, −1 | 0].',
    action: 'In Operation choose Add a multiple of a row. Set Source row to Row 1, Target row to Row 2, and Multiplier to −2. Choose Apply operation. Inspect the new second row and the Solution result.',
    compare: 'Which entry becomes zero? Why does the right-hand side change? Compare the solution before and after, then use Undo last operation to replay the move.',
    notes: 'Reversible operations and echelon form'
  },
  solutions: {
    purpose: 'A solution satisfies every equation at once. Each nontrivial two-variable equation draws a line. A right-hand side is the number after the equals sign.',
    question: 'Can two systems with the same coefficient matrix have different solution sets?',
    prepared: 'The supplied lines intersect at one point.',
    action: 'In Solution-set preset choose Infinitely many. Read the Solution result. In Right-hand side b, change Row 2 from 4 to 3. Leave the coefficient matrix fixed.',
    compare: 'Compare the Solution result and both lines before and after editing b. Which result follows when the lines describe different parallel constraints?',
    notes: 'Consistency, rank and free variables'
  },
  'vector-spaces': {
    purpose: 'A set is closed under addition if adding two of its members always gives another member. For scaling, every real multiple of a member must stay in the set.',
    question: 'Does shifting a line up by one preserve closure?',
    prepared: 'Candidate set starts at y = x, with u at x = 1, v at x = 2, and scale 2.',
    action: 'Read the checks for Zero, u + v and c u. In Candidate set choose y = x + 1. Keep both x coordinates and the scale fixed.',
    compare: 'How does the location of zero change? Which sample sum lies outside the shifted line, and how does that one example settle the closure question?',
    notes: 'Vector spaces, closure and counterexamples'
  },
  dependence: {
    purpose: 'A dependence is a combination of vectors that equals zero with some coefficient nonzero. If w can be written using u and v, subtract w to get a dependence.',
    question: 'Which coefficients express a target using two independent vectors?',
    prepared: 'The lab supplies u = (1, 0), v = (0, 1), and target w = (1, 1).',
    action: 'In Target w, set x to 2 and y to −1. Keep the First vector u and Second vector v fixed. Read the displayed equation for w.',
    compare: 'How do the old and new coefficients differ? How can you rewrite the new equation so its right-hand side is zero?',
    notes: 'Finding a dependence relation'
  },
  basis: {
    purpose: 'A basis is an independent set that spans the space. Its coordinates are the unique coefficients that build a vector from the basis, in its stated order.',
    question: 'Can one point have two coordinate pairs?',
    prepared: 'The target w = (2, 1) is expressed in the standard basis (1, 0) and (0, 1).',
    action: 'In Second vector v, change x from 0 to 1. Keep Target w fixed and compare the equation for w.',
    compare: 'Why do the coefficients change while the target arrow stays at the same point?',
    notes: 'Coordinates in an ordered basis'
  },
  subspaces: {
    purpose: 'A subspace contains zero and stays closed under every real linear combination. A counterexample is one concrete choice that breaks a required property.',
    question: 'Is containing zero enough to make a subset a subspace?',
    prepared: 'The lab starts with the shifted line y = x + 1, u at x = 1 and scale c = 2.',
    action: 'Read the check for Zero. In Candidate set choose y = x² and leave x coordinate of u at 1 and Scale u by c at 2.',
    compare: 'Compare Zero and c u. Where does 2(1, 1) land relative to the curve? What does that example prove?',
    notes: 'The subspace test'
  },
  homogeneous: {
    purpose: 'A homogeneous system has right-hand side zero, so its solutions satisfy Ax = 0. The null space is that solution set; its dimension is the nullity.',
    question: 'When can a nonzero input solve a homogeneous system?',
    prepared: 'The supplied matrix has a line of solutions. The solution parameter scales a direction along this line and starts at 1.',
    action: 'Read x and nullity. Move First solution parameter to 0, then to 2. Choose Identity in Matrix preset and compare the result.',
    compare: 'How do parameter values move the solution on the line? Why does the identity leave only the zero solution?',
    notes: 'Rank, nullity and homogeneous solutions'
  },
  'matrix-spaces': {
    purpose: 'Here the objects are matrices. A symmetric 2 × 2 matrix has equal off-diagonal entries. Its trace is the sum of the two diagonal entries.',
    question: 'Can a nonzero symmetric matrix have trace zero?',
    prepared: 'Matrix family starts at Symmetric, with a = 1, b = 1 and c = 2.',
    action: 'Set Coefficient c to −1. Leave a and b at 1. Read Trace, Dimension, and the displayed matrix entries.',
    compare: 'Which entries change? Why is the matrix still symmetric? Does its new trace change the dimension of the whole symmetric family?',
    notes: 'Matrix families and free coefficients'
  },
  nullspace: {
    purpose: 'The null space contains inputs A sends to zero. The column space contains the outputs A can reach. The row space is the span of the rows of A in the input space.',
    question: 'Can a nonzero input have zero output?',
    prepared: 'The supplied matrix has both rows equal to (1, 2), and Input x = (1, 1).',
    action: 'In Input x, set x coordinate to −2 and y coordinate to 1. Read Ax and compare the input and output diagrams. Keep Matrix A fixed.',
    compare: 'Which input direction produces zero? Why does the output space still contain a line of other possible outputs?',
    notes: 'Null, row and column spaces'
  },
  orthogonality: {
    purpose: 'The dot product multiplies matching coordinates and adds those products. Two nonzero vectors are orthogonal when their dot product is zero; their angle is then 90°.',
    question: 'How do coordinates reveal a right angle?',
    prepared: 'The lab supplies u = (2, 1) and v = (1, 1).',
    action: 'In Vector v, set x to −1 and y to 2. Leave Input u fixed. Compare u · v and Angle across the two settings.',
    compare: 'Which two coordinate products cancel after the change? How does this agree with the diagram?',
    notes: 'Dot products, angles and Gram–Schmidt'
  },
  projections: {
    purpose: 'The orthogonal projection of u onto a line is the closest point on that line to u. The residual is the arrow from the projection to u.',
    question: 'Can a nonzero input project to the origin?',
    prepared: 'Input u starts at (3, 1). Line direction v starts at (1, 1).',
    action: 'In Input u, set x to 1 and y to −1. Keep Line direction v fixed. Compare the projected vector, Residual and Distance.',
    compare: 'Why does the nearest point become zero? How does the new distance relate to the length of u?',
    notes: 'Closest points and perpendicular residuals'
  },
  'least-squares': {
    purpose: 'A residual is the observed y minus the line’s predicted y. SSE is the sum of the squared residuals. The best-fit line minimizes SSE.',
    question: 'Which line has the smallest total squared vertical error?',
    prepared: 'The lab supplies five observations and a candidate with slope 0.5 and intercept 1.',
    action: 'Read SSE for the candidate. Choose Use the best-fit line. Compare the new SSE with Minimum SSE and inspect Best slope and intercept.',
    compare: 'How much does SSE fall? Why can the best-fit line still have a positive residual sum of squares?',
    notes: 'Least squares and residual distance'
  },
  determinants: {
    purpose: 'Label the top row (a, b) and the bottom row (c, d). The determinant is ad − bc. Its absolute value is the area multiplier. A negative determinant reverses orientation, turning a clockwise ordering into a counterclockwise one.',
    question: 'Can the same area multiplier preserve or reverse orientation?',
    prepared: 'The supplied matrix has determinant 2.',
    action: 'In Matrix A, change Row 1, column 1 from 2 to −2. Keep the other three entries fixed. Read det(A), Area scale and the orientation statement.',
    compare: 'How can the transformed unit square have the same area in the two diagrams while its orientation changes?',
    notes: 'Determinant, area and orientation'
  },
  eigenvalues: {
    purpose: 'An eigenvector is a nonzero vector whose image is the same vector multiplied by a number λ, its eigenvalue. A candidate arrow on an eigenline has that property.',
    question: 'Which direction stays on its own line after applying A?',
    prepared: 'The lab starts with the symmetric matrix [[2, 1], [1, 2]] and a candidate angle of 0°.',
    action: 'Read the candidate and its image. Set Candidate angle (degrees) to 45. Keep Matrix A fixed. Use the parallel arrows and the candidate result to judge alignment.',
    compare: 'Compare the candidate at 0° and 45°. At which angle is its image a multiple of the candidate?',
    notes: 'Eigenlines, real spectra and diagonalization'
  },
  decompositions: {
    purpose: 'A factorization writes a matrix as a product of structured matrices. Cholesky writes a real symmetric positive-definite matrix as LLᵀ, with L lower triangular. Positive definite means xᵀAx is positive for every nonzero x.',
    question: 'When can Cholesky reconstruct the input matrix?',
    prepared: 'The lab supplies a symmetric positive-definite matrix and displays QR first.',
    action: 'Choose Cholesky in Factorization and read the factors and Reconstruction error. Then choose Rank one in Matrix preset to test the same method on a different matrix.',
    compare: 'Why can the first input produce factors while rank one is outside Cholesky’s assumptions? The small reported error reflects numerical rounding.',
    notes: 'QR, pivoted LU, Cholesky and eigen decomposition'
  },
  svd: {
    purpose: 'The singular value decomposition writes A = UΣVᵀ. Singular values are the nonnegative stretch factors on the diagonal of Σ. The Frobenius error is the square root of the sum of squared entry differences.',
    question: 'What changes if you retain only the largest singular value?',
    prepared: 'The lab supplies diag(3, 1), retains both singular values and shows the final stage after applying U.',
    action: 'Set Singular values to retain from 2 to 1. Keep the final stage selected. Read Rank limit and Frobenius error and inspect the final shape.',
    compare: 'Why does the ellipse become a line? Which discarded singular value accounts for the reported error?',
    notes: 'Singular values and rank truncation'
  },
  applications: {
    purpose: 'Principal component analysis (PCA) finds directions of greatest variance. Centering subtracts each feature’s mean. The variance share measures spread captured along the retained directions.',
    question: 'How much centered variance can one direction retain?',
    prepared: 'The lab supplies the tilted point cloud, enables centering and keeps one component. The candidate starts at 0°.',
    action: 'Read Variance kept for 0°. Choose Use a principal direction. Compare the new Variance kept with Best 1D share. Keep the dataset, centering and component count fixed.',
    compare: 'Why does the rotated line keep more centered variance for these points? What would change for a cloud with equal variance in every direction?',
    notes: 'PCA, centering and variance'
  }
};
