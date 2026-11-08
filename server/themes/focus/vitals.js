// Opt-in diagnostics, GoogleChrome/web-vitals 6.2.3 (Apache-2.0).
// No network requests, storage, visitor identifiers or customer data are collected.
if (new URLSearchParams(location.search).get('vitals') === '1' && window.webVitals) {
  document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.dataset.focusFontsReady = 'true';
  })));
  const report = metric => console.info('[Focus Web Vitals]', JSON.stringify({
    name: metric.name, value: metric.value, rating: metric.rating, id: metric.id,
    navigationType: metric.navigationType, path: location.pathname, width: innerWidth
  }));
  for (const name of ['onLCP', 'onCLS', 'onINP', 'onTTFB']) {
    webVitals[name](report, {reportAllChanges: true});
  }
}
