const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const publishing = 'https://github.com/craftskillz/tessello-marketplace/blob/main/PUBLISHING.md';
const mark = '<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

// Fail visibly if a future pinned generator changes the markup this layer decorates.
function replaceOnce(html, before, after) {
  if (!html.includes(before)) throw new Error(`The generated layout has changed: missing ${before.slice(0, 80)}`);
  return html.replace(before, () => after);
}

export function decoratePage(html, path, index, host) {
  const home = path === 'index.html';
  const root = home ? '' : '../../../';
  html = replaceOnce(html, '<body>', `<body class="${home ? 'catalogue-page' : 'detail-page'}">
<a class="skip-link" href="#main">Skip to content</a>`);
  html = replaceOnce(html, `<header class="top"><a href="${root}index.html">Tessello Marketplace</a></header>`, `
<header class="top"><div class="nav-inner">
  <a class="brand" href="${root}index.html" aria-label="Tessello Marketplace home">${mark}<span>tessello<span class="brand-label">Marketplace</span></span></a>
  <nav aria-label="Main navigation"><a class="nav-current" href="${root}index.html"${home ? ' aria-current="page"' : ''}>Explore modules</a><a href="${publishing}">For creators <span aria-hidden="true">↗</span></a></nav>
  <a class="host-link" href="${escape(host)}">Open Tessello <span aria-hidden="true">↗</span></a>
</div></header>`);
  html = replaceOnce(html, '<main>', '<main id="main">');

  if (home) html = decorateCatalogue(html, index);
  else html = replaceOnce(html, '<main id="main">', `<main id="main"><a class="back-link" href="${root}index.html"><span aria-hidden="true">←</span> All modules</a>`);

  const footer = `<footer class="site-footer"><a class="brand footer-brand" href="${root}index.html">${mark}<span>tessello</span></a><p>A space that works your way.</p><a href="https://github.com/craftskillz/tessello-marketplace">Marketplace on GitHub <span aria-hidden="true">↗</span></a></footer>`;
  return replaceOnce(html, '</main>', `</main>\n${footer}`);
}

function decorateCatalogue(html, index) {
  // Only decorate cards the original renderer elected to show. Never infer availability here.
  const cards = [...html.matchAll(/<li class="card" data-id="([^"]+)">[\s\S]*?\n<\/div>\n<\/li>/g)];
  if (cards.length !== [...html.matchAll(/<li class="card" data-id=/g)].length) {
    throw new Error('The generated card layout has changed; update the presentation decorator.');
  }
  const visible = cards.map(card => index.modules.find(module => escape(module.id) === card[1]));
  if (visible.some(module => !module?.latest)) throw new Error('A generated card has no matching release.');
  const tiles = visible.slice(0, 4).map(module => `<div class="hero-tile"><img src="${escape(module.latest.icon)}" alt="" width="48" height="48"></div>`).join('');
  html = replaceOnce(html, '<h1>Modules for Tessello</h1>', `
<section class="hero" aria-labelledby="hero-title"><div class="hero-copy">
  <p class="eyebrow"><span aria-hidden="true">✳</span> MAKE ROOM FOR YOUR NEXT IDEA</p>
  <h1 id="hero-title">Small modules.<br>More <em>possibilities.</em></h1>
  <p class="hero-description">Thoughtful tools for your everyday. Discover modules that make your Tessello space feel like you.</p>
  <a class="hero-link" href="#collection">Find your next module <span aria-hidden="true">↓</span></a>
</div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="tile-grid">${tiles}</div><span class="art-caption">PIECE BY PIECE. MAKE IT YOURS.</span></div></section>
<section class="collection-heading" id="collection" aria-labelledby="collection-title"><div><p class="eyebrow">THE COLLECTION</p><h2 id="collection-title">Good tools. All in one place.</h2></div><p>${cards.length} module${cards.length === 1 ? '' : 's'} in the catalogue</p></section>`);
  html = replaceOnce(html, '<form class="controls" role="search">', '<form class="controls" role="search"><label class="search-field"><span class="search-icon" aria-hidden="true"></span>');
  html = replaceOnce(html, 'aria-label="Search">', 'aria-label="Search modules"></label><label class="filter-field"><span>Permissions</span>');
  html = replaceOnce(html, '</select>', '</select></label>');
  html = replaceOnce(html, '<ul class="cards" id="cards">', '<ul class="cards" id="cards" aria-label="Available modules">');
  for (let i = 0; i < cards.length; i++) {
    const [card] = cards[i];
    const module = visible[i];
    const screenshot = module.screenshots[0] || Object.values(module.latest.guide.images)[0];
    const cover = screenshot
      ? `<img src="${escape(screenshot)}" alt="" loading="lazy" width="1180" height="720">`
      : `<img class="cover-icon" src="${escape(module.latest.icon)}" alt="" width="80" height="80">`;
    let enhanced = card.replace(/(<li class="card"[^>]*>)/, opening => `${opening}\n<div class="card-cover" aria-hidden="true">${cover}</div><div class="card-body">`);
    enhanced = replaceOnce(enhanced, '\n</li>', `</div><div class="card-bottom"><span>${escape(module.license)} license <span aria-hidden="true">·</span> v${escape(module.latest.version)}</span><span class="card-cta" aria-hidden="true">Explore module <span>↗</span></span></div>\n</li>`);
    html = replaceOnce(html, card, enhanced);
  }
  html = replaceOnce(html, '<p id="empty" hidden>No Module matches your search.</p>', '<p id="empty" role="status" hidden>No modules found. Try another search or change the permission filter.</p>');
  html = replaceOnce(html, '<p class="generated">', `<aside class="creator-banner"><div><p class="eyebrow">BUILT SOMETHING USEFUL?</p><h2>Your next idea belongs here.</h2><p>Share your module with the Tessello community.</p></div><a class="creator-link" href="${publishing}">Publish a module <span aria-hidden="true">↗</span></a></aside><p class="generated">`);
  return html;
}
