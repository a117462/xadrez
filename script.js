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

if (typeof document === 'undefined') { module.exports = {newState, legalMoves, apply, perft, insufficient, canMate}; }
else {
/* ===== INTERFACE ===== */
const $ = s => document.querySelector(s);
const side = c => c === 'w' ? 'brancas' : 'pretas';
const Side = c => c === 'w' ? 'Brancas' : 'Pretas';

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

let st, mode, me = 'w', sel = null, targets = [], last = null, over = false;
let caps = {w: [], b: []}, history = [], peer = null, conn = null;
let tc = null, clock = {w: 0, b: 0}, lastTick = 0, timer = null;
let marks = [], drag = null;
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
  over = true; sel = null; targets = [];
  $('#promo').hidden = true;
  const out = outcome(winner);
  setStatus(`${title}. ${out}`);
  $('#overTitle').textContent = title;
  $('#overDetail').textContent = detail;
  $('#overOutcome').textContent = out;
  $('#overIcon').textContent = winner === null ? '½' : '♚';
  const k = winner === null ? 'draw' : (mode === 'net' ? (winner === me ? 'win' : 'lose') : 'win');
  $('#overBox').className = 'box result ' + k;
  $('#over').hidden = false;
  render();
  $('#btnOverNew').focus();
}

/* ===== TABULEIRO ===== */
function render() {
  const board = $('#board'), flip = me === 'b';
  board.innerHTML = '';
  const chk = inCheck(st, st.turn) ? kingSq(st.board, st.turn) : -1;
  for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
    const r = flip ? 7 - dr : dr, c = flip ? 7 - dc : dc, i = r * 8 + c, p = st.board[i];
    const d = document.createElement('div');
    d.className = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
    if (last && (i === last.from || i === last.to)) d.classList.add('last');
    if (i === sel) d.classList.add('sel');
    if (i === chk) d.classList.add('chk');
    const t = targets.find(m => m.to === i);
    if (t) d.classList.add('mv', ...(p || t.ep ? ['cap'] : []));
    if (p) d.innerHTML = `<span class="p ${p[0]}">${GL[p[1]]}\uFE0E</span>`;
    if (dc === 0) d.insertAdjacentHTML('beforeend', `<span class="co r">${8 - r}</span>`);
    if (dr === 7) d.insertAdjacentHTML('beforeend', `<span class="co f">${'abcdefgh'[c]}</span>`);
    d.onclick = () => click(i);
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

function click(i) {
  if (over || (mode === 'net' && st.turn !== me)) return;
  const p = st.board[i];
  const ms = targets.filter(m => m.to === i);
  if (sel !== null && ms.length) {
    if (ms[0].promo) return askPromo(ms);
    return play(ms[0]);
  }
  if (p && p[0] === st.turn) {
    sel = i; targets = legalMoves(st).filter(m => m.from === i);
  } else { sel = null; targets = []; }
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
  const mover = st.turn;
  if (tc) {
    tick();
    if (over) return; // o tempo acabou antes do lance
    if (remote) { if (typeof clk === 'number' && clk >= 0) clock[mover] = clk; }
    else clock[mover] += tc.inc * 1000;
    lastTick = performance.now();
  }
  const piece = st.board[m.from], n = apply(st, m);
  const txt = m.castle ? (m.castle === 'K' ? 'O-O' : 'O-O-O')
    : (piece[1] === 'P' ? '' : piece[1]) + sqName(m.from) + (n.captured ? 'x' : '-') + sqName(m.to) + (m.promo ? '=' + m.promo : '');
  if (n.captured) caps[mover].push(n.captured);
  history.push(txt);
  st = n; last = m; sel = null; targets = []; marks = [];
  updateStatus(); render();
  if (!remote && mode === 'net' && conn && conn.open)
    conn.send({t: 'move', from: m.from, to: m.to, promo: m.promo || null, clk: Math.round(clock[mover])});
}

function startGame(m, color, newTc) {
  mode = m; me = color || 'w'; tc = newTc || null;
  st = newState(); sel = null; targets = []; last = null; marks = []; drag = null;
  over = false; caps = {w: [], b: []}; history = [];
  const t0 = tc ? tc.min * 60000 : 0;
  clock = {w: t0, b: t0};
  lastTick = performance.now();
  clearInterval(timer);
  timer = setInterval(tick, 100);
  $('#over').hidden = true; $('#promo').hidden = true;
  $('#lobby').hidden = true; $('#game').hidden = false;
  $('#modeTag').textContent = modeTitle(tc);
  updateStatus(); render();
}

function endByResign(loser) {
  const detail = mode === 'local' ? `${Side(loser)} desistiram.`
    : loser === me ? 'Você desistiu da partida.' : 'Seu amigo desistiu da partida.';
  finish('Desistência', detail, opp(loser));
}

/* ===== SETAS E CÍRCULOS (só visuais; não afetam a partida) ===== */
const MARK_COLORS = {normal: '#ff9a1f', shift: '#e5484d', alt: '#3b82f6'};
const colorOf = e => e.shiftKey ? MARK_COLORS.shift : (e.altKey || e.ctrlKey) ? MARK_COLORS.alt : MARK_COLORS.normal;

function sqAt(e) {
  const b = $('#board'), r = b.getBoundingClientRect(), w = b.clientWidth / 8;
  const x = Math.floor((e.clientX - r.left - b.clientLeft) / w);
  const y = Math.floor((e.clientY - r.top - b.clientTop) / w);
  if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
  return me === 'b' ? (7 - y) * 8 + (7 - x) : y * 8 + x;
}

function toggleMark({from, to, color}) {
  const type = from === to ? 'circle' : 'arrow';
  const i = marks.findIndex(m => m.type === type && m.from === from && m.to === to);
  if (i >= 0) { const same = marks[i].color === color; marks.splice(i, 1); if (same) return; }
  marks.push({type, from, to, color});
}

function drawMarks() {
  const svg = $('#marks');
  if (!svg || !st) return;
  const pos = i => { let r = i >> 3, c = i & 7; if (me === 'b') { r = 7 - r; c = 7 - c; } return [c + .5, r + .5]; };
  const list = drag ? marks.concat([{type: drag.from === drag.to ? 'circle' : 'arrow', from: drag.from, to: drag.to, color: drag.color}]) : marks;
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

const boardEl = $('#board');
boardEl.addEventListener('contextmenu', e => e.preventDefault());
boardEl.addEventListener('pointerdown', e => {
  if (e.button === 0) { if (marks.length) { marks = []; drawMarks(); } return; }
  if (e.button === 2) {
    const s = sqAt(e);
    if (s < 0) return;
    drag = {from: s, to: s, color: colorOf(e)};
    drawMarks();
    e.preventDefault();
  }
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const s = sqAt(e);
  if (s !== -1 && s !== drag.to) { drag.to = s; drawMarks(); }
});
window.addEventListener('pointerup', e => {
  if (!drag || e.button !== 2) return;
  const d = drag; drag = null;
  const s = sqAt(e);
  if (s !== -1) { d.to = s; toggleMark(d); }
  drawMarks();
});
window.addEventListener('pointercancel', () => { if (drag) { drag = null; drawMarks(); } });

/* ===== REDE (PeerJS: conexão direta entre os dois PCs) ===== */
function onData(d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'init') startGame('net', 'b', d.tc && d.tc.min ? {min: +d.tc.min, inc: +d.tc.inc || 0} : null);
  else if (!st) return;
  else if (d.t === 'move') {
    const m = legalMoves(st).find(x => x.from === d.from && x.to === d.to && (x.promo || null) === d.promo);
    if (m && !over && st.turn !== me) play(m, true, d.clk);
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
for (const b of document.querySelectorAll('.menu-btn'))
  b.onclick = () => { if (!over && !confirm('Voltar ao menu? A partida atual será perdida.')) return; location.reload(); };

buildModes();
}
