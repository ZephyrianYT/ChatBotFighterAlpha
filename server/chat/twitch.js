'use strict';
// Twitch chat listener (read-only, anonymous; no login or token needed).
const tmi = require('tmi.js');

function startTwitch({ channel, onChat, onStatus }) {
  const client = new tmi.Client({
    connection: { reconnect: true, secure: true },
    channels: [channel],
  });
  client.on('message', (_channel, tags, message, self) => {
    if (self) return;
    onChat({ user: tags['display-name'] || tags.username, message, platform: 'twitch', id: tags['user-id'] });
  });
  client.on('connected', () => onStatus('connected'));
  client.on('reconnect', () => onStatus('reconnecting'));
  client.on('disconnected', reason => onStatus(`disconnected: ${reason}`));
  onStatus('connecting');
  client.connect().catch(err => onStatus(`error: ${err.message || err}`));
  return { stop: () => client.disconnect().catch(() => {}) };
}

module.exports = { startTwitch };
