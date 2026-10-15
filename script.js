/* ===== LÓGICA DO XADREZ ===== */ //LOGIC
const GL = {K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟'};
const opp = c => c === 'w' ? 'b' : 'w';
const sqName = i => 'abcdefgh'[i % 8] + (8 - (i >> 3));

function newState() {
  const back = ['R','N','B','Q','K','B','N','R'], b = Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    b[c] = 'b' + back[c]; b[8 + c] = 'bP';
    b[48 + c] = 'wP'; b[56 + c] = 'w' + back[c];
  }
  return {board: b, turn: 'w', castle: {wK:1,wQ:1,bK:1,bQ:1}, ep: null, half: 0};
}

function attacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7, at = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : null;
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (at(pr, c + dc) === by + 'P') return true;
  for (const [dr, dc] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) if (at(r + dr, c + dc) === by + 'N') return true;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && at(r + dr, c + dc) === by + 'K') return true;
  for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
    const diag = dr && dc;
    for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < 8 && cc >= 0 && cc < 8; rr += dr, cc += dc) {
      const p = b[rr * 8 + cc];
      if (!p) continue;
      if (p[0] === by && (p[1] === 'Q' || p[1] === (diag ? 'B' : 'R'))) return true;
      break;
    }
  }
  return false;
}

const kingSq = (b, c) => b.indexOf(c + 'K');
const inCheck = (st, c) => attacked(st.board, kingSq(st.board, c), opp(c));

function pseudo(st) {
  const b = st.board, me = st.turn, out = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p[0] !== me) continue;
    const r = i >> 3, c = i & 7, t = p[1];
    const add = (to, extra) => out.push(Object.assign({from: i, to}, extra));
    if (t === 'P') {
      const d = me === 'w' ? -1 : 1, start = me === 'w' ? 6 : 1, last = me === 'w' ? 0 : 7;
      const push = (to, extra) => {
        if (to >> 3 === last) for (const q of 'QRBN') add(to, Object.assign({promo: q}, extra));
        else add(to, extra);
      };
      const f = (r + d) * 8 + c;
      if (!b[f]) {
        push(f);
        if (r === start && !b[f + d * 8]) add(f + d * 8, {dbl: 1});
      }
      for (const dc of [-1, 1]) {
        if (c + dc < 0 || c + dc > 7) continue;
        const to = (r + d) * 8 + c + dc;
        if (b[to] && b[to][0] !== me) push(to);
        else if (to === st.ep) add(to, {ep: 1});
      }
    } else if (t === 'N' || t === 'K') {
      const offs = t === 'N' ? [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]
        : [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dr, dc] of offs) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const q = b[rr * 8 + cc];
        if (!q || q[0] !== me) add(rr * 8 + cc);
      }
      if (t === 'K') {
        const home = me === 'w' ? 60 : 4, en = opp(me);
        if (i === home && !attacked(b, home, en)) {
          if (st.castle[me + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === me + 'R'
            && !attacked(b, home + 1, en) && !attacked(b, home + 2, en)) add(home + 2, {castle: 'K'});
          if (st.castle[me + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === me + 'R'
            && !attacked(b, home - 1, en) && !attacked(b, home - 2, en)) add(home - 2, {castle: 'Q'});
        }
      }
    } else {
      const dirs = [];
      if (t !== 'B') dirs.push([1,0],[-1,0],[0,1],[0,-1]);
      if (t !== 'R') dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
      for (const [dr, dc] of dirs)
        for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < 8 && cc >= 0 && cc < 8; rr += dr, cc += dc) {
          const q = b[rr * 8 + cc];
          if (!q) { add(rr * 8 + cc); continue; }
          if (q[0] !== me) add(rr * 8 + cc);
          break;
        }
    }
  }
  return out;
}

function apply(st, m) {
  const b = st.board.slice(), p = b[m.from], me = st.turn;
  const captured = m.ep ? b[m.to + (me === 'w' ? 8 : -8)] : b[m.to];
  b[m.to] = m.promo ? me + m.promo : p; b[m.from] = null;
  if (m.ep) b[m.to + (me === 'w' ? 8 : -8)] = null;
  if (m.castle) {
    const home = m.from;
    if (m.castle === 'K') { b[home + 1] = b[home + 3]; b[home + 3] = null; }
    else { b[home - 1] = b[home - 4]; b[home - 4] = null; }
  }
  const castle = Object.assign({}, st.castle);
  if (p[1] === 'K') castle[me + 'K'] = castle[me + 'Q'] = 0;
  for (const s of [m.from, m.to]) {
    if (s === 63) castle.wK = 0; if (s === 56) castle.wQ = 0;
    if (s === 7) castle.bK = 0; if (s === 0) castle.bQ = 0;
  }
  return {board: b, turn: opp(me), castle, captured,
    ep: m.dbl ? (m.from + m.to) / 2 : null,
    half: (p[1] === 'P' || captured) ? 0 : st.half + 1};
}

function legalMoves(st) {
  return pseudo(st).filter(m => !inCheck(apply(st, m), st.turn));
}

function insufficient(b) {
  const ps = [];
  b.forEach((p, i) => { if (p && p[1] !== 'K') ps.push([p[1], ((i >> 3) + (i & 7)) % 2]); });
  if (!ps.length) return true;
  if (ps.length === 1 && 'BN'.includes(ps[0][0])) return true;
  return ps.every(p => p[0] === 'B' && p[1] === ps[0][1]); // só bispos, todos da mesma cor
}

// Esse lado ainda consegue (em tese) dar mate? Usado no fim de tempo.
function canMate(b, color) {
  const ps = b.filter(p => p && p[0] === color && p[1] !== 'K');
  return ps.some(p => 'PRQ'.includes(p[1])) || ps.length >= 2;
}

function perft(st, d) {
  if (!d) return 1;
  return legalMoves(st).reduce((n, m) => n + perft(apply(st, m), d - 1), 0);
}
//END

//ENGINE  (motor simples para analisar partidas: roda 100% no navegador, sem API)
const VAL = {P:100, N:320, B:330, R:500, Q:900, K:0};
const MATE = 30000;
const PST = {
  P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
      0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
      -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
      -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
      0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  E: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30,
      -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30,
      -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
};

// Avaliação em centipeões, do ponto de vista de quem joga.
function evaluate(st) {
  const b = st.board;
  let s = 0, np = 0, bw = 0, bb = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const t = p[1];
    if (t !== 'K' && t !== 'P') np += VAL[t];
    if (t === 'B') { if (p[0] === 'w') bw++; else bb++; }
  }
  const end = np <= 2400;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const t = p[1], w = p[0] === 'w';
    const v = VAL[t] + PST[t === 'K' && end ? 'E' : t][w ? i : i ^ 56];
    s += w ? v : -v;
  }
  if (bw > 1) s += 30;
  if (bb > 1) s -= 30;
  return st.turn === 'w' ? s : -s;
}

// Só material (usado para detectar sacrifícios).
function matEval(st) {
  let s = 0;
  for (const p of st.board) if (p) s += (p[0] === 'w' ? 1 : -1) * VAL[p[1]];
  return st.turn === 'w' ? s : -s;
}

function orderMoves(st, ms) {
  const b = st.board;
  for (const m of ms) {
    const v = m.ep ? 'P' : (b[m.to] ? b[m.to][1] : null);
    m.o = (v ? 1000 + 10 * VAL[v] - VAL[b[m.from][1]] / 10 : 0) + (m.promo ? VAL[m.promo] : 0);
  }
  ms.sort((x, y) => y.o - x.o);
}

function qsearch(st, alpha, beta, ply, ev) {
  ev = ev || evaluate;
  const stand = ev(st);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (ply > 12) return stand;
  const ms = pseudo(st).filter(m => (m.ep || st.board[m.to] || m.promo === 'Q'));
  orderMoves(st, ms);
  let best = stand;
  for (const m of ms) {
    const n = apply(st, m);
    if (inCheck(n, st.turn)) continue;
    const sc = -qsearch(n, -beta, -alpha, ply + 1, ev);
    if (sc > best) { best = sc; if (sc > alpha) { alpha = sc; if (alpha >= beta) break; } }
  }
  return best;
}

function negamax(st, depth, alpha, beta, ply) {
  if (st.half >= 100) return 0;
  const chk = inCheck(st, st.turn);
  if (chk && ply < 10) depth++;                 // extensão de xeque (limitada)
  if (depth <= 0 || ply > 30) return qsearch(st, alpha, beta, 0);
  const ms = pseudo(st);
  orderMoves(st, ms);
  let best = -Infinity, legal = 0;
  for (const m of ms) {
    const n = apply(st, m);
    if (inCheck(n, st.turn)) continue;
    legal++;
    const sc = -negamax(n, depth - 1, -beta, -alpha, ply + 1);
    if (sc > best) { best = sc; if (sc > alpha) { alpha = sc; if (alpha >= beta) break; } }
  }
  if (!legal) return chk ? -MATE + ply : 0;
  return best;
}

// Busca na raiz com aprofundamento iterativo. Lances até 'margin' do melhor recebem nota exata;
// os piores recebem apenas um limite superior (exact = false).
function rootSearch(st, depth, margin) {
  const ms = pseudo(st).filter(m => !inCheck(apply(st, m), st.turn));
  if (!ms.length) return null;
  orderMoves(st, ms);
  const list = ms.map(m => ({m, score: 0, exact: true}));
  for (let d = 1; d <= depth; d++) {
    let best = -Infinity;
    for (const e of list) {
      const alpha = best === -Infinity ? -Infinity : best - margin;
      const sc = -negamax(apply(st, e.m), d - 1, -Infinity, -alpha, 1);
      e.exact = alpha === -Infinity || sc > alpha;
      e.score = sc;
      if (e.exact && sc > best) best = sc;
    }
    list.sort((a, b) => (b.exact - a.exact) || (b.score - a.score));
  }
  return {list, best: list[0].m, bestScore: list[0].score};
}

// Chance de vitória (0-100) a partir de centipeões (fórmula do Lichess).
const winPct = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1);


// ---------- utilidades UCI / FEN ----------
const sqIdx = n => 'abcdefgh'.indexOf(n[0]) + (8 - +n[1]) * 8;
const moveToUci = m => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');
function uciToMove(st, u) {
  const from = sqIdx(u.slice(0, 2)), to = sqIdx(u.slice(2, 4)), pr = u[4] ? u[4].toUpperCase() : null;
  return legalMoves(st).find(m => m.from === from && m.to === to && (m.promo || null) === pr) || null;
}
function toFEN(st, fullmove) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let s = '', e = 0;
    for (let c = 0; c < 8; c++) {
      const p = st.board[r * 8 + c];
      if (!p) { e++; continue; }
      if (e) { s += e; e = 0; }
      s += p[0] === 'w' ? p[1] : p[1].toLowerCase();
    }
    rows.push(s + (e || ''));
  }
  const cs = (st.castle.wK ? 'K' : '') + (st.castle.wQ ? 'Q' : '') + (st.castle.bK ? 'k' : '') + (st.castle.bQ ? 'q' : '');
  return rows.join('/') + ' ' + st.turn + ' ' + (cs || '-') + ' ' + (st.ep != null ? sqName(st.ep) : '-') + ' ' + st.half + ' ' + fullmove;
}
const posKey = st => st.board.map(p => p || '.').join('') + st.turn
  + (st.castle.wK ? 'K' : '') + (st.castle.wQ ? 'Q' : '') + (st.castle.bK ? 'k' : '') + (st.castle.bQ ? 'q' : '');

// ---------- livro de aberturas (lances em notação de coordenadas) ----------
const BOOK_LINES = [
  // 1.e4 e5
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4 b1c3 f6e4',
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 b2b4 c5b6',
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 e5d4 e1g1 g8f6',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e1g1 f6e4 f1e1 d7d5 c4d5 d8d5 b1c3 d5a5',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 c6a5 c4b5 c7c6 d5c6 b7c6 b5e2 h7h6',
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5 d2d4 d8c7',
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5 a4b3 d7d5 d4e5 c8e6',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5 d1d8 e8d8 b1c3 d8e8',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f8c5 f3e5 c6e5 d2d4 c5d6 d4e5 d6e5',
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6 e1g1 f7f6 d2d4 e5d4 f3d4 c8d7',
  'e2e4 e7e5 g1f3 b8c6 f1b5 f8c5 c2c3 g8f6 e1g1 e8g8 d2d4 c5b6',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6 e4e5 d8e7 d1e2 f6d5 c2c4 c8a6',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 c1e3 d8f6 c2c3 g8e7 f1c4 e8g8',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 d4b3 c5b6 b1c3 g8f6 d1e2 e8g8',
  'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4 e1g1 e8g8 d2d3 d7d6 c1g5 b4c3 b2c3 d8e7 f1e1 c6d8',
  'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 d2d4 e5d4 f3d4 f8b4 d4c6 b7c6 f1d3 d7d5 e4d5 c6d5',
  'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5 f1d3 f8e7 e1g1 b8c6 c2c4 c6b4 f1e1 c8g4',
  'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4 f1d3 d7d5 f3e5 b8d7 e5d7 c8d7 e1g1 f8d6',
  'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7 f1c4 f8e7 e1g1 e8g8 d1e2 c7c6 a2a4 e5d4',
  'e2e4 e7e5 g1f3 d7d6 d2d4 e5d4 f3d4 g8f6 b1c3 f8e7 f1e2 e8g8 e1g1 c7c5',
  'e2e4 e7e5 b1c3 g8f6 f2f4 d7d5 f4e5 f6e4 g1f3 f8e7 d2d4 e8g8 f1d3 f7f5',
  'e2e4 e7e5 b1c3 g8f6 g2g3 d7d5 e4d5 f6d5 f1g2 d5b6 g1e2 b8c6 e1g1 f8e7',
  'e2e4 e7e5 b1c3 b8c6 f1c4 g8f6 d2d3 f8b4 g1f3 d7d6 c1g5 h7h6 g5h4 b4c3',
  'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 h2h4 g5g4 f3e5 g8f6 d2d4 d7d6 e5d3 f6e4',
  'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 f1c4 g5g4 e1g1 g4f3 d1f3 d8f6 e4e5 f6e5 d2d3 f8h6',
  'e2e4 e7e5 f2f4 f8c5 g1f3 d7d6 c2c3 g8f6 d2d4 c5b6 f1d3 e8g8',
  'e2e4 e7e5 f2f4 d7d5 e4d5 e5f4 g1f3 g8f6 f1c4 f6d5 e1g1 f8e7',
  'e2e4 e7e5 d2d4 e5d4 c2c3 d4c3 f1c4 c3b2 c1b2 d7d5 c4d5 g8f6',
  'e2e4 e7e5 f1c4 g8f6 d2d3 c7c6 g1f3 d7d5 c4b3 f8d6 e1g1 e8g8',
  'e2e4 e7e5 d2d4 e5d4 d1d4 b8c6 d4e3 g8f6 b1c3 f8b4 c1d2 e8g8 e1c1 f8e8',
  // 1.e4 c5 (Siciliana)
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 c8e6 f2f3 f8e7 d1d2 e8g8 e1c1 b8d7',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5 d4b3 f8e7 e1g1 e8g8 c1e3 c8e6',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7 d1f3 d8c7 e1c1 b8d7',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 f1c4 c8d7 e1c1 a8c8',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f1e2 f8e7 e1g1 e8g8 f2f4 b8c6 c1e3 c8d7',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 f1e2 e7e6 e1g1 f8e7 c1e3 e8g8',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5 g5f6 g7f6 c3d5 f6f5',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 c1g5 e7e6 d1d2 a7a6 e1c1 c8d7 f2f4 h7h6',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3 g8f6 e1g1 d8c7 f2f4 b8c6',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7 f1e2 a7a6 e1g1 g8f6 c1e3 f8e7',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 g2g4 h7h6 h2h3 b8c6 c1e3 a7a6',
  'e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4 c5d4 g1f3 b8c6 c3d4 d7d6 f1c4 d5b6 c4b3 d6e5 f3e5 c6e5',
  'e2e4 c7c5 c2c3 d7d5 e4d5 d8d5 d2d4 g8f6 g1f3 c8g4 f1e2 e7e6 e1g1 b8c6',
  'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6 c1e3 e7e6 d1d2 g8e7',
  'e2e4 c7c5 b1c3 b8c6 f2f4 g7g6 g1f3 f8g7 f1c4 e7e6 f4f5 g6f5 d2d3 g8e7',
  'e2e4 c7c5 d2d4 c5d4 c2c3 d4c3 b1c3 b8c6 g1f3 d7d6 f1c4 e7e6 e1g1 g8f6 d1e2 f8e7',
  'e2e4 c7c5 g1f3 d7d6 f1b5 c8d7 b5d7 d8d7 e1g1 b8c6 c2c3 g8f6 f1e1 e7e6',
  'e2e4 c7c5 g1f3 b8c6 f1b5 g7g6 b5c6 d7c6 d2d3 f8g7 h2h3 g8f6 b1c3 e8g8',
  // 1.e4 outras
  'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3 c5c4 b2b4 c4b3 a3a4',
  'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3 g8h6 b2b4 c5d4 c3d4 h6f5',
  'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4 d8c7 g4g7 h8g8 g7h7 c5d4 g1e2 b8c6',
  'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 g1f3 b8c6 a3a4 d8a5 c1d2 c5c4',
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7 f2f4 e8g8 g1f3 c7c5',
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 e4e5 f6d7 f2f4 c7c5 g1f3 b8c6 c1e3 c5d4 f3d4 f8c5',
  'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5 c2c3 b8c6 g1e2 c5d4 c3d4 f7f6',
  'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5 g1f3 b8c6 e4d5 e6d5 f1b5 f8d6 d4c5 d6c5 e1g1 g8e7',
  'e2e4 e7e6 d2d4 d7d5 e4d5 e6d5 g1f3 g8f6 f1d3 f8d6 e1g1 e8g8 b1c3 b8c6 c1g5 c8g4',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7 h4h5 g6h7 f1d3 h7d3 d1d3 e7e6',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 b8d7 e4g5 g8f6 f1d3 e7e6 g1f3 f8d6 d1e2 h7h6',
  'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c6c5 e1g1 b8c6 c2c3 g8e7 b1a3 c5d4',
  'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 b1c3 e7e6 g2g4 f5g6 g1e2 g8e7 h2h4 h7h5',
  'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 f1d3 b8c6 c2c3 g8f6 c1f4 c8g4 d1b3 d8d7',
  'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 e7e6 g1f3 f8e7 c4d5 f6d5 f1d3 b8c6 e1g1 e8g8',
  'e2e4 c7c6 d2d4 d7d5 b1d2 d5e4 d2e4 b8d7 g1f3 g8f6 e4g3 e7e6 f1d3 f8e7 e1g1 e8g8',
  'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c7c6 f1c4 c8f5 c1d2 e7e6 d1e2 f8b4',
  'e2e4 d7d5 e4d5 g8f6 d2d4 f6d5 g1f3 g7g6 f1e2 f8g7 e1g1 e8g8 c2c4 d5b6 b1c3 b8c6',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 c7c6 a2a4 b8d7 c1f4 d8c7',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4 f8g7 g1f3 e8g8 f1d3 b8a6 e1g1 c7c5',
  'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 c8g4 f1e2 e7e6 e1g1 f8e7 c2c4 d5b6 b1c3 e8g8',
  'e2e4 g7g6 d2d4 f8g7 b1c3 d7d6 g1f3 g8f6 f1e2 e8g8 e1g1 c7c6',
  'e2e4 b7b6 d2d4 c8b7 b1c3 e7e6 g1f3 g8f6 f1d3 f8b4 d1e2 e8g8',
  // 1.d4
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5h4 b7b6 c4d5 e6d5 h4f6 e7f6',
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8e7 c1f4 e8g8 e2e3 c7c5 d4c5 e7c5 a2a3 b8c6',
  'd2d4 d7d5 c2c4 e7e6 c4d5 e6d5 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 f1d3 b8d7 g1e2 f8e8',
  'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5 e1g1 a7a6 d1e2 b7b5 c4b3 c5d4',
  'd2d4 d7d5 c2c4 d5c4 e2e3 g8f6 f1c4 e7e6 g1f3 c7c5 e1g1 a7a6 d1e2 b7b5 c4b3 c5d4',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6 f1c4 f8b4 e1g1 b8d7 d1e2 f5g6',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5 c4d3 a7a6 e3e4 c6c5',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 e2e3 e7e6 b1d2 b8d7 f1d3 f8d6 e1g1 e8g8 e3e4 d5e4 d2e4 f6e4',
  'd2d4 d7d5 c2c4 c7c6 b1c3 g8f6 e2e3 e7e6 g1f3 b8d7 d1c2 f8d6 f1d3 e8g8',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7 e1g1 e8g8 b1c3 f6e4 d1c2 e4c3 c2c3 c7c5',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5 e1g1 b8c6 a2a3 b4c3 b2c3 d5c4 d3c4 d8c7',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3 c2c3 b7b6 c1g5 c8b7 e2e3 d7d6',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 g1f3 c7c5 e2e3 b8c6 f1d3 b4c3 b2c3 d7d6 e3e4 e6e5',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1 f6d7',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5 g1e2 c7c6 d1d2 b8d7',
  'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 g1f3 c7c5 f1e2 e8g8 e1g1 b8c6 c1e3 c5d4',
  'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3 d5c4 b3c4 e8g8 e2e4 c8g4 c1e3 f6d7',
  'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 f8e8',
  'd2d4 g8f6 c2c4 c7c5 d4d5 b7b5 c4b5 a7a6 b5a6 c8a6 b1c3 d7d6 e2e4 a6f1 e1f1 g7g6 g2g3 f8g7 f1g2 e8g8',
  'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 d5c4 d1c2 a7a6 c2c4 b7b5 c4c2 c8b7',
  'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 g1f3 f8e7 f1g2 e8g8 e1g1 d5c4 d1c2 a7a6 a2a4 c7c5',
  'd2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 c7c5 c2c3 b8c6 b1d2 f8d6 f4g3 e8g8 f1d3 d8e7',
  'd2d4 d7d5 g1f3 g8f6 c1f4 c7c5 e2e3 b8c6 c2c3 d8b6 d1b3 c5c4 b3c2 c8f5 f4g3 e7e6',
  'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 c2c3 b8c6 b1d2 f8d6 e1g1 e8g8 d4c5 d6c5 e3e4 d5e4',
  'd2d4 g8f6 c1g5 f6e4 g5f4 c7c5 f2f3 d8b6 b2b3 e4d6 e2e3 c5d4 e3d4 b8c6',
  'd2d4 g8f6 c1g5 e7e6 e2e3 h7h6 g5h4 f8e7 b1d2 d7d5 f1d3 b8d7 g1f3 e8g8',
  'd2d4 f7f5 g2g3 g8f6 f1g2 e7e6 g1f3 f8e7 e1g1 e8g8 c2c4 d7d6 b1c3 d8e8',
  'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6 f1g2 f8e7 g1f3 e8g8 e1g1 d7d6 b1c3 d8e8',
  'd2d4 d7d5 g1f3 g8f6 g2g3 e7e6 f1g2 f8e7 e1g1 e8g8 c2c4 d5c4 d1c2 b7b5',
  'd2d4 g8f6 g1f3 e7e6 c1g5 h7h6 g5h4 d7d5 e2e3 f8e7 b1d2 e8g8 f1d3 b7b6',
  'd2d4 d7d6 e2e4 g8f6 b1c3 g7g6 f2f4 f8g7 g1f3 c7c5 f1b5 c8d7 e4e5 f6g4',
  // flancos
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5 f1g2 d5b6 e1g1 f8e7 d2d3 e8g8',
  'c2c4 e7e5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6 e2e4 g8e7 g1e2 e8g8',
  'c2c4 g8f6 b1c3 e7e5 g1f3 b8c6 g2g3 f8b4 f1g2 e8g8 e1g1 e5e4 f3g5 b4c3 d2c3 h7h6',
  'c2c4 c7c5 g1f3 g8f6 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 e1g1 e8g8 d2d4 c5d4 f3d4 c6d4',
  'c2c4 c7c5 g1f3 g8f6 b1c3 e7e6 g2g3 b7b6 f1g2 c8b7 e1g1 f8e7 d2d4 c5d4 d1d4 d7d6',
  'c2c4 e7e6 b1c3 d7d5 d2d4 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5h4 b7b6',
  'g1f3 d7d5 c2c4 e7e6 g2g3 g8f6 f1g2 f8e7 e1g1 e8g8 b2b3 d5d4 e2e3 b8c6 e3d4 c6d4',
  'g1f3 d7d5 c2c4 d5d4 b2b4 c7c5 e2e3 b8c6 e3d4 c5d4 c1b2 e7e5',
  'g1f3 d7d5 g2g3 g8f6 f1g2 c7c6 e1g1 c8g4 d2d3 b8d7 b1d2 e7e6 h2h3 g4h5',
  'g1f3 d7d5 g2g3 c7c5 f1g2 b8c6 e1g1 e7e5 d2d3 g8f6 b1d2 f8e7 e2e4 d5e4 d3e4 e8g8',
  'g1f3 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 d2d4 e8g8 f1e2 e7e5 e1g1 b8c6',
  'g1f3 g8f6 g2g3 g7g6 f1g2 f8g7 e1g1 e8g8 d2d3 d7d6 e2e4 e7e5 b1c3 b8c6',
  'g1f3 c7c5 c2c4 b8c6 b1c3 e7e5 g2g3 g7g6 f1g2 f8g7 e1g1 g8e7',
  'g1f3 g8f6 c2c4 e7e6 b1c3 d7d5 d2d4 f8e7 c1g5 e8g8 e2e3 h7h6 g5h4 b7b6',
  'f2f4 d7d5 g1f3 g8f6 e2e3 g7g6 f1e2 f8g7 e1g1 e8g8 d2d3 c7c5 b1c3 b8c6',
  'f2f4 d7d5 g1f3 g8f6 e2e3 c8g4 f1e2 e7e6 e1g1 b8d7 b2b3 f8d6 c1b2 e8g8',
  'b2b3 e7e5 c1b2 b8c6 e2e3 d7d5 f1b5 f8d6 f2f4 d8h4 g2g3 h4e7 g1f3 c8g4',
  'b2b3 d7d5 c1b2 g8f6 e2e3 e7e6 g1f3 f8e7 f1e2 e8g8 e1g1 c7c5 d2d3 b8c6',
  'b1c3 d7d5 e2e4 d5e4 c3e4 g8f6 e4g3 e7e5 g1f3 b8c6 f1b5 f8d6',
  'b1c3 d7d5 d2d4 g8f6 c1f4 c7c6 g1f3 c8f5 e2e3 e7e6 f1d3 f5d3 d1d3 f8e7',
  'g2g3 d7d5 f1g2 g8f6 g1f3 c7c6 e1g1 c8f5 d2d3 e7e6 b1d2 f8e7',
  'a2a3 d7d5 g1f3 g8f6 d2d4 e7e6 c2c4 f8e7 e2e3 e8g8',
  'b2b4 e7e5 c1b2 f8b4 b2e5 g8f6 g1f3 b8c6 e5b2 d7d5'
];
let BOOK = null;
function bookSet() {
  if (BOOK) return BOOK;
  BOOK = new Set();
  BOOK.bad = [];
  for (const line of BOOK_LINES) {
    let s = newState();
    for (const u of line.split(' ')) {
      const m = uciToMove(s, u);
      if (!m) { BOOK.bad.push(line + '  <-- falhou em ' + u); break; }
      s = apply(s, m);
      BOOK.add(posKey(s));
    }
  }
  return BOOK;
}
// Para cada lance da partida: ainda estamos "no livro"? (uma vez que sai, não volta)
function bookFlags(plies) {
  const set = bookSet();
  let on = true;
  return plies.map(p => (on = on && set.has(posKey(apply(p.before, p.move)))));
}

// ---------- classificação (usada tanto pelo motor interno quanto pelo Stockfish) ----------
// Quanto material o lance entrega "de graça" (após as trocas de captura).
function sacrifice(before, m) {
  if (m.promo) return 0;
  return matEval(before) + qsearch(apply(before, m), -Infinity, Infinity, 0, matEval);
}

// c: {bestScore, playedScore, secondScore|null, isTop, forced, sac, recap, prevLoss, book}
// Notas em centipeões do ponto de vista de quem jogou.
function classifyMove(c) {
  const wb = winPct(c.bestScore), wp = winPct(Math.min(c.playedScore, c.bestScore));
  const loss = Math.max(0, wb - wp);
  if (c.book) return {cls: 'book', loss: 0};
  let cls;
  if (c.forced || c.isTop || loss <= 0.3) cls = 'best';
  else if (loss <= 2) cls = 'excellent';
  else if (loss <= 5) cls = 'good';
  else if (loss <= 10) cls = 'inaccuracy';
  else if (loss <= 20) cls = 'mistake';
  else cls = 'blunder';
  // Miss: o adversário errou e você deixou a vantagem escapar
  if ((cls === 'inaccuracy' || cls === 'mistake') && c.prevLoss >= 10 && wb >= 65) cls = 'miss';
  if (!c.forced && (cls === 'best' || cls === 'excellent') && loss <= 1.5) {
    if (c.sac >= 200 && wp >= 45 && (c.secondScore === null || winPct(c.secondScore) < 85)) cls = 'brilliant';
    else if (c.secondScore !== null && wb > 5 && wb < 95 && !c.recap && wb - winPct(c.secondScore) >= 15) cls = 'great';
  }
  return {cls, loss};
}

// Motor interno: avalia um lance jogado.
function analyzeMove(before, m, recapSq, depth, extra) {
  depth = depth || 3; extra = extra || {};
  const R = rootSearch(before, depth, 200);
  const key = x => x.from + '-' + x.to + '-' + (x.promo || '');
  const mk = key(m);
  const entry = R.list.find(e => key(e.m) === mk);
  const playedScore = entry.exact ? entry.score
    : -negamax(apply(before, entry.m), depth - 1, -Infinity, Infinity, 1);
  const isTop = key(R.best) === mk;
  const others = R.list.filter(e => key(e.m) !== key(R.best) && e.exact);
  const secondScore = isTop ? (others.length ? Math.max(...others.map(e => e.score)) : R.bestScore - 200) : R.bestScore;
  const r = classifyMove({bestScore: R.bestScore, playedScore, secondScore, isTop, forced: R.list.length === 1,
    sac: sacrifice(before, m), recap: recapSq === m.to, prevLoss: extra.prevLoss || 0, book: extra.book});
  return {cls: r.cls, loss: r.loss, best: {from: R.best.from, to: R.best.to, promo: R.best.promo || null},
    bestScore: R.bestScore, playedScore};
}
//ENDENGINE

if (typeof document === 'undefined') { module.exports = {newState, legalMoves, apply, perft, insufficient, canMate, evaluate, rootSearch, analyzeMove, classifyMove, winPct, MATE, bookSet, toFEN}; }
else {
/* ===== INTERFACE ===== */
const $ = s => document.querySelector(s);
const side = c => c === 'w' ? 'brancas' : 'pretas';
const Side = c => c === 'w' ? 'Brancas' : 'Pretas';
const ANA_DEPTH = 3;   // profundidade do motor interno (reserva)
/* ===== STOCKFISH ===== */
// Fontes do Stockfish, em ordem de tentativa: arquivo 'stockfish.js' na mesma pasta do site (opcional)
// e depois a cópia pública do cdnjs. Se nenhuma carregar, usa-se o motor interno.
const SF_SOURCES = window.SF_SOURCES || ['stockfish.js', 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js'];
const SF_DEPTH = window.SF_DEPTH || 12;   // maior = análise mais precisa e mais lenta

/* ===== MODOS DE JOGO (minutos + incremento em segundos; min 0 = sem relógio) ===== */
const MODES = [[1,0],[2,1],[3,0],[3,2],[5,0],[10,0],[15,10],[30,0],[0,0]].map(([min, inc]) => ({min, inc}));
const CATS = ['Bullet', 'Blitz', 'Rápida', 'Clássica', 'Livre'];
const tcOf = m => m.min ? {min: m.min, inc: m.inc} : null;
function catOf(t) {
  if (!t) return 'Livre';
  const s = t.min * 60 + t.inc * 40; // tempo estimado de uma partida, em segundos
  return s < 180 ? 'Bullet' : s < 480 ? 'Blitz' : s < 1500 ? 'Rápida' : 'Clássica';
}
const tcLabel = t => t ? (t.inc ? `${t.min} | ${t.inc}` : `${t.min} min`) : 'Sem relógio';
const modeTitle = t => t ? `${catOf(t)} · ${tcLabel(t)}` : 'Sem relógio';

/* ===== CLASSIFICAÇÃO DOS LANCES ===== */
const CLS = {
  brilliant:  {label: 'Brilliant',  sym: '!!', color: '#26c2a3'},
  great:      {label: 'Great Move', sym: '!',  color: '#5b8bd9'},
  book:       {label: 'Book',       sym: '📖', color: '#a88865'},
  best:       {label: 'Best',       sym: '⭐', color: '#8cc152'},
  excellent:  {label: 'Excellent',  sym: '👍', color: '#6fb98f'},
  good:       {label: 'Good',       sym: '🙂', color: '#a3b18a'},
  inaccuracy: {label: 'Inaccuracy', sym: '?!', color: '#f2c14e'},
  mistake:    {label: 'Mistake',    sym: '?',  color: '#f08c3c'},
  miss:       {label: 'Miss',       sym: '✖',  color: '#ff7769'},
  blunder:    {label: 'Blunder',    sym: '??', color: '#e5484d'}
};
const CLS_ORDER = ['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'miss', 'blunder'];

let st, mode, me = 'w', sel = null, targets = [], last = null, over = false;
let caps = {w: [], b: []}, history = [], peer = null, conn = null;
let tc = null, clock = {w: 0, b: 0}, lastTick = 0, timer = null;
let marks = [], drag = null;
let dnd = null, ghost = null, raf = 0;            // arrastar peças
let preOn = false, pre = [];                       // pré-moves
let plies = [], ana = null, rv = null, anaToken = 0; // análise / revisão
let chosen = MODES.find(m => m.min === 5 && m.inc === 0);
let roomTc = null;

/* ===== MENU: escolha do modo ===== */
function buildModes() {
  const box = $('#modes');
  box.innerHTML = '';
  for (const cat of CATS) {
    const list = MODES.filter(m => catOf(tcOf(m)) === cat);
    if (!list.length) continue;
    const g = document.createElement('div');
    g.className = 'mode-group';
    g.innerHTML = `<span class="mode-cat">${cat}</span>`;
    const wrap = document.createElement('div');
    wrap.className = 'mode-btns';
    for (const m of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mode' + (m === chosen ? ' on' : '');
      b.textContent = m.min ? tcLabel(m) : 'Sem relógio';
      b.setAttribute('aria-pressed', m === chosen);
      b.onclick = () => { chosen = m; buildModes(); };
      wrap.appendChild(b);
    }
    g.appendChild(wrap);
    box.appendChild(g);
  }
}

/* ===== RELÓGIO ===== */
function fmtClock(ms) {
  ms = Math.max(0, ms);
  if (ms < 10000) return (ms / 1000).toFixed(1);
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

function updateClocks() {
  if (!st) return;
  for (const [el, col] of [['#topPlayer', opp(me)], ['#botPlayer', me]]) {
    const c = $(el).querySelector('.clock');
    c.textContent = tc ? fmtClock(clock[col]) : '';
    c.classList.toggle('run', !!tc && !over && st.turn === col);
    c.classList.toggle('low', !!tc && clock[col] < 10000);
  }
}

/* O tempo só desconta de quem está na vez. */
function tick() {
  if (!tc || over || !st) return;
  const now = performance.now(), dt = now - lastTick;
  lastTick = now;
  clock[st.turn] -= dt;
  if (clock[st.turn] <= 0) { clock[st.turn] = 0; updateClocks(); timeout(st.turn, true); }
  else updateClocks();
}

function timeout(loser, notify) {
  if (over) return;
  if (notify && mode === 'net' && conn && conn.open) conn.send({t: 'timeout', loser});
  const winner = opp(loser);
  const who = mode === 'local' ? `O tempo das ${side(loser)} acabou.`
    : loser === me ? 'Seu tempo acabou.' : 'O tempo do seu amigo acabou.';
  if (!canMate(st.board, winner)) finish('Empate', who + ' Mas o adversário não tem material para dar mate.', null);
  else finish('Tempo esgotado', who, winner);
}

/* ===== TELA DE FIM DE JOGO ===== */
function outcome(winner) {
  if (winner === null) return 'A partida terminou empatada.';
  if (mode === 'local') return `${Side(winner)} vencem.`;
  return winner === me ? 'Você venceu!' : 'Seu amigo venceu.';
}

function finish(title, detail, winner) {
  if (over) return;
  over = true; sel = null; targets = []; pre = [];
  cancelDrag();
  $('#promo').hidden = true;
  const out = outcome(winner);
  setStatus(`${title}. ${out}`);
  $('#overTitle').textContent = title;
  $('#overDetail').textContent = detail;
  $('#overOutcome').textContent = out;
  $('#overIcon').textContent = winner === null ? '½' : '♚';
  const k = winner === null ? 'draw' : (mode === 'net' ? (winner === me ? 'win' : 'lose') : 'win');
  $('#overBox').className = 'box result ' + k;
  $('#btnOverAnalyze').hidden = $('#btnAnalyze').hidden = !plies.length;
  $('#over').hidden = false;
  render();
  $('#btnOverNew').focus();
}

/* ===== PRÉ-MOVES ===== */
const preActive = () => preOn && mode === 'net' && !over && !rv && st && st.turn !== me;

// Posição "imaginada": aplica os pré-moves na ordem, supondo que o adversário não mexe nas suas peças.
function virtualState() {
  let v = {board: st.board.slice(), turn: me, castle: Object.assign({}, st.castle), ep: null, half: 0};
  for (const p of pre) {
    const mv = pseudo(v).find(x => x.from === p.from && x.to === p.to && (x.promo || null) === (p.promo || null));
    if (!mv) break;
    v = Object.assign(apply(v, mv), {turn: me, ep: null});
  }
  return v;
}

// Lances que a peça em i pode fazer (na vez dela, ou como pré-move).
function movesFrom(c, i) {
  if (!preActive()) return legalMoves(c).filter(m => m.from === i);
  return pseudo(c).filter(m => m.from === i && !(c.board[m.to] && c.board[m.to][1] === 'K'));
}

function queuePremove(m) {
  pre.push(m.promo ? {from: m.from, to: m.to, promo: 'Q'} : {from: m.from, to: m.to}); // promoção automática: dama
  sel = null; targets = [];
  render();
}

function execPremove() {
  if (!pre.length || over || mode !== 'net' || st.turn !== me) return;
  const p = pre.shift();
  const m = legalMoves(st).find(x => x.from === p.from && x.to === p.to && (x.promo || null) === (p.promo || null));
  if (m) play(m);
  else { pre = []; render(); }   // pré-move ficou ilegal: cancela a fila
}

function clearPre() { pre = []; sel = null; targets = []; render(); }

function updatePreUI() {
  const b = $('#btnPre');
  b.hidden = mode !== 'net';
  b.textContent = 'Pré-moves: ' + (preOn ? 'ON' : 'OFF');
  b.classList.toggle('on', preOn);
  b.setAttribute('aria-pressed', preOn);
  $('#btnPreClear').hidden = !(mode === 'net' && pre.length);
}

/* ===== TABULEIRO ===== */
function reviewView() {   // posição mostrada na revisão (após o lance i, ou antes dele no modo "alternativa")
  const idx = rv.alt ? rv.i - 1 : rv.i;
  return {
    state: idx >= plies.length ? st : plies[idx].before,
    last: idx >= 1 ? plies[idx - 1].move : null
  };
}

function render() {
  const board = $('#board'), flip = me === 'b';
  board.innerHTML = '';
  let vb = st.board, lastM = last, chk;
  const preSq = new Set();
  if (rv) {
    const v = reviewView();
    vb = v.state.board; lastM = v.last;
    chk = inCheck(v.state, v.state.turn) ? kingSq(v.state.board, v.state.turn) : -1;
  } else if (preActive() && pre.length) {
    vb = virtualState().board; chk = -1;
    for (const p of pre) { preSq.add(p.from); preSq.add(p.to); }
  } else chk = inCheck(st, st.turn) ? kingSq(st.board, st.turn) : -1;

  for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
    const r = flip ? 7 - dr : dr, c = flip ? 7 - dc : dc, i = r * 8 + c, p = vb[i];
    const d = document.createElement('div');
    d.className = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
    if (lastM && (i === lastM.from || i === lastM.to)) d.classList.add('last');
    if (preSq.has(i)) d.classList.add('pre');
    if (i === sel) d.classList.add('sel');
    if (i === chk) d.classList.add('chk');
    const t = targets.find(m => m.to === i);
    if (t) d.classList.add('mv', ...(p || t.ep ? ['cap'] : []));
    d.dataset.i = i;
    const lift = dnd && dnd.moved && i === dnd.from;
    if (p) d.innerHTML = `<span class="p ${p[0]}${lift ? ' lift' : ''}">${GL[p[1]]}\uFE0E</span>`;
    if (dc === 0) d.insertAdjacentHTML('beforeend', `<span class="co r">${8 - r}</span>`);
    if (dr === 7) d.insertAdjacentHTML('beforeend', `<span class="co f">${'abcdefgh'[c]}</span>`);
    board.appendChild(d);
  }
  const top = opp(me), names = mode === 'local' ? {w: 'Brancas', b: 'Pretas'}
    : {[me]: 'Você', [opp(me)]: 'Amigo'};
  for (const [el, col] of [['#topPlayer', top], ['#botPlayer', me]]) {
    const e = $(el);
    e.querySelector('.name').textContent = `${names[col]} (${col === 'w' ? 'brancas' : 'pretas'})`;
    e.querySelector('.caps').textContent = caps[col].map(x => GL[x[1]]).join('');
    e.classList.toggle('turn', !over && st.turn === col);
  }
  $('#moves').innerHTML = history.map(h => `<li>${h}</li>`).join('');
  $('#moves').scrollTop = 1e6;
  updateClocks();
  drawMarks();
  updatePreUI();
}

function setStatus(t) { $('#status').textContent = t; }

function updateStatus() {
  const moves = legalMoves(st), chk = inCheck(st, st.turn);
  if (!moves.length) {
    if (chk) finish('Xeque-mate', 'O rei não tem como escapar.', opp(st.turn));
    else finish('Empate por afogamento', 'Quem joga não tem lances legais, mas o rei não está em xeque.', null);
  } else if (insufficient(st.board)) {
    finish('Empate por material insuficiente', 'Nenhum dos lados tem peças suficientes para dar mate.', null);
  } else if (st.half >= 100) {
    finish('Empate pela regra dos 50 lances', '50 lances sem captura nem movimento de peão.', null);
  } else {
    const mine = mode === 'local' || st.turn === me;
    const turnTxt = mode === 'local' ? `Vez das ${side(st.turn)}.` : (mine ? 'Sua vez.' : `Vez do amigo (${Side(st.turn)}).`);
    setStatus((chk ? 'Xeque! ' : '') + turnTxt);
  }
}

function moveText(before, m) {
  if (m.castle) return m.castle === 'K' ? 'O-O' : 'O-O-O';
  const piece = before.board[m.from], cap = m.ep || before.board[m.to];
  return (piece[1] === 'P' ? '' : piece[1]) + sqName(m.from) + (cap ? 'x' : '-') + sqName(m.to) + (m.promo ? '=' + m.promo : '');
}

function click(i) {
  if (over || rv) return;
  const pa = preActive();
  if (mode === 'net' && st.turn !== me && !pa) return;
  const c = pa ? virtualState() : st;
  const p = c.board[i];
  const ms = targets.filter(m => m.to === i);
  if (sel !== null && ms.length) {
    if (pa) return queuePremove(ms[0]);
    if (ms[0].promo) return askPromo(ms);
    return play(ms[0]);
  }
  if (p && p[0] === c.turn) { sel = i; targets = movesFrom(c, i); }
  else { sel = null; targets = []; }
  render();
}

function askPromo(ms) {
  const box = $('#promoBtns'); box.innerHTML = '';
  for (const m of ms) {
    const b = document.createElement('button');
    b.textContent = GL[m.promo] + '\uFE0E';
    b.onclick = () => { $('#promo').hidden = true; play(m); };
    box.appendChild(b);
  }
  $('#promo').hidden = false;
}

function play(m, remote, clk) {
  if (over) return;
  cancelDrag();
  const mover = st.turn;
  if (tc) {
    tick();
    if (over) return; // o tempo acabou antes do lance
    if (remote) { if (typeof clk === 'number' && clk >= 0) clock[mover] = clk; }
    else clock[mover] += tc.inc * 1000;
    lastTick = performance.now();
  }
  const txt = moveText(st, m), n = apply(st, m);
  if (n.captured) caps[mover].push(n.captured);
  history.push(txt);
  plies.push({before: st, move: m, txt, mover, cap: !!n.captured});
  st = n; last = m; sel = null; targets = []; marks = [];
  updateStatus(); render();
  if (!remote && mode === 'net' && conn && conn.open)
    conn.send({t: 'move', from: m.from, to: m.to, promo: m.promo || null, clk: Math.round(clock[mover])});
}

function startGame(m, color, newTc) {
  mode = m; me = color || 'w'; tc = newTc || null;
  cancelDrag();
  st = newState(); sel = null; targets = []; last = null; marks = []; drag = null;
  over = false; caps = {w: [], b: []}; history = [];
  plies = []; ana = null; rv = null; anaToken++; pre = [];
  const t0 = tc ? tc.min * 60000 : 0;
  clock = {w: t0, b: t0};
  lastTick = performance.now();
  clearInterval(timer);
  timer = setInterval(tick, 100);
  $('#over').hidden = true; $('#promo').hidden = true;
  $('#analysis').hidden = true; $('#moves').hidden = false; $('#btnAnalyze').hidden = true;
  $('#lobby').hidden = true; $('#game').hidden = false;
  $('#modeTag').textContent = modeTitle(tc);
  updateStatus(); render();
}

function endByResign(loser) {
  const detail = mode === 'local' ? `${Side(loser)} desistiram.`
    : loser === me ? 'Você desistiu da partida.' : 'Seu amigo desistiu da partida.';
  finish('Desistência', detail, opp(loser));
}

/* ===== ANÁLISE DA PARTIDA ===== */
const fmtEval = cp => Math.abs(cp) > MATE - 200 ? (cp > 0 ? '+Mate' : '−Mate')
  : (cp > 0 ? '+' : cp < 0 ? '−' : '') + Math.abs(cp / 100).toFixed(1);

function setProgress(f) {
  $('#anaBar').style.width = (f * 100) + '%';
  $('#anaPct').textContent = Math.round(f * 100) + '%';
}

function setAnaMsg(s) { $('#anaMsg').textContent = s; }
const tick0 = () => new Promise(r => setTimeout(r, 0));

function makeWorker(src) {
  // Scripts de outro domínio não podem ser Worker direto; um Worker "ponte" (Blob) importa o script.
  const url = /^https?:/i.test(src)
    ? URL.createObjectURL(new Blob(['importScripts(' + JSON.stringify(src) + ');'], {type: 'text/javascript'}))
    : src;
  return new Worker(url);
}

// Tenta cada fonte até uma responder ao protocolo UCI. Resolve com o Worker pronto (ou null).
function startStockfish() {
  return new Promise(resolve => {
    let i = 0;
    const tryNext = () => {
      if (i >= SF_SOURCES.length) return resolve(null);
      const src = SF_SOURCES[i++];
      let w = null, done = false, timer = 0;
      const fail = () => {
        if (done) return;
        done = true; clearTimeout(timer);
        try { w && w.terminate(); } catch (_) {}
        tryNext();
      };
      try { w = makeWorker(src); } catch (_) { return fail(); }
      w.onerror = fail;
      timer = setTimeout(fail, 30000);
      w.onmessage = e => {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line.indexOf('uciok') === 0) { w.postMessage('setoption name MultiPV value 2'); w.postMessage('isready'); }
        else if (line.indexOf('readyok') === 0 && !done) { done = true; clearTimeout(timer); w.onerror = null; resolve(w); }
      };
      w.postMessage('uci');
    };
    tryNext();
  });
}

// Analisa uma posição (FEN). Resolve com {1: {move, score}, 2: {...}} (nota em centipeões de quem joga).
function sfAnalyze(w, fen, depth) {
  return new Promise((resolve, reject) => {
    const pv = {};
    const timer = setTimeout(() => reject(new Error('timeout')), 60000);
    w.onerror = () => { clearTimeout(timer); reject(new Error('worker')); };
    w.onmessage = e => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line.indexOf('info') === 0 && line.indexOf(' pv ') > 0 && line.indexOf(' score ') > 0) {
        if (/ (lowerbound|upperbound)/.test(line)) return;
        const sc = line.match(/ score (cp|mate) (-?\d+)/), mv = line.match(/ pv (\S+)/);
        const mp = +((line.match(/ multipv (\d+)/) || [])[1] || 1);
        if (!sc || !mv) return;
        const v = +sc[2];
        pv[mp] = {move: mv[1], score: sc[1] === 'cp' ? v : Math.sign(v) * (MATE - Math.abs(v))};
      } else if (line.indexOf('bestmove') === 0) { clearTimeout(timer); resolve(pv); }
    };
    w.postMessage('position fen ' + fen);
    w.postMessage('go depth ' + depth);
  });
}

async function analyzeWithStockfish(w, token) {
  const n = plies.length, pvs = [];
  for (let k = 0; k <= n; k++) {
    if (token !== anaToken) return null;
    const s = k < n ? plies[k].before : st;
    pvs.push(legalMoves(s).length ? await sfAnalyze(w, toFEN(s, Math.floor(k / 2) + 1), SF_DEPTH) : null);
    setProgress((k + 1) / (n + 1));
  }
  const flags = bookFlags(plies), res = [];
  let prevLoss = 0;
  for (let k = 0; k < n; k++) {
    const p = plies[k], A = pvs[k], B = pvs[k + 1], u = moveToUci(p.move);
    if (!A || !A[1]) throw new Error('sem avaliação');
    const afterState = k + 1 < n ? plies[k + 1].before : st;
    const isTop = A[1].move === u;
    let playedScore;
    if (isTop) playedScore = A[1].score;
    else if (A[2] && A[2].move === u) playedScore = A[2].score;
    else if (B && B[1]) playedScore = -B[1].score;
    else playedScore = inCheck(afterState, afterState.turn) ? MATE - 1 : 0;   // mate dado ou afogamento
    const secondScore = isTop ? (A[2] ? A[2].score : null) : A[1].score;
    const prev = k ? plies[k - 1] : null;
    const r = classifyMove({bestScore: A[1].score, playedScore, secondScore, isTop, forced: legalMoves(p.before).length === 1,
      sac: sacrifice(p.before, p.move), recap: !!(prev && prev.cap && prev.move.to === p.move.to), prevLoss, book: flags[k]});
    prevLoss = r.loss;
    const bm = uciToMove(p.before, A[1].move) || p.move;
    res.push({cls: r.cls, loss: r.loss, best: {from: bm.from, to: bm.to, promo: bm.promo || null},
      bestScore: A[1].score, playedScore});
  }
  return res;
}

async function analyzeBuiltin(token) {
  const flags = bookFlags(plies), res = [];
  let prevLoss = 0;
  for (let k = 0; k < plies.length; k++) {
    if (token !== anaToken) return null;
    const prev = k ? plies[k - 1] : null;
    const r = analyzeMove(plies[k].before, plies[k].move, prev && prev.cap ? prev.move.to : -1, ANA_DEPTH, {prevLoss, book: flags[k]});
    prevLoss = r.loss;
    res.push(r);
    setProgress((k + 1) / plies.length);
    await tick0();
  }
  return res;
}

async function startAnalysis() {
  if (!over || !plies.length) return;
  $('#over').hidden = true;
  $('#analysis').hidden = false; $('#moves').hidden = true;
  sel = null; targets = [];
  rv = {i: plies.length, alt: false};
  render();
  $('#analysis').scrollIntoView({block: 'start'});
  if (ana) return showAnalysis();
  $('#anaProgress').hidden = false; $('#anaBody').hidden = true;
  setProgress(0);
  setAnaMsg('Carregando o Stockfish...');
  const token = ++anaToken;
  let res = null, engine = '';
  const w = await startStockfish();
  if (token !== anaToken) { if (w) w.terminate(); return; }
  if (w) {
    setAnaMsg(`Analisando com o Stockfish (profundidade ${SF_DEPTH})...`);
    try { res = await analyzeWithStockfish(w, token); engine = `Stockfish (profundidade ${SF_DEPTH})`; }
    catch (_) { res = null; }
    w.terminate();
    if (token !== anaToken) return;
  }
  if (!res) {
    setAnaMsg(w ? 'O Stockfish falhou. Usando o motor interno...' : 'Não foi possível carregar o Stockfish. Usando o motor interno (mais simples)...');
    setProgress(0);
    await tick0();
    res = await analyzeBuiltin(token);
    if (!res) return;
    engine = 'Motor interno (mais simples que o Stockfish)';
  }
  ana = summarize(res);
  ana.engine = engine;
  showAnalysis();
}

function summarize(res) {
  const evalsW = [], acc = {w: [], b: []}, counts = {w: {}, b: {}};
  res.forEach((r, k) => {
    const c = plies[k].mover;
    if (k === 0) evalsW.push(c === 'w' ? r.bestScore : -r.bestScore);
    evalsW.push(c === 'w' ? r.playedScore : -r.playedScore);
    acc[c].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * r.loss) - 3.1669)));
    counts[c][r.cls] = (counts[c][r.cls] || 0) + 1;
  });
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return {moves: res, evalsW, acc: {w: avg(acc.w), b: avg(acc.b)}, counts};
}

function showAnalysis() {
  $('#anaProgress').hidden = true; $('#anaBody').hidden = false;
  $('#anaEngine').textContent = 'Engine: ' + ana.engine;
  const nm = c => Side(c) + (mode === 'net' && c === me ? ' (você)' : '');
  let h = `<table class="ana-table"><tr><th></th><th>${nm('w')}</th><th>${nm('b')}</th></tr>`;
  const pct = v => v === null ? '–' : v.toFixed(1) + '%';
  h += `<tr class="accrow"><td>Precisão</td><td>${pct(ana.acc.w)}</td><td>${pct(ana.acc.b)}</td></tr>`;
  for (const k of CLS_ORDER) {
    const a = ana.counts.w[k] || 0, b = ana.counts.b[k] || 0;
    if (!a && !b) continue;
    h += `<tr><td><span class="sym" style="--c:${CLS[k].color}">${CLS[k].sym}</span> ${CLS[k].label}</td><td>${a}</td><td>${b}</td></tr>`;
  }
  $('#anaSummary').innerHTML = h + '</table>';

  // gráfico de vantagem (parte clara = vantagem das brancas)
  const n = ana.evalsW.length, W = 300, H = 90;
  const x = i => n > 1 ? i * W / (n - 1) : 0, y = cp => H - winPct(cp) / 100 * H;
  const pts = ana.evalsW.map((cp, i) => `${x(i).toFixed(1)},${y(cp).toFixed(1)}`).join(' ');
  let g = `<rect width="${W}" height="${H}" fill="#14110f"/><polygon points="0,${H} ${pts} ${W},${H}" fill="#efe6d8" opacity=".92"/>`
    + `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#7a6f60" stroke-width=".6" stroke-dasharray="3 3"/>`
    + `<polyline points="${pts}" fill="none" stroke="#f2c14e" stroke-width="1.4"/>`;
  ana.moves.forEach((r, k) => {
    if (['brilliant', 'great', 'mistake', 'miss', 'blunder'].includes(r.cls))
      g += `<circle cx="${x(k + 1).toFixed(1)}" cy="${y(ana.evalsW[k + 1]).toFixed(1)}" r="2.6" fill="${CLS[r.cls].color}" stroke="#14110f" stroke-width=".6"/>`;
  });
  g += `<line id="gcur" y1="0" y2="${H}" stroke="#f2c14e" stroke-width="1"/>`;
  $('#anaGraph').innerHTML = g;

  let m = '';
  const cell = k => `<button class="ply" data-i="${k + 1}" style="--c:${CLS[ana.moves[k].cls].color}">${plies[k].txt}<b>${CLS[ana.moves[k].cls].sym}</b></button>`;
  for (let k = 0; k < plies.length; k += 2)
    m += `<div class="prow"><span class="num">${k / 2 + 1}.</span>${cell(k)}${k + 1 < plies.length ? cell(k + 1) : ''}</div>`;
  $('#anaMoves').innerHTML = m;
  goReview(rv ? rv.i : plies.length, false);
}

function goReview(i, alt) {
  if (!ana) return;
  i = Math.max(0, Math.min(plies.length, i));
  rv = {i, alt: !!alt && i > 0};
  sel = null; targets = [];
  render();
  // gráfico e lista
  const n = ana.evalsW.length, cur = $('#anaGraph').querySelector('#gcur');
  if (cur) { const xx = n > 1 ? i * 300 / (n - 1) : 0; cur.setAttribute('x1', xx); cur.setAttribute('x2', xx); }
  const box = $('#anaMoves');
  box.querySelectorAll('.ply').forEach(b => b.classList.toggle('cur', +b.dataset.i === i));
  const c = box.querySelector('.ply.cur');
  if (c) box.scrollTop = c.offsetTop - box.clientHeight / 2 + c.offsetHeight / 2;
  // informação do lance
  const info = $('#anaInfo'), altBtn = $('#btnAlt');
  if (i === 0) {
    info.innerHTML = `<b>Posição inicial</b><br><span class="muted">Avaliação: ${fmtEval(ana.evalsW[0])}</span>`;
    altBtn.hidden = true;
    return;
  }
  const k = i - 1, r = ana.moves[k], cl = CLS[r.cls], p = plies[k];
  const same = r.best.from === p.move.from && r.best.to === p.move.to && (r.best.promo || null) === (p.move.promo || null);
  const bm = legalMoves(p.before).find(x => x.from === r.best.from && x.to === r.best.to && (x.promo || null) === (r.best.promo || null));
  const bestTxt = bm ? moveText(p.before, bm) : '?';
  info.innerHTML = `<span class="sym big" style="--c:${cl.color}">${cl.sym}</span> <b>${p.txt}</b> — <b style="color:${cl.color}">${cl.label}</b>`
    + `${!same && !['book', 'brilliant', 'great'].includes(r.cls) ? `<br>Melhor era <b>${bestTxt}</b>.` : ''}<br>`
    + `<span class="muted">Avaliação: ${fmtEval(ana.evalsW[i])}</span>`;
  altBtn.hidden = same;
  altBtn.textContent = rv.alt ? 'Voltar ao lance jogado' : 'Mostrar melhor lance';
}

function closeAnalysis() {
  rv = null;
  $('#analysis').hidden = true; $('#moves').hidden = false;
  render();
}

/* ===== SETAS E CÍRCULOS (só visuais; não afetam a partida) ===== */
const MARK_COLORS = {normal: '#ff9a1f', shift: '#e5484d', alt: '#3b82f6'};
const colorOf = e => e.shiftKey ? MARK_COLORS.shift : (e.altKey || e.ctrlKey) ? MARK_COLORS.alt : MARK_COLORS.normal;

function sqAtXY(cx, cy) {
  const b = $('#board'), r = b.getBoundingClientRect(), w = b.clientWidth / 8;
  const x = Math.floor((cx - r.left - b.clientLeft) / w);
  const y = Math.floor((cy - r.top - b.clientTop) / w);
  if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
  return me === 'b' ? (7 - y) * 8 + (7 - x) : y * 8 + x;
}
const sqAt = e => sqAtXY(e.clientX, e.clientY);

function toggleMark({from, to, color}) {
  const type = from === to ? 'circle' : 'arrow';
  const i = marks.findIndex(m => m.type === type && m.from === from && m.to === to);
  if (i >= 0) { const same = marks[i].color === color; marks.splice(i, 1); if (same) return; }
  marks.push({type, from, to, color});
}

function reviewArrows() {   // revisão: seta verde = melhor lance, vermelha = o que foi jogado
  if (!rv || !rv.alt || !ana || rv.i < 1) return [];
  const r = ana.moves[rv.i - 1], p = plies[rv.i - 1].move, out = [];
  if (r.best.from !== p.from || r.best.to !== p.to) out.push({type: 'arrow', from: p.from, to: p.to, color: '#e5484d'});
  out.push({type: 'arrow', from: r.best.from, to: r.best.to, color: '#4caf50'});
  return out;
}

function drawMarks() {
  const svg = $('#marks');
  if (!svg || !st) return;
  const pos = i => { let r = i >> 3, c = i & 7; if (me === 'b') { r = 7 - r; c = 7 - c; } return [c + .5, r + .5]; };
  const list = marks.concat(reviewArrows());
  if (drag) list.push({type: drag.from === drag.to ? 'circle' : 'arrow', from: drag.from, to: drag.to, color: drag.color});
  let h = '';
  for (const m of list) {
    const [x1, y1] = pos(m.from);
    if (m.type === 'circle') {
      h += `<circle cx="${x1}" cy="${y1}" r=".44" fill="none" stroke="${m.color}" stroke-width=".085" opacity=".85"/>`;
      continue;
    }
    const [x2, y2] = pos(m.to), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const hl = .42, hw = .5;
    const tx = x2 - ux * .12, ty = y2 - uy * .12;      // ponta
    const bx = tx - ux * hl, by = ty - uy * hl;        // base da ponta
    const sx = x1 + ux * .18, sy = y1 + uy * .18;      // início
    h += `<g opacity=".85"><line x1="${sx}" y1="${sy}" x2="${bx}" y2="${by}" stroke="${m.color}" stroke-width=".17" stroke-linecap="round"/>`
      + `<polygon fill="${m.color}" points="${tx},${ty} ${bx - uy * hw / 2},${by + ux * hw / 2} ${bx + uy * hw / 2},${by - ux * hw / 2}"/></g>`;
  }
  svg.innerHTML = h;
}

/* ===== ARRASTAR PEÇAS (com um balanço sutil, como se a peça tivesse peso) ===== */
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sqEl = i => $(`#board [data-i="${i}"]`);
const placeGhost = () => {
  ghost.style.transform = `translate(${dnd.x - dnd.size / 2}px,${dnd.y + dnd.oy - dnd.size / 2}px) rotate(${dnd.ang}deg) scale(1.1)`;
};

function startGhost(e) {
  const size = $('#board').clientWidth / 8, p = (preActive() ? virtualState() : st).board[dnd.from];
  ghost = document.createElement('div');
  ghost.className = 'dragpiece';
  ghost.style.width = ghost.style.height = size + 'px';
  ghost.style.fontSize = size * .78 + 'px';
  ghost.innerHTML = `<span class="p ${p[0]}">${GL[p[1]]}\uFE0E</span>`;
  document.body.appendChild(ghost);
  Object.assign(dnd, {moved: true, size, x: e.clientX, px: e.clientX, y: e.clientY, ang: 0, av: 0, vx: 0,
    hover: -1, t: performance.now(), oy: e.pointerType === 'touch' ? -size * .7 : 0});
  render();        // esconde a peça na casa de origem
  placeGhost();
  raf = requestAnimationFrame(stepGhost);
}

/* mola amortecida: a peça se inclina para o lado em que é puxada e balança de volta */
function stepGhost(now) {
  if (!dnd || !ghost) return;
  const dt = Math.min(.032, Math.max(.001, (now - dnd.t) / 1000));
  dnd.t = now;
  const vx = (dnd.x - dnd.px) / dt;
  dnd.px = dnd.x;
  dnd.vx += (vx - dnd.vx) * .25;
  const target = REDUCE ? 0 : Math.max(-20, Math.min(20, dnd.vx / 40));   // inclinação máxima (graus) e sensibilidade
  dnd.av += (-120 * (dnd.ang - target) - 7 * dnd.av) * dt;   // rigidez da mola e amortecimento
  dnd.ang += dnd.av * dt;
  placeGhost();
  raf = requestAnimationFrame(stepGhost);
}

function setHover(i) {
  if (dnd.hover === i) return;
  const old = sqEl(dnd.hover);
  if (old) old.classList.remove('drop');
  dnd.hover = i;
  if (i >= 0 && targets.some(m => m.to === i)) sqEl(i).classList.add('drop');
}

function cancelDrag() {
  cancelAnimationFrame(raf);
  dnd = null;
  if (ghost) { ghost.remove(); ghost = null; }
}

function snapBack(d) {   // solta em lugar inválido: a peça volta deslizando
  const g = ghost; ghost = null;
  render();
  const el = sqEl(d.from);
  if (!el) return g.remove();
  const r = el.getBoundingClientRect();
  g.style.transition = 'transform .14s ease-out';
  g.style.transform = `translate(${r.left + r.width / 2 - d.size / 2}px,${r.top + r.height / 2 - d.size / 2}px)`;
  setTimeout(() => g.remove(), 170);
}

function endDrag(e) {
  const d = dnd, pa = preActive();
  cancelAnimationFrame(raf);
  dnd = null;
  if (!d.moved) return click(d.from);          // foi só um clique
  const i = sqAtXY(e.clientX, e.clientY + d.oy);
  const ms = i >= 0 ? targets.filter(m => m.to === i) : [];
  if (!ms.length) return snapBack(d);
  ghost.remove(); ghost = null;
  if (pa) queuePremove(ms[0]);
  else if (ms[0].promo) { render(); askPromo(ms); }
  else play(ms[0]);
}

/* ===== PONTEIRO: peças (botão esquerdo) e setas (botão direito) ===== */
const boardEl = $('#board');
boardEl.addEventListener('contextmenu', e => e.preventDefault());
boardEl.addEventListener('pointerdown', e => {
  if (e.button === 0) {
    if (marks.length) { marks = []; drawMarks(); }
    if (dnd || rv) return;
    const i = sqAt(e);
    if (i < 0) return;
    dnd = {from: i, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, click: true};
    const pa = preActive();
    if (!over && !(mode === 'net' && st.turn !== me && !pa)) {
      const c = pa ? virtualState() : st, p = c.board[i];
      if (p && p[0] === c.turn) {     // pegou uma peça sua: seleciona e permite arrastar
        dnd.click = false;
        sel = i; targets = movesFrom(c, i);
        render();
      }
    }
    try { boardEl.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  } else if (e.button === 2) {
    const s = sqAt(e);
    if (s < 0) return;
    drag = {from: s, to: s, color: colorOf(e)};
    drawMarks();
    e.preventDefault();
  }
});
window.addEventListener('pointermove', e => {
  if (dnd && e.pointerId === dnd.id) {
    if (!dnd.moved) {
      if (dnd.click || Math.hypot(e.clientX - dnd.sx, e.clientY - dnd.sy) < 4) return;
      startGhost(e);
    }
    dnd.x = e.clientX; dnd.y = e.clientY;
    setHover(sqAtXY(dnd.x, dnd.y + dnd.oy));
    return;
  }
  if (!drag) return;
  const s = sqAt(e);
  if (s !== -1 && s !== drag.to) { drag.to = s; drawMarks(); }
});
window.addEventListener('pointerup', e => {
  if (dnd && e.button === 0 && e.pointerId === dnd.id) return endDrag(e);
  if (!drag || e.button !== 2) return;
  const d = drag; drag = null;
  const s = sqAt(e);
  if (s !== -1) { d.to = s; toggleMark(d); }
  drawMarks();
});
window.addEventListener('pointercancel', e => {
  if (dnd && e.pointerId === dnd.id) { cancelDrag(); render(); }
  if (drag) { drag = null; drawMarks(); }
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && pre.length) { clearPre(); return; }
  if (!rv || !ana || /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
  const keys = {ArrowLeft: rv.i - 1, ArrowRight: rv.i + 1, Home: 0, End: plies.length};
  if (e.key in keys) { goReview(keys[e.key], false); e.preventDefault(); }
});

/* ===== REDE (PeerJS: conexão direta entre os dois PCs) ===== */
function onData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'init') startGame('net', 'b', d.tc && d.tc.min ? {min: +d.tc.min, inc: +d.tc.inc || 0} : null);
  else if (!st) return;
  else if (d.t === 'move') {
    const m = legalMoves(st).find(x => x.from === d.from && x.to === d.to && (x.promo || null) === d.promo);
    if (m && !over && st.turn !== me) { play(m, true, d.clk); execPremove(); }
  } else if (d.t === 'resign') { if (!over) endByResign(opp(me)); }
  else if (d.t === 'timeout') { if (!over && (d.loser === 'w' || d.loser === 'b')) timeout(d.loser, false); }
  else if (d.t === 'new') startGame('net', opp(me), tc);
}

function onClose() {
  if (over || !st) return;
  finish('Partida encerrada', 'Seu amigo saiu da partida.', me);
}

function peerError(e) {
  $('#lobbyMsg').textContent = e.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.' : 'Erro de conexão: ' + e.type;
}

$('#btnCreate').onclick = () => {
  if (peer) peer.destroy();
  conn = null;
  roomTc = tcOf(chosen);
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  $('#roomInfo').textContent = 'Criando sala...';
  peer = new Peer('xadrez-' + code);
  peer.on('open', () => { $('#roomInfo').innerHTML = `Código: <b>${code}</b><br>Modo: ${modeTitle(roomTc)}. Envie o código ao amigo e aguarde ele entrar.`; });
  peer.on('connection', c => {
    if (conn) return c.close();
    conn = c;
    c.on('data', onData);
    c.on('close', onClose);
    const go = () => { c.send({t: 'init', tc: roomTc}); startGame('net', 'w', roomTc); };
    if (c.open) go(); else c.on('open', go);
  });
  peer.on('error', peerError);
};

$('#btnJoin').onclick = () => {
  const code = $('#codeInput').value.trim().toUpperCase();
  if (!code) return;
  if (peer) peer.destroy();
  $('#lobbyMsg').textContent = 'Conectando...';
  peer = new Peer();
  peer.on('open', () => {
    const c = peer.connect('xadrez-' + code, {reliable: true});
    conn = c;
    c.on('data', onData);   // a partida começa quando o anfitrião envia o modo (init)
    c.on('close', onClose);
  });
  peer.on('error', peerError);
};

$('#btnLocal').onclick = () => startGame('local', 'w', tcOf(chosen));

$('#btnResign').onclick = () => {
  if (over || !confirm('Desistir da partida?')) return;
  if (mode === 'net') { if (conn && conn.open) conn.send({t: 'resign'}); endByResign(me); }
  else endByResign(st.turn);
};

function newGame() {
  if (!over && !confirm('Começar nova partida?')) return;
  if (mode === 'net') {
    if (!conn || !conn.open) { $('#over').hidden = true; setStatus('O amigo não está mais conectado. Volte ao menu para criar outra sala.'); return; }
    conn.send({t: 'new'});
    startGame('net', opp(me), tc);
  } else startGame('local', 'w', tc);
}
$('#btnNew').onclick = newGame;
$('#btnOverNew').onclick = newGame;
$('#btnOverClose').onclick = () => { $('#over').hidden = true; };
$('#btnOverAnalyze').onclick = startAnalysis;
$('#btnAnalyze').onclick = startAnalysis;
$('#btnPre').onclick = () => {
  preOn = !preOn;
  if (!preOn) pre = [];
  sel = null; targets = [];
  render();
};
$('#btnPreClear').onclick = clearPre;
for (const b of document.querySelectorAll('.menu-btn'))
  b.onclick = () => { if (!over && !confirm('Voltar ao menu? A partida atual será perdida.')) return; location.reload(); };

/* painel de análise */
$('#btnFirst').onclick = () => goReview(0, false);
$('#btnPrev').onclick = () => goReview(rv.i - 1, false);
$('#btnNext').onclick = () => goReview(rv.i + 1, false);
$('#btnLast').onclick = () => goReview(plies.length, false);
$('#btnAlt').onclick = () => goReview(rv.i, !rv.alt);
$('#btnCloseAna').onclick = closeAnalysis;
$('#anaMoves').onclick = e => { const b = e.target.closest('.ply'); if (b) goReview(+b.dataset.i, false); };
$('#anaGraph').addEventListener('pointerdown', e => {
  if (!ana) return;
  const r = e.currentTarget.getBoundingClientRect();
  goReview(Math.round((e.clientX - r.left) / r.width * (ana.evalsW.length - 1)), false);
});

buildModes();
}
