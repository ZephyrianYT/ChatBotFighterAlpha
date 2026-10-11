'use strict';
// ═══════════════════════════════════════════════════════════════
// COMMAND PARSER
// Turns a chat message into a command object, or null.
//   --guild Knights        { type: 'guild', name: 'Knights' }
//   --attack @Ian          { type: 'attack', target: 'Ian' }
//   --attack guild Moon    { type: 'attackGuild', guild: 'Moon' }
// Phones often turn "--" into a dash (— or –), so those count too.
// ═══════════════════════════════════════════════════════════════

const COMMANDS = [
  'guild', 'leaveguild', 'allywith', 'attack', 'heal', 'revive',
  'loot', 'equip', 'use', 'drop', 'summon', 'dance', 'cheer', 'stats',
];

const COMMAND_RE = /(?:^|\s)(?:--|—|–)([a-z]+)/gi;
const GUILD_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _'-]{1,23}$/u;

function cleanArg(text) {
  return text
    .trim()
    .replace(/^@+/, '')
    .replace(/[!?.,;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function parseCommand(message) {
  if (typeof message !== 'string') return null;
  for (const match of message.matchAll(COMMAND_RE)) {
    const name = match[1].toLowerCase();
    if (!COMMANDS.includes(name)) continue;
    const rest = message.slice(match.index + match[0].length);
    // A command must end at a word boundary: "--healer" is not "--heal".
    if (/^[\w-]/.test(rest)) continue;
    return build(name, rest.trim());
  }
  return null;
}

function build(name, rest) {
  switch (name) {
    case 'guild': {
      const guild = cleanArg(rest);
      if (!guild) return { type: 'guild', name: null };
      if (!GUILD_NAME_RE.test(guild)) return { type: 'invalid', reason: 'Guild names: 2-24 letters/numbers' };
      return { type: 'guild', name: guild };
    }
    case 'attack': {
      const m = rest.match(/^guild\s+(.+)$/i);
      if (m) {
        const guild = cleanArg(m[1]);
        return guild ? { type: 'attackGuild', guild } : { type: 'invalid', reason: 'Usage: --attack guild Name' };
      }
      return { type: 'attack', target: cleanArg(rest) || null };
    }
    case 'allywith': {
      const target = cleanArg(rest);
      return target ? { type: 'allywith', target } : { type: 'invalid', reason: 'Usage: --allywith @user' };
    }
    case 'revive':
    case 'summon':
      return { type: name, target: cleanArg(rest) || null };
    case 'equip':
    case 'use':
    case 'drop': {
      const item = cleanArg(rest);
      return item ? { type: name, item } : { type: 'invalid', reason: `Usage: --${name} ItemName` };
    }
    default:
      return { type: name };
  }
}

module.exports = { parseCommand, COMMANDS };
