'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startYouTube } = require('../server/chat/youtube');

const reply = (body, status = 200) => ({ ok: status < 400, status, statusText: 'x', json: async () => body });
const chatItem = (name, channelId, text) => ({
  snippet: { type: 'textMessageEvent', displayMessage: text },
  authorDetails: { displayName: name, channelId },
});

test('YouTube listener: skips old chat, reports status, recovers after errors', async () => {
  const responses = [
    reply({ items: [{ liveStreamingDetails: { activeLiveChatId: 'chat1' } }] }),
    reply({ items: [chatItem('@Old', 'UC0', '--heal')], nextPageToken: 'p1', pollingIntervalMillis: 0 }),
    reply({ error: { errors: [{ reason: 'backendError' }] } }, 503),
    reply({ items: [chatItem('@Alex', 'UC1', '--attack @Bob'), { snippet: { type: 'superChatEvent' }, authorDetails: {} }], nextPageToken: 'p2' }),
  ];
  const urls = [];
  const realFetch = global.fetch;
  global.fetch = async url => {
    urls.push(url);
    return responses.shift() || reply({ items: [], nextPageToken: 'p3' });
  };
  const chats = [];
  const statuses = [];
  const yt = startYouTube({ apiKey: 'KEY', videoId: 'VID', pollMs: 1, retryMs: 1, onChat: m => chats.push(m), onStatus: s => statuses.push(s) });
  try {
    for (let i = 0; i < 100 && responses.length; i++) await new Promise(r => setTimeout(r, 5));
    await new Promise(r => setTimeout(r, 20));
  } finally {
    yt.stop();
    global.fetch = realFetch;
  }
  assert.deepEqual(chats, [{ user: 'Alex', message: '--attack @Bob', platform: 'youtube', id: 'UC1' }]);
  assert.equal(statuses[0], 'finding live chat');
  assert.equal(statuses[1], 'connected');
  assert.match(statuses[2], /^error: YouTube API 503: backendError/);
  assert.equal(statuses[3], 'connected', 'status recovers after a temporary error');
  assert.ok(urls[2].includes('pageToken=p1'), 'continues from the last page');
});
