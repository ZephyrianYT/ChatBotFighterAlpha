'use strict';
// ═══════════════════════════════════════════════════════════════
// SERVER
//   http://localhost:3000/overlay  → OBS Browser Source
//   http://localhost:3000/console  → test chat without going live
// Reads Twitch/YouTube chat, feeds it to the world, and streams the
// world to every open overlay over socket.io.
// ═══════════════════════════════════════════════════════════════
const path = require('path');
const { loadEnv } = require('./env');

loadEnv(path.join(__dirname, '..', '.env'));

const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { Store } = require('./store');
const { World } = require('./game/world');
const { startTwitch } = require('./chat/twitch');
const { startYouTube } = require('./chat/youtube');

const PUBLIC = path.join(config.ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const resolved = path.join(PUBLIC, path.normalize(pathname));
  if (resolved !== PUBLIC && !resolved.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  for (const file of [resolved, path.join(resolved, 'index.html')]) {
    try {
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) continue;
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        const stream = fs.createReadStream(file);
        stream.on('error', () => res.destroy()); // e.g. file locked by antivirus
        stream.pipe(res);
      }
      return;
    } catch {
      // try the next candidate
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

// Only pages served by this server (the overlay and console) may connect.
// Without this, any website open in your browser could connect to
// localhost and send fake chat.
function allowConnection(req, host) {
  const origin = req.headers.origin;
  if (!origin) return true; // not a web page (OBS's own requests, tests, tools)
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.host !== req.headers.host) return false;
  // Same-origin but under a strange hostname = DNS rebinding trick, unless the
  // streamer deliberately opened the server to the network.
  return LOOPBACK.has(url.hostname) || !LOOPBACK.has(host === '::1' ? '[::1]' : host);
}

function start(overrides = {}) {
  const settings = { ...config, ...overrides };
  const game = { ...config.GAME, ...(overrides.GAME || {}) };
  const store = new Store(settings.DATA_FILE).load();
  const world = new World({ store, config: game });
  const server = http.createServer((req, res) => {
    serveStatic(req, res).catch(() => res.writeHead(500).end());
  });
  const io = new Server(server, {
    allowRequest: (req, callback) => callback(null, allowConnection(req, settings.HOST)),
  });

  const status = {
    twitch: settings.TWITCH_CHANNEL ? 'starting' : 'off',
    youtube: settings.YOUTUBE_API_KEY && settings.YOUTUBE_VIDEO_ID ? 'starting' : 'off',
    console: settings.TEST_CONSOLE ? 'on' : 'off',
  };
  const setStatus = (source, value) => {
    status[source] = value;
    io.emit('status', status);
    if (!settings.quiet) console.log(`[${source}] ${value}`);
  };
  const onChat = msg => {
    try {
      world.handleChat(msg);
    } catch (err) {
      console.error('[chat] could not handle message:', err);
    }
  };

  io.on('connection', socket => {
    socket.emit('hello', world.hello());
    socket.emit('status', status);
    socket.emit('hud', world.hud());
    // The test console sends chat and admin actions. Turn it off with TEST_CONSOLE=false.
    socket.on('chat', msg => {
      if (!settings.TEST_CONSOLE || !msg || typeof msg !== 'object') return;
      onChat({ user: String(msg.user || '').slice(0, 40), message: String(msg.message || '').slice(0, 300), platform: 'console' });
    });
    socket.on('admin', action => {
      if (!settings.TEST_CONSOLE) return;
      if (action === 'boss' && !world.boss()) world.spawnMob('dragon');
      if (action === 'mob') world.spawnMob(world.pickMobType());
    });
  });
  world.on('feed', item => io.emit('feed', item));

  let last = process.hrtime.bigint();
  const tickTimer = setInterval(() => {
    const now = process.hrtime.bigint();
    const dt = Math.min(0.5, Number(now - last) / 1e9);
    last = now;
    try {
      world.tick(dt);
      io.emit('state', world.snapshot());
    } catch (err) {
      console.error('[world] tick failed:', err);
    }
  }, 1000 / game.TICK_RATE);
  const hudTimer = setInterval(() => io.emit('hud', world.hud()), 2000);
  const save = () => {
    try {
      if (world.players.size) world.syncAll();
      store.save();
    } catch (err) {
      console.error('[store] save failed:', err.message);
    }
  };
  const saveTimer = setInterval(save, game.SAVE_INTERVAL * 1000);

  const connectors = [];
  if (settings.TWITCH_CHANNEL) {
    connectors.push(startTwitch({ channel: settings.TWITCH_CHANNEL, onChat, onStatus: s => setStatus('twitch', s) }));
  }
  if (settings.YOUTUBE_API_KEY && settings.YOUTUBE_VIDEO_ID) {
    connectors.push(startYouTube({
      apiKey: settings.YOUTUBE_API_KEY, videoId: settings.YOUTUBE_VIDEO_ID, pollMs: settings.YOUTUBE_POLL_MS,
      onChat, onStatus: s => setStatus('youtube', s),
    }));
  } else if (settings.YOUTUBE_API_KEY || settings.YOUTUBE_VIDEO_ID) {
    setStatus('youtube', 'needs both YOUTUBE_API_KEY and YOUTUBE_VIDEO_ID');
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(settings.PORT, settings.HOST, () => {
      const port = server.address().port;
      resolve({
        world, io, server, store, port,
        stop: () => new Promise(done => {
          clearInterval(tickTimer);
          clearInterval(hudTimer);
          clearInterval(saveTimer);
          for (const c of connectors) c.stop();
          save();
          io.close(() => done());
        }),
      });
    });
  });
}

if (require.main === module) {
  start()
    .then(app => {
      const host = config.HOST === '0.0.0.0' ? 'localhost' : config.HOST;
      const base = `http://${host === '127.0.0.1' ? 'localhost' : host}:${app.port}`;
      console.log('═'.repeat(56));
      console.log(' CHAT FIGHTER server running');
      console.log(` OBS Browser Source:  ${base}/overlay`);
      if (config.TEST_CONSOLE) console.log(` Test console:        ${base}/console`);
      console.log(` Player data:         ${config.DATA_FILE}`);
      console.log('═'.repeat(56));
      let stopping = false;
      const shutdown = () => {
        if (stopping) return;
        stopping = true;
        console.log('Saving and shutting down...');
        app.stop().then(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      if (process.platform === 'win32') {
        // Closing the console window (SIGHUP) or Ctrl+Break: save first.
        // Not done elsewhere so `nohup npm start` keeps running after logout.
        process.on('SIGHUP', shutdown);
        process.on('SIGBREAK', shutdown);
      }
    })
    .catch(err => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${config.PORT} is already in use. Close the other program or set PORT in .env.`);
      } else {
        console.error(err);
      }
      process.exit(1);
    });
}

module.exports = { start };
