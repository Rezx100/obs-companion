(() => {
  'use strict';

  // Keep the complete reference visible without scripting. Motion is a small,
  // one-time enhancement to ordinary document flow, never a scroll replacement.
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const featureGrid = document.querySelector('.feature-grid');
  let featureObserver;

  if (featureGrid && !motionPreference.matches && 'IntersectionObserver' in window) {
    featureGrid.querySelectorAll('.feature-card').forEach((card, index) => {
      card.style.setProperty('--card-index', String(index));
    });
    featureObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        featureGrid.classList.add('is-revealed');
        featureObserver.disconnect();
      }
    }, { threshold: 0.12 });
    featureGrid.classList.add('is-reveal-ready');
    featureObserver.observe(featureGrid);
  }

  motionPreference.addEventListener?.('change', (event) => {
    if (event.matches) {
      featureGrid?.classList.add('is-revealed');
      featureObserver?.disconnect();
    }
  });

  const collection = document.querySelector('.filters');
  const products = [...document.querySelectorAll('.product')];
  const status = document.querySelector('.collection-status');
  const labels = { all: 'all', stoneware: 'stoneware', linen: 'linen' };

  if (collection && products.length && status) {
    collection.hidden = false;
    collection.addEventListener('change', (event) => {
      const category = event.target.value;
      if (!Object.hasOwn(labels, category)) return;
      let visibleCount = 0;
      products.forEach((product) => {
        product.hidden = category !== 'all' && product.dataset.category !== category;
        if (!product.hidden) visibleCount += 1;
      });
      status.textContent = category === 'all'
        ? `Showing all ${visibleCount} sample objects.`
        : `Showing ${visibleCount} sample ${labels[category]} ${visibleCount === 1 ? 'object' : 'objects'}.`;
    });
  }

  const storefront = document.querySelector('#storefront');
  document.querySelectorAll('[data-preview]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!storefront || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // The native fragment link handles navigation, browser history and scroll.
      // Add focus so keyboard visitors can continue into the sample's controls.
      window.requestAnimationFrame(() => storefront.focus({ preventScroll: true }));
    });
  });
})();
