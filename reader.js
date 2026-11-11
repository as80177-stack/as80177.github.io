(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'homilyReader';
  dialog.className = 'homily-reader';
  dialog.setAttribute('aria-labelledby', 'readerTitle');
  dialog.innerHTML = `<div class="reader-toolbar">
    <button type="button" id="readerBack">← 返回道理</button>
    <button type="button" id="readerCopy">複製全文</button>
    <label>轉場 <select id="readerTransition"><option value="fade">柔和淡入</option><option value="slide">輕柔滑入</option><option value="none">無轉場</option></select></label>
    </div><article class="reader-page"><h2 id="readerTitle"></h2>
    <div class="reader-settings" aria-label="全螢幕閱讀字體大小"><button class="size-button" data-reader-size="small" type="button">小字</button><button class="size-button" data-reader-size="medium" type="button">標準</button><button class="size-button" data-reader-size="large" type="button">大字</button></div>
    <p id="readerCopyStatus" role="status" aria-live="polite"></p>
    <textarea id="readerManualCopy" class="manual-copy" aria-label="道理全文，請長按全選並複製" readonly hidden></textarea>
    <div id="readerText" class="reader-text"></div></article>`;
  document.body.append(dialog);
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
