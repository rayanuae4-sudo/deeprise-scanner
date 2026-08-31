window.DEEPRISE_ANALYTICS_CONFIG = {
  provider: 'posthog',
  projectKey: 'phc_uAhM4tgLTToN6oC2y5MfLf5j9eZM3ePkCBoYesiZwK62',
  host: 'https://us.i.posthog.com',
  enabled: true,
  version: 'V14.4 PRO'
};

// DeepRise precision early-entry engine. Loaded here so the live root page gets the feature
// without altering the existing scanner bootstrap or the rest of the production modules.
(()=>{
  if (document.querySelector('script[data-deeprise-early-breakout]')) return;
  const s = document.createElement('script');
  s.src = 'deeprise-early-breakout-v160.js?v=1600';
  s.async = true;
  s.dataset.deepriseEarlyBreakout = 'v160';
  document.head.appendChild(s);
})();
