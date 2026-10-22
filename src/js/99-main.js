load();
applyTheme();
render();
// hosted version (https): cache the app for offline use; does nothing when opened as a local file
if (location.protocol === 'https:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
