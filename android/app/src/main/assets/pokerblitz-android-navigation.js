/* Android-only global navigation for Poker Blitz.
   The simulator must always provide a way to return, even when the page is
   scrolled below its original header. The existing exit confirmation is used,
   so game history and optional PDF export behave exactly as before. */
(function () {
  'use strict';
  const id = 'pb-game-nav';

  function simulator() {
    return document.querySelector('#app .sim-shell');
  }

  function dialogOpen() {
    return !!document.querySelector('#app .modal-backdrop');
  }

  function scrollToBeginning() {
    const sim = simulator();
    if (!sim) return false;
    sim.scrollTop = 0;
    document.scrollingElement?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
    return true;
  }

  function requestExit() {
    const trigger = document.querySelector('#app .sim-top [data-action="exit-sim"]');
    if (!trigger || dialogOpen()) return false;
    trigger.click(); // Exposes Cancel / Salir sin PDF / Salir con PDF.
    return true;
  }

  function back() {
    if (window.PokerBlitzCardInspector?.isOpen) {
      window.PokerBlitzCardInspector.close();
      return true;
    }
    if (dialogOpen()) {
      const cancel = document.querySelector('#app .modal-backdrop [data-action="close-modal"]');
      if (cancel) {
        cancel.click();
        return true;
      }
    }
    if (simulator()) return requestExit();
    const backBtn = document.querySelector('#app [data-action="back"]');
    if (backBtn) {
      backBtn.click();
      return true;
    }
    return false; // Native Activity may close from the home page.
  }

  function button(label, action, description) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pb-nav-button';
    btn.dataset.pbNav = action;
    btn.textContent = label;
    btn.title = description;
    btn.setAttribute('aria-label', description);
    return btn;
  }

  function renderDock() {
    const sim = simulator();
    const current = document.getElementById(id);
    if (!sim) {
      if (current) current.remove();
      document.documentElement.classList.remove('pb-game-active');
      return;
    }
    if (current) return;
    const dock = document.createElement('nav');
    dock.id = id;
    dock.setAttribute('aria-label', 'Navegación de modo prueba');
    dock.appendChild(button('← Inicio', 'exit', 'Volver a pantalla principal'));
    const name = document.createElement('span');
    name.className = 'pb-nav-title';
    name.textContent = 'POKER BLITZ · Modo prueba';
    dock.appendChild(name);
    dock.appendChild(button('⚙ Acciones', 'trade', 'Robar, intercambiar y descartar manualmente'));
    dock.appendChild(button('↑ Arriba', 'top', 'Subir al principio'));
    document.body.appendChild(dock);
    document.documentElement.classList.add('pb-game-active');
  }

  document.addEventListener('click', function (ev) {
    const target = ev.target.closest('#pb-game-nav [data-pb-nav]');
    if (!target) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (target.dataset.pbNav === 'exit') requestExit();
    else if (target.dataset.pbNav === 'top') scrollToBeginning();
    else if (target.dataset.pbNav === 'trade') document.querySelector('#app [data-action="open-trade"]')?.click();
  }, true);

  // The original app re-renders #app for every action, including rolling dice.
  document.addEventListener('DOMContentLoaded', function () {
    const app = document.getElementById('app');
    if (!app) return;
    const observer = new MutationObserver(renderDock);
    observer.observe(app, { childList: true });
    renderDock();
  });

  window.PokerBlitzAndroidNavigation = {
    back: back,
    exit: requestExit,
    scrollTop: scrollToBeginning,
    get active() { return !!simulator(); }
  };
})();
