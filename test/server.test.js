'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');
const { start } = require('../server/index');

test('server serves the overlay and streams chat-driven state', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbf-'));
  const app = await start({ PORT: 0, HOST: '127.0.0.1', DATA_FILE: path.join(dir, 'world.json'), TWITCH_CHANNEL: '', YOUTUBE_API_KEY: '', YOUTUBE_VIDEO_ID: '', TEST_CONSOLE: true, quiet: true });
  const base = `http://127.0.0.1:${app.port}`;
  try {
    for (const url of ['/overlay', '/overlay/game.js', '/overlay/socket.js', '/console', '/socket.io/socket.io.js']) {
      const res = await fetch(base + url);
      assert.equal(res.status, 200, url);
    }
    assert.equal((await fetch(`${base}/%2e%2e/package.json`)).status, 404);

    const socket = io(base, { transports: ['websocket'] });
    const hello = await new Promise(resolve => socket.once('hello', resolve));
    assert.equal(hello.w, 1920);
    socket.emit('chat', { user: 'Ian', message: '--guild Knights' });
    const seen = await new Promise(resolve => {
      socket.on('state', s => {
        const ian = s.ents.find(e => e.n === 'Ian');
        if (ian && ian.g === 'Knights') resolve(ian);
      });
    });
    assert.equal(seen.k, 'p');
    socket.close();
  } finally {
    await app.stop();
  }
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'world.json'), 'utf8'));
  assert.equal(saved.players.ian.guild, 'Knights', 'saved on shutdown');
  fs.rmSync(dir, { recursive: true });
});
