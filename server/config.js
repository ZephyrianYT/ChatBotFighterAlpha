'use strict';
// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// Server settings come from .env (see .env.example).
// GAME holds the gameplay tuning; edit the numbers here.
// ═══════════════════════════════════════════════════════════════
const path = require('path');

const ROOT = path.join(__dirname, '..');
const env = (key, fallback = '') => (process.env[key] ?? fallback).trim();
const num = (key, fallback) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && process.env[key] !== '' ? v : fallback;
};
const bool = (key, fallback) => {
  const v = env(key).toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
};

const GAME = {
  // World is a fixed 1920x1080 space; the overlay scales it to fit OBS.
  WORLD_W: 1920,
  WORLD_H: 1080,
  TICK_RATE: 10, // simulation steps per second

  // NEZ (No Entry Zone): characters never walk into this rectangle,
  // so the middle of your stream layout stays clear. World pixels.
  NEZ_ENABLED: true,
  NEZ_X: 600,
  NEZ_Y: 340,
  NEZ_W: 720,
  NEZ_H: 400,

  // Players
  MAX_PLAYERS_ON_SCREEN: 60,
  INACTIVE_TIMEOUT: 900, // seconds without chatting before a character leaves the screen
  INVENTORY_SIZE: 12,
  MAX_ALLIES: 10,
  GUILD_MAX_MEMBERS: 50,
  MAX_LEVEL: 50,

  // XP
  XP_PER_MESSAGE: 5,
  XP_MESSAGE_COOLDOWN: 20, // seconds between XP-earning messages per user
  XP_PER_PVP_KILL: 40, // plus 10 per level of the defeated player
  XP_FOR_REVIVE: 15,

  // Combat
  CRIT_CHANCE: 0.12,
  CRIT_MULT: 1.8,
  AGGRO_RANGE: 350, // players auto-fight mobs this close
  WAR_AGGRO_RANGE: 650, // guild members at war auto-fight enemy members this close
  TARGET_DURATION: 60, // seconds a --attack target is remembered
  GUILD_WAR_DURATION: 180,
  REGEN_DELAY: 8, // seconds out of combat before regeneration starts
  REGEN_PCT_PER_SEC: 0.01,

  // Death
  REVIVE_SELF_DELAY: 10, // seconds dead before --revive works on yourself
  AUTO_REVIVE: 60, // seconds until a dead player revives on their own

  // Command cooldowns (seconds)
  COOLDOWN_HEAL: 30,
  COOLDOWN_REVIVE_OTHER: 60,
  COOLDOWN_LOOT: 180,
  COOLDOWN_SUMMON_ALLY: 60,
  COOLDOWN_SUMMON_SPIRIT: 180,
  COOLDOWN_DANCE: 8,
  COOLDOWN_CHEER: 45,
  SUMMON_STAY: 180, // seconds a summoned (non-chatting) friend stays on screen

  // Mobs (PvE)
  MOB_SPAWN_INTERVAL: 6,
  MOBS_BASE: 4,
  MOBS_PER_PLAYER: 1,
  MAX_MOBS: 40,
  BOSS_INTERVAL: 600, // seconds between boss spawns
  BOSS_MIN_PLAYERS: 1,
  BOSS_LIFETIME: 300, // seconds before an unbeaten boss flies away

  // Ground loot
  LOOT_LIFETIME: 90,
  MAX_GROUND_LOOT: 30,
  LOOT_SEEK_RANGE: 350,

  // Community quest
  QUEST_DELAY: 20, // seconds between finishing one quest and the next

  // Saving
  SAVE_INTERVAL: 15,
};

module.exports = {
  ROOT,
  HOST: env('HOST', '127.0.0.1'),
  PORT: num('PORT', 3000),
  DATA_FILE: path.resolve(ROOT, env('DATA_FILE', 'data/world.json')),
  TEST_CONSOLE: bool('TEST_CONSOLE', true),
  TWITCH_CHANNEL: env('TWITCH_CHANNEL').replace(/^#/, ''),
  YOUTUBE_API_KEY: env('YOUTUBE_API_KEY'),
  YOUTUBE_VIDEO_ID: env('YOUTUBE_VIDEO_ID'),
  YOUTUBE_POLL_MS: Math.max(2000, num('YOUTUBE_POLL_MS', 8000)),
  GAME,
};
