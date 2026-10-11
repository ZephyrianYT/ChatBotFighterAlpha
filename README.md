I'm not a coder, just making this with claude and other ai, for the whatevers of it.
Find me on youtube under the name Zephyr,  https://[www.youtube.com/channel/@Zephyrian1st](https://www.youtube.com/@Zephyrian1st)

# Chat Fighter: a chat-driven MMO-lite for OBS

Every person who types in your Twitch or YouTube chat becomes a character on
your stream. They level up by chatting and fighting, form guilds, make allies,
start guild wars, team up against monsters and bosses, and collect loot. Their
progress is saved, so they keep it from stream to stream.

```
 Twitch / YouTube chat ──► Node.js server (the game) ──► OBS Browser Source (the picture)
                           saves to data/world.json
```

## Quick start

1. Install **Node.js 18 or newer** from https://nodejs.org (the "LTS" version).
2. Open a terminal in this folder and run:
   ```
   npm install
   ```
3. Copy `.env.example` to a new file named `.env` and fill in your channel
   (see "Connecting chat" below). You can skip this step to just test locally.
4. Start the game:
   ```
   npm start
   ```
5. In OBS: **Sources → + → Browser**
   - URL: `http://localhost:3000/overlay`
   - Width `1920`, Height `1080`
6. Open `http://localhost:3000/console` in your normal browser to type chat as
   any username and watch it happen. It has buttons to add 10 fake chatters,
   a "chaos mode" that makes them spam commands, and a boss spawner.

Stop the server with `Ctrl+C`; it saves everyone before closing.

## Connecting chat

**Twitch.** Put your channel name in `.env`:
```
TWITCH_CHANNEL=yourchannel
```
Reading chat needs no password or token.

**YouTube.** You need an API key and the ID of the live video:
1. Go to https://console.cloud.google.com, create a project, enable
   **YouTube Data API v3**, then **Credentials → Create credentials → API key**.
2. Start your stream and copy the video ID (the part after `watch?v=`).
3. In `.env`:
   ```
   YOUTUBE_API_KEY=your-key
   YOUTUBE_VIDEO_ID=abc123xyz
   ```
Google gives each key a daily quota, and every chat check uses some of it.
`YOUTUBE_POLL_MS=8000` (check every 8 seconds) is enough for a stream of about
4 hours. Raise it for longer streams. The video ID changes every stream, so
update it each time.

You can use Twitch and YouTube at the same time. The small status line in the
bottom-right corner of the overlay shows whether each one is connected.

## Commands

Commands can go anywhere in a message. Phones that turn `--` into `—` work too.

| Command | What it does |
|---|---|
| *(any message)* | Joins the game; earns XP (once every 20s) |
| `--guild Knights` | Creates the guild, or joins it if it exists |
| `--guild` | Shows your guild |
| `--leaveguild` | Leaves your guild |
| `--allywith @Ian` | Sends an ally request. When Ian sends one back, you're allies |
| `--attack @user` | Hunts that player (not guildmates or allies) |
| `--attack guild Name` | Starts a 3-minute guild war: both guilds fight on sight |
| `--attack` / `--attack boss` | Goes after the nearest monster / the boss |
| `--heal` | Heals you and nearby friends (30s cooldown, stronger for Healers) |
| `--revive` | Gets you back up 10s after falling (or wait 60s) |
| `--revive @user` | Revives a fallen player |
| `--loot` | Searches for a random item (every 3 minutes) |
| `--equip Sword` | Equips a weapon, armor or pet from your bag |
| `--use Potion` | Uses a potion, tonic, Phoenix Feather or Mercenary Contract |
| `--drop Item` | Drops an item on the ground (lets you give it to a friend) |
| `--summon` | Calls a spirit to fight with you for 60s |
| `--summon @friend` | Brings an ally or guildmate to your side, even if they're offline |
| `--dance` | Dances |
| `--cheer` | Gives nearby friends an attack boost |
| `--stats` | Shows your level, XP, gear and bag above your character |

## How the game plays

- **Classes:** each chatter is a Warrior, Mage, Rogue, Tank, Ranger or Healer,
  picked from their name. Healers patch up guildmates and allies on their own.
- **XP** comes from chatting, killing monsters, defeating players, reviving
  people and finishing community quests ("slay 15 Goblins together").
- **PvE:** Slimes, Goblins, Skeletons and Orcs wander in, and get tougher as
  the average level goes up. Every 10 minutes a **Dragon boss** appears. Beat
  it within 5 minutes for rare loot, or it flies away.
- **PvP** only happens when someone uses `--attack` or a guild war is on.
  Anyone attacked fights back.
- **Loot:** weapons, armor, potions, tonics (buffs), pets (they follow you)
  and Mercenary Contracts (hired allies). Monsters drop items on the ground,
  and characters walk over to pick them up.
- **No Entry Zone:** characters never walk into the middle of the screen, so
  your main content stays clear. Add `?debug=1` to the overlay URL to see it.
- Characters leave the screen after 15 minutes without chatting and come
  back where they left off.

## Customizing

| What | Where |
|---|---|
| Cooldowns, XP, spawn rates, NEZ position, boss timer | `server/config.js` (the `GAME` block) |
| Classes, items, monsters, bosses | `server/game/data.js` |
| Overlay look (panels, colors, layout) | `public/overlay/index.html` |
| Character drawing and effects | `public/overlay/game.js` |
| Command words | `server/commands.js` |

Overlay URL options: `?hud=0` hides the panels, `?help=0` hides the command
tips, `?status=0` hides the connection line, and `?debug=1` outlines the NEZ.

## Troubleshooting

- **The overlay is blank in OBS.** Start the server (`npm start`) before
  OBS loads the source. If OBS was already open, right-click the source and
  choose **Refresh**. Once the overlay has loaded, it reconnects on its own
  when you restart the server.
- **Everything looks small or squished.** Set the Browser Source to Width
  `1920` and Height `1080`. OBS starts browser sources at 800×600.
- **`.env` isn't picked up on Windows.** Windows may have saved it as
  `.env.txt`. Turn on **View → File name extensions** in File Explorer and
  rename it to exactly `.env`.
- **OBS runs on a different PC than the server.** Set `HOST=0.0.0.0` in
  `.env` and use `http://<server-PC-IP>:3000/overlay` in OBS. This opens the
  game to your local network, so also set `TEST_CONSOLE=false`.
- **Two people with the same name.** If a name is already used by a
  different account (for example a Twitch "Alex" and a YouTube "Alex"), the
  newcomer gets their own character called `Alex#abcd` instead of taking
  over the existing one.

## Files

```
server/index.js        web server + socket.io + main loop
server/commands.js     chat message → command
server/game/world.js   the RPG engine (movement, combat, guilds, loot, quests)
server/game/data.js    classes, items, monsters
server/store.js        saves players to data/world.json
server/chat/           Twitch and YouTube listeners
public/overlay/        what OBS shows (index.html, game.js, socket.js, assets/)
public/console/        test console
test/                  automated tests (npm test)
Index.html             the older all-in-one version (Streamlabs alerts); still works on its own
```

Player data lives in `data/world.json`. Back it up if you care about it; you
can also edit it by hand while the server is stopped.

## Safety notes

- The server only listens on your own computer (`HOST=127.0.0.1`). Leave it
  that way unless you know you need otherwise.
- The test console can make anyone "say" anything in the game. Set
  `TEST_CONSOLE=false` in `.env` if you'd rather turn it off while live.
- Chat text is only ever drawn as plain text, so names and messages can't
  inject code into the overlay.
