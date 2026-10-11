'use strict';
// ═══════════════════════════════════════════════════════════════
// GAME DATA: classes, items, mobs, summons, leveling.
// Add or tweak entries here; the engine reads everything from this file.
// range: attack reach in world pixels (about 45 = melee).
// cd: seconds between attacks. spd: pixels per second.
// ═══════════════════════════════════════════════════════════════

// Every chatter gets a class picked from their username.
const CLASSES = {
  warrior: { name: 'Warrior', glyph: '⚔', color: '#ff8a8a', hp: 120, atk: 12, def: 4, spd: 85, range: 45, cd: 1.0 },
  mage: { name: 'Mage', glyph: '✦', color: '#9a9aff', hp: 80, atk: 16, def: 1, spd: 75, range: 220, cd: 1.4, projectile: '✦' },
  rogue: { name: 'Rogue', glyph: '►', color: '#8aff8a', hp: 90, atk: 9, def: 2, spd: 115, range: 40, cd: 0.6 },
  tank: { name: 'Tank', glyph: '■', color: '#c8c8c8', hp: 170, atk: 8, def: 8, spd: 65, range: 45, cd: 1.2 },
  ranger: { name: 'Ranger', glyph: '↑', color: '#c4ff8a', hp: 95, atk: 11, def: 2, spd: 95, range: 240, cd: 1.0, projectile: '→' },
  // Healers patch up guildmates and allies on their own, then fight.
  healer: { name: 'Healer', glyph: '✚', color: '#3dffa8', hp: 90, atk: 6, def: 3, spd: 85, range: 200, cd: 1.2, projectile: '•', healPower: 10 },
};

const RARITY = {
  common: { color: '#d0d0d0', weight: 70 },
  uncommon: { color: '#4cff4c', weight: 22 },
  rare: { color: '#4aa8ff', weight: 7 },
  legendary: { color: '#ffaa00', weight: 1 },
};

// type: weapon | armor | pet  -> --equip
// type: consumable | buff | ally -> --use
const ITEMS = {
  // Weapons
  'Sword': { type: 'weapon', rarity: 'common', atk: 5 },
  'Dagger': { type: 'weapon', rarity: 'common', atk: 3, spd: 15 },
  'Bow': { type: 'weapon', rarity: 'common', atk: 4, range: 240, projectile: '→' },
  'Axe': { type: 'weapon', rarity: 'uncommon', atk: 9, spd: -5 },
  'Staff': { type: 'weapon', rarity: 'uncommon', atk: 7, range: 220, projectile: '✦' },
  'War Hammer': { type: 'weapon', rarity: 'rare', atk: 14, spd: -10 },
  'Flame Blade': { type: 'weapon', rarity: 'rare', atk: 16 },
  'Dragon Slayer': { type: 'weapon', rarity: 'legendary', atk: 26 },
  // Armor
  'Leather Armor': { type: 'armor', rarity: 'common', def: 3 },
  'Chainmail': { type: 'armor', rarity: 'uncommon', def: 6 },
  'Plate Armor': { type: 'armor', rarity: 'rare', def: 11, spd: -10 },
  'Dragon Scale': { type: 'armor', rarity: 'legendary', def: 18 },
  // Healing
  'Potion': { type: 'consumable', rarity: 'common', heal: 50 },
  'Elixir': { type: 'consumable', rarity: 'uncommon', healPct: 1 },
  'Phoenix Feather': { type: 'consumable', rarity: 'rare', revive: true },
  // Buffs (stat multiplier for `duration` seconds)
  'Swift Tonic': { type: 'buff', rarity: 'common', buff: { stat: 'spd', mult: 1.5, duration: 60 } },
  'Rage Tonic': { type: 'buff', rarity: 'uncommon', buff: { stat: 'atk', mult: 1.5, duration: 60 } },
  'Iron Skin': { type: 'buff', rarity: 'uncommon', buff: { stat: 'def', mult: 2, duration: 60 } },
  // Pets follow you around and add stats
  'Slime Pet': { type: 'pet', rarity: 'common', glyph: '◍', color: '#7dff7d', hp: 20 },
  'Wolf Pup': { type: 'pet', rarity: 'uncommon', glyph: 'ʬ', color: '#c0c0c0', atk: 3 },
  'Baby Dragon': { type: 'pet', rarity: 'legendary', glyph: 'ɗ', color: '#ff7040', atk: 7, hp: 30 },
  // Allies you can call in
  'Mercenary Contract': { type: 'ally', rarity: 'rare', summon: 'mercenary' },
};

// PvE monsters. weight = how often it spawns. loot = chance to drop an item.
const MOBS = {
  slime: { name: 'Slime', glyph: '◍', color: '#6dff6d', hp: 35, atk: 5, def: 0, spd: 45, range: 35, cd: 1.2, xp: 12, loot: 0.15, weight: 4 },
  goblin: { name: 'Goblin', glyph: 'g', color: '#a8d86a', hp: 55, atk: 8, def: 1, spd: 80, range: 40, cd: 1.0, xp: 20, loot: 0.25, weight: 3 },
  skeleton: { name: 'Skeleton', glyph: 'ẞ', color: '#eeeeee', hp: 60, atk: 9, def: 2, spd: 60, range: 200, cd: 1.5, xp: 28, loot: 0.3, weight: 2, projectile: '➶' },
  orc: { name: 'Orc', glyph: 'Ö', color: '#ff9a4a', hp: 120, atk: 14, def: 4, spd: 60, range: 45, cd: 1.3, xp: 45, loot: 0.45, weight: 1 },
  dragon: {
    name: 'Dragon', glyph: 'Ɖ', color: '#ff3a3a', hp: 2500, atk: 32, def: 8, spd: 55, range: 260, cd: 1.6,
    xp: 500, loot: 1, weight: 0, boss: true, size: 2.6, aoe: 90, projectile: '✹', drops: 3,
  },
};

// Temporary NPC helpers from --summon and Mercenary Contract.
const SUMMONS = {
  spirit: { name: 'Spirit', glyph: '✧', color: '#b8f0ff', hp: 80, atk: 9, def: 2, spd: 95, range: 200, cd: 1.2, projectile: '✧', duration: 60 },
  mercenary: { name: 'Mercenary', glyph: '♞', color: '#ffd27a', hp: 160, atk: 14, def: 5, spd: 85, range: 45, cd: 1.0, duration: 90 },
};

// Total XP needed to reach a level: 50, 150, 300, 500, ...
function xpForLevel(level) {
  return 25 * level * (level - 1);
}

function levelForXp(xp, maxLevel = 50) {
  let level = 1;
  while (level < maxLevel && xp >= xpForLevel(level + 1)) level++;
  return level;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function classForUser(username) {
  const keys = Object.keys(CLASSES);
  return keys[hashString(username.toLowerCase()) % keys.length];
}

function colorForName(name) {
  return `hsl(${hashString(name.toLowerCase()) % 360}, 85%, 65%)`;
}

// Case-insensitive lookup of an item definition by its name.
function findItemName(query) {
  if (!query) return null;
  const q = query.toLowerCase();
  return Object.keys(ITEMS).find(name => name.toLowerCase() === q) || null;
}

module.exports = {
  CLASSES, RARITY, ITEMS, MOBS, SUMMONS,
  xpForLevel, levelForXp, hashString, classForUser, colorForName, findItemName,
};
