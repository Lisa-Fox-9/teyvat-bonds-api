// Quest scene overlay — plays a short themed animation when the player
// completes a quest, then calls the real complete API and shows a reward
// popup. Falls back to a plain confirm scene for any quest title that
// doesn't match a known pattern (e.g. custom quests created via the API).
//
// Exposes one function: playQuestScene(quest, companion, onDone)
// onDone(success) is called after the scene finishes and the API call resolves.

const sceneOverlay = document.getElementById('scene-overlay');

const closeScene = () => {
  sceneOverlay.hidden = true;
  sceneOverlay.className = 'scene-overlay';
  sceneOverlay.innerHTML = '';
};

/** Classify a quest by its title into one of the known scene types. */
const classifyQuest = (questTitle) => {
  if (/gathering fruit|submit a meal/i.test(questTitle)) return 'npc';
  if (/explore the wild/i.test(questTitle)) return 'explore';
  if (/defeat ley line/i.test(questTitle)) return 'battle';
  return 'plain';
};

/** Call the real complete-quest API and show the reward popup, then finish. */
const finishQuest = async (quest, companion, onDone) => {
  try {
    const result = await api(`/api/quests/${quest.quest_id}/complete`, {
      method: 'PUT',
      body: { user_character_id: companion.user_character_id },
    });
    showRewardPopup(result, () => { closeScene(); onDone(true); });
  } catch (err) {
    closeScene();
    showFeedback(null, err.message);
    onDone(false);
  }
};

const showRewardPopup = (result, onClose) => {
  const isRelic = result.item_awarded?.category === 'relic';
  sceneOverlay.innerHTML = `
    <div class="reward-card ${isRelic ? 'reward-card-rare' : ''}">
      ${isRelic ? '<p class="rare-badge">✨ ULTRA RARE ✨</p>' : ''}
      <h2>Congratulations!</h2>
      <p class="muted">${result.message || 'Quest complete!'}</p>
      <div class="reward-icons">
        ${result.xp_awarded ? `<div class="reward-chip">+${result.xp_awarded} XP</div>` : ''}
        ${result.coins_awarded ? `<div class="reward-chip">+${result.coins_awarded} coins</div>` : ''}
        ${result.item_awarded ? `<div class="reward-chip ${isRelic ? 'reward-chip-rare' : ''}">${isRelic ? '💎 ' : '+'}${result.item_awarded.item_name || 'Item'}</div>` : ''}
      </div>
      <button class="primary" id="reward-close-btn">Nice!</button>
    </div>`;
  document.getElementById('reward-close-btn').addEventListener('click', onClose);
};

// ---------- NPC scene (Gathering Fruit / Submit a Meal) ----------

const playNpcScene = (quest, companion, onDone) => {
  sceneOverlay.hidden = false;
  sceneOverlay.innerHTML = `
    <button class="scene-skip" id="scene-skip-btn">✕ Cancel</button>
    <p class="scene-title">${quest.quest_title}</p>
    <div class="scene-stage">
      <div style="position:relative;">
        <div class="scene-speech">I need some ${quest.required_item_category || 'food'}, traveler!</div>
        <div class="npc-idle">${npcSprite(340)}</div>
      </div>
    </div>
    <div class="scene-actions">
      <button class="primary" id="scene-give-btn">Give ${quest.required_item_category || 'item'}</button>
    </div>`;

  const giveFood = () => finishQuest(quest, companion, onDone);
  const cancel = () => { closeScene(); onDone(false); };
  document.getElementById('scene-give-btn').addEventListener('click', giveFood);
  document.getElementById('scene-skip-btn').addEventListener('click', cancel);
};

// ---------- Explore scene (Explore the Wild) — interactive ----------
//
// Move the companion around a bounded map with arrow keys / WASD and walk
// into berries to collect them before the timer runs out. More berries
// collected = a bigger bonus. The base quest reward still comes from the
// real complete-quest API (unchanged); the berry bonus is layered on top
// by adding coins through the existing self-only PUT /api/users/:id
// endpoint, so no new backend surface was needed for this.

const EXPLORE_DURATION_MS = 12000;
const EXPLORE_MOVE_SPEED = 4.2; // px per animation frame (bumped up for the bigger map)
const EXPLORE_BERRY_COUNT = 8;
const EXPLORE_BERRY_RADIUS = 34; // collision distance in px (scaled up with the bigger sprites)
const EXPLORE_PLAYER_SIZE = 96;
const EXPLORE_COINS_PER_BERRY = 8;

const playExploreScene = (quest, companion, onDone) => {
  sceneOverlay.hidden = false;
  sceneOverlay.className = 'scene-overlay map-bg';
  sceneOverlay.innerHTML = `
    <button class="scene-skip" id="scene-skip-btn">✕ Cancel</button>
    <p class="scene-title">${quest.quest_title}</p>
    <p class="muted">Use arrow keys or WASD to move. Collect berries before time runs out!</p>
    <div class="explore-map" id="explore-map" tabindex="0">
      <div class="explore-player" id="explore-player">${characterSprite(companion.character_name, companion.element, EXPLORE_PLAYER_SIZE)}</div>
    </div>
    <div class="explore-hud">
      <span>🍓 Berries: <strong id="explore-berry-count">0</strong></span>
      <span>⏱️ Time: <strong id="explore-timer">${Math.ceil(EXPLORE_DURATION_MS / 1000)}</strong>s</span>
    </div>`;

  const map = document.getElementById('explore-map');
  const player = document.getElementById('explore-player');
  const berryCountEl = document.getElementById('explore-berry-count');
  const timerEl = document.getElementById('explore-timer');
  const skipBtn = document.getElementById('scene-skip-btn');

  let ended = false;
  let berriesCollected = 0;
  let pos = { x: 20, y: 20 };
  const pressed = new Set();
  const berries = [];

  const mapBounds = () => ({
    width: map.clientWidth || 900,
    height: map.clientHeight || 420,
  });

  const spawnBerry = () => {
    const { width, height } = mapBounds();
    const el = document.createElement('div');
    el.className = 'explore-berry';
    el.textContent = '🍓';
    const x = 10 + Math.random() * Math.max(1, width - 40);
    const y = 10 + Math.random() * Math.max(1, height - 40);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    map.appendChild(el);
    berries.push({ el, x: x + 12, y: y + 12 });
  };

  for (let i = 0; i < EXPLORE_BERRY_COUNT; i++) spawnBerry();

  const onKeyDown = (e) => { pressed.add(e.key.toLowerCase()); };
  const onKeyUp = (e) => { pressed.delete(e.key.toLowerCase()); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  map.focus();

  const checkCollisions = () => {
    const playerCenter = { x: pos.x + EXPLORE_PLAYER_SIZE / 2, y: pos.y + EXPLORE_PLAYER_SIZE / 2 };
    for (let i = berries.length - 1; i >= 0; i--) {
      const b = berries[i];
      const dx = b.x - playerCenter.x;
      const dy = b.y - playerCenter.y;
      if (Math.sqrt(dx * dx + dy * dy) < EXPLORE_BERRY_RADIUS) {
        b.el.remove();
        berries.splice(i, 1);
        berriesCollected++;
        berryCountEl.textContent = berriesCollected;
        // Keep the map lively — replace what was picked up
        spawnBerry();
      }
    }
  };

  let rafId;
  const tick = () => {
    if (ended) return;
    const { width, height } = mapBounds();
    if (pressed.has('arrowup') || pressed.has('w')) pos.y -= EXPLORE_MOVE_SPEED;
    if (pressed.has('arrowdown') || pressed.has('s')) pos.y += EXPLORE_MOVE_SPEED;
    if (pressed.has('arrowleft') || pressed.has('a')) pos.x -= EXPLORE_MOVE_SPEED;
    if (pressed.has('arrowright') || pressed.has('d')) pos.x += EXPLORE_MOVE_SPEED;
    pos.x = Math.max(0, Math.min(width - EXPLORE_PLAYER_SIZE, pos.x));
    pos.y = Math.max(0, Math.min(height - EXPLORE_PLAYER_SIZE, pos.y));
    player.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    checkCollisions();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  const cleanup = () => {
    ended = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };

  const timerStart = Date.now();
  const timerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((EXPLORE_DURATION_MS - (Date.now() - timerStart)) / 1000));
    timerEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      finishExploring();
    }
  }, 200);

  const finishExploring = async () => {
    if (ended) return;
    cleanup();
    clearInterval(timerInterval);

    const bonusCoins = berriesCollected * EXPLORE_COINS_PER_BERRY;
    map.replaceChildren();
    document.querySelector('.explore-hud').style.display = 'none';
    const status = document.createElement('p');
    status.className = 'muted';
    status.textContent = `Collected ${berriesCollected} berries! (+${bonusCoins} bonus coins)`;
    sceneOverlay.insertBefore(status, map.nextSibling);

    // Layer the berry bonus on top of the base quest reward using the
    // existing self-only user-update endpoint — no new backend needed.
    if (bonusCoins > 0) {
      try {
        const freshUser = await api(`/api/users/${user.user_id}`);
        await api(`/api/users/${user.user_id}`, { method: 'PUT', body: { coins: freshUser.coins + bonusCoins } });
      } catch (err) { /* bonus is a nice-to-have — don't block quest completion if this fails */ }
    }

    setTimeout(() => finishQuest(quest, companion, onDone), 900);
  };

  const cancelExploring = () => {
    if (ended) return;
    cleanup();
    clearInterval(timerInterval);
    closeScene();
    onDone(false);
  };

  skipBtn.addEventListener('click', cancelExploring);
};

// ---------- Battle scene (Defeat Ley Line) — interactive ----------
//
// Click (or tap) the slime to attack — click faster to win quicker. The
// slime counter-attacks on its own timer. First to 0 HP loses. Winning
// completes the quest via the real API; losing offers a retry without
// completing it (so it can't be cheesed by just closing and reopening).

const BATTLE_COMPANION_MAX_HP = 100;
const BATTLE_SLIME_MAX_HP = 150; // slime has more HP than the companion — sustained clicking is required to win
const BATTLE_CLICK_DAMAGE_MIN = 4;
const BATTLE_CLICK_DAMAGE_MAX = 9;
const BATTLE_SLIME_DAMAGE_MIN = 10;
const BATTLE_SLIME_DAMAGE_MAX = 18;
const BATTLE_SLIME_ATTACK_INTERVAL_MS = 1100;
const BATTLE_CLICK_COOLDOWN_MS = 150;

const playBattleScene = (quest, companion, onDone) => {
  sceneOverlay.hidden = false;
  sceneOverlay.className = 'scene-overlay battle-bg';
  sceneOverlay.innerHTML = `
    <button class="scene-skip" id="scene-skip-btn">✕ Cancel</button>
    <p class="scene-title">${quest.quest_title}</p>
    <div class="scene-stage">
      <div class="battle-row">
        <div>
          <div class="attacker" id="battle-attacker">${characterSprite(companion.character_name, companion.element, 220)}</div>
          <div class="hp-track"><div class="hp-fill" id="battle-companion-hp" style="width:100%"></div></div>
        </div>
        <div class="battle-vs">VS</div>
        <div>
          <div class="defender" id="battle-defender">${monsterSprite(220, companion.element)}</div>
          <div class="hp-track"><div class="hp-fill" id="battle-slime-hp" style="width:100%"></div></div>
        </div>
      </div>
    </div>
    <p class="muted" id="battle-status">Click the slime to attack!</p>
    <div class="scene-actions">
      <button class="primary" id="battle-attack-btn">⚔️ Attack!</button>
    </div>`;

  const attacker = document.getElementById('battle-attacker');
  const defender = document.getElementById('battle-defender');
  const companionHpFill = document.getElementById('battle-companion-hp');
  const slimeHpFill = document.getElementById('battle-slime-hp');
  const status = document.getElementById('battle-status');
  const attackBtn = document.getElementById('battle-attack-btn');
  const skipBtn = document.getElementById('scene-skip-btn');

  let companionHp = BATTLE_COMPANION_MAX_HP;
  let slimeHp = BATTLE_SLIME_MAX_HP;
  let battleOver = false;
  let clickReady = true;

  const flash = (el, animClass) => {
    el.classList.remove(animClass);
    void el.offsetWidth; // restart animation
    el.classList.add(animClass);
  };

  const endBattle = (won) => {
    battleOver = true;
    clearInterval(slimeAttackTimer);
    attackBtn.disabled = true;
    skipBtn.style.display = 'none';

    if (won) {
      status.textContent = 'Victory!';
      setTimeout(() => finishQuest(quest, companion, onDone), 700);
    } else {
      status.textContent = `${companion.character_name} was knocked out...`;
      sceneOverlay.querySelector('.scene-actions').innerHTML = `
        <button class="primary" id="battle-retry-btn">Try Again</button>
        <button id="battle-retreat-btn">Retreat</button>`;
      document.getElementById('battle-retry-btn').addEventListener('click', () => playBattleScene(quest, companion, onDone));
      document.getElementById('battle-retreat-btn').addEventListener('click', () => { closeScene(); onDone(false); });
    }
  };

  const playerAttack = () => {
    if (battleOver || !clickReady) return;
    clickReady = false;
    setTimeout(() => { clickReady = true; }, BATTLE_CLICK_COOLDOWN_MS);

    const dmg = Math.floor(Math.random() * (BATTLE_CLICK_DAMAGE_MAX - BATTLE_CLICK_DAMAGE_MIN + 1)) + BATTLE_CLICK_DAMAGE_MIN;
    slimeHp = Math.max(0, slimeHp - dmg);
    slimeHpFill.style.width = `${(slimeHp / BATTLE_SLIME_MAX_HP) * 100}%`;
    flash(defender, 'hit');
    flash(attacker, 'lunge');

    if (slimeHp <= 0) endBattle(true);
  };

  const slimeAttack = () => {
    if (battleOver) return;
    const dmg = Math.floor(Math.random() * (BATTLE_SLIME_DAMAGE_MAX - BATTLE_SLIME_DAMAGE_MIN + 1)) + BATTLE_SLIME_DAMAGE_MIN;
    companionHp = Math.max(0, companionHp - dmg);
    companionHpFill.style.width = `${(companionHp / BATTLE_COMPANION_MAX_HP) * 100}%`;
    flash(defender, 'lunge'); // slime lunges toward the companion on its turn
    flash(attacker, 'hit');

    if (companionHp <= 0) endBattle(false);
  };

  attackBtn.addEventListener('click', playerAttack);
  defender.addEventListener('click', playerAttack);
  defender.style.cursor = 'pointer';

  const slimeAttackTimer = setInterval(slimeAttack, BATTLE_SLIME_ATTACK_INTERVAL_MS);

  skipBtn.addEventListener('click', () => {
    clearInterval(slimeAttackTimer);
    battleOver = true;
    closeScene();
    onDone(false);
  });
};

// ---------- Plain fallback scene (custom/unknown quests) ----------

const playPlainScene = (quest, companion, onDone) => {
  sceneOverlay.hidden = false;
  sceneOverlay.innerHTML = `
    <p class="scene-title">${quest.quest_title}</p>
    <div class="scene-stage">${characterSprite(companion.character_name, companion.element, 240)}</div>
    <div class="scene-actions">
      <button class="primary" id="scene-confirm-btn">Complete Quest</button>
      <button id="scene-cancel-btn">Cancel</button>
    </div>`;
  document.getElementById('scene-confirm-btn').addEventListener('click', () => finishQuest(quest, companion, onDone));
  document.getElementById('scene-cancel-btn').addEventListener('click', () => { closeScene(); onDone(false); });
};

/**
 * Entry point — dispatches to the right scene based on quest title.
 * @param {Object} quest
 * @param {Object} companion
 * @param {(success: boolean) => void} onDone
 */
const playQuestScene = (quest, companion, onDone) => {
  const type = classifyQuest(quest.quest_title);
  if (type === 'npc') return playNpcScene(quest, companion, onDone);
  if (type === 'explore') return playExploreScene(quest, companion, onDone);
  if (type === 'battle') return playBattleScene(quest, companion, onDone);
  return playPlainScene(quest, companion, onDone);
};
