/* ======================================================================
   Hadeej'Art — Navigation (menu Boutique/Collections/Infos, menu mobile
   plein écran, pied de page dynamique). Chargé sur TOUTES les pages
   (catalogue et pages de contenu) : chaque fonction se protège donc avec
   des vérifications d'existence des éléments plutôt que de supposer être
   sur index.html.

   Ouverture/fermeture des menus déroulants pilotée au clic/clavier (pas
   au survol seul : plus fiable au tactile et plus accessible qu'un menu
   purement CSS :hover).
   ====================================================================== */

/* Pages de contenu fixes (pas de données Supabase) listées dans la
   navigation du pied de page. Le header et le menu mobile pointent, eux,
   directement vers Boutique, Collections, Contact et FAQ (liens simples). */
function infoPageEntries() {
  return [
    { id: 'collections-page', href: 'collections.html', label: t('nav_collections_page') },
    { id: 'contact', href: 'contact.html', label: t('nav_contact') },
    { id: 'faq', href: 'faq.html', label: t('nav_faq') }
  ];
}

/* Sur index.html uniquement, un clic sur un lien catégorie filtre le
   catalogue en place (pas de rechargement). Sur toute autre page — y
   compris la page dédiée d'une collection (collection.html), qui a elle
   aussi un #productGrid mais pas de filtres de catégories — le lien
   navigue normalement vers index.html?...#catalogue (fonctionne aussi
   sans JavaScript). Sans ça, cliquer une catégorie depuis la page d'une
   collection filtrait ses produits sur place tout en gardant le bandeau
   (nom, photo) de l'ancienne collection affiché : trompeur. Une
   collection, elle, a toujours sa propre page : son lien navigue
   normalement, jamais de filtre. */
function handleNavLinkClick(e, kind, id) {
  if (kind === 'collection') return true;
  const onIndexCatalogue = document.getElementById('categoryFilters');
  if (!onIndexCatalogue) return true;
  e.preventDefault();
  if (kind === 'category' && typeof selectCategory === 'function') selectCategory(id);
  return false;
}

/* ====== Menu "Boutique" (catégories), "Collections" et "Infos" ======
   Les menus déroulants du header/mobile (conteneurs <div>) et les listes
   du pied de page (<ul><li>) partagent les mêmes données mais pas le même
   balisage : on génère donc les deux séparément plutôt que de réutiliser
   le même innerHTML dans un <ul> (ce qui serait du HTML invalide). */
function shopMenuEntries() {
  return [{ id: 'tous', label: t('nav_all_items'), all: true }]
    .concat(CATEGORIES.filter(c => c.id !== 'tous'));
}

function renderShopMenu() {
  const entries = shopMenuEntries();
  const dropHtml = entries.map((c, i) => `
    <a href="index.html${c.id === 'tous' ? '' : '?category=' + encodeURIComponent(c.id)}#catalogue"
       class="nav-drop-item" style="--i:${i}" onclick="return handleNavLinkClick(event,'category','${escapeHtml(c.id)}')">
      <span class="swatch${c.all ? ' swatch-all' : ''}" aria-hidden="true"></span>
      <span>${escapeHtml(c.label)}</span>
    </a>`).join('');
  ['navShopMenu', 'mobileShopList'].forEach(id => {
    const host = document.getElementById(id);
    if (host) host.innerHTML = dropHtml;
  });

  /* Le pied de page liste les six catégories réelles uniquement (pas
     l'entrée "Toutes les pièces", pertinente dans un menu déroulant mais
     redondante avec le lien "Boutique" déjà présent dans la navigation
     du footer). */
  const footerHost = document.getElementById('footerShopList');
  if (footerHost) {
    footerHost.innerHTML = entries.filter(c => !c.all).map(c =>
      `<li><a href="index.html?category=${encodeURIComponent(c.id)}#catalogue" onclick="return handleNavLinkClick(event,'category','${escapeHtml(c.id)}')">${escapeHtml(c.label)}</a></li>`
    ).join('');
  }
}

function renderCollectionsMenu() {
  const dropHtml = COLLECTIONS.length
    ? COLLECTIONS.map((c, i) => `
      <a href="collection.html?slug=${encodeURIComponent(c.id)}" class="nav-drop-item" style="--i:${i}">
        <span class="swatch${c.cover ? '' : ' swatch-generic'}" aria-hidden="true"${c.cover ? ` style="background-image:url('${escapeHtml(c.cover)}')"` : ''}></span>
        <span>${escapeHtml(c.label)}</span>
      </a>`).join('')
    : `<p class="nav-drop-empty">${escapeHtml(t('nav_collections_empty'))}</p>`;
  ['navCollectionsMenu', 'mobileCollectionsList'].forEach(id => {
    const host = document.getElementById(id);
    if (host) host.innerHTML = dropHtml;
  });

  const footerHost = document.getElementById('footerCollectionsList');
  if (footerHost) {
    footerHost.innerHTML = COLLECTIONS.length
      ? COLLECTIONS.map(c => `<li><a href="collection.html?slug=${encodeURIComponent(c.id)}">${escapeHtml(c.label)}</a></li>`).join('')
      : '';
    footerHost.setAttribute('data-empty', COLLECTIONS.length ? '' : t('nav_collections_empty'));
  }
}

function renderInfoMenu() { /* liste du pied de page uniquement */
  const entries = infoPageEntries();
  const path = (location.pathname.split('/').pop() || 'index.html');

  const footerHost = document.getElementById('footerInfoList');
  if (footerHost) {
    footerHost.innerHTML = entries.map(p =>
      `<li><a href="${p.href}"${path === p.href ? ' aria-current="page"' : ''}>${escapeHtml(p.label)}</a></li>`
    ).join('');
  }
}

/* Reconstruit tous les menus (header, mobile, footer) : appelé au premier
   rendu, après chargement des données Supabase et à chaque changement de
   langue. */
function renderNavMenus() {
  renderShopMenu();
  renderCollectionsMenu();
  renderInfoMenu();
}

/* ====== Ouverture/fermeture des menus déroulants du header ====== */
function closeAllNavMenus() {
  document.querySelectorAll('.main-nav .nav-item.open').forEach(item => {
    item.classList.remove('open');
    const btn = item.querySelector('.nav-link');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
  closeMobileMenu();
}

function toggleNavMenu(item) {
  const isOpen = item.classList.contains('open');
  closeAllNavMenus();
  if (!isOpen) {
    item.classList.add('open');
    const btn = item.querySelector('.nav-link');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
}

function bindNavDropdowns() {
  document.querySelectorAll('.main-nav .nav-item').forEach(item => {
    const btn = item.querySelector('.nav-link');
    const dropdown = item.querySelector('.dropdown');
    if (!btn) return;
    btn.addEventListener('click', e => { e.stopPropagation(); toggleNavMenu(item); });
    btn.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeAllNavMenus(); btn.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!item.classList.contains('open')) toggleNavMenu(item);
        const first = dropdown && dropdown.querySelector('.nav-drop-item');
        if (first) first.focus();
      }
    });
    if (dropdown) {
      dropdown.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeAllNavMenus(); btn.focus(); }
      });
    }
  });
  document.addEventListener('click', () => closeAllNavMenus());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllNavMenus(); });
  /* Un changement de page (retour navigateur depuis le cache, etc.) ne
     doit jamais laisser un menu affiché par erreur. */
  window.addEventListener('pageshow', () => closeAllNavMenus());
}

/* Échap ferme le panneau le plus "au-dessus" — visionneuse, fiche
   détail, fiche client — indépendamment des menus (gérés séparément
   ci-dessus). Un seul écouteur global, appelé une fois. */
function bindOverlayEscape() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTopmostOverlay();
  });
}

/* ====== Menu mobile plein écran ====== */
function openMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (!menu || menu.classList.contains('show')) return;
  menu.classList.add('show');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  lockBodyScroll();
  pushOverlayHistory();
  const closeBtn = document.getElementById('mobileMenuClose');
  if (closeBtn) closeBtn.focus();
}

function closeMobileMenu(viaPopstate) {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (!menu || !menu.classList.contains('show')) return;
  menu.classList.remove('show');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  unlockBodyScroll();
  if (!viaPopstate) consumeOverlayHistory();
}

/* ====== Priorité de fermeture pour Échap / bouton "retour" ======
   Appelé sur chaque page (catalogue et pages de contenu) : ne ferme que
   le panneau le plus "au-dessus", du plus imbriqué (visionneuse plein
   écran, ouverte depuis la fiche produit) au moins imbriqué. Les
   fonctions référencées n'existent pas toutes sur toutes les pages, d'où
   les vérifications typeof. */
function closeTopmostOverlay(viaPopstate) {
  const lightbox = document.getElementById('imgViewer');
  if (lightbox && lightbox.classList.contains('show') && typeof closeImageViewer === 'function') {
    closeImageViewer(viaPopstate); return;
  }
  const done = document.getElementById('orderDone');
  if (done && done.classList.contains('show') && typeof closeOrderDone === 'function') {
    closeOrderDone(viaPopstate); return;
  }
  const detail = document.getElementById('detail');
  if (detail && detail.classList.contains('show') && typeof closeDetail === 'function') {
    closeDetail(viaPopstate); return;
  }
  const client = document.getElementById('client');
  if (client && client.classList.contains('show') && typeof closeClient === 'function') {
    closeClient(viaPopstate); return;
  }
  const menu = document.getElementById('mobileMenu');
  if (menu && menu.classList.contains('show')) { closeMobileMenu(viaPopstate); return; }
}

function bindMobileMenu() {
  const openBtn = document.getElementById('hamburgerBtn');
  const closeBtn = document.getElementById('mobileMenuClose');
  const menu = document.getElementById('mobileMenu');
  if (!openBtn || !menu) return;

  /* stopPropagation : sinon le même clic continue sa bulle jusqu'à
     document, où le clic "en dehors" du menu Boutique/Collections/Infos
     (voir bindNavDropdowns) referme aussitôt tout — y compris ce menu
     qu'on vient d'ouvrir. Même précaution que sur les boutons de menu. */
  openBtn.addEventListener('click', e => { e.stopPropagation(); openMobileMenu(); });
  if (closeBtn) closeBtn.addEventListener('click', e => { e.stopPropagation(); closeMobileMenu(); });
  /* Échap : voir bindOverlayEscape(), qui gère tous les panneaux via
     closeTopmostOverlay() (visionneuse > fiche détail > fiche client >
     menu mobile). */

  const langMobile = document.getElementById('langSelectMobile');
  if (langMobile) {
    langMobile.value = CURRENT_LANG;
    langMobile.addEventListener('change', () => setLang(langMobile.value));
    if (typeof enhanceSelect === 'function') enhanceSelect(langMobile);
  }
  const curMobile = document.getElementById('currencySelectMobile');
  if (curMobile) {
    curMobile.value = CURRENT_CURRENCY;
    curMobile.addEventListener('change', () => setCurrency(curMobile.value));
    if (typeof enhanceSelect === 'function') enhanceSelect(curMobile);
  }

  const waLink = document.getElementById('mobileWaLink');
  if (waLink) waLink.href = `https://wa.me/${SITE_WA_NUMBER}`;
}

/* ====== Panier : ouverture in-page sur le catalogue, lien simple ailleurs ====== */
function bindCartButton() {
  const btn = document.getElementById('cartBtn');
  if (!btn) return;
  if (document.getElementById('cartPanel')) {
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'cartPanel');
  }
  btn.addEventListener('click', e => {
    if (typeof toggleCart === 'function' && document.getElementById('cartPanel')) {
      e.preventDefault();
      toggleCart();
    }
    /* Sinon (pages de contenu) : le lien href="index.html" navigue
       normalement, y compris sans JavaScript. */
  });
}

/* ====== Pied de page : liens WhatsApp + raccourcis langue/devise ====== */
function bindFooterShortcuts() {
  const waLink = document.getElementById('footerWaLink');
  if (waLink) waLink.href = `https://wa.me/${SITE_WA_NUMBER}`;
  document.querySelectorAll('[data-wa]').forEach(a => { a.href = `https://wa.me/${SITE_WA_NUMBER}`; });

  document.querySelectorAll('button[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  document.querySelectorAll('button[data-currency]').forEach(btn => {
    btn.addEventListener('click', () => setCurrency(btn.dataset.currency));
  });
  refreshFooterShortcutsState();
}

function refreshFooterShortcutsState() {
  document.querySelectorAll('button[data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === CURRENT_LANG);
  });
  document.querySelectorAll('button[data-currency]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.currency === CURRENT_CURRENCY);
  });
}

/* Garde les sélecteurs langue/devise du header, du menu mobile et du pied
   de page synchronisés entre eux (un changement fait depuis n'importe
   lequel doit se refléter partout). */
function syncLangCurrencyControls() {
  document.querySelectorAll('.lang-select').forEach(sel => {
    sel.value = CURRENT_LANG;
    if (typeof refreshEpicSelect === 'function') refreshEpicSelect(sel);
  });
  document.querySelectorAll('.currency-select').forEach(sel => {
    sel.value = CURRENT_CURRENCY;
    if (typeof refreshEpicSelect === 'function') refreshEpicSelect(sel);
  });
  refreshFooterShortcutsState();
}

/* ====== Panier animé ====== */
function bumpCartIcon() {
  const btn = document.getElementById('cartBtn');
  if (!btn) return;
  btn.classList.remove('bump');
  void btn.offsetWidth; /* relance l'animation même si elle vient de jouer */
  btn.classList.add('bump');
}

/* ====== Langue / devise du header (pastilles non-mobiles) ======
   Câblé ici plutôt que dans checkout.js/main.js (index.html uniquement) :
   le header et ses sélecteurs sont partagés par TOUTES les pages (Infos,
   pages légales...), qui n'incluent pas checkout.js/catalogue.js. Sans ce
   câblage commun, le sélecteur du header restait inerte (aucun
   "change") en dehors du catalogue. */
function bindHeaderLangCurrency() {
  const langSel = document.getElementById('langSelect');
  if (langSel) {
    langSel.value = CURRENT_LANG;
    langSel.addEventListener('change', () => setLang(langSel.value));
    if (typeof enhanceSelect === 'function') enhanceSelect(langSel);
  }
  const curSel = document.getElementById('currencySelect');
  if (curSel) {
    curSel.value = CURRENT_CURRENCY;
    curSel.addEventListener('change', () => setCurrency(curSel.value));
    if (typeof enhanceSelect === 'function') enhanceSelect(curSel);
  }
}

/* ====== Indicateur de page active dans la navigation du header ======
   Déduit du nom de fichier : pas de second système de navigation, juste une
   classe posée sur l'entrée de menu qui contient la page courante. */
function markCurrentNav() {
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const home = file === 'index.html' || file === '';
  /* Entrées du header : Boutique et Collections (menus), Contact et FAQ
     (liens simples). Sur l'accueil, "Boutique" est l'entrée courante. */
  const currentId = home ? 'navShop' : ({ 'collections.html': 'navCollections', 'contact.html': 'navContact', 'faq.html': 'navFaq' })[file];
  document.querySelectorAll('.main-nav .nav-item, .main-nav .nav-plain').forEach(item => {
    const on = item.id === currentId;
    item.classList.toggle('is-current', on);
    const btn = item.matches('.nav-link') ? item : item.querySelector('.nav-link');
    if (btn) {
      if (on) btn.setAttribute('aria-current', item.matches('.nav-plain') ? 'page' : 'true');
      else btn.removeAttribute('aria-current');
    }
  });
  /* Menu mobile : le lien de la page courante est mis en avant. */
  document.querySelectorAll('.mobile-link').forEach(a => {
    const target = (a.getAttribute('href') || '').split('#')[0].toLowerCase();
    const isCurrent = target === file || (home && target === 'index.html');
    if (isCurrent) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/* Le logo est un vrai lien (href="index.html", fonctionne sans JS). Sur
   l'accueil, on remonte simplement en haut plutôt que de recharger. */
function bindBrandLink() {
  document.querySelectorAll('a.brand').forEach(a => {
    a.addEventListener('click', e => {
      const file = location.pathname.split('/').pop();
      if (file !== '' && file !== 'index.html') return;
      e.preventDefault();
      const menu = document.getElementById('mobileMenu');
      if (menu && menu.classList.contains('show') && typeof closeMobileMenu === 'function') closeMobileMenu();
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  });
}

/* Accordéons du pied de page : ouverts sur ordinateur, repliés sur mobile
   (le pied de page y est ainsi bien plus court). Sans JS, ils restent
   ouverts (attribut open dans le HTML). L'utilisateur garde la main : on ne
   resynchronise qu'au franchissement du seuil. */
function bindFooterAccordions() {
  const mq = window.matchMedia('(max-width: 640px)');
  const sync = () => document.querySelectorAll('.footer-accordion').forEach(d => { d.open = !mq.matches; });
  sync();
  if (mq.addEventListener) mq.addEventListener('change', sync);
}

/* ====== Pied de page : réseaux sociaux (si configurés) et Carnet de Tissus ====== */
const SOCIAL_ICONS = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.2a3.4 3.4 0 1 1-3.4-3.4M14 3c.3 2.4 1.9 4 4.5 4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  snapchat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c2.6 0 4.2 1.9 4.2 4.4v2.2c.5.3 1.3.4 1.9.5-.1.5-.8.7-1.4.9.3.8 1 1.5 2 1.9-.3.5-1.3.6-2 .8-.2.5-.7.9-1.5.8-.6-.1-1.1-.1-1.5.2-.6.4-1.2.9-1.7.9s-1.1-.5-1.7-.9c-.4-.3-.9-.3-1.5-.2-.8.1-1.3-.3-1.5-.8-.7-.2-1.7-.3-2-.8 1-.4 1.7-1.1 2-1.9-.6-.2-1.3-.4-1.4-.9.6-.1 1.4-.2 1.9-.5V7.6c0-2.5 1.6-4.4 4.2-4.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
};
const SOCIAL_LABELS = { instagram: 'Instagram', snapchat: 'Snapchat', tiktok: 'TikTok' };

function renderFooterSocial() {
  const host = document.getElementById('mfSocial');
  if (!host || typeof SITE_SOCIAL === 'undefined') return;
  const items = ['instagram', 'tiktok', 'snapchat'].filter(k => /^https:\/\//.test(SITE_SOCIAL[k] || ''));
  host.hidden = !items.length;
  host.innerHTML = items.map(k => `<li><a href="${escapeHtml(SITE_SOCIAL[k])}" target="_blank" rel="noopener" aria-label="${SOCIAL_LABELS[k]}">${SOCIAL_ICONS[k]}</a></li>`).join('');
}

function bindVipForm() {
  const form = document.getElementById('mfVipForm');
  if (!form || form._haBound) return;
  form._haBound = true;
  const input = document.getElementById('mfVipInput'), msg = document.getElementById('mfVipMsg'), btn = document.getElementById('mfVipBtn');
  const say = (key, ok) => { msg.textContent = t(key); msg.classList.toggle('ok', !!ok); msg.classList.toggle('err', !ok); };
  const valid = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || (/^[0-9+ ().-]{6,30}$/.test(v) && v.replace(/\D/g, '').length >= 9 && v.replace(/\D/g, '').length <= 15);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.website && form.website.value) return;        /* champ piège : robot */
    const v = input.value.trim();
    input.setAttribute('aria-invalid', 'false');
    if (!valid(v)) { input.setAttribute('aria-invalid', 'true'); say('ft_vip_invalid', false); input.focus(); return; }
    btn.disabled = true; msg.textContent = ''; msg.classList.remove('ok', 'err');
    try {
      await subscribeNewsletter(v);
      say('ft_vip_ok', true); input.value = '';
    } catch (err) { say('ft_vip_error', false); }
    btn.disabled = false;
  });
  input.addEventListener('input', () => input.setAttribute('aria-invalid', 'false'));
}

/* ====== Pied de page : ruban défilant, apparition progressive, retour en haut ====== */
function enhanceFooter() {
  const mf = document.querySelector('.mf');
  if (!mf || mf._haEnhanced) return;
  mf._haEnhanced = true;

  /* Ruban de mots (décoratif, masqué aux lecteurs d'écran, figé si mouvement réduit) */
  const words = [t('footer_tagline'), 'Wax', 'Dakar', 'Jërëjëf'];
  const unit = words.map(w => `<span>${escapeHtml(w)}</span><i aria-hidden="true">◆</i>`).join('');
  const band = document.createElement('div');
  band.className = 'mf-marquee'; band.setAttribute('aria-hidden', 'true');
  band.innerHTML = `<div class="mf-track">${unit.repeat(6)}</div>`;
  mf.querySelector('.mf-stitch').after(band);

  /* Retour en haut de page */
  const util = mf.querySelector('.mf-util');
  if (util && !mf.querySelector('.mf-top')) {
    const top = document.createElement('button');
    top.type = 'button'; top.className = 'mf-top'; top.setAttribute('aria-label', t('ft_top')); top.title = t('ft_top');
    top.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    top.addEventListener('click', () => {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    util.appendChild(top);
  }

  /* Animations décoratives en pause tant que le pied de page est hors écran (économie GPU/batterie) */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => es.forEach(e => mf.classList.toggle('mf-off', !e.isIntersecting)), { rootMargin: '120px' }).observe(mf);
  }

  /* Apparition progressive des blocs quand le pied de page entre à l'écran */
  if ('IntersectionObserver' in window && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    mf.classList.add('mf-js');
    const items = mf.querySelectorAll('.mf-label, .mf-col, .mf-pay, .mf-util, .mf-wordmark');
    items.forEach((el, i) => { el.classList.add('mf-rv'); el.style.setProperty('--mf-d', (i * 70) + 'ms'); });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('mf-in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    items.forEach(el => io.observe(el));
    /* Filet de sécurité : en bas de page, tout est révélé même si l'observateur tarde. */
    window.addEventListener('scroll', () => {
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) items.forEach(el => el.classList.add('mf-in'));
    }, { passive: true });
  }
}

/* ====== Câblage initial (appelé sur toutes les pages) ====== */
function initNav() {
  enhanceFooter();
  renderFooterSocial();
  bindVipForm();
  markCurrentNav();
  bindBrandLink();
  bindFooterAccordions();
  renderNavMenus();
  bindNavDropdowns();
  bindHeaderLangCurrency();
  bindMobileMenu();
  bindFooterShortcuts();
  bindCartButton();
  bindOverlayEscape();
}

/* ======================================================================
   Accueil international : on PROPOSE (jamais d'office) l'anglais et la devise
   du pays du visiteur à sa première visite. Rien n'est changé sans son accord,
   et la page reste en français pour les moteurs de recherche. Un clic sur
   « Oui » enregistre le choix ; la croix le refuse définitivement.
   ====================================================================== */
(function () {
  const FR_REGIONS = ['SN', 'FR', 'BE', 'CH', 'LU', 'MC', 'ML', 'CI', 'GN', 'MR', 'BF', 'BJ', 'TG', 'NE', 'CM', 'MA', 'DZ', 'TN', 'CD', 'CG', 'GA', 'MG', 'HT', 'GW', 'TD', 'CF'];
  const CFA = ['SN', 'ML', 'CI', 'BF', 'BJ', 'TG', 'NE', 'GW', 'CM', 'GA', 'CG', 'TD', 'CF', 'GQ'];
  const EUR_REGIONS = ['FR', 'BE', 'DE', 'ES', 'IT', 'PT', 'NL', 'LU', 'IE', 'AT', 'FI', 'GR', 'MC', 'SM', 'VA', 'MT', 'CY', 'SK', 'SI', 'EE', 'LV', 'LT', 'HR',
    'GB', 'CH', 'SE', 'DK', 'NO', 'PL', 'CZ', 'HU', 'RO', 'BG', 'IS', 'MA', 'DZ', 'TN'];
  const CUR_NAME = { EUR: 'euros (€)', USD: 'dollars US ($)', FCFA: 'FCFA' };

  function guess() {
    const tags = ((navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || '']).map(x => String(x || '').trim());
    let region = '', lang = '';
    for (const tag of tags) {
      const [base, , r] = tag.replace('_', '-').split('-').concat(['', '']);
      const reg = (tag.replace('_', '-').split('-').find((p, i) => i > 0 && /^[A-Za-z]{2}$/.test(p)) || '').toUpperCase();
      if (!region && reg) region = reg;
      if (!lang && SUPPORTED_LANGS.includes(String(base).toLowerCase())) lang = String(base).toLowerCase();
    }
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (!lang) lang = FR_REGIONS.includes(region) ? 'fr' : 'en';
    let cur;
    if (region) cur = CFA.includes(region) ? 'FCFA' : (EUR_REGIONS.includes(region) ? 'EUR' : 'USD');
    else if (/^Africa\/(Dakar|Abidjan|Bamako|Conakry|Nouakchott|Ouagadougou|Lome|Niamey|Douala|Libreville)/.test(tz)) cur = 'FCFA';
    else if (/^Europe\//.test(tz)) cur = 'EUR';
    else if (/^(America|Asia|Australia|Pacific)\//.test(tz)) cur = 'USD';
    else cur = 'FCFA';
    return { lang, cur };
  }

  function show() {
    let seen = null, stored = null, storedCur = null;
    try { seen = localStorage.getItem('ha_welcome'); stored = localStorage.getItem('ha_lang'); storedCur = localStorage.getItem('ha_currency'); } catch (e) { return; }
    if (seen || document.getElementById('welcomeBar')) return;
    const g = guess();
    const needLang = !stored && g.lang !== CURRENT_LANG;
    const needCur = !storedCur && g.cur !== CURRENT_CURRENCY;
    if (!needLang && !needCur) return;

    const en = g.lang === 'en';                       /* langue du message : anglais ou français */
    const LANG_NAME = { fr: en ? 'French' : 'français', en: en ? 'English' : 'anglais', wo: en ? 'Wolof' : 'wolof' };
    const parts = [];
    if (needLang) parts.push(en ? `View this site in ${LANG_NAME[g.lang]}` : `Voir le site en ${LANG_NAME[g.lang]}`);
    if (needCur) parts.push(en ? `show prices in ${CUR_NAME[g.cur]}` : `afficher les prix en ${CUR_NAME[g.cur]}`);
    if (parts.length) parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const msg = (en ? 'Welcome! ' : 'Bienvenue ! ') + parts.join(en ? ' and ' : ' et ') + (en ? '?' : ' ?');

    const bar = document.createElement('div');
    bar.id = 'welcomeBar'; bar.className = 'welcome-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', en ? 'Language and currency' : 'Langue et devise');
    bar.innerHTML = `<span class="wb-msg"></span><span class="wb-act"><button type="button" class="wb-yes"></button><button type="button" class="wb-no" aria-label="${en ? 'No thanks' : 'Non merci'}">✕</button></span>`;
    bar.querySelector('.wb-msg').textContent = msg;
    bar.querySelector('.wb-yes').textContent = en ? 'Yes, switch' : 'Oui, changer';
    const done = () => { try { localStorage.setItem('ha_welcome', '1'); } catch (e) {} bar.remove(); };
    bar.querySelector('.wb-yes').addEventListener('click', () => { if (needLang) setLang(g.lang); if (needCur) setCurrency(g.cur); done(); });
    bar.querySelector('.wb-no').addEventListener('click', done);
    document.body.insertBefore(bar, document.body.firstChild);
  }
  document.addEventListener('DOMContentLoaded', () => { try { setTimeout(show, 900); } catch (e) { /* jamais bloquant */ } });
})();
