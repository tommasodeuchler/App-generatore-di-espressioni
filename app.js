/**
 * Generatore di espressioni matematiche — Reverse Syntax Tree
 * Fasi 1–4. Logica pura, senza DOM.
 */

// ─── Utilità ───────────────────────────────────────────────────────────────

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const lerp = (a, b, t) => a + (b - a) * t;

const weightedPick = (items) => {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
};

const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

const normRational = (n, d) => {
  if (d === 0) throw new Error('Denominatore zero');
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};

const isPerfectSquare = (n) => {
  if (n < 0 || !Number.isInteger(n)) return false;
  const r = Math.sqrt(n);
  return r === Math.floor(r);
};

const isPerfectCube = (n) => {
  if (!Number.isInteger(n)) return false;
  const r = Math.round(Math.cbrt(n));
  return r >= 2 && r <= 15 && r ** 3 === n;
};

// ─── Configurazione livelli ────────────────────────────────────────────────

function getLevelConfig(level, phase = 1) {
  const clamped = Math.max(1, Math.min(10, level));
  const t = (clamped - 1) / 9;

  const cfg = {
    level: clamped,
    phase,
    minOps: Math.round(lerp(4, 15, t)),
    maxOps: Math.round(lerp(5, 20, t)),
    maxParenDepth: Math.round(lerp(1, 3, t)),
    maxNumber: Math.round(lerp(20, 999, t)),
    minNumber: 1,
    operatorWeights: {
      '+': lerp(4, 1.5, t),
      '-': lerp(3, 2, t),
      '*': lerp(1.5, 3.5, t),
      '/': lerp(1, 3, t),
    },
    powerWeight: phase >= 3 ? lerp(0.3, 2.5, t) : 0,
    sqrtWeight: phase >= 3 ? lerp(0.3, 2, t) : 0,
    negateWeight: phase >= 2 ? lerp(0.2, 2, t) : 0,
    fractionWeight: phase >= 4 ? lerp(0.5, 3, t) : 0,
  };

  if (phase >= 2) {
    cfg.minNumber = clamped >= 8 ? -Math.min(99, cfg.maxNumber) : 1;
  }

  return cfg;
}

// ─── Nodi dell'albero ──────────────────────────────────────────────────────

const NodeType = Object.freeze({
  NUMBER: 'number',
  RATIONAL: 'rational',
  BINARY: 'binary',
  GROUP: 'group',
  NEGATE: 'negate',
  POWER: 'power',
  SQRT: 'sqrt',
});

const BracketType = Object.freeze({
  ROUND: 'round',
  SQUARE: 'square',
  CURLY: 'curly',
});

const BRACKET_CHARS = {
  [BracketType.ROUND]: ['(', ')'],
  [BracketType.SQUARE]: ['[', ']'],
  [BracketType.CURLY]: ['{', '}'],
};

const BRACKET_ORDER = [BracketType.ROUND, BracketType.SQUARE, BracketType.CURLY];

function createNumberNode(value) {
  return { type: NodeType.NUMBER, value };
}

function createRationalNode(n, d) {
  const r = normRational(n, d);
  return { type: NodeType.RATIONAL, num: r.n, den: r.d };
}

function createBinaryNode(operator, left, right) {
  return { type: NodeType.BINARY, operator, left, right };
}

function createGroupNode(bracketType, child) {
  return { type: NodeType.GROUP, bracketType, child };
}

function createNegateNode(child) {
  return { type: NodeType.NEGATE, child };
}

function createPowerNode(child, exponent) {
  return { type: NodeType.POWER, child, exponent };
}

function createSqrtNode(child) {
  return { type: NodeType.SQRT, child };
}

// ─── Vincoli per fase ──────────────────────────────────────────────────────

const PhaseConstraints = {
  1: {
    name: 'Basi Solide',
    allowedOperators: ['+', '-', '*', '/'],
    minOperand: 1,
    maxOperand: 999,
    validateIntermediate(v) {
      return Number.isInteger(v) && v >= 0;
    },
    validateFinal(v) {
      return Number.isInteger(v) && v > 0;
    },
  },
  2: {
    name: 'Numeri Negativi',
    allowedOperators: ['+', '-', '*', '/'],
    minOperand: -999,
    maxOperand: 999,
    validateIntermediate(v) {
      return Number.isInteger(v);
    },
    validateFinal(v) {
      return Number.isInteger(v) && v > 0;
    },
  },
  3: {
    name: 'Potenze e Radici',
    allowedOperators: ['+', '-', '*', '/'],
    minOperand: -999,
    maxOperand: 999,
    validateIntermediate(v) {
      return Number.isInteger(v);
    },
    validateFinal(v) {
      return Number.isInteger(v) && v > 0;
    },
  },
  4: {
    name: 'Frazioni',
    allowedOperators: ['+', '-', '*', '/'],
    minOperand: -999,
    maxOperand: 999,
    validateIntermediateRational(r) {
      return r.d !== 0;
    },
    validateFinalRational(r) {
      return r.d === 1 && r.n > 0;
    },
  },
};

// ─── Aritmetica razionale ──────────────────────────────────────────────────

const rat = {
  fromInt(n) {
    return { n, d: 1 };
  },
  fromNode(node) {
    if (node.type === NodeType.RATIONAL) return { n: node.num, d: node.den };
    if (node.type === NodeType.NUMBER) return { n: node.value, d: 1 };
    throw new Error('Nodo non razionale');
  },
  add(a, b) {
    return normRational(a.n * b.d + b.n * a.d, a.d * b.d);
  },
  sub(a, b) {
    return normRational(a.n * b.d - b.n * a.d, a.d * b.d);
  },
  mul(a, b) {
    return normRational(a.n * b.n, a.d * b.d);
  },
  div(a, b) {
    if (b.n === 0) throw new Error('Divisione per zero');
    return normRational(a.n * b.d, a.d * b.n);
  },
  toNumber(r) {
    if (r.d === 0) throw new Error('Denominatore zero');
    if (r.n % r.d !== 0) throw new Error('Valore non intero');
    return r.n / r.d;
  },
};

// ─── Valutazione ───────────────────────────────────────────────────────────

function evaluateNode(node) {
  switch (node.type) {
    case NodeType.NUMBER:
      return node.value;
    case NodeType.RATIONAL:
      return rat.toNumber({ n: node.num, d: node.den });
    case NodeType.GROUP:
      return evaluateNode(node.child);
    case NodeType.NEGATE:
      return -evaluateNode(node.child);
    case NodeType.POWER: {
      const base = evaluateNode(node.child);
      return base ** node.exponent;
    }
    case NodeType.SQRT: {
      const v = evaluateNode(node.child);
      if (!isPerfectSquare(v)) throw new Error('Radice non perfetta');
      return Math.sqrt(v);
    }
    case NodeType.BINARY: {
      const left = evaluateNode(node.left);
      const right = evaluateNode(node.right);
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': {
          if (right === 0) throw new Error('Divisione per zero');
          const q = left / right;
          if (!Number.isInteger(q)) throw new Error('Divisione non intera');
          return q;
        }
        default:
          throw new Error(`Operatore sconosciuto: ${node.operator}`);
      }
    }
    default:
      throw new Error(`Tipo nodo sconosciuto: ${node.type}`);
  }
}

function evaluateRational(node) {
  switch (node.type) {
    case NodeType.NUMBER:
      return rat.fromInt(node.value);
    case NodeType.RATIONAL:
      return { n: node.num, d: node.den };
    case NodeType.GROUP:
      return evaluateRational(node.child);
    case NodeType.NEGATE: {
      const r = evaluateRational(node.child);
      return { n: -r.n, d: r.d };
    }
    case NodeType.POWER: {
      const base = evaluateNode(node.child);
      const val = base ** node.exponent;
      return rat.fromInt(val);
    }
    case NodeType.SQRT: {
      const r = evaluateRational(node.child);
      if (r.d !== 1 || !isPerfectSquare(r.n)) throw new Error('Radice non perfetta');
      return rat.fromInt(Math.sqrt(r.n));
    }
    case NodeType.BINARY: {
      const l = evaluateRational(node.left);
      const r = evaluateRational(node.right);
      switch (node.operator) {
        case '+': return rat.add(l, r);
        case '-': return rat.sub(l, r);
        case '*': return rat.mul(l, r);
        case '/': return rat.div(l, r);
        default:
          throw new Error(`Operatore razionale sconosciuto: ${node.operator}`);
      }
    }
    default:
      throw new Error(`Tipo nodo razionale sconosciuto: ${node.type}`);
  }
}

// ─── Analisi albero ────────────────────────────────────────────────────────

function countOperations(node) {
  if (node.type === NodeType.NUMBER || node.type === NodeType.RATIONAL) return 0;
  if (node.type === NodeType.GROUP) return countOperations(node.child);
  if (node.type === NodeType.NEGATE || node.type === NodeType.POWER || node.type === NodeType.SQRT) {
    return 1 + countOperations(node.child);
  }
  return 1 + countOperations(node.left) + countOperations(node.right);
}

function collectExpandableLeaves(node, parent = null, side = null, ancestors = [], out = []) {
  const chain = parent ? [...ancestors, parent] : ancestors;
  const insideSqrt = chain.some((a) => a.type === NodeType.SQRT);

  if (node.type === NodeType.NUMBER || node.type === NodeType.RATIONAL) {
    if (!insideSqrt) out.push({ node, parent, side });
    return out;
  }
  if (node.type === NodeType.GROUP || node.type === NodeType.NEGATE ||
      node.type === NodeType.POWER || node.type === NodeType.SQRT) {
    collectExpandableLeaves(node.child, node, 'child', chain, out);
    return out;
  }
  collectExpandableLeaves(node.left, node, 'left', chain, out);
  collectExpandableLeaves(node.right, node, 'right', chain, out);
  return out;
}

function collectBinaryNodes(node, out = []) {
  if (node.type === NodeType.BINARY) out.push(node);
  if (node.type === NodeType.GROUP || node.type === NodeType.NEGATE ||
      node.type === NodeType.POWER || node.type === NodeType.SQRT) {
    collectBinaryNodes(node.child, out);
  } else if (node.type === NodeType.BINARY) {
    collectBinaryNodes(node.left, out);
    collectBinaryNodes(node.right, out);
  }
  return out;
}

function getMaxGroupDepth(node) {
  if (node.type === NodeType.GROUP) return 1 + getMaxGroupDepth(node.child);
  if (node.type === NodeType.BINARY) {
    return Math.max(getMaxGroupDepth(node.left), getMaxGroupDepth(node.right));
  }
  if (node.type === NodeType.NEGATE || node.type === NodeType.POWER || node.type === NodeType.SQRT) {
    return getMaxGroupDepth(node.child);
  }
  return 0;
}

function replaceLeaf(leafRef, newNode, root) {
  if (leafRef.parent === null) return newNode;
  if (leafRef.parent.type === NodeType.GROUP || leafRef.parent.type === NodeType.NEGATE ||
      leafRef.parent.type === NodeType.POWER || leafRef.parent.type === NodeType.SQRT) {
    leafRef.parent.child = newNode;
  } else {
    leafRef.parent[leafRef.side] = newNode;
  }
  return root;
}

function getDeepestPath(node) {
  if (node.type === NodeType.NUMBER || node.type === NodeType.RATIONAL) {
    return [{ node, depth: 0 }];
  }
  if (node.type === NodeType.GROUP || node.type === NodeType.NEGATE ||
      node.type === NodeType.POWER || node.type === NodeType.SQRT) {
    return getDeepestPath(node.child).map((s) => ({ ...s, depth: s.depth + 1 }));
  }
  const leftPath = getDeepestPath(node.left).map((s) => ({ ...s, depth: s.depth + 1 }));
  const rightPath = getDeepestPath(node.right).map((s) => ({ ...s, depth: s.depth + 1 }));
  return leftPath.length >= rightPath.length ? leftPath : rightPath;
}

function validateTree(node, constraints, phase = 1) {
  const check = (n) => {
    if (n.type === NodeType.NUMBER) {
      return n.value >= constraints.minOperand && n.value <= constraints.maxOperand;
    }
    if (n.type === NodeType.RATIONAL) {
      return n.den !== 0 && Math.abs(n.num) <= 999 && n.den <= 999;
    }
    if (n.type === NodeType.GROUP) return check(n.child);
    if (n.type === NodeType.NEGATE) return check(n.child);
    if (n.type === NodeType.POWER) {
      if (![2, 3].includes(n.exponent)) return false;
      const base = phase === 4 ? rat.toNumber(evaluateRational(n.child)) : evaluateNode(n.child);
      if (base < 2 || base > 15) return false;
      return check(n.child);
    }
    if (n.type === NodeType.SQRT) {
      const r = phase === 4 ? evaluateRational(n.child) : rat.fromInt(evaluateNode(n.child));
      if (r.d !== 1 || !isPerfectSquare(r.n)) return false;
      return check(n.child);
    }
    if (n.type === NodeType.BINARY) {
      if (!constraints.allowedOperators.includes(n.operator)) return false;
      try {
        if (phase === 4) {
          const r = evaluateRational(n);
          if (!constraints.validateIntermediateRational(r)) return false;
        } else {
          const val = evaluateNode(n);
          if (!constraints.validateIntermediate(val)) return false;
        }
      } catch {
        return false;
      }
      return check(n.left) && check(n.right);
    }
    return false;
  };
  return check(node);
}

// ─── Espansioni inverse ────────────────────────────────────────────────────

function getFactors(n) {
  const abs = Math.abs(n);
  const factors = [];
  for (let a = 2; a <= Math.sqrt(abs); a++) {
    if (abs % a === 0) {
      factors.push([a, abs / a]);
      if (a !== abs / a) factors.push([abs / a, a]);
    }
  }
  return factors;
}

function getDivisors(n) {
  const abs = Math.abs(n);
  const divisors = [];
  for (let d = 2; d <= Math.min(abs, 50); d++) {
    if (abs % d === 0) divisors.push(d);
  }
  return divisors;
}

function inOperandRange(v, config, constraints) {
  return v >= Math.max(constraints.minOperand, config.minNumber) &&
         v <= Math.min(constraints.maxOperand, config.maxNumber);
}

function getExpansionCandidates(N, config, constraints, phase) {
  const { minNumber, maxNumber, operatorWeights } = config;
  const candidates = [];
  const minVal = Math.max(minNumber, constraints.minOperand);
  const maxVal = Math.min(maxNumber, constraints.maxOperand);

  const tryAdd = (op, left, right, lNode, rNode) => {
    if (!inOperandRange(left, config, constraints) || !inOperandRange(right, config, constraints)) return;
    candidates.push({
      operator: op,
      left: lNode || createNumberNode(left),
      right: rNode || createNumberNode(right),
      weight: operatorWeights[op],
    });
  };

  if (operatorWeights['+'] > 0) {
    const minA = Math.max(minVal, N - maxVal);
    const maxA = Math.min(maxVal, N - minVal);
    if (minA <= maxA) {
      for (let i = 0; i < 3; i++) {
        const a = randInt(minA, maxA);
        tryAdd('+', a, N - a);
      }
    }
  }

  if (operatorWeights['-'] > 0) {
    const minB = minVal;
    const maxB = Math.min(maxVal, maxVal - N);
    if (maxB >= minB) {
      for (let i = 0; i < 3; i++) {
        const b = randInt(minB, maxB);
        tryAdd('-', N + b, b);
      }
    }
    if (phase >= 2) {
      const minA = N + minVal;
      const maxA = maxVal;
      if (minA <= maxA) {
        const a = randInt(minA, maxA);
        tryAdd('-', a, a - N);
      }
    }
  }

  if (operatorWeights['*'] > 0 && N !== 0) {
    const absN = Math.abs(N);
    for (const [a, b] of getFactors(absN)) {
      if (N > 0) {
        if (inOperandRange(a, config, constraints) && inOperandRange(b, config, constraints)) {
          tryAdd('*', a, b);
        }
      }
      if (phase >= 2 && config.level >= 8) {
        if (inOperandRange(-a, config, constraints) && inOperandRange(-b, config, constraints)) {
          tryAdd('*', -a, -b);
        }
        if (inOperandRange(-a, config, constraints) && inOperandRange(b, config, constraints)) {
          tryAdd('*', -a, b);
        }
      }
    }
    if (Math.abs(N) <= maxVal && config.level <= 3) tryAdd('*', 1, N);
  }

  if (operatorWeights['/'] > 0 && N !== 0) {
    const absN = Math.abs(N);
    const maxB = Math.floor(maxVal / absN);
    if (maxB >= 2) {
      const b = randInt(2, Math.min(maxB, 12));
      tryAdd('/', N * b, b);
      if (phase >= 2 && N < 0) tryAdd('/', N * b, b);
    }
    for (const b of getDivisors(absN)) {
      const a = N * b;
      if (inOperandRange(a, config, constraints) && b >= 2) tryAdd('/', a, b);
    }
  }

  return candidates;
}

function tryNegateExpansion(leafRef, config, root) {
  if (config.negateWeight <= 0) return null;
  const N = leafRef.node.type === NodeType.NUMBER ? leafRef.node.value : null;
  if (N === null || N === 0) return null;
  const chance = config.level >= 8 ? 0.12 : 0.2;
  if (Math.random() > chance) return null;

  return replaceLeaf(leafRef, createNegateNode(createNumberNode(-N)), root);
}

function tryGroupedPowerSqrt(leafRef, config, root) {
  if (config.phase < 3 || config.level < 8) return null;
  const N = leafRef.node.value;
  if (typeof N !== 'number' || Math.random() > 0.45) return null;

  const bracket = config.maxParenDepth >= 3 ? BracketType.CURLY :
    config.maxParenDepth >= 2 ? BracketType.SQUARE : BracketType.ROUND;

  if (isPerfectSquare(N) && N >= 4) {
    const base = Math.sqrt(N);
    if (base >= 2 && base <= 15) {
      const grouped = createGroupNode(bracket, createNumberNode(base));
      return replaceLeaf(leafRef, createPowerNode(grouped, 2), root);
    }
  }

  const square = N * N;
  if (square <= config.maxNumber) {
    const grouped = createGroupNode(bracket, createNumberNode(square));
    return replaceLeaf(leafRef, createSqrtNode(grouped), root);
  }
  return null;
}

function tryPowerExpansion(leafRef, config, root) {
  if (config.powerWeight <= 0) return null;
  const N = leafRef.node.value;
  if (Math.random() > config.powerWeight / 3) return null;

  const exponents = config.level <= 3 ? [2] : [2, 3];
  const exp = pick(exponents);
  for (let base = 2; base <= 15; base++) {
    if (base ** exp === N) {
      return replaceLeaf(leafRef, createPowerNode(createNumberNode(base), exp), root);
    }
  }
  return null;
}

function trySqrtExpansion(leafRef, config, root) {
  if (config.sqrtWeight <= 0) return null;
  const N = leafRef.node.value;
  if (N < 0 || Math.random() > config.sqrtWeight / 3) return null;

  const square = N * N;
  if (square > config.maxNumber) return null;
  return replaceLeaf(leafRef, createSqrtNode(createNumberNode(square)), root);
}

function tryFractionExpansion(leafRef, config, root) {
  if (config.fractionWeight <= 0) return null;
  if (leafRef.node.type !== NodeType.NUMBER) return null;
  if (Math.random() > config.fractionWeight / 3) return null;

  const v = leafRef.node.value;
  if (v <= 0) return null;

  if (config.level <= 3) {
    const den = pick([2, 3, 4, 5, 6]);
    const num = pick([1, 2, 3]);
    const mult = (v * den) / num;
    if (!Number.isInteger(mult) || mult <= 0) return null;
    const newNode = createBinaryNode('*', createRationalNode(num, den), createNumberNode(mult));
    return replaceLeaf(leafRef, newNode, root);
  }

  const d1 = pick([2, 3, 4, 5, 6]);
  const d2 = pick([2, 3, 4, 5, 6, 7]);
  const n1 = randInt(1, d1 - 1);
  const n2 = randInt(1, d2 - 1);
  const r1 = normRational(n1, d1);
  const r2 = normRational(n2, d2);
  const sum = rat.add(r1, r2);
  const cancel = normRational(sum.d, sum.n);

  const sumNode = createBinaryNode(
    '+',
    createRationalNode(r1.n, r1.d),
    createRationalNode(r2.n, r2.d)
  );
  const block = createBinaryNode(
    '*',
    createBinaryNode('*', sumNode, createRationalNode(cancel.n, cancel.d)),
    createNumberNode(v)
  );
  return replaceLeaf(leafRef, block, root);
}

function injectPhase4Fractions(root, config) {
  const passes = config.level <= 3 ? 1 : randInt(1, 2);
  for (let i = 0; i < passes; i++) {
    const leaves = collectExpandableLeaves(root).filter(
      (l) => l.node.type === NodeType.NUMBER && l.node.value > 0
    );
    if (leaves.length === 0) break;
    const forced = { ...config, fractionWeight: 10 };
    const updated = tryFractionExpansion(pick(leaves), forced, root);
    if (updated !== null) root = updated;
  }
  return root;
}

function expandRandomLeaf(root, config, constraints, phase) {
  const leaves = collectExpandableLeaves(root);
  const expandable = leaves.filter(({ node }) => {
    if (node.type === NodeType.RATIONAL) return true;
    if (phase >= 2) return true;
    return node.value > 0;
  });
  if (expandable.length === 0) return false;

  const leafRef = pick(expandable);

  const specialFns = [
    () => (phase >= 4 ? tryFractionExpansion(leafRef, config, root) : null),
    () => (phase >= 3 && phase < 4 ? tryGroupedPowerSqrt(leafRef, config, root) : null),
    () => (phase >= 3 && phase < 4 ? trySqrtExpansion(leafRef, config, root) : null),
    () => (phase >= 3 ? tryPowerExpansion(leafRef, config, root) : null),
    () => (phase >= 2 ? tryNegateExpansion(leafRef, config, root) : null),
  ];

  for (const fn of specialFns) {
    const updated = fn();
    if (updated !== null) return updated;
  }

  if (leafRef.node.type !== NodeType.NUMBER) return false;

  const N = leafRef.node.value;
  const candidates = getExpansionCandidates(N, config, constraints, phase);
  if (candidates.length === 0) return false;

  const chosen = weightedPick(candidates.map((c) => ({ value: c, weight: c.weight })));
  const newNode = createBinaryNode(chosen.operator, chosen.left, chosen.right);
  return replaceLeaf(leafRef, newNode, root);
}

// ─── Parentesi ─────────────────────────────────────────────────────────────

function wrapSubtree(node, bracketType) {
  return createGroupNode(bracketType, node);
}

function bracketTypeForDepth(depth) {
  if (depth >= 3) return BracketType.CURLY;
  if (depth >= 2) return BracketType.SQUARE;
  return BracketType.ROUND;
}

function replaceNodeInTree(root, target, replacement) {
  if (target === root) return replacement;

  function replaceInTree(current, parent, side) {
    if (current === target) {
      if (parent.type === NodeType.GROUP || parent.type === NodeType.NEGATE ||
          parent.type === NodeType.POWER || parent.type === NodeType.SQRT) {
        parent.child = replacement;
      } else {
        parent[side] = replacement;
      }
      return true;
    }
    if (current.type === NodeType.GROUP || current.type === NodeType.NEGATE ||
        current.type === NodeType.POWER || current.type === NodeType.SQRT) {
      return replaceInTree(current.child, current, 'child');
    }
    if (current.type === NodeType.BINARY) {
      return replaceInTree(current.left, current, 'left') ||
             replaceInTree(current.right, current, 'right');
    }
    return false;
  }

  replaceInTree(root, null, null);
  return root;
}

function findParenWrapTarget(root) {
  const binaryNodes = collectBinaryNodes(root);
  if (binaryNodes.length === 0) return null;

  const path = getDeepestPath(root);
  const pathBinaries = path.filter((p) => p.node.type === NodeType.BINARY).map((p) => p.node);
  const preferOp = binaryNodes.filter((b) => b.operator === '/' || b.operator === '*');
  let target = pathBinaries[0] || pick(preferOp.length ? preferOp : binaryNodes);

  if (countOperations(target) < 1 && binaryNodes.length > 1) {
    target = pick(binaryNodes.filter((b) => countOperations(b) >= 1)) || target;
  }
  return target;
}

function findSmallestBinaryAncestor(root, descendant) {
  const path = [];

  function search(node) {
    if (node === descendant) return true;
    path.push(node);
    if (node.type === NodeType.GROUP || node.type === NodeType.NEGATE ||
        node.type === NodeType.POWER || node.type === NodeType.SQRT) {
      if (search(node.child)) return true;
    } else if (node.type === NodeType.BINARY) {
      if (search(node.left) || search(node.right)) return true;
    }
    path.pop();
    return false;
  }

  if (!search(root)) return null;
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].type === NodeType.BINARY) return path[i];
  }
  return null;
}

function unwrapToBinary(node) {
  let current = node;
  while (current.type === NodeType.GROUP) current = current.child;
  return current.type === NodeType.BINARY ? current : null;
}

function findOperandWrapTarget(anchor, levelIndex) {
  const binary = unwrapToBinary(anchor);
  if (!binary) return null;
  const side = levelIndex % 2 === 1 ? 'left' : 'right';
  return binary[side];
}

function applyParentheses(root, maxDepth) {
  if (maxDepth <= 0) return root;

  const bracketTypes = BRACKET_ORDER.slice(0, maxDepth);
  let anchor = null;

  for (let i = 0; i < bracketTypes.length; i++) {
    const bracketType = bracketTypes[i];
    let target;

    if (i === 0) {
      target = findParenWrapTarget(root);
    } else if (anchor) {
      target = findSmallestBinaryAncestor(root, anchor) ||
        findOperandWrapTarget(anchor, i);
    }

    if (!target) break;

    const wrapped = wrapSubtree(target, bracketType);
    root = target === root ? wrapped : replaceNodeInTree(root, target, wrapped);
    anchor = wrapped;
  }

  return root;
}

// ─── Rendering ─────────────────────────────────────────────────────────────

const OP_RAW = { '+': '+', '-': '-', '*': 'x', '/': ':' };
const OP_PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

const LATEX_BRACKETS = {
  [BracketType.ROUND]: ['\\left(', '\\right)'],
  [BracketType.SQUARE]: ['\\left[', '\\right]'],
  [BracketType.CURLY]: ['\\left\\{', '\\right\\}'],
};

function startsWithLeadingMinus(str) {
  return /^\s*-/.test(String(str).trim());
}

function subtreeContainsRational(node) {
  if (node.type === NodeType.RATIONAL) return true;
  if (node.type === NodeType.GROUP || node.type === NodeType.NEGATE ||
      node.type === NodeType.POWER || node.type === NodeType.SQRT) {
    return subtreeContainsRational(node.child);
  }
  if (node.type === NodeType.BINARY) {
    return subtreeContainsRational(node.left) || subtreeContainsRational(node.right);
  }
  return false;
}

function isSimpleAdditive(node) {
  if (node.type === NodeType.NUMBER) return true;
  if (node.type === NodeType.BINARY && (node.operator === '+' || node.operator === '-')) {
    return isSimpleAdditive(node.left) && isSimpleAdditive(node.right);
  }
  return false;
}

function roundGroupRedundant(child) {
  if (child.type === NodeType.NUMBER || child.type === NodeType.RATIONAL) return true;
  if (child.type === NodeType.BINARY && (child.operator === '+' || child.operator === '-')) return true;
  return false;
}

function needsPrecedenceParens(child, parentOp) {
  if (child.type === NodeType.GROUP || child.type === NodeType.NEGATE ||
      child.type === NodeType.POWER || child.type === NodeType.SQRT ||
      child.type === NodeType.RATIONAL) return false;
  if (child.type === NodeType.BINARY) {
    return OP_PRECEDENCE[child.operator] < OP_PRECEDENCE[parentOp];
  }
  return false;
}

function needsSignProtection(str, node, parentOp) {
  if (!parentOp) return false;
  if (node.type === NodeType.NEGATE) {
    if (node.child.type === NodeType.NUMBER) return node.child.value > 0;
    return true;
  }
  if (node.type === NodeType.NUMBER && node.value < 0) return true;
  return startsWithLeadingMinus(str);
}

function wrapRawParens(str) {
  const inner = String(str).trim();
  if (inner.startsWith('(') && inner.endsWith(')')) return inner;
  return `( ${inner} )`;
}

function wrapLatexParens(str) {
  const inner = String(str).trim();
  if (/^\\left\s*\(/.test(inner) && /\\right\s*\)\s*$/.test(inner)) return inner;
  return `\\left( ${inner} \\right)`;
}

function protectOperand(str, node, parentOp, latex = false) {
  if (!needsSignProtection(str, node, parentOp)) return str;
  return latex ? wrapLatexParens(str) : wrapRawParens(str);
}

function canUseLatexFrac(left, right) {
  if (subtreeContainsRational(left) || subtreeContainsRational(right)) return false;
  if (left.type === NodeType.GROUP || right.type === NodeType.GROUP) return false;
  if (left.type === NodeType.RATIONAL || right.type === NodeType.RATIONAL) return false;
  if (left.type === NodeType.NEGATE || right.type === NodeType.NEGATE) return false;
  if (left.type === NodeType.POWER || right.type === NodeType.POWER) return false;
  if (left.type === NodeType.SQRT || right.type === NodeType.SQRT) return false;
  return isSimpleAdditive(left) && isSimpleAdditive(right);
}

function peelRedundantRoundGroups(node) {
  let current = node;
  while (current.type === NodeType.GROUP && current.bracketType === BracketType.ROUND) {
    if (roundGroupRedundant(current.child)) return current.child;
    if (current.child.type === NodeType.GROUP && current.child.bracketType === BracketType.ROUND) {
      current = current.child;
      continue;
    }
    break;
  }
  return current;
}

function formatRawNumber(n) {
  return String(n);
}

function toRawString(node, parentOp = null) {
  if (node.type === NodeType.NUMBER) {
    const s = formatRawNumber(node.value);
    if (node.value < 0 && (parentOp === '+' || parentOp === '-' || parentOp === '*' || parentOp === '/')) {
      return wrapRawParens(s);
    }
    return s;
  }
  if (node.type === NodeType.RATIONAL) {
    return `${node.num} / ${node.den}`;
  }
  if (node.type === NodeType.GROUP) {
    const effective = node.bracketType === BracketType.ROUND
      ? peelRedundantRoundGroups(node) : node;
    if (effective !== node) return toRawString(effective, parentOp);
    const childStr = toRawString(node.child, null);
    if (node.bracketType === BracketType.ROUND && roundGroupRedundant(node.child)) {
      return childStr;
    }
    const [open, close] = BRACKET_CHARS[node.bracketType];
    return `${open} ${childStr} ${close}`;
  }
  if (node.type === NodeType.NEGATE) {
    const inner = toRawString(node.child, null);
    let s;
    if (node.child.type === NodeType.NUMBER) {
      s = formatRawNumber(-node.child.value);
    } else if (node.child.type === NodeType.GROUP) {
      s = `- ${inner}`;
    } else {
      s = `- ${wrapRawParens(inner)}`;
    }
    return protectOperand(s, node, parentOp, false);
  }
  if (node.type === NodeType.POWER) {
    const base = toRawString(node.child, '^');
    const s = node.child.type === NodeType.NUMBER
      ? `${base} ^ ${node.exponent}`
      : `${wrapRawParens(base)} ^ ${node.exponent}`;
    return s;
  }
  if (node.type === NodeType.SQRT) {
    const inner = toRawString(node.child, null);
    const arg = node.child.type === NodeType.NUMBER ? inner : wrapRawParens(inner);
    return `√ ${arg}`;
  }
  const { operator, left, right } = node;
  let leftStr = protectOperand(toRawString(left, operator), left, operator, false);
  let rightStr = protectOperand(toRawString(right, operator), right, operator, false);
  if (needsPrecedenceParens(left, operator)) leftStr = wrapRawParens(leftStr);
  if (needsPrecedenceParens(right, operator)) rightStr = wrapRawParens(rightStr);
  if (operator === '/' && !canUseLatexFrac(left, right)) {
    return `${leftStr} ${OP_RAW['/']} ${rightStr}`;
  }
  return `${leftStr} ${OP_RAW[operator]} ${rightStr}`;
}

function toLatexString(node, parentOp = null, inGroup = false) {
  if (node.type === NodeType.NUMBER) {
    const s = String(node.value);
    if (parentOp === '*' || parentOp === '/') {
      return node.value < 0 ? wrapLatexParens(s) : s;
    }
    if (node.value < 0 && (parentOp === '+' || parentOp === '-')) return wrapLatexParens(s);
    return s;
  }
  if (node.type === NodeType.RATIONAL) {
    return `\\frac{${node.num}}{${node.den}}`;
  }
  if (node.type === NodeType.GROUP) {
    const effective = node.bracketType === BracketType.ROUND
      ? peelRedundantRoundGroups(node) : node;
    if (effective !== node) return toLatexString(effective, parentOp, inGroup);
    const childStr = toLatexString(node.child, null, true);
    if (node.bracketType === BracketType.ROUND && roundGroupRedundant(node.child)) {
      return childStr;
    }
    const [open, close] = LATEX_BRACKETS[node.bracketType];
    return `${open}${childStr}${close}`;
  }
  if (node.type === NodeType.NEGATE) {
    const inner = toLatexString(node.child, '-', inGroup);
    let s;
    if (node.child.type === NodeType.NUMBER) {
      s = String(-node.child.value);
    } else if (node.child.type === NodeType.GROUP) {
      s = `-${inner}`;
    } else {
      s = `-\\left(${inner}\\right)`;
    }
    return protectOperand(s, node, parentOp, true);
  }
  if (node.type === NodeType.POWER) {
    const base = toLatexString(node.child, '^', inGroup);
    const needsBaseParen = !(node.child.type === NodeType.NUMBER ||
      (node.child.type === NodeType.GROUP && roundGroupRedundant(node.child)));
    const b = needsBaseParen ? `\\left(${base}\\right)` : base;
    return `{${b}}^{${node.exponent}}`;
  }
  if (node.type === NodeType.SQRT) {
    const inner = toLatexString(node.child, null, true);
    const arg = node.child.type === NodeType.NUMBER ? inner : `\\left(${inner}\\right)`;
    return `\\sqrt{${arg}}`;
  }
  const { operator, left, right } = node;
  let leftStr = protectOperand(toLatexString(left, operator, inGroup), left, operator, true);
  let rightStr = protectOperand(toLatexString(right, operator, inGroup), right, operator, true);
  if (needsPrecedenceParens(left, operator)) leftStr = wrapLatexParens(leftStr);
  if (needsPrecedenceParens(right, operator)) rightStr = wrapLatexParens(rightStr);

  switch (operator) {
    case '+': return `${leftStr} + ${rightStr}`;
    case '-': return `${leftStr} - ${rightStr}`;
    case '*': return `${leftStr} \\cdot ${rightStr}`;
    case '/': {
      if (!canUseLatexFrac(left, right)) return `${leftStr} : ${rightStr}`;
      return `\\frac{${leftStr}}{${rightStr}}`;
    }
    default:
      return `${leftStr} ${operator} ${rightStr}`;
  }
}

// ─── Generatore condiviso ──────────────────────────────────────────────────

function pickInitialResult(config) {
  const max = Math.min(config.maxNumber, config.level <= 2 ? 30 : config.maxNumber);
  return randInt(Math.max(2, Math.floor(max * 0.1)), max);
}

function buildExpressionTree(phase, level) {
  const config = getLevelConfig(level, phase);
  const constraints = PhaseConstraints[phase];
  let targetOps = randInt(config.minOps, config.maxOps);

  let powerAddon = null;
  if (phase >= 3 && config.level <= 3 && Math.random() < 0.65) {
    const base = randInt(2, Math.min(8, 15));
    const exp = Math.random() < 0.75 ? 2 : 3;
    powerAddon = { base, exp, value: base ** exp };
    targetOps = Math.max(config.minOps, targetOps - 1);
  }

  for (let attempt = 0; attempt < (phase === 4 ? 400 : 250); attempt++) {
    let initialResult = pickInitialResult(config);
    if (powerAddon && initialResult > powerAddon.value) {
      initialResult -= powerAddon.value;
    }

    let root = createNumberNode(initialResult);
    let ops = 0;
    let stuck = 0;

    while (ops < targetOps && stuck < 60) {
      const result = expandRandomLeaf(root, config, constraints, phase);
      if (result === false) { stuck++; continue; }
      if (result !== root) root = result;
      stuck = 0;
      ops = countOperations(root);
    }

    if (ops < config.minOps - (powerAddon ? 1 : 0)) continue;

    if (powerAddon) {
      root = createBinaryNode(
        '+',
        root,
        createPowerNode(createNumberNode(powerAddon.base), powerAddon.exp)
      );
    }

    root = applyParentheses(root, config.maxParenDepth);

    if (phase === 4) {
      root = injectPhase4Fractions(root, config);
    }

    if (phase === 4) {
      if (!validateTree(root, constraints, 4)) continue;
      const rr = evaluateRational(root);
      if (!constraints.validateFinalRational(rr)) continue;
    } else {
      if (!validateTree(root, constraints, phase)) continue;
      if (getMaxGroupDepth(root) > config.maxParenDepth) continue;
      if (config.maxParenDepth >= 3 && getMaxGroupDepth(root) < 3) continue;
      const result = evaluateNode(root);
      if (!constraints.validateFinal(result)) continue;
    }

    try {
      const result = phase === 4
        ? rat.toNumber(evaluateRational(root))
        : evaluateNode(root);

      return {
        rawString: toRawString(root),
        latexString: toLatexString(root),
        result,
      };
    } catch {
      continue;
    }
  }

  return buildFallback(phase, level, config, constraints);
}

function buildFallback(phase, level, config, constraints) {
  try {
  const a = randInt(2, Math.min(12, config.maxNumber));
  const b = randInt(2, Math.min(12, config.maxNumber));
  let root = createBinaryNode(
    '-',
    createNumberNode(a * b + randInt(config.minOps, config.minOps + 8)),
    createBinaryNode('*', createNumberNode(a), createNumberNode(b))
  );

  for (let i = 0; i < Math.max(0, config.minOps - 2); i++) {
    const k = randInt(1, 4);
    root = createBinaryNode('+', root, createNumberNode(k));
    root = createBinaryNode('-', root, createNumberNode(k));
  }

  if (phase >= 3 && config.level <= 3) {
    root = createBinaryNode('+', root, createPowerNode(createNumberNode(3), 2));
  }

  if (phase >= 4 && config.level <= 3) {
    const v = evaluateNode(root);
    root = createBinaryNode('*', createRationalNode(1, 3), createNumberNode(v * 3));
  }

  if (phase >= 4 && config.level >= 8) {
    const v = rat.toNumber(evaluateRational(root));
    const sumNode = createBinaryNode(
      '+',
      createRationalNode(1, 2),
      createRationalNode(1, 3)
    );
    root = createBinaryNode(
      '*',
      createBinaryNode('*', sumNode, createRationalNode(6, 5)),
      createNumberNode(v)
    );
  } else if (phase >= 2 && config.level >= 8) {
    root = createBinaryNode(
      '+',
      createBinaryNode(
        '*',
        createNegateNode(createNumberNode(a)),
        createNegateNode(createNumberNode(b))
      ),
      createNumberNode(0)
    );
  }

  if (config.maxParenDepth > 0) {
    root = createGroupNode(bracketTypeForDepth(config.maxParenDepth), root);
  }

  const result = phase === 4
    ? rat.toNumber(evaluateRational(root))
    : evaluateNode(root);

  return {
    rawString: toRawString(root),
    latexString: toLatexString(root),
    result,
  };
  } catch {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const root = createBinaryNode(
      '+',
      createBinaryNode('*', createNumberNode(a), createNumberNode(b)),
      createNumberNode(1)
    );
    return {
      rawString: toRawString(root),
      latexString: toLatexString(root),
      result: a * b + 1,
    };
  }
}

function generatePhase1(level) {
  return buildExpressionTree(1, level);
}

function generatePhase2(level) {
  return buildExpressionTree(2, level);
}

function generatePhase3(level) {
  return buildExpressionTree(3, level);
}

function generatePhase4(level) {
  return buildExpressionTree(4, level);
}

// ─── API principale ────────────────────────────────────────────────────────

const PHASE_GENERATORS = {
  1: generatePhase1,
  2: generatePhase2,
  3: generatePhase3,
  4: generatePhase4,
};

function generateExpression(phase, level) {
  const p = Math.max(1, Math.min(4, phase));
  const l = Math.max(1, Math.min(10, level));
  return PHASE_GENERATORS[p](l);
}

// ─── Auto-test ─────────────────────────────────────────────────────────────

function hasOrphanDecimals(str) {
  return /\d+\.\d+/.test(str);
}

function hasSignCollision(str) {
  return / - -|\+ -(?!\s*\()| -\+/.test(str);
}

function hasNestedLatexFrac(latex) {
  return /\\frac\{[^}]*\\frac/.test(latex);
}

function validateLatexBasic(latex) {
  if (!latex || typeof latex !== 'string') return false;
  const opens = (latex.match(/\\left(?:[([]|\{)/g) || []).length;
  const closes = (latex.match(/\\right(?:[)\]]|\})/g) || []).length;
  if (opens !== closes) return false;
  if (latex.includes('NaN') || latex.includes('Infinity')) return false;
  if (/\\frac\{\s*\}/.test(latex)) return false;
  if (/\\sqrt\{\s*\}/.test(latex)) return false;
  if (hasNestedLatexFrac(latex)) return false;
  return true;
}

function countOpsInRaw(raw) {
  return (raw.match(/ [+\-x:] | \/ | \^ | √ /g) || []).length;
}

function verifyExpression(expr, phase, level) {
  const config = getLevelConfig(level, phase);

  if (typeof expr.rawString !== 'string' || typeof expr.latexString !== 'string') return false;
  if (!Number.isInteger(expr.result) || expr.result <= 0) return false;
  if (hasOrphanDecimals(expr.rawString)) return false;
  if (!validateLatexBasic(expr.latexString)) return false;
  if (hasSignCollision(expr.rawString)) return false;

  const ops = countOpsInRaw(expr.rawString);
  const minOps = phase >= 3 && level <= 3 ? Math.max(1, config.minOps - 2) :
    level === 10 ? config.minOps - 4 :
    level >= 8 ? config.minOps - 2 :
    level <= 2 ? config.minOps - 1 : config.minOps;
  const maxOps = config.maxOps + (phase >= 4 && level >= 8 ? 45 : phase >= 4 ? 20 : 4);
  return ops >= minOps && ops <= maxOps;
}

function runSelfTest() {
  const levels = [1, 10];
  const perLevel = 5;
  let totalOk = 0;
  const total = 4 * levels.length * perLevel;

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AUTO-TEST GENERATORE ESPRESSIONI — FASI 1–4             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  for (let phase = 1; phase <= 4; phase++) {
    console.log(`\n══════════════ FASE ${phase}: ${PhaseConstraints[phase].name} ══════════════`);

    for (const level of levels) {
      console.log(`\n── Livello ${level} (${perLevel} test) ──\n`);
      let ok = 0;

      for (let i = 1; i <= perLevel; i++) {
        let expr;
        let err = null;
        try {
          expr = generateExpression(phase, level);
        } catch (e) {
          err = e.message;
          expr = { rawString: '', latexString: '', result: -1 };
        }

        const valid = !err && verifyExpression(expr, phase, level);
        if (valid) { ok++; totalOk++; }

        const ops = countOpsInRaw(expr.rawString);
        const status = valid ? '✓' : '✗';

        console.log(
          `${status} #${i} | Fase ${phase} Lv.${level} | ` +
          `Risultato: ${expr.result} | Ops: ${ops}` +
          (err ? ` | ERR: ${err}` : '') +
          `\n    ${expr.rawString}\n    LaTeX: ${expr.latexString}`
        );
      }

      console.log(`\n  → ${ok}/${perLevel} validi`);
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  TOTALE: ${totalOk}/${total} test superati`);
  console.log(`══════════════════════════════════════════════════════════════\n`);
}

runSelfTest();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateExpression, runSelfTest };
}
