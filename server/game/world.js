'use strict';
// ═══════════════════════════════════════════════════════════════
// RPG ENGINE
// The server owns the whole world. Every tick it moves characters,
// resolves combat, spawns mobs and loot, and the overlay just draws
// the snapshots it receives.
//
// Events emitted:
//   'feed'  { text, kind }  — announcements for the overlay's event feed
// ═══════════════════════════════════════════════════════════════
const EventEmitter = require('events');
const D = require('./data');
const { parseCommand } = require('../commands');

const keyOf = name => String(name).trim().toLowerCase();
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const EQUIP_SLOTS = ['weapon', 'armor', 'pet'];
const LOOT_GLYPH = { weapon: '†', armor: '⛨', consumable: '♥', buff: '⚗', pet: '✿', ally: '✉' };
const ALLY_REQUEST_TTL = 300;
const MAX_SUMMONS_PER_OWNER = 3;
const TOP_MARGIN = 80; // room above characters for name, guild tag and hp bar

// Does the segment (x1,y1)-(x2,y2) pass through rectangle r? (Liang–Barsky)
function segmentHitsRect(x1, y1, x2, y2, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 < t1;
}

class World extends EventEmitter {
  constructor({ store, config, rng = Math.random }) {
    super();
    this.store = store;
    this.cfg = config;
    this.rng = rng;
    this.time = 0;
    this.nextId = 1;
    this.entities = new Map(); // id -> entity (players, mobs, npcs)
    this.players = new Map(); // player key -> entity, only those on screen
    this.loot = new Map(); // id -> item lying on the ground
    this.wars = new Map(); // guild key -> Map(enemy guild key -> ends at)
    this.allyRequests = new Map(); // from key -> Map(to key -> sent at)
    this.guildMembers = new Map(); // guild key -> Set(player key)
    this.fx = []; // visual effects queued for the next snapshot
    this.feedLog = [];
    this.mobTimer = 0;
    this.bossTimer = config.BOSS_INTERVAL;
    this.quest = null;
    this.questTimer = config.QUEST_DELAY;
    // The NEZ as configured (drawn by ?debug=1), and the slightly larger area
    // characters keep out of so their name labels (drawn above them) and
    // sides don't spill into it either.
    this.nezArea = config.NEZ_ENABLED
      ? { x: config.NEZ_X, y: config.NEZ_Y, w: config.NEZ_W, h: config.NEZ_H }
      : null;
    const a = this.nezArea;
    this.nez = a ? { x: a.x - 45, y: a.y - 15, w: a.w + 90, h: a.h + 15 + 60 } : null;
    this.loadRecords();
  }

  // ─── Records (persistent player data) ─────────────────────────

  get records() {
    return this.store.data.players;
  }

  get guilds() {
    return this.store.data.guilds;
  }

  loadRecords() {
    for (const [key, rec] of Object.entries(this.records)) {
      this.records[key] = this.normalizeRecord(key, rec);
    }
    for (const [gk, g] of Object.entries(this.guilds)) {
      if (!g || typeof g !== 'object' || typeof g.name !== 'string') delete this.guilds[gk];
      else g.kills = Number.isFinite(g.kills) ? g.kills : 0;
    }
    for (const [key, rec] of Object.entries(this.records)) {
      if (!rec.guild) continue;
      const gk = keyOf(rec.guild);
      if (!this.guilds[gk]) {
        this.guilds[gk] = { name: rec.guild, leader: rec.username, createdAt: Date.now(), kills: 0 };
      }
      rec.guild = this.guilds[gk].name;
      this.membersOf(gk).add(key);
    }
    for (const gk of Object.keys(this.guilds)) {
      if (!this.membersOf(gk).size) {
        delete this.guilds[gk];
        this.guildMembers.delete(gk);
      }
    }
  }

  // Fill in missing fields so hand-edited or older save files still load.
  normalizeRecord(key, raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const name = typeof r.username === 'string' ? r.username.trim() : '';
    r.username = name && keyOf(name) === key ? name : key;
    r.platform = typeof r.platform === 'string' ? r.platform : 'chat';
    r.uid = typeof r.uid === 'string' ? r.uid : null;
    if (!Object.hasOwn(D.CLASSES, r.class)) r.class = D.classForUser(r.username);
    r.xp = Number.isFinite(r.xp) && r.xp > 0 ? Math.floor(r.xp) : 0;
    r.level = D.levelForXp(r.xp, this.cfg.MAX_LEVEL);
    r.guild = typeof r.guild === 'string' && r.guild.trim() ? r.guild.trim() : null;
    r.hp = Number.isFinite(r.hp) ? r.hp : null;
    r.items = Array.isArray(r.items) ? r.items.map(i => D.findItemName(i)).filter(Boolean) : [];
    const eq = r.equipped && typeof r.equipped === 'object' ? r.equipped : {};
    r.equipped = {};
    for (const slot of EQUIP_SLOTS) {
      const name = D.findItemName(eq[slot]);
      r.equipped[slot] = name && D.ITEMS[name].type === slot && r.items.includes(name) ? name : null;
    }
    r.allies = Array.isArray(r.allies) ? r.allies.filter(a => typeof a === 'string') : [];
    const p = r.position;
    r.position = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
    for (const f of ['kills', 'pvpKills', 'deaths', 'messages']) r[f] = Number.isFinite(r[f]) ? r[f] : 0;
    r.createdAt = Number.isFinite(r.createdAt) ? r.createdAt : Date.now();
    r.lastSeen = Number.isFinite(r.lastSeen) ? r.lastSeen : Date.now();
    return r;
  }

  newRecord(username, platform, uid) {
    return {
      username,
      platform,
      uid,
      class: D.classForUser(username),
      xp: 0,
      level: 1,
      guild: null,
      hp: null,
      items: ['Potion'],
      equipped: { weapon: null, armor: null, pet: null },
      allies: [],
      position: null,
      kills: 0,
      pvpKills: 0,
      deaths: 0,
      messages: 0,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
  }

  // Find a stored player by name. YouTube names can contain spaces, so
  // "@John Smith hi" tries "John Smith hi", then "John Smith", then "John".
  findRecord(name) {
    if (!name) return null;
    const words = String(name).replace(/^@+/, '').split(' ');
    for (let n = words.length; n > 0; n--) {
      const rec = this.records[keyOf(words.slice(0, n).join(' '))];
      if (rec) return rec;
    }
    return null;
  }

  findOnScreenPlayer(name) {
    const rec = this.findRecord(name);
    return rec ? this.players.get(keyOf(rec.username)) || null : null;
  }

  // Copy live state (hp, position) back into the saved record.
  syncRecord(e) {
    e.rec.hp = e.dead ? 0 : Math.round(e.hp);
    e.rec.position = { x: Math.round(e.x), y: Math.round(e.y) };
    this.store.markDirty();
  }

  syncAll() {
    for (const e of this.players.values()) this.syncRecord(e);
  }

  // ─── XP & items ───────────────────────────────────────────────

  giveXp(rec, amount) {
    if (!rec || !(amount > 0)) return;
    rec.xp += Math.round(amount);
    const level = D.levelForXp(rec.xp, this.cfg.MAX_LEVEL);
    if (level > rec.level) {
      rec.level = level;
      const e = this.players.get(keyOf(rec.username));
      if (e && !e.dead) {
        e.hp = this.stats(e).maxHp;
        this.pushFx({ t: 'lvl', id: e.id });
      }
      this.feed(`⬆ ${rec.username} reached level ${level}!`, 'level');
    }
    this.store.markDirty();
  }

  rollItem(minRarity = 'common') {
    const order = Object.keys(D.RARITY);
    const allowed = order.slice(order.indexOf(minRarity));
    const total = allowed.reduce((sum, r) => sum + D.RARITY[r].weight, 0);
    let roll = this.rng() * total;
    let rarity = allowed[allowed.length - 1];
    for (const r of allowed) {
      roll -= D.RARITY[r].weight;
      if (roll < 0) {
        rarity = r;
        break;
      }
    }
    const pool = Object.keys(D.ITEMS).filter(name => D.ITEMS[name].rarity === rarity);
    return pool[Math.floor(this.rng() * pool.length)];
  }

  giveItem(e, item) {
    if (e.rec.items.length >= this.cfg.INVENTORY_SIZE) return false;
    e.rec.items.push(item);
    const def = D.ITEMS[item];
    this.pushFx({ t: 'float', id: e.id, text: `+ ${item}`, c: D.RARITY[def.rarity].color });
    if (def.rarity === 'rare' || def.rarity === 'legendary') {
      this.feed(`💎 ${e.name} found a ${def.rarity} ${item}!`, 'loot');
    }
    this.store.markDirty();
    return true;
  }

  findInventoryItem(rec, query) {
    const q = keyOf(query);
    return rec.items.find(i => i.toLowerCase() === q)
      || rec.items.find(i => i.toLowerCase().startsWith(q))
      || rec.items.find(i => i.toLowerCase().includes(q))
      || null;
  }

  removeItem(rec, item) {
    const idx = rec.items.indexOf(item);
    if (idx < 0) return false;
    rec.items.splice(idx, 1);
    for (const slot of EQUIP_SLOTS) {
      if (rec.equipped[slot] === item && !rec.items.includes(item)) rec.equipped[slot] = null;
    }
    this.store.markDirty();
    return true;
  }

  dropLoot(x, y, item, droppedBy = null) {
    if (this.loot.size >= this.cfg.MAX_GROUND_LOOT) {
      this.loot.delete(this.loot.keys().next().value);
    }
    const pos = { x: x + (this.rng() - 0.5) * 50, y: y + (this.rng() - 0.5) * 50 };
    this.constrain(pos);
    const l = { id: this.nextId++, item, x: pos.x, y: pos.y, until: this.time + this.cfg.LOOT_LIFETIME, droppedBy, droppedAt: this.time };
    this.loot.set(l.id, l);
    return l;
  }

  canPickUp(e, l) {
    return !(l.droppedBy === e.key && this.time - l.droppedAt < 15);
  }

  // ─── Guilds & alliances ───────────────────────────────────────

  membersOf(gk) {
    let set = this.guildMembers.get(gk);
    if (!set) {
      set = new Set();
      this.guildMembers.set(gk, set);
    }
    return set;
  }

  guildKeyOf(e) {
    return e && e.kind === 'player' && e.rec.guild ? keyOf(e.rec.guild) : null;
  }

  joinGuild(rec, name) {
    const gk = keyOf(name);
    let g = this.guilds[gk];
    if (g && this.membersOf(gk).size >= this.cfg.GUILD_MAX_MEMBERS) return null;
    this.leaveGuild(rec, true);
    if (!g) {
      g = { name, leader: rec.username, createdAt: Date.now(), kills: 0 };
      this.guilds[gk] = g;
      this.feed(`🏰 ${rec.username} founded the guild ${name}!`, 'guild');
    } else {
      this.feed(`🏰 ${rec.username} joined ${g.name}`, 'guild');
    }
    rec.guild = g.name;
    this.membersOf(gk).add(keyOf(rec.username));
    this.store.markDirty();
    return g;
  }

  leaveGuild(rec, quiet = false) {
    if (!rec.guild) return false;
    const gk = keyOf(rec.guild);
    const g = this.guilds[gk];
    const members = this.membersOf(gk);
    members.delete(keyOf(rec.username));
    rec.guild = null;
    if (!quiet && g) this.feed(`🏰 ${rec.username} left ${g.name}`, 'guild');
    if (!members.size) {
      delete this.guilds[gk];
      this.guildMembers.delete(gk);
      this.wars.delete(gk);
      for (const enemies of this.wars.values()) enemies.delete(gk);
      if (g) this.feed(`🏰 The guild ${g.name} has disbanded`, 'guild');
    } else if (g && keyOf(g.leader) === keyOf(rec.username)) {
      const next = this.records[members.values().next().value];
      g.leader = next ? next.username : g.leader;
      this.feed(`👑 ${g.leader} now leads ${g.name}`, 'guild');
    }
    this.store.markDirty();
    return true;
  }

  sameGuild(a, b) {
    return !!(a.guild && b.guild && keyOf(a.guild) === keyOf(b.guild));
  }

  areAllies(a, b) {
    const ak = keyOf(a.username);
    const bk = keyOf(b.username);
    return a.allies.some(n => keyOf(n) === bk) || b.allies.some(n => keyOf(n) === ak);
  }

  declareWar(ga, gb) {
    const until = this.time + this.cfg.GUILD_WAR_DURATION;
    if (!this.wars.has(ga)) this.wars.set(ga, new Map());
    if (!this.wars.has(gb)) this.wars.set(gb, new Map());
    this.wars.get(ga).set(gb, until);
    this.wars.get(gb).set(ga, until);
  }

  atWar(ga, gb) {
    const until = this.wars.get(ga)?.get(gb);
    return until !== undefined && until > this.time;
  }

  enemyGuildsOf(gk) {
    const enemies = this.wars.get(gk);
    if (!enemies) return [];
    return [...enemies].filter(([, until]) => until > this.time).map(([k]) => k);
  }

  // ─── Entities ─────────────────────────────────────────────────

  addEntity(props) {
    const e = {
      id: this.nextId++,
      buffs: [],
      cooldowns: {},
      atkCd: 0,
      lastHurt: -Infinity,
      lastAttackerId: null,
      target: null,
      targetUntil: 0,
      emote: null,
      wander: null,
      facing: 1,
      dead: false,
      size: 1,
      ...props,
    };
    this.entities.set(e.id, e);
    return e;
  }

  removeEntity(e) {
    this.entities.delete(e.id);
    if (e.kind === 'player') this.players.delete(e.key);
  }

  spawnPlayer(rec, near = null) {
    const key = keyOf(rec.username);
    const existing = this.players.get(key);
    if (existing) return existing;
    if (this.players.size >= this.cfg.MAX_PLAYERS_ON_SCREEN) {
      let oldest = null;
      for (const p of this.players.values()) if (!oldest || p.lastActive < oldest.lastActive) oldest = p;
      if (oldest) this.despawnPlayer(oldest);
    }
    const pos = near ? this.pointNear(near, 50) : this.validPoint(rec.position) || this.randomPoint();
    const e = this.addEntity({ kind: 'player', key, rec, name: rec.username, x: pos.x, y: pos.y, lastActive: this.time });
    const max = this.stats(e).maxHp;
    e.hp = Math.max(max * 0.5, rec.hp > 0 ? Math.min(rec.hp, max) : max);
    this.players.set(key, e);
    this.pushFx({ t: 'spawn', id: e.id });
    return e;
  }

  despawnPlayer(e) {
    this.syncRecord(e);
    this.removeEntity(e);
  }

  spawnSummon(owner, type) {
    const d = D.SUMMONS[type];
    const owned = [...this.entities.values()].filter(o => o.kind === 'npc' && o.ownerId === owner.id);
    if (owned.length >= MAX_SUMMONS_PER_OWNER) this.removeEntity(owned[0]);
    const scale = 1 + 0.1 * (owner.rec.level - 1);
    const pos = this.pointNear(owner, 40);
    return this.addEntity({
      kind: 'npc', type, ownerId: owner.id, name: `${owner.name}'s ${d.name}`,
      glyph: d.glyph, color: d.color, x: pos.x, y: pos.y,
      maxHp: Math.round(d.hp * scale), hp: Math.round(d.hp * scale), atk: d.atk * scale, def: d.def,
      spd: d.spd, range: d.range, cd: d.cd, projectile: d.projectile || null,
      expires: this.time + d.duration,
    });
  }

  spawnMob(type) {
    const d = D.MOBS[type];
    const onScreen = [...this.players.values()];
    const avgLevel = onScreen.length ? onScreen.reduce((s, p) => s + p.rec.level, 0) / onScreen.length : 1;
    const hpMult = 1 + 0.15 * (avgLevel - 1);
    const atkMult = 1 + 0.08 * (avgLevel - 1);
    let hp = d.hp * hpMult;
    if (d.boss) hp *= 1 + 0.25 * Math.max(0, onScreen.length - 1);
    const pos = this.edgePoint();
    const e = this.addEntity({
      kind: 'mob', type, name: d.name, glyph: d.glyph, color: d.color, x: pos.x, y: pos.y,
      maxHp: Math.round(hp), hp: Math.round(hp), atk: d.atk * atkMult, def: d.def, spd: d.spd,
      range: d.range, cd: d.cd, projectile: d.projectile || null,
      xp: Math.round(d.xp * hpMult), boss: !!d.boss, size: d.size || 1, aoe: d.aoe || 0,
      contrib: new Map(),
      spawnedAt: this.time,
    });
    if (d.boss) this.feed(`⚠ A ${d.name.toUpperCase()} HAS APPEARED! ⚠`, 'boss');
    return e;
  }

  pickMobType() {
    const types = Object.keys(D.MOBS).filter(t => D.MOBS[t].weight > 0);
    const weight = t => D.MOBS[t].weight * (this.quest && this.quest.mob === t ? 2 : 1);
    let roll = this.rng() * types.reduce((s, t) => s + weight(t), 0);
    for (const t of types) {
      roll -= weight(t);
      if (roll < 0) return t;
    }
    return types[0];
  }

  boss() {
    for (const e of this.entities.values()) if (e.boss) return e;
    return null;
  }

  // Combined stats: class + level + gear + buffs (players) or fixed (mobs/npcs).
  stats(e) {
    let s;
    if (e.kind === 'player') {
      const c = D.CLASSES[e.rec.class];
      const L = e.rec.level - 1;
      s = {
        maxHp: c.hp + 12 * L, atk: c.atk + 1.5 * L, def: c.def + 0.6 * L, spd: c.spd,
        range: c.range, cd: c.cd, projectile: c.projectile || null,
        healPower: c.healPower ? c.healPower + 1.2 * L : 0,
      };
      for (const slot of EQUIP_SLOTS) {
        const item = D.ITEMS[e.rec.equipped[slot]];
        if (!item) continue;
        s.atk += item.atk || 0;
        s.def += item.def || 0;
        s.spd += item.spd || 0;
        s.maxHp += item.hp || 0;
        if (item.range) {
          s.range = item.range;
          s.projectile = item.projectile || null;
        }
      }
    } else {
      s = { maxHp: e.maxHp, atk: e.atk, def: e.def, spd: e.spd, range: e.range, cd: e.cd, projectile: e.projectile, healPower: 0 };
    }
    for (const b of e.buffs) if (b.until > this.time) s[b.stat] *= b.mult;
    s.spd = Math.max(20, s.spd);
    return s;
  }

  addBuff(e, stat, mult, duration) {
    e.buffs = e.buffs.filter(b => b.stat !== stat || b.mult > mult);
    if (!e.buffs.some(b => b.stat === stat)) e.buffs.push({ stat, mult, until: this.time + duration });
  }

  // The player who gets credit for what an entity does (npcs credit their owner).
  creditOf(e) {
    if (!e) return null;
    if (e.kind === 'player') return e;
    if (e.kind === 'npc') return this.entities.get(e.ownerId) || null;
    return null;
  }

  isFriendly(a, b) {
    if (a === b) return true;
    if (a.kind === 'mob' || b.kind === 'mob') return a.kind === b.kind;
    const pa = this.creditOf(a);
    const pb = this.creditOf(b);
    if (!pa || !pb) return false;
    if (pa === pb) return true;
    return this.sameGuild(pa.rec, pb.rec) || this.areAllies(pa.rec, pb.rec);
  }

  nearest(from, pred, range = Infinity) {
    let best = null;
    let bestD = range;
    for (const o of this.entities.values()) {
      if (!pred(o)) continue;
      const d = dist(from, o);
      if (d <= bestD) {
        best = o;
        bestD = d;
      }
    }
    return best;
  }

  findMobByName(name, from) {
    const q = keyOf(name);
    return this.nearest(from, o => o.kind === 'mob' && !o.dead && (keyOf(o.name) === q || (q === 'boss' && o.boss)));
  }

  // ─── Geometry & NEZ ───────────────────────────────────────────

  insideNez(x, y, margin = 0) {
    const r = this.nez;
    return !!r && x > r.x - margin && x < r.x + r.w + margin && y > r.y - margin && y < r.y + r.h + margin;
  }

  // Keep a point inside the world and outside the NEZ.
  constrain(p) {
    const { WORLD_W, WORLD_H } = this.cfg;
    p.x = Math.min(WORLD_W - 20, Math.max(20, p.x));
    p.y = Math.min(WORLD_H - 20, Math.max(TOP_MARGIN, p.y));
    if (this.insideNez(p.x, p.y)) {
      const r = this.nez;
      const options = [
        { d: p.x - r.x, x: r.x - 1, y: p.y },
        { d: r.x + r.w - p.x, x: r.x + r.w + 1, y: p.y },
        { d: p.y - r.y, x: p.x, y: r.y - 1 },
        { d: r.y + r.h - p.y, x: p.x, y: r.y + r.h + 1 },
      ].sort((a, b) => a.d - b.d);
      p.x = options[0].x;
      p.y = options[0].y;
    }
    return p;
  }

  validPoint(p) {
    if (!p) return null;
    const { WORLD_W, WORLD_H } = this.cfg;
    if (p.x < 20 || p.x > WORLD_W - 20 || p.y < TOP_MARGIN || p.y > WORLD_H - 20) return null;
    if (this.insideNez(p.x, p.y, 10)) return null;
    return { x: p.x, y: p.y };
  }

  randomPoint() {
    const { WORLD_W, WORLD_H } = this.cfg;
    for (let i = 0; i < 50; i++) {
      const p = { x: 40 + this.rng() * (WORLD_W - 80), y: TOP_MARGIN + 20 + this.rng() * (WORLD_H - TOP_MARGIN - 60) };
      if (!this.insideNez(p.x, p.y, 30)) return p;
    }
    return { x: 60, y: TOP_MARGIN + 20 };
  }

  pointNear(c, radius) {
    const a = this.rng() * Math.PI * 2;
    return this.constrain({ x: c.x + Math.cos(a) * radius, y: c.y + Math.sin(a) * radius });
  }

  edgePoint() {
    const { WORLD_W, WORLD_H } = this.cfg;
    const side = Math.floor(this.rng() * 4);
    const t = this.rng();
    if (side === 0) return { x: 30 + t * (WORLD_W - 60), y: TOP_MARGIN + 10 };
    if (side === 1) return { x: 30 + t * (WORLD_W - 60), y: WORLD_H - 30 };
    if (side === 2) return { x: 30, y: TOP_MARGIN + 10 + t * (WORLD_H - TOP_MARGIN - 40) };
    return { x: WORLD_W - 30, y: TOP_MARGIN + 10 + t * (WORLD_H - TOP_MARGIN - 40) };
  }

  // If the straight path crosses the NEZ, return the best corner to walk around it.
  waypoint(from, tx, ty) {
    const r = this.nez;
    if (!r || !segmentHitsRect(from.x, from.y, tx, ty, r)) return null;
    const m = 25;
    const corners = [
      { x: r.x - m, y: r.y - m }, { x: r.x + r.w + m, y: r.y - m },
      { x: r.x - m, y: r.y + r.h + m }, { x: r.x + r.w + m, y: r.y + r.h + m },
    ];
    const goal = { x: tx, y: ty };
    const clear = (a, b) => !segmentHitsRect(a.x, a.y, b.x, b.y, r);
    // Shortest walk from each corner to the goal, going corner to corner.
    const toGoal = corners.map(c => (clear(c, goal) ? dist(c, goal) : Infinity));
    for (let pass = 0; pass < 3; pass++) {
      corners.forEach((a, i) => corners.forEach((b, j) => {
        if (i !== j && clear(a, b)) toGoal[i] = Math.min(toGoal[i], dist(a, b) + toGoal[j]);
      }));
    }
    let best = null;
    let bestCost = Infinity;
    corners.forEach((c, i) => {
      if (dist(from, c) < 5 || !clear(from, c)) return;
      const cost = dist(from, c) + toGoal[i];
      if (cost < bestCost) {
        best = c;
        bestCost = cost;
      }
    });
    return best;
  }

  moveTo(e, tx, ty, speed, dt, stop = 0) {
    const d = Math.hypot(tx - e.x, ty - e.y);
    if (d <= stop + 0.5) return true; // small slack so float rounding can't leave us 0.0001px short
    const wp = this.waypoint(e, tx, ty);
    const gx = wp ? wp.x : tx;
    const gy = wp ? wp.y : ty;
    const dx = gx - e.x;
    const dy = gy - e.y;
    const dd = Math.hypot(dx, dy) || 1;
    const step = Math.min(speed * dt, wp ? dd : d - stop);
    e.x += (dx / dd) * step;
    e.y += (dy / dd) * step;
    if (Math.abs(dx) > 1) e.facing = dx < 0 ? -1 : 1;
    this.constrain(e);
    return false;
  }

  // ─── Combat ───────────────────────────────────────────────────

  attack(a, t, s) {
    a.atkCd = s.cd;
    const ts = this.stats(t);
    let dmg = s.atk * (0.85 + this.rng() * 0.3);
    const crit = this.rng() < this.cfg.CRIT_CHANCE;
    if (crit) dmg *= this.cfg.CRIT_MULT;
    dmg = Math.max(1, Math.round(dmg - ts.def * 0.5));
    this.pushFx({ t: 'hit', a: a.id, b: t.id, p: s.projectile, c: this.colorOf(a), v: dmg, crit: crit ? 1 : 0 });
    const victims = a.aoe
      ? [...this.entities.values()].filter(o => o !== t && !o.dead && !this.isFriendly(a, o) && dist(o, t) <= a.aoe)
      : [];
    this.damage(t, dmg, a);
    for (const o of victims) {
      const splash = Math.max(1, Math.round(dmg * 0.5));
      this.pushFx({ t: 'dmg', id: o.id, v: splash });
      this.damage(o, splash, a);
    }
  }

  damage(t, amount, a) {
    if (t.dead || !this.entities.has(t.id)) return;
    t.hp -= amount;
    t.lastHurt = this.time;
    t.lastAttackerId = a.id;
    if (t.kind === 'mob') {
      const credit = this.creditOf(a);
      if (credit) t.contrib.set(credit.key, (t.contrib.get(credit.key) || 0) + amount);
    }
    if (t.hp <= 0) this.kill(t, a);
  }

  heal(t, amount) {
    if (t.dead) return 0;
    const max = this.stats(t).maxHp;
    const before = t.hp;
    t.hp = Math.min(max, t.hp + amount);
    const v = Math.round(t.hp - before);
    if (v > 0) this.pushFx({ t: 'heal', id: t.id, v });
    return v;
  }

  revive(e, pct) {
    e.dead = false;
    e.hp = this.stats(e).maxHp * pct;
    e.target = null;
    e.lastHurt = -Infinity;
    this.pushFx({ t: 'revive', id: e.id });
  }

  kill(t, a) {
    const killer = this.creditOf(a);
    this.pushFx({ t: 'die', x: Math.round(t.x), y: Math.round(t.y), c: this.colorOf(t), sz: t.size });
    if (t.kind === 'mob') {
      this.removeEntity(t);
      for (const [key] of t.contrib) {
        const rec = this.records[key];
        this.giveXp(rec, killer && key === killer.key ? t.xp : Math.round(t.xp / 2));
      }
      if (killer) killer.rec.kills++;
      if (this.quest && this.quest.mob === t.type) {
        this.quest.progress++;
        for (const key of t.contrib.keys()) this.quest.participants.add(key);
        if (this.quest.progress >= this.quest.need) this.completeQuest();
      }
      const d = D.MOBS[t.type];
      const drops = d.drops || 1;
      for (let i = 0; i < drops; i++) {
        if (this.rng() < d.loot) this.dropLoot(t.x, t.y, this.rollItem(d.boss ? 'rare' : 'common'));
      }
      if (t.boss) this.feed(`🏆 The ${t.name} was slain!${killer ? ` Final blow: ${killer.name}` : ''}`, 'boss');
    } else if (t.kind === 'player') {
      t.dead = true;
      t.deadAt = this.time;
      t.hp = 0;
      t.target = null;
      t.emote = null;
      t.rec.deaths++;
      if (killer && killer !== t) {
        killer.rec.kills++;
        killer.rec.pvpKills++;
        this.giveXp(killer.rec, this.cfg.XP_PER_PVP_KILL + 10 * t.rec.level);
        const gk = this.guildKeyOf(killer);
        if (gk && this.guilds[gk]) this.guilds[gk].kills++;
        this.feed(`☠ ${killer.name} defeated ${t.name}`, 'pvp');
      } else {
        this.feed(`☠ ${t.name} was slain by ${a.kind === 'mob' ? `a ${a.name}` : a.name}`, 'death');
      }
      this.store.markDirty();
    } else {
      this.removeEntity(t);
    }
  }

  // ─── Quests ───────────────────────────────────────────────────

  newQuest() {
    const types = Object.keys(D.MOBS).filter(t => D.MOBS[t].weight > 0);
    const mob = types[Math.floor(this.rng() * types.length)];
    const need = Math.max(5, Math.min(30, 5 + this.players.size * 2));
    const reward = D.MOBS[mob].xp * 3 + 50;
    this.quest = { mob, name: D.MOBS[mob].name, need, progress: 0, reward, participants: new Set() };
    this.feed(`📜 New quest: defeat ${need} ${D.MOBS[mob].name}s together!`, 'quest');
  }

  completeQuest() {
    const q = this.quest;
    for (const key of q.participants) this.giveXp(this.records[key], q.reward);
    this.feed(`📜 Quest complete! ${q.participants.size} heroes earn ${q.reward} XP`, 'quest');
    this.quest = null;
    this.questTimer = this.cfg.QUEST_DELAY;
  }

  // ─── Chat & commands ──────────────────────────────────────────

  // `id` is the chatter's account id on Twitch/YouTube (absent for the test console).
  handleChat({ user, message, platform = 'chat', id = null }) {
    let username = String(user || '').replace(/^@+/, '').trim().slice(0, 40);
    if (!username || typeof message !== 'string') return null;
    const uid = id ? `${platform}:${id}` : null;
    let key = keyOf(username);
    let rec = this.records[key];
    if (rec && uid && rec.uid && rec.uid !== uid) {
      // Same name, different account (another platform, or a duplicate
      // display name): they get their own character instead of taking over.
      username = `${username}#${D.hashString(uid).toString(36).slice(0, 4)}`;
      key = keyOf(username);
      rec = this.records[key];
    }
    if (rec && uid && !rec.uid) rec.uid = uid;
    if (!rec) {
      rec = this.newRecord(username, platform, uid);
      this.records[key] = rec;
      this.feed(`✨ ${username} joined the game as a ${D.CLASSES[rec.class].name}`, 'join');
    }
    rec.username = username;
    rec.platform = platform;
    rec.messages++;
    rec.lastSeen = Date.now();
    this.store.markDirty();

    const e = this.spawnPlayer(rec);
    e.name = username;
    e.lastActive = this.time;
    if (e.xpMsgAt === undefined || this.time - e.xpMsgAt >= this.cfg.XP_MESSAGE_COOLDOWN) {
      e.xpMsgAt = this.time;
      this.giveXp(rec, this.cfg.XP_PER_MESSAGE);
    }

    const cmd = parseCommand(message);
    if (cmd) return this.execute(e, cmd);
    const text = message.trim().slice(0, 80);
    if (text) this.pushFx({ t: 'say', id: e.id, text });
    return null;
  }

  execute(e, cmd) {
    const handler = {
      guild: this.cmdGuild, leaveguild: this.cmdLeaveGuild, allywith: this.cmdAllyWith,
      attack: this.cmdAttack, attackGuild: this.cmdAttackGuild, heal: this.cmdHeal,
      revive: this.cmdRevive, loot: this.cmdLoot, equip: this.cmdEquip, use: this.cmdUse,
      drop: this.cmdDrop, summon: this.cmdSummon, dance: this.cmdDance, cheer: this.cmdCheer,
      stats: this.cmdStats,
    }[cmd.type];
    const result = handler ? handler.call(this, e, cmd) : { ok: false, text: cmd.reason || 'Unknown command' };
    if (result.text) this.pushFx({ t: 'float', id: e.id, text: result.text, c: result.ok ? '#ffffff' : '#9a9a9a' });
    return result;
  }

  cooldownLeft(e, name) {
    return Math.max(0, Math.ceil((e.cooldowns[name] || 0) - this.time));
  }

  startCooldown(e, name, seconds) {
    e.cooldowns[name] = this.time + seconds;
  }

  cmdGuild(e, { name }) {
    const rec = e.rec;
    if (!name) {
      if (!rec.guild) return fail('Not in a guild. Try --guild Name');
      return ok(`[${rec.guild}] ${this.membersOf(keyOf(rec.guild)).size} members`);
    }
    if (rec.guild && keyOf(rec.guild) === keyOf(name)) return fail(`Already in ${rec.guild}`);
    const g = this.joinGuild(rec, name);
    if (!g) return fail(`${name} is full`);
    return ok(`[${g.name}]`);
  }

  cmdLeaveGuild(e) {
    if (!e.rec.guild) return fail('Not in a guild');
    this.leaveGuild(e.rec);
    return ok('Left your guild');
  }

  cmdAllyWith(e, { target }) {
    const tr = this.findRecord(target);
    if (!tr) return fail(`No player named ${target}`);
    if (tr === e.rec) return fail("You can't ally yourself");
    if (this.areAllies(e.rec, tr)) return fail(`Already allied with ${tr.username}`);
    if (e.rec.allies.length >= this.cfg.MAX_ALLIES) return fail('Your ally list is full');
    const ek = keyOf(e.rec.username);
    const tk = keyOf(tr.username);
    const theirRequest = this.allyRequests.get(tk)?.get(ek);
    if (theirRequest !== undefined && this.time - theirRequest <= ALLY_REQUEST_TTL) {
      if (tr.allies.length >= this.cfg.MAX_ALLIES) return fail(`${tr.username}'s ally list is full`);
      this.allyRequests.get(tk).delete(ek);
      e.rec.allies.push(tr.username);
      tr.allies.push(e.rec.username);
      this.store.markDirty();
      this.feed(`🤝 ${e.rec.username} and ${tr.username} are now allies!`, 'ally');
      return ok(`Allied with ${tr.username}`);
    }
    if (!this.allyRequests.has(ek)) this.allyRequests.set(ek, new Map());
    this.allyRequests.get(ek).set(tk, this.time);
    this.feed(`🤝 ${e.rec.username} wants to ally with ${tr.username}. ${tr.username}: type --allywith @${e.rec.username}`, 'ally');
    return ok(`Ally request sent to ${tr.username}`);
  }

  setTarget(e, target, seconds = this.cfg.TARGET_DURATION) {
    e.target = target;
    e.targetUntil = this.time + seconds;
  }

  cmdAttack(e, { target }) {
    if (e.dead) return fail('You are down! Type --revive');
    if (!target) {
      const mob = this.nearest(e, o => o.kind === 'mob' && !o.dead);
      if (!mob) return fail('No monsters around');
      this.setTarget(e, { id: mob.id });
      return ok(`→ ${mob.name}`);
    }
    const t = this.findOnScreenPlayer(target);
    if (!t) {
      const mob = this.findMobByName(target, e);
      if (mob) {
        this.setTarget(e, { id: mob.id });
        return ok(`→ ${mob.name}`);
      }
      const rec = this.findRecord(target);
      return fail(rec ? `${rec.username} isn't in the arena` : `No player named ${target}`);
    }
    if (t === e) return fail("You can't attack yourself");
    if (t.dead) return fail(`${t.name} is already down`);
    if (this.isFriendly(e, t)) {
      return fail(this.sameGuild(e.rec, t.rec) ? `${t.name} is your guildmate` : `${t.name} is your ally`);
    }
    this.setTarget(e, { id: t.id });
    this.feed(`⚔ ${e.name} challenges ${t.name}!`, 'pvp');
    return ok(`Attacking ${t.name}`);
  }

  cmdAttackGuild(e, { guild }) {
    if (e.dead) return fail('You are down! Type --revive');
    const gk = keyOf(guild);
    const g = this.guilds[gk];
    if (!g) return fail(`No guild named ${guild}`);
    const mine = this.guildKeyOf(e);
    if (mine === gk) return fail("That's your own guild");
    this.setTarget(e, { guild: gk }, this.cfg.GUILD_WAR_DURATION);
    if (mine) {
      const fresh = !this.atWar(mine, gk);
      this.declareWar(mine, gk);
      if (fresh) this.feed(`⚔ GUILD WAR! ${this.guilds[mine].name} vs ${g.name}`, 'war');
      return ok(`War on ${g.name}!`);
    }
    this.feed(`⚔ ${e.name} declares war on ${g.name}!`, 'war');
    return ok(`Hunting ${g.name}`);
  }

  cmdHeal(e) {
    if (e.dead) return fail('You are down! Type --revive');
    const wait = this.cooldownLeft(e, 'heal');
    if (wait) return fail(`Heal ready in ${wait}s`);
    this.startCooldown(e, 'heal', this.cfg.COOLDOWN_HEAL);
    const isHealer = e.rec.class === 'healer';
    this.heal(e, this.stats(e).maxHp * (isHealer ? 0.5 : 0.3));
    for (const o of this.entities.values()) {
      if (o === e || o.dead || o.kind === 'mob' || !this.isFriendly(e, o) || dist(e, o) > 220) continue;
      this.heal(o, this.stats(o).maxHp * (isHealer ? 0.35 : 0.2));
    }
    this.pushFx({ t: 'ring', id: e.id, c: '#3dffa8' });
    return ok(null);
  }

  cmdRevive(e, { target }) {
    const t = target ? this.findOnScreenPlayer(target) : e;
    if (!t) return fail(`${target} isn't in the arena`);
    if (t === e) {
      if (!e.dead) return fail("You're still standing");
      const wait = Math.ceil(this.cfg.REVIVE_SELF_DELAY - (this.time - e.deadAt));
      if (wait > 0) return fail(`You can revive in ${wait}s`);
      this.revive(e, 0.5);
      return ok('Back in the fight!');
    }
    if (e.dead) return fail('You are down yourself');
    if (!t.dead) return fail(`${t.name} isn't down`);
    const wait = this.cooldownLeft(e, 'revive');
    if (wait) return fail(`Revive ready in ${wait}s`);
    this.startCooldown(e, 'revive', this.cfg.COOLDOWN_REVIVE_OTHER);
    this.revive(t, 0.5);
    this.giveXp(e.rec, this.cfg.XP_FOR_REVIVE);
    this.feed(`✚ ${e.name} revived ${t.name}`, 'revive');
    return ok(`Revived ${t.name}`);
  }

  cmdLoot(e) {
    if (e.dead) return fail('You are down! Type --revive');
    const wait = this.cooldownLeft(e, 'loot');
    if (wait) return fail(`Nothing left to search. Try in ${wait}s`);
    if (e.rec.items.length >= this.cfg.INVENTORY_SIZE) return fail('Bag full! --drop something');
    this.startCooldown(e, 'loot', this.cfg.COOLDOWN_LOOT);
    this.giveItem(e, this.rollItem());
    return ok(null);
  }

  cmdEquip(e, { item }) {
    const name = this.findInventoryItem(e.rec, item);
    if (!name) return fail(`You don't have ${item}`);
    const def = D.ITEMS[name];
    if (!EQUIP_SLOTS.includes(def.type)) return fail(`Try --use ${name}`);
    e.rec.equipped[def.type] = name;
    e.hp = Math.min(e.hp, this.stats(e).maxHp);
    this.store.markDirty();
    return ok(`Equipped ${name}`);
  }

  cmdUse(e, { item }) {
    const name = this.findInventoryItem(e.rec, item);
    if (!name) return fail(`You don't have ${item}`);
    const def = D.ITEMS[name];
    if (EQUIP_SLOTS.includes(def.type)) return this.cmdEquip(e, { item: name });
    if (def.revive) {
      if (!e.dead) return fail('Save it for when you fall');
      this.removeItem(e.rec, name);
      this.revive(e, 1);
      this.feed(`🔥 ${e.name} rose from the ashes!`, 'revive');
      return ok(null);
    }
    if (e.dead) return fail('You are down! Type --revive');
    if (def.heal || def.healPct) {
      const max = this.stats(e).maxHp;
      if (e.hp >= max) return fail('Already at full health');
      this.removeItem(e.rec, name);
      this.heal(e, def.heal || max * def.healPct);
      return ok(null);
    }
    if (def.buff) {
      this.removeItem(e.rec, name);
      this.addBuff(e, def.buff.stat, def.buff.mult, def.buff.duration);
      return ok(`${def.buff.stat.toUpperCase()} up!`);
    }
    if (def.summon) {
      this.removeItem(e.rec, name);
      const npc = this.spawnSummon(e, def.summon);
      this.feed(`📜 ${e.name} hired a ${D.SUMMONS[npc.type].name}!`, 'summon');
      return ok(null);
    }
    return fail(`${name} can't be used`);
  }

  cmdDrop(e, { item }) {
    const name = this.findInventoryItem(e.rec, item);
    if (!name) return fail(`You don't have ${item}`);
    this.removeItem(e.rec, name);
    this.dropLoot(e.x, e.y, name, e.key);
    return ok(`Dropped ${name}`);
  }

  cmdSummon(e, { target }) {
    if (e.dead) return fail('You are down! Type --revive');
    if (!target) {
      const wait = this.cooldownLeft(e, 'spirit');
      if (wait) return fail(`Summon ready in ${wait}s`);
      this.startCooldown(e, 'spirit', this.cfg.COOLDOWN_SUMMON_SPIRIT);
      this.spawnSummon(e, 'spirit');
      return ok('A spirit answers your call');
    }
    const tr = this.findRecord(target);
    if (!tr) return fail(`No player named ${target}`);
    if (tr === e.rec) return fail("You're already here");
    if (!this.sameGuild(e.rec, tr) && !this.areAllies(e.rec, tr)) {
      return fail(`${tr.username} must be your ally or guildmate`);
    }
    const wait = this.cooldownLeft(e, 'summon');
    if (wait) return fail(`Summon ready in ${wait}s`);
    this.startCooldown(e, 'summon', this.cfg.COOLDOWN_SUMMON_ALLY);
    let t = this.players.get(keyOf(tr.username));
    if (t) {
      Object.assign(t, this.pointNear(e, 50));
    } else {
      t = this.spawnPlayer(tr, e);
      // A summoned friend who isn't chatting stays for SUMMON_STAY seconds.
      t.lastActive = this.time - (this.cfg.INACTIVE_TIMEOUT - this.cfg.SUMMON_STAY);
    }
    this.pushFx({ t: 'ring', id: t.id, c: '#b98cff' });
    this.feed(`🌀 ${e.name} summoned ${t.name}!`, 'summon');
    return ok(null);
  }

  cmdDance(e) {
    if (e.dead) return fail('Hard to dance while down');
    if (this.cooldownLeft(e, 'dance')) return ok(null);
    this.startCooldown(e, 'dance', this.cfg.COOLDOWN_DANCE);
    e.emote = { type: 'dance', until: this.time + 4 };
    return ok(null);
  }

  cmdCheer(e) {
    if (e.dead) return fail('Hard to cheer while down');
    const wait = this.cooldownLeft(e, 'cheer');
    if (wait) return fail(`Voice needs ${wait}s rest`);
    this.startCooldown(e, 'cheer', this.cfg.COOLDOWN_CHEER);
    e.emote = { type: 'cheer', until: this.time + 3 };
    let count = 0;
    for (const o of this.entities.values()) {
      if (o === e || o.dead || o.kind === 'mob' || !this.isFriendly(e, o) || dist(e, o) > 250) continue;
      this.addBuff(o, 'atk', 1.15, 20);
      this.pushFx({ t: 'float', id: o.id, text: 'Inspired!', c: '#ffd84a' });
      count++;
    }
    return ok(count ? `Cheered on ${count} friend${count > 1 ? 's' : ''}!` : null);
  }

  cmdStats(e) {
    const r = e.rec;
    const s = this.stats(e);
    const next = r.level >= this.cfg.MAX_LEVEL ? 'MAX' : D.xpForLevel(r.level + 1);
    const gear = EQUIP_SLOTS.map(slot => r.equipped[slot]).filter(Boolean).join(', ') || 'none';
    const bag = r.items.length ? r.items.join(', ') : 'empty';
    return ok(
      `Lv${r.level} ${D.CLASSES[r.class].name} · ${r.xp}/${next} XP · ATK ${Math.round(s.atk)} DEF ${Math.round(s.def)}\n` +
      `Gear: ${gear}\nBag (${r.items.length}/${this.cfg.INVENTORY_SIZE}): ${bag}`,
    );
  }

  // ─── AI ───────────────────────────────────────────────────────

  recentAttacker(e) {
    if (this.time - e.lastHurt > 6 || !e.lastAttackerId) return null;
    const a = this.entities.get(e.lastAttackerId);
    if (!a || a.dead || this.isFriendly(e, a) || dist(e, a) > 700) return null;
    return a;
  }

  resolveTarget(e) {
    if (!e.target) return null;
    if (this.time > e.targetUntil) {
      e.target = null;
      return null;
    }
    if (e.target.id) {
      const t = this.entities.get(e.target.id);
      if (!t || t.dead || this.isFriendly(e, t)) {
        e.target = null;
        return null;
      }
      return t;
    }
    if (!this.guilds[e.target.guild]) {
      e.target = null;
      return null;
    }
    return this.nearest(e, o => o.kind === 'player' && !o.dead && this.guildKeyOf(o) === e.target.guild && !this.isFriendly(e, o));
  }

  nearestLoot(e, range) {
    let best = null;
    let bestD = range;
    for (const l of this.loot.values()) {
      if (!this.canPickUp(e, l)) continue;
      const d = dist(e, l);
      if (d <= bestD) {
        best = l;
        bestD = d;
      }
    }
    return best;
  }

  planPlayer(e, s) {
    const foe = this.resolveTarget(e);
    if (s.healPower > 0) {
      const hurt = this.nearest(e, o => !o.dead && o.kind !== 'mob' && this.isFriendly(e, o) && o.hp < this.stats(o).maxHp * 0.7, 450);
      if (hurt && (!foe || hurt.hp < this.stats(hurt).maxHp * 0.4)) return { heal: hurt };
    }
    if (foe) return { foe };
    const attacker = this.recentAttacker(e);
    if (attacker) return { foe: attacker };
    const gk = this.guildKeyOf(e);
    if (gk) {
      const enemies = this.enemyGuildsOf(gk);
      if (enemies.length) {
        const enemy = this.nearest(e, o => o.kind === 'player' && !o.dead && enemies.includes(this.guildKeyOf(o)) && !this.isFriendly(e, o), this.cfg.WAR_AGGRO_RANGE);
        if (enemy) return { foe: enemy };
      }
    }
    const mob = this.nearest(e, o => o.kind === 'mob' && !o.dead, this.cfg.AGGRO_RANGE);
    if (mob) return { foe: mob };
    if (e.rec.items.length < this.cfg.INVENTORY_SIZE) {
      const l = this.nearestLoot(e, this.cfg.LOOT_SEEK_RANGE);
      if (l) return { goto: l };
    }
    return { wander: true };
  }

  planMob(e) {
    const attacker = this.recentAttacker(e);
    if (attacker) return { foe: attacker };
    const foe = this.nearest(e, o => o.kind !== 'mob' && !o.dead, e.boss ? 700 : 300);
    return foe ? { foe } : { wander: true };
  }

  planNpc(e) {
    const owner = this.entities.get(e.ownerId);
    let foe = owner.dead ? null : this.resolveTarget(owner);
    if (foe && this.isFriendly(e, foe)) foe = null;
    foe = foe || this.recentAttacker(e) || this.recentAttacker(owner)
      || this.nearest(owner, o => o.kind === 'mob' && !o.dead, this.cfg.AGGRO_RANGE);
    if (foe) return { foe };
    if (dist(e, owner) > 90) return { goto: owner, stop: 60 };
    return { wander: true, around: owner };
  }

  wander(e, s, dt, around) {
    const w = e.wander;
    if (!w || this.time >= w.until) {
      if (this.rng() < 0.3) {
        e.wander = { idle: true, until: this.time + 2 + this.rng() * 2 };
      } else {
        const c = around || e;
        const radius = around ? 80 : 250;
        const a = this.rng() * Math.PI * 2;
        const p = this.constrain({ x: c.x + Math.cos(a) * radius * this.rng(), y: c.y + Math.sin(a) * radius * this.rng() });
        e.wander = { x: p.x, y: p.y, until: this.time + 8 };
      }
      return;
    }
    if (w.idle) return;
    if (this.moveTo(e, w.x, w.y, s.spd * 0.5, dt, 4)) e.wander = { idle: true, until: this.time + 1 + this.rng() * 2 };
  }

  updateEntity(e, dt) {
    if (e.buffs.length) e.buffs = e.buffs.filter(b => b.until > this.time);
    if (e.emote && e.emote.until <= this.time) e.emote = null;
    if (e.kind === 'npc' && (this.time >= e.expires || !this.entities.has(e.ownerId))) {
      this.pushFx({ t: 'die', x: Math.round(e.x), y: Math.round(e.y), c: e.color, sz: 1 });
      this.removeEntity(e);
      return;
    }
    if (e.dead) {
      if (e.kind === 'player' && this.time - e.deadAt >= this.cfg.AUTO_REVIVE) this.revive(e, 0.5);
      return;
    }
    if (e.boss && this.time - e.spawnedAt >= this.cfg.BOSS_LIFETIME) {
      this.removeEntity(e);
      this.feed(`💨 The ${e.name} flew away... better luck next time!`, 'boss');
      return;
    }
    const s = this.stats(e);
    if (e.hp > s.maxHp) e.hp = s.maxHp;
    if (e.kind !== 'mob' && e.hp < s.maxHp && this.time - e.lastHurt >= this.cfg.REGEN_DELAY) {
      e.hp = Math.min(s.maxHp, e.hp + s.maxHp * this.cfg.REGEN_PCT_PER_SEC * dt);
    }
    e.atkCd = Math.max(0, e.atkCd - dt);
    if (e.emote && e.emote.type === 'dance') return;

    const plan = e.kind === 'player' ? this.planPlayer(e, s) : e.kind === 'mob' ? this.planMob(e, s) : this.planNpc(e, s);
    if (plan.foe || plan.heal) {
      const t = plan.foe || plan.heal;
      const reach = s.range + (t.size - 1) * 15;
      if (this.moveTo(e, t.x, t.y, s.spd, dt, reach * 0.9) && e.atkCd === 0) {
        if (plan.foe) {
          this.attack(e, t, s);
        } else {
          e.atkCd = s.cd;
          this.pushFx({ t: 'hit', a: e.id, b: t.id, p: '✚', c: '#3dffa8' });
          this.heal(t, s.healPower);
        }
      }
    } else if (plan.goto) {
      this.moveTo(e, plan.goto.x, plan.goto.y, s.spd, dt, plan.stop || 0);
    } else {
      this.wander(e, s, dt, plan.around);
    }
  }

  // Push overlapping characters apart so they don't stack on one spot.
  separate() {
    const list = [...this.entities.values()].filter(e => !e.dead);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const min = 18 * Math.max(a.size, b.size);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        const nx = d > 0.01 ? dx / d : this.rng() - 0.5;
        const ny = d > 0.01 ? dy / d : this.rng() - 0.5;
        const push = (min - d) * 0.25;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        this.constrain(a);
        this.constrain(b);
      }
    }
  }

  tick(dt) {
    this.time += dt;
    const cfg = this.cfg;

    this.mobTimer -= dt;
    if (this.mobTimer <= 0) {
      this.mobTimer = cfg.MOB_SPAWN_INTERVAL;
      const max = Math.min(cfg.MAX_MOBS, cfg.MOBS_BASE + this.players.size * cfg.MOBS_PER_PLAYER);
      let mobs = 0;
      for (const e of this.entities.values()) if (e.kind === 'mob' && !e.boss) mobs++;
      // Spawn more at once in a busy arena so monsters keep up with the crowd.
      const batch = Math.min(max - mobs, 2 + Math.ceil(this.players.size / 5));
      for (let i = 0; i < batch; i++) this.spawnMob(this.pickMobType());
    }
    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      this.bossTimer = cfg.BOSS_INTERVAL;
      if (this.players.size >= cfg.BOSS_MIN_PLAYERS && !this.boss()) this.spawnMob('dragon');
    }
    if (!this.quest) {
      this.questTimer -= dt;
      if (this.questTimer <= 0) this.newQuest();
    }

    for (const e of [...this.entities.values()]) {
      if (this.entities.has(e.id)) this.updateEntity(e, dt);
    }
    this.separate();

    for (const l of [...this.loot.values()]) {
      if (l.until <= this.time) {
        this.loot.delete(l.id);
        continue;
      }
      for (const p of this.players.values()) {
        if (p.dead || dist(p, l) > 28 || !this.canPickUp(p, l)) continue;
        if (this.giveItem(p, l.item)) {
          this.loot.delete(l.id);
          break;
        }
      }
    }

    for (const p of [...this.players.values()]) {
      if (this.time - p.lastActive > cfg.INACTIVE_TIMEOUT) this.despawnPlayer(p);
    }
  }

  // ─── Output for the overlay ───────────────────────────────────

  colorOf(e) {
    if (e.kind === 'player') return D.CLASSES[e.rec.class].color;
    return e.color;
  }

  pushFx(fx) {
    this.fx.push(fx);
    if (this.fx.length > 500) this.fx.shift();
  }

  feed(text, kind = 'info') {
    const item = { text, kind };
    this.feedLog.push(item);
    if (this.feedLog.length > 20) this.feedLog.shift();
    this.emit('feed', item);
  }

  hello() {
    return { w: this.cfg.WORLD_W, h: this.cfg.WORLD_H, nez: this.nezArea, tickRate: this.cfg.TICK_RATE, feed: this.feedLog };
  }

  snapshot() {
    const ents = [];
    for (const e of this.entities.values()) {
      const s = this.stats(e);
      const o = {
        id: e.id, k: e.kind[0], n: e.name, x: Math.round(e.x), y: Math.round(e.y),
        hp: Math.max(0, Math.round(e.hp)), mh: Math.round(s.maxHp), f: e.facing,
      };
      if (e.kind === 'player') {
        const c = D.CLASSES[e.rec.class];
        o.gl = c.glyph;
        o.c = c.color;
        o.lv = e.rec.level;
        if (e.rec.guild) o.g = e.rec.guild;
        const pet = D.ITEMS[e.rec.equipped.pet];
        if (pet) o.pet = [pet.glyph, pet.color];
        if (e.dead) o.d = 1;
      } else {
        o.gl = e.glyph;
        o.c = e.color;
      }
      if (e.size > 1) o.sz = e.size;
      if (e.boss) o.b = 1;
      if (e.emote) o.em = e.emote.type;
      if (e.buffs.length) o.bf = 1;
      ents.push(o);
    }
    const loot = [...this.loot.values()].map(l => {
      const def = D.ITEMS[l.item];
      return { id: l.id, x: Math.round(l.x), y: Math.round(l.y), gl: LOOT_GLYPH[def.type] || '?', c: D.RARITY[def.rarity].color, n: l.item };
    });
    const fx = this.fx;
    this.fx = [];
    return { ents, loot, fx };
  }

  hud() {
    const recs = Object.entries(this.records);
    const top = recs
      .sort(([, a], [, b]) => b.level - a.level || b.xp - a.xp)
      .slice(0, 8)
      .map(([key, r]) => ({ name: r.username, level: r.level, guild: r.guild, kills: r.kills, online: this.players.has(key) }));
    const guilds = Object.entries(this.guilds)
      .map(([gk, g]) => {
        const members = this.membersOf(gk);
        let online = 0;
        for (const m of members) if (this.players.has(m)) online++;
        return { name: g.name, members: members.size, online, kills: g.kills, wars: this.enemyGuildsOf(gk).map(k => this.guilds[k]?.name).filter(Boolean) };
      })
      .sort((a, b) => b.online - a.online || b.kills - a.kills || b.members - a.members)
      .slice(0, 6);
    const q = this.quest;
    const boss = this.boss();
    let mobs = 0;
    for (const e of this.entities.values()) if (e.kind === 'mob') mobs++;
    return {
      top,
      guilds,
      quest: q ? { name: q.name, progress: q.progress, need: q.need, reward: q.reward } : null,
      boss: boss ? { name: boss.name, hp: Math.round(boss.hp), mh: boss.maxHp } : null,
      online: this.players.size,
      mobs,
      totalPlayers: recs.length,
    };
  }
}

function ok(text) {
  return { ok: true, text };
}

function fail(text) {
  return { ok: false, text };
}

module.exports = { World, keyOf, segmentHitsRect };
