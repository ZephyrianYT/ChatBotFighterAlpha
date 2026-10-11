// Real-time link to the server. Hands every message to the renderer.
(() => {
  'use strict';
  const socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => Game.onConnection(true));
  socket.on('disconnect', () => Game.onConnection(false));
  socket.on('hello', Game.onHello);
  socket.on('state', Game.onState);
  socket.on('hud', Game.onHud);
  socket.on('feed', item => Game.onFeed(item));
  socket.on('status', Game.onStatus);
})();
