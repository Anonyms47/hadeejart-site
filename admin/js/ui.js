/* ======================================================================
   Hadeej'Art Admin — Confort d'interface
   1. Listes déroulantes soignées (remplacent le menu système, qu'on ne peut
      pas mettre en forme) : bouton + liste ARIA, clavier complet, une seule
      liste ouverte à la fois. Le <select> d'origine reste dans la page
      (valeur, événement « change » : le code des écrans ne change pas).
   2. Tableaux lisibles sur mobile : chaque cellule reçoit son libellé
      (data-label) pour que le CSS puisse les afficher en fiches empilées.
   Tout se fait automatiquement, y compris pour les contenus injectés plus
   tard (fenêtres, listes chargées après coup), via un MutationObserver.
   ====================================================================== */
(function () {
  let activeClose = null;
  function claim(fn) { if (activeClose && activeClose !== fn) activeClose(); activeClose = fn; }
  function release(fn) { if (activeClose === fn) activeClose = null; }

  const registry = new Map(); /* select -> { listbox, sync } */

  function enhanceSelect(select) {
    if (!select || select.dataset.epic) return;
    select.dataset.epic = '1';

    const wrap = document.createElement('div');
    wrap.className = 'epic-select';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('epic-select-native');
    select.tabIndex = -1;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'epic-select-trigger';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="epic-select-label"></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    wrap.appendChild(btn);
    /* Le libellé du champ (label for=…) s'applique au bouton */
    if (select.id) {
      const lab = document.querySelector(`label[for="${select.id}"]`);
      if (lab) btn.setAttribute('aria-label', lab.textContent.trim());
    }

    const listbox = document.createElement('div');
    listbox.className = 'epic-select-list';
    listbox.setAttribute('role', 'listbox');
    document.body.appendChild(listbox);

    const labelEl = btn.querySelector('.epic-select-label');
    const optText = o => o.textContent.trim();

    function sync() {
      const o = select.options[select.selectedIndex];
      labelEl.textContent = o ? optText(o) : '';
    }
    function render() {
      listbox.innerHTML = '';
      [...select.options].forEach((o, i) => {
        const item = document.createElement('div');
        const on = i === select.selectedIndex;
        item.className = 'epic-select-option' + (on ? ' active focus' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', on ? 'true' : 'false');
        item.innerHTML = `<span></span><svg class="chk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>`;
        item.firstChild.textContent = optText(o);
        item.addEventListener('click', () => choose(i));
        listbox.appendChild(item);
      });
    }
    function position() {
      const r = btn.getBoundingClientRect();
      listbox.style.minWidth = r.width + 'px';
      listbox.style.width = r.width + 'px';
      const h = Math.min(listbox.scrollHeight, 340);
      const below = window.innerHeight - r.bottom;
      const up = below < Math.min(h + 16, 260) && r.top > below;
      listbox.classList.toggle('open-up', up);
      listbox.style.left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)) + 'px';
      if (up) { listbox.style.top = 'auto'; listbox.style.bottom = (window.innerHeight - r.top + 8) + 'px'; }
      else { listbox.style.bottom = 'auto'; listbox.style.top = (r.bottom + 8) + 'px'; }
    }
    function open() {
      if (wrap.classList.contains('open')) return;
      claim(close);
      render(); position();
      wrap.classList.add('open'); listbox.classList.add('show');
      btn.setAttribute('aria-expanded', 'true');
      const cur = listbox.querySelector('.active'); if (cur) cur.scrollIntoView({ block: 'nearest' });
    }
    function close() {
      if (!wrap.classList.contains('open')) return;
      release(close);
      wrap.classList.remove('open'); listbox.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
    }
    function choose(i) {
      const changed = select.selectedIndex !== i;
      select.selectedIndex = i;
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
      sync(); close(); btn.focus();
    }
    function move(d) {
      const items = [...listbox.querySelectorAll('.epic-select-option')];
      if (!items.length) return;
      let idx = items.findIndex(x => x.classList.contains('focus'));
      idx = Math.max(0, Math.min(items.length - 1, idx + d));
      items.forEach((x, i) => x.classList.toggle('focus', i === idx));
      items[idx].scrollIntoView({ block: 'nearest' });
    }

    btn.addEventListener('click', e => { e.stopPropagation(); wrap.classList.contains('open') ? close() : open(); });
    btn.addEventListener('keydown', e => {
      const isOpen = wrap.classList.contains('open');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen) open(); else move(e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isOpen) open();
        else { const f = listbox.querySelector('.epic-select-option.focus'); if (f) choose([...listbox.children].indexOf(f)); }
      }
      else if (e.key === 'Escape' && isOpen) { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Home' && isOpen) { e.preventDefault(); move(-999); }
      else if (e.key === 'End' && isOpen) { e.preventDefault(); move(999); }
      else if (e.key === 'Tab') close();
    });
    document.addEventListener('click', e => { if (!listbox.contains(e.target) && !btn.contains(e.target)) close(); });
    window.addEventListener('resize', () => { if (wrap.classList.contains('open')) position(); });
    window.addEventListener('scroll', () => { if (wrap.classList.contains('open')) position(); }, true);
    select.addEventListener('change', sync);
    /* Options ajoutées après coup (ex : catégories chargées depuis la base) */
    new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true });

    registry.set(select, { listbox, sync });
    sync();
  }

  /* Libellés de colonnes pour l'affichage en fiches sur mobile */
  function labelTable(table) {
    const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!heads.length) return;
    table.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] || ''); });
    });
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('select:not([data-epic])').forEach(enhanceSelect);
    (root.matches && root.matches('table') ? [root] : root.querySelectorAll('table')).forEach(labelTable);
  }

  /* Nettoyage : listes orphelines quand une fenêtre est refermée */
  function cleanup() {
    registry.forEach((v, sel) => { if (!document.contains(sel)) { v.listbox.remove(); registry.delete(sel); } });
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(document.body); cleanup(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', () => scan(document.body));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && activeClose) activeClose(); });
})();
