window.DEEPRISE_ANALYTICS_CONFIG = {
  provider: 'posthog',
  projectKey: 'phc_uAhM4tgLTToN6oC2y5MfLf5j9eZM3ePkCBoYesiZwK62',
  host: 'https://us.i.posthog.com',
  enabled: true,
  version: 'V17.0 PRO'
};

// Narrow DOM guard for the Early Breakout inline badge. It prevents an identical
// outerHTML replacement from creating a MutationObserver redraw loop, while still
// allowing a real score/stage/level change to update normally.
(()=>{
  try {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML');
    if (d?.get && d?.set && !window.__DEEPRISE_EARLY_OUTERHTML_GUARD__) {
      const norm = s => String(s ?? '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      Object.defineProperty(Element.prototype, 'outerHTML', {
        configurable: d.configurable,
        enumerable: d.enumerable,
        get: d.get,
        set(value) {
          if (this?.hasAttribute?.('data-early-inline') && norm(d.get.call(this)) === norm(value)) return;
          return d.set.call(this, value);
        }
      });
      window.__DEEPRISE_EARLY_OUTERHTML_GUARD__ = true;
    }
  } catch (_) {}
})();

// V17 pre-move is loaded explicitly by index.html. Analytics configuration stays
// side-effect free so an older early-entry engine cannot be injected in parallel.
