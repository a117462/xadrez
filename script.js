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

// Avalia um lance jogado: perda de chance de vitória e classificação.
function analyzeMove(before, m, recapSq, depth) {
  depth = depth || 3;
  const R = rootSearch(before, depth, 200);
  const key = x => x.from + '-' + x.to + '-' + (x.promo || '');
  const mk = key(m);
  const entry = R.list.find(e => key(e.m) === mk);
  const playedScore = entry.exact ? entry.score
    : -negamax(apply(before, entry.m), depth - 1, -Infinity, Infinity, 1);
  const others = R.list.filter(e => e !== entry && key(e.m) !== key(R.best) && e.exact);
  const secondScore = key(R.best) === mk
    ? (others.length ? Math.max(...others.map(e => e.score)) : R.bestScore - 200)
    : R.bestScore;
  const wb = winPct(R.bestScore), wp = winPct(Math.min(playedScore, R.bestScore));
  const loss = Math.max(0, wb - wp);
  const forced = R.list.length === 1;

  let cls;
  if (forced) cls = 'forced';
  else if (loss > 20) cls = 'blunder';
  else if (loss > 10) cls = 'mistake';
  else if (loss > 5) cls = 'inaccuracy';
  else if (loss > 2) cls = 'good';
  else if (loss > 0.3) cls = 'excellent';
  else cls = 'best';

  if (!forced && loss <= 1.5) {
    const after = apply(before, m);
    const sac = matEval(before) + qsearch(after, -Infinity, Infinity, 0, matEval); // material dado de graça
    if (!m.promo && sac >= 200 && wp >= 45 && wb <= 90) cls = 'brilliant';
    else if (wb > 5 && wb < 95 && recapSq !== m.to && wb - winPct(secondScore) >= 15) cls = 'great';
  }
  return {cls, loss, best: {from: R.best.from, to: R.best.to, promo: R.best.promo || null},
    bestScore: R.bestScore, playedScore, forced};
}
//ENDENGINE

if (typeof document === 'undefined') { module.exports = {newState, legalMoves, apply, perft, insufficient, canMate, evaluate, rootSearch, analyzeMove, winPct, MATE}; }
else {
/* ===== INTERFACE ===== */
const $ = s => document.querySelector(s);
const side = c => c === 'w' ? 'brancas' : 'pretas';
const Side = c => c === 'w' ? 'Brancas' : 'Pretas';
const ANA_DEPTH = 3;

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
  brilliant:  {label: 'Brilhante',  sym: '!!', color: '#26c2a3', desc: 'Um sacrifício forte e difícil de encontrar.'},
  great:      {label: 'Ótimo',      sym: '!',  color: '#5b8bd9', desc: 'Praticamente o único lance que mantinha a posição.'},
  best:       {label: 'Melhor',     sym: '★',  color: '#8cc152', desc: 'O melhor lance da posição.'},
  excellent:  {label: 'Excelente',  sym: '✓',  color: '#6fb98f', desc: 'Quase tão bom quanto o melhor.'},
  good:       {label: 'Bom',        sym: '•',  color: '#a3b18a', desc: 'Um lance sólido, mas havia algo melhor.'},
  forced:     {label: 'Forçado',    sym: '→',  color: '#9a9a9a', desc: 'Era o único lance legal.'},
  inaccuracy: {label: 'Imprecisão', sym: '?!', color: '#f2c14e', desc: 'Perdeu um pouco de vantagem.'},
  mistake:    {label: 'Erro',       sym: '?',  color: '#f08c3c', desc: 'Entregou uma vantagem importante.'},
  blunder:    {label: 'Erro grave', sym: '??', color: '#e5484d', desc: 'Jogou a posição fora.'}
};
const CLS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'forced', 'inaccuracy', 'mistake', 'blunder'];

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
  const token = ++anaToken, res = [];
  await new Promise(r => setTimeout(r, 30));
  for (let k = 0; k < plies.length; k++) {
    if (token !== anaToken) return;
    const prev = k ? plies[k - 1] : null;
    res.push(analyzeMove(plies[k].before, plies[k].move, prev && prev.cap ? prev.move.to : -1, ANA_DEPTH));
    setProgress((k + 1) / plies.length);
    await new Promise(r => setTimeout(r, 0));
  }
  if (token !== anaToken) return;
  ana = summarize(res);
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
    if (['brilliant', 'great', 'mistake', 'blunder'].includes(r.cls))
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
  info.innerHTML = `<span class="sym big" style="--c:${cl.color}">${cl.sym}</span> <b>${p.txt}</b> — <b style="color:${cl.color}">${cl.label}</b><br>`
    + `${cl.desc}${!same && !r.forced ? ` Melhor era <b>${bestTxt}</b>.` : ''}<br>`
    + `<span class="muted">Avaliação: ${fmtEval(ana.evalsW[i])}</span>`;
  altBtn.hidden = same || r.forced;
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
  const target = REDUCE ? 0 : Math.max(-9, Math.min(9, dnd.vx / 90));   // no máximo ~9 graus
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
