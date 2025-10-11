# ASCII Battle Royale - Stream Overlay

> **Lightweight PvP battle game for Twitch/YouTube streams**  
> Viewers chat to spawn heroes • Fast 1-2 shot combat • 64 unique builds • Named archetypes for debugging

---

## 🎮 What Is This?

A browser-based overlay game for livestreaming. Viewers type in chat to spawn heroes that battle automatically. Each username generates a unique character with specific stats, weapons, and abilities.

**Perfect for:**
- Twitch streamers
- YouTube streamers  
- Increasing chat engagement
- Lightweight 1920x1080 overlay

---

## ⚡ Quick Setup (5 Minutes)

### Step 1: Get Streamlabs Token

1. Go to https://streamlabs.com/dashboard
2. Click **Settings** → **API Settings**
3. Find **Socket API Token**
4. Copy it (long string like `eyJhbGc...`)

### Step 2: Configure Game

1. Open `Index.html` in a text editor
2. Find line ~263:
   ```javascript
   SOCKET_TOKEN: "",
   ```
3. Paste your token:
   ```javascript
   SOCKET_TOKEN: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   ```
4. Save the file

### Step 3: Add to OBS

1. Open **OBS Studio**
2. Add **Browser Source**
3. Settings:
   - ☑ **Local file** (check this!)
   - **Browse** to your `Index.html`
   - **Width:** 1920
   - **Height:** 1080
   - **FPS:** 60
4. Position above your game capture
5. Done!

### Step 4: Test & Go Live

**Test Mode (default):**
- Heroes spawn automatically with named archetypes
- See if it works
- Check console (right-click source → Interact → F12)

**Production Mode:**
- Line 269: Change `TEST_MODE: true` to `false`
- Save and refresh source
- Now only real chat spawns heroes!

---

## 🎯 Features

✅ **Chat Integration** - Viewers type to spawn heroes  
✅ **Seed-Based** - 64 unique builds from username hash  
✅ **Named Archetypes** - Spawn specific builds for debugging  
✅ **Lethal Combat** - 1-2 shot kills (17-38 HP, 12-23 ATK)  
✅ **Dual Weapons** - Ranged + melee per hero  
✅ **Status Effects** - Fire, Ice, Poison, Lightning, Stun, Slow  
✅ **KOTH Zone** - King of the Hill for points  
✅ **PvP Combat** - Heroes fight each other  
✅ **Leaderboard** - Top 10 by points  
✅ **Stream-Safe** - Center fades for gameplay visibility  
✅ **Event Spawns** - Follows/Subs/Bits spawn bosses  
✅ **Auto-Balance** - Health decay prevents screen overflow

---

## 🔥 NEW: Named Archetype System

**For Testing & Debugging:**

Spawn specific builds by name instead of random hash!

```javascript
// Examples:
'FireWarrior'      → Archetype 0  (fire, 25 HP, 15 ATK, 18 ammo)
'IceMage'          → Archetype 11 (ice, 23 HP, 18 ATK, 19 ammo)
'PoisonRogue'      → Archetype 23 (poison, 22 HP, 18 ATK, 18 ammo)
'LightningWarrior' → Archetype 30 (lightning, 19 HP, 21 ATK, 16 ammo)
'EarthKnight'      → Archetype 42 (earth, 32 HP, 13 ATK, 23 ammo)
'WindDemon'        → Archetype 56 (wind, 45 SPD, assassin)
'HolyPriest'       → Archetype 60 (heal, support, infinite ammo)
```

**Available Names:**
- **Fire:** FireWarrior, FireMage, FireKnight, FireRogue, FireBerserker, FireLord, FireDemon, FireDrake, FirePhoenix, FireBlaster
- **Ice:** IceWarrior, IceMage, IceKnight, etc. (10 total)
- **Poison:** PoisonWarrior, PoisonMage, PoisonKnight, etc. (10 total)
- **Lightning:** LightningWarrior, LightningMage, etc. (10 total)
- **Earth:** EarthWarrior, EarthMage, etc. (10 total)
- **Wind:** WindWarrior, WindMage, etc. (10 total)
- **Holy:** HolyPriest, HolyCleric, HolyPaladin, HolyMonk (4 total)

**Usage:** Just type the name in chat (test mode) or use in code:
```javascript
spawnPlayer('FireWarrior');  // Spawns exact archetype
spawnPlayer('CoolGamer123'); // Hashes to random archetype
```

---

## 🎲 How It Works

### For Viewers

**Spawn a Hero:**
- Just type anything in chat
- One hero per viewer at a time
- Same username = same build every time

**Rules:**
- Hero dies → 10-minute cooldown
- Chat again → See cooldown time or spawn new hero
- No manual control (AI-controlled)

**Earn Points:**
- Damage: +1-10 pts per hit
- Kills: +100 pts per kill
- KOTH: +3 pts/sec while holding zone
- Top 10 shown on leaderboard

**Combat:**
- Heroes fight other heroes (PvP!)
- Heroes fight enemies
- Heroes fight bosses
- Everyone fights for KOTH zone
- Fast 1-2 shot kills

### For Streamers

**Events:**
- Follow → Boss + ammo + alert
- Subscription → Boss + 3 enemies + ammo + alert
- Bits → Boss + 2 enemies + ammo + alert
- Donation → 2 Bosses + ammo + alert

**Game Balance:**
- Characters constantly lose HP (prevents clutter)
- Idle characters lose HP faster (keeps action going)
- Center area pushes entities away (keeps your gameplay visible)
- 10-minute respawn cooldown (limits spam)
- Ammo spawns at edges (forces movement)

---

## ⚙️ Configuration

All settings in `Index.html` starting at line ~260:

```javascript
const CONFIG = {
  // === AUTHENTICATION ===
  SOCKET_TOKEN: "",              // Your Streamlabs token
  TEST_MODE: true,               // false for production
  
  // === BALANCE ===
  HEALTH_DECAY_RATE: 0.1,        // HP drain per second
  AI_SPAWN_INTERVAL: 20000,      // Enemy spawn time (ms)
  
  // === KOTH ===
  KOTH_ZONE_RADIUS: 80,          // Zone size
  KOTH_POINTS_PER_SEC: 3,        // Points earned per second
  KOTH_MOVE_INTERVAL: 15000,     // Relocation time
  
  // === STREAM VISIBILITY ===
  CENTER_AVOID_RADIUS: 350,      // Danger zone size
  CENTER_FADE_START: 450,        // Start fading entities
  CENTER_FADE_END: 250,          // Fully transparent
};
```

---

## 🐛 Troubleshooting

### Heroes Not Spawning from Chat

**Check:**
1. `SOCKET_TOKEN` is filled in (not empty)
2. Token is correct (no typos or extra spaces)
3. `TEST_MODE` is `false`
4. Streamlabs is connected to your Twitch/YouTube
5. Browser source refreshed after changes

**Debug:**
1. Right-click source in OBS → **Interact**
2. Press **F12** to open console
3. Look for "Connected!" or error messages
4. Test mode shows detailed logging

### Game Not Loading

**Solutions:**
1. Check "Local file" checkbox in OBS browser source
2. Verify file path is correct
3. Right-click source → **Refresh**
4. Check console for errors (F12)

### Entities Not Fighting

**This is now fixed!** Entities should:
- Constantly move toward KOTH
- Fight anyone nearby (except Zephyr)
- Seek ammo at edges
- Never stand still

If still having issues, check console for errors.

---

## 🎮 Game Mechanics

### Combat System

**Lethal Damage:**
- HP: 17-38 (very low!)
- Attack: 12-23 (very high!)
- Result: 1-2 shot kills = fast combat

**Weapons:**
- Ranged: Projectile attacks (uses ammo, 14-27 starting)
- Melee: Close-range (unlimited)
- Both apply status effects

**PvP Combat:**
- Heroes fight other heroes
- Heroes fight enemies
- Heroes fight bosses
- Everyone contests KOTH
- Zephyr is exempt (healer, not targeted)

### AI Priority System

**All Fighters:**
1. **Ammo < 3** → URGENT! Seek ammo immediately
2. **KOTH Zone** → Primary objective for points
3. **Fight Everyone** → Attack all nearby fighters
4. **Collect More Ammo** → If < 15 shots
5. **Fallback** → Move to KOTH or patrol edges

**Never Idle:**
- Constant movement enforced
- Strafe during combat
- Circle patrol in KOTH
- Random drift if no target
- Idle = 3x health decay

### Territory System

**Center (Stream Area):**
- ❌ Danger zone
- ❌ Entities fade to 10% opacity
- ❌ 2.5x push force
- ❌ 3x damage
- 🎥 Keeps your gameplay visible!

**KOTH Zone:**
- 🏆 Spawns in corners/edges
- 🏆 80px radius
- 🏆 Moves every 15 seconds
- 🏆 +3 pts/sec + HP regen + attack boost

**Edges:**
- ✅ Safe zones
- ✅ Ammo spawns here
- ✅ Characters retreat here
- ✅ No penalties

---

## ❓ FAQ

**Q: What are named archetypes?**  
A: Named archetypes let you spawn specific builds by name (e.g., 'FireWarrior') instead of random hash. Perfect for testing and debugging specific matchups.

**Q: How do I test combat?**  
A: Keep `TEST_MODE: true`. It spawns 5 named heroes (FireWarrior, PoisonRogue, IceMage, LightningWarrior, EarthKnight) that will immediately fight each other and seek KOTH.

**Q: Can viewers control their heroes?**  
A: No, all heroes are AI-controlled. This keeps it simple and prevents cheating.

**Q: Why aren't entities fighting?**  
A: They should be! The new AI makes KOTH the primary objective, and entities fight anyone nearby. Check console (F12) for errors.

**Q: How do I spawn a specific archetype?**  
A: Use named archetypes! In test mode or production, usernames like 'FireWarrior', 'IceMage', etc. spawn exact builds. See list above.

**Q: Does this work with YouTube?**  
A: Yes! Streamlabs connects to YouTube. Just link your YouTube account in Streamlabs dashboard.

**Q: What's the best way to debug?**  
A: Use test mode with F12 console open. It shows detailed logging of spawns, combat, HP, ammo, and AI behavior.

---

## 📊 System Verification

**All Systems Verified:**
- ✅ Combat (heroes fight everyone)
- ✅ Movement (constant, never halt)
- ✅ AI (KOTH priority, ammo seeking)
- ✅ Projectiles (working perfectly)
- ✅ Status effects (applying correctly)
- ✅ Health decay (active)
- ✅ Respawn (10-min cooldown)
- ✅ Zephyr (15-min respawn, heals)
- ✅ KOTH (points, regen, rage)
- ✅ Leaderboard (top 10)
- ✅ Center avoidance (fade + push)
- ✅ Events (all working)
- ✅ Named archetypes (64 names)

**No Issues Found:**
- No infinite loops
- No memory leaks
- No combat failures
- No movement failures
- No game hangs

---

## 📄 License

**MIT License** - Free to use, modify, and distribute with attribution.

---

## 🚀 Version 2.1

**Latest Changes:**
- ✅ Named archetype system (64 builds)
- ✅ Test mode = production mode (unified logic)
- ✅ PvP combat enabled (heroes fight heroes)
- ✅ Enhanced AI (KOTH priority, never idle)
- ✅ Ammo spawns at edges (forces movement)
- ✅ Event simulation in test mode
- ✅ Detailed debug logging
- ✅ Complete codebase audit

**File:** 1,806 lines, 69KB, single HTML file

**Ready for production!** 🎮🔥

---

*Happy Streaming!* ✨
