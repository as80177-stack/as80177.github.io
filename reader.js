(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'homilyReader';
  dialog.className = 'homily-reader';
  dialog.setAttribute('aria-labelledby', 'readerTitle');
  dialog.innerHTML = `<div class="reader-toolbar">
    <button type="button" id="readerBack">← 返回道理</button>
    <button type="button" id="readerCopy">複製全文</button>
    <label>轉場 <select id="readerTransition"><option value="fade">柔和淡入</option><option value="slide">輕柔滑入</option><option value="none">無轉場</option></select></label>
    <span id="readerPullHint" class="reader-pull-hint" role="status" aria-live="polite">頂部下拉可返回</span>
    </div><article class="reader-page"><h2 id="readerTitle"></h2>
    <div class="reader-settings" aria-label="全螢幕閱讀字體大小"><button class="size-button" data-reader-size="small" type="button">小字</button><button class="size-button" data-reader-size="medium" type="button">標準</button><button class="size-button" data-reader-size="large" type="button">大字</button></div>
    <p id="readerCopyStatus" role="status" aria-live="polite"></p>
    <textarea id="readerManualCopy" class="manual-copy" aria-label="道理全文，請長按全選並複製" readonly hidden></textarea>
    <div id="readerText" class="reader-text"></div></article>`;
  document.body.append(dialog);
  window.HomilyNarration.attach();
  const transition = document.getElementById('readerTransition');
  const copyStatus = document.getElementById('readerCopyStatus');
  const manual = document.getElementById('readerManualCopy');
  let current = null;
  let source = null;
  let closing = false;
  let ownsHistory = false;
  let previousOverflow = '';
  try {
    const saved = localStorage.getItem('homily-reader-transition');
    if (['fade','slide','none'].includes(saved)) transition.value = saved;
  } catch (_) {}
  dialog.dataset.transition = transition.value;
  transition.addEventListener('change', () => {
    dialog.dataset.transition = transition.value;
    try { localStorage.setItem('homily-reader-transition', transition.value); } catch (_) {}
  });
  function readCard(card) {
    return {title:card.dataset.homilyTitle, text:card.querySelector('.notes').textContent};
  }
  function openReader(card) {
    if (dialog.open || closing) return;
    window.HomilyNarration.hide();
    resetPull();
    current = readCard(card); source = card;
    document.getElementById('readerTitle').textContent = current.title;
    document.getElementById('readerText').textContent = current.text;
    copyStatus.textContent = ''; manual.hidden = true;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal(); dialog.scrollTop = 0;
    history.pushState({homilyReader:true}, '', '#reading'); ownsHistory = true;
    if (transition.value === 'none' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.classList.add('is-visible');
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (dialog.open && !closing) dialog.classList.add('is-visible');
      }));
    }
    // Keep the viewport stable; native fullscreen resizing can flash on phones.
    // Installed apps already hide browser chrome, and this dialog fills the viewport.
    document.getElementById('readerBack').focus({preventScroll:true});
  }
  function closeReader() {
    if (!dialog.open || closing) return;
    window.HomilyNarration.stop();
    resetPull();
    closing = true; dialog.classList.remove('is-visible');
    const delay = transition.value === 'none' || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 340;
    setTimeout(() => {
      dialog.close(); document.body.style.overflow = previousOverflow;
      if (source?.isConnected) {
        source.classList.add('open');
        const toggle = source.querySelector('.homily-toggle'); toggle.setAttribute('aria-expanded','true');
        source.querySelector('.reader-open').focus({preventScroll:true});
      }
      closing = false;
    }, delay);
  }
  function goBack() {
    if (closing || !dialog.open) return;
    if (ownsHistory) { ownsHistory = false; history.back(); }
    else closeReader();
  }
  const pullHint = document.getElementById('readerPullHint');
  const pullThreshold = 110;
  let pull = null;
  function resetPull() {
    pull = null;
    dialog.classList.remove('is-pulling');
    dialog.style.removeProperty('--reader-pull');
    pullHint.textContent = '頂部下拉可返回';
  }
  dialog.addEventListener('touchstart', event => {
    resetPull();
    if (!dialog.open || closing || event.touches.length !== 1 || dialog.scrollTop > 1 ||
        event.target.closest('button,select,input,textarea,a,summary') || !window.getSelection().isCollapsed) return;
    const touch = event.touches[0];
    pull = { x:touch.clientX, y:touch.clientY, distance:0, dragging:false };
  }, {passive:true});
  dialog.addEventListener('touchmove', event => {
    if (!pull) return;
    if (event.touches.length !== 1 || dialog.scrollTop > 1 || !window.getSelection().isCollapsed) { resetPull(); return; }
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - pull.x);
    const dy = touch.clientY - pull.y;
    if (dy < -8 || (dx > 12 && dx > Math.max(dy, 0))) { resetPull(); return; }
    if (dy <= 10 || dy < dx * 1.4) return;
    if (!event.cancelable) { resetPull(); return; }
    event.preventDefault();
    pull.dragging = true; pull.distance = dy;
    dialog.classList.add('is-pulling');
    dialog.style.setProperty('--reader-pull', `${Math.min(42, dy * 0.25)}px`);
    const label = dy >= pullThreshold ? '放開即可返回' : '繼續下拉以返回';
    if (pullHint.textContent !== label) pullHint.textContent = label;
  }, {passive:false});
  dialog.addEventListener('touchend', event => {
    const returnNow = pull?.dragging && pull.distance >= pullThreshold && event.touches.length === 0;
    resetPull();
    if (returnNow) goBack();
  }, {passive:true});
  dialog.addEventListener('touchcancel', resetPull, {passive:true});
  window.addEventListener('popstate', () => { if (dialog.open) { ownsHistory = false; closeReader(); } });
  dialog.addEventListener('cancel', event => { event.preventDefault(); goBack(); });
  document.getElementById('readerBack').addEventListener('click', goBack);
  async function copy(data, status, fallback) {
    const text = `${data.title}\n\n${data.text}`;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = '已複製整篇道理（含標題與完整分段）。';
      if (fallback) fallback.hidden = true;
    } catch (_) {
      const area = fallback || document.createElement('textarea');
      area.value = text; area.hidden = false; area.readOnly = true;
      if (!fallback) {
        area.className = 'manual-copy'; area.setAttribute('aria-label','道理全文，請長按全選並複製');
        status.after(area);
      }
      area.focus(); area.select();
      status.textContent = '請長按下方文字，選「全選」→「複製」。';
    }
  }
  document.getElementById('readerCopy').addEventListener('click', () => copy(current, copyStatus, manual));
  dialog.querySelectorAll('[data-reader-size]').forEach(button => button.addEventListener('click', () => {
    setReadingSize(button.dataset.readerSize);
    dialog.querySelectorAll('[data-reader-size]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  document.getElementById('list').addEventListener('click', event => {
    const listen = event.target.closest('.homily-listen');
    if (listen && !closing) {
      const card = listen.closest('.homily-card');
      const data = readCard(card);
      window.HomilyNarration.start(`${data.title}\n\n${data.text}`, card);
    }
    const open = event.target.closest('.reader-open');
    if (open) openReader(open.closest('.homily-card'));
    const copyButton = event.target.closest('.homily-copy');
    if (copyButton) {
      const card = copyButton.closest('.homily-card');
      const status = card.querySelector('.copy-status');
      const old = status.nextElementSibling;
      if (old?.classList.contains('manual-copy')) old.remove();
      copy(readCard(card), status);
    }
  });
  const list = document.getElementById('list');
  list.addEventListener('dblclick', event => {
    if (event.target.closest('.notes,.homily-toggle')) openReader(event.target.closest('.homily-card'));
  });
  let lastTap = null;
  list.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch' || !event.target.closest('.notes,.homily-toggle')) return;
    const card = event.target.closest('.homily-card');
    const now = performance.now();
    if (lastTap && lastTap.card === card && now - lastTap.time < 350 && Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<25) {
      lastTap = null; openReader(card);
    } else lastTap = {card,time:now,x:event.clientX,y:event.clientY};
  });
})();
