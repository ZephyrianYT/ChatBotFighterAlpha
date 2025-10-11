# ASCII Battle Royale - Stream Overlay Game

> **A lightweight, seed-based PvP battle royale for Twitch streams**  
> Viewers type in chat to spawn heroes. Fast, lethal 1-2 shot combat with 64 unique builds!

---

## 🎮 Overview

**ASCII Battle Royale** is a browser-based overlay game designed for livestreaming on Twitch/YouTube. It integrates with **Streamlabs** to spawn characters when viewers chat, subscribe, follow, or donate. Each username generates a unique hero with specific stats, weapons, and abilities based on a seed hash.

### Key Features
- ✅ **Chat Integration** - Viewers spawn heroes by typing in chat
- ✅ **Seed-Based Generation** - 64 unique builds from username hash
- ✅ **Lethal Combat** - Fast 1-2 shot kills (17-38 HP)
- ✅ **Dual Weapons** - Ranged projectile + melee weapon per fighter
- ✅ **Status Effects** - Fire, Ice, Poison, Lightning, Stun, Slow
- ✅ **KOTH Zone** - King of the Hill objective for points
- ✅ **Stream-Safe Center** - Auto-fades entities near center for gameplay visibility
- ✅ **Streamlabs Events** - Follows/Subs/Bits spawn bosses and ammo
- ✅ **Leaderboard** - Top 10 players by points

---

## 📋 Table of Contents

1. [Requirements](#-requirements)
2. [Installation](#-installation)
3. [Configuration](#-configuration)
4. [How to Use](#-how-to-use)
5. [Game Mechanics](#-game-mechanics)
6. [Code Structure](#-code-structure)
7. [Troubleshooting](#-troubleshooting)
8. [FAQ](#-faq)

---

## 🔧 Requirements

### Software
- **OBS Studio** or **Streamlabs OBS** (for overlay)
- **Streamlabs Account** (for chat/event integration)
- Modern web browser (Chrome, Firefox, Edge)

### Streamlabs Setup
1. Active Streamlabs account connected to your Twitch/YouTube
2. **Socket API Token** from Streamlabs Dashboard

---

## 📦 Installation

### Step 1: Download Files
```bash
# Clone or download this repository
git clone https://github.com/yourusername/ascii-battle-royale.git
cd ascii-battle-royale
```

**File structure:**
```
ascii-battle-royale/
├── Index.html          (Main game file - all-in-one)
├── README.md           (This file)
└── SETUP_GUIDE.md      (Detailed setup instructions)
```

### Step 2: Get Streamlabs Socket Token

1. Go to [Streamlabs Dashboard](https://streamlabs.com/dashboard)
2. Navigate to **Settings** → **API Settings**
3. Find **Socket API Token**
4. Copy the token (long alphanumeric string)

### Step 3: Configure the Game

Open `Index.html` in a text editor and find this section (~line 252):

```javascript
const CONFIG = {
  // Paste your token here:
  SOCKET_TOKEN: "",  // ← ADD YOUR TOKEN HERE
  ACCESS_TOKEN: "",  // Leave empty for now
  TEST_MODE: true,   // Set to false for production
  // ... rest of config
};
```

**Replace** `SOCKET_TOKEN: ""` with:
```javascript
SOCKET_TOKEN: "your_actual_token_here",
```

**Set Test Mode:**
- `TEST_MODE: true` - Spawns test heroes automatically (for debugging)
- `TEST_MODE: false` - Only spawns from real chat/events (for production)

### Step 4: Add to OBS

1. Open **OBS Studio**
2. Add a new **Browser Source**
3. Configure settings:
   ```
   Local file: ☑ (Check this box)
   Local File: Browse to your Index.html
   Width: 1920
   Height: 1080
   FPS: 60
   CSS: (leave empty)
   Shutdown source when not visible: ☐
   Refresh browser when scene becomes active: ☑
   ```
4. Position the source as an **overlay** above your game capture
5. Done! The game should start automatically

---

## ⚙️ Configuration

### Game Balance Settings

Edit these values in `CONFIG` (line ~252) to customize:

```javascript
const CONFIG = {
  // Combat & Balance
  HEALTH_DECAY_RATE: 0.1,        // HP drain per second (prevents clutter)
  KOTH_ZONE_RADIUS: 80,          // Size of KOTH zone
  KOTH_POINTS_PER_SEC: 3,        // Points earned per second in KOTH
  AI_SPAWN_INTERVAL: 20000,      // Time between AI enemy spawns (ms)
  
  // Center Avoidance (Stream Visibility)
  CENTER_AVOID_RADIUS: 350,      // Danger zone size
  CENTER_FADE_START: 450,        // Start fading entities
  CENTER_FADE_END: 250,          // Fully transparent
  
  // Progression
  XP_CURVE: [0, 100, 250, 450, 700, 1000, ...], // XP per level
};
```

### Archetype Customization

To modify builds, edit the `ARCHETYPES` array (line ~1030):

```javascript
const ARCHETYPES = [
  // Format: { ascii, hp, atk, spd, projectile, melee, color, icon, status, chance, behavior, ammo }
  { ascii: 'X', hp: 25, atk: 15, spd: 30, projectile: '-', melee: '†', ... },
  // Add more archetypes here (max 64)
];
```

---

## 🎯 How to Use

### For Streamers

1. **Start Stream**: Open OBS with the browser source active
2. **Test Mode**: Initially keep `TEST_MODE: true` to verify it works
   - Heroes spawn automatically on left/right
   - Enemies spawn from top every 10 seconds
3. **Production**: Set `TEST_MODE: false` and restart browser source
4. **Go Live**: Viewers typing in chat will spawn heroes!

### For Viewers

**Spawn a Hero:**
- Just type anything in Twitch chat
- Your username creates a unique hero based on seed hash
- One hero per viewer at a time

**Respawn Rules:**
- Hero dies → 10-minute cooldown
- Chat again during cooldown → See remaining time message
- After cooldown → Can spawn new hero

**Earning Points:**
- Deal damage: +1-10 pts per hit
- Kill enemy: +100 pts
- Hold KOTH: +3 pts/sec
- Top 10 shown on leaderboard (bottom-right)

### Streamlabs Events

**Automatic Spawns:**
- **Follow** → Boss + 2 ammo pickups + alert
- **Subscription** → Boss + 3 AI enemies + 3 ammo + alert
- **Bits** → Boss + 2 AI enemies + 2 ammo + alert
- **Donation** → 2 Bosses + ammo + alert

**Alerts:** Display for 15 seconds center-screen with event info

---

## 🎲 Game Mechanics

### Seed-Based Generation

Every username is hashed to generate a number 0-63, which maps to one of 64 archetype builds:

```
Username → Hash → Seed (0-63) → Archetype
                                    ↓
                    ┌───────────────┴───────────────┐
                    │ • HP: 17-38                   │
                    │ • Attack: 12-23               │
                    │ • Speed: 18-45                │
                    │ • Ammo: 14-27                 │
                    │ • Projectile: -, ~, >, |, etc │
                    │ • Melee: †, ※, ¡, ⚡, etc      │
                    │ • Status: Fire, Ice, Poison.. │
                    │ • Color: Unique               │
                    └───────────────────────────────┘
```

**Result:** Same username = same build every time!

### Combat System

**Lethal Damage:**
- Low HP (17-38) + High ATK (12-23) = **1-2 shot kills**
- Fast, exciting combat that keeps viewers engaged

**Weapons:**
- **Ranged**: Projectile attacks (uses ammo)
- **Melee**: Close-range attacks (unlimited)
- Both apply status effects based on archetype

**Status Effects:**

| Effect | Symbol | Description |
|--------|--------|-------------|
| Fire   | ♨      | 0.18 HP/sec burn damage |
| Ice    | ❄      | 30% movement slow |
| Poison | ☠      | 0.12 HP/sec DoT + flee behavior |
| Shock  | ⚡     | 0.08 HP/sec electric damage |
| Stun   | ◘      | Brief movement disable |
| Slow   | ◔      | 20% movement slow |
| Heal   | ♥      | Restores HP (Zephyr only) |

### Health Decay System

**Everyone loses HP constantly:**
- Base decay: 0.10 HP/sec (keeps screen clean)
- Idle penalty: 0.30 HP/sec (3x multiplier - forces movement!)
- Center zone: +0.30 HP/sec extra (keeps center clear)
- Status DoT: +0.08-0.18 HP/sec

**KOTH Recovery:**
- +0.05 HP/sec regeneration while in KOTH zone
- Partially offsets decay

### Territory System

**Center Zone (Stream Area):**
- ❌ Danger zone (350px radius)
- ❌ Entities fade to 10% opacity
- ❌ 2.5x push force outward
- ❌ 3x damage taken
- 🎥 **Keeps your gameplay visible!**

**KOTH Zone:**
- 🏆 Spawns in corners/edges (never center)
- 🏆 80px radius
- 🏆 Moves every 15 seconds
- 🏆 +3 pts/sec + HP regen + 50% faster attacks

**Edges/Corners:**
- ✅ Safe zones
- ✅ No extra penalties
- ✅ Fighters patrol here when no objectives

### Special Entities

**Zephyr (Healer):**
- Auto-spawns at game start
- Support role - heals nearby fighters
- Infinite ammo
- Respawns after 15 minutes if killed

**Bosses:**
- Spawn from Streamlabs events
- 5x HP, 3x ATK
- Spawn at map edges
- Move toward KOTH

**AI Enemies:**
- Spawn every 20 seconds (or from events)
- Aggressive behavior
- Target nearest player
- Drop nothing on death

---

## 📂 Code Structure

The game is contained in a single `Index.html` file, organized into 10 sections:

```
Index.html
├── HTML Structure (lines 1-240)
│   ├── Styles (CSS animations, entity styles, HUD)
│   ├── Game Container
│   ├── Center Zone Indicator
│   ├── Leaderboard
│   └── Event Alert Display
│
└── JavaScript (lines 241-1708)
    │
    ├── SECTION 1: Login & Credentials (241-269)
    │   └── CONFIG object with Streamlabs tokens
    │
    ├── SECTION 2: Game State (270-300)
    │   └── GameState object with all active entities
    │
    ├── SECTION 3: Streamlabs Logic (301-450)
    │   ├── connectStreamlabs()
    │   ├── handleStreamlabsEvent()
    │   └── showEventAlert()
    │
    ├── SECTION 4: Fighter Class & AI (451-1050)
    │   ├── Fighter class constructor
    │   ├── updatePlayerAI() - Player hero behavior
    │   ├── updateEnemyAI() - Enemy behavior
    │   ├── updateZephyrAI() - Healer behavior
    │   ├── moveAndAttack() - Movement & combat logic
    │   ├── shoot() - Ranged attacks
    │   ├── takeDamage() - Damage handling
    │   └── die() - Death & respawn logic
    │
    ├── SECTION 5: Archetypes & Weapons (1051-1098)
    │   ├── ARCHETYPES array (64 builds)
    │   └── STATUS_VISUALS object
    │
    ├── SECTION 6: Palette & Seed Generation (1099-1150)
    │   ├── hashUsername() - Seed generation
    │   ├── getArchetypeForUser() - Map seed to build
    │   └── getPlayerData() - Fetch/create player data
    │
    ├── SECTION 7: Projectile Class (1151-1280)
    │   ├── Projectile class
    │   └── Collision detection
    │
    ├── SECTION 8: ASCII Rules & Display (1281-1320)
    │   └── Helper functions for text rendering
    │
    ├── SECTION 9: Memory & Cleanup (1321-1520)
    │   ├── spawnPlayer() - Create player hero
    │   ├── spawnAIEnemy() - Create AI enemy
    │   ├── spawnBoss() - Create boss
    │   ├── spawnAmmo() - Create ammo pickup
    │   ├── spawnZephyr() - Create healer
    │   ├── updateKOTHZone() - KOTH management
    │   ├── updateLeaderboard() - UI updates
    │   └── Cleanup functions
    │
    └── SECTION 10: Game Loop & Init (1521-1708)
        ├── gameLoop() - Main update loop (60 FPS)
        ├── checkZephyrRespawn() - Healer respawn logic
        ├── TEST_MODE block - Debug spawns
        └── initializeGame() - Startup
```

### Key Files

| File | Description | Size |
|------|-------------|------|
| `Index.html` | Complete game (HTML + CSS + JS) | ~1,708 lines |
| `README.md` | This documentation | You're reading it! |

---

## 🐛 Troubleshooting

### Game doesn't load in OBS

**Solution:**
1. Check "Local file" checkbox in browser source
2. Ensure file path is correct
3. Right-click source → Refresh
4. Check browser console (right-click → Interact → F12)

### No heroes spawning from chat

**Checklist:**
- [ ] `SOCKET_TOKEN` is filled in (not empty string)
- [ ] Token is correct (no extra spaces)
- [ ] `TEST_MODE` is set to `false`
- [ ] Streamlabs is connected to your Twitch account
- [ ] Chat messages are appearing in Streamlabs dashboard
- [ ] Browser source is refreshed after config changes

**Debug Steps:**
1. Open browser source → Interact
2. Press F12 to open console
3. Look for errors or connection messages
4. Should see: `[STREAMLABS] Attempting connection...`
5. Then: `[STREAMLABS] Connected!`

### Entities stay in center of screen

**Check:**
- `CENTER_AVOID_RADIUS` should be 350 (line ~264)
- `CENTER_FADE_START` should be 450
- Look for console errors in center-avoidance logic

### Performance issues (lag/stuttering)

**Solutions:**
1. Reduce `AI_SPAWN_INTERVAL` (spawn fewer enemies)
2. Lower OBS browser source FPS to 30
3. Close other browser tabs
4. Ensure GPU acceleration is enabled in OBS

### Streamlabs events not triggering

**Check:**
1. Token is for **Socket API** (not just API Key)
2. Streamlabs alert widget is enabled
3. Test with a test donation/alert
4. Check console for WebSocket errors

---

## ❓ FAQ

### Q: Can I customize the colors/styles?

**A:** Yes! Edit the CSS section (lines 7-200) in `Index.html`:
```css
/* Example: Change leaderboard color */
#leaderboard {
  background: rgba(0,0,0,0.85);  /* Change this */
  border: 2px solid #333;        /* And this */
}
```

### Q: How do I add more archetypes?

**A:** Edit the `ARCHETYPES` array (line ~1030). You can have up to 64 total:
```javascript
const ARCHETYPES = [
  // Add new archetype
  { ascii: 'M', hp: 25, atk: 18, spd: 32, projectile: '◊', melee: '♠', 
    color: '#f0f', icon: '♠', status: 'fire', chance: 0.35, 
    behavior: 'greedy', ammo: 17 },
  // ... rest
];
```

### Q: Can I use this without Streamlabs?

**A:** Yes! Set `TEST_MODE: true` and it will work offline with test spawns. For production without Streamlabs, you'd need to modify the spawn logic to use a different chat API (Twitch IRC, YouTube API, etc.).

### Q: How do I change the respawn cooldown?

**A:** Edit line ~1065:
```javascript
const PLAYER_RESPAWN_COOLDOWN = 10 * 60 * 1000; // 10 minutes in ms
// Change to: 5 * 60 * 1000 for 5 minutes
```

### Q: Can viewers control their heroes?

**A:** No, heroes are AI-controlled. This keeps the game lightweight and prevents cheating. Viewers can only spawn heroes by chatting.

### Q: What resolution does this support?

**A:** Designed for **1920x1080** (standard Full HD). Other resolutions may work but layout might need adjustment. Edit `GameState.width` and `GameState.height` for custom sizes.

### Q: How do I disable the center fade effect?

**A:** Set these to very large numbers in CONFIG:
```javascript
CENTER_FADE_START: 9999,
CENTER_FADE_END: 9999,
```

### Q: Can I add custom weapons or status effects?

**A:** Yes! 
1. Add new status to `STATUS_VISUALS` (line ~1068)
2. Add effect logic in `Fighter.update()` (line ~650)
3. Assign to archetypes in `ARCHETYPES` array

---

## 📄 License

This project is released under the **MIT License**. Feel free to modify and use for your streams!

```
MIT License - Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software to use, modify, and distribute with attribution.
```

---

## 🙏 Credits

- **ASCII Art**: Community-sourced symbols
- **Concept**: Battle Royale meets Twitch chat
- **Development**: Created for lightweight stream integration
- **Special Thanks**: To all viewers who test and provide feedback!

---

## 📞 Support

**Issues?** Open an issue on GitHub or check:
- Streamlabs documentation: https://dev.streamlabs.com/
- OBS forums: https://obsproject.com/forum/

**Have fun and happy streaming!** 🎮🔥

---

## 🔄 Changelog

### v2.0 (Current)
- Added variable opacity fade for center stream area
- Implemented radial push force from center
- Added dual weapons (ranged + melee)
- Reduced HP/increased ATK for lethal 1-2 shot combat
- Added starting ammo (14-27 based on archetype)
- Implemented 10-minute player respawn cooldown
- Added point-focused AI behavior (KOTH priority)
- Enhanced status effect visuals
- Added center zone indicator overlay

### v1.0 (Legacy)
- Initial release
- Basic chat integration
- Simple combat system
- KOTH zone
- Leaderboard
