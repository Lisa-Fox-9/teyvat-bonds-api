// Teyvat Bonds — main game dashboard.
// Single HTML page, tabbed views. Each view is rendered fresh from the API
// every time it's opened so the data is never stale.

auth.requireLogin();
const user = auth.getUser();

/**
 * Verify the cached session still points to a real account. A JWT can be
 * structurally valid (not expired, correctly signed) while the user_id it
 * carries no longer exists — e.g. the database was reseeded while someone
 * was still logged in. That's a 404, not a 401, so the normal "clear
 * session on 401" handling in api.js never catches it. This check runs
 * once on page load and force-logs-out if the account is gone, instead of
 * leaving the page stuck showing 404s for every request.
 */
const verifySession = async () => {
  try {
    await api(`/api/users/${user.user_id}`);
    return true;
  } catch (err) {
    auth.clearSession();
    window.location.href = 'login.html?expired=1';
    return false;
  }
};

const views = {
  companion: document.getElementById('view-companion'),
  quests: document.getElementById('view-quests'),
  shop: document.getElementById('view-shop'),
  inventory: document.getElementById('view-inventory'),
  arena: document.getElementById('view-arena'),
  leaderboard: document.getElementById('view-leaderboard'),
};

let companion = null; // the logged-in user's adopted companion, or null

const elementTag = (el) => `<span class="tag ${el}">${el}</span>`;

/** Refresh the coin counter shown in the topbar from the server. */
const refreshCoins = async () => {
  try {
    const fresh = await api(`/api/users/${user.user_id}`);
    document.getElementById('coins').textContent = fresh.coins;
    user.coins = fresh.coins;
    auth.setSession(auth.getToken(), user);
  } catch (err) { /* non-fatal — topbar just won't update this tick */ }
};

/** Try to load the logged-in user's companion. Sets `companion` to null if none adopted yet. */
const loadCompanion = async () => {
  try {
    companion = await api(`/api/user-characters/${user.user_id}`);
  } catch (err) {
    companion = null; // 404 "has not adopted a companion yet" is expected, not an error to surface
  }
};

// ---------- Companion tab ----------

const renderCompanionView = async () => {
  if (!companion) {
    views.companion.innerHTML = `<div class="panel"><p>Loading the roster...</p></div>`;
    const roster = await api('/api/roster');
    views.companion.innerHTML = `
      <div class="panel">
        <h2>Choose your companion</h2>
        <p class="muted">You haven't adopted anyone yet. Pick one elemental companion to begin.</p>
        <div class="card-grid mt">
          ${roster.map((r) => `
            <div class="card center">
              ${characterSprite(r.character_name, r.element, 120)}
              <h3 class="mt">${r.character_name}</h3>
              ${elementTag(r.element)} <span class="tag" style="background:rgba(232,196,104,0.15); color: var(--gold);">${r.weapon_type}</span>
              <p class="muted" style="margin: 0.6rem 0;">${r.description}</p>
              <button class="primary adopt-btn" data-id="${r.roster_id}">Adopt</button>
            </div>
          `).join('')}
        </div>
      </div>`;
    views.companion.querySelectorAll('.adopt-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Adopting...';
        try {
          await api(`/api/roster/${btn.dataset.id}/adopt`, { method: 'POST' });
          await loadCompanion();
          showFeedback(null, 'Companion adopted! 5 daily quests are ready for you.', 'success');
          renderCompanionView();
        } catch (err) {
          showFeedback(null, err.message);
          btn.disabled = false;
          btn.textContent = 'Adopt';
        }
      });
    });
    return;
  }

  const healthLabel = companion.is_healthy
    ? '<span class="tag" style="background: rgba(127,191,143,0.18); color: var(--success);">healthy</span>'
    : '<span class="tag" style="background: rgba(226,105,75,0.18); color: var(--danger);">unhealthy</span>';

  views.companion.innerHTML = `
    <div class="panel companion-hero">
      <div class="companion-hero-sprite">
        ${characterSprite(companion.character_name, companion.element, 400)}
      </div>
      <div class="companion-hero-info">
        <div class="topbar" style="margin-bottom: 0.5rem; align-items: flex-start;">
          <div>
            <h2>${companion.character_name} ${elementTag(companion.element)}</h2>
            <p class="muted">Weapon type: ${companion.weapon_type} · Level ${companion.level} · ${companion.xp} XP</p>
          </div>
          ${healthLabel}
        </div>
        <p>${companion.description}</p>

        <div class="stat-row"><span>Happiness</span><span>${companion.current_happiness}/100</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${companion.current_happiness}%"></div></div>

        <div class="mt" style="display:flex; gap:0.6rem; flex-wrap:wrap;">
          <button class="primary" id="feed-btn" ${!companion.is_healthy ? 'disabled' : ''}>Feed (+20)</button>
          <button id="play-btn" ${!companion.is_healthy || companion.current_happiness < 20 ? 'disabled' : ''}>Play (+10, needs ≥20)</button>
          <button class="danger" id="release-btn">Release Companion</button>
        </div>
      </div>
    </div>`;

  document.getElementById('feed-btn').addEventListener('click', () => careAction('feed'));
  document.getElementById('play-btn').addEventListener('click', () => careAction('play'));
  document.getElementById('release-btn').addEventListener('click', releaseCompanion);
};

const careAction = async (action) => {
  try {
    const result = await api(`/api/user-characters/${companion.user_character_id}/${action}`, { method: 'POST' });
    showFeedback(null, result.message, 'success');
    await loadCompanion();
    renderCompanionView();
  } catch (err) {
    showFeedback(null, err.message);
  }
};

const releaseCompanion = async () => {
  if (!confirm(`Release ${companion.character_name}? This also clears their quests.`)) return;
  try {
    await api(`/api/user-characters/${companion.user_character_id}`, { method: 'DELETE' });
    showFeedback(null, 'Companion released.', 'success');
    await loadCompanion();
    renderCompanionView();
  } catch (err) {
    showFeedback(null, err.message);
  }
};

// ---------- Quests tab ----------

const renderQuestsView = async () => {
  views.quests.innerHTML = `<div class="panel"><p>Loading quests...</p></div>`;
  if (!companion) {
    views.quests.innerHTML = `<div class="panel empty-state">Adopt a companion first to receive daily quests.</div>`;
    return;
  }
  const quests = await api(`/api/quests/${user.user_id}`);
  if (!quests.length) {
    views.quests.innerHTML = `<div class="panel empty-state">No quests right now.</div>`;
    return;
  }
  views.quests.innerHTML = `
    <div class="panel">
      <h2>Daily Quests</h2>
      <div class="card-grid">
        ${quests.map((q) => `
          <div class="card">
            <h3>${q.quest_title}</h3>
            <p class="muted">Reward: ${q.xp_reward} XP${q.reward_type === 'coins' ? ' + coins' : ''}${q.reward_type === 'random_item' ? ' + random item' : ''}</p>
            ${q.required_item_category ? `<p class="muted">Requires 1x ${q.required_item_category} in inventory</p>` : ''}
            <p><span class="tag" style="background:${q.status === 'completed' ? 'rgba(127,191,143,0.18)' : 'rgba(232,196,104,0.15)'}; color:${q.status === 'completed' ? 'var(--success)' : 'var(--gold)'};">${q.status}</span></p>
            <div style="display:flex; gap:0.5rem; margin-top:0.6rem;">
              <button class="primary complete-btn" data-id="${q.quest_id}" ${q.status === 'completed' ? 'disabled' : ''}>Complete</button>
              <button class="danger abandon-btn" data-id="${q.quest_id}">Abandon</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  views.quests.querySelectorAll('.complete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const quest = quests.find((q) => q.quest_id === btn.dataset.id);
      playQuestScene(quest, companion, async (success) => {
        if (success) {
          showFeedback(null, 'Quest complete!', 'success');
          await loadCompanion();
          refreshCoins();
        }
        renderQuestsView();
      });
    });
  });
  views.quests.querySelectorAll('.abandon-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/quests/${btn.dataset.id}`, { method: 'DELETE' });
        renderQuestsView();
      } catch (err) {
        showFeedback(null, err.message);
      }
    });
  });
};

// ---------- Shop tab ----------

const renderShopView = async () => {
  views.shop.innerHTML = `<div class="panel"><p>Loading shop...</p></div>`;
  const items = await api('/api/shop', { auth: false });
  views.shop.innerHTML = `
    <div class="panel">
      <h2>Shop</h2>
      <div class="card-grid">
        ${items.map((i) => `
          <div class="card center">
            ${itemSprite(i.item_name, i.category, i.weapon_type, 56)}
            <h3 class="mt">${i.item_name}</h3>
            <span class="tag" style="background:rgba(232,196,104,0.15); color: var(--gold);">${i.category}${i.weapon_type ? ' · ' + i.weapon_type : ''}</span>
            <p class="muted" style="margin: 0.6rem 0;">${i.description}</p>
            <p><strong>${i.cost} coins</strong></p>
            <button class="primary buy-btn" data-id="${i.item_id}">Buy</button>
          </div>
        `).join('')}
      </div>
    </div>`;
  views.shop.querySelectorAll('.buy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const result = await api('/api/shop/buy', { method: 'POST', body: { item_id: btn.dataset.id, quantity: 1 } });
        showFeedback(null, result.message, 'success');
        refreshCoins();
      } catch (err) {
        showFeedback(null, err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
};

// ---------- Inventory tab ----------

const renderInventoryView = async () => {
  views.inventory.innerHTML = `<div class="panel"><p>Loading inventory...</p></div>`;
  const items = await api(`/api/inventory/${user.user_id}`);
  if (!items.length) {
    views.inventory.innerHTML = `<div class="panel empty-state">Your inventory is empty. Visit the shop!</div>`;
    return;
  }
  views.inventory.innerHTML = `
    <div class="panel">
      <h2>Inventory</h2>
      <table>
        <thead><tr><th></th><th>Item</th><th>Category</th><th>Qty</th><th></th></tr></thead>
        <tbody>
          ${items.map((i) => `
            <tr>
              <td>${itemSprite(i.item_name, i.category, i.weapon_type, 36)}</td>
              <td>${i.item_name}${i.effect_type ? ` <span class="tag" style="background:rgba(216,145,245,0.15); color:#d891f5;">relic</span>` : ''}</td>
              <td>${i.category}</td>
              <td>${i.quantity}</td>
              <td style="display:flex; gap:0.4rem;">
                ${i.effect_type ? `<button class="primary use-btn" data-item="${i.item_id}">Use</button>` : ''}
                <button class="danger remove-btn" data-item="${i.item_id}">Remove</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  views.inventory.querySelectorAll('.use-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const result = await api(`/api/inventory/${user.user_id}/items/${btn.dataset.item}/use`, { method: 'POST' });
        showFeedback(null, result.message, 'success');
        await loadCompanion();
        renderInventoryView();
      } catch (err) {
        showFeedback(null, err.message);
        btn.disabled = false;
      }
    });
  });
  views.inventory.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/inventory/${user.user_id}/items/${btn.dataset.item}`, { method: 'DELETE' });
        renderInventoryView();
      } catch (err) {
        showFeedback(null, err.message);
      }
    });
  });
};

// ---------- Duel Arena tab (Core Mechanic 2) ----------

const renderArenaView = async () => {
  if (!companion) {
    views.arena.innerHTML = `<div class="panel empty-state">Adopt a companion first to enter the Duel Arena.</div>`;
    return;
  }
  const canDuel = companion.is_healthy && companion.current_happiness >= 30;
  views.arena.innerHTML = `
    <div class="panel">
      <h2>Duel Arena</h2>
      <div style="display:flex; gap:1.2rem; align-items:center; margin-bottom:0.8rem;">
        ${characterSprite(companion.character_name, companion.element, 80)}
        <p class="muted" style="margin:0;">Challenge a random rival companion. Costs 15 happiness — your companion needs at least 30 happiness and must be healthy to duel.</p>
      </div>
      <button class="primary" id="duel-btn" ${canDuel ? '' : 'disabled'}>Challenge a Rival</button>
      ${!canDuel ? `<p class="muted" style="margin-top:0.5rem;">Feed or play with ${companion.character_name} first.</p>` : ''}
    </div>
    <div class="panel" id="duel-history">
      <h2>Duel History</h2>
      <p class="muted">Loading...</p>
    </div>`;

  document.getElementById('duel-btn').addEventListener('click', async () => {
    const btn = document.getElementById('duel-btn');
    btn.disabled = true;
    btn.textContent = 'Dueling...';
    try {
      const result = await api('/api/duels', { method: 'POST', body: { user_character_id: companion.user_character_id } });
      showFeedback(null, result.message, result.result === 'win' ? 'success' : 'error');
      refreshCoins();
      await loadCompanion();
      renderArenaView();
    } catch (err) {
      showFeedback(null, err.message);
      btn.disabled = false;
      btn.textContent = 'Challenge a Rival';
    }
  });

  const history = await api(`/api/duels/${companion.user_character_id}`);
  const historyEl = document.getElementById('duel-history');
  if (!history.length) {
    historyEl.innerHTML += `<p class="empty-state">No duels fought yet.</p>`;
    return;
  }
  historyEl.innerHTML = `
    <h2>Duel History</h2>
    <table>
      <thead><tr><th>Opponent</th><th>Result</th><th>XP</th><th>Coins</th></tr></thead>
      <tbody>
        ${history.map((d) => `
          <tr>
            <td>${d.opponent_name} ${elementTag(d.opponent_element)}</td>
            <td style="color: ${d.result === 'win' ? 'var(--success)' : 'var(--danger)'}; text-transform: capitalize;">${d.result}</td>
            <td>+${d.xp_earned}</td>
            <td>${d.coins_earned ? '+' + d.coins_earned : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
};

// ---------- Leaderboard tab ----------

const renderLeaderboardView = async () => {
  views.leaderboard.innerHTML = `<div class="panel"><p>Loading leaderboard...</p></div>`;
  const board = await api('/api/duels/leaderboard/top', { auth: false });
  views.leaderboard.innerHTML = `
    <div class="panel">
      <h2>Leaderboard</h2>
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Companion</th><th>Level</th><th>Wins</th><th>Losses</th></tr></thead>
        <tbody>
          ${board.map((row, i) => `
            <tr ${row.username === user.username ? 'style="color: var(--gold);"' : ''}>
              <td>${i + 1}</td>
              <td>${row.username}</td>
              <td>${row.character_name}</td>
              <td>${row.level}</td>
              <td>${row.wins}</td>
              <td>${row.losses}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
};

// ---------- Tab wiring ----------

const renderers = {
  companion: renderCompanionView,
  quests: renderQuestsView,
  shop: renderShopView,
  inventory: renderInventoryView,
  arena: renderArenaView,
  leaderboard: renderLeaderboardView,
};

const switchTab = async (tab) => {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  Object.entries(views).forEach(([name, el]) => { el.hidden = name !== tab; });
  try {
    await renderers[tab]();
  } catch (err) {
    views[tab].innerHTML = `<div class="panel"><p class="feedback error">${err.message}</p></div>`;
  }
};

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (btn) switchTab(btn.dataset.tab);
});

document.getElementById('logout-btn').addEventListener('click', () => {
  auth.clearSession();
  window.location.href = 'login.html';
});

// ---------- Init ----------

(async () => {
  const sessionValid = await verifySession();
  if (!sessionValid) return; // verifySession already redirected to login

  document.getElementById('greeting').textContent = `Welcome, ${user.username}`;
  document.getElementById('coins').textContent = user.coins ?? 0;
  await refreshCoins();
  await loadCompanion();
  await switchTab('companion');
})();
