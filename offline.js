(() => {
  const status = document.getElementById('offlineStatus');
  let ready = false;
  let failed = false;
  function render() {
    status.textContent = ready
      ? (navigator.onLine ? '已可離線閱讀：甲、乙、丙年講道已儲存在此裝置。' : '目前離線：可繼續閱讀已儲存的講道。')
      : (failed ? '離線儲存未完成，請連線後重新開啟網站。' : '正在準備離線閱讀，首次使用請保持連線…');
  }
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  render();
  if (!('serviceWorker' in navigator)) {
    status.textContent = '此瀏覽器不支援離線閱讀，請使用最新版 Safari 或 Chrome。';
    return;
  }
  navigator.serviceWorker.register('sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    const cache = await caches.open('homily-notes-v10');
    const paths = ['index.html', 'homily.html', 'offline.js', 'backup.js', 'data/year-a.json', 'data/year-b.json', 'data/year-c.json'];
    ready = (await Promise.all(paths.map(path => cache.match(new URL(path, location.href))))).every(Boolean);
    failed = !ready;
    render();
  }).catch(() => { failed = true; render(); });
})();
