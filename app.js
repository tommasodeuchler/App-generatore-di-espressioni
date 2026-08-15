/**
 * Generatore di espressioni — versione allenamento mentale
 * Una sola modalità, 5 livelli.
 * Difficoltà = n. operazioni + struttura + mix di tipi di calcolo.
 * Risultato sempre intero positivo e coerente con l’espressione.
 */

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

// ─── Config livelli (1–5) ──────────────────────────────────────────────────

function getConfig(level) {
  const t = (Math.max(1, Math.min(5, level)) - 1) / 4; // 0 → 1

  return {
    level,
    minOps: Math.round(4 + t * 7),   // 4 → 11
    maxOps: Math.round(6 + t * 8),   // 6 → 14
    maxNum: Math.round(14 + t * 26), // 14 → 40
    maxDepth: Math.round(1.5 + t * 1.5), // ~2 → 3
    // probabilità che appaiano elementi “avanzati”
    pNeg: 0.2 + t * 0.22,
    pPower: 0.16 + t * 0.2,
    pSqrt: 0.14 + t * 0.18,
    pFrac: 0.12 + t * 0.2,
  };
}

// ─── Tipi di nodo ──────────────────────────────────────────────────────────

const T = {
  NUM: 'num',
  BIN: 'bin',
  GROUP: 'group',
  NEG: 'neg',
  POW: 'pow',
  SQRT: 'sqrt',
  FRAC: 'frac',
};

const BRACKET = {
  ROUND: 'round',
  SQUARE: 'square',
  CURLY: 'curly',
};

const BRACKET_ORDER = [BRACKET.ROUND, BRACKET.SQUARE, BRACKET.CURLY];

function makeNum(v) {
  return { type: T.NUM, value: v };
}
function makeBin(op, left, right) {
  let value;
  switch (op) {
    case '+': value = left.value + right.value; break;
    case '-': value = left.value - right.value; break;
    case '*': value = left.value * right.value; break;
    case '/': value = left.value / right.value; break;
    default: value = 0;
  }
  return { type: T.BIN, op, left, right, value };
}
function makeGroup(child, bracketType = BRACKET.ROUND) {
  return { type: T.GROUP, child, bracketType, value: child.value };
}
function makeNeg(child) {
  return { type: T.NEG, child, value: -child.value };
}
function makePow(base, exp) {
  return { type: T.POW, base, exp, value: base.value ** exp };
}
function makeSqrt(child) {
  return { type: T.SQRT, child, value: Math.sqrt(child.value) };
}
function makeFrac(n, d) {
  return { type: T.FRAC, n, d, value: n / d };
}

// ─── Foglia ────────────────────────────────────────────────────────────────

function genLeaf(cfg, forcePositive = false) {
  // Frazione
  if (chance(cfg.pFrac)) {
    const dens = [2, 3, 4, 5, 6, 8];
    const d = pick(dens);
    const n = randInt(1, d - 1);
    return makeFrac(n, d);
  }

  // Radice perfetta
  if (chance(cfg.pSqrt)) {
    const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196];
    const ok = squares.filter((s) => Math.sqrt(s) <= cfg.maxNum);
    if (ok.length) return makeSqrt(makeNum(pick(ok)));
  }

  // Potenza
  if (chance(cfg.pPower)) {
    const candidates = [];
    for (let b = 2; b <= 10; b++) {
      if (b ** 2 <= cfg.maxNum * 2.5) candidates.push([b, 2]);
      if (b ** 3 <= cfg.maxNum * 3) candidates.push([b, 3]);
    }
    if (candidates.length) {
      const [b, e] = pick(candidates);
      return makePow(makeNum(b), e);
    }
  }

  // Numero intero (evita 1)
  let v = randInt(2, cfg.maxNum);
  if (cfg.level <= 2) v = randInt(2, Math.min(18, cfg.maxNum));
  if (!forcePositive && chance(cfg.pNeg)) v = -v;
  return makeNum(v);
}

// ─── Generazione ricorsiva ─────────────────────────────────────────────────

function genExpr(cfg, remainingOps, depth) {
  if (remainingOps <= 0 || depth >= cfg.maxDepth) {
    return genLeaf(cfg, depth === 0);
  }

  // Raggruppamento con parentesi di tipo diverso secondo la profondità
  if (depth > 0 && remainingOps >= 2 && chance(0.38)) {
    const inner = genExpr(cfg, remainingOps, depth + 1);
    if (inner.type === T.BIN || inner.type === T.GROUP) {
      const bracketType = BRACKET_ORDER[Math.min(depth - 1, 2)];
      return makeGroup(inner, bracketType);
    }
  }

  const leftOps = randInt(0, remainingOps - 1);
  const rightOps = remainingOps - 1 - leftOps;

  let left = genExpr(cfg, leftOps, depth + 1);
  let right = genExpr(cfg, rightOps, depth + 1);

  // Operatori (divisione un po’ meno frequente)
  const ops = ['+', '-', '*'];
  if (chance(0.38)) ops.push('/');
  let op = pick(ops);
  let node = null;

  for (let tries = 0; tries < 18; tries++) {
    if (op === '+') {
      node = makeBin('+', left, right);
      break;
    }
    if (op === '-') {
      // evita risultati troppo negativi se possibile
      if (left.value < right.value && chance(0.6)) {
        node = makeBin('-', right, left);
      } else {
        node = makeBin('-', left, right);
      }
      break;
    }
    if (op === '*') {
      // evita *1 e *(-1), limita esplosione
      if (Math.abs(right.value) <= 1 || Math.abs(left.value * right.value) > cfg.maxNum * 35) {
        right = makeNum(randInt(2, 8));
        if (chance(cfg.pNeg * 0.7)) right = makeNeg(right);
      }
      if (Math.abs(left.value) <= 1) {
        left = makeNum(randInt(3, 12));
      }
      node = makeBin('*', left, right);
      break;
    }
    if (op === '/') {
      if (right.value === 0) right = makeNum(randInt(2, 9));

      const q = left.value / right.value;
      // Accettiamo anche non interi (verranno normalizzati dopo se serve)
      if (Math.abs(right.value) > 1 && Number.isFinite(q)) {
        node = makeBin('/', left, right);
        break;
      }

      // Forza un divisore intero valido
      const absL = Math.abs(Math.round(left.value));
      if (absL >= 4) {
        const divs = [];
        for (let d = 2; d <= Math.min(absL, 14); d++) {
          if (absL % d === 0) divs.push(d);
        }
        if (divs.length) {
          const d = pick(divs);
          right = makeNum(chance(cfg.pNeg * 0.5) ? -d : d);
          node = makeBin('/', left, right);
          break;
        }
      }
      op = pick(['+', '-', '*']);
      continue;
    }
  }

  if (!node) node = makeBin('+', left, right);

  // Negazione occasionale su sotto-espressione
  if (depth > 0 && chance(cfg.pNeg * 0.35) && node.value !== 0 && Math.abs(node.value) < cfg.maxNum * 2.5) {
    return makeNeg(node);
  }

  return node;
}

// ─── Conteggio operazioni ──────────────────────────────────────────────────

function countTreeOps(node) {
  if (!node) return 0;
  if (node.type === T.NUM || node.type === T.FRAC) return 0;
  if (node.type === T.GROUP) return countTreeOps(node.child);
  if (node.type === T.NEG || node.type === T.SQRT) {
    return 1 + countTreeOps(node.child);
  }
  if (node.type === T.POW) {
    return 1 + countTreeOps(node.base);
  }
  if (node.type === T.BIN) {
    return 1 + countTreeOps(node.left) + countTreeOps(node.right);
  }
  return 0;
}

// ─── Costruzione albero ────────────────────────────────────────────────────

function buildTree(level) {
  const cfg = getConfig(level);
  const targetOps = randInt(cfg.minOps, cfg.maxOps);

  for (let attempt = 0; attempt < 70; attempt++) {
    let root = genExpr(cfg, targetOps, 0);
    let val = root.value;

    if (!Number.isFinite(val)) continue;

    // Vogliamo sempre un intero positivo finale
    if (!Number.isInteger(val) || val <= 0) {
      if (Number.isInteger(val) && val < 0) {
        const offset = Math.abs(val) + randInt(3, 16);
        root = makeBin('+', root, makeNum(offset));
        val = root.value;
      } else {
        // moltiplica per cancellare eventuale denominatore
        const factor = randInt(2, 7);
        root = makeBin('*', root, makeNum(factor));
        val = root.value;
        if (!Number.isInteger(val) || val <= 0) continue;
      }
    }

    if (val > 0 && Number.isInteger(val) && val < 120000) {
      // Conta operazioni approssimative
      const ops = countTreeOps(root);
      if (ops < cfg.minOps - 1) continue;

      // A livelli bassi a volte aggiungi una potenza leggera per varietà
      if (level <= 2 && chance(0.25) && ops < cfg.maxOps) {
        const base = randInt(2, 5);
        root = makeBin('+', root, makePow(makeNum(base), 2));
        if (root.value > 0 && Number.isInteger(root.value)) return root;
      }
      return root;
    }
  }

  // Fallback sicuro e non banale
  const a = randInt(5, 14);
  const b = randInt(3, 9);
  const c = randInt(4, 18);
  return makeBin('+', makeBin('*', makeNum(a), makeNum(b)), makeNum(c));
}

// ─── Rendering ─────────────────────────────────────────────────────────────

const RAW_OP = { '+': '+', '-': '-', '*': '×', '/': '÷' };
const LATEX_OP = { '+': '+', '-': '-', '*': '\\cdot', '/': ':' };

const RAW_BRACKETS = {
  [BRACKET.ROUND]: ['(', ')'],
  [BRACKET.SQUARE]: ['[', ']'],
  [BRACKET.CURLY]: ['{', '}'],
};

const LATEX_BRACKETS = {
  [BRACKET.ROUND]: ['\\left(', '\\right)'],
  [BRACKET.SQUARE]: ['\\left[', '\\right]'],
  [BRACKET.CURLY]: ['\\left\\{', '\\right\\}'],
};

function prec(op) {
  return (op === '+' || op === '-') ? 1 : 2;
}

function needsParens(child, parentOp, isRight) {
  if (!child || child.type !== T.BIN) return false;
  const cp = prec(child.op);
  const pp = prec(parentOp);
  if (cp < pp) return true;
  if (isRight && cp === pp && (parentOp === '-' || parentOp === '/')) return true;
  return false;
}

function toRaw(node, parentOp = null, isRight = false) {
  if (!node) return '?';

  if (node.type === T.NUM) {
    if (node.value < 0 && parentOp) return `(${node.value})`;
    return String(node.value);
  }
  if (node.type === T.FRAC) {
    return `${node.n}/${node.d}`;
  }
  if (node.type === T.GROUP) {
    const [open, close] = RAW_BRACKETS[node.bracketType] || RAW_BRACKETS[BRACKET.ROUND];
    return `${open}${toRaw(node.child)}${close}`;
  }
  if (node.type === T.NEG) {
    if (node.child.type === T.NUM) return String(-node.child.value);
    return `-(${toRaw(node.child)})`;
  }
  if (node.type === T.POW) {
    const b = toRaw(node.base);
    return node.base.type === T.NUM ? `${b}^${node.exp}` : `(${b})^${node.exp}`;
  }
  if (node.type === T.SQRT) {
    const inner = toRaw(node.child);
    return node.child.type === T.NUM ? `√${inner}` : `√(${inner})`;
  }

  let L = toRaw(node.left, node.op, false);
  let R = toRaw(node.right, node.op, true);
  if (needsParens(node.left, node.op, false)) L = `(${L})`;
  if (needsParens(node.right, node.op, true)) R = `(${R})`;
  return `${L} ${RAW_OP[node.op]} ${R}`;
}

function toLatex(node, parentOp = null, isRight = false) {
  if (!node) return '?';

  if (node.type === T.NUM) {
    if (node.value < 0 && parentOp) return `\\left(${node.value}\\right)`;
    return String(node.value);
  }
  if (node.type === T.FRAC) {
    return `\\frac{${node.n}}{${node.d}}`;
  }
  if (node.type === T.GROUP) {
    const [open, close] = LATEX_BRACKETS[node.bracketType] || LATEX_BRACKETS[BRACKET.ROUND];
    return `${open}${toLatex(node.child)}${close}`;
  }
  if (node.type === T.NEG) {
    if (node.child.type === T.NUM) return String(-node.child.value);
    return `-\\left(${toLatex(node.child)}\\right)`;
  }
  if (node.type === T.POW) {
    const b = toLatex(node.base);
    const baseStr = node.base.type === T.NUM ? b : `\\left(${b}\\right)`;
    return `{${baseStr}}^{${node.exp}}`;
  }
  if (node.type === T.SQRT) {
    return `\\sqrt{${toLatex(node.child)}}`;
  }

  let L = toLatex(node.left, node.op, false);
  let R = toLatex(node.right, node.op, true);
  if (needsParens(node.left, node.op, false)) L = `\\left(${L}\\right)`;
  if (needsParens(node.right, node.op, true)) R = `\\left(${R}\\right)`;

  if (node.op === '/' && node.left.type === T.NUM && node.right.type === T.NUM) {
    return `\\frac{${L}}{${R}}`;
  }
  return `${L} ${LATEX_OP[node.op]} ${R}`;
}

// ─── API pubblica ──────────────────────────────────────────────────────────

/**
 * @param {number} phase  (ignorato, mantenuto per compatibilità)
 * @param {number} level  1–5
 */
function generateExpression(phase, level) {
  const l = Math.max(1, Math.min(5, Math.floor(Number(level)) || 1));
  const root = buildTree(l);
  let result = root.value;

  if (!Number.isInteger(result) || result <= 0) {
    result = Math.abs(Math.round(result)) || 1;
  }

  return {
    rawString: toRaw(root),
    latexString: toLatex(root),
    result,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateExpression };
}
if (typeof window !== 'undefined') {
  window.generateExpression = generateExpression;
}
