'use strict';
// YouTube live chat listener using the YouTube Data API v3.
// Needs an API key and the live video's ID. Each poll costs API quota,
// so keep YOUTUBE_POLL_MS around 8000 for long streams.
const API = 'https://www.googleapis.com/youtube/v3';

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason || body.error?.message || res.statusText;
    throw new Error(`YouTube API ${res.status}: ${reason}`);
  }
  return body;
}

function startYouTube({ apiKey, videoId, pollMs, onChat, onStatus, retryMs = 30000 }) {
  let stopped = false;
  let lastStatus = null;
  const status = s => {
    if (s !== lastStatus) onStatus(s);
    lastStatus = s;
  };
  let timer = null;
  const key = encodeURIComponent(apiKey);

  const wait = ms => new Promise(resolve => { timer = setTimeout(resolve, ms); });

  async function run() {
    let liveChatId = null;
    let pageToken = null;
    let first = true;
    while (!stopped) {
      try {
        if (!liveChatId) {
          status('finding live chat');
          const video = await getJson(`${API}/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${key}`);
          liveChatId = video.items?.[0]?.liveStreamingDetails?.activeLiveChatId || null;
          if (!liveChatId) {
            status(`no active live chat for that video; retrying in ${retryMs / 1000}s`);
            await wait(retryMs);
            continue;
          }
        }
        const params = `liveChatId=${encodeURIComponent(liveChatId)}&part=snippet,authorDetails&key=${key}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const data = await getJson(`${API}/liveChat/messages?${params}`);
        pageToken = data.nextPageToken || pageToken;
        status('connected'); // also clears an earlier error once polling works again
        // The first page is chat history from before we started; skip it so
        // old commands don't replay.
        if (!first) {
          for (const item of data.items || []) {
            if (item.snippet?.type !== 'textMessageEvent') continue;
            const user = (item.authorDetails?.displayName || '').replace(/^@/, '');
            const message = item.snippet.displayMessage || item.snippet.textMessageDetails?.messageText || '';
            if (user) onChat({ user, message, platform: 'youtube', id: item.authorDetails?.channelId });
          }
        }
        first = false;
        await wait(Math.max(pollMs, data.pollingIntervalMillis || 0));
      } catch (err) {
        status(`error: ${err.message}; retrying in ${retryMs / 1000}s`);
        if (/liveChatEnded|liveChatNotFound|forbidden/i.test(err.message)) {
          liveChatId = null;
          pageToken = null;
          first = true;
        }
        await wait(retryMs);
      }
    }
  }

  run();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

module.exports = { startYouTube };
