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
  const ps = b.filter(Boolean).filter(p => p[1] !== 'K');
  return ps.length === 0 || (ps.length === 1 && 'BN'.includes(ps[0][1]));
}

function perft(st, d) {
  if (!d) return 1;
  return legalMoves(st).reduce((n, m) => n + perft(apply(st, m), d - 1), 0);
}
//END

if (typeof document === 'undefined') { module.exports = {newState, legalMoves, apply, perft}; }
else {
/* ===== INTERFACE ===== */
const $ = s => document.querySelector(s);
let st, mode, me = 'w', sel = null, targets = [], last = null, over = false;
let caps = {w: [], b: []}, history = [], peer = null, conn = null;

function render() {
  const board = $('#board'), flip = me === 'b';
  board.innerHTML = '';
  const chk = !over || true ? (inCheck(st, st.turn) ? kingSq(st.board, st.turn) : -1) : -1;
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
}

function setStatus(t) { $('#status').textContent = t; }

function updateStatus() {
  const moves = legalMoves(st), chk = inCheck(st, st.turn), who = st.turn === 'w' ? 'Brancas' : 'Pretas';
  if (!moves.length) {
    over = true;
    setStatus(chk ? `Xeque-mate! ${opp(st.turn) === 'w' ? 'Brancas' : 'Pretas'} vencem.` : 'Empate por afogamento.');
  } else if (insufficient(st.board)) { over = true; setStatus('Empate: material insuficiente.'); }
  else if (st.half >= 100) { over = true; setStatus('Empate: regra dos 50 lances.'); }
  else {
    const mine = mode === 'local' || st.turn === me;
    setStatus((chk ? 'Xeque! ' : '') + (mine ? 'Sua vez.' : `Vez do amigo (${who}).`));
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

function play(m, remote) {
  const piece = st.board[m.from], n = apply(st, m);
  const txt = m.castle ? (m.castle === 'K' ? 'O-O' : 'O-O-O')
    : (piece[1] === 'P' ? '' : piece[1]) + sqName(m.from) + (n.captured ? 'x' : '-') + sqName(m.to) + (m.promo ? '=' + m.promo : '');
  if (n.captured) caps[st.turn].push(n.captured);
  history.push(txt);
  st = n; last = m; sel = null; targets = [];
  updateStatus(); render();
  if (!remote && mode === 'net' && conn) conn.send({t: 'move', from: m.from, to: m.to, promo: m.promo || null});
}

function startGame(m, color) {
  mode = m; me = color || 'w'; st = newState(); sel = null; targets = []; last = null;
  over = false; caps = {w: [], b: []}; history = [];
  $('#lobby').hidden = true; $('#game').hidden = false;
  updateStatus(); render();
}

function endByResign(loser) {
  over = true; setStatus(`${loser === 'w' ? 'Brancas' : 'Pretas'} desistiram. ${loser === 'w' ? 'Pretas' : 'Brancas'} vencem.`); render();
}

/* ===== REDE (PeerJS: conexão direta entre os dois PCs) ===== */
function onData(d) {
  if (d.t === 'move') {
    const m = legalMoves(st).find(x => x.from === d.from && x.to === d.to && (x.promo || null) === d.promo);
    if (m && st.turn !== me) play(m, true);
  } else if (d.t === 'resign') endByResign(opp(me));
  else if (d.t === 'new') startGame('net', opp(me));
}

function setupConn(c, color) {
  conn = c;
  c.on('open', () => startGame('net', color));
  c.on('data', onData);
  c.on('close', () => { over = true; if (st) { setStatus('O amigo saiu da partida.'); render(); } });
}

function peerError(e) {
  $('#lobbyMsg').textContent = e.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.' : 'Erro de conexão: ' + e.type;
}

$('#btnCreate').onclick = () => {
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  $('#roomInfo').textContent = 'Criando sala...';
  peer = new Peer('xadrez-' + code);
  peer.on('open', () => { $('#roomInfo').innerHTML = `Código: <b>${code}</b><br>Envie ao amigo e aguarde ele entrar.`; });
  peer.on('connection', c => { if (conn) return c.close(); setupConn(c, 'w'); });
  peer.on('error', peerError);
};

$('#btnJoin').onclick = () => {
  const code = $('#codeInput').value.trim().toUpperCase();
  if (!code) return;
  $('#lobbyMsg').textContent = 'Conectando...';
  peer = new Peer();
  peer.on('open', () => setupConn(peer.connect('xadrez-' + code, {reliable: true}), 'b'));
  peer.on('error', peerError);
};

$('#btnLocal').onclick = () => startGame('local', 'w');
$('#btnResign').onclick = () => {
  if (over || !confirm('Desistir da partida?')) return;
  if (mode === 'net') { conn.send({t: 'resign'}); endByResign(me); }
  else endByResign(st.turn);
};
$('#btnNew').onclick = () => {
  if (!confirm('Começar nova partida?')) return;
  if (mode === 'net') { conn.send({t: 'new'}); startGame('net', opp(me)); }
  else startGame('local', 'w');
};
}
