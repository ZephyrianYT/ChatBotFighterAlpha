# AI Priority System & Progression

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                    NUMBERED PRIORITY SYSTEM                           ║
## ╚═══════════════════════════════════════════════════════════════════════╝

### **Priority 0: ESCAPE CENTER** (FORCED - Overrides Everything)
**Trigger:** `inDangerZone = true` (within 480px of center)
**Action:** Flee radially to 600px from center
**Speed:** 1.8x (maximum speed)
**Overrides:** ALL other priorities

**Logic:**
```
if (distance_to_center < 480px) {
  inDangerZone = true;
  direction = normalize(position - center);
  target = center + (direction * 600px);
  speed = 1.8x;
  return; // Skip all other AI
}
```

---

### **Priority 1: KOTH ZONE** (Primary Objective)
**Rewards:**
- +3 points/second
- +1 XP/second  
- HP regeneration
- 50% faster attacks

**Logic:**
```
if (KOTH exists && ammo > 2) {
  if (distance_to_KOTH > 100px) {
    → Move toward KOTH
  } else if (in KOTH radius) {
    → Fight defenders OR hold position
  }
}
```

**Why Priority 1:**
- Best source of XP for leveling
- Points for leaderboard
- HP regen offsets decay
- Attack boost helps in combat

---

### **Priority 2: AMMO** (Resource Management)
**Trigger:** Ammo < 8
**Urgent:** Ammo < 3 (critical!)

**Logic:**
```
if (ammo < 8 && ammo_pickups_exist) {
  nearest_ammo = find_closest_ammo(550px range);
  if (ammo < 3) {
    urgent = true; // 1.4x speed
  }
  → Move to ammo
}
```

**Why Priority 2:**
- Need ammo to fight (Priority 3)
- Need ammo to hold KOTH (Priority 1)
- Without ammo, can't earn XP

---

### **Priority 3: COMBAT** (Fight Everyone)
**Targets:**
- Other player heroes (PvP!)
- AI enemies
- Bosses

**Does NOT target:**
- Zephyr (healer)
- Self

**Logic:**
```
if (ammo > 0) {
  for each fighter in range (650px):
    if (fighter != self && fighter != Zephyr) {
      priority_mult = 1.0;
      if (enemy) priority_mult *= 0.9;
      if (wounded) priority_mult *= 0.85;
      if (higher_level) priority_mult *= 1.2;
      
      score = distance * priority_mult;
      best_target = lowest_score;
    }
  → Attack best target
}
```

**XP Rewards:**
- +2 XP per hit (Priority 3)
- +50 XP per kill (Priority 3)

---

### **Priority 4: HEALTH & MOVEMENT** (Survival)
**Trigger:** HP < 40%

**Logic:**
```
if (hp_percent < 0.4) {
  if (Zephyr alive) {
    → Move to Zephyr for healing
  } else if (ammo exists) {
    → Collect ammo to survive
  }
}
```

**Why Priority 4:**
- Only matters when low HP
- Survival ensures continued XP gain
- Healing lets you continue fighting

---

### **Priority 5: KEEP MOVING** (Idle Death Prevention)
**Trigger:** No other priorities active

**Logic:**
```
if (no_target) {
  if (KOTH exists) {
    → Move to KOTH (default goal)
  } else {
    → Patrol to random edge
  }
}
```

**Idle Penalty:**
- Speed < 5 = considered idle
- Idle > 1 second = 3x health decay (0.36 HP/s)
- "MOVE OR DIE!" warning shown
- Death in ~50 seconds if completely idle

---

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                      LEVELING & PROGRESSION                           ║
## ╚═══════════════════════════════════════════════════════════════════════╝

### **XP Sources**

| Action | XP Gained | Priority |
|--------|-----------|----------|
| Deal damage (hit) | +2 XP | 3 (Combat) |
| Kill enemy | +50 XP | 3 (Combat) |
| Hold KOTH (per second) | +1 XP | 1 (KOTH) |

### **XP Curve (Levels 1-10)**

| Level | XP Needed | Cumulative |
|-------|-----------|------------|
| 1 → 2 | 100 | 100 |
| 2 → 3 | 250 | 350 |
| 3 → 4 | 450 | 800 |
| 4 → 5 | 700 | 1,500 |
| 5 → 6 | 1,000 | 2,500 |
| 6 → 7 | 1,400 | 3,900 |
| 7 → 8 | 1,900 | 5,800 |
| 8 → 9 | 2,500 | 8,300 |
| 9 → 10 | 3,200 | 11,500 |
| 10 (MAX) | - | - |

### **Level Up Bonuses**

**Per Level:**
- +5 max HP
- +2 attack damage
- +1 movement speed
- **FULL HEAL!** (HP = maxHP)

**Example Progression:**

```
Level 1: HP=25, ATK=15, SPD=30
   ↓ (+100 XP)
Level 2: HP=30, ATK=17, SPD=31 + FULL HEAL
   ↓ (+250 XP)
Level 3: HP=35, ATK=19, SPD=32 + FULL HEAL
   ↓ (+450 XP)
Level 4: HP=40, ATK=21, SPD=33 + FULL HEAL
   ...
Level 10: HP=70, ATK=33, SPD=39 + FULL HEAL (MAXED!)
```

### **Leveling Strategy**

**Fast XP:**
1. Hold KOTH (+1 XP/sec = 60 XP/min)
2. Fight constantly (+2 XP/hit)
3. Get kills (+50 XP each)

**XP Math:**
- 50 hits = 100 XP = Level 2
- 2 kills = 100 XP = Level 2
- Hold KOTH for 100 seconds = 100 XP = Level 2
- **Or mix:** 1 kill + 25 hits = Level 2

**Survival:**
- Level up = full heal (offsets decay)
- Higher HP = survive longer
- Higher ATK = faster kills = more XP
- Higher SPD = better positioning

---

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                      HEALTH DECAY SYSTEM                              ║
## ╚═══════════════════════════════════════════════════════════════════════╝

### **Baseline Decay** (Always Active)

**All entities lose HP constantly:**
- Base rate: 0.12 HP/second
- Idle penalty: 0.36 HP/second (3x multiplier)
- Center damage: +0.60 HP/second (5x in danger zone)

**Survival Times (without healing):**

| HP | Moving | Idle | In Center |
|----|--------|------|-----------|
| 20 | 166s (2.8min) | 55s | 33s |
| 30 | 250s (4.2min) | 83s | 50s |
| 40 | 333s (5.5min) | 111s | 66s |
| 50 | 416s (6.9min) | 138s | 83s |

**With Level 10 (70 HP):**
- Moving: 583s (9.7 minutes)
- Idle: 194s (3.2 minutes)
- In Center: 116s (1.9 minutes)

### **Offsetting Decay**

**1. KOTH Regeneration:**
- +0.05 HP/second in KOTH
- Net decay: 0.12 - 0.05 = 0.07 HP/s
- Doubles survival time in KOTH!

**2. Leveling Up:**
- Each level = +5 max HP + full heal
- Resets health pool
- Can survive longer with higher HP

**3. Zephyr Healing:**
- Heals nearby wounded fighters
- Support role
- Can extend survival significantly

### **Why Decay System Works**

✅ **Prevents Screen Clutter:** Characters naturally die over time
✅ **Forces Activity:** Idle = 3x faster death
✅ **Rewards KOTH:** Regen offsets decay
✅ **Rewards Leveling:** Higher HP = longer survival
✅ **Creates Urgency:** Must earn XP to survive
✅ **Natural Cycle:** Spawn → Fight → Level → Die → Respawn (10min)

---

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                    FIGHTER DEVELOPMENT ARC                            ║
## ╚═══════════════════════════════════════════════════════════════════════╝

### **New Fighter (Level 1)**
**Stats:** HP=20-38, ATK=12-23, SPD=18-45 (archetype-dependent)
**Survival:** ~3-5 minutes without XP
**Strategy:** 
1. Spawn with 14-27 ammo
2. Seek KOTH (Priority 1)
3. Fight on the way (Priority 3)
4. Collect ammo (Priority 2)
5. Try to survive and level up

### **Developing Fighter (Levels 2-5)**
**Stats:** HP=25-53, ATK=14-31, SPD=19-49
**Survival:** ~4-8 minutes
**Strategy:**
1. Stronger combat ability
2. Can hold KOTH longer
3. Earn XP faster (better at combat)
4. Full heal on each level up

### **Veteran Fighter (Levels 6-9)**
**Stats:** HP=50-68, ATK=22-39, SPD=23-53
**Survival:** ~8-12 minutes
**Strategy:**
1. Dominate KOTH zone
2. Hunt lower-level fighters
3. Tanky enough to survive center push
4. High damage for quick kills

### **Max Level (Level 10)**
**Stats:** HP=65-83, ATK=30-47, SPD=27-57
**Survival:** ~9-14 minutes (if active)
**Strategy:**
1. KOTH king
2. One-shots low-level fighters
3. Boss-tier strength
4. Eventually dies to decay (keeps game fresh)

---

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                      PERSONALITY EVOLUTION                            ║
## ╚═══════════════════════════════════════════════════════════════════════╝

**As fighters level up, they develop distinct styles:**

### **Aggressive** (Direct Combat)
- Levels 1-3: Reckless attacks
- Levels 4-7: Calculated aggression
- Levels 8-10: Unstoppable force

### **Greedy** (Point-Focused)
- Levels 1-3: Desperate for KOTH
- Levels 4-7: KOTH domination
- Levels 8-10: Point farming machine

### **Tactical** (Smart Fighting)
- Levels 1-3: Pick weak targets
- Levels 4-7: Strategic positioning
- Levels 8-10: Master tactician

### **Survivor** (Defensive)
- Levels 1-3: Run from danger
- Levels 4-7: Calculated risks
- Levels 8-10: Unkillable tank

---

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                         EXAMPLE GAME FLOW                             ║
## ╚═══════════════════════════════════════════════════════════════════════╝

**Minute 0:00** - Player chats
- Hero spawns (Level 1, 25 HP, 15 ATK, 18 ammo)
- Seeks KOTH (Priority 1)

**Minute 0:30** - Reaches KOTH
- Earning +3 pts/sec + 1 XP/sec
- Regen partially offsets decay

**Minute 1:00** - Enemy approaches
- Switches to combat (Priority 3)
- Defends KOTH
- Deals damage: +2 XP per hit

**Minute 1:30** - Gets kill
- +50 XP + 100 points
- Total: ~140 XP → **LEVEL UP to 2!**
- Stats: HP=30→30 (full heal!), ATK=15→17, SPD=30→31

**Minute 2:00** - Returns to KOTH
- Stronger now (Level 2)
- Continues earning XP

**Minute 3:00** - Multiple fights
- Levels 2 → 3 → 4
- Each level = full heal + stat boost
- Getting stronger over time

**Minute 5:00** - Level 6, dominant
- HP=50, ATK=25, SPD=35
- Holds KOTH consistently
- One-shots Level 1 fighters

**Minute 8:00** - Level 9
- Nearly maxed out
- Boss-tier stats
- Still slowly decaying

**Minute 10:00** - Dies to decay
- Even with regen, decay eventually wins
- 10-minute cooldown starts
- Made it to Level 9! (top of leaderboard)

**Minute 20:00** - Can respawn!
- Viewer chats again
- New Level 1 hero spawns
- Cycle repeats

---

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                         CONFIG REFERENCE                              ║
## ╚═══════════════════════════════════════════════════════════════════════╝

```javascript
CONFIG = {
  // Health & Decay
  HEALTH_DECAY_RATE: 0.12,       // 0.12 HP/sec baseline
  IDLE_DECAY_MULTIPLIER: 3.0,    // 3x if not moving
  
  // XP & Leveling
  XP_PER_HIT: 2,                 // Combat activity
  XP_PER_KILL: 50,               // Kill reward
  XP_PER_KOTH_SECOND: 1,         // KOTH holding
  
  // Level Bonuses
  LEVEL_HP_BONUS: 5,             // +5 HP per level
  LEVEL_ATK_BONUS: 2,            // +2 ATK per level
  LEVEL_SPD_BONUS: 1,            // +1 SPD per level
  HEAL_ON_LEVELUP: true,         // Full heal on level up
  
  // XP Curve
  XP_CURVE: [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]
};
```

---

## ╔═══════════════════════════════════════════════════════════════════════╗
## ║                      COMBAT SCALING EXAMPLE                           ║
## ╚═══════════════════════════════════════════════════════════════════════╝

**Level 1 vs Level 1:**
- FireWarrior (25 HP, 15 ATK) vs IceMage (23 HP, 18 ATK)
- IceMage wins in 2 shots
- FireWarrior needs 2 shots
- Even match!

**Level 1 vs Level 5:**
- Level 1 FireWarrior (25 HP, 15 ATK)
- Level 5 IceMage (43 HP, 26 ATK)
- IceMage one-shots Level 1 (26 > 25)
- Level 1 needs 3 shots to kill Level 5
- Massive advantage!

**Level 10 vs Level 10:**
- Level 10 FireWarrior (70 HP, 33 ATK)
- Level 10 IceMage (68 HP, 36 ATK)
- IceMage needs 2 shots
- FireWarrior needs 3 shots
- Still competitive, but stats matter!

**Leveling Advantage:**
- Each level = ~20% stronger
- Level difference of 3+ = huge advantage
- Max level fighters dominate early fighters
- But decay ensures they eventually die

---

**Result:** Dynamic meta where viewers must stay engaged to level up and survive! 🎮
