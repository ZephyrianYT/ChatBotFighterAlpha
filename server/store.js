'use strict';
// ═══════════════════════════════════════════════════════════════
// PLAYER DATABASE (JSON file)
// { players: { "chatchan": { username, xp, level, guild, ... } },
//   guilds:  { "moonriders": { name, leader, createdAt, kills } } }
// Writes go to a temp file first so a crash can't leave half a file.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

// Lookup tables keyed by chat names use objects without a prototype, so a
// chatter named "constructor" or "__proto__" is just another name.
const dict = obj => Object.assign(Object.create(null), obj && typeof obj === 'object' ? obj : {});

class Store {
  constructor(file) {
    this.file = file;
    this.data = { version: 1, players: dict(), guilds: dict() };
    this.dirty = false;
  }

  load() {
    if (!this.file || !fs.existsSync(this.file)) return this;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { version: 1, players: dict(parsed.players), guilds: dict(parsed.guilds) };
    } catch (err) {
      // Keep the broken file for inspection instead of overwriting it.
      const backup = `${this.file}.corrupt-${Date.now()}`;
      fs.renameSync(this.file, backup);
      console.error(`[store] Could not read ${this.file} (${err.message}). Moved it to ${backup} and started fresh.`);
    }
    return this;
  }

  markDirty() {
    this.dirty = true;
  }

  save() {
    if (!this.dirty || !this.file) return false;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
    return true;
  }
}

module.exports = { Store };
