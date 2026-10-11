// ═══════════════════════════════════════════════════════════════
// OVERLAY RENDERER
// Draws the world snapshots sent by the server onto a transparent
// canvas, plus the HUD panels. All game logic lives on the server.
// ═══════════════════════════════════════════════════════════════
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const DEBUG = params.get('debug') === '1';
  const FONT = '"Courier New", "Segoe UI Symbol", "Noto Sans Symbols 2", monospace';
  const TIPS = [
    'Chat to join the fight! Every message earns <b>XP</b>',
    '<b>--guild Name</b> create or join a guild · <b>--allywith @user</b> team up',
    '<b>--attack @user</b> duel · <b>--attack guild Name</b> start a guild war',
    '<b>--heal</b> heal you + friends · <b>--revive</b> get back up · <b>--cheer</b> buff friends',
    '<b>--loot</b> search for items · <b>--equip Sword</b> · <b>--use Potion</b> · <b>--drop Item</b>',
    '<b>--summon</b> call a spirit · <b>--summon @friend</b> bring an ally · <b>--dance</b>',
    '<b>--stats</b> show your level, gear and bag',
  ];

  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);

  const G = {
    w: 1920, h: 1080, nez: null,
    ents: new Map(), // id -> { d: snapshot data, x, y (drawn position), tx, ty, say }
    loot: [],
    fx: [],
    scale: 1, ox: 0, oy: 0, dpr: 1,
  };

  // Same hash the server uses, so guild colors match everywhere.
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
  const colorForName = name => `hsl(${hashString(name.toLowerCase()) % 360}, 85%, 65%)`;

  // ─── Layout ───────────────────────────────────────────────────

  function resize() {
    G.dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * G.dpr);
    canvas.height = Math.round(innerHeight * G.dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    G.scale = Math.min(innerWidth / G.w, innerHeight / G.h);
    G.ox = (innerWidth - G.w * G.scale) / 2;
    G.oy = (innerHeight - G.h * G.scale) / 2;
    document.documentElement.style.fontSize = `${Math.max(9, 16 * G.scale)}px`;
  }
  addEventListener('resize', resize);
  resize();

  if (params.get('hud') === '0') document.querySelectorAll('.hud').forEach(el => el.classList.add('hidden'));
  if (params.get('help') === '0') $('help').classList.add('hidden');
  if (params.get('status') === '0') $('status').classList.add('hidden');

  // ─── Network handlers (called from socket.js) ─────────────────

  function onHello(h) {
    G.w = h.w;
    G.h = h.h;
    G.nez = h.nez;
    resize();
    $('feed-lines').textContent = '';
    for (const item of h.feed || []) onFeed(item, true);
  }

  function onState(s) {
    const now = performance.now();
    const seen = new Set();
    for (const d of s.ents) {
      let e = G.ents.get(d.id);
      if (!e) {
        e = { x: d.x, y: d.y };
        G.ents.set(d.id, e);
      }
      // Big jumps (summons, teleports) snap instead of sliding across the screen.
      if (Math.hypot(d.x - e.x, d.y - e.y) > 250) {
        e.x = d.x;
        e.y = d.y;
      }
      e.d = d;
      e.tx = d.x;
      e.ty = d.y;
      seen.add(d.id);
    }
    // Effects first: a killing blow refers to an entity this snapshot removes.
    for (const f of s.fx) addFx(f, now);
    for (const id of G.ents.keys()) if (!seen.has(id)) G.ents.delete(id);
    G.loot = s.loot;
  }

  function addFx(f, now) {
    // Snapshots keep arriving while drawing is paused (hidden source/tab).
    if (G.fx.length > 400) G.fx.splice(0, G.fx.length - 400);
    const ent = id => G.ents.get(id);
    switch (f.t) {
      case 'hit': {
        const a = ent(f.a);
        const b = ent(f.b);
        if (!b) return;
        if (f.p && a && a !== b) {
          G.fx.push({ type: 'proj', fx: a.x, fy: a.y, target: b, lx: b.x, ly: b.y, glyph: f.p, c: f.c, start: now, dur: 260, v: f.v, crit: f.crit });
        } else {
          G.fx.push({ type: 'slash', x: b.x, y: b.y, c: f.c, start: now, dur: 220 });
          if (f.v) damageNumber(b.x, b.y, f.v, f.crit, now);
        }
        break;
      }
      case 'dmg': {
        const b = ent(f.id);
        if (b) damageNumber(b.x, b.y, f.v, false, now);
        break;
      }
      case 'heal': {
        const b = ent(f.id);
        if (b) G.fx.push({ type: 'num', x: b.x, y: b.y - 20, text: `+${f.v}`, c: '#3dffa8', size: 16, start: now, dur: 1200 });
        break;
      }
      case 'float': {
        const b = ent(f.id);
        if (!b) return;
        const lines = String(f.text).split('\n');
        G.fx.push({ type: 'float', target: b, lines, c: f.c || '#fff', start: now, dur: lines.length > 1 ? 7000 : 2600 });
        break;
      }
      case 'say': {
        const b = ent(f.id);
        if (b) b.say = { lines: wrap(f.text, 28).slice(0, 3), until: now + 5000 };
        break;
      }
      case 'lvl': {
        const b = ent(f.id);
        if (!b) return;
        G.fx.push({ type: 'ring', target: b, c: '#ffd84a', start: now, dur: 900, r: 70 });
        G.fx.push({ type: 'float', target: b, lines: ['LEVEL UP!'], c: '#ffd84a', start: now, dur: 2200, big: true });
        break;
      }
      case 'ring':
      case 'revive':
      case 'spawn': {
        const b = ent(f.id);
        if (b) G.fx.push({ type: 'ring', target: b, c: f.c || (f.t === 'revive' ? '#ffffff' : '#00ff66'), start: now, dur: 700, r: f.t === 'spawn' ? 35 : 60 });
        break;
      }
      case 'die':
        G.fx.push({ type: 'burst', x: f.x, y: f.y, c: f.c, start: now, dur: 700, sz: f.sz || 1 });
        break;
      default:
        break;
    }
  }

  function damageNumber(x, y, v, crit, now) {
    G.fx.push({
      type: 'num', x: x + (Math.random() - 0.5) * 16, y: y - 18, text: crit ? `${v}!` : `${v}`,
      c: crit ? '#ffcc00' : '#ff5050', size: crit ? 22 : 15, start: now, dur: 1100,
    });
  }

  function wrap(text, width) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const word = w.length > width ? `${w.slice(0, width - 1)}…` : w;
      if ((line + ' ' + word).trim().length > width) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ─── HUD ──────────────────────────────────────────────────────

  function row(name, value, extraClass) {
    const el = document.createElement('div');
    el.className = `row${extraClass ? ` ${extraClass}` : ''}`;
    const n = document.createElement('span');
    n.className = 'name';
    n.textContent = name;
    const v = document.createElement('span');
    v.className = 'val';
    v.textContent = value;
    el.append(n, v);
    return el;
  }

  function onHud(h) {
    $('online').textContent = h.online;
    $('mobs').textContent = h.mobs;
    $('total').textContent = h.totalPlayers;

    const top = $('top');
    top.textContent = '';
    h.top.forEach((p, i) => {
      top.append(row(`${i + 1}. ${p.name}${p.guild ? ` [${p.guild}]` : ''}`, `Lv${p.level}`, p.online ? '' : 'off'));
    });
    if (!h.top.length) top.append(row('Type in chat to join!', ''));

    const list = $('guild-list');
    list.textContent = '';
    for (const g of h.guilds) {
      const r = row(g.name, `${g.online}/${g.members} · ☠${g.kills}`, g.online ? '' : 'off');
      r.querySelector('.name').style.color = colorForName(g.name);
      list.append(r);
      if (g.wars.length) {
        const war = document.createElement('div');
        war.className = 'war';
        war.textContent = `⚔ at war with ${g.wars.join(', ')}`;
        list.append(war);
      }
    }
    if (!h.guilds.length) list.append(row('--guild Name', 'to found one'));
    $('guilds').style.top = `${$('leaderboard').getBoundingClientRect().bottom + 12}px`;

    const quest = $('quest');
    quest.textContent = '';
    if (h.quest) {
      const label = document.createElement('div');
      label.textContent = `📜 Slay ${h.quest.need} ${h.quest.name}s (${h.quest.progress}/${h.quest.need}) · +${h.quest.reward} XP`;
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('div');
      fill.className = 'fill';
      fill.style.width = `${Math.min(100, (h.quest.progress / h.quest.need) * 100)}%`;
      bar.append(fill);
      quest.append(label, bar);
    }

    const boss = $('boss');
    if (h.boss) {
      boss.style.display = 'block';
      $('boss-name').textContent = `⚠ ${h.boss.name.toUpperCase()} ${h.boss.hp}/${h.boss.mh} ⚠`;
      $('boss-fill').style.width = `${Math.max(0, (h.boss.hp / h.boss.mh) * 100)}%`;
    } else {
      boss.style.display = 'none';
    }
  }

  function onFeed(item, history = false) {
    const lines = $('feed-lines');
    const el = document.createElement('div');
    el.className = `line ${item.kind}`;
    el.textContent = item.text;
    lines.append(el);
    while (lines.children.length > 6) lines.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), history ? 8000 : 25000);
    setTimeout(() => el.remove(), history ? 9000 : 26000);
    if (!history && item.kind === 'boss') {
      const alert = $('alert');
      alert.textContent = item.text;
      alert.style.display = 'block';
      clearTimeout(onFeed.alertTimer);
      onFeed.alertTimer = setTimeout(() => { alert.style.display = 'none'; }, 3500);
    }
  }

  function onStatus(s) {
    const el = $('status');
    el.textContent = '';
    for (const [source, value] of Object.entries(s)) {
      if (value === 'off') continue;
      const span = document.createElement('span');
      const good = value === 'connected' || value === 'on';
      span.className = good ? 'ok' : /error|disconnected|needs/.test(value) ? 'bad' : '';
      span.textContent = `${source}: ${value}  `;
      el.append(span);
    }
    if (!el.textContent) el.textContent = 'no chat source configured (see README)';
  }

  function onConnection(connected) {
    if (!connected) $('status').textContent = 'server offline, reconnecting…';
  }

  let tip = 0;
  function nextTip() {
    const help = $('help');
    help.style.opacity = '0';
    setTimeout(() => {
      // TIPS are fixed strings defined above, never chat text.
      help.innerHTML = TIPS[tip % TIPS.length];
      help.style.opacity = '1';
      tip++;
    }, 400);
  }
  nextTip();
  setInterval(nextTip, 9000);

  // ─── Drawing ──────────────────────────────────────────────────

  function text(str, x, y, size, color, bold = false, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.lineWidth = Math.max(2.5, size / 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.globalAlpha = 1;
  }

  function hpBar(x, y, w, hp, mh, color) {
    const pct = Math.max(0, Math.min(1, hp / mh));
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color || (pct > 0.5 ? '#3dff6a' : pct > 0.25 ? '#ffd84a' : '#ff4a4a');
    ctx.fillRect(x - w / 2, y, w * pct, 4);
  }

  function drawEntity(e, now) {
    const d = e.d;
    const sz = d.sz || 1;
    const size = 24 * sz;
    let x = e.x;
    let y = e.y;
    if (d.em === 'dance') {
      y -= Math.abs(Math.sin(now / 110)) * 10;
      x += Math.sin(now / 220) * 5;
    } else if (!d.d) {
      y += Math.sin(now / 320 + d.id) * 1.5;
    }

    if (d.pet && !d.d) text(d.pet[0], x - (d.f || 1) * 24, e.y + 8 + Math.sin(now / 180 + d.id) * 2, 15, d.pet[1], true);

    if (d.b || d.bf) {
      ctx.shadowColor = d.b ? '#ff2a2a' : '#ffd84a';
      ctx.shadowBlur = d.b ? 25 : 12;
    }
    text(d.d ? '☠' : d.gl, x, y, size, d.d ? '#777' : d.c, true, d.d ? 0.7 : 1);
    ctx.shadowBlur = 0;

    let top = y - size / 2 - 4;
    if (d.k === 'p' || d.b) {
      hpBar(x, top - 6, d.b ? 90 : 34, d.hp, d.mh);
      top -= 14;
      const label = d.d ? `${d.n} (down)` : d.lv ? `${d.n} · Lv${d.lv}` : d.n;
      text(label, x, top, d.b ? 16 : 12, d.d ? '#999' : '#fff', true);
      top -= 14;
      if (d.g) {
        text(`[${d.g}]`, x, top, 11, colorForName(d.g), true);
        top -= 13;
      }
    } else {
      if (d.hp < d.mh) {
        hpBar(x, top - 6, 26 * sz, d.hp, d.mh, d.k === 'n' ? '#4aa8ff' : '#ff6a3a');
        top -= 10;
      }
      if (d.k === 'n') {
        text(d.n, x, top - 4, 10, '#bbb');
        top -= 14;
      }
    }

    if (d.em === 'dance') text('♪', x + 16 + Math.sin(now / 150) * 4, top + 4 - ((now / 8) % 16), 14, '#ff8af0', true);
    if (d.em === 'cheer') text('✨', x, top - 2 - Math.abs(Math.sin(now / 120)) * 6, 16, '#ffd84a');

    if (e.say && e.say.until > now) {
      drawBubble(x, top - 6, e.say.lines, d.c, Math.min(1, (e.say.until - now) / 400));
    }
  }

  function drawBubble(x, bottom, lines, border, alpha) {
    ctx.globalAlpha = alpha;
    ctx.font = `12px ${FONT}`;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14;
    const h = lines.length * 14 + 8;
    const left = Math.min(Math.max(x - w / 2, 4), G.w - w - 4);
    const topY = bottom - h;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(left, topY, w, h, 5);
    else ctx.rect(left, topY, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#eee';
    lines.forEach((l, i) => ctx.fillText(l, left + w / 2, topY + 11 + i * 14));
    ctx.globalAlpha = 1;
  }

  function drawFx(f, now) {
    const t = (now - f.start) / f.dur;
    if (t >= 1) {
      if (f.type === 'proj' && f.v) damageNumber(f.lx, f.ly, f.v, f.crit, now);
      return false;
    }
    switch (f.type) {
      case 'proj': {
        if (G.ents.has(f.target.d.id)) {
          f.lx = f.target.x;
          f.ly = f.target.y;
        }
        const px = f.fx + (f.lx - f.fx) * t;
        const py = f.fy + (f.ly - f.fy) * t;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2(f.ly - f.fy, f.lx - f.fx));
        ctx.shadowColor = f.c;
        ctx.shadowBlur = 8;
        text(f.glyph, 0, 0, 16, f.c, true);
        ctx.restore();
        break;
      }
      case 'slash':
        text('✕', f.x, f.y, 26 * (1 - t * 0.4), f.c, true, 1 - t);
        break;
      case 'num':
        text(f.text, f.x, f.y - t * 32, f.size, f.c, true, 1 - t * t);
        break;
      case 'float': {
        const x = f.target.x;
        const say = f.target.say && f.target.say.until > now ? f.target.say.lines.length * 14 + 12 : 0;
        const y = f.target.y - 70 - say - t * 20;
        const alpha = t > 0.8 ? (1 - t) * 5 : 1;
        f.lines.forEach((line, i) => text(line, x, y - (f.lines.length - 1 - i) * 15, f.big ? 18 : 12, f.c, true, alpha));
        break;
      }
      case 'ring': {
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = f.c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.target.x, f.target.y, 10 + f.r * t, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'burst':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = 8 + 45 * f.sz * t;
          text('*', f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 14 * f.sz, f.c, true, 1 - t);
        }
        break;
      default:
        return false;
    }
    return true;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.setTransform(G.dpr * G.scale, 0, 0, G.dpr * G.scale, G.dpr * G.ox, G.dpr * G.oy);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (DEBUG && G.nez) {
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = 'rgba(255,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(G.nez.x, G.nez.y, G.nez.w, G.nez.h);
      ctx.setLineDash([]);
      text('NO ENTRY ZONE', G.nez.x + G.nez.w / 2, G.nez.y + 16, 14, 'rgba(255,80,80,0.8)', true);
    }

    const k = 1 - Math.exp(-dt * 10);
    for (const e of G.ents.values()) {
      e.x += (e.tx - e.x) * k;
      e.y += (e.ty - e.y) * k;
    }

    for (const l of G.loot) {
      const bob = Math.sin(now / 250 + l.id) * 3;
      ctx.shadowColor = l.c;
      ctx.shadowBlur = 10;
      text(l.gl, l.x, l.y + bob, 18, l.c, true);
      ctx.shadowBlur = 0;
    }

    const sorted = [...G.ents.values()].sort((a, b) => (a.d.d ? -1 : 0) - (b.d.d ? -1 : 0) || a.y - b.y);
    for (const e of sorted) drawEntity(e, now);

    // drawFx can add effects (a projectile landing spawns its damage number).
    const current = G.fx;
    G.fx = [];
    G.fx = current.filter(f => drawFx(f, now)).concat(G.fx);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Game = { onHello, onState, onHud, onFeed, onStatus, onConnection };
})();
