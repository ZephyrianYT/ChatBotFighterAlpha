'use strict';
const { World } = require('../server/game/world');
const { Store } = require('../server/store');
const config = require('../server/config');

// Small seeded random generator so test runs are repeatable.
function seededRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeWorld(overrides = {}, file = null, seed = 1) {
  const store = new Store(file).load();
  // No surprise spawns unless a test asks for them.
  const game = { ...config.GAME, MOBS_BASE: 0, MOBS_PER_PLAYER: 0, BOSS_INTERVAL: 1e9, QUEST_DELAY: 1e9, ...overrides };
  return new World({ store, config: game, rng: seededRng(seed) });
}

const say = (world, user, message) => world.handleChat({ user, message, platform: 'test' });

function run(world, seconds, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) world.tick(dt);
}

module.exports = { seededRng, makeWorld, say, run };
