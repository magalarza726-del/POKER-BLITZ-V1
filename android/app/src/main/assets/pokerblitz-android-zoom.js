/* POKER BLITZ Android: universal tap-to-inspect, independent of game state.
   Works on the home gallery, catalog, decks, editor and all three gameplay hands.
   No game actions or save data are modified by opening this overlay. */
(function () {
  'use strict';

  const ZOOM_MIN = 1, ZOOM_MAX = 1.8, ZOOM_STEP = 0.2;
  let overlay = null, previousFocus = null, currentScale = ZOOM_MIN;

  function findCard(target) {
    if (!(target instanceof Element)) return null;
    // Buttons like Discard, Edit and Use MUST continue working normally.
    if (target.closest('button, input, textarea, select, a, [contenteditable]')) return null;
    if (target.closest('.pb-inspector')) return null;
    if (target.closest('.zoom-shell')) return null;
    return target.closest('.card-preview, .poker-card');
  }

  function makeText(tag, className, value) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = value;
    return el;
  }

  function makeButton(label, action, ariaLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pb-inspector-control';
    btn.dataset.pbZoom = action;
    btn.textContent = label;
    btn.setAttribute('aria-label', ariaLabel || label);
    return btn;
  }

  function scaleTo(value) {
    currentScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
    if (!overlay) return;
    const art = overlay.querySelector('.pb-inspector-art');
    if (art) art.style.zoom = String(currentScale);
    const indicator = overlay.querySelector('.pb-inspector-scale');
    if (indicator) indicator.textContent = Math.round(currentScale * 100) + '%';
    const decrease = overlay.querySelector('[data-pb-zoom="out"]');
    const increase = overlay.querySelector('[data-pb-zoom="in"]');
    if (decrease) decrease.disabled = currentScale <= ZOOM_MIN;
    if (increase) increase.disabled = currentScale >= ZOOM_MAX;
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.documentElement.classList.remove('pb-inspector-open');
    if (previousFocus && previousFocus.isConnected) {
      try { previousFocus.focus({ preventScroll: true }); } catch (_) {}
    }
    previousFocus = null;
  }

  function open(card) {
    if (!card || !card.isConnected) return false;
    close();
    const isPoker = card.classList.contains('poker-card');
    previousFocus = document.activeElement;
    const copy = card.cloneNode(true);

    // The inspector is read-only. Discard/Use controls are never cloned.
    copy.querySelectorAll('button, .poker-actions, .hand-actions, .active-badge')
      .forEach(node => node.remove());

    const title = isPoker
      ? ('Poker Card · ' + (card.querySelector('.poker-corner')?.innerText || '').replace(/\s+/g,' ').trim())
      : (card.querySelector('.card-title')?.textContent || 'Carta Poker Blitz').trim();
    const description = isPoker
      ? 'Carta de Poker. Toca + o − para ajustar el tamaño y ver sus símbolos.'
      : (card.querySelector('.card-desc')?.textContent || '').trim();

    const bg = document.createElement('div');
    bg.className = 'pb-inspector';
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    bg.setAttribute('aria-label', 'Carta ampliada: ' + title);

    const dialog = document.createElement('div');
    dialog.className = 'pb-inspector-dialog';
    const bar = document.createElement('div');
    bar.className = 'pb-inspector-toolbar';
    bar.appendChild(makeText('strong','pb-inspector-heading',title));
    const controlRow = document.createElement('div');
    controlRow.className = 'pb-inspector-buttons';
    controlRow.appendChild(makeButton('−','out','Reducir carta'));
    controlRow.appendChild(makeText('span','pb-inspector-scale','100%'));
    controlRow.appendChild(makeButton('+','in','Ampliar carta'));
    const closeBtn = makeButton('✕ Cerrar','close','Cerrar ampliación');
    closeBtn.classList.add('pb-inspector-close');
    controlRow.appendChild(closeBtn);
    bar.appendChild(controlRow);
    dialog.appendChild(bar);

    const layout = document.createElement('div');
    layout.className = 'pb-inspector-body';
    const stage = document.createElement('div');
    stage.className = 'pb-inspector-stage';
    const art = document.createElement('div');
    art.className = 'pb-inspector-art';
    copy.classList.add('pb-inspector-card');
    copy.removeAttribute('data-action');
    copy.removeAttribute('data-id');
    art.appendChild(copy);
    stage.appendChild(art);
    layout.appendChild(stage);

    const details = document.createElement('section');
    details.className = 'pb-inspector-details';
    details.appendChild(makeText('h2','pb-inspector-title',title));
    details.appendChild(makeText('p','pb-inspector-description',description || 'Esta carta no tiene descripción.'));
    details.appendChild(makeText('small','pb-inspector-help','Puedes desplazarte para leer todo el texto. La carta original no se modifica.'));
    layout.appendChild(details);
    dialog.appendChild(layout);
    bg.appendChild(dialog);
    document.body.appendChild(bg);
    overlay = bg;
    document.documentElement.classList.add('pb-inspector-open');
    scaleTo(ZOOM_MIN);
    closeBtn.focus({ preventScroll: true });
    return true;
  }

  document.addEventListener('click', function (event) {
    if (overlay) {
      const action = event.target.closest('[data-pb-zoom]');
      if (action && overlay.contains(action)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        switch (action.dataset.pbZoom) {
          case 'close': close(); break;
          case 'in': scaleTo(currentScale + ZOOM_STEP); break;
          case 'out': scaleTo(currentScale - ZOOM_STEP); break;
        }
        return;
      }
      if (event.target === overlay) { event.stopImmediatePropagation(); close(); }
      return;
    }
    const card = findCard(event.target);
    if (!card) return;
    // Capture before the main app's event delegation, e.g. selecting/editing a card.
    event.preventDefault();
    event.stopImmediatePropagation();
    open(card);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (overlay) {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = event.target;
    if (el instanceof Element && el.matches('.card-preview, .poker-card')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      open(el);
    }
  }, true);

  // The app regenerates its DOM frequently, so make all preview tiles keyboard
  // accessible again after each render without changing app rendering logic.
  let pending = false;
  function decorate() {
    pending = false;
    document.querySelectorAll('#app .card-preview, #app .poker-card').forEach(function (el) {
      if (el.hasAttribute('tabindex')) return;
      el.setAttribute('tabindex','0');
      el.setAttribute('role','button');
      el.setAttribute('aria-label','Ampliar carta');
      el.setAttribute('title','Tocar para ampliar');
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    const main = document.getElementById('app');
    if (!main) return;
    const observer = new MutationObserver(function () {
      if (!pending) {
        pending = true;
        requestAnimationFrame(decorate);
      }
    });
    observer.observe(main,{childList:true,subtree:true});
    decorate();
  });

  // Used by the automated browser tests, and useful when diagnosing a device.
  window.PokerBlitzCardInspector = {
    open: open,
    close: close,
    get isOpen() { return !!overlay; },
    get scale() { return currentScale; }
  };
})();
