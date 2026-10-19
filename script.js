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
  if (isBest || loss < 1) return 'best';
  if (loss < 3) return 'great';
  if (loss < 14) return 'good';
  if (loss < 24) return 'inacc';
  if (loss < 34) return 'mistake';
  return 'blunder';
}

// positions[k] = posição depois de k lances; mvs[k] = lance que leva de positions[k] a positions[k+1].
// evals[k] = analyze(positions[k], D) (o melhor possível); shallow[k] = analyze(positions[k], D-1).
// O lance jogado vale -shallow[k+1]: assim os dois valores vêm da mesma profundidade de busca.
function rateMoves(positions, mvs, evals, shallow) {
  return mvs.map((m, k) => {
    const e = evals[k];
    const same =
      e.move && e.move.from === m.from && e.move.to === m.to && (e.move.promo || null) === (m.promo || null);
    const best = clampCp(e.score),
      played = clampCp(-shallow[k + 1].score);
    let loss = Math.max(0, winPct(best) - winPct(played));
    if (same || e.n <= 1) loss = 0;
    return { loss, cls: classifyLoss(loss, same || e.n <= 1), acc: accuracyOf(loss), mover: positions[k].turn };
  });
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
    evaluate,
    MATE,
  };
} else {
  /* ===== INTERFACE ===== */
  const $ = (s) => document.querySelector(s);
  const side = (c) => (c === 'w' ? 'brancas' : 'pretas');
  const Side = (c) => (c === 'w' ? 'Brancas' : 'Pretas');

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
  let chosen = MODES.find((m) => m.min === 5 && m.inc === 0);
  let roomTc = null;
  let positions = [], // positions[k] = posição depois de k lances
    moves = [], // {m, txt, mover}
    premoves = [],
    premoveOn = false,
    review = null, // índice da posição mostrada na revisão (null = jogo normal)
    an = null,
    anToken = 0;
  const ANALYSIS_DEPTH = 4;

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
          buildModes();
        };
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

  function render() {
    const board = $('#board'),
      flip = me === 'b',
      inReview = review !== null,
      S = inReview ? positions[review] : st,
      lastM = inReview ? (review > 0 ? moves[review - 1].m : null) : last,
      selI = inReview ? null : sel,
      tg = inReview ? [] : targets;
    board.innerHTML = '';
    const chk = inCheck(S, S.turn) ? kingSq(S.board, S.turn) : -1;
    const pre = premoves.length ? new Set(premoves.flatMap((p) => [p.from, p.to])) : null;
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
      e.querySelector('.caps').textContent = caps[col].map((x) => GL[x[1]]).join('');
      e.classList.toggle('turn', !over && st.turn === col);
    }
    $('#moves').innerHTML = history.map((h) => `<li>${h}</li>`).join('');
    $('#moves').scrollTop = 1e6;
    updatePreBtn();
    updateClocks();
    drawMarks();
  }

  function setStatus(t) {
    $('#status').textContent = t;
  }

  function updateStatus() {
    const moves = legalMoves(st),
      chk = inCheck(st, st.turn);
    if (!moves.length) {
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
    if (n.captured) caps[mover].push(n.captured);
    history.push(txt);
    moves.push({ m, txt, mover });
    positions.push(n);
    st = n;
    last = m;
    sel = null;
    targets = [];
    marks = [];
    updateStatus();
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
    return me === 'b' ? (7 - y) * 8 + (7 - x) : y * 8 + x;
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
      if (me === 'b') {
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
  const REDUCE =
    window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    $('#roomInfo').textContent = 'Criando sala...';
    peer = new Peer('xadrez-' + code);
    peer.on('open', () => {
      $('#roomInfo').innerHTML = `Código da sala: <b>${code}</b>. Envie o código ao amigo e aguarde ele entrar.`;
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

  /* ===== ANÁLISE DA PARTIDA ===== */
  const CLS = {
    best: { label: 'Melhor', sym: '★' },
    great: { label: 'Excelente', sym: '!' },
    good: { label: 'Bom', sym: '✓' },
    inacc: { label: 'Imprecisão', sym: '?!' },
    mistake: { label: 'Erro', sym: '?' },
    blunder: { label: 'Gafe', sym: '??' },
  };
  const nameOf = (c) => Side(c) + ((mode === 'net' || mode === 'cpu') && c === me ? ' (você)' : '');

  function fmtEval(score, turn) {
    const w = turn === 'w' ? score : -score;
    if (Math.abs(score) >= MATE - 100) {
      const n = Math.ceil((MATE - Math.abs(score)) / 2);
      return (w > 0 ? '+' : '−') + (n ? 'M' + n : '#');
    }
    return (w >= 0 ? '+' : '−') + Math.abs(w / 100).toFixed(2);
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
      evals = [],
      shallow = [];
    for (let i = 0; i < pos.length; i++) {
      if (token !== anToken) return; // começou outra partida ou outra análise
      $('#anBar').style.width = Math.round((i / pos.length) * 100) + '%';
      $('#anText').textContent = `Analisando posição ${i + 1} de ${pos.length}…`;
      await frame();
      evals.push(analyze(pos[i], ANALYSIS_DEPTH));
      shallow.push(analyze(pos[i], ANALYSIS_DEPTH - 1));
    }
    if (token !== anToken) return;
    an = { evals, rates: rateMoves(pos, mv, evals, shallow), done: true };
    showAnalysis();
  }

  function showAnalysis() {
    $('#anProgress').hidden = true;
    $('#anResult').hidden = false;
    const rates = an.rates,
      acc = { w: [], b: [] },
      cnt = { w: {}, b: {} };
    rates.forEach((r) => {
      acc[r.mover].push(r.acc);
      cnt[r.mover][r.cls] = (cnt[r.mover][r.cls] || 0) + 1;
    });
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) + '%' : '–');
    let h = `<table class="an-sum"><tr><th></th><th>${nameOf('w')}</th><th>${nameOf('b')}</th></tr>`;
    h += `<tr class="acc"><td>Precisão</td><td>${avg(acc.w)}</td><td>${avg(acc.b)}</td></tr>`;
    for (const k of Object.keys(CLS))
      h += `<tr><td><span class="bd c-${k}">${CLS[k].sym}</span> ${CLS[k].label}</td><td>${cnt.w[k] || 0}</td><td>${cnt.b[k] || 0}</td></tr>`;
    $('#anSummary').innerHTML = h + '</table>';
    const cell = (k) =>
      `<td><button type="button" class="mv-btn" data-k="${k + 1}">${moves[k].txt}<span class="bd c-${rates[k].cls}" title="${CLS[rates[k].cls].label}">${CLS[rates[k].cls].sym}</span></button></td>`;
    let t = '';
    for (let k = 0; k < moves.length; k += 2)
      t += `<tr><td class="n">${k / 2 + 1}.</td>${cell(k)}${k + 1 < moves.length ? cell(k + 1) : '<td></td>'}</tr>`;
    $('#anMoves').innerHTML = t;
    $('#anDetail').textContent = 'Clique num lance (ou use as setas ← →) para ver a posição e o comentário.';
  }

  function gotoReview(i) {
    if (!an || !an.done) return;
    review = Math.max(0, Math.min(moves.length, i));
    marks = [];
    render();
    for (const b of document.querySelectorAll('#anMoves .mv-btn'))
      b.classList.toggle('on', +b.dataset.k === review);
    const k = review - 1;
    if (k < 0) return ($('#anDetail').textContent = 'Posição inicial.');
    const r = an.rates[k],
      e = an.evals[k],
      mm = moves[k];
    let t = `Lance ${Math.floor(k / 2) + 1}${mm.mover === 'b' ? '…' : '.'} ${mm.txt}: ${CLS[r.cls].label} (${CLS[r.cls].sym}).`;
    if (r.cls !== 'best' && e.move) t += ` O motor preferia ${moveText(positions[k], e.move)}.`;
    t += ` Avaliação (brancas): ${fmtEval(e.score, positions[k].turn)} → ${fmtEval(an.evals[k + 1].score, positions[k + 1].turn)}.`;
    $('#anDetail').textContent = t;
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
    if (!premoveOn) {
      premoves = [];
      sel = null;
      targets = [];
    }
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (premoves.length || sel !== null)) clearPremoves();
    if (an && an.done && !$('#analysis').hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      gotoReview((review === null ? moves.length : review) + (e.key === 'ArrowLeft' ? -1 : 1));
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
        clearTimeout(timer);
        w.terminate();
        reject(e);
      };
      const timer = setTimeout(() => fail(new Error('timeout')), 15000);
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
          clearTimeout(timer);
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
  function sfSearch(setup, posCmd, goCmd) {
    const p = sfChain.then(
      () =>
        new Promise((res) => {
          const f = (l) => {
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
    const setup = [];
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

  buildModes();
}
