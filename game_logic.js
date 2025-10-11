
// ============================================================================
// SECTION 1: LOGIN & CREDENTIALS
// ============================================================================
const CONFIG = {
  // Streamlabs Socket Token - Add your token here for production
  SOCKET_TOKEN: "",
  ACCESS_TOKEN: "",
  TEST_MODE: true,
  
  // Game Balance
  KNOCKBACK_STRENGTH: 22,
  AMMO_LIFETIME: 25000,
  HEALTH_DECAY_RATE: 0.1,
  INACTIVE_THRESHOLD: 30000,
  AI_SPAWN_INTERVAL: 20000,
  
  // KOTH Settings
  KOTH_ZONE_RADIUS: 140,
  KOTH_POINTS_PER_SEC: 2,
  
  // Center screen avoidance (for stream overlay)
  CENTER_AVOID_X: 960,  // 1920/2
  CENTER_AVOID_Y: 540,  // 1080/2
  CENTER_AVOID_RADIUS: 200,
  
  // Progression
  XP_CURVE: [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200],
};

// ============================================================================
// SECTION 2: GAME MODE & ASSOCIATED SETTINGS
// ============================================================================
const GameState = {
  fighters: [],
  projectiles: [],
  ammo: [],
  container: document.getElementById('game-container'),
  width: window.innerWidth,
  height: window.innerHeight,
  playerData: {},
  chatMessages: [],
  boss: null,
  kothZone: null,
  lastAISpawn: 0,
  lastKOTHMove: 0,
  stats: { kills: 0 },
  lastUpdate: performance.now(),
};

window.addEventListener('resize', () => {
  GameState.width = window.innerWidth;
  GameState.height = window.innerHeight;
});

// ============================================================================
// SECTION 3: STREAMLABS LOGIC & EVENT HANDLING
// ============================================================================

// WebSocket connection to Streamlabs
let socket = null;
let reconnectAttempts = 0;

function connectStreamlabs() {
  if (!CONFIG.SOCKET_TOKEN || CONFIG.SOCKET_TOKEN.length < 20) {
    const cs = document.getElementById('connection-status');
    cs.textContent = '> Invalid Token';
    cs.className = 'disconnected';
    return;
  }
  
  try {
    const eioVersion = reconnectAttempts % 2 === 0 ? '4' : '3';
    const url = 'wss://sockets.streamlabs.com/socket.io/?token=' + CONFIG.SOCKET_TOKEN + '&transport=websocket&EIO=' + eioVersion;
    socket = new WebSocket(url);

    socket.onopen = () => {
      reconnectAttempts = 0;
      const cs = document.getElementById('connection-status');
      cs.textContent = 'Connected';
      cs.className = 'connected';
    };
    
    socket.onmessage = (event) => {
      const msg = event.data;
      if (msg.startsWith('2')) socket.send('3'); // Pong
      else if (msg.startsWith('42')) {
        try {
          const jsonStr = msg.substring(2);
          const data = JSON.parse(jsonStr);
          handleStreamlabsEvent(data);
        } catch (e) {}
      }
    };
    
    socket.onerror = () => {
      const cs = document.getElementById('connection-status');
      cs.textContent = '> Error';
      cs.className = 'disconnected';
    };
    
    socket.onclose = () => {
      const cs = document.getElementById('connection-status');
      cs.textContent = 'Disconnected';
      cs.className = 'disconnected';
      reconnectAttempts++;
      if (reconnectAttempts < 5) {
        const delay = Math.min(5000 * reconnectAttempts, 30000);
        setTimeout(connectStreamlabs, delay);
      } else {
        cs.textContent = 'Failed';
      }
    };
  } catch (e) {
    const cs = document.getElementById('connection-status');
    cs.textContent = '> Failed';
    cs.className = 'disconnected';
  }
}

function handleStreamlabsEvent(data) {
  if (!Array.isArray(data) || data.length < 2) return;
  const eventType = data[0];
  const eventData = data[1];
  if (!eventData) return;

  if (eventType === 'event') {
    const messages = eventData.message || [];
    for (const msg of messages) {
      const username = msg.name || msg.from || 'Viewer';
      const text = msg.message || '';
      const eventSubType = msg.type || '';
      
      // ALL ALERTS SUMMON A BOSS!
      if (eventSubType === 'follow') {
        showEventAlert('*** NEW FOLLOWER ***', username + ' just followed the stream!', '#0ff');
        spawnBoss();
        spawnPlayer(username);
        spawnAmmo(username, 'WELCOME FOLLOW THANKS AWESOME', true);
      } else if (eventSubType === 'subscription' || eventSubType === 'resub') {
        showEventAlert('*** SUBSCRIBER ***', username + ' subscribed to the channel!', '#f0f');
        spawnBoss();
        spawnPlayer(username);
        spawnAmmo(username, 'SUB HYPE LEGENDARY EPIC AMAZING THANKS', true);
        spawnAIEnemy();
        spawnAIEnemy();
        spawnAIEnemy();
      } else if (eventSubType === 'bits' || eventSubType === 'cheer') {
        const amount = msg.amount || 0;
        showEventAlert('*** BITS CHEERED ***', username + ' cheered ' + amount + ' bits!', '#ff0');
        spawnBoss();
        spawnPlayer(username);
        spawnAmmo(username, 'BITS ENERGY BOOST POWER HYPE', true);
        spawnAIEnemy();
        spawnAIEnemy();
      } else {
        // Regular chat message
        spawnPlayer(username);
        if (text && text.length > 0) {
          spawnAmmo(username, text, false);
          addChatLine(username, text);
        }
      }
    }
  }

  if (eventType === 'donation' || eventType === 'tip') {
    const amount = eventData.amount || 0;
    const username = eventData.name || eventData.from || 'Anonymous';
    showEventAlert('*** DONATION ***', username + ' donated $' + amount + '! BOSS INCOMING!', '#0f0');
    spawnBoss();
    spawnBoss(); // Double boss for donations!
    spawnPlayer(username);
    spawnAmmo(username, 'DONATION LEGENDARY EPIC AMAZING INCREDIBLE', true);
  }
}

// Show 15-second event alert in center of screen
function showEventAlert(title, message, color) {
  const alertBox = document.getElementById('event-alert');
  const alertTitle = document.getElementById('alert-title');
  const alertMessage = document.getElementById('alert-message');
  
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertBox.style.borderColor = color;
  alertBox.style.color = color;
  alertBox.style.boxShadow = '0 0 20px ' + color;
  alertBox.style.display = 'block';
  
  // Pulse animation
  alertBox.style.animation = 'pulse 0.6s ease-in-out 3';
  
  // Auto-hide after 15 seconds
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 15000);
}

// ============================================================================
// SECTION 4: FIGHTERS LOGIC & AI BEHAVIOR
// ============================================================================

class Fighter {
  constructor(username, isEnemy = false, isBoss = false) {
    this.username = username;
    this.isEnemy = isEnemy;
    this.isBoss = isBoss;
    this.alive = true;

    if (isEnemy || isBoss) {
      this.archetype = isBoss ? 'warrior' : Object.keys(ARCHETYPES)[Math.floor(Math.random() * 6)];
      this.level = isBoss ? 10 : Math.floor(Math.random() * 3) + 1;
    } else {
      const data = getPlayerData(username);
      this.archetype = data.archetype;
      this.level = data.level;
      this.xp = data.xp;
    }

    const arch = ARCHETYPES[this.archetype];
    const levelMult = 1 + (this.level - 1) * 0.15;
    this.maxHp = Math.round(arch.hp * levelMult * (isBoss ? 5 : 1));
    this.hp = this.maxHp;
    this.attack = Math.round(arch.atk * levelMult * (isBoss ? 3 : 1));
    this.speed = arch.spd;

    this.color = isZephyr(username) ? '#0ff' : getColorForUser(username);
    this.ascii = isZephyr(username) ? '@' : arch.ascii;
    this.weaponType = isZephyr(username) ? 'wand' : arch.weapon;

    this.ammoCount = 0;
    this.vx = 0;
    this.vy = 0;
    this.lastAttack = 0;
    this.attackCooldown = isZephyr(username) ? 1600 : 1800;
    this.baseAttackCooldown = this.attackCooldown;
    this.statusEffects = [];
    this.isRaging = false;

    this.anchorX = GameState.width / 2;
    this.anchorY = GameState.height - 80;

    this.spawnPosition();
    this.createElement();
  }

  spawnPosition() {
    if (this.isEnemy) {
      this.x = Math.random() * GameState.width;
      this.y = -50;
    } else if (isZephyr(this.username)) {
      this.x = this.anchorX;
      this.y = this.anchorY;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const distance = 180 + Math.random() * 160;
      this.x = GameState.width / 2 + Math.cos(angle) * distance;
      this.y = GameState.height / 2 + Math.sin(angle) * distance;
    }
    this.x = Math.max(50, Math.min(GameState.width - 50, this.x));
    this.y = Math.max(50, Math.min(GameState.height - 50, this.y));
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'entity';
    this.element.style.color = this.color;
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    if (this.isBoss) this.element.style.fontSize = '24px';
    this.updateDisplay();
    GameState.container.appendChild(this.element);
  }

  updateDisplay() {
    const hpPct = Math.max(0, this.hp / this.maxHp);
    const bars = Math.ceil(hpPct * 5);
    const hpBar = '_'.repeat(bars) + '"'.repeat(5 - bars);

    const nameDisplay = this.username.substring(0, 10);
    const ammoDisplay = this.isEnemy ? '' : ' [' + this.ammoCount + ']';

    const line4 = isZephyr(this.username)
      ? hpBar + ' SUPPORT' + ammoDisplay
      : hpBar + ammoDisplay;

    this.element.textContent = this.ascii + '\n' + nameDisplay + '\nL' + this.level + '\n' + line4;
  }

  collectAmmo(word) {
    this.ammoCount++;
    showFloatingText(this.x, this.y - 30, '+' + word, '#fa0');
  }

  update(dt) {
    if (!this.alive) return;

    // Check if in KOTH zone for RAGE boost
    if (GameState.kothZone && !this.isEnemy) {
      const distToZone = distance(this.x, this.y, GameState.kothZone.x, GameState.kothZone.y);
      this.isRaging = distToZone <= CONFIG.KOTH_ZONE_RADIUS;
      // RAGE: 50% faster attacks when in the zone!
      this.attackCooldown = this.isRaging ? this.baseAttackCooldown * 0.5 : this.baseAttackCooldown;
      if (this.isRaging) {
        this.element.style.textShadow = '0 0 10px #ff0, 0 0 15px #f80';
      } else {
        this.element.style.textShadow = '0 0 3px currentColor';
      }
    }

    for (const effect of this.statusEffects) {
      if (effect === 'fire') this.hp -= CONFIG.HEALTH_DECAY_RATE * dt;
      if (effect === 'poison') this.hp -= (CONFIG.HEALTH_DECAY_RATE * 0.6) * dt;
    }

    if (this.isEnemy) this.updateEnemyAI(dt);
    else if (isZephyr(this.username)) this.updateZephyrAI(dt);
    else this.updatePlayerAI(dt);

    this.vx *= 0.98;
    this.vy *= 0.98;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Avoid center of screen (for overlay)
    const dxCenter = this.x - CONFIG.CENTER_AVOID_X;
    const dyCenter = this.y - CONFIG.CENTER_AVOID_Y;
    const distToCenter = Math.sqrt(dxCenter*dxCenter + dyCenter*dyCenter);
    if (distToCenter < CONFIG.CENTER_AVOID_RADIUS) {
      const pushForce = (CONFIG.CENTER_AVOID_RADIUS - distToCenter) / CONFIG.CENTER_AVOID_RADIUS;
      this.vx += (dxCenter / distToCenter) * pushForce * this.speed * 0.8;
      this.vy += (dyCenter / distToCenter) * pushForce * this.speed * 0.8;
    }

    this.x = Math.max(30, Math.min(GameState.width - 30, this.x));
    this.y = Math.max(30, Math.min(GameState.height - 30, this.y));

    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    this.updateDisplay();
  }

  updatePlayerAI(dt) {
    let target = null;
    let minDist = Infinity;

    if (this.ammoCount < 2) {
      for (const ammo of GameState.ammo) {
        if (ammo.collected) continue;
        const dist = distance(this.x, this.y, ammo.x, ammo.y);
        if (dist < 280 && dist < minDist) {
          minDist = dist;
          target = { x: ammo.x, y: ammo.y, isAmmo: true };
        }
      }
    }

    if (!target && this.ammoCount > 0 && GameState.kothZone) {
      const distToKOTH = distance(this.x, this.y, GameState.kothZone.x, GameState.kothZone.y);
      
      if (distToKOTH > CONFIG.KOTH_ZONE_RADIUS) {
        target = { x: GameState.kothZone.x, y: GameState.kothZone.y, isKOTH: true };
        minDist = distToKOTH;
      }
      
      for (const f of GameState.fighters) {
        if (!f.alive || f === this) continue;
        const dist = distance(this.x, this.y, f.x, f.y);
        const distFighterToKOTH = GameState.kothZone ? distance(f.x, f.y, GameState.kothZone.x, GameState.kothZone.y) : 999;
        const isPreferred = f.isEnemy ? 1 : (!isZephyr(f.username) ? 2 : 3);
        const kothBonus = distFighterToKOTH < CONFIG.KOTH_ZONE_RADIUS * 1.5 ? 0.5 : 1;
        const score = dist * isPreferred * kothBonus;
        if (score < minDist * 0.8) { minDist = score; target = f; }
      }
    }

    this.moveAndAttack(target);
  }

  updateZephyrAI(dt) {
    let target = null;
    let best = Infinity;

    for (const f of GameState.fighters) {
      if (!f.alive || f.isEnemy || isZephyr(f.username)) continue;
      const hpPct = f.hp / f.maxHp;
      const dist = distance(this.x, this.y, f.x, f.y);
      const score = hpPct * 2 + dist / 600;
      if (score < best) { best = score; target = f; }
    }

    if (!target) {
      const dx = this.anchorX - this.x;
      const dy = this.anchorY - this.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 1;
      if (d > 30) { this.vx = (dx / d) * (this.speed * 0.6); this.vy = (dy / d) * (this.speed * 0.6); }
      else { this.vx *= 0.9; this.vy *= 0.9; }
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    if (dist > 140) {
      this.vx = (dx / dist) * (this.speed * 0.85);
      this.vy = (dy / dist) * (this.speed * 0.85);
    } else {
      this.vx *= 0.8; this.vy *= 0.8;
      const now = performance.now();
      if (now - this.lastAttack > this.attackCooldown) {
        const proj = new Projectile(this, target);
        GameState.projectiles.push(proj);
        this.lastAttack = now;
      }
    }
  }

  updateEnemyAI(dt) {
    if (this.y > GameState.height + 50) { this.destroy(); return; }

    let target = null;
    let minDist = 350;
    
    if (GameState.kothZone) {
      const distToKOTH = distance(this.x, this.y, GameState.kothZone.x, GameState.kothZone.y);
      
      if (distToKOTH > CONFIG.KOTH_ZONE_RADIUS * 1.2) {
        const dx = GameState.kothZone.x - this.x;
        const dy = GameState.kothZone.y - this.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        this.vx += (dx / d) * this.speed * 0.3;
        this.vy += (dy / d) * this.speed * 0.3;
      }
    }
    
    for (const f of GameState.fighters) {
      if (!f.alive || f.isEnemy) continue;
      const dist = distance(this.x, this.y, f.x, f.y);
      const distFighterToKOTH = GameState.kothZone ? distance(f.x, f.y, GameState.kothZone.x, GameState.kothZone.y) : 999;
      const kothBonus = distFighterToKOTH < CONFIG.KOTH_ZONE_RADIUS * 1.5 ? 0.6 : 1;
      const score = dist * kothBonus;
      if (score < minDist) { minDist = score; target = f; }
    }

    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      this.vx += (dx / dist) * this.speed * 0.5;
      this.vy += (dy / dist) * this.speed * 0.5;
      const now = performance.now();
      if (now - this.lastAttack > this.attackCooldown && dist < 240) {
        this.attackTarget(target);
        this.lastAttack = now;
      }
    }
  }

  moveAndAttack(target) {
    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      
      if (target.isAmmo) {
        this.vx = (dx / dist) * this.speed * 0.85;
        this.vy = (dy / dist) * this.speed * 0.85;
      } else if (target.isKOTH) {
        if (dist > CONFIG.KOTH_ZONE_RADIUS) {
          this.vx = (dx / dist) * this.speed * 0.7;
          this.vy = (dy / dist) * this.speed * 0.7;
        } else {
          this.vx *= 0.85;
          this.vy *= 0.85;
        }
      } else if (dist > 200) {
        this.vx = (dx / dist) * this.speed * 0.85;
        this.vy = (dy / dist) * this.speed * 0.85;
      } else {
        this.vx *= 0.85; this.vy *= 0.85;
        const now = performance.now();
        if (now - this.lastAttack > this.attackCooldown && this.ammoCount > 0) {
          this.attackTarget(target);
          this.lastAttack = now;
        }
      }
    } else {
      this.vx *= 0.9; this.vy *= 0.9;
    }
  }

  attackTarget(target) {
    if (!target || !target.alive) return;
    if (!this.isEnemy && !isZephyr(this.username) && this.ammoCount > 0) this.ammoCount--;
    const proj = new Projectile(this, target);
    GameState.projectiles.push(proj);
  }

  takeDamage(amount, attacker) {
    this.hp -= amount;
    const isHeal = amount < 0;
    const dmgColor = isHeal ? '#0f8' : '#f66';
    showFloatingText(this.x, this.y - 20, (isHeal ? '+' : '-') + Math.abs(Math.round(amount)), dmgColor);

    if (!isHeal && attacker && !attacker.isEnemy && !isZephyr(attacker.username)) {
      const pdata = getPlayerData(attacker.username);
      pdata.points += Math.min(Math.abs(amount), 5);
    }

    if (this.hp <= 0) this.die(attacker);
  }

  die(killer) {
    this.alive = false;
    this.element.style.opacity = '0.3';
    GameState.stats.kills++;
    if (killer && !killer.isEnemy && !isZephyr(killer.username)) {
      const data = getPlayerData(killer.username);
      data.kills++;
      data.xp += 50;
      data.points += 50;
      if (data.xp >= CONFIG.XP_CURVE[data.level] && data.level < 10) {
        data.level++;
        showFloatingText(killer.x, killer.y - 40, 'LEVEL UP!', '#ff0');
      }
    }
    setTimeout(() => { this.destroy(); }, 1000);
  }

  destroy() {
    if (this.element) this.element.remove();
    const idx = GameState.fighters.indexOf(this);
    if (idx > -1) GameState.fighters.splice(idx, 1);
  }
}

// ============================================================================
// SECTION 5: ARCHETYPES & WEAPON DEFINITIONS
// ============================================================================

const ARCHETYPES = {
  warrior: { name: 'Warrior', ascii: 'X', color: null, hp: 80, atk: 8, spd: 30, weapon: 'sword', statusChance: { fire: 0.15 } },
  mage:    { name: 'Mage',    ascii: '*', color: null, hp: 50, atk: 12, spd: 25, weapon: 'staff', statusChance: { ice: 0.2 } },
  rogue:   { name: 'Rogue',   ascii: '>', color: null, hp: 60, atk: 10, spd: 40, weapon: 'dagger', statusChance: { poison: 0.25 } },
  tank:    { name: 'Tank',    ascii: '#', color: null, hp: 120, atk: 5, spd: 20, weapon: 'hammer', statusChance: {} },
  ranger:  { name: 'Ranger',  ascii: '1', color: null, hp: 65, atk: 9, spd: 35, weapon: 'bow', statusChance: {} },
  healer:  { name: 'Healer',  ascii: '+', color: null, hp: 55, atk: 3, spd: 28, weapon: 'wand', statusChance: {} },
};

const WEAPONS = {
  sword:  { projectile: '-',  damage: 8,  speed: 110, color: '#f88' },
  staff:  { projectile: '+',  damage: 12, speed: 95,  color: '#88f' },
  dagger: { projectile: '>',  damage: 9,  speed: 130, color: '#8f8' },
  hammer: { projectile: '.',  damage: 7,  speed: 80,  color: '#aaa' },
  bow:    { projectile: '->', damage: 10, speed: 120, color: '#af8' },
  wand:   { projectile: '+',  damage: -10, speed: 110, color: '#0f8' }, // Heals
};

// ============================================================================
// SECTION 6: PALETTE SEED & COLOR GENERATION
// ============================================================================

function hashUsername(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getColorForUser(username) {
  const hue = hashUsername(username) % 360;
  return 'hsl(' + hue + ', 80%, 60%)';
}

function getArchetypeForUser(username) {
  const seed = hashUsername(username);
  const archetypes = Object.keys(ARCHETYPES);
  return archetypes[seed % archetypes.length];
}

function getPlayerData(username) {
  if (!GameState.playerData[username]) {
    GameState.playerData[username] = {
      username,
      archetype: username === 'Zephyr' ? 'healer' : getArchetypeForUser(username),
      level: 1,
      xp: 0,
      kills: 0,
      deaths: 0,
      points: 0,
    };
  }
  return GameState.playerData[username];
}

function isZephyr(username) { return username === 'Zephyr'; }

// ============================================================================
// SECTION 7: VISUALS & PROJECTILES
// ============================================================================

class Projectile {
  constructor(owner, target) {
    this.owner = owner;
    this.x = owner.x;
    this.y = owner.y;
    const weapon = WEAPONS[owner.weaponType];
    this.damage = weapon.damage;
    this.speed = weapon.speed;
    this.color = weapon.color;
    this.symbol = weapon.projectile;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;
    this.lifetime = 0;
    this.maxLifetime = 4.5;
    this.createElement();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'projectile';
    this.element.textContent = this.symbol;
    this.element.style.color = this.color;
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    GameState.container.appendChild(this.element);
  }

  update(dt) {
    this.lifetime += dt;
    if (this.lifetime > this.maxLifetime) { this.destroy(); return; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';

    for (const f of GameState.fighters) {
      if (!f.alive || f === this.owner) continue;

      const ownerIsEnemy = this.owner.isEnemy;
      const targetIsEnemy = f.isEnemy;
      const friendlyEnemyFire = ownerIsEnemy && targetIsEnemy;
      if (friendlyEnemyFire) continue;

      if (distance(f.x, f.y, this.x, this.y) < 25) {
        f.takeDamage(this.damage, this.owner);
        const dx = f.x - this.owner.x;
        const dy = f.y - this.owner.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        f.vx += (dx / d) * CONFIG.KNOCKBACK_STRENGTH * 0.2;
        f.vy += (dy / d) * CONFIG.KNOCKBACK_STRENGTH * 0.2;
        this.destroy();
        break;
      }
    }
  }

  destroy() {
    if (this.element) this.element.remove();
    const idx = GameState.projectiles.indexOf(this);
    if (idx > -1) GameState.projectiles.splice(idx, 1);
  }
}

class Ammo {
  constructor(word, x, y) {
    this.word = word;
    this.x = (typeof x === 'number' ? x : Math.random() * GameState.width);
    this.y = (typeof y === 'number' ? y : Math.random() * GameState.height);
    this.collected = false;
    this.spawnTime = Date.now();
    this.vx = (Math.random() - 0.5) * 1.6;
    this.vy = (Math.random() - 0.5) * 1.6;
    this.createElement();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'ammo-particle';
    this.element.textContent = this.word;
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    GameState.container.appendChild(this.element);
  }

  update(dt) {
    if (this.collected) return;
    if (Date.now() - this.spawnTime > CONFIG.AMMO_LIFETIME) { this.destroy(); return; }
    this.x += this.vx * 24 * dt;
    this.y += this.vy * 24 * dt;
    if (this.x < 0 || this.x > GameState.width) this.vx *= -1;
    if (this.y < 0 || this.y > GameState.height) this.vy *= -1;
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    for (const f of GameState.fighters) {
      if (!f.alive || f.isEnemy) continue;
      if (distance(f.x, f.y, this.x, this.y) < 35) {
        f.collectAmmo(this.word);
        this.destroy();
        break;
      }
    }
  }

  destroy() {
    if (this.element) this.element.remove();
    const idx = GameState.ammo.indexOf(this);
    if (idx > -1) GameState.ammo.splice(idx, 1);
  }
}

function showFloatingText(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'damage-number';
  el.textContent = text;
  el.style.color = color;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  GameState.container.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ============================================================================
// SECTION 8: ASCII RULES & DISPLAY LOGIC
// ============================================================================

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2-x1) ** 2 + (y2-y1) ** 2);
}

// ============================================================================
// SECTION 9: MEMORY & CLEANUP OPTIMIZATION
// ============================================================================

function spawnPlayer(username) {
  const existing = GameState.fighters.find(f => f.username === username && f.alive && !f.isEnemy);
  if (existing) {
    existing.hp = Math.min(existing.maxHp, existing.hp + 16);
    showFloatingText(existing.x, existing.y - 30, '+16 HP', '#0f0');
    return existing;
  }
  const fighter = new Fighter(username, false, false);
  GameState.fighters.push(fighter);
  return fighter;
}

function spawnAIEnemy() {
  const fighter = new Fighter('AI_' + Date.now(), true, false);
  GameState.fighters.push(fighter);
  return fighter;
}

function spawnAmmo(username, message, edgeSpawn = false) {
  const words = message.trim().split(/\s+/).filter(w => w.length > 0);
  for (const word of words) {
    if (word.length > 15) continue;
    let x, y;
    if (edgeSpawn) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) {
        x = Math.random() * GameState.width;
        y = 50 + Math.random() * 100;
      } else if (side === 1) {
        x = Math.random() * GameState.width;
        y = GameState.height - 150 + Math.random() * 100;
      } else if (side === 2) {
        x = 50 + Math.random() * 100;
        y = Math.random() * GameState.height;
      } else {
        x = GameState.width - 150 + Math.random() * 100;
        y = Math.random() * GameState.height;
      }
    } else {
      x = undefined;
      y = undefined;
    }
    const ammo = new Ammo(word, x, y);
    GameState.ammo.push(ammo);
  }
}

function addChatLine(username, message) {
  GameState.chatMessages.push({ username, message, time: Date.now() });
  const retainer = document.getElementById('chat-retainer');
  const line = document.createElement('div');
  line.className = 'chat-line';
  line.textContent = username + ': ' + message.substring(0, 50);
  retainer.appendChild(line);
  while (retainer.children.length > 4) retainer.children[1].remove();
  retainer.scrollTop = retainer.scrollHeight;
}

function spawnBoss() {
  if (GameState.boss && GameState.boss.alive) return;
  const boss = new Fighter('BOSS_' + Date.now(), true, true);
  
  const side = Math.floor(Math.random() * 4);
  if (side === 0) { boss.x = GameState.width / 2; boss.y = -30; }
  else if (side === 1) { boss.x = GameState.width / 2; boss.y = GameState.height + 30; }
  else if (side === 2) { boss.x = -30; boss.y = GameState.height / 2; }
  else { boss.x = GameState.width + 30; boss.y = GameState.height / 2; }
  
  boss.color = '#f00';
  boss.ascii = '@';
  GameState.fighters.push(boss);
  GameState.boss = boss;
  
  const enterX = Math.random() * (GameState.width - 400) + 200;
  showFloatingText(enterX, 100, '>>> BOSS INCOMING <<<', '#f00');
}

function updateKOTHZone() {
  const now = performance.now();
  if (!GameState.kothZone || now - GameState.lastKOTHMove > 25000) {
    if (GameState.kothZone && GameState.kothZone.element) {
      GameState.kothZone.element.remove();
    }
    const x = 220 + Math.random() * (GameState.width - 440);
    const y = 220 + Math.random() * (GameState.height - 440);
    GameState.kothZone = { x, y };
    GameState.lastKOTHMove = now;

    const zoneEl = document.createElement('div');
    zoneEl.className = 'koth-zone';
    zoneEl.style.left = (x - CONFIG.KOTH_ZONE_RADIUS) + 'px';
    zoneEl.style.top = (y - CONFIG.KOTH_ZONE_RADIUS) + 'px';
    zoneEl.style.width = (CONFIG.KOTH_ZONE_RADIUS * 2) + 'px';
    zoneEl.style.height = (CONFIG.KOTH_ZONE_RADIUS * 2) + 'px';
    GameState.container.appendChild(zoneEl);
    GameState.kothZone.element = zoneEl;
  }

  if (GameState.kothZone) {
    for (const f of GameState.fighters) {
      if (!f.alive || f.isEnemy || isZephyr(f.username)) continue;
      const d = distance(f.x, f.y, GameState.kothZone.x, GameState.kothZone.y);
      if (d <= CONFIG.KOTH_ZONE_RADIUS) {
        const pdata = getPlayerData(f.username);
        pdata.points += CONFIG.KOTH_POINTS_PER_SEC * 0.5;
      }
    }
  }
}

function updateLeaderboard() {
  const leaderboard = document.getElementById('leaderboard');
  const players = Object.values(GameState.playerData)
    .filter(p => !isZephyr(p.username))
    .sort((a, b) => Math.floor(b.points) - Math.floor(a.points))
    .slice(0, 10);

  while (leaderboard.children.length > 1) {
    leaderboard.children[1].remove();
  }

  if (players.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'leader-entry';
    emptyDiv.style.color = '#666';
    emptyDiv.textContent = 'No players yet ...';
    leaderboard.appendChild(emptyDiv);
  } else {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const entryDiv = document.createElement('div');
      entryDiv.className = 'leader-entry';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'leader-name';
      nameSpan.textContent = (i + 1) + '. ' + p.username.substring(0, 12);
      
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'leader-score';
      scoreSpan.textContent = 'Pts ' + Math.floor(p.points) + ' | L' + p.level;
      
      entryDiv.appendChild(nameSpan);
      entryDiv.appendChild(scoreSpan);
      leaderboard.appendChild(entryDiv);
    }
  }
}

function updateStats() {
  const players = GameState.fighters.filter(f => !f.isEnemy && f.alive).length;
  const enemies = GameState.fighters.filter(f => f.isEnemy && f.alive).length;
  const total = GameState.fighters.filter(f => f.alive).length;
  const ammo = GameState.ammo.filter(a => !a.collected).length;

  document.getElementById('player-count').textContent = players;
  document.getElementById('ai-count').textContent = enemies;
  document.getElementById('total-fighters').textContent = total;
  document.getElementById('ammo-count').textContent = ammo;
  document.getElementById('kill-count').textContent = GameState.stats.kills;
}

// ============================================================================
// SECTION 10: FINAL - INITIALIZATION & GAME LOOP
// ============================================================================

function gameLoop() {
  const now = performance.now();
  const dt = Math.min((now - GameState.lastUpdate) / 1000, 0.08);
  GameState.lastUpdate = now;

  for (const fighter of GameState.fighters.slice()) fighter.update(dt);
  for (const proj of GameState.projectiles.slice()) proj.update(dt);
  for (const ammo of GameState.ammo.slice()) ammo.update(dt);

  if (now - GameState.lastAISpawn > CONFIG.AI_SPAWN_INTERVAL) {
    spawnAIEnemy();
    GameState.lastAISpawn = now;
  }

  updateKOTHZone();
  updateStats();

  if (Math.floor(now / 2500) !== Math.floor((now - dt * 1000) / 2500)) updateLeaderboard();

  requestAnimationFrame(gameLoop);
}

function spawnTestFighters() {
  const testNames = ['TestWarrior','TestMage','TestRogue','TestTank','TestRanger','TestHealer'];
  const name = testNames[Math.floor(Math.random() * testNames.length)] + Math.floor(Math.random() * 100);
  const f = spawnPlayer(name);
  const testWords = ['attack','defend','heal','fire','ice','storm'];
  const message = [];
  for (let i = 0; i < 2; i++) message.push(testWords[Math.floor(Math.random() * testWords.length)]);
  spawnAmmo(name, message.join(' '));
  addChatLine(name, message.join(' '));
  console.log('[TEST] Spawned:', name, f.color);
}

function spawnZephyr() {
  const z = new Fighter('Zephyr', false, false);
  z.x = GameState.width / 2;
  z.y = GameState.height - 80;
  z.color = '#0ff';
  z.ascii = '@';
  z.weaponType = 'wand';
  z.attackCooldown = 2200;
  GameState.fighters.push(z);
  GameState.playerData['Zephyr'] = getPlayerData('Zephyr');
  return z;
}

// Initialize game
spawnZephyr();

if (!CONFIG.TEST_MODE) {
  connectStreamlabs();
} else {
  const cs = document.getElementById('connection-status');
  cs.textContent = 'TEST MODE';
  cs.style.color = '#fa0';
}

gameLoop();

if (CONFIG.TEST_MODE) {
  setTimeout(() => {
    showEventAlert('=== TEST MODE ACTIVE ===', 'Game is running! Fighters will spawn shortly.', '#fa0');
  }, 1000);
  
  setTimeout(() => {
    spawnTestFighters();
    setInterval(spawnTestFighters, 20000);
  }, 2000);
  
  setTimeout(() => {
    showEventAlert('*** NEW FOLLOWER ***', 'TestUser123 just followed the stream!', '#0ff');
  }, 25000);
  
  setTimeout(() => {
    showEventAlert('*** SUBSCRIBER ***', 'TestSub456 subscribed to the channel!', '#f0f');
  }, 50000);
}
