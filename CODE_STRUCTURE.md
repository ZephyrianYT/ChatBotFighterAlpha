# Code Structure Reference

> **Visual guide to understanding the codebase organization**

---

## 📄 File Overview

```
ascii-battle-royale/
├── Index.html          68KB   1,796 lines   (Complete game - all-in-one)
├── README.md           16KB     540 lines   (Full documentation)
├── SETUP_GUIDE.md       8KB     364 lines   (Quick start guide)
└── CODE_STRUCTURE.md    ---      ---        (This file)
```

**Total:** Single-file game for easy deployment to OBS!

---

## 🏗️ Index.html Architecture

### High-Level Structure

```
Index.html (1,796 lines)
│
├─ HTML Header (1-30)
│  ├─ Meta tags
│  ├─ Title
│  └─ Feature summary comment
│
├─ CSS Styles (31-206)
│  ├─ Global styles
│  ├─ Entity styles (.fighter, .projectile, .ammo)
│  ├─ HUD styles (#leaderboard, #stats-panel)
│  ├─ KOTH zone styles
│  ├─ Animations (@keyframes)
│  └─ Center zone indicator
│
├─ HTML Body (207-245)
│  ├─ Game container
│  ├─ Center zone overlay
│  ├─ Leaderboard panel
│  ├─ Stats panel
│  └─ Event alert display
│
└─ JavaScript (246-1796) ← MAIN GAME LOGIC
   │
   ├─ SECTION 1: Config & Credentials (246-292)
   ├─ SECTION 2: Game State (293-332)
   ├─ SECTION 3: Streamlabs Integration (333-500)
   ├─ SECTION 4: Fighter Class & AI (501-1114)
   ├─ SECTION 5: Archetypes & Weapons (1115-1185)
   ├─ SECTION 6: Seed Generation (1186-1270)
   ├─ SECTION 7: Projectile Class (1271-1380)
   ├─ SECTION 8: Utility Functions (1381-1404)
   ├─ SECTION 9: Spawn & Management (1405-1615)
   └─ SECTION 10: Game Loop & Init (1616-1796)
```

---

## 📋 Detailed Section Breakdown

### SECTION 1: Configuration (Lines 246-292)

**Purpose:** Central configuration object

```javascript
CONFIG = {
  // Authentication
  SOCKET_TOKEN: ""           // Streamlabs token
  ACCESS_TOKEN: ""           // (unused)
  TEST_MODE: true/false      // Debug vs production
  
  // Balance
  KNOCKBACK_STRENGTH         // Knockback force
  AMMO_LIFETIME              // Pickup despawn time
  HEALTH_DECAY_RATE          // Constant HP drain
  INACTIVE_THRESHOLD         // Entity cleanup time
  AI_SPAWN_INTERVAL          // Enemy spawn rate
  
  // KOTH
  KOTH_ZONE_RADIUS           // Zone size (80px)
  KOTH_POINTS_PER_SEC        // Points earned (3/sec)
  KOTH_MOVE_INTERVAL         // Relocation time (15s)
  
  // Stream Safety
  CENTER_AVOID_X/Y           // Center point (960, 540)
  CENTER_AVOID_RADIUS        // Danger zone (350px)
  CENTER_FADE_START          // Fade begins (450px)
  CENTER_FADE_END            // Fully faded (250px)
  
  // Progression
  XP_CURVE: []               // XP per level (1-10)
}
```

**Key Variables:**
- `SOCKET_TOKEN` ← **YOU MUST FILL THIS!**
- `TEST_MODE` ← Set to `false` for production
- `CENTER_AVOID_RADIUS` ← Adjust for stream visibility

---

### SECTION 2: Game State (Lines 293-332)

**Purpose:** Global state container

```javascript
GameState = {
  // Entity Arrays
  fighters: []               // All fighters (players, enemies, bosses)
  projectiles: []            // All active projectiles
  ammo: []                   // All ammo pickups
  
  // DOM References
  container                  // <div id="game-container">
  width/height               // Screen dimensions (1920x1080)
  
  // Player Tracking
  playerData: {}             // { username: stats }
  playerRespawnTimes: {}     // { username: timestamp }
  chatMessages: []           // Recent chat
  
  // Special Entities
  boss                       // Current boss reference
  zephyr                     // Healer reference
  zephyrRespawnTime          // Healer respawn timer
  kothZone                   // KOTH reference { x, y, lastMove }
  
  // Timers & Stats
  lastAISpawn                // Last enemy spawn time
  lastKOTHMove               // Last KOTH relocation
  stats: { kills }           // Global stats
  lastUpdate                 // Delta time calculation
}
```

**Data Structures:**

```javascript
// Player Data Entry
playerData[username] = {
  username: string,
  archetypeIndex: 0-63,
  level: 1-10,
  xp: number,
  kills: number,
  deaths: number,
  points: number
}

// Fighter Reference
fighters[i] = {
  username, x, y, vx, vy,
  hp, maxHp, attack, speed,
  alive, isEnemy, isBoss,
  ammoCount, personality,
  statusEffects: [],
  // ... many more properties
}

// KOTH Zone
kothZone = {
  x, y,                      // Position
  lastMove,                  // Timestamp
  element                    // DOM reference
}
```

---

### SECTION 3: Streamlabs Integration (Lines 333-500)

**Purpose:** WebSocket connection and event handling

```javascript
// Main Functions:

connectStreamlabs()
├─ Builds WebSocket URL
├─ Creates WebSocket connection
├─ Sets up event listeners:
│  ├─ onopen    → Connection success
│  ├─ onmessage → Route events
│  ├─ onerror   → Log errors
│  └─ onclose   → Reconnect logic
└─ Returns socket

handleStreamlabsEvent(type, message)
├─ Parses event data
├─ Extracts username
├─ Routes by event type:
│  ├─ 'follow'       → Boss + 2 ammo + alert
│  ├─ 'subscription' → Boss + 3 enemies + 3 ammo + alert
│  ├─ 'bits'         → Boss + 2 enemies + 2 ammo + alert
│  ├─ 'donation'     → 2 bosses + ammo + alert
│  └─ 'message'      → Spawn player hero
└─ Shows event alert

showEventAlert(message, color, symbol)
├─ Creates 15-second alert
├─ Center-screen display
├─ Color-coded by event type
└─ Auto-dismisses
```

**Event Flow:**

```
Twitch Chat Message
        ↓
Streamlabs Dashboard
        ↓
Socket API (WebSocket)
        ↓
connectStreamlabs() receives
        ↓
handleStreamlabsEvent() routes
        ↓
spawnPlayer(username) creates hero
        ↓
Fighter appears in game!
```

---

### SECTION 4: Fighter Class (Lines 501-1114)

**Purpose:** Core entity with AI, combat, and status effects

```javascript
class Fighter {
  constructor(username, isEnemy, isBoss)
  ├─ Generate archetype from seed
  ├─ Set stats (HP, ATK, SPD)
  ├─ Assign weapons (ranged + melee)
  ├─ Set personality & behavior
  ├─ Spawn position
  └─ Create DOM element
  
  update(dt)
  ├─ Update position (vx/vy)
  ├─ Check bounds
  ├─ Apply health decay
  ├─ Apply idle penalty
  ├─ Center avoidance push
  ├─ Process status effects
  ├─ Check KOTH zone
  ├─ Route AI behavior
  └─ Update display
  
  updatePlayerAI(dt)
  ├─ Change behavior dynamically
  ├─ PRIORITY 0: Escape center
  ├─ PRIORITY 1: Collect ammo
  ├─ PRIORITY 2: Attack enemies
  ├─ DEFAULT: Move to KOTH
  └─ Call moveAndAttack()
  
  updateEnemyAI(dt)
  ├─ Find nearest target
  ├─ Attack if in range
  ├─ Move to KOTH if no target
  └─ Call moveAndAttack()
  
  updateZephyrAI(dt)
  ├─ Find wounded allies
  ├─ Heal nearby fighters
  ├─ Move to center of action
  └─ Stay near KOTH
  
  moveAndAttack(target)
  ├─ Calculate direction
  ├─ Apply movement speed
  ├─ Check attack range
  ├─ Shoot if ready
  └─ Update velocity
  
  shoot(target)
  ├─ Create projectile
  ├─ Deduct ammo
  └─ Reset cooldown
  
  takeDamage(amount, attacker)
  ├─ Reduce HP
  ├─ Show floating text
  ├─ Award points to attacker
  └─ Die if HP ≤ 0
  
  die(killer)
  ├─ Mark as dead
  ├─ Award killer points
  ├─ Set respawn timer
  ├─ Show death message
  └─ Schedule cleanup
  
  applyStatus(statusType)
  ├─ Add to statusEffects[]
  ├─ Set duration
  ├─ Show status symbol
  └─ Apply visual glow
  
  updateDisplay()
  ├─ Calculate opacity fade
  ├─ Update position
  ├─ Render username
  ├─ Render stats (HP/weapon/ammo)
  ├─ Show status effects
  └─ Update DOM
}
```

**Fighter Properties:**

```javascript
{
  // Identity
  username: string,
  isEnemy: boolean,
  isBoss: boolean,
  
  // Position & Movement
  x, y: number,
  vx, vy: number,
  speed: number,
  
  // Combat Stats
  hp, maxHp: number,
  attack: number,
  level: number,
  
  // Weapons
  projectile: string,        // Ranged symbol
  melee: string,             // Melee symbol
  weaponIcon: string,        // Display icon
  ammoCount: number,
  startingAmmo: number,
  
  // Status
  alive: boolean,
  statusEffects: [],         // Active effects
  statusDurations: [],       // Time remaining
  
  // AI
  personality: string,       // Seed-based
  currentBehavior: string,   // Dynamic
  behaviorTimer: number,
  
  // KOTH
  isRaging: boolean,         // In KOTH zone
  
  // Visual
  color: string,
  ascii: string,             // Character symbol
  element: DOMElement,
  
  // Timers
  lastAttack: number,
  lastMoveTime: number,
  idleTime: number
}
```

---

### SECTION 5: Archetypes (Lines 1115-1185)

**Purpose:** 64 unique builds

```javascript
ARCHETYPES = [
  // Index 0-9: Fire Builds
  { ascii, hp, atk, spd, projectile, melee, 
    color, icon, status: 'fire', chance, behavior, ammo },
  
  // Index 10-19: Ice Builds
  { status: 'ice', ... },
  
  // Index 20-29: Poison Builds (fast)
  { status: 'poison', spd: 36-45, ... },
  
  // Index 30-39: Lightning Builds
  { status: 'shock', ... },
  
  // Index 40-49: Earth Builds (tanky)
  { hp: 30-38, status: 'stun', ... },
  
  // Index 50-59: Wind Builds (fast)
  { status: 'slow', ... },
  
  // Index 60-63: Holy Builds (healers)
  { status: 'heal', ammo: 999, ... }
]

STATUS_VISUALS = {
  fire:   { color, symbol: '♨', glow },
  ice:    { color, symbol: '❄', glow },
  poison: { color, symbol: '☠', glow },
  shock:  { color, symbol: '⚡', glow },
  stun:   { color, symbol: '◘', glow },
  slow:   { color, symbol: '◔', glow },
  heal:   { color, symbol: '♥', glow }
}
```

**Build Distribution:**

```
Fire      (0-9)   →  10 builds  →  Burn damage
Ice      (10-19)  →  10 builds  →  Slow effect
Poison   (20-29)  →  10 builds  →  DoT + flee
Lightning(30-39)  →  10 builds  →  Fast attacks
Earth    (40-49)  →  10 builds  →  Stun + tanky
Wind     (50-59)  →  10 builds  →  Speed + slow
Holy     (60-63)  →   4 builds  →  Heals
                     ─────────
                      64 total
```

---

### SECTION 6: Seed Generation (Lines 1186-1270)

**Purpose:** Username hashing and player data

```javascript
hashUsername(username)
├─ Simple hash algorithm
├─ Left shift and XOR
├─ Returns absolute value
└─ Used for seed generation

getArchetypeForUser(username)
├─ Hash username
├─ Modulo 64
└─ Return archetype index

getArchetypeData(index)
├─ Bounds check (0-63)
└─ Return ARCHETYPES[index]

getPlayerData(username)
├─ Check if exists in GameState.playerData
├─ If not, create new entry:
│  ├─ Get archetype index
│  ├─ Initialize stats (level 1, 0 XP, 0 kills)
│  └─ Store in GameState.playerData
└─ Return player data object
```

**Seed Flow:**

```
Username: "CoolGamer123"
        ↓
hashUsername()
        ↓
Hash: 8472619347
        ↓
Modulo 64
        ↓
Seed: 35 (Lightning build)
        ↓
ARCHETYPES[35]
        ↓
{
  ascii: '⚡',
  hp: 17,
  atk: 23,
  spd: 38,
  projectile: '¦',
  melee: '※',
  status: 'shock',
  ammo: 15
}
```

---

### SECTION 7: Projectiles (Lines 1271-1380)

**Purpose:** Ranged attack handling

```javascript
class Projectile {
  constructor(owner, target)
  ├─ Inherit owner's stats
  ├─ Calculate velocity vector
  ├─ Set lifetime (4.5s)
  └─ Create DOM element
  
  update(dt)
  ├─ Move projectile
  ├─ Apply center fade
  ├─ Check lifetime
  ├─ Collision detection:
  │  ├─ Loop through fighters
  │  ├─ Check distance < 20px
  │  ├─ Apply damage
  │  ├─ Apply status effect
  │  └─ Destroy projectile
  └─ Check bounds
  
  destroy()
  ├─ Remove from GameState.projectiles
  └─ Remove DOM element
}
```

**Collision Detection:**

```javascript
// Simple distance-based
for each fighter:
  if distance(projectile, fighter) < 20:
    if not same team:
      fighter.takeDamage(damage, owner)
      if random < statusChance:
        fighter.applyStatus(statusType)
      projectile.destroy()
      break
```

---

### SECTION 8: Utilities (Lines 1381-1404)

**Purpose:** Helper functions

```javascript
showFloatingText(x, y, text, color)
├─ Create temporary div
├─ Position at (x, y)
├─ Animate upward
├─ Fade out
└─ Auto-remove after 1.2s

distance(x1, y1, x2, y2)
└─ Pythagorean theorem

isZephyr(username)
└─ Check if username is "Zephyr"

// Used for:
// - Damage numbers
// - "+100 POINTS!"
// - "LEVEL UP!"
// - "MOVE!" warnings
// - Status effect symbols
```

---

### SECTION 9: Spawning & Management (Lines 1405-1615)

**Purpose:** Entity lifecycle

```javascript
spawnPlayer(username)
├─ Check if already alive → Heal instead
├─ Check respawn cooldown → Show remaining time
├─ Create new Fighter(username, false, false)
├─ Add to GameState.fighters
└─ Show spawn message

spawnAIEnemy()
├─ Create Fighter('AI_' + timestamp, true, false)
├─ Add to GameState.fighters
└─ Spawn from top edge

spawnBoss()
├─ Create Fighter('BOSS_' + timestamp, true, true)
├─ 5x HP, 3x ATK
├─ Spawn at random edge
└─ Add to GameState.fighters

spawnAmmo(username, message, edgeSpawn)
├─ Extract word from message
├─ Create ammo pickup at edge or random
├─ Add to GameState.ammo
└─ Set 25-second lifetime

spawnZephyr()
├─ Check respawn cooldown
├─ Create Fighter('Zephyr', false, false)
├─ Set GameState.zephyr reference
└─ Clear respawn timer

updateKOTHZone()
├─ Create if doesn't exist
├─ Move every 15 seconds to outer zones
├─ Award points to fighters inside (3/sec)
├─ Apply HP regen to fighters inside
└─ Update visual element

updateLeaderboard()
├─ Get all player data
├─ Sort by points (descending)
├─ Take top 10
├─ Create DOM elements
└─ Update display

cleanupOldEntities()
├─ Remove dead fighters (after 1s fade)
├─ Remove old ammo (after 25s)
├─ Remove stuck projectiles
└─ Free memory
```

---

### SECTION 10: Game Loop (Lines 1616-1796)

**Purpose:** Main update cycle

```javascript
gameLoop()
├─ Calculate delta time (dt)
├─ Update all fighters
│  ├─ fighter.update(dt)
│  ├─ AI decision making
│  ├─ Combat checks
│  └─ Status effect ticks
├─ Update all projectiles
│  ├─ projectile.update(dt)
│  └─ Collision detection
├─ Update ammo pickups
│  └─ Collection checks
├─ Update KOTH zone
│  ├─ Points awards
│  └─ Relocation timer
├─ Update leaderboard (every 2.5s)
├─ Check Zephyr respawn
├─ Spawn AI enemies (every 20s)
├─ Cleanup old entities
└─ requestAnimationFrame(gameLoop)

checkZephyrRespawn()
├─ Check if respawn time reached
├─ Call spawnZephyr()
└─ Clear timer

initializeTestMode()
├─ Spawn HeroLeft (Fire, seed 0)
├─ Spawn HeroRight (Poison, seed 20)
├─ Spawn Zephyr
├─ Spawn test ammo
└─ Set testInitialized flag

spawnTestEnemies()
└─ Spawn 1 enemy from top

// TEST_MODE block
if (CONFIG.TEST_MODE):
  setTimeout(initializeTestMode, 2000)
  setInterval(spawnTestEnemies, 10000)
  setInterval(testFollowerEvent, 30000)
```

**Game Loop Diagram:**

```
         ┌─────────────────────────────────────┐
         │                                     │
         │     requestAnimationFrame()         │
         │              (60 FPS)               │
         │                                     │
         └──────────────┬──────────────────────┘
                        │
                        ↓
              ┌─────────────────────┐
              │   Calculate dt      │
              │   (delta time)      │
              └─────────┬───────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ↓                             ↓
┌─────────────────┐           ┌─────────────────┐
│ Update Fighters │           │Update Projectiles│
│  • AI logic     │           │  • Movement      │
│  • Movement     │           │  • Collision     │
│  • Combat       │           │  • Status apply  │
│  • Status ticks │           └─────────────────┘
└────────┬────────┘                    │
         │                             │
         └──────────────┬──────────────┘
                        │
                        ↓
              ┌─────────────────────┐
              │   Update Ammo       │
              │   • Collection      │
              └─────────┬───────────┘
                        │
                        ↓
              ┌─────────────────────┐
              │   Update KOTH       │
              │   • Award points    │
              │   • Relocation      │
              └─────────┬───────────┘
                        │
                        ↓
              ┌─────────────────────┐
              │  Update UI          │
              │  • Leaderboard      │
              │  • Stats            │
              └─────────┬───────────┘
                        │
                        ↓
              ┌─────────────────────┐
              │  Cleanup            │
              │  • Old entities     │
              │  • Memory           │
              └─────────┬───────────┘
                        │
                        ↓
              ┌─────────────────────┐
              │  Loop back          │
              │  (next frame)       │
              └─────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Player Spawn Flow

```
Viewer types in chat
        ↓
Twitch → Streamlabs
        ↓
WebSocket event
        ↓
handleStreamlabsEvent('message')
        ↓
Extract username
        ↓
spawnPlayer(username)
        ↓
getPlayerData(username)
        ↓
hashUsername() → seed (0-63)
        ↓
getArchetypeData(seed)
        ↓
new Fighter(username, stats)
        ↓
Fighter added to GameState.fighters
        ↓
createElement() → DOM element created
        ↓
Fighter appears on screen!
        ↓
updatePlayerAI() runs every frame
```

### Combat Flow

```
Fighter A sees Fighter B
        ↓
updatePlayerAI() → target = Fighter B
        ↓
moveAndAttack(Fighter B)
        ↓
distance < 300px?
        ↓ Yes
shoot(Fighter B)
        ↓
new Projectile(Fighter A, Fighter B)
        ↓
Projectile moves toward target
        ↓
projectile.update() each frame
        ↓
Collision check: distance < 20px?
        ↓ Yes
Fighter B.takeDamage(damage, Fighter A)
        ↓
Fighter B.hp -= damage
        ↓
Random < statusChance?
        ↓ Yes
Fighter B.applyStatus('fire')
        ↓
Fighter B.statusEffects.push('fire')
        ↓
Fighter B shows ♨ symbol
        ↓
Fighter B takes 0.18 HP/sec for 3 seconds
        ↓
Fighter B.hp <= 0?
        ↓ Yes
Fighter B.die(Fighter A)
        ↓
Fighter A awarded +100 points
        ↓
Fighter B fades out
        ↓
10-minute cooldown starts
```

### KOTH Point Flow

```
Fighter enters KOTH zone
        ↓
updateKOTHZone() checks distance
        ↓
distance <= 80px?
        ↓ Yes
Fighter.isRaging = true
        ↓
Every frame (60 FPS):
  ├─ Award +0.05 points (= 3 pts/sec)
  ├─ Apply +0.05 HP regen
  └─ 50% faster attack speed
        ↓
Fighter leaves KOTH zone
        ↓
Fighter.isRaging = false
        ↓
Bonuses removed
```

---

## 🎯 Key Algorithms

### Center Avoidance Algorithm

```javascript
// Every frame for each fighter:

1. Calculate distance to center (960, 540)
2. If distance < 350px (DANGER ZONE):
   a. Calculate push strength: (350 - distance) / 350
   b. Calculate direction vector: (fighter.x - 960, fighter.y - 540)
   c. Normalize direction
   d. Apply radial push force: vx += dx * push * 2.5
   e. Apply extra damage: hp -= decay * push * 3
3. If distance < 450px (FADE ZONE):
   a. If distance < 250px: opacity = 0.1 (almost invisible)
   b. Else: opacity = lerp(0.1, 1.0, (distance - 250) / 200)
   c. Set element.style.opacity
```

### Seed Generation Algorithm

```javascript
function hashUsername(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    // Left shift 5 bits, subtract hash, add char code
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    // Convert to 32-bit integer
    hash = hash & hash;
  }
  // Return absolute value
  return Math.abs(hash);
}

// Map to archetype
seed = hashUsername(username) % 64;  // 0-63
archetype = ARCHETYPES[seed];
```

### AI Behavior Selection

```javascript
// Every 3 seconds:

if (in center) {
  behavior = 'retreating';  // FLEE!
} else if (hp < 40%) {
  behavior = 'fleeing';     // Low HP, run to edge
} else if (ammo < 3) {
  behavior = 'collecting';  // Need resources
} else {
  behavior = 'greedy';      // DEFAULT: Get points!
}

// Then route to appropriate AI:
switch(behavior) {
  case 'retreating': 
    target = nearestEdge;
    moveSpeed = 1.5x;       // URGENT!
    break;
  case 'fleeing':
    target = safestEdge;
    moveSpeed = 1.2x;
    break;
  case 'collecting':
    target = nearestAmmo;
    moveSpeed = 1.0x;
    break;
  case 'greedy':
    target = KOTH || nearestEnemy;
    moveSpeed = 0.9x;
    break;
}
```

---

## 💾 Memory Management

### Entity Lifecycle

```
CREATE → ACTIVE → INACTIVE → CLEANUP → DESTROY

Fighter:
  Create: new Fighter()
  Active: alive = true, in fighters[]
  Inactive: alive = false, opacity = 0.3
  Cleanup: setTimeout 1000ms
  Destroy: Remove from fighters[], remove DOM

Projectile:
  Create: new Projectile()
  Active: lifetime < 4.5s
  Cleanup: Hit target or timeout
  Destroy: Remove from projectiles[], remove DOM

Ammo:
  Create: spawnAmmo()
  Active: < 25 seconds old
  Cleanup: Collected or expired
  Destroy: Remove from ammo[], remove DOM
```

### Cleanup Strategy

```javascript
// Every frame:

// 1. Remove dead fighters (after 1s fade)
fighters = fighters.filter(f => {
  if (!f.alive && Date.now() - f.deathTime > 1000) {
    f.destroy();
    return false;
  }
  return true;
});

// 2. Remove expired projectiles
projectiles = projectiles.filter(p => {
  if (p.lifetime > 4.5) {
    p.destroy();
    return false;
  }
  return true;
});

// 3. Remove old ammo
ammo = ammo.filter(a => {
  if (Date.now() - a.spawnTime > 25000) {
    a.destroy();
    return false;
  }
  return true;
});
```

---

## 🎨 Rendering Pipeline

```
Frame Start (60 FPS)
        ↓
For each entity:
        ↓
  1. Calculate new position
        ↓
  2. Update element.style.left/top
        ↓
  3. Calculate opacity (center fade)
        ↓
  4. Update element.style.opacity
        ↓
  5. Update display text (HP, ammo, etc.)
        ↓
  6. Update textContent
        ↓
  7. Apply status effect glows
        ↓
  8. Update textShadow
        ↓
Frame End
        ↓
Browser repaints
```

**CSS Animations** (runs in CSS, not JS):
- `floatUp` - Damage numbers rise and fade
- `pulse` - KOTH zone pulsing
- `centerPulse` - Center overlay breathing
- `glow` - Status effect glowing

---

## 📊 Performance Considerations

### Optimization Techniques

1. **Entity Limits**
   - Health decay prevents screen overflow
   - Idle punishment removes stationary entities
   - 10-minute cooldowns limit spawn rate

2. **Delta Time**
   ```javascript
   dt = Math.min((now - lastUpdate) / 1000, 0.08);
   ```
   - Caps at 0.08s (12.5 FPS minimum)
   - Prevents physics explosions on lag

3. **Distance Checks**
   ```javascript
   // Only check nearby entities
   if (distance > 600) continue;
   ```

4. **Update Throttling**
   - Leaderboard: Every 2.5 seconds
   - KOTH relocation: Every 15 seconds
   - AI behavior change: Every 3 seconds
   - Zephyr respawn check: Every 1 second

5. **DOM Reuse**
   - Elements created once, updated with style properties
   - No innerHTML for entity updates (XSS safe + faster)

---

## 🔒 Security Notes

### XSS Prevention

```javascript
// ✅ SAFE: createElement + textContent
const el = document.createElement('div');
el.textContent = username;  // Escaped automatically

// ❌ UNSAFE: innerHTML with user data
el.innerHTML = username;    // Could inject <script>

// All user input uses textContent or setAttribute
```

### Input Validation

```javascript
// Username sanitization
username = username.substring(0, 20);  // Max length
username = username.replace(/[<>]/g, ''); // Strip brackets

// Message parsing uses split() and array access
const words = message.split(' ');
```

---

## 📚 Further Reading

- **WebSocket API**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **Streamlabs Docs**: https://dev.streamlabs.com/
- **requestAnimationFrame**: https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
- **CSS Animations**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations

---

**Happy Coding!** 🚀
