# Quick Setup Guide - ASCII Battle Royale

> **Get your stream overlay running in 5 minutes!**

---

## ⚡ Quick Start (5 Steps)

### Step 1: Get Streamlabs Token (2 min)

1. Go to https://streamlabs.com/dashboard
2. Log in with your Twitch/YouTube account
3. Click **Settings** (gear icon, bottom left)
4. Click **API Settings**
5. Scroll to **Socket API Tokens**
6. Copy your token (long alphanumeric string)

**Example token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6IjEyMzQ1Njc4OTAi...
```

---

### Step 2: Configure Index.html (1 min)

1. Open `Index.html` in **Notepad** or any text editor
2. Find this line (~252):
   ```javascript
   SOCKET_TOKEN: "",
   ```
3. Paste your token between the quotes:
   ```javascript
   SOCKET_TOKEN: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   ```
4. Save the file (Ctrl+S)

---

### Step 3: Add to OBS (1 min)

1. Open **OBS Studio**
2. In your streaming scene, click **+ (Add Source)**
3. Select **Browser**
4. Name it: `Battle Royale`
5. Configure:
   - ☑ **Local file** (CHECK THIS!)
   - **Local File:** Click Browse → Select your `Index.html`
   - **Width:** 1920
   - **Height:** 1080
   - **FPS:** 60
   - ☑ **Refresh browser when scene becomes active**
6. Click **OK**

---

### Step 4: Position Overlay (30 sec)

1. In OBS, **drag** the browser source above your game capture
2. **Resize** to fit your canvas (usually 1920x1080)
3. **Lock** the source (right-click → Lock)

**Layer Order (top to bottom):**
```
1. Battle Royale (Browser Source)  ← On top
2. Camera/Webcam
3. Alerts/Widgets
4. Game Capture                    ← On bottom
```

---

### Step 5: Test It! (30 sec)

**In OBS:**
1. Right-click the browser source → **Interact**
2. You should see:
   - Game container loads
   - Test heroes spawn (if `TEST_MODE: true`)
   - Leaderboard bottom-right
   - Stats panel top-left

**Check Console:**
1. In Interact window, press **F12**
2. Go to **Console** tab
3. Look for:
   ```
   [STREAMLABS] Attempting connection...
   [STREAMLABS] Connected!
   ```

**If you see these messages → YOU'RE DONE!** 🎉

---

## 🔧 Production Setup

Once testing is complete:

### Disable Test Mode

1. Open `Index.html` in text editor
2. Find (~254):
   ```javascript
   TEST_MODE: true,
   ```
3. Change to:
   ```javascript
   TEST_MODE: false,
   ```
4. Save and refresh OBS source (right-click → Refresh)

**Now only real chat messages will spawn heroes!**

---

## 🎮 How Viewers Interact

### Spawning Heroes

**Viewers:** Just type in Twitch chat!
```
CoolViewer123: hey
```
→ Hero spawns with username "CoolViewer123"

**Rules:**
- 1 hero per viewer at a time
- Hero dies → 10-minute cooldown
- Chat during cooldown → See time remaining
- Same username → Same build every time (seed-based)

### Earning Points

**Damage:** +1-10 pts per hit  
**Kills:** +100 pts per kill  
**KOTH:** +3 pts/sec while holding the zone  

**Top 10 shown on leaderboard!**

---

## 📊 Event Integration

Streamlabs events automatically spawn content:

| Event | Effect |
|-------|--------|
| **New Follower** | Boss + 2 ammo + 15s alert |
| **Subscription** | Boss + 3 enemies + 3 ammo + alert |
| **Bits** | Boss + 2 enemies + 2 ammo + alert |
| **Donation** | 2 Bosses + ammo + alert |

**Alerts display center-screen for 15 seconds**

---

## ⚙️ Common Customizations

### Change Respawn Cooldown

Find (~1065):
```javascript
const PLAYER_RESPAWN_COOLDOWN = 10 * 60 * 1000; // 10 minutes
```

Change to 5 minutes:
```javascript
const PLAYER_RESPAWN_COOLDOWN = 5 * 60 * 1000; // 5 minutes
```

### Adjust Center Avoidance

Find (~264):
```javascript
CENTER_AVOID_RADIUS: 350,      // Danger zone size
CENTER_FADE_START: 450,        // Start fading
CENTER_FADE_END: 250,          // Fully transparent
```

**Larger numbers = bigger clear zone**

### Change KOTH Rewards

Find (~259):
```javascript
KOTH_POINTS_PER_SEC: 3,        // Points per second
KOTH_MOVE_INTERVAL: 15000,     // Move every 15s
```

### Disable Center Fade

Set fade distances very high:
```javascript
CENTER_FADE_START: 9999,
CENTER_FADE_END: 9999,
```

---

## 🐛 Troubleshooting

### No Connection to Streamlabs

**Symptoms:**
- No heroes spawn from chat
- Console shows "WebSocket connection failed"

**Solutions:**
1. ✅ Verify token is correct (no extra spaces)
2. ✅ Check Streamlabs dashboard shows your stream as live
3. ✅ Firewall/antivirus blocking websockets?
4. ✅ Try refreshing browser source
5. ✅ Test with `TEST_MODE: true` first

### Heroes Spawn in Center

**Solution:**
Check `CENTER_AVOID_RADIUS` is set to 350 or higher

### Performance Issues

**Solutions:**
1. Lower FPS in OBS browser source (30 FPS)
2. Increase `AI_SPAWN_INTERVAL` to reduce enemies
3. Close other applications
4. Enable GPU acceleration in OBS

### Game Not Visible

**Checklist:**
- [ ] Browser source is above game capture layer
- [ ] Local file path is correct
- [ ] File is actually named `Index.html` (not `Index.html.txt`)
- [ ] Refreshed source after changes
- [ ] Check if transparency is working (try adding background color in CSS)

---

## 📱 Mobile/Console Streaming

**Not officially supported**, but you can:
1. Host `Index.html` on a web server (GitHub Pages, Netlify, etc.)
2. Use URL instead of local file in OBS
3. Access remotely via Streamlabs Mobile

---

## 🎨 Visual Customization

### Change Colors

Edit CSS (~7-200 in Index.html):

**Leaderboard:**
```css
#leaderboard {
  background: rgba(0,0,0,0.85);  /* Black background */
  border: 2px solid #333;        /* Gray border */
}
```

**KOTH Zone:**
```css
.koth-zone {
  background: radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%);
  border: 2px solid #ffd700;     /* Gold */
}
```

### Change Fonts

Add to CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron&display=swap');

body {
  font-family: 'Orbitron', monospace !important;
}
```

---

## 📈 Analytics & Tracking

**Want to track engagement?**

Add this at end of `handleStreamlabsEvent()` (~350):
```javascript
// Log event to your analytics
console.log('Event:', type, 'User:', message[0].name);
// fetch('your-analytics-endpoint', { method: 'POST', body: ... });
```

---

## 🚀 Advanced Features

### Custom Events

Add your own event handler:

```javascript
// In handleStreamlabsEvent() function (~330)
if (type === 'custom_event') {
  // Your custom logic here
  spawnBoss();
  showFloatingText(960, 540, 'CUSTOM EVENT!', '#f0f');
}
```

### Integration with Other Platforms

**Discord Bot Integration:**
1. Modify spawn functions to accept webhooks
2. Create Discord bot that calls your webhook
3. Discord messages spawn heroes

**YouTube Chat:**
1. Replace Streamlabs logic with YouTube Chat API
2. Poll for new messages
3. Same spawn functions work

---

## 📞 Need Help?

**Common Resources:**
- Streamlabs API Docs: https://dev.streamlabs.com/
- OBS Forums: https://obsproject.com/forum/
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

**Debug Checklist:**
1. [ ] Token is correct
2. [ ] File path is correct  
3. [ ] Browser console shows no errors
4. [ ] Streamlabs connection successful
5. [ ] TEST_MODE works
6. [ ] OBS source is refreshed

**Still stuck?** Open browser console (F12) and copy any error messages.

---

## ✅ Checklist for Going Live

Before your first stream with the overlay:

- [ ] Streamlabs token configured
- [ ] TEST_MODE set to `false`
- [ ] Browser source positioned correctly in OBS
- [ ] Source is above game capture layer
- [ ] Tested with real chat message (ask a friend)
- [ ] Verified heroes spawn from chat
- [ ] Checked leaderboard updates
- [ ] Confirmed center area stays clear
- [ ] Tested event alerts (test donation)
- [ ] Performance is smooth (no lag)

**All checked?** You're ready to go live! 🎉

---

**Happy Streaming!** 🎮🔥
