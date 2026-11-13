(() => {
  const status = document.getElementById('offlineStatus');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '檢查更新';
  button.style.cssText = 'padding:.6rem 1rem;border:1px solid #72551f;border-radius:8px;background:#fff8e8;color:#403a32;font:inherit;cursor:pointer';
  status.after(button);
  let ready = false;
  let failed = false;
  let registration;
  let reloading = false;
  let pendingUpdate = false;
  const hadController = !!navigator.serviceWorker?.controller;
  function render() {
    if (pendingUpdate) {
      button.textContent = '套用更新';
      status.textContent = '新版已下載。返回封面或按「套用更新」後更新，閱讀與備份會保留。';
      return;
    }
    status.textContent = ready
      ? (navigator.onLine ? '已可離線閱讀：甲、乙、丙年講道已儲存在此裝置。' : '目前離線：可繼續閱讀已儲存的講道。')
      : (failed ? '離線儲存未完成，請連線後點「檢查更新」。' : '正在準備離線閱讀，首次使用請保持連線…');
  }
  async function checkReady() {
    const cache = await caches.open('homily-notes-v78');
    const paths = ['index.html', 'homily.html', 'offline.js', 'backup.js', 'data-model.js', 'verses.js', 'cover.js', 'home-settings.js', 'icons/sacred-heart.webp', 'christmas-organ.js', 'cover.css', 'icons/church-glass-door.svg', 'install.html', 'install.js', 'reader.js', 'voice-search.js', 'search-matching.js', 'voice-search-commands.js', 'translations.js', 'narration.js', 'reader.css', 'data/verses.json', 'data/apostles.json', 'data/marian.json', 'data/theology.json', 'data/year-a.json', 'data/year-b.json', 'data/year-c.json'];
    ready = (await Promise.all(paths.map(path => cache.match(new URL(path, location.href))))).every(Boolean);
    render();
  }
  render();
  if (!('serviceWorker' in navigator)) {
    status.textContent = '此瀏覽器不支援離線閱讀，請使用最新版 Safari 或 Chrome。';
    button.disabled = true;
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) {
      const cover = document.getElementById('welcomeCover');
      if (cover && (cover.hidden || document.body.classList.contains('is-entering'))) {
        // Do not replace the document just as the doors finish or a verse is
        // being read. Apply safely on return to the cover or explicit update.
        pendingUpdate = true;
        render();
        return;
      }
      reloading = true;
      location.reload();
    } else { checkReady().catch(() => {}); }
  });
  window.addEventListener('home-page-change', event => {
    if (pendingUpdate && event.detail.page === 'cover' && !reloading) {
      reloading = true;
      location.reload();
    }
  });
  async function checkUpdate() {
    if (pendingUpdate) { reloading = true; location.reload(); return; }
    if (!navigator.onLine) {
      status.textContent = '目前離線，請連上網路後再檢查更新。';
      return;
    }
    if (!registration) return;
    button.disabled = true;
    status.textContent = '正在檢查更新，講道備份會保留…';
    try {
      await registration.update();
      if (registration.installing || registration.waiting) {
        status.textContent = '新版正在下載，完成後會自動重新開啟。';
      } else {
        // Refresh the page and network-first data without removing user storage.
        location.reload();
      }
    } catch (_) {
      status.textContent = '更新失敗，請確認網路後再試。現有離線內容與備份仍保留。';
    } finally { button.disabled = false; }
  }
  button.addEventListener('click', checkUpdate);
  window.addEventListener('offline', render);
  window.addEventListener('online', () => { render(); registration?.update().catch(() => {}); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) registration?.update().catch(() => {});
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(async reg => {
    registration = reg;
    await navigator.serviceWorker.ready;
    await checkReady();
  }).catch(() => { failed = true; render(); });
})();
