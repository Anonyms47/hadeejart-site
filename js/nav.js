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

  const footerHost = document.getElementById('footerShopList');
  if (footerHost) {
    footerHost.innerHTML = entries.map(c =>
      `<li><a href="index.html${c.id === 'tous' ? '' : '?category=' + encodeURIComponent(c.id)}#catalogue" onclick="return handleNavLinkClick(event,'category','${escapeHtml(c.id)}')">${escapeHtml(c.label)}</a></li>`
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

/* ====== Suggestions (datalist) pour pays/ville/quartier/tissu/couleur ======
   Ces champs restent du texte libre (une adresse ou une couleur ne se
   limite pas à une liste fermée) mais gagnent un vrai comportement de
   liste déroulante native, traduite dans la langue active. N'existe que
   sur la page catalogue : ignoré ailleurs (éléments absents). */
function renderSuggestionDatalists() {
  const map = {
    colorSuggestions: 'suggest_colors',
    fabricSuggestions: 'suggest_fabrics',
    countrySuggestions: 'suggest_countries',
    citySuggestions: 'suggest_cities',
    districtSuggestions: 'suggest_districts'
  };
  Object.keys(map).forEach(id => {
    const host = document.getElementById(id);
    if (!host) return;
    const list = t(map[id]) || [];
    host.innerHTML = list.map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
  });
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

/* ====== Menu mobile plein écran ====== */
function openMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (!menu) return;
  document.body.classList.add('mobile-menu-open');
  menu.classList.add('show');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  const closeBtn = document.getElementById('mobileMenuClose');
  if (closeBtn) closeBtn.focus();
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (!menu) return;
  document.body.classList.remove('mobile-menu-open');
  menu.classList.remove('show');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function bindMobileMenu() {
  const openBtn = document.getElementById('hamburgerBtn');
  const closeBtn = document.getElementById('mobileMenuClose');
  const menu = document.getElementById('mobileMenu');
  if (!openBtn || !menu) return;

  openBtn.addEventListener('click', openMobileMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMobileMenu);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('show')) closeMobileMenu();
  });

  const langMobile = document.getElementById('langSelectMobile');
  if (langMobile) {
    langMobile.value = CURRENT_LANG;
    langMobile.addEventListener('change', () => setLang(langMobile.value));
  }
  const curMobile = document.getElementById('currencySelectMobile');
  if (curMobile) {
    curMobile.value = CURRENT_CURRENCY;
    curMobile.addEventListener('change', () => setCurrency(curMobile.value));
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
  document.querySelectorAll('.lang-select').forEach(sel => { sel.value = CURRENT_LANG; });
  document.querySelectorAll('.currency-select').forEach(sel => { sel.value = CURRENT_CURRENCY; });
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

/* ====== Câblage initial (appelé sur toutes les pages) ====== */
function initNav() {
  renderNavMenus();
  renderSuggestionDatalists();
  bindNavDropdowns();
  bindMobileMenu();
  bindFooterShortcuts();
  bindCartButton();
}
