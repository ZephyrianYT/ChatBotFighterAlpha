'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeWorld, say, run } = require('./helpers');
const { segmentHitsRect } = require('../server/game/world');

const player = (world, name) => world.players.get(name.toLowerCase());

test('every chatter becomes a saved character and earns XP from messages', () => {
  const w = makeWorld();
  say(w, 'ChatChan', 'hello!');
  const rec = w.records.chatchan;
  assert.equal(rec.username, 'ChatChan');
  assert.equal(rec.xp, w.cfg.XP_PER_MESSAGE);
  assert.deepEqual(rec.items, ['Potion']);
  assert.ok(player(w, 'ChatChan'));

  say(w, 'ChatChan', 'spam');
  assert.equal(rec.xp, w.cfg.XP_PER_MESSAGE, 'XP has a cooldown');
  run(w, w.cfg.XP_MESSAGE_COOLDOWN);
  say(w, 'ChatChan', 'later');
  assert.equal(rec.xp, w.cfg.XP_PER_MESSAGE * 2);
  assert.equal(rec.messages, 3);
});

test('levels follow the XP curve', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  w.giveXp(w.records.ian, 150);
  assert.equal(w.records.ian.level, 3);
});

test('guilds: create, join, leave, leader hand-off, disband', () => {
  const w = makeWorld();
  assert.equal(say(w, 'Ian', '--guild Knights').ok, true);
  assert.equal(w.guilds.knights.leader, 'Ian');
  say(w, 'Bob', '--guild knights');
  assert.equal(w.records.bob.guild, 'Knights', 'joins using the existing name');
  assert.equal(w.membersOf('knights').size, 2);

  say(w, 'Ian', '--leaveguild');
  assert.equal(w.records.ian.guild, null);
  assert.equal(w.guilds.knights.leader, 'Bob');

  say(w, 'Bob', '--guild MoonRiders');
  assert.equal(w.guilds.knights, undefined, 'empty guild is removed');
  assert.equal(w.records.bob.guild, 'MoonRiders');
});

test('allies need both sides to agree', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  say(w, 'Amy', '--allywith @Ian');
  assert.deepEqual(w.records.amy.allies, []);
  const r = say(w, 'Ian', '--allywith @amy');
  assert.equal(r.ok, true);
  assert.deepEqual(w.records.amy.allies, ['Ian']);
  assert.deepEqual(w.records.ian.allies, ['Amy']);
  assert.equal(say(w, 'Amy', '--attack @Ian').ok, false, 'allies cannot attack each other');
});

test('PvP: --attack chases and defeats the target, killer gets credit', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  say(w, 'Bob', 'hi');
  const ian = player(w, 'Ian');
  const bob = player(w, 'Bob');
  ian.rec.level = 20; // make the fight quick
  ian.hp = w.stats(ian).maxHp;
  assert.equal(say(w, 'Ian', '--attack @Bob').ok, true);
  run(w, 60);
  assert.ok(bob.dead || w.records.bob.deaths > 0, 'Bob was defeated');
  assert.ok(w.records.ian.pvpKills >= 1);
});

test('guildmates cannot be attacked and guild wars make members fight', () => {
  const w = makeWorld();
  say(w, 'Ian', '--guild Knights');
  say(w, 'Bob', '--guild Knights');
  assert.equal(say(w, 'Ian', '--attack @Bob').text, 'Bob is your guildmate');

  say(w, 'Zed', '--guild MoonRiders');
  assert.equal(say(w, 'Bob', '--attack guild moonriders').ok, true);
  assert.ok(w.atWar('knights', 'moonriders'));
  assert.ok(w.atWar('moonriders', 'knights'));
  assert.equal(say(w, 'Ian', '--attack guild Knights').ok, false, 'cannot war your own guild');
  run(w, 90);
  assert.ok(w.records.zed.deaths > 0 || w.records.ian.deaths + w.records.bob.deaths > 0, 'a war fight happened');
});

test('--heal has a cooldown and heals nearby friends but not enemies', () => {
  const w = makeWorld();
  say(w, 'Ian', '--guild Knights');
  say(w, 'Bob', '--guild Knights');
  say(w, 'Zed', 'hi');
  const [ian, bob, zed] = ['Ian', 'Bob', 'Zed'].map(n => player(w, n));
  for (const e of [bob, zed]) Object.assign(e, { x: ian.x + 30, y: ian.y });
  for (const e of [ian, bob, zed]) e.hp = 10;
  assert.equal(say(w, 'Ian', '--heal').ok, true);
  assert.ok(ian.hp > 10);
  assert.ok(bob.hp > 10);
  assert.equal(zed.hp, 10);
  assert.match(say(w, 'Ian', '--heal').text, /ready in/);
});

test('revive: wait before self-revive, revive others, auto-revive', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  say(w, 'Bob', 'hi');
  const ian = player(w, 'Ian');
  const mob = w.spawnMob('slime');
  w.kill(ian, mob);
  assert.equal(ian.dead, true);
  assert.match(say(w, 'Ian', '--revive').text, /revive in/);
  assert.equal(say(w, 'Bob', '--revive @Ian').ok, true);
  assert.equal(ian.dead, false);

  w.kill(ian, mob);
  run(w, w.cfg.AUTO_REVIVE + 1);
  assert.equal(ian.dead, false);
});

test('items: loot, equip changes stats, potions are used up, drop puts it on the ground', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  const ian = player(w, 'Ian');
  const before = w.stats(ian).atk;

  ian.rec.items.push('Sword');
  assert.equal(say(w, 'Ian', '--equip sword').ok, true);
  assert.equal(ian.rec.equipped.weapon, 'Sword');
  assert.equal(w.stats(ian).atk, before + 5);
  assert.equal(say(w, 'Ian', '--equip Potion').ok, false);

  ian.hp = 5;
  say(w, 'Ian', '--use potion');
  assert.ok(ian.hp > 5);
  assert.ok(!ian.rec.items.includes('Potion'));

  say(w, 'Ian', '--loot');
  assert.equal(ian.rec.items.length, 2);
  assert.match(say(w, 'Ian', '--loot').text, /Try in/);

  say(w, 'Ian', '--drop sword');
  assert.equal(ian.rec.equipped.weapon, null);
  assert.equal(w.loot.size, 1);
  run(w, 2);
  assert.equal(w.loot.size, 1, 'the dropper does not instantly pick it back up');
});

test('buffs and summons from items', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  const ian = player(w, 'Ian');
  ian.rec.items.push('Rage Tonic', 'Mercenary Contract');
  const atk = w.stats(ian).atk;
  say(w, 'Ian', '--use rage');
  assert.equal(w.stats(ian).atk, atk * 1.5);
  say(w, 'Ian', '--use mercenary');
  const npcs = [...w.entities.values()].filter(e => e.kind === 'npc');
  assert.equal(npcs.length, 1);
  run(w, 100);
  assert.equal([...w.entities.values()].filter(e => e.kind === 'npc').length, 0, 'mercenary leaves after its time');
  assert.equal(w.stats(ian).atk, atk, 'buff wore off');
});

test('--summon @friend only works for allies or guildmates', () => {
  const w = makeWorld();
  say(w, 'Ian', '--guild Knights');
  say(w, 'Bob', '--guild Knights');
  say(w, 'Zed', 'hi');
  w.despawnPlayer(player(w, 'Bob'));
  assert.equal(say(w, 'Ian', '--summon @Zed').ok, false);
  assert.equal(say(w, 'Ian', '--summon @Bob').ok, true);
  const bob = player(w, 'Bob');
  assert.ok(bob, 'offline guildmate is brought in');
  run(w, w.cfg.SUMMON_STAY + 1);
  assert.equal(player(w, 'Bob'), undefined, 'and leaves again if they never chat');
});

test('PvE: killing mobs gives XP, counts kills and advances the quest', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  const ian = player(w, 'Ian');
  w.newQuest();
  w.quest.mob = 'slime';
  w.quest.need = 1;
  const reward = w.quest.reward;
  const xp = ian.rec.xp;
  const slime = w.spawnMob('slime');
  w.damage(slime, 9999, ian);
  assert.equal(w.entities.has(slime.id), false);
  assert.equal(ian.rec.kills, 1);
  assert.equal(ian.rec.xp, xp + slime.xp + reward, 'kill + quest XP');
  assert.equal(w.quest, null, 'quest completed');
});

test('boss fight: players chase the boss down and it drops loot', () => {
  const w = makeWorld({ AGGRO_RANGE: 5000 });
  const feed = [];
  w.on('feed', f => feed.push(f.text));
  for (const n of ['A1', 'B2', 'C3', 'D4', 'E5', 'F6']) {
    say(w, n, 'hi');
    w.records[n.toLowerCase()].level = 25;
  }
  const boss = w.spawnMob('dragon');
  assert.ok(feed.some(t => t.includes('DRAGON HAS APPEARED')));
  boss.hp = 50;
  run(w, 60);
  assert.equal(w.boss(), null, 'boss defeated');
  assert.ok(feed.some(t => t.includes('was slain')));
  const rare = ['rare', 'legendary'];
  const found = [...w.loot.values()].map(l => l.item)
    .concat(...Object.values(w.records).map(r => r.items.filter(i => i !== 'Potion')));
  assert.ok(found.length >= 3, 'boss drops 3 items');
  assert.ok(found.every(i => rare.includes(require('../server/game/data').ITEMS[i].rarity)));
});

test('nothing ever walks into the No Entry Zone', () => {
  const w = makeWorld({ MOBS_BASE: 10, MOBS_PER_PLAYER: 1 }, null, 7);
  for (let i = 0; i < 15; i++) say(w, `P${i}`, i % 2 ? '--guild Red' : '--guild Blue');
  say(w, 'P0', '--attack guild Red');
  for (let t = 0; t < 120; t += 0.1) {
    w.tick(0.1);
    for (const e of w.entities.values()) assert.equal(w.insideNez(e.x, e.y), false, `${e.name} entered the NEZ`);
  }
});

test('characters walk around the NEZ instead of getting stuck on it', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  const ian = player(w, 'Ian');
  const { x, y, w: nw, h } = w.nez;
  Object.assign(ian, { x: x - 30, y: y + h / 2 });
  const goal = { x: x + nw + 30, y: y + h / 2 };
  for (let i = 0; i < 400 && !w.moveTo(ian, goal.x, goal.y, 100, 0.1, 5); i++);
  assert.ok(Math.hypot(ian.x - goal.x, ian.y - goal.y) <= 6);
});

test('segment/rectangle check', () => {
  const r = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(segmentHitsRect(-5, 5, 15, 5, r), true);
  assert.equal(segmentHitsRect(-5, -5, 15, -5, r), false);
  assert.equal(segmentHitsRect(-5, 20, 20, -5, r), true);
});

test('inactive players leave the screen but keep their save', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  run(w, w.cfg.INACTIVE_TIMEOUT + 1, 1);
  assert.equal(player(w, 'Ian'), undefined);
  assert.ok(w.records.ian);
  say(w, 'Ian', 'back');
  assert.ok(player(w, 'Ian'));
});

test('save file round trip keeps characters, guilds and allies', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbf-'));
  const file = path.join(dir, 'world.json');
  const w = makeWorld({}, file);
  say(w, 'Ian', '--guild Knights');
  say(w, 'Amy', '--allywith @Ian');
  say(w, 'Ian', '--allywith @Amy');
  player(w, 'Ian').rec.items.push('Sword');
  say(w, 'Ian', '--equip Sword');
  w.syncAll();
  w.store.save();

  const w2 = makeWorld({}, file);
  const ian = w2.records.ian;
  assert.equal(ian.guild, 'Knights');
  assert.deepEqual(ian.allies, ['Amy']);
  assert.equal(ian.equipped.weapon, 'Sword');
  assert.ok(ian.position);
  assert.ok(w2.membersOf('knights').has('ian'));
  fs.rmSync(dir, { recursive: true });
});

test('loads hand-edited or older save data safely', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbf-'));
  const file = path.join(dir, 'world.json');
  fs.writeFileSync(file, JSON.stringify({
    players: {
      chatchan: {
        username: 'ChatChan', xp: 120, level: 3, guild: 'MoonRiders', hp: 100,
        items: ['Potion', 'Sword', 'Banana'], allies: ['Ian'], position: { x: 200, y: 340 },
      },
    },
  }));
  const w = makeWorld({}, file);
  const rec = w.records.chatchan;
  assert.deepEqual(rec.items, ['Potion', 'Sword'], 'unknown items are dropped');
  assert.equal(rec.level, 2, 'level is recalculated from XP');
  assert.equal(w.guilds.moonriders.name, 'MoonRiders', 'missing guild is recreated');
  say(w, 'ChatChan', '--equip sword');
  assert.equal(rec.equipped.weapon, 'Sword');

  fs.writeFileSync(file, '{ not json');
  const w2 = makeWorld({}, file);
  assert.deepEqual(w2.records, {});
  assert.ok(fs.readdirSync(dir).some(f => f.includes('.corrupt-')), 'broken file is kept as a backup');
  fs.rmSync(dir, { recursive: true });
});

test('snapshots and HUD carry what the overlay needs', () => {
  const w = makeWorld();
  say(w, 'Ian', '--guild Knights');
  say(w, 'Bob', 'hello there');
  const snap = w.snapshot();
  const ian = snap.ents.find(e => e.n === 'Ian');
  assert.equal(ian.g, 'Knights');
  assert.ok(ian.gl && ian.c && ian.mh > 0);
  assert.ok(snap.fx.some(f => f.t === 'say' && f.text === 'hello there'));
  assert.deepEqual(w.snapshot().fx, [], 'fx are sent once');
  const hud = w.hud();
  assert.equal(hud.online, 2);
  assert.equal(hud.guilds[0].name, 'Knights');
});

test('pathing reaches any open spot from any other', () => {
  const w = makeWorld();
  say(w, 'Ian', 'hi');
  const e = player(w, 'Ian');
  for (let trip = 0; trip < 300; trip++) {
    const from = w.randomPoint();
    const to = w.randomPoint();
    Object.assign(e, from);
    let arrived = false;
    for (let i = 0; i < 800 && !arrived; i++) arrived = w.moveTo(e, to.x, to.y, 100, 0.1, 5);
    assert.ok(arrived, `stuck going from ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
  }
});

test('an unbeaten boss leaves after a while', () => {
  const w = makeWorld({ BOSS_LIFETIME: 5 });
  w.spawnMob('dragon');
  run(w, 6);
  assert.equal(w.boss(), null);
});
