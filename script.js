/* ===== LÓGICA DO XADREZ ===== */
const GL = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const opp = (c) => (c === 'w' ? 'b' : 'w');
const sqName = (i) => 'abcdefgh'[i % 8] + (8 - (i >> 3));

function newState() {
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
    b = Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    b[c] = 'b' + back[c];
    b[8 + c] = 'bP';
    b[48 + c] = 'wP';
    b[56 + c] = 'w' + back[c];
  }
  return { board: b, turn: 'w', castle: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: null, half: 0 };
}

function attacked(b, sq, by) {
  const r = sq >> 3,
    c = sq & 7,
    at = (rr, cc) => (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? b[rr * 8 + cc] : null);
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (at(pr, c + dc) === by + 'P') return true;
  for (const [dr, dc] of [
    [1, 2],
    [2, 1],
    [-1, 2],
    [-2, 1],
    [1, -2],
    [2, -1],
    [-1, -2],
    [-2, -1],
  ])
    if (at(r + dr, c + dc) === by + 'N') return true;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if ((dr || dc) && at(r + dr, c + dc) === by + 'K') return true;
  for (const [dr, dc] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
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
  const b = st.board,
    me = st.turn,
    out = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p[0] !== me) continue;
    const r = i >> 3,
      c = i & 7,
      t = p[1];
    const add = (to, extra) => out.push(Object.assign({ from: i, to }, extra));
    if (t === 'P') {
      const d = me === 'w' ? -1 : 1,
        start = me === 'w' ? 6 : 1,
        last = me === 'w' ? 0 : 7;
      const push = (to, extra) => {
        if (to >> 3 === last)
          for (const q of 'QRBN') add(to, Object.assign({ promo: q }, extra));
        else add(to, extra);
      };
      const f = (r + d) * 8 + c;
      if (!b[f]) {
        push(f);
        if (r === start && !b[f + d * 8]) add(f + d * 8, { dbl: 1 });
      }
      for (const dc of [-1, 1]) {
        if (c + dc < 0 || c + dc > 7) continue;
        const to = (r + d) * 8 + c + dc;
        if (b[to] && b[to][0] !== me) push(to);
        else if (to === st.ep) add(to, { ep: 1 });
      }
    } else if (t === 'N' || t === 'K') {
      const offs =
        t === 'N'
          ? [
              [1, 2],
              [2, 1],
              [-1, 2],
              [-2, 1],
              [1, -2],
              [2, -1],
              [-1, -2],
              [-2, -1],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ];
      for (const [dr, dc] of offs) {
        const rr = r + dr,
          cc = c + dc;
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const q = b[rr * 8 + cc];
        if (!q || q[0] !== me) add(rr * 8 + cc);
      }
      if (t === 'K') {
        const home = me === 'w' ? 60 : 4,
          en = opp(me);
        if (i === home && !attacked(b, home, en)) {
          if (
            st.castle[me + 'K'] &&
            !b[home + 1] &&
            !b[home + 2] &&
            b[home + 3] === me + 'R' &&
            !attacked(b, home + 1, en) &&
            !attacked(b, home + 2, en)
          )
            add(home + 2, { castle: 'K' });
          if (
            st.castle[me + 'Q'] &&
            !b[home - 1] &&
            !b[home - 2] &&
            !b[home - 3] &&
            b[home - 4] === me + 'R' &&
            !attacked(b, home - 1, en) &&
            !attacked(b, home - 2, en)
          )
            add(home - 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = [];
      if (t !== 'B') dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
      if (t !== 'R') dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
      for (const [dr, dc] of dirs)
        for (
          let rr = r + dr, cc = c + dc;
          rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
          rr += dr, cc += dc
        ) {
          const q = b[rr * 8 + cc];
          if (!q) {
            add(rr * 8 + cc);
            continue;
          }
          if (q[0] !== me) add(rr * 8 + cc);
          break;
        }
    }
  }
  return out;
}

function apply(st, m) {
  const b = st.board.slice(),
    p = b[m.from],
    me = st.turn;
  const captured = m.ep ? b[m.to + (me === 'w' ? 8 : -8)] : b[m.to];
  b[m.to] = m.promo ? me + m.promo : p;
  b[m.from] = null;
  if (m.ep) b[m.to + (me === 'w' ? 8 : -8)] = null;
  if (m.castle) {
    const home = m.from;
    if (m.castle === 'K') {
      b[home + 1] = b[home + 3];
      b[home + 3] = null;
    } else {
      b[home - 1] = b[home - 4];
      b[home - 4] = null;
    }
  }
  const castle = Object.assign({}, st.castle);
  if (p[1] === 'K') castle[me + 'K'] = castle[me + 'Q'] = 0;
  for (const s of [m.from, m.to]) {
    if (s === 63) castle.wK = 0;
    if (s === 56) castle.wQ = 0;
    if (s === 7) castle.bK = 0;
    if (s === 0) castle.bQ = 0;
  }
  return {
    board: b,
    turn: opp(me),
    castle,
    captured,
    ep: m.dbl ? (m.from + m.to) / 2 : null,
    half: p[1] === 'P' || captured ? 0 : st.half + 1,
  };
}

function legalMoves(st) {
  return pseudo(st).filter((m) => !inCheck(apply(st, m), st.turn));
}

function insufficient(b) {
  const ps = [];
  b.forEach((p, i) => {
    if (p && p[1] !== 'K') ps.push([p[1], ((i >> 3) + (i & 7)) % 2]);
  });
  if (!ps.length) return true;
  if (ps.length === 1 && 'BN'.includes(ps[0][0])) return true;
  return ps.every((p) => p[0] === 'B' && p[1] === ps[0][1]); // só bispos, todos da mesma cor
}

// Esse lado ainda consegue (em tese) dar mate? Usado no fim de tempo.
function canMate(b, color) {
  const ps = b.filter((p) => p && p[0] === color && p[1] !== 'K');
  return ps.some((p) => 'PRQ'.includes(p[1])) || ps.length >= 2;
}

function perft(st, d) {
  if (!d) return 1;
  return legalMoves(st).reduce((n, m) => n + perft(apply(st, m), d - 1), 0);
}

/* ===== MOTOR DE ANÁLISE (busca alpha-beta própria, roda no navegador, sem API) ===== */
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const MATE = 100000,
  INF = 1e9;

function evaluate(st) {
  const b = st.board;
  let s = 0,
    nonPawn = 0,
    bishops = { w: 0, b: 0 };
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p && p[1] !== 'K' && p[1] !== 'P') nonPawn += VAL[p[1]];
  }
  const endgame = nonPawn < 2400;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const col = p[0],
      t = p[1],
      r = i >> 3,
      c = i & 7,
      cd = Math.abs(c - 3.5) + Math.abs(r - 3.5); // distância ao centro (0..7)
    let v = VAL[t];
    if (t === 'P') {
      const adv = col === 'w' ? 6 - r : r - 1; // casas avançadas (0..5)
      v += adv * 7 + (adv > 4 ? 40 : 0) + (adv <= 3 ? (3.5 - Math.abs(c - 3.5)) * 4 : 0);
    } else if (t === 'N') v += (7 - cd) * 6;
    else if (t === 'B') {
      v += (7 - cd) * 3;
      bishops[col]++;
    } else if (t === 'Q') v += (7 - cd) * 1;
    else if (t === 'K') {
      if (endgame) v += (7 - cd) * 8;
      else {
        const home = col === 'w' ? 7 : 0;
        v += (r === home ? 20 : 0) + (c <= 2 || c >= 6 ? 15 : 0);
      }
    }
    s += col === 'w' ? v : -v;
  }
  if (bishops.w >= 2) s += 30;
  if (bishops.b >= 2) s -= 30;
  return st.turn === 'w' ? s : -s;
}

function orderMoves(st, ms) {
  const b = st.board;
  for (const m of ms) {
    let o = 0;
    const v = b[m.to];
    if (v) o = 10000 + 10 * VAL[v[1]] - VAL[b[m.from][1]];
    else if (m.ep) o = 10000 + 900;
    if (m.promo === 'Q') o += 9000;
    m.o = o;
  }
  return ms.sort((x, y) => y.o - x.o);
}

const queenOnly = (m) => !m.promo || m.promo === 'Q';

function quiesce(st, alpha, beta, qd, ctx) {
  ctx.nodes++;
  const stand = evaluate(st);
  if (qd >= 5 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const b = st.board;
  const ms = orderMoves(
    st,
    pseudo(st).filter((m) => (b[m.to] || m.ep || m.promo === 'Q') && queenOnly(m))
  );
  for (const m of ms) {
    const n = apply(st, m);
    if (inCheck(n, st.turn)) continue;
    const sc = -quiesce(n, -beta, -alpha, qd + 1, ctx);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function search(st, depth, alpha, beta, ply, ctx) {
  if (st.half >= 100) return 0;
  const chk = inCheck(st, st.turn);
  if (chk && ply < 8) depth++; // extensão de xeque
  if (depth <= 0) return quiesce(st, alpha, beta, 0, ctx);
  ctx.nodes++;
  const ms = orderMoves(st, pseudo(st).filter(queenOnly));
  let best = -INF,
    legal = 0;
  for (const m of ms) {
    const n = apply(st, m);
    if (inCheck(n, st.turn)) continue;
    legal++;
    const sc = -search(n, depth - 1, -beta, -alpha, ply + 1, ctx);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (!legal) return chk ? -(MATE - ply) : 0;
  return best;
}

// Avalia uma posição: devolve a pontuação (do ponto de vista de quem joga), o melhor lance e quantos lances legais existem.
function analyze(st, depth) {
  const ctx = { nodes: 0 };
  const ms = orderMoves(st, pseudo(st).filter(queenOnly));
  let alpha = -INF,
    best = null,
    bestSc = -INF,
    legal = 0;
  for (const m of ms) {
    const n = apply(st, m);
    if (inCheck(n, st.turn)) continue;
    legal++;
    const sc = -search(n, depth - 1, -INF, -alpha, 1, ctx);
    if (sc > bestSc) {
      bestSc = sc;
      best = m;
    }
    if (sc > alpha) alpha = sc;
  }
  if (!legal) return { score: inCheck(st, st.turn) ? -MATE : 0, move: null, n: 0, nodes: ctx.nodes };
  return { score: bestSc, move: best, n: legal, nodes: ctx.nodes };
}

/* Classificação dos lances pela perda de chance de vitória (escala parecida com a do Lichess) */
const clampCp = (s) => Math.max(-1000, Math.min(1000, s)); // mate conta como "ganho total"
const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const accuracyOf = (loss) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

function classifyLoss(loss, isBest) {
  if (isBest || loss < 0.3) return 'best';
  if (loss < 2) return 'excellent';
  if (loss < 5) return 'good';
  if (loss < 10) return 'strange'; // imprecisão
  if (loss < 20) return 'bad'; // erro
  return 'clown'; // gafe
}

/* ---- Livro de aberturas (compacto): posições de teoria comum. Um lance que leva a uma destas posições é "Book". ---- */
const BOOK_LINES = [
  // 1.e4 e5
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4 b1c3 f6e4 e1g1 b4c3 d4d5 c3f6 f1e1 c6e7',
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 b2b4 c5b6 a2a4 a7a6 e1g1 e8g8',
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 e5d4 e1g1 d4c3 d1b3 d8f6',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 c6a5 c4b5 c7c6 d5c6 b7c6 b5e2 h7h6 g5f3 e5e4 f3e5 f8d6',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 b1c3 d7d6 c1g5 h7h6 g5h4 c6a5 c4b5 c7c6',
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5 d2d4 d8c7',
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5 a4b3 d7d5 d4e5 c8e6',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5 d1d8 e8d8 b1c3 d8e8',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f8c5 f3e5 c6e5 d2d4 c5d6 d4e5 f6e4',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6 e4e5 d8e7 d1e2 f6d5 c2c4 c8a6',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 c1e3 d8f6 c2c3 g8e7 f1c4 c6e5 c4e2 d7d6',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 d4b3 c5b6 a2a4 a7a6 b1c3 g8f6 a4a5 b6a7',
  'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5 f1d3 f8e7 e1g1 b8c6 c2c4 c6b4 f1e1 c8g4',
  'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7 f1c4 f8e7 e1g1 e8g8 d1e2 c7c6 a2a4 d8c7',
  'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4 e1g1 e8g8 d2d3 d7d6 c1g5 b4c3 b2c3 d8e7 f1e1 c6d8 d3d4 d8e6',
  'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 d2d4 e5d4 f3d4 f8b4 d4c6 b7c6 f1d3 d7d5 e4d5 c6d5 e1g1 e8g8',
  'e2e4 e7e5 b1c3 g8f6 f1c4 f6e4 d1h5 e4d6 c4b3 f8e7 h5e5 e8g8',
  'e2e4 e7e5 b1c3 b8c6 g2g3 g8f6 f1g2 f8c5 g1e2 d7d6 e1g1 e8g8 d2d3 c8e6',
  'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 h2h4 g5g4 f3e5 g8f6 d2d4 d7d6 e5d3 f6e4 f1e2 f8g7',
  'e2e4 e7e5 f2f4 d7d5 e4d5 e5e4 d2d3 g8f6 b1c3 f6d5 d3e4 d5c3 d1d8 e8d8',
  // 1.e4 c5
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7 d1f3 d8c7 e1c1 b8d7 g2g4 b7b5',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5 d4b3 f8e7 e1g1 e8g8 c1e3 c8e6',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 c8e6 f2f3 f8e7 d1d2 e8g8 e1c1 b8d7',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 f1c4 c8d7 e1c1 a8c8',
  'e2e4 c7c5 g1f3 d7d6 f1b5 c8d7 b5d7 d8d7 e1g1 b8c6 f1e1 g8f6 c2c3 g7g6 d2d4 c5d4 c3d4 f8g7',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5 g5f6 g7f6 c3d5 f6f5',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 c1g5 e7e6 d1d2 a7a6 e1c1 c8d7 f2f4 f8e7',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 d8c7 b1c3 e7e6 c1e3 a7a6 f1e2 g8f6 e1g1 f8e7',
  'e2e4 c7c5 g1f3 b8c6 f1b5 g7g6 e1g1 f8g7 f1e1 e7e5 b5c6 d7c6 d2d3 g8e7 b1d2 e8g8',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3 g8f6 e1g1 d8c7 c2c4 f8c5 d4b3 c5a7 b1c3 b8c6',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7 c1e3 a7a6 f1e2 g8f6 e1g1 f8e7 f2f4 d7d6',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6 f1e2 f8e7 e1g1 e8g8 c1e3 a7a6 f2f4 d8c7',
  'e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4 c5d4 g1f3 b8c6 f3d4 d7d6 f1c4 d5b6 c4b3 d6e5 d4c6 b7c6',
  'e2e4 c7c5 c2c3 d7d5 e4d5 d8d5 d2d4 g8f6 g1f3 c8g4 f1e2 e7e6 e1g1 b8c6 c3c4 d5d6',
  'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6 c1e3 e7e6 d1d2 g8e7 g1f3 e8g8',
  'e2e4 c7c5 g1f3 g8f6 e4e5 f6d5 b1c3 e7e6 c3d5 e6d5 d2d4 b8c6',
  // francesa, Caro-Kann, escandinava, Pirc, Alekhine
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7 f2f4 e8g8 g1f3 c7c5 d4c5 b8c6',
  'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4 e8g8 f1d3 b8c6 g1f3 d8c7',
  'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5 c2c3 b8c6 g1e2 c5d4 c3d4 f7f6 e5f6 d8f6',
  'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5 e4d5 e6d5 g1f3 b8c6 f1b5 f8d6 d4c5 d6c5 e1g1 g8e7 d2b3 c5d6',
  'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3 c5c4 b2b4 c4b3 a3a4 c8d7',
  'e2e4 e7e6 d2d4 d7d5 e4d5 e6d5 g1f3 g8f6 f1d3 f8d6 e1g1 e8g8 c1g5 c8g4 b1d2 b8d7',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7 h4h5 g6h7 f1d3 h7d3 d1d3 e7e6 c1f4 d8a5',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 b8d7 g1f3 g8f6 e4g5 e7e6 f1d3 f8d6 d1e2 h7h6 g5e4 d8c7',
  'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c6c5 e1g1 b8c6 c2c3 g8e7 b1a3 c5d4 c3d4 f5g6',
  'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 b1c3 e7e6 g2g4 f5g6 g1e2 g8e7 h2h4 h7h6 e2f4 g6h7',
  'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 e7e6 g1f3 f8e7 c4d5 f6d5 f1d3 b8c6 e1g1 e8g8',
  'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 f1d3 b8c6 c2c3 g8f6 c1f4 c8g4 d1b3 d8d7 b1d2 e7e6',
  'e2e4 c7c6 b1c3 d7d5 g1f3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 f1c4 e7e6 d2d3 g8f6',
  'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c7c6 f1c4 c8f5 c1d2 e7e6 d4d5 c6d5',
  'e2e4 d7d5 e4d5 g8f6 d2d4 f6d5 g1f3 g7g6 f1e2 f8g7 e1g1 e8g8 c2c4 d5b6 b1c3 b8c6',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 c7c6 a2a4 b8d7 c1f4 d8c7',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4 f8g7 g1f3 c7c5 f1b5 c8d7 e4e5 f6g4 e1g1 b8c6',
  'e2e4 g7g6 d2d4 f8g7 b1c3 d7d6 g1f3 g8f6 f1e2 e8g8 e1g1 c7c6 a2a4 b8d7 c1f4',
  'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 c8g4 f1e2 e7e6 e1g1 f8e7 c2c4 d5b6 b1c3 e8g8 h2h3 g4h5',
  'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 f2f4 d6e5 f4e5 c8f5 b1c3 e7e6 g1f3 b8c6',
  // 1.d4 d5
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4 d3c4 f6d5',
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8e7 c1f4 e8g8 e2e3 c7c5 d4c5 e7c5 a2a3 b8c6 d1c2 d8a5',
  'd2d4 d7d5 c2c4 e7e6 b1c3 c7c6 g1f3 g8f6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5 c4d3 a7a6 e3e4 c6c5',
  'd2d4 d7d5 c2c4 e7e6 g1f3 g8f6 b1c3 f8b4 c1g5 h7h6 g5h4 c7c5 e2e3 c5d4 e3d4 b8c6',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6 f1c4 f8b4 e1g1 b8d7 d1e2 f5g6',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5 c4d3 a7a6 e3e4 c6c5 e4e5 c5d4',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 e2e3 e7e6 b1d2 b8d7 f1d3 f8d6 e1g1 e8g8 e3e4 d5e4 d2e4 f6e4',
  'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5 e1g1 a7a6 d1e2 b7b5 c4b3 c5d4 f1d1 b8c6 e3d4 c8b7',
  'd2d4 d7d5 c2c4 d5c4 e2e3 g8f6 f1c4 e7e6 g1f3 c7c5 e1g1 a7a6 d1e2 b7b5 c4b3 c8b7',
  'd2d4 d7d5 c2c4 e7e5 d4e5 d5d4 g1f3 b8c6 g2g3 c8e6 f1g2 d8d7 e1g1 f8e7',
  'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 b1d2 e7e6 g1f3 f8d6 f4g3 e8g8 f1d3 d8e7 e1g1 f6h5',
  'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 f8d6 f4g3 e8g8 b1d2 b8d7 f1d3 c7c5 c2c3 d6e7',
  'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 b2b3 b8c6 e1g1 f8d6 c1b2 e8g8 b1d2 b7b6',
  'd2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 f8d6 f4g3 e8g8 f1d3 c7c5 c2c3 b8c6 b1d2 d8e7',
  'd2d4 d7d5 g1f3 g8f6 c2c4 e7e6 b1c3 f8e7 c1g5 e8g8 e2e3 h7h6 g5h4 b7b6 c4d5 e6d5',
  'd2d4 d7d5 g1f3 g8f6 c2c4 e7e6 g2g3 f8e7 f1g2 e8g8 e1g1 d5c4 d1c2 a7a6 c2c4 b7b5 c4c2 c8b7',
  'd2d4 d7d5 g1f3 g8f6 c2c4 c7c6 e2e3 e7e6 b1d2 b8d7 f1d3 f8d6 e1g1 e8g8 e3e4 d5e4 d2e4 f6e4',
  // 1.d4 Nf6 e indianas
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1 f6d7 c1e3 f7f5',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5 g1e2 c7c6 d1d2 b8d7',
  'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 g1f3 c7c5 f1e2 e8g8 e1g1 b8c6 c1e3 c5d4',
  'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3 d5c4 b3c4 e8g8 e2e4 c8g4 c1e3 f6d7',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5 e1g1 b8c6 a2a3 b4c3 b2c3 d5c4 d3c4 d8c7',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3 c2c3 b7b6 c1g5 c8b7 e2e3 d7d6 f2f3 b8d7',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 c7c5 f1d3 b8c6 g1f3 b4c3 b2c3 d7d6 e3e4 e6e5 e1g1 e8g8',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7 e1g1 e8g8 b1c3 f6e4 d1c2 e4c3 c2c3 c7c5',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 a2a3 c8b7 b1c3 d7d5 c4d5 f6d5 d1c2 d5c3 b2c3 f8e7',
  'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 d5c4 d1c2 a7a6 c2c4 b7b5 c4c2 c8b7 b1c3 b8d7',
  'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 f8e7 e1g1 e8g8 d1c2 a7a6 c2c4 b7b5',
  'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 f8e8',
  'd2d4 g8f6 g1f3 e7e6 c1g5 h7h6 g5h4 d7d5 e2e3 f8e7 b1d2 e8g8 f1d3 b8d7 c2c3 c7c5',
  'd2d4 g8f6 g1f3 g7g6 c1f4 f8g7 e2e3 e8g8 h2h3 d7d6 f1e2 b8d7 e1g1 c7c5 c2c3 d8c7',
  'd2d4 g8f6 c2c4 e7e6 g1f3 d7d5 b1c3 f8e7 c1g5 h7h6 g5h4 e8g8 e2e3 f6e4 h4e7 d8e7',
  'd2d4 f7f5 g2g3 g8f6 f1g2 e7e6 g1f3 f8e7 e1g1 e8g8 c2c4 d7d6 b1c3 d8e8 d1c2 e8h5',
  'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6 f1g2 f8e7 g1f3 e8g8 e1g1 d7d6 b1c3 d8e8 d1c2 e8h5',
  'd2d4 d7d6 e2e4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 c7c6 c1g5 b8d7',
  // inglesa, Réti, outras
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5 f1g2 d5b6 e1g1 f8e7 d2d3 e8g8 a2a3 f7f5',
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 e2e3 f8b4 d1c2 b4c3 b2c3 e8g8 f1d3 d7d6 e3e4',
  'c2c4 e7e5 g2g3 g8f6 f1g2 d7d5 c4d5 f6d5 b1c3 d5b6 g1f3 b8c6 e1g1 f8e7 d2d3 e8g8',
  'c2c4 g8f6 b1c3 e7e6 g1f3 d7d5 d2d4 f8e7 c1g5 e8g8 e2e3 h7h6 g5h4 b7b6 c4d5 e6d5',
  'c2c4 g8f6 b1c3 g7g6 g2g3 f8g7 f1g2 e8g8 e2e4 d7d6 g1e2 e7e5 e1g1 c7c6 d2d3 b8d7',
  'c2c4 c7c5 g1f3 g8f6 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 e1g1 e8g8 d2d4 c5d4 f3d4 c6d4 d1d4 d7d6',
  'c2c4 c7c5 g1f3 g8f6 b1c3 e7e6 g2g3 b7b6 f1g2 c8b7 e1g1 f8e7 d2d4 c5d4 d1d4 d7d6',
  'c2c4 e7e6 g1f3 d7d5 g2g3 g8f6 f1g2 f8e7 e1g1 e8g8 d2d4 d5c4 d1c2 a7a6 c2c4 b7b5',
  'g1f3 d7d5 c2c4 e7e6 g2g3 g8f6 f1g2 f8e7 e1g1 e8g8 b2b3 c7c5 c1b2 b8c6 e2e3 b7b6',
  'g1f3 d7d5 g2g3 g8f6 f1g2 c7c6 e1g1 c8g4 d2d3 b8d7 b1d2 e7e6 h2h3 g4h5 e2e4 f8e7',
  'g1f3 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 d2d4 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7',
  'g1f3 g8f6 g2g3 g7g6 f1g2 f8g7 e1g1 e8g8 d2d4 d7d6 c2c4 b8c6 b1c3 a7a6 h2h3 c8d7',
  'g1f3 g8f6 c2c4 e7e6 b1c3 d7d5 d2d4 f8e7 c1g5 e8g8 e2e3 h7h6 g5h4 b8d7',
  'g1f3 c7c5 c2c4 b8c6 b1c3 g8f6 g2g3 d7d5 c4d5 f6d5 f1g2 d5c3 b2c3 g7g6 e1g1 f8g7',
  'g1f3 f7f5 g2g3 g8f6 f1g2 e7e6 e1g1 f8e7 d2d3 e8g8 b1c3 d7d6 e2e4 f5e4',
  'b2b3 e7e5 c1b2 b8c6 e2e3 d7d5 f1b5 f8d6 f2f4 d8h4 g2g3 h4e7 g1f3 c8g4',
  'f2f4 d7d5 g1f3 g8f6 e2e3 g7g6 f1e2 f8g7 e1g1 e8g8 d2d3 c7c5 b2b3 b8c6',
  'b2b4 e7e5 c1b2 f8b4 b2e5 g8f6 g1f3 b8c6 e5b2 e8g8 e2e3 d7d5 f1b5 f6e4',
  'e2e3 e7e5 c2c4 d7d6 b1c3 g8f6 b2b3 f8e7 c1b2 e8g8 g1f3 b8d7 f1e2 c7c6',
  'g2g3 d7d5 f1g2 e7e5 d2d3 g8f6 g1f3 b8c6 e1g1 f8e7 e2e4 d5e4 d3e4 e8g8',
];
let _bookSet = null;
const bookKey = (st) => st.board.map((p) => p || '.').join('') + st.turn;
function bookSet() {
  if (_bookSet) return _bookSet;
  _bookSet = new Set();
  for (const line of BOOK_LINES) {
    let st = newState();
    for (const u of line.split(' ')) {
      const m = legalMoves(st).find(
        (x) => sqName(x.from) + sqName(x.to) + (x.promo ? x.promo.toLowerCase() : '') === u
      );
      if (!m) break; // linha com erro de digitação: ignora o resto
      st = apply(st, m);
      _bookSet.add(bookKey(st));
    }
  }
  return _bookSet;
}
const isBookPos = (st) => bookSet().has(bookKey(st));

/* ---- Sacrifício (para o "Sigma"/Brilliant): troca estática (SEE) na casa de destino ---- */
const SEE_VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100 };
const SEE_KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const SEE_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// atacante de menor valor de `sq` para o lado `by` (índice, ou -1). A peça que captura sai do tabuleiro, então aparecem os raios-x.
function leastAttacker(b, sq, by) {
  const r = sq >> 3,
    c = sq & 7;
  const at = (rr, cc) => (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 ? rr * 8 + cc : -1);
  let best = -1,
    bestV = 1e9;
  const consider = (i) => {
    const v = SEE_VAL[b[i][1]];
    if (v < bestV) {
      bestV = v;
      best = i;
    }
  };
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    const i = at(pr, c + dc);
    if (i >= 0 && b[i] === by + 'P') consider(i);
  }
  for (const [dr, dc] of SEE_KN) {
    const i = at(r + dr, c + dc);
    if (i >= 0 && b[i] === by + 'N') consider(i);
  }
  for (const [dr, dc] of SEE_DIR) {
    const diag = dr && dc;
    for (let n = 1, rr = r + dr, cc = c + dc; rr >= 0 && rr < 8 && cc >= 0 && cc < 8; n++, rr += dr, cc += dc) {
      const i = rr * 8 + cc,
        p = b[i];
      if (!p) continue;
      if (p[0] === by && (p[1] === 'Q' || p[1] === (diag ? 'B' : 'R') || (n === 1 && p[1] === 'K'))) consider(i);
      break;
    }
  }
  return best;
}

// quanto `side` ganha, no máximo, capturando em `sq` (>= 0)
function seeGain(b, sq, side) {
  const a = leastAttacker(b, sq, side),
    t = b[sq];
  if (a < 0 || !t) return 0;
  const nb = b.slice();
  nb[sq] = b[a];
  nb[a] = null;
  return Math.max(0, SEE_VAL[t[1]] - seeGain(nb, sq, opp(side)));
}

// material (em peões) que o lance entrega na troca: > 0 = sacrifício
function sacrificeValue(st, m) {
  if (m.castle) return 0;
  let got = m.ep ? 1 : st.board[m.to] ? SEE_VAL[st.board[m.to][1]] : 0;
  if (m.promo) got += SEE_VAL[m.promo] - 1;
  const n = apply(st, m);
  return seeGain(n.board, m.to, opp(st.turn)) - got;
}

const pieceCount = (b) => b.filter((p) => p && 'QRBN'.includes(p[1])).length;

// positions[k] = posição depois de k lances; mvs[k] = lance que leva de positions[k] a positions[k+1].
// evals[k] = { score (de quem joga, melhor linha), score2 (2ª melhor linha ou null), move (melhor lance), n (lances legais) }.
// O lance jogado vale -evals[k+1].score: os dois valores vêm da mesma profundidade (se `shallow` for dado, usa-o).
//
// Classes: sigma (Brilliant), awesome (Great), best, excellent, good, strange (imprecisão), bad (erro), miss, clown (gafe).
//  - Sigma: sacrifício de peça (>= 2 peões), que é o melhor/quase melhor lance, que não deixa a posição má
//    e que não ganhava de qualquer jeito (o 2º melhor lance não ganha tudo). No final de jogo tem de ser quase o único bom lance.
//  - Awesome: lance que muda o rumo da partida: quase único (o 2º melhor perde >= 15%) ou que salva/ganha a posição; não vale recaptura óbvia.
//  - Book: posição de teoria de abertura (lista compacta acima); não conta como erro.
//  - Miss: o adversário errou no lance anterior e você não aproveitou.
function rateMoves(positions, mvs, evals, shallow) {
  const ev = shallow || evals,
    out = [];
  mvs.forEach((m, k) => {
    const e = evals[k],
      same = !!e.move && e.move.from === m.from && e.move.to === m.to && (e.move.promo || null) === (m.promo || null),
      forced = same || e.n <= 1;
    const bestW = winPct(clampCp(e.score)),
      playedW = winPct(clampCp(-ev[k + 1].score));
    const book = k < 30 && isBookPos(positions[k + 1]);
    let loss = forced || book ? 0 : Math.max(0, bestW - playedW);
    let cls = book ? 'book' : classifyLoss(loss, forced);
    const prevLoss = k > 0 ? out[k - 1].loss : 0;
    if ((cls === 'strange' || cls === 'bad') && prevLoss >= 10) cls = 'miss';
    if ((cls === 'best' || cls === 'excellent') && e.n > 1 && e.score2 != null) {
      const s2 = winPct(clampCp(e.score2)),
        gap = bestW - s2,
        endgame = pieceCount(positions[k].board) <= 6,
        recapture = k > 0 && mvs[k - 1].to === m.to && positions[k].board[m.to];
      if (sacrificeValue(positions[k], m) >= 2 && playedW >= 40 && s2 < 85 && (!endgame || gap >= 15)) cls = 'sigma';
      else if (
        !recapture &&
        bestW < 92 &&
        (gap >= 15 || (gap >= 8 && ((s2 < 40 && bestW >= 40) || (s2 < 60 && bestW >= 65))))
      )
        cls = 'awesome'; // só lance bom, ou lance que salva (perdendo->equilibrado) / vence (equilibrado->ganhando)
    }
    out.push({ loss, cls, acc: accuracyOf(loss), mover: positions[k].turn });
  });
  return out;
}

// Resumo de uma linha da partida (o "Coach")
function coachLine(rates, evals, positions) {
  if (!rates.length) return '';
  const wp = evals.map((e, i) => winPct(clampCp(positions[i].turn === 'w' ? e.score : -e.score)));
  const side = (c) => (c === 'w' ? 'as Brancas' : 'as Pretas'),
    Side = (c) => (c === 'w' ? 'As Brancas' : 'As Pretas');
  let bk = -1,
    bl = 0;
  rates.forEach((r, k) => {
    if (r.loss > bl) {
      bl = r.loss;
      bk = k;
    }
  });
  const fin = wp[wp.length - 1],
    lead = fin > 65 ? 'w' : fin < 35 ? 'b' : null;
  if (bl < 10) {
    if (!lead) return 'Partida equilibrada: nenhum dos lados cometeu erros graves.';
    return `${Side(lead)} foram acumulando vantagem aos poucos, sem erros graves de ninguém.`;
  }
  const n = Math.floor(bk / 2) + 1,
    who = rates[bk].mover,
    other = who === 'w' ? 'b' : 'w',
    err = bl >= 20 ? 'uma gafe' : 'um erro',
    before = who === 'w' ? wp[bk] : 100 - wp[bk]; // chance de quem errou antes do erro
  let t;
  if (before >= 62) t = `${Side(who)} estavam melhor, mas no lance ${n} cometeram ${err} e a vantagem desapareceu.`;
  else if (before > 38) t = `Partida equilibrada até o lance ${n}, quando ${side(who)} cometeram ${err}.`;
  else t = `${Side(who)} já estavam pior e no lance ${n} cometeram ${err}, piorando a situação.`;
  if (lead === other) t += ` ${Side(other)} passaram a dominar.`;
  else if (lead === who) t += ` Mesmo assim, ${side(who)} conseguiram vencer.`;
  return t;
}

//END
if (typeof document === 'undefined') {
  module.exports = {
    newState,
    legalMoves,
    apply,
    perft,
    insufficient,
    canMate,
    analyze,
    rateMoves,
    sacrificeValue,
    classifyLoss,
    isBookPos,
    bookSet,
    coachLine,
    evaluate,
    MATE,
  };
} else {
  /* ===== INTERFACE ===== */
  const $ = (s) => document.querySelector(s);
  const side = (c) => (c === 'w' ? 'brancas' : 'pretas');
  const Side = (c) => (c === 'w' ? 'Brancas' : 'Pretas');
  const REDUCE =
    window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== CONFIGURAÇÕES (salvas no navegador) ===== */
  const store = {
    load() {
      try {
        return JSON.parse(localStorage.getItem('xadrez.cfg') || '{}');
      } catch (_) {
        return {};
      }
    },
    save(o) {
      try {
        localStorage.setItem('xadrez.cfg', JSON.stringify(o));
      } catch (_) {}
    },
  };

  /* ===== EFEITOS SONOROS (WebAudio, sem ficheiros externos) ===== */
  const Sfx = {
    on: true,
    ctx: null,
    ac() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = AC ? new AC() : null;
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    blip(f, t, dur, vol, type) {
      const c = this.ac();
      if (!c || !this.on) return;
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = f;
      const t0 = c.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    },
    noise(t, dur, vol) {
      const c = this.ac();
      if (!c || !this.on) return;
      const n = Math.max(1, Math.floor(c.sampleRate * dur)),
        buf = c.createBuffer(1, n, c.sampleRate),
        d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource();
      s.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 850;
      const g = c.createGain();
      g.gain.value = vol;
      s.connect(f);
      f.connect(g);
      g.connect(c.destination);
      s.start(c.currentTime + t);
    },
    move() {
      this.blip(1900, 0, 0.05, 0.09, 'triangle');
      this.blip(1350, 0.014, 0.035, 0.045, 'sine');
    },
    capture() {
      this.noise(0, 0.09, 0.2);
      this.blip(300, 0, 0.07, 0.09, 'square');
    },
    castle() {
      this.move();
      setTimeout(() => this.move(), 80);
    },
    check() {
      this.blip(880, 0, 0.09, 0.09);
      this.blip(1174, 0.09, 0.13, 0.09);
    },
    promote() {
      [523, 659, 784].forEach((f, i) => this.blip(f, i * 0.07, 0.13, 0.08));
    },
    end(winner) {
      if (winner === null) {
        this.blip(440, 0, 0.2, 0.08);
        this.blip(440, 0.22, 0.3, 0.08);
      } else {
        const seq = [523, 659, 784, 1046];
        seq.forEach((f, i) => this.blip(f, i * 0.12, 0.22, 0.09));
      }
    },
  };

  /* ===== MODOS DE JOGO (minutos + incremento em segundos; min 0 = sem relógio) ===== */
  const MODES = [
    [1, 0],
    [2, 1],
    [3, 0],
    [3, 2],
    [5, 0],
    [10, 0],
    [15, 10],
    [30, 0],
    [0, 0],
  ].map(([min, inc]) => ({ min, inc }));

  const CATS = ['Bullet', 'Blitz', 'Rápida', 'Clássica', 'Livre'];
  const tcOf = (m) => (m.min ? { min: m.min, inc: m.inc } : null);

  function catOf(t) {
    if (!t) return 'Livre';
    const s = t.min * 60 + t.inc * 40; // tempo estimado de uma partida, em segundos
    return s < 180 ? 'Bullet' : s < 480 ? 'Blitz' : s < 1500 ? 'Rápida' : 'Clássica';
  }

  const tcLabel = (t) => (t ? (t.inc ? `${t.min} | ${t.inc}` : `${t.min} min`) : 'Sem relógio');
  const modeTitle = (t) => (t ? `${catOf(t)} · ${tcLabel(t)}` : 'Sem relógio');

  let st,
    mode,
    me = 'w',
    sel = null,
    targets = [],
    last = null,
    over = false;
  let caps = { w: [], b: [] },
    history = [],
    peer = null,
    conn = null;
  let tc = null,
    clock = { w: 0, b: 0 },
    lastTick = 0,
    timer = null;
  let marks = [],
    drag = null;
  let dnd = null,
    ghost = null,
    raf = 0; // arrastar peças
  let anim = null,
    animEl = null,
    animTimer = 0; // animação do lance
  let manualFlip = false; // girar o tabuleiro (só visual)
  let coordsOn = true;
  let chosen = MODES.find((m) => m.min === 5 && m.inc === 0);
  let roomTc = null,
    lastCode = '';
  let positions = [], // positions[k] = posição depois de k lances
    moves = [], // {m, txt, mover}
    premoves = [],
    premoveOn = false,
    review = null, // índice da posição mostrada na revisão (null = jogo normal)
    an = null,
    anToken = 0;
  const ANALYSIS_DEPTH = 4;

  const effectiveFlip = () => (me === 'b') !== manualFlip;

  /* ===== MENU: escolha do modo ===== */
  function buildModes() {
    const box = $('#modes');
    box.innerHTML = '';
    for (const cat of CATS) {
      const list = MODES.filter((m) => catOf(tcOf(m)) === cat);
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
        b.onclick = () => {
          chosen = m;
          saveCfg();
          buildModes();
        };
        wrap.appendChild(b);
      }
      g.appendChild(wrap);
      box.appendChild(g);
    }
  }

  function saveCfg() {
    store.save({
      mode: [chosen.min, chosen.inc],
      elo: cpuElo,
      pre: premoveOn,
      snd: Sfx.on,
      coord: coordsOn,
    });
  }

  function applyCfg() {
    const c = store.load();
    if (Array.isArray(c.mode)) {
      const m = MODES.find((x) => x.min === c.mode[0] && x.inc === c.mode[1]);
      if (m) chosen = m;
    }
    if (typeof c.elo === 'number') cpuElo = Math.max(800, Math.min(3000, Math.round(c.elo)));
    if (typeof c.pre === 'boolean') premoveOn = c.pre;
    if (typeof c.snd === 'boolean') Sfx.on = c.snd;
    if (typeof c.coord === 'boolean') coordsOn = c.coord;
  }

  /* ===== RELÓGIO ===== */
  function fmtClock(ms) {
    ms = Math.max(0, ms);
    if (ms < 10000) return (ms / 1000).toFixed(1);
    const s = Math.ceil(ms / 1000),
      m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function updateClocks() {
    if (!st) return;
    for (const [el, col] of [
      ['#topPlayer', opp(me)],
      ['#botPlayer', me],
    ]) {
      const c = $(el).querySelector('.clock');
      c.textContent = tc ? fmtClock(clock[col]) : '';
      c.classList.toggle('run', !!tc && !over && st.turn === col);
      c.classList.toggle('low', !!tc && clock[col] < 10000);
    }
  }

  /* O tempo só desconta de quem está na vez. */
  function tick() {
    if (!tc || over || !st) return;
    const now = performance.now(),
      dt = now - lastTick;
    lastTick = now;
    clock[st.turn] -= dt;
    if (clock[st.turn] <= 0) {
      clock[st.turn] = 0;
      updateClocks();
      timeout(st.turn, true);
    } else updateClocks();
  }

  function timeout(loser, notify) {
    if (over) return;
    if (notify && mode === 'net' && conn && conn.open) conn.send({ t: 'timeout', loser });
    const winner = opp(loser);
    const who =
      mode === 'local'
        ? `Tempo de As ${Side(loser)} acabou.`
        : loser === me
        ? 'Seu tempo acabou.'
        : mode === 'cpu'
        ? 'O tempo do Stockfish acabou.'
        : 'O tempo do seu amigo acabou.';
    if (!canMate(st.board, winner))
      finish('Empate', who + ' Mas o adversário não tem material para dar mate.', null);
    else finish('Tempo esgotado', who, winner);
  }

  /* ===== TELA DE FIM DE JOGO ===== */
  function outcome(winner) {
    if (winner === null) return 'A partida terminou empatada.';
    if (mode === 'local') return `As ${side(winner)} vencem.`;
    if (mode === 'cpu') return winner === me ? 'Você venceu!' : 'O Stockfish venceu.';
    return winner === me ? 'Você venceu!' : 'Seu amigo venceu.';
  }

  function finish(title, detail, winner) {
    if (over) return;
    over = true;
    sel = null;
    targets = [];
    premoves = [];
    cancelDrag();
    stopAnim();
    cpuToken++;
    $('#promo').hidden = true;
    $('#btnAnalyze').hidden = !moves.length;
    $('#btnOverAnalyze').hidden = !moves.length;
    const out = outcome(winner);
    setStatus(`${title}. ${out}`);
    $('#overTitle').textContent = title;
    $('#overDetail').textContent = detail;
    $('#overOutcome').textContent = out;
    $('#overIcon').textContent = winner === null ? '½' : '♚';
    const k = winner === null ? 'draw' : mode === 'net' || mode === 'cpu' ? (winner === me ? 'win' : 'lose') : 'win';
    $('#overBox').className = 'box result ' + k;
    $('#over').hidden = false;
    render();
    Sfx.end(winner === null ? null : mode === 'local' || winner === me ? 'w' : null);
    $('#btnOverNew').focus();
  }

  /* ===== TABULEIRO ===== */
  function moveText(s, m) {
    const piece = s.board[m.from],
      cap = m.ep || s.board[m.to];
    return m.castle
      ? m.castle === 'K'
        ? 'O-O'
        : 'O-O-O'
      : (piece[1] === 'P' ? '' : piece[1]) +
          sqName(m.from) +
          (cap ? 'x' : '-') +
          sqName(m.to) +
          (m.promo ? '=' + m.promo : '');
  }

  const MATV = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
  const matOf = (c) => caps[c].reduce((s, p) => s + MATV[p[1]], 0);

  function squarePos(i) {
    let r = i >> 3,
      c = i & 7;
    if (effectiveFlip()) {
      r = 7 - r;
      c = 7 - c;
    }
    return {
      left: `calc(5px + (100% - 10px) * ${c} / 8)`,
      top: `calc(5px + (100% - 10px) * ${r} / 8)`,
    };
  }

  function stopAnim() {
    clearTimeout(animTimer);
    anim = null;
    if (animEl) {
      animEl.remove();
      animEl = null;
    }
  }

  function queueAnim(from, to, piece) {
    if (REDUCE || review !== null || !piece) return;
    stopAnim();
    anim = { from, to, piece };
  }

  function render() {
    const board = $('#board'),
      flip = effectiveFlip(),
      inReview = review !== null,
      S = inReview ? positions[review] : st,
      lastM = inReview ? (review > 0 ? moves[review - 1].m : null) : last,
      selI = inReview ? null : sel,
      tg = inReview ? [] : targets;
    board.innerHTML = '';
    const chk = inCheck(S, S.turn) ? kingSq(S.board, S.turn) : -1;
    const pre = !inReview && premoves.length ? new Set(premoves.flatMap((p) => [p.from, p.to])) : null;
    for (let dr = 0; dr < 8; dr++)
      for (let dc = 0; dc < 8; dc++) {
        const r = flip ? 7 - dr : dr,
          c = flip ? 7 - dc : dc,
          i = r * 8 + c,
          p = S.board[i];
        const d = document.createElement('div');
        d.className = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
        if (lastM && (i === lastM.from || i === lastM.to)) d.classList.add('last');
        if (i === selI) d.classList.add('sel');
        if (i === chk) d.classList.add('chk');
        if (pre && pre.has(i)) d.classList.add('pre');
        const t = tg.find((m) => m.to === i);
        if (t) d.classList.add('mv', ...(p || t.ep ? ['cap'] : []));
        d.dataset.i = i;
        const lift = dnd && dnd.moved && i === dnd.from;
        if (p)
          d.innerHTML = `<span class="piece ${p[0]}" style="${
            lift ? 'visibility:hidden' : ''
          }">${GL[p[1]]}</span>`;
        if (dc === 0) d.insertAdjacentHTML('beforeend', `<span class="coord r">${8 - r}</span>`);
        if (dr === 7)
          d.insertAdjacentHTML('beforeend', `<span class="coord c">${'abcdefgh'[c]}</span>`);
        board.appendChild(d);
      }
    const top = opp(me),
      diff = matOf('w') - matOf('b'),
      names =
        mode === 'local'
          ? { w: 'Brancas', b: 'Pretas' }
          : { [me]: 'Você', [opp(me)]: mode === 'cpu' ? `Stockfish (${cpuElo})` : 'Amigo' };
    for (const [el, col] of [
      ['#topPlayer', top],
      ['#botPlayer', me],
    ]) {
      const e = $(el);
      e.querySelector('.name').textContent = names[col];
      const adv = diff !== 0 && (col === 'w') === (diff > 0) ? ` <b class="adv">+${Math.abs(diff)}</b>` : '';
      e.querySelector('.caps').innerHTML = caps[col].map((x) => GL[x[1]]).join('') + adv;
      e.classList.toggle('turn', !over && !inReview && st.turn === col);
    }
    $('#moves').innerHTML = history
      .map(
        (h, i) =>
          `<li data-k="${i + 1}" class="${inReview && review === i + 1 ? 'on' : ''}">${h}</li>`
      )
      .join('');
    $('#moves').classList.toggle('clickable', over && !an);
    $('#moves').scrollTop = 1e6;
    $('#revRow').hidden = !(over && !an && moves.length);
    updatePreBtn();
    updateClocks();
    drawMarks();
    runAnim();
  }

  // Anima o último lance: a peça desliza da casa de origem para a de destino.
  function runAnim() {
    if (!anim) return;
    const a = anim;
    anim = null;
    const toSq = $('#board').querySelector(`[data-i="${a.to}"] .piece`);
    if (toSq) toSq.style.visibility = 'hidden';
    const g = document.createElement('div');
    g.className = 'anim-ghost';
    const size = $('#board').clientWidth / 8;
    g.style.width = g.style.height = size + 'px';
    g.style.fontSize = size * 0.8 + 'px';
    g.innerHTML = `<span class="piece ${a.piece[0]}">${GL[a.piece[1]]}</span>`;
    const p0 = squarePos(a.from);
    g.style.left = p0.left;
    g.style.top = p0.top;
    $('#boardWrap').appendChild(g);
    animEl = g;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const p1 = squarePos(a.to);
        g.style.left = p1.left;
        g.style.top = p1.top;
      })
    );
    animTimer = setTimeout(() => {
      animEl = null;
      g.remove();
      if (review === null) render(); // revela a peça no destino
    }, 200);
  }

  function setStatus(t) {
    $('#status').textContent = t;
  }

  function updateStatus() {
    const legal = legalMoves(st),
      chk = inCheck(st, st.turn);
    if (!legal.length) {
      if (chk) finish('Xeque-mate', 'O rei não tem como escapar.', opp(st.turn));
      else
        finish(
          'Empate por afogamento',
          'Quem joga não tem lances legais, mas o rei não está em xeque.',
          null
        );
    } else if (insufficient(st.board)) {
      finish(
        'Empate por material insuficiente',
        'Nenhum dos lados tem peças suficientes para dar mate.',
        null
      );
    } else if (st.half >= 100) {
      finish(
        'Empate pela regra dos 50 lances',
        '50 lances sem captura nem movimento de peão.',
        null
      );
    } else {
      const mine = mode === 'local' || st.turn === me;
      const turnTxt =
        mode === 'local'
          ? `Vez das ${side(st.turn)}.`
          : mine
          ? 'Sua vez.'
          : mode === 'cpu'
          ? 'O Stockfish está a pensar…'
          : `Vez do amigo (${side(st.turn)}).`;
      setStatus((chk ? 'Xeque! ' : '') + turnTxt);
    }
  }

  /* ===== PRÉ-MOVES (só online, quando não é a sua vez) ===== */
  const premoving = () => mode === 'net' && !over && !!st && st.turn !== me && premoveOn;

  // posição como ficaria depois dos pré-moves já na fila (o adversário não é considerado)
  function projected() {
    let s = { ...st, turn: me, ep: null };
    for (const pm of premoves) {
      const m = pseudo(s).find(
        (x) => x.from === pm.from && x.to === pm.to && (x.promo || null) === pm.promo
      );
      if (!m) break;
      s = { ...apply(s, m), turn: me, ep: null };
    }
    return s;
  }

  const movesFrom = (i) =>
    premoving()
      ? pseudo(projected()).filter((m) => m.from === i)
      : legalMoves(st).filter((m) => m.from === i);

  function commit(m) {
    if (premoving()) addPremove(m);
    else play(m);
  }

  function addPremove(m) {
    premoves.push({ from: m.from, to: m.to, promo: m.promo || null });
    sel = null;
    targets = [];
    render();
  }

  function runPremove() {
    if (over || mode !== 'net' || st.turn !== me || !premoves.length) return;
    const pm = premoves.shift();
    const m = legalMoves(st).find(
      (x) => x.from === pm.from && x.to === pm.to && (x.promo || null) === pm.promo
    );
    if (!m) {
      premoves = []; // o pré-move já não é possível: descarta a fila
      render();
      return;
    }
    play(m);
  }

  function clearPremoves() {
    premoves = [];
    sel = null;
    targets = [];
    render();
  }

  function updatePreBtn() {
    const b = $('#btnPre');
    b.textContent = 'Pré-moves: ' + (premoveOn ? 'ON' : 'off') + (premoves.length ? ` (${premoves.length})` : '');
    b.setAttribute('aria-pressed', premoveOn);
    b.classList.toggle('on', premoveOn);
  }

  function click(i) {
    if (over || review !== null) return;
    if ((mode === 'net' || mode === 'cpu') && st.turn !== me && !premoving()) return;
    const S = premoving() ? projected() : st;
    const p = S.board[i];
    const ms = targets.filter((m) => m.to === i);
    if (sel !== null && ms.length) {
      if (ms[0].promo) return askPromo(ms);
      return commit(ms[0]);
    }
    if (p && p[0] === S.turn) {
      sel = i;
      targets = movesFrom(i);
    } else {
      sel = null;
      targets = [];
    }
    render();
  }

  function askPromo(ms) {
    const box = $('#promoBtns');
    box.innerHTML = '';
    for (const m of ms) {
      const b = document.createElement('button');
      b.textContent = GL[m.promo] + '\uFE0E';
      b.onclick = () => {
        $('#promo').hidden = true;
        commit(m);
      };
      box.appendChild(b);
    }
    $('#promo').hidden = false;
  }

  function play(m, remote, clk) {
    if (over) return;
    cancelDrag();
    stopAnim();
    const mover = st.turn;
    if (tc) {
      tick();
      if (over) return; // o tempo acabou antes do lance
      if (remote && mode === 'net') {
        if (typeof clk === 'number' && clk >= 0) clock[mover] = clk;
      } else clock[mover] += tc.inc * 1000;
      lastTick = performance.now();
    }
    const n = apply(st, m),
      txt = moveText(st, m);
    // sons: roque > captura > lance; promoção e xeque entram por cima
    if (m.castle) Sfx.castle();
    else if (n.captured || m.ep) Sfx.capture();
    else Sfx.move();
    if (m.promo) setTimeout(() => Sfx.promote(), 60);
    if (n.captured) caps[mover].push(n.captured);
    history.push(txt);
    moves.push({ m, txt, mover });
    positions.push(n);
    st = n;
    last = m;
    queueAnim(m.from, m.to, st.board[m.to]);
    sel = null;
    targets = [];
    // as setas/círculos do tabuleiro ficam guardados durante a partida
    updateStatus();
    if (!over && inCheck(st, st.turn)) setTimeout(() => Sfx.check(), 110);
    render();
    if (!remote && mode === 'net' && conn && conn.open)
      conn.send({
        t: 'move',
        from: m.from,
        to: m.to,
        promo: m.promo || null,
        clk: Math.round(clock[mover]),
      });
    if (remote && premoves.length) setTimeout(runPremove, 40);
    if (mode === 'cpu') cpuMove();
  }

  function startGame(m, color, newTc) {
    mode = m;
    me = color || 'w';
    tc = newTc || null;
    cancelDrag();
    stopAnim();
    st = newState();
    sel = null;
    targets = [];
    last = null;
    marks = [];
    drag = null;
    over = false;
    caps = { w: [], b: [] };
    history = [];
    positions = [st];
    moves = [];
    premoves = [];
    review = null;
    an = null;
    anToken++;
    $('#analysis').hidden = true;
    $('#btnAnalyze').hidden = true;
    $('#btnPre').hidden = mode !== 'net';
    $('#btnPreClear').hidden = mode !== 'net';
    $('#cpuBar').hidden = mode !== 'cpu';
    cpuToken++;
    if (mode === 'cpu') {
      sfStop();
      sfSend('ucinewgame');
    }
    const t0 = tc ? tc.min * 60000 : 0;
    clock = { w: t0, b: t0 };
    lastTick = performance.now();
    clearInterval(timer);
    timer = setInterval(tick, 100);
    $('#over').hidden = true;
    $('#promo').hidden = true;
    $('#lobby').hidden = true;
    $('#game').hidden = false;
    $('#modeTag').textContent = modeTitle(tc);
    updateStatus();
    render();
    if (mode === 'cpu') cpuMove();
  }

  function endByResign(loser) {
    const detail =
      mode === 'local'
        ? `As ${side(loser)} desistiram.`
        : loser === me
        ? 'Você desistiu da partida.'
        : 'Seu amigo desistiu da partida.';
    finish('Desistência', detail, opp(loser));
  }

  /* ===== SETAS E CÍRCULOS (só visuais; não afetam a partida) ===== */
  const MARK_COLORS = { normal: '#ff9a1f', shift: '#e5484d', alt: '#3b82f6' };
  const colorOf = (e) =>
    e.shiftKey ? MARK_COLORS.shift : e.altKey || e.ctrlKey ? MARK_COLORS.alt : MARK_COLORS.normal;

  function sqAtXY(cx, cy) {
    const b = $('#board'),
      r = b.getBoundingClientRect(),
      w = b.clientWidth / 8;
    const x = Math.floor((cx - r.left - b.clientLeft) / w);
    const y = Math.floor((cy - r.top - b.clientTop) / w);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return effectiveFlip() ? (7 - y) * 8 + (7 - x) : y * 8 + x;
  }
  const sqAt = (e) => sqAtXY(e.clientX, e.clientY);

  function toggleMark({ from, to, color }) {
    const type = from === to ? 'circle' : 'arrow';
    const i = marks.findIndex((m) => m.type === type && m.from === from && m.to === to);
    if (i >= 0) {
      const same = marks[i].color === color;
      marks.splice(i, 1);
      if (same) return;
    }
    marks.push({ type, from, to, color });
  }

  function drawMarks() {
    const svg = $('#marks');
    if (!svg || !st) return;
    const pos = (i) => {
      let r = i >> 3,
        c = i & 7;
      if (effectiveFlip()) {
        r = 7 - r;
        c = 7 - c;
      }
      return [c + 0.5, r + 0.5];
    };
    const list = drag
      ? marks.concat([
          {
            type: drag.from === drag.to ? 'circle' : 'arrow',
            from: drag.from,
            to: drag.to,
            color: drag.color,
          },
        ])
      : marks;
    let h = '';
    for (const m of list) {
      const [x1, y1] = pos(m.from);
      if (m.type === 'circle') {
        h += `<circle cx="${x1}" cy="${y1}" r=".4" fill="none" stroke="${m.color}" stroke-width=".085" opacity=".85"/>`;
        continue;
      }
      const [x2, y2] = pos(m.to),
        dx = x2 - x1,
        dy = y2 - y1,
        len = Math.hypot(dx, dy),
        ux = dx / len,
        uy = dy / len;
      const hl = 0.42,
        hw = 0.5;
      const tx = x2 - ux * 0.12,
        ty = y2 - uy * 0.12; // ponta
      const bx = tx - ux * hl,
        by = ty - uy * hl; // base da ponta
      const sx = x1 + ux * 0.18,
        sy = y1 + uy * 0.18; // início
      h +=
        `<g opacity=".85"><line x1="${sx}" y1="${sy}" x2="${bx}" y2="${by}" stroke="${m.color}" stroke-width=".17" stroke-linecap="round"/>` +
        `<polygon points="${tx},${ty} ${bx - uy * (hw / 2)},${by + ux * (hw / 2)} ${
          bx + uy * (hw / 2)
        },${by - ux * (hw / 2)}" fill="${m.color}"/></g>`;
    }
    svg.innerHTML = h;
  }

  /* ===== ARRASTAR PEÇAS (com um balanço sutil, como se a peça tivesse peso) ===== */
  const sqEl = (i) => $(`[data-i="${i}"]`);

  const placeGhost = () => {
    ghost.style.transform = `translate(${dnd.x - dnd.size / 2}px, ${
      dnd.y - dnd.size / 2 + dnd.oy
    }px) rotate(${dnd.ang}deg) scale(1.1)`;
  };

  function startGhost(e) {
    const size = $('#board').clientWidth / 8,
      p = st.board[dnd.from];
    ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.width = ghost.style.height = size + 'px';
    ghost.style.fontSize = size * 0.78 + 'px';
    ghost.innerHTML = `<span class="piece ${p[0]}">${GL[p[1]]}</span>`;
    document.body.appendChild(ghost);
    Object.assign(dnd, {
      moved: true,
      size,
      x: e.clientX,
      px: e.clientX,
      y: e.clientY,
      ang: 0,
      av: 0,
      vx: 0,
      hover: -1,
      t: performance.now(),
      oy: e.pointerType === 'touch' ? -size * 0.7 : 0,
    });
    render(); // esconde a peça na casa de origem
    placeGhost();
    raf = requestAnimationFrame(stepGhost);
  }

  /* mola amortecida: a peça se inclina para o lado em que é puxada e balança de volta */
  function stepGhost(now) {
    if (!dnd || !ghost) return;
    const dt = Math.min(0.032, Math.max(0.001, (now - dnd.t) / 1000));
    dnd.t = now;
    const vx = (dnd.x - dnd.px) / dt;
    dnd.px = dnd.x;
    dnd.vx += (vx - dnd.vx) * 0.25;
    const target = REDUCE ? 0 : Math.max(-9, Math.min(9, dnd.vx / 90)); // no máximo ~9 graus
    dnd.av += (-170 * (dnd.ang - target) - 13 * dnd.av) * dt;
    dnd.ang += dnd.av * dt;
    placeGhost();
    raf = requestAnimationFrame(stepGhost);
  }

  function setHover(i) {
    if (dnd.hover === i) return;
    const old = sqEl(dnd.hover);
    if (old) old.classList.remove('drop');
    dnd.hover = i;
    if (i >= 0 && targets.some((m) => m.to === i)) sqEl(i).classList.add('drop');
  }

  function cancelDrag() {
    cancelAnimationFrame(raf);
    dnd = null;
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
  }

  function snapBack(d) {
    // solta em lugar inválido: a peça volta deslizando
    const g = ghost;
    ghost = null;
    render();
    const el = sqEl(d.from);
    if (!el) return g.remove();
    const r = el.getBoundingClientRect();
    g.style.transition = 'transform .14s ease-out';
    g.style.transform = `translate(${r.left}px, ${r.top}px)`;
    setTimeout(() => g.remove(), 170);
  }

  function endDrag(e) {
    const d = dnd;
    cancelAnimationFrame(raf);
    dnd = null;
    if (!d.moved) return click(d.from); // foi só um clique
    const i = sqAtXY(e.clientX, e.clientY + d.oy);
    const ms = i >= 0 ? targets.filter((m) => m.to === i) : [];
    if (!ms.length) return snapBack(d);
    ghost.remove();
    ghost = null;
    if (ms[0].promo) {
      render();
      askPromo(ms);
    } else commit(ms[0]);
  }

  /* ===== PONTEIRO: peças (botão esquerdo) e setas (botão direito) ===== */
  const boardEl = $('#board');
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());
  boardEl.addEventListener('pointerdown', (e) => {
    if (e.button === 0) {
      if (marks.length) {
        marks = [];
        drawMarks();
      }
      if (dnd) return;
      const i = sqAt(e);
      if (i < 0) return;
      dnd = { from: i, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, click: true };
      if (!over && review === null && (mode === 'net' ? st.turn === me || premoveOn : mode === 'cpu' ? st.turn === me : true)) {
        const S = premoving() ? projected() : st;
        const p = S.board[i];
        if (p && p[0] === S.turn) {
          // pegou uma peça sua: seleciona e permite arrastar
          dnd.click = false;
          sel = i;
          targets = movesFrom(i);
          render();
        }
      }
      try {
        boardEl.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
    } else if (e.button === 2) {
      const s = sqAt(e);
      if (s < 0) return;
      drag = { from: s, to: s, color: colorOf(e) };
      drawMarks();
      e.preventDefault();
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (dnd && e.pointerId === dnd.id) {
      if (!dnd.moved) {
        if (dnd.click || Math.hypot(e.clientX - dnd.sx, e.clientY - dnd.sy) < 4) return;
        startGhost(e);
      }
      dnd.x = e.clientX;
      dnd.y = e.clientY;
      setHover(sqAtXY(dnd.x, dnd.y + dnd.oy));
      return;
    }
    if (!drag) return;
    const s = sqAt(e);
    if (s !== -1 && s !== drag.to) {
      drag.to = s;
      drawMarks();
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (dnd && e.button === 0 && e.pointerId === dnd.id) return endDrag(e);
    if (!drag || e.button !== 2) return;
    const d = drag;
    drag = null;
    const s = sqAt(e);
    if (s !== -1) {
      d.to = s;
      toggleMark(d);
    }
    drawMarks();
  });

  window.addEventListener('pointercancel', (e) => {
    if (dnd && e.pointerId === dnd.id) {
      cancelDrag();
      render();
    }
    if (drag) {
      drag = null;
      drawMarks();
    }
  });

  /* ===== REVISÃO DA PARTIDA (após o fim, sem precisar de análise) ===== */
  function showRev(i) {
    if (!over || !moves.length) return;
    review = Math.max(0, Math.min(moves.length, i));
    marks = [];
    render();
  }

  function liveGame() {
    if (review === null) return;
    review = null;
    marks = [];
    render();
  }

  $('#moves').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li && over && !an) showRev(+li.dataset.k);
  });
  $('#btnRevPrev').onclick = () => showRev((review === null ? moves.length : review) - 1);
  $('#btnRevNext').onclick = () => showRev((review === null ? moves.length : review) + 1);
  $('#btnRevLive').onclick = liveGame;

  /* ===== REDE (PeerJS: conexão direta entre os dois PCs) ===== */
  function onData(d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'init')
      startGame('net', 'b', d.tc && d.tc.min ? { min: +d.tc.min, inc: +d.tc.inc || 0 } : null);
    else if (!st) return;
    else if (d.t === 'move') {
      const m = legalMoves(st).find(
        (x) => x.from === d.from && x.to === d.to && (x.promo || null) === d.promo
      );
      if (m && !over && st.turn !== me) play(m, true, d.clk);
    } else if (d.t === 'resign') {
      if (!over) endByResign(opp(me));
    } else if (d.t === 'timeout') {
      if (!over && (d.loser === 'w' || d.loser === 'b')) timeout(d.loser, false);
    } else if (d.t === 'new') startGame('net', opp(me), tc);
  }

  function onClose() {
    if (over || !st) return;
    finish('Partida encerrada', 'Seu amigo saiu da partida.', me);
  }

  function peerError(e) {
    $('#lobbyMsg').textContent =
      e.type === 'peer-unavailable'
        ? 'Sala não encontrada. Confira o código.'
        : 'Erro de conexão: ' + e.type;
  }

  $('#btnCreate').onclick = () => {
    if (peer) peer.destroy();
    conn = null;
    roomTc = tcOf(chosen);
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    lastCode = code;
    $('#roomInfo').textContent = 'Criando sala...';
    $('#copyRow').hidden = true;
    peer = new Peer('xadrez-' + code);
    peer.on('open', () => {
      $('#roomInfo').innerHTML = `Código da sala: <b>${code}</b>. Envie o código ao amigo e aguarde ele entrar.`;
      $('#copyRow').hidden = false;
    });
    peer.on('connection', (c) => {
      if (conn) return c.close();
      conn = c;
      c.on('data', onData);
      c.on('close', onClose);
      const go = () => {
        c.send({ t: 'init', tc: roomTc });
        startGame('net', 'w', roomTc);
      };
      if (c.open) go();
      else c.on('open', go);
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
      const c = peer.connect('xadrez-' + code, { reliable: true });
      conn = c;
      c.on('data', onData); // a partida começa quando o anfitrião envia o modo (init)
      c.on('close', onClose);
    });
    peer.on('error', peerError);
  };

  $('#codeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btnJoin').click();
  });

  $('#btnCopy').onclick = async () => {
    if (!lastCode) return;
    try {
      await navigator.clipboard.writeText(lastCode);
      $('#btnCopy').textContent = '✓ Copiado!';
    } catch (_) {
      // fallback para contextos sem clipboard API
      const r = document.createRange();
      r.selectNodeContents($('#roomInfo'));
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      $('#btnCopy').textContent = 'Código selecionado';
    }
    setTimeout(() => ($('#btnCopy').textContent = '📋 Copiar código'), 1600);
  };

  $('#btnLocal').onclick = () => startGame('local', 'w', tcOf(chosen));

  $('#btnResign').onclick = () => {
    if (over || !confirm('Desistir da partida?')) return;
    if (mode === 'net') {
      if (conn && conn.open) conn.send({ t: 'resign' });
      endByResign(me);
    } else endByResign(mode === 'cpu' ? me : st.turn);
  };

  function newGame() {
    if (!over && !confirm('Começar nova partida?')) return;
    if (mode === 'net') {
      if (!conn || !conn.open) {
        $('#over').hidden = true;
        setStatus('O amigo não está mais conectado. Volte ao menu para criar outra sala.');
        return;
      }
      conn.send({ t: 'new' });
      startGame('net', opp(me), tc);
    } else if (mode === 'cpu') startGame('cpu', me, tc);
    else startGame('local', 'w', tc);
  }

  $('#btnNew').onclick = newGame;
  $('#btnOverNew').onclick = newGame;
  $('#btnOverClose').onclick = () => {
    $('#over').hidden = true;
  };

  for (const b of document.querySelectorAll('.menu-btn'))
    b.onclick = () => {
      if (!over && !confirm('Voltar ao menu? A partida atual será perdida.')) return;
      location.reload();
    };

  /* ===== CONTROLES VISUAIS: girar, som, coordenadas ===== */
  function syncViewButtons() {
    $('#btnSound').textContent = Sfx.on ? '🔊 Som: ON' : '🔇 Som: OFF';
    $('#btnCoords').textContent = coordsOn ? 'Coordenadas: ON' : 'Coordenadas: OFF';
    document.body.classList.toggle('no-coords', !coordsOn);
  }
  $('#btnFlip').onclick = () => {
    manualFlip = !manualFlip;
    render();
  };
  $('#btnSound').onclick = () => {
    Sfx.on = !Sfx.on;
    if (Sfx.on) Sfx.move();
    saveCfg();
    syncViewButtons();
  };
  $('#btnCoords').onclick = () => {
    coordsOn = !coordsOn;
    saveCfg();
    syncViewButtons();
  };

  /* ===== ANÁLISE DA PARTIDA ===== */
  const CLS = {
    sigma: { label: 'Sigma', sym: '!!', color: '#26c9a8', note: 'Sacrifício brilhante: não era óbvio e ainda assim era dos melhores lances.' },
    awesome: { label: 'Awesome', sym: '!', color: '#7aa7d6', note: 'Lance quase único: as alternativas eram bem piores.' },
    best: { label: 'Best', sym: '★', color: '#7bd88f' },
    book: { label: 'Livro', sym: '📖', color: '#b79b72', note: 'Lance de teoria de abertura.' },
    excellent: { label: 'Excelente', sym: '✓', color: '#5fc2a3' },
    good: { label: 'Bom', sym: '•', color: '#a9b6c4' },
    strange: { label: 'Strange', sym: '?!', color: '#f2c14e' },
    bad: { label: 'Bad', sym: '?', color: '#ef8f3a' },
    miss: { label: 'Miss', sym: '✕', color: '#e5484d', note: 'O adversário errou no lance anterior e você não aproveitou.' },
    clown: { label: 'Clown', sym: '??', color: '#a31d24' },
  };
  const MAIN = ['sigma', 'awesome', 'best', 'book', 'strange', 'bad', 'miss', 'clown'],
    EXTRA = ['excellent', 'good'];
  const nameOf = (c) => Side(c) + ((mode === 'net' || mode === 'cpu') && c === me ? ' (você)' : '');

  function fmtEval(score, turn) {
    const w = turn === 'w' ? score : -score;
    if (Math.abs(score) >= MATE - 100) {
      const n = Math.ceil((MATE - Math.abs(score)) / 2);
      return (w > 0 ? '+' : '−') + (n ? 'M' + n : '#');
    }
    return (w >= 0 ? '+' : '−') + Math.abs(w / 100).toFixed(2);
  }

  // Análise com Stockfish: profundidade/tempo por posição (suba para mais precisão, desça para mais rapidez)
  const SF_DEPTH = 14,
    SF_MOVETIME = 1000;

  async function sfEvalPos(pos, played) {
    const legal = legalMoves(pos);
    if (!legal.length) return { score: inCheck(pos, pos.turn) ? -MATE : 0, move: null, n: 0 };
    const setup = ['setoption name MultiPV value 2'];
    if (sf.hasElo) setup.push('setoption name UCI_LimitStrength value false');
    if (sf.hasSkill) setup.push('setoption name Skill Level value 20');
    const list = played.map((m) => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : ''));
    const posCmd = 'position startpos' + (list.length ? ' moves ' + list.join(' ') : '');
    const scores = {};
    const bm = await sfSearch(setup, posCmd, `go depth ${SF_DEPTH} movetime ${SF_MOVETIME}`, (l) => {
      if (!/ pv /.test(l) || /bound/.test(l)) return;
      const m = /score (cp|mate) (-?\d+)/.exec(l);
      if (!m) return;
      const v = +m[2];
      const mp = /multipv (\d+)/.exec(l);
      scores[mp ? +mp[1] : 1] = m[1] === 'cp' ? v : (v > 0 ? 1 : -1) * (MATE - 2 * Math.abs(v) + 1);
    });
    const move = legal.find(
      (x) =>
        bm &&
        sqName(x.from) === bm.slice(0, 2) &&
        sqName(x.to) === bm.slice(2, 4) &&
        (x.promo || null) === (bm[4] ? bm[4].toUpperCase() : null)
    );
    return { score: scores[1] || 0, score2: legal.length > 1 && scores[2] !== undefined ? scores[2] : null, move: move || legal[0], n: legal.length };
  }

  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  async function startAnalysis() {
    if (!moves.length) return;
    $('#over').hidden = true;
    const panel = $('#analysis');
    panel.hidden = false;
    panel.scrollIntoView({ block: 'start' });
    if (an && an.done) return showAnalysis();
    $('#anProgress').hidden = false;
    $('#anResult').hidden = true;
    const token = ++anToken,
      pos = positions.slice(),
      mv = moves.map((x) => x.m),
      evals = [];
    let shallow = [],
      useSf = true;
    try {
      await sfLoad();
    } catch (_) {
      useSf = false; // sem Stockfish: usa o motor simples (menos fiável)
    }
    for (let i = 0; i < pos.length; i++) {
      if (token !== anToken) return; // começou outra partida ou outra análise
      $('#anBar').style.width = Math.round((i / pos.length) * 100) + '%';
      $('#anText').textContent = `Analisando posição ${i + 1} de ${pos.length}…`;
      await frame();
      if (useSf) {
        const e = await sfEvalPos(pos[i], mv.slice(0, i));
        if (token !== anToken) return;
        evals.push(e);
      } else {
        evals.push(analyze(pos[i], ANALYSIS_DEPTH));
        shallow.push(analyze(pos[i], ANALYSIS_DEPTH - 1));
      }
    }
    if (token !== anToken) return;
    if (useSf) shallow = evals; // mesma profundidade para o melhor lance e para o lance jogado
    an = { evals, rates: rateMoves(pos, mv, evals, useSf ? null : shallow), done: true, sf: useSf };
    review = null;
    showAnalysis();
  }

  const phaseOf = (k) => (pieceCount(positions[k].board) <= 6 ? 2 : k < 20 ? 0 : 1);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const phCls = (v) => (v === null ? null : v >= 90 ? 'best' : v >= 80 ? 'excellent' : v >= 65 ? 'good' : v >= 50 ? 'strange' : v >= 35 ? 'bad' : 'clown');
  const badge = (k) => `<span class="bd c-${k}" title="${CLS[k].label}">${CLS[k].sym}</span>`;

  function drawGraph() {
    const N = an.evals.length,
      W = 300,
      H = 90;
    const pts = an.evals.map((e, i) => {
      const w = positions[i].turn === 'w' ? e.score : -e.score;
      return [(i / (N - 1 || 1)) * W, H - (winPct(clampCp(w)) / 100) * H];
    });
    let h = `<rect width="${W}" height="${H}" fill="#12100c"/>`;
    h += `<path d="M0,${H} ${pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${W},${H} Z" fill="#d9d2c3"/>`;
    h += `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#7a6f60" stroke-width=".6"/>`;
    an.rates.forEach((r, k) => {
      if (['sigma', 'awesome', 'strange', 'bad', 'miss', 'clown'].includes(r.cls))
        h += `<circle cx="${pts[k + 1][0].toFixed(1)}" cy="${pts[k + 1][1].toFixed(1)}" r="2.6" fill="${CLS[r.cls].color}" stroke="#12100c" stroke-width=".6"/>`;
    });
    if (review !== null) h += `<line x1="${pts[review][0].toFixed(1)}" x2="${pts[review][0].toFixed(1)}" y1="0" y2="${H}" stroke="#f2c14e" stroke-width="1"/>`;
    $('#anGraph').innerHTML = h;
  }

  function showAnalysis() {
    $('#anProgress').hidden = true;
    $('#anResult').hidden = false;
    $('#anEngine').textContent = an.sf
      ? `Motor: Stockfish (profundidade ${SF_DEPTH}, até ${SF_MOVETIME / 1000}s por posição).`
      : 'O Stockfish não carregou: análise simplificada, pouco fiável (sem Sigma/Awesome). Coloque stockfish.js na pasta do site.';
    const rates = an.rates,
      acc = { w: [], b: [] },
      cnt = { w: {}, b: {} },
      ph = { w: [[], [], []], b: [[], [], []] };
    rates.forEach((r, k) => {
      acc[r.mover].push(r.acc);
      cnt[r.mover][r.cls] = (cnt[r.mover][r.cls] || 0) + 1;
      ph[r.mover][phaseOf(k)].push(r.acc);
    });
    const f1 = (a) => (a.length ? avg(a).toFixed(1) : '–');
    // classificação estimada a partir da precisão (aproximação; não é a do chess.com)
    const rating = (a) => (a.length ? Math.round(Math.max(100, 3000 * Math.pow(avg(a) / 100, 4)) / 50) * 50 : '–');
    const row = (k, extra) =>
      `<tr${extra ? ' class="extra"' : ''}><td>${badge(k)} ${CLS[k].label}</td><td>${cnt.w[k] || 0}</td><td>${cnt.b[k] || 0}</td></tr>`;
    let h = `<table class="an-sum"><tr><th></th><th>${nameOf('w')}</th><th>${nameOf('b')}</th></tr>`;
    h += `<tr class="acc"><td>Precisão</td><td>${f1(acc.w)}</td><td>${f1(acc.b)}</td></tr>`;
    h += `<tr><td>Classificação da partida (estimada)</td><td>${rating(acc.w)}</td><td>${rating(acc.b)}</td></tr>`;
    h += MAIN.map((k) => row(k)).join('');
    h += `<tr class="more"><td colspan="3"><button type="button" id="anMore" class="link" aria-label="Mostrar mais">▾</button></td></tr>`;
    h += EXTRA.map((k) => row(k, true)).join('');
    ['Abertura', 'Meio-jogo', 'Final'].forEach((name, p) => {
      const c = (col) => {
        const v = avg(ph[col][p]),
          k = phCls(v);
        return k ? badge(k) : '–';
      };
      h += `<tr class="phase"><td>${name}</td><td>${c('w')}</td><td>${c('b')}</td></tr>`;
    });
    $('#anSummary').innerHTML = h + '</table>';
    $('#anCoach').textContent = coachLine(rates, an.evals, positions);
    drawGraph();
    const cell = (k) =>
      `<td><button type="button" class="mv-btn" data-k="${k + 1}">${moves[k].txt}${badge(rates[k].cls)}</button></td>`;
    let t = '';
    for (let k = 0; k < moves.length; k += 2)
      t += `<tr><td class="n">${k / 2 + 1}.</td>${cell(k)}${k + 1 < moves.length ? cell(k + 1) : '<td></td>'}</tr>`;
    $('#anMoves').innerHTML = t;
    $('#anDetail').textContent = 'Clique num lance ou no gráfico (ou use as setas ← →) para ver a posição e o comentário.';
    render();
  }

  $('#anSummary').addEventListener('click', (e) => {
    const b = e.target.closest('#anMore');
    if (!b) return;
    const tb = $('#anSummary table');
    tb.classList.toggle('open');
    b.textContent = tb.classList.contains('open') ? '▴' : '▾';
  });
  $('#anGraph').addEventListener('click', (e) => {
    if (!an || !an.done) return;
    const r = e.currentTarget.getBoundingClientRect();
    gotoReview(Math.round(((e.clientX - r.left) / r.width) * (positions.length - 1)));
  });

  function gotoReview(i) {
    if (!an || !an.done) return;
    review = Math.max(0, Math.min(moves.length, i));
    marks = [];
    render();
    for (const b of document.querySelectorAll('#anMoves .mv-btn'))
      b.classList.toggle('on', +b.dataset.k === review);
    const k = review - 1;
    if (k < 0) {
      drawGraph();
      return ($('#anDetail').textContent = 'Posição inicial.');
    }
    const r = an.rates[k],
      e = an.evals[k],
      mm = moves[k];
    let t = `Lance ${Math.floor(k / 2) + 1}${mm.mover === 'b' ? '…' : '.'} ${mm.txt}: ${CLS[r.cls].label} (${CLS[r.cls].sym}).`;
    if (!['best', 'book', 'sigma', 'awesome'].includes(r.cls) && e.move) t += ` O motor preferia ${moveText(positions[k], e.move)}.`;
    t += ` Avaliação (brancas): ${fmtEval(e.score, positions[k].turn)} → ${fmtEval(an.evals[k + 1].score, positions[k + 1].turn)}.`;
    if (CLS[r.cls].note) t += ' ' + CLS[r.cls].note;
    $('#anDetail').textContent = t;
    drawGraph();
    const cur = document.querySelector('#anMoves .mv-btn.on');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function closeAnalysis() {
    review = null;
    marks = [];
    $('#analysis').hidden = true;
    render();
  }

  $('#anMoves').addEventListener('click', (e) => {
    const b = e.target.closest('.mv-btn');
    if (b) gotoReview(+b.dataset.k);
  });
  $('#anPrev').onclick = () => gotoReview((review === null ? moves.length : review) - 1);
  $('#anNext').onclick = () => gotoReview((review === null ? moves.length : review) + 1);
  $('#btnAnClose').onclick = closeAnalysis;
  $('#btnAnalyze').onclick = startAnalysis;
  $('#btnOverAnalyze').onclick = startAnalysis;

  /* ===== PRÉ-MOVES: botão e atalhos ===== */
  $('#btnPre').onclick = () => {
    premoveOn = !premoveOn;
    saveCfg();
    if (!premoveOn) {
      premoves = [];
      sel = null;
      targets = [];
    }
    render();
  };
  $('#btnPreClear').onclick = clearPremoves;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (premoves.length || sel !== null)) clearPremoves();
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    if (an && an.done && !$('#analysis').hidden) {
      e.preventDefault();
      gotoReview((review === null ? moves.length : review) + dir);
    } else if (over && moves.length) {
      e.preventDefault();
      showRev((review === null ? moves.length : review) + dir);
    }
  });

  /* ===== STOCKFISH (corre no navegador, num Web Worker; não precisa de API) ===== */
  // Ordem de tentativa: ficheiro local (recomendado) e depois CDNs.
  const SF_URLS = [
    'stockfish.js',
    'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
    'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
  ];
  const ELO_MIN = 800;
  let cpuElo = 1500,
    cpuSide = 'w',
    cpuToken = 0;
  const sf = { w: null, ready: null, hasElo: false, eloMin: 1320, eloMax: 3190, hasSkill: false, listeners: new Set() };
  let sfChain = Promise.resolve();

  const sfSend = (c) => sf.w && sf.w.postMessage(c);
  const sfStop = () => sf.w && sf.w.postMessage('stop');

  function sfMakeWorker(url) {
    try {
      return new Worker(url);
    } catch (_) {
      // worker de outra origem (CDN): carrega-o através de um Blob
      const abs = new URL(url, location.href).href;
      const blob = new Blob([`importScripts(${JSON.stringify(abs)});`], { type: 'text/javascript' });
      return new Worker(URL.createObjectURL(blob));
    }
  }

  function sfTry(url) {
    return new Promise((resolve, reject) => {
      let w;
      try {
        w = sfMakeWorker(url);
      } catch (e) {
        return reject(e);
      }
      const opts = { hasElo: false, eloMin: 1320, eloMax: 3190, hasSkill: false };
      const fail = (e) => {
        clearTimeout(to);
        w.terminate();
        reject(e);
      };
      const to = setTimeout(() => fail(new Error('timeout')), 15000);
      w.onerror = () => fail(new Error('erro ao carregar ' + url));
      w.onmessage = (ev) => {
        const l = typeof ev.data === 'string' ? ev.data : '';
        if (l.startsWith('option name UCI_Elo')) {
          opts.hasElo = true;
          const mn = /min (\d+)/.exec(l),
            mx = /max (\d+)/.exec(l);
          if (mn) opts.eloMin = +mn[1];
          if (mx) opts.eloMax = +mx[1];
        } else if (l.startsWith('option name Skill Level')) opts.hasSkill = true;
        else if (l === 'uciok') {
          clearTimeout(to);
          w.onerror = null;
          resolve({ w, ...opts });
        }
      };
      w.postMessage('uci');
    });
  }

  function sfLoad() {
    if (sf.ready) return sf.ready;
    sf.ready = (async () => {
      let lastErr;
      for (const u of SF_URLS) {
        try {
          const r = await sfTry(u);
          Object.assign(sf, r);
          sf.w.onmessage = (ev) => {
            const l = typeof ev.data === 'string' ? ev.data : '';
            for (const f of [...sf.listeners]) f(l);
          };
          return true;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error('Stockfish indisponível');
    })();
    sf.ready.catch(() => (sf.ready = null));
    return sf.ready;
  }

  // Posição + "go" em série; devolve o lance no formato UCI (ex.: "e2e4", "e7e8q").
  function sfSearch(setup, posCmd, goCmd, onInfo) {
    const p = sfChain.then(
      () =>
        new Promise((res) => {
          const f = (l) => {
            if (onInfo && l.startsWith('info')) onInfo(l);
            if (l.startsWith('bestmove')) {
              sf.listeners.delete(f);
              res(l.split(' ')[1]);
            }
          };
          sf.listeners.add(f);
          setup.forEach(sfSend);
          sfSend(posCmd);
          sfSend(goCmd);
        })
    );
    sfChain = p.catch(() => {});
    return p;
  }

  // Elo -> definições do motor. Usa UCI_Elo quando o motor tem (Elo >= mínimo dele);
  // senão usa "Skill Level" + limite de profundidade (aproximado).
  function sfStrength(elo) {
    const setup = ['setoption name MultiPV value 1'];
    let depth = null;
    if (sf.hasElo && elo >= sf.eloMin) {
      setup.push('setoption name UCI_LimitStrength value true');
      setup.push('setoption name UCI_Elo value ' + Math.min(elo, sf.eloMax));
    } else {
      if (sf.hasElo) setup.push('setoption name UCI_LimitStrength value false');
      const skill = Math.max(0, Math.min(20, Math.round((elo - 800) / 100)));
      if (sf.hasSkill) setup.push('setoption name Skill Level value ' + skill);
      if (elo < 1320) depth = 1 + Math.round((elo - ELO_MIN) / 260); // 800 -> 1 … 1320 -> 3
    }
    const mt = Math.max(300, Math.min(1800, Math.round(300 + (elo - 800) * 0.6)));
    return { setup, depth, mt };
  }

  async function cpuMove() {
    if (mode !== 'cpu' || over || !st || st.turn === me) return;
    const token = ++cpuToken;
    setStatus('O Stockfish está a pensar…');
    let uci;
    try {
      await sfLoad();
      if (token !== cpuToken) return;
      const { setup, depth, mt } = sfStrength(cpuElo);
      let ms = mt;
      if (tc) ms = Math.max(50, Math.min(ms, Math.floor(clock[st.turn] / 25)));
      const list = moves.map((x) => sqName(x.m.from) + sqName(x.m.to) + (x.m.promo ? x.m.promo.toLowerCase() : ''));
      const pos = 'position startpos' + (list.length ? ' moves ' + list.join(' ') : '');
      const t0 = performance.now();
      uci = await sfSearch(setup, pos, `go ${depth ? 'depth ' + depth + ' ' : ''}movetime ${ms}`);
      const wait = 250 - (performance.now() - t0); // evita lances "instantâneos"
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    } catch (e) {
      if (token === cpuToken) setStatus('Não foi possível carregar o Stockfish (veja se stockfish.js está na pasta do site).');
      return;
    }
    if (token !== cpuToken || over || st.turn === me || !uci || uci === '(none)') return;
    const m = legalMoves(st).find(
      (x) =>
        sqName(x.from) === uci.slice(0, 2) &&
        sqName(x.to) === uci.slice(2, 4) &&
        (x.promo || null) === (uci[4] ? uci[4].toUpperCase() : null)
    );
    if (m) play(m, true);
  }

  function updateEloUI(v) {
    cpuElo = +v;
    for (const s of ['#eloRange', '#eloRange2']) $(s).value = cpuElo;
    for (const s of ['#eloOut', '#eloOut2']) $(s).textContent = cpuElo;
    saveCfg();
    if (mode === 'cpu') render();
  }
  $('#eloRange').oninput = (e) => updateEloUI(e.target.value);
  $('#eloRange2').oninput = (e) => updateEloUI(e.target.value);

  $('#btnCpu').onclick = async () => {
    const pick = $('#cpuColor').value;
    cpuSide = pick === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : pick;
    $('#cpuMsg').textContent = 'A carregar o Stockfish…';
    $('#btnCpu').disabled = true;
    try {
      await sfLoad();
      $('#cpuMsg').textContent = '';
      startGame('cpu', cpuSide, tcOf(chosen));
    } catch (e) {
      $('#cpuMsg').textContent =
        'Não consegui carregar o Stockfish. Coloque o ficheiro stockfish.js na mesma pasta do site e abra por um servidor local (não por file://).';
    }
    $('#btnCpu').disabled = false;
  };

  /* ===== INÍCIO ===== */
  applyCfg();
  buildModes();
  syncViewButtons();
  for (const s of ['#eloRange', '#eloRange2']) $(s).value = cpuElo;
  for (const s of ['#eloOut', '#eloOut2']) $(s).textContent = cpuElo;
}
