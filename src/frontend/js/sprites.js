// Sprite helper — renders an <img> that falls back gracefully if an asset
// doesn't exist. Items try their own specific artwork first, then a
// category icon, then an emoji — so the site works with or without full
// art coverage, and upgrades automatically the moment files are dropped
// into src/frontend/assets/ using the naming convention in assets/README.md.

const ELEMENT_COLORS = {
  anemo: '#6bd3b0', geo: '#d9a441', hydro: '#4f9fe0', pyro: '#e2694b',
  cryo: '#8fd6e8', electro: '#b17fe0', dendro: '#8fc24a',
};

const slugify = (name) => name.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');

/** Slug an item name for its specific art file, e.g. "Tulaytullah's Remembrance" -> "tulaytullahs-remembrance" */
const itemSlug = (name) => name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Advance an <img> to the next URL in a fallback chain when it fails to load.
 * Called from inline onerror. Once the chain is exhausted, swaps the <img>
 * for a text/emoji badge instead of leaving a broken image icon.
 * Exposed on window so inline onerror="" attributes can reach it.
 */
window.spriteFallback = (img, remainingUrls, finalText, finalStyle) => {
  if (remainingUrls.length > 0) {
    const [next, ...rest] = remainingUrls;
    img.onerror = () => window.spriteFallback(img, rest, finalText, finalStyle);
    img.src = next;
  } else {
    const badge = document.createElement('div');
    badge.className = 'sprite-fallback';
    badge.style.cssText = finalStyle;
    badge.textContent = finalText;
    img.replaceWith(badge);
  }
};

/** Build a sprite <div><img></div> with a fallback chain baked in via onerror. */
const spriteHtml = (primarySrc, fallbackChain, alt, size, borderRadius, finalText, finalStyle) => {
  const chainJson = JSON.stringify(fallbackChain).replace(/"/g, '&quot;');
  return `
    <div class="sprite" style="width:${size}px; height:${size}px; border-radius: ${borderRadius};">
      <img src="${primarySrc}" alt="${alt}"
           onerror="window.spriteFallback(this, ${chainJson}, '${finalText}', '${finalStyle}')">
    </div>`;
};

/** Companion sprite. Falls back to a colored initial badge tinted by element. */
const characterSprite = (characterName, element, size = 160) => {
  const src = `assets/characters/${slugify(characterName)}.png`;
  const color = ELEMENT_COLORS[element] || '#e8c468';
  const initial = characterName?.[0] || '?';
  return spriteHtml(src, [], characterName, size, '50%', initial, `font-size:${Math.floor(size * 0.45)}px; color:${color};`);
};

/** NPC sprite for food-request quest scenes. */
const npcSprite = (size = 140) =>
  spriteHtml(`assets/npc/npc-default.png`, [], 'NPC', size, '12px', '🧑', `font-size:${Math.floor(size * 0.4)}px;`);

/**
 * Monster sprite for battle scenes — tries the element-matched slime first
 * (thematically ties the quest to the companion's own element), then the
 * generic slime, then an emoji.
 */
const monsterSprite = (size = 140, element = null) => {
  const primary = element ? `assets/monsters/slime-${element}.png` : `assets/monsters/slime.png`;
  const fallbackChain = element ? [`assets/monsters/slime.png`] : [];
  return spriteHtml(primary, fallbackChain, 'Slime', size, '12px', '🟢', `font-size:${Math.floor(size * 0.4)}px;`);
};

/**
 * Item icon — tries the item's own specific artwork first (by item_name),
 * then a category icon, then an emoji. Covers both named art (weapons,
 * most food) and anything without dedicated art yet (outfits).
 */
const itemSprite = (itemName, category, weaponType, size = 48) => {
  const specific = `assets/items/${itemSlug(itemName)}.png`;
  const categoryFallback = category === 'weapon'
    ? `assets/items/weapon-${weaponType || 'sword'}.png`
    : `assets/items/${category}.png`;
  const emoji = category === 'food' ? '🍎' : category === 'weapon' ? '⚔️' : category === 'relic' ? '💎' : '👘';
  return spriteHtml(specific, [categoryFallback], itemName, size, '8px', emoji, `font-size:${Math.floor(size * 0.5)}px;`);
};
