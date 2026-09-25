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

/* Pages de contenu fixes (pas de données Supabase) : accessibles depuis
   le header (menu "Infos"), le menu mobile et le footer. */
function infoPageEntries() {
  return [
    { id: 'story', href: 'notre-histoire.html', label: t('nav_our_story') },
    { id: 'collections-page', href: 'collections.html', label: t('nav_collections_page') },
    { id: 'journal', href: 'journal.html', label: t('nav_journal') },
    { id: 'contact', href: 'contact.html', label: t('nav_contact') },
    { id: 'faq', href: 'faq.html', label: t('nav_faq') }
  ];
}

/* Sur index.html, un clic sur un lien catégorie/collection filtre le
   catalogue en place (pas de rechargement). Sur toute autre page, le lien
   navigue normalement vers index.html?...#catalogue (fonctionne aussi
   sans JavaScript). */
function handleNavLinkClick(e, kind, id) {
  const onCatalogPage = document.getElementById('productGrid');
  if (!onCatalogPage) return true;
  e.preventDefault();
  if (kind === 'category' && typeof selectCategory === 'function') selectCategory(id);
  if (kind === 'collection' && typeof selectCollection === 'function') selectCollection(id);
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
      <a href="index.html?collection=${encodeURIComponent(c.id)}#catalogue" class="nav-drop-item" style="--i:${i}"
         onclick="return handleNavLinkClick(event,'collection','${escapeHtml(c.id)}')">
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
      ? COLLECTIONS.map(c => `<li><a href="index.html?collection=${encodeURIComponent(c.id)}#catalogue" onclick="return handleNavLinkClick(event,'collection','${escapeHtml(c.id)}')">${escapeHtml(c.label)}</a></li>`).join('')
      : '';
    footerHost.setAttribute('data-empty', COLLECTIONS.length ? '' : t('nav_collections_empty'));
  }
}

function renderInfoMenu() {
  const entries = infoPageEntries();
  const path = (location.pathname.split('/').pop() || 'index.html');
  const dropHtml = entries.map((p, i) => `
    <a href="${p.href}" class="nav-drop-item${path === p.href ? ' current' : ''}" style="--i:${i}">
      <span class="swatch swatch-generic" aria-hidden="true"></span>
      <span>${escapeHtml(p.label)}</span>
    </a>`).join('');
  ['navInfoMenu', 'mobileInfoList'].forEach(id => {
    const host = document.getElementById(id);
    if (host) host.innerHTML = dropHtml;
  });

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

  document.querySelectorAll('#footerLangRow [data-lang]').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  document.querySelectorAll('#footerCurrencyRow [data-currency]').forEach(btn => {
    btn.addEventListener('click', () => setCurrency(btn.dataset.currency));
  });
  refreshFooterShortcutsState();
}

function refreshFooterShortcutsState() {
  document.querySelectorAll('#footerLangRow [data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === CURRENT_LANG);
  });
  document.querySelectorAll('#footerCurrencyRow [data-currency]').forEach(btn => {
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
  const map = {
    'index.html': 'navShop', 'collections.html': 'navCollections',
    'notre-histoire.html': 'navInfo', 'journal.html': 'navInfo', 'contact.html': 'navInfo', 'faq.html': 'navInfo'
  };
  const id = map[file];
  document.querySelectorAll('.main-nav .nav-item').forEach(item => {
    const on = item.id === id;
    item.classList.toggle('is-current', on);
    const btn = item.querySelector('.nav-link');
    if (btn) { if (on) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current'); }
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

/* ====== Câblage initial (appelé sur toutes les pages) ====== */
function initNav() {
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
