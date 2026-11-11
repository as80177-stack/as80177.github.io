(() => {
  const KEY = 'homily-backup-v1';
  const cycles = ['a', 'b', 'c'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  function validate(data) {
    const object = x => x && typeof x === 'object' && !Array.isArray(x);
    const text = x => typeof x === 'string';
    function notes(item) {
      return object(item) && Array.isArray(item.homilies) && item.homilies.every(h => object(h) && text(h.title) && text(h.content) && (h.uploaded_at === undefined || text(h.uploaded_at)));
    }
    function folder(item) { return notes(item) && text(item.id) && text(item.name) && text(item.display_name); }
    if (!object(data) || !cycles.every(c => {
      const d = data[c];
      return object(d) && d.cycle === c && text(d.label) && Array.isArray(d.sundays) && d.sundays.every(folder) && Array.isArray(d.other) && d.other.every(folder) && object(d.weekdays) && ['odd', 'even'].every(p => {
        const parity = d.weekdays[p];
        return object(parity) && text(parity.label) && Array.isArray(parity.weeks) && parity.weeks.every(w => object(w) && text(w.id) && text(w.name) && Array.isArray(w.days) && w.days.every(day => notes(day) && text(day.id) && text(day.label)));
      });
    })) throw new Error('備份內容不完整或格式不正確，必須包含甲、乙、丙年資料。');
    return data;
  }
  function local() {
    const saved = localStorage.getItem(KEY);
    return saved ? validate(JSON.parse(saved)) : null;
  }
  async function all() {
    const saved = local();
    if (saved) return saved;
    const entries = await Promise.all(cycles.map(async c => {
      const r = await fetch(`data/year-${c}.json`);
      if (!r.ok) throw new Error('無法讀取講道，請連線後再試。');
      return [c, await r.json()];
    }));
    return validate(Object.fromEntries(entries));
  }
  window.HomilyData = { async load(c) {
    const saved = local();
    if (saved) return saved[c];
    const r = await fetch(`data/year-${c}.json`);
    if (!r.ok) throw new Error('找不到禮儀年資料');
    return r.json();
  }};
  const panel = document.createElement('section');
  panel.className = 'backup-panel';
  panel.innerHTML = `<h2>講道備份與還原</h2>
    <p>完整備份包含三個年度、所有分類與講道全文。請另存一份到電腦或雲端硬碟；清除瀏覽器資料會刪除此裝置的還原資料。</p>
    <div class="backup-actions"><button type="button" id="backupDownload">下載完整備份</button>
    <button type="button" id="backupRestore">從備份還原</button>
    <button type="button" id="readingExport">匯出閱讀文件</button></div>
    <input id="backupFile" type="file" accept=".json,application/json" hidden>
    <p>還原會取代此裝置閱讀的整份資料，不會修改線上網站。請先下載現有備份。閱讀文件可獨立開啟，不需網站或網路，也可用瀏覽器列印成 PDF。</p>
    <p id="backupSource"></p><button type="button" id="backupReset" hidden>改回網站資料</button>
    <p id="backupMessage" role="status" aria-live="polite"></p>`;
  document.getElementById('backupTools').append(panel);
  const style = document.createElement('style');
  style.textContent = '.backup-panel{padding:1rem;margin:1rem 0;border:1px solid #ded7cc;border-radius:12px;background:#fff;color:#24211d;font-size:1rem}.backup-panel h2{font-size:1.25rem}.backup-actions{display:flex;flex-wrap:wrap;gap:.6rem}.backup-panel button{padding:.65rem .8rem;border:1px solid #72551f;border-radius:8px;background:#fff8e8;color:#403a32;cursor:pointer;font:inherit}.backup-panel p{line-height:1.7}';
  document.head.append(style);
  const message = document.getElementById('backupMessage');
  function source() {
    try {
      const restored = !!local();
      document.getElementById('backupSource').textContent = restored ? '目前閱讀：此裝置還原的備份。網站更新不會覆蓋這份資料。' : '目前閱讀：網站資料。';
      document.getElementById('backupReset').hidden = !restored;
    } catch (e) { message.textContent = `無法讀取裝置資料：${e.message}`; }
  }
  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function run(action) {
    try { await action(); } catch (e) { message.textContent = `操作失敗：${e.message}。原有資料未被取代。`; }
  }
  document.getElementById('backupDownload').onclick = () => run(async () => {
    const data = await all();
    download(JSON.stringify({format:'homily-notes-backup', version:1, exported_at:new Date().toISOString(), data}, null, 2), 'application/json;charset=utf-8', `講道完整備份-${new Date().toISOString().slice(0,10)}.json`);
    message.textContent = '已產生完整備份，請確認檔案已下載並妥善保存。';
  });
  const file = document.getElementById('backupFile');
  document.getElementById('backupRestore').onclick = () => { file.value = ''; file.click(); };
  file.onchange = () => run(async () => {
    const selected = file.files[0]; if (!selected) return;
    if (selected.size > 20 * 1024 * 1024) throw new Error('檔案超過 20 MB');
    const backup = JSON.parse(await selected.text());
    if (backup.format !== 'homily-notes-backup' || backup.version !== 1) throw new Error('不支援的備份格式或版本');
    const data = validate(backup.data);
    if (!confirm('確定以這份備份取代此裝置的全部講道資料？建議先下載目前的完整備份。線上網站不受影響。')) return;
    localStorage.setItem(KEY, JSON.stringify(data));
    source(); window.dispatchEvent(new Event('homily-data-changed'));
    message.textContent = '還原完成！此裝置可閱讀備份中的全部講道。請保留原始備份檔。';
  });
  document.getElementById('backupReset').onclick = () => run(async () => {
    if (!confirm('改回網站資料將移除此裝置還原的資料，請先下載備份。確定繼續？')) return;
    localStorage.removeItem(KEY); source(); window.dispatchEvent(new Event('homily-data-changed'));
    message.textContent = '已改回網站資料。';
  });
  document.getElementById('readingExport').onclick = () => run(async () => {
    const data = await all(); let body = '<h1>天主教講道筆記</h1><p>此文件包含三個年度的講道全文，可離線閱讀，或使用瀏覽器列印功能存為 PDF。</p>';
    function entry(item, title) {
      return `<section><h3>${escape(title)}</h3>${item.homilies.length ? item.homilies.map(h => `<article><h4>${escape(h.title)}</h4><p>${escape(h.uploaded_at || '')}</p><div class="content">${escape(h.content)}</div></article>`).join('') : '<p>尚未加入道理</p>'}</section>`;
    }
    for (const c of cycles) {
      const d = data[c]; body += `<h2>${escape(d.label)} · 主日</h2>` + d.sundays.map(x => entry(x, x.display_name)).join('');
      for (const p of ['odd','even']) body += `<h2>${escape(d.label)} · ${escape(d.weekdays[p].label)}</h2>` + d.weekdays[p].weeks.map(w => `<h3>${escape(w.name)}</h3>` + w.days.map(day => entry(day, day.label)).join('')).join('');
      body += `<h2>${escape(d.label)} · 其他節日</h2>` + d.other.map(x => entry(x, x.display_name)).join('');
    }
    download(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>講道閱讀文件</title><style>body{max-width:850px;margin:2rem auto;padding:1rem;font-family:system-ui,sans-serif;line-height:1.8}.content{white-space:pre-wrap}h2{border-bottom:1px solid #aaa}article{margin-bottom:2rem}@media print{h2,h3,h4{break-after:avoid}}</style><body>${body}</body></html>`, 'text/html;charset=utf-8', '講道閱讀文件.html');
    message.textContent = '已產生閱讀文件，下載後可離線開啟，或使用列印功能存為 PDF。';
  });
  source();
})();
