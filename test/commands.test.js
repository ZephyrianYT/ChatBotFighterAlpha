'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCommand } = require('../server/commands');

test('plain chat is not a command', () => {
  assert.equal(parseCommand('hello chat'), null);
  assert.equal(parseCommand('a--b'), null);
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand(undefined), null);
});

test('parses every command from the blueprint', () => {
  assert.deepEqual(parseCommand('--guild Knights'), { type: 'guild', name: 'Knights' });
  assert.deepEqual(parseCommand('--allywith @Ian'), { type: 'allywith', target: 'Ian' });
  assert.deepEqual(parseCommand('--attack @user'), { type: 'attack', target: 'user' });
  assert.deepEqual(parseCommand('--attack guild MoonRiders'), { type: 'attackGuild', guild: 'MoonRiders' });
  assert.deepEqual(parseCommand('--heal'), { type: 'heal' });
  assert.deepEqual(parseCommand('--summon @friend'), { type: 'summon', target: 'friend' });
  assert.deepEqual(parseCommand('--summon'), { type: 'summon', target: null });
  assert.deepEqual(parseCommand('--equip Sword'), { type: 'equip', item: 'Sword' });
  assert.deepEqual(parseCommand('--use Potion'), { type: 'use', item: 'Potion' });
  assert.deepEqual(parseCommand('--loot'), { type: 'loot' });
  assert.deepEqual(parseCommand('--revive'), { type: 'revive', target: null });
  assert.deepEqual(parseCommand('--dance'), { type: 'dance' });
  assert.deepEqual(parseCommand('--cheer'), { type: 'cheer' });
});

test('is forgiving about how people type', () => {
  assert.deepEqual(parseCommand('lets go --HEAL now'), { type: 'heal' });
  assert.deepEqual(parseCommand('—attack @Ian!'), { type: 'attack', target: 'Ian' });
  assert.deepEqual(parseCommand('–guild Moon Riders'), { type: 'guild', name: 'Moon Riders' });
  assert.deepEqual(parseCommand('--allywith   @John Smith'), { type: 'allywith', target: 'John Smith' });
  assert.deepEqual(parseCommand('--use phoenix feather'), { type: 'use', item: 'phoenix feather' });
});

test('does not match longer words or unknown commands', () => {
  assert.equal(parseCommand('--healer'), null);
  assert.equal(parseCommand('--fly'), null);
  assert.deepEqual(parseCommand('--fly --heal'), { type: 'heal' });
});

test('rejects bad guild names and missing arguments', () => {
  assert.equal(parseCommand('--guild <img src=x>').type, 'invalid');
  assert.equal(parseCommand('--guild x').type, 'invalid');
  assert.equal(parseCommand('--equip').type, 'invalid');
  assert.equal(parseCommand('--allywith').type, 'invalid');
});
