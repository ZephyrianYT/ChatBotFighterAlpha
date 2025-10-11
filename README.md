# ASCII Battle Royale - Stream Overlay

> **Lightweight PvP battle game for Twitch/YouTube streams**  
> Viewers chat to spawn heroes • Fast 1-2 shot combat • 64 unique builds

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
- Heroes spawn automatically
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
✅ **Lethal Combat** - 1-2 shot kills (17-38 HP, 12-23 ATK)  
✅ **Dual Weapons** - Ranged + melee per hero  
✅ **Status Effects** - Fire, Ice, Poison, Lightning, Stun, Slow  
✅ **KOTH Zone** - King of the Hill for points  
✅ **Leaderboard** - Top 10 by points  
✅ **Stream-Safe** - Center fades for gameplay visibility  
✅ **Event Spawns** - Follows/Subs/Bits spawn bosses  
✅ **Auto-Balance** - Health decay prevents screen overflow

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

**Common Tweaks:**
- **Faster cooldowns:** Line ~1065: Change `10 * 60 * 1000` to `5 * 60 * 1000`
- **More points:** Line ~276: Change `KOTH_POINTS_PER_SEC: 3` to higher value
- **Less enemies:** Line ~274: Increase `AI_SPAWN_INTERVAL` to 30000 or 40000
- **Bigger clear zone:** Line ~279: Increase `CENTER_AVOID_RADIUS` to 500+

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
4. Should see Streamlabs connection status

### Game Not Loading

**Solutions:**
1. Check "Local file" checkbox in OBS browser source
2. Verify file path is correct
3. Right-click source → **Refresh**
4. Check console for errors (F12)

### Entities Stay in Center

**Fix:**
- Verify `CENTER_AVOID_RADIUS: 350` (line ~279)
- Check console for errors
- Make sure fade values are correct

### Performance Issues

**Solutions:**
1. Lower FPS in OBS browser source (30 FPS)
2. Increase `AI_SPAWN_INTERVAL` (fewer enemies)
3. Close other programs
4. Enable GPU acceleration in OBS

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

### Status Effects

| Effect | Symbol | Description |
|--------|--------|-------------|
| Fire | ♨ | 0.18 HP/sec burn |
| Ice | ❄ | 30% slow |
| Poison | ☠ | 0.12 HP/sec + flee |
| Shock | ⚡ | 0.08 HP/sec |
| Stun | ◘ | Brief disable |
| Slow | ◔ | 20% slow |

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
- ✅ No penalties
- ✅ Characters retreat here

### Seed-Based Builds

Every username generates a unique hero:

```
Username → Hash → Seed (0-63) → Archetype
                                     ↓
                  ┌──────────────────┴──────────────────┐
                  │ HP: 17-38                           │
                  │ Attack: 12-23                       │
                  │ Speed: 18-45                        │
                  │ Ammo: 14-27                         │
                  │ Weapon: Unique projectile + melee   │
                  │ Status: Fire/Ice/Poison/etc.        │
                  │ Color: Unique                       │
                  └─────────────────────────────────────┘
```

**64 total builds** across Fire, Ice, Poison, Lightning, Earth, Wind, Holy

---

## 📂 File Structure

```
ascii-battle-royale/
├── Index.html       (Complete game - 1,796 lines, all-in-one)
└── README.md        (This file)
```

**That's it!** Single HTML file for easy deployment.

---

## 🔧 Customization Examples

### Change Archetype Stats

Find `ARCHETYPES` array (line ~1138):

```javascript
const ARCHETYPES = [
  // Fire build (seed 0)
  { ascii: 'X', hp: 25, atk: 15, spd: 30, 
    projectile: '-', melee: '†', color: '#f88', 
    status: 'fire', chance: 0.3, ammo: 18 },
  // Edit values here ↑
];
```

### Change Colors

Find CSS section (line ~31):

```css
#leaderboard {
  background: rgba(0,0,0,0.85);  /* Change background */
  border: 2px solid #333;        /* Change border */
}
```

### Add Custom Event

Find `handleStreamlabsEvent()` (line ~399):

```javascript
if (eventType === 'custom_event') {
  spawnBoss();
  showFloatingText(960, 540, 'CUSTOM!', '#f0f');
}
```

---

## ❓ FAQ

**Q: Can I use this without Streamlabs?**  
A: Yes! Keep `TEST_MODE: true` and it runs offline with test spawns. For production without Streamlabs, you'd need to add Twitch IRC or YouTube Chat API.

**Q: Can viewers control their heroes?**  
A: No, all heroes are AI-controlled. This keeps it simple and prevents cheating.

**Q: What resolution does this support?**  
A: Designed for 1920x1080 (Full HD). Other resolutions may need CSS adjustments.

**Q: How do I add more builds?**  
A: Edit `ARCHETYPES` array. Max 64 builds (0-63 seed range).

**Q: Can I disable the center fade?**  
A: Yes, set `CENTER_FADE_START` and `CENTER_FADE_END` to 9999.

**Q: Does this work with YouTube?**  
A: Yes! Streamlabs connects to YouTube. Just link your YouTube account in Streamlabs dashboard.

**Q: How much CPU/GPU does it use?**  
A: Very lightweight. Health decay limits entities on screen. If needed, lower FPS to 30 or increase `AI_SPAWN_INTERVAL`.

**Q: Can I modify and redistribute?**  
A: Yes! MIT License. Modify freely, just keep attribution.

---

## 🔒 Security Notes

**Safe Practices:**
- All user input is sanitized (no XSS)
- No `innerHTML` with user data
- `textContent` used for all dynamic text
- Usernames limited to 20 characters

**Token Security:**
- Never share your `SOCKET_TOKEN`
- Don't commit it to public repositories
- Regenerate if exposed

---

## 📊 Code Organization

The game is organized into **10 logical sections**:

1. **Config & Credentials** (line ~248) - Streamlabs token and settings
2. **Game State** (line ~294) - Central data structures
3. **Streamlabs Integration** (line ~334) - WebSocket connection and events
4. **Fighter Class** (line ~501) - Main entity with AI and combat
5. **Archetypes** (line ~1116) - 64 unique character builds
6. **Seed Generation** (line ~1186) - Username hashing
7. **Projectiles** (line ~1271) - Ranged attacks
8. **Utilities** (line ~1381) - Helper functions
9. **Spawn & Management** (line ~1405) - Entity creation and KOTH
10. **Game Loop** (line ~1616) - Main update cycle (60 FPS)

Each section has clear headers with `╔═══╗` borders and documentation.

---

## 📄 License

**MIT License** - Free to use, modify, and distribute with attribution.

---

## 🚀 Quick Reference

| Action | How To |
|--------|--------|
| **Setup** | Get token → Paste in line 263 → Add to OBS |
| **Test** | Keep `TEST_MODE: true` |
| **Production** | Set `TEST_MODE: false` |
| **Customize** | Edit `CONFIG` object (line 260+) |
| **Debug** | Right-click source → Interact → F12 console |
| **Refresh** | Right-click source → Refresh |
| **Fix lag** | Lower FPS or increase spawn interval |
| **More points** | Increase `KOTH_POINTS_PER_SEC` |
| **Bigger clear zone** | Increase `CENTER_AVOID_RADIUS` |

---

## 📞 Support

**Issues?**
1. Check console (F12) for errors
2. Verify token is correct
3. Ensure `TEST_MODE: false` for production
4. Refresh OBS source after changes
5. Check Streamlabs dashboard shows stream as live

**Resources:**
- Streamlabs API: https://dev.streamlabs.com/
- OBS Forums: https://obsproject.com/forum/
- WebSocket Docs: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

---

## 🎉 You're Ready!

**Checklist:**
- [ ] Got Streamlabs token
- [ ] Pasted token in `Index.html` line 263
- [ ] Added browser source to OBS (1920x1080)
- [ ] Tested with `TEST_MODE: true`
- [ ] Set `TEST_MODE: false` for production
- [ ] Refreshed OBS source
- [ ] Verified "Connected!" in console

**All checked?** Go live and watch your viewers battle! 🎮🔥

---

**Version 2.0** • Single-file overlay • Lethal combat • Stream-safe • Point-focused

*Happy Streaming!* ✨
