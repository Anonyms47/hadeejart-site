/* ======================================================================
   Hadeej'Art — Comportements d'interface généraux
   ====================================================================== */

/* Ombre de l'en-tête au scroll */
function bindHeaderScrollShadow() {
  const h = document.getElementById('siteHeader');
  if (!h) return;
  document.addEventListener('scroll', () => {
    if (window.scrollY > 8) h.classList.add('scrolled');
    else h.classList.remove('scrolled');
  });
}

/* ======================================================================
   Listes déroulantes "épiques" (langue / devise) — voir le commentaire
   CSS de .epic-select dans style.css : un <select> natif ne peut pas être
   stylé une fois ouvert (popup système), on construit donc un vrai widget
   bouton + liste ARIA (role="listbox") par-dessus, tout en gardant le
   <select> d'origine dans le DOM (masqué) pour que toute la logique
   existante (valeur, écouteurs "change", setLang/setCurrency...)
   continue de fonctionner sans aucune modification. Idempotent : peut
   être appelée plusieurs fois sans effet si déjà transformé. */
function enhanceSelect(select) {
  if (!select || select.dataset.epicSelect) return;
  select.dataset.epicSelect = '1';

  const wrap = document.createElement('div');
  wrap.className = 'epic-select';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  select.classList.add('epic-select-native');
  select.tabIndex = -1;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'epic-select-trigger' + (select.classList.contains('select-pill') ? ' select-pill' : '');
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="epic-select-label"></span>' +
    '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  wrap.appendChild(btn);

  /* La liste est ajoutée en fin de <body> (portail) et positionnée en
     "fixed" via des coordonnées calculées ci-dessous — jamais nichée dans
     .epic-select, sinon elle serait rognée par le overflow:hidden de la
     fiche détail/modale client dès qu'un select s'y trouve. */
  const listbox = document.createElement('div');
  listbox.className = 'epic-select-list';
  listbox.setAttribute('role', 'listbox');
  document.body.appendChild(listbox);

  const uid = 'epicopt-' + Math.random().toString(36).slice(2, 9);
  const optionLabel = opt => opt.textContent.trim();

  function renderOptions() {
    listbox.innerHTML = '';
    [...select.options].forEach((opt, i) => {
      const item = document.createElement('div');
      const isActive = i === select.selectedIndex;
      item.id = uid + '-' + i;
      item.className = 'epic-select-option' + (isActive ? ' active focus' : '');
      item.style.setProperty('--i', i);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      item.innerHTML = `<span>${optionLabel(opt)}</span><svg class="chk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>`;
      item.addEventListener('click', () => choose(i));
      listbox.appendChild(item);
    });
    syncActiveDescendant();
  }

  function syncActiveDescendant() {
    const focused = listbox.querySelector('.epic-select-option.focus');
    if (focused) btn.setAttribute('aria-activedescendant', focused.id);
    else btn.removeAttribute('aria-activedescendant');
  }

  function syncLabel() {
    const opt = select.options[select.selectedIndex];
    const labelEl = btn.querySelector('.epic-select-label');
    if (labelEl) labelEl.textContent = opt ? optionLabel(opt) : '';
    const ariaLabel = select.getAttribute('aria-label');
    if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
    if (select.title) btn.title = select.title;
  }

  function choose(i) {
    const changed = select.selectedIndex !== i;
    select.selectedIndex = i;
    if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    syncLabel();
    close();
    btn.focus();
  }

  function positionList() {
    const rect = btn.getBoundingClientRect();
    /* Champ pleine largeur (taille, sexe, variante — mais aussi la
       pastille langue/devise du menu mobile, étirée sur toute la largeur
       par .mobile-menu-prefs) : le panneau doit coller exactement à la
       largeur du champ. Pastille compacte du header (affichage en ligne,
       largeur au contenu) : une largeur forcée à celle du bouton fermé
       tronquait le texte des options (ex: "🇫🇷 FR" réduit à "F") — on
       laisse le panneau s'ajuster à son contenu (width:auto se comporte
       comme "shrink-to-fit" pour un élément fixed dont seul "left" est
       posé), avec le bouton comme largeur plancher via min-width. On
       distingue les deux cas par la mise en page réelle du conteneur
       (display:block = champ étiré) plutôt que par la classe .select-pill,
       qui est utilisée dans les deux contextes. */
    const isFullWidthField = getComputedStyle(wrap).display === 'block';
    listbox.style.minWidth = rect.width + 'px';
    listbox.style.width = isFullWidthField ? rect.width + 'px' : 'auto';
    const listWidth = listbox.getBoundingClientRect().width;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260 && rect.top > spaceBelow;
    listbox.classList.toggle('open-up', openUp);
    listbox.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - listWidth - 8)) + 'px';
    if (openUp) {
      listbox.style.top = 'auto';
      listbox.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    } else {
      listbox.style.bottom = 'auto';
      listbox.style.top = (rect.bottom + 8) + 'px';
    }
  }

  function open() {
    if (wrap.classList.contains('open')) return;
    renderOptions();
    positionList();
    wrap.classList.add('open');
    listbox.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (!wrap.classList.contains('open')) return;
    wrap.classList.remove('open');
    listbox.classList.remove('show');
    btn.setAttribute('aria-expanded', 'false');
  }
  function toggle() { wrap.classList.contains('open') ? close() : open(); }

  function moveFocus(delta) {
    const items = [...listbox.querySelectorAll('.epic-select-option')];
    if (!items.length) return;
    let idx = items.findIndex(it => it.classList.contains('focus'));
    idx = Math.max(0, Math.min(items.length - 1, idx + delta));
    items.forEach((it, i) => it.classList.toggle('focus', i === idx));
    items[idx].scrollIntoView({ block: 'nearest' });
    syncActiveDescendant();
  }

  btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  btn.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!wrap.classList.contains('open')) { open(); return; }
      moveFocus(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!wrap.classList.contains('open')) { open(); return; }
      const focused = listbox.querySelector('.epic-select-option.focus');
      if (focused) choose([...listbox.children].indexOf(focused));
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Home' && wrap.classList.contains('open')) {
      e.preventDefault(); moveFocus(-999);
    } else if (e.key === 'End' && wrap.classList.contains('open')) {
      e.preventDefault(); moveFocus(999);
    }
  });

  /* Clic en dehors : le portail vit hors de .epic-select, donc "en dehors"
     veut dire "ni le bouton ni la liste elle-même". */
  document.addEventListener('click', e => {
    if (!listbox.contains(e.target) && !btn.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  /* Portail en position "fixed" : il ne suit plus son déclencheur tout
     seul si la page (ou la modale) défile — on le recale en direct. */
  window.addEventListener('resize', () => { if (wrap.classList.contains('open')) positionList(); });
  window.addEventListener('scroll', () => { if (wrap.classList.contains('open')) positionList(); }, true);
  /* Un changement de page (retour navigateur depuis le cache) ne doit
     jamais laisser cette liste ouverte par erreur. */
  window.addEventListener('pageshow', () => close());

  select._epicRefresh = syncLabel;
  /* La liste vit dans <body>, pas dans .epic-select : si le select (ex:
     la variante d'un produit, reconstruite à chaque ouverture de fiche)
     est jeté via innerHTML, sa liste orpheline resterait sinon dans le
     DOM pour toujours — à appeler avant de vider son conteneur parent. */
  select._epicDestroy = () => listbox.remove();
  syncLabel();
}

/* Ré-affiche le libellé/l'option active d'un select déjà transformé en
   liste "épique" — à appeler après tout changement PROGRAMMATIQUE de sa
   valeur (ex: syncLangCurrencyControls), le widget ne pouvant pas le
   détecter tout seul (contrairement à un choix fait par la personne, qui
   passe par choose() ci-dessus). */
function refreshEpicSelect(select) {
  if (select && select._epicRefresh) select._epicRefresh();
}

/* ======================================================================
   Autocomplétion "épique" (pays / ville / quartier / tissu / couleur) ==
   Remplace la liste native <datalist> — dont le rendu ouvert est, comme
   le <select>, entièrement contrôlé par le navigateur et non stylable —
   par un vrai panneau ARIA combobox filtrant les suggestions traduites en
   direct, tout en préservant la saisie 100% libre : cliquer ou valider
   une suggestion la recopie dans le champ, mais rien n'empêche de taper
   une valeur absente de la liste. Réutilise le même habillage visuel que
   .epic-select-list (bande tissée, lisière brandée) pour une seule
   identité de liste déroulante sur tout le site. */
function enhanceAutocomplete(input, suggestKey) {
  if (!input || input.dataset.epicAuto) return;
  input.dataset.epicAuto = '1';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('autocomplete', 'off');

  const wrap = document.createElement('div');
  wrap.className = 'epic-autocomplete';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const listbox = document.createElement('div');
  listbox.className = 'epic-select-list';
  listbox.setAttribute('role', 'listbox');
  document.body.appendChild(listbox);
  const listId = 'epicauto-' + Math.random().toString(36).slice(2, 9);
  listbox.id = listId;
  input.setAttribute('aria-controls', listId);

  let items = [];
  let focusIdx = -1;

  /* Pastille de couleur en regard de chaque suggestion du champ "Couleur"
     — un repère visuel immédiat, dans les trois langues (les noms de
     couleur ne se traduisent pas 1:1 par simple casse). */
  const COLOR_SWATCHES = {
    orange: '#e8792c', bleu: '#2f6fb0', blue: '#2f6fb0', ble: '#2f6fb0',
    rouge: '#c1352a', red: '#c1352a', xonq: '#c1352a',
    vert: '#3f7a45', green: '#3f7a45', wert: '#3f7a45',
    jaune: '#e8c02c', yellow: '#e8c02c', jonn: '#e8c02c',
    noir: '#222', black: '#222', 'ñuul': '#222',
    blanc: '#fdfdfd', white: '#fdfdfd', weex: '#fdfdfd',
    rose: '#e78ea9', pink: '#e78ea9', roos: '#e78ea9',
    violet: '#7a4fa0', purple: '#7a4fa0', vale: '#7a4fa0',
    marron: '#6b4226', brown: '#6b4226', maron: '#6b4226',
    'doré': '#c9a227', gold: '#c9a227', wurus: '#c9a227',
    beige: '#d8c3a0'
  };
  const swatchFor = label => (suggestKey === 'suggest_colors' ? COLOR_SWATCHES[label.trim().toLowerCase()] : null);

  const allSuggestions = () => (typeof t === 'function' ? (t(suggestKey) || []) : []);
  const filtered = () => {
    const q = input.value.trim().toLowerCase();
    const all = allSuggestions();
    return q ? all.filter(s => s.toLowerCase().includes(q)) : all;
  };

  function setFocusIdx(i) {
    focusIdx = i;
    items.forEach((it, idx) => it.classList.toggle('focus', idx === i));
    if (i >= 0 && items[i]) {
      input.setAttribute('aria-activedescendant', items[i].id);
      items[i].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderList() {
    const list = filtered();
    listbox.innerHTML = '';
    items = [];
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'nav-drop-empty';
      empty.textContent = t('autocomplete_empty');
      listbox.appendChild(empty);
      setFocusIdx(-1);
      return;
    }
    list.forEach((label, i) => {
      const opt = document.createElement('div');
      opt.id = listId + '-' + i;
      opt.className = 'epic-select-option';
      opt.style.setProperty('--i', i);
      opt.setAttribute('role', 'option');
      const dot = swatchFor(label);
      opt.innerHTML = `<span>${dot ? `<span class="swatch-dot" style="background:${dot}"></span>` : ''}${escapeHtml(label)}</span>`;
      /* mousedown + preventDefault (pas click) : sinon le blur du champ,
         déclenché avant le click, fermerait le panneau avant que le
         choix ne soit pris en compte. */
      opt.addEventListener('mousedown', e => { e.preventDefault(); choose(label); });
      listbox.appendChild(opt);
      items.push(opt);
    });
    setFocusIdx(-1);
  }

  function choose(label) {
    input.value = label;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  function position() {
    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260 && rect.top > spaceBelow;
    listbox.classList.toggle('open-up', openUp);
    listbox.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)) + 'px';
    listbox.style.width = rect.width + 'px';
    if (openUp) {
      listbox.style.top = 'auto';
      listbox.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    } else {
      listbox.style.bottom = 'auto';
      listbox.style.top = (rect.bottom + 8) + 'px';
    }
  }

  function isOpen() { return listbox.classList.contains('show'); }
  function open() {
    renderList();
    position();
    listbox.classList.add('show');
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (!isOpen()) return;
    listbox.classList.remove('show');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    focusIdx = -1;
  }

  input.addEventListener('focus', open);
  input.addEventListener('input', open);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen()) { open(); return; }
      if (items.length) setFocusIdx(Math.min(items.length - 1, focusIdx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) { open(); return; }
      if (items.length) setFocusIdx(Math.max(0, focusIdx - 1));
    } else if (e.key === 'Enter') {
      if (isOpen() && focusIdx >= 0 && items[focusIdx]) {
        e.preventDefault();
        choose(items[focusIdx].textContent);
      }
    } else if (e.key === 'Escape') {
      if (isOpen()) { e.preventDefault(); close(); }
    } else if (e.key === 'Tab') {
      close();
    }
  });
  document.addEventListener('click', e => {
    if (e.target !== input && !listbox.contains(e.target)) close();
  });
  window.addEventListener('resize', () => { if (isOpen()) position(); });
  window.addEventListener('scroll', () => { if (isOpen()) position(); }, true);
  window.addEventListener('pageshow', () => close());
}

/* Ferme le panier si on clique/touche en dehors, ou avec Échap */
function bindCartOutsideClose() {
  const panel = document.getElementById('cartPanel');
  const btn = document.getElementById('cartBtn');
  if (!panel || !btn) return;

  function maybeClose(e) {
    if (!panel.classList.contains('show')) return;
    const t = e.target;
    if (!panel.contains(t) && !btn.contains(t)) panel.classList.remove('show');
  }
  ['pointerdown', 'click', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, maybeClose, { passive: true });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('show')) panel.classList.remove('show');
  });
}
