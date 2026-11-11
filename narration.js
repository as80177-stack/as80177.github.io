(() => {
  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  let panel, status, play, pause, stopButton, voiceSelect, rateSelect, styleSelect;
  let voices = [], chunks = [], index = 0, run = 0, state = 'idle';
  let selectedVoice = '', selectedRate = '0.9', selectedStyle = 'calm';
  let activeUtterance;
  let startTimer;
  try {
    selectedStyle = localStorage.getItem('homily-narration-style') || 'calm';
    selectedVoice = localStorage.getItem('homily-narration-voice') || '';
    selectedRate = localStorage.getItem('homily-narration-rate') || '0.9';
  } catch (_) {}
  function controls() {
    if (!panel) return;
    play.disabled = !supported || state === 'speaking' || state === 'paused';
    pause.disabled = !supported || !['speaking','paused'].includes(state);
    pause.textContent = state === 'paused' ? '繼續' : '暫停';
    stopButton.disabled = !['speaking','paused'].includes(state);
  }
  function stop(message = '已停止朗讀。') {
    clearTimeout(startTimer);
    run++; state = 'idle'; activeUtterance = null;
    if (supported) { synth.cancel(); synth.resume(); }
    if (status) status.textContent = message;
    controls();
  }
  function populateVoices() {
    if (!voiceSelect || !supported) return;
    voices = synth.getVoices().filter(v => /^(zh|cmn|yue)([-_]|$)/i.test(v.lang));
    voiceSelect.replaceChildren(new Option('自動選擇中文聲音', ''));
    voices.forEach(v => voiceSelect.add(new Option(`${v.name} · ${v.lang}${v.localService ? '（裝置聲音）' : '（可能需連線）'}`, v.voiceURI)));
    voiceSelect.value = voices.some(v => v.voiceURI === selectedVoice) ? selectedVoice : '';
  }
  function styledVoice() {
    const preferred = styleSelect.value === 'cute'
      ? voices.find(v => /child|kid|xiaoyou|曉悠|晓悠/i.test(v.name)) || voices.find(v => /xiaoxiao|tingting|meijia|hanhan|\bfemale\b|曉曉|晓晓|美嘉|婷婷/i.test(v.name))
      : voices.find(v => /\b(male|david|mark|daniel|danny|aaron)\b|yun(xi|yang|jian|feng|hao|zhe)|zhi(wei|ming)|男|雲希|云希|志明|云扬|雲揚/i.test(v.name));
    return preferred || voices.find(v => /^zh[-_]TW$/i.test(v.lang)) || voices.find(v => /^zh[-_]CN$/i.test(v.lang)) || voices[0];
  }
  function split(text) {
    const result = []; let buffer = ''; let length = 0;
    for (const char of text) {
      buffer += char; length++;
      if (length >= 140 || (length >= 30 && /[。！？!?；;\n]/.test(char))) {
        result.push(buffer); buffer = ''; length = 0;
      }
    }
    if (buffer) result.push(buffer);
    return result;
  }
  function speakNext(token) {
    if (token !== run) return;
    if (index >= chunks.length) { state = 'idle'; activeUtterance = null; status.textContent = '全文朗讀完畢。'; controls(); return; }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    activeUtterance = utterance;
    const chosen = voices.find(v => v.voiceURI === voiceSelect.value) || styledVoice();
    if (chosen) utterance.voice = chosen;
    utterance.lang = chosen?.lang || 'zh-TW';
    utterance.rate = Number(rateSelect.value);
    utterance.pitch = styleSelect.value === 'cute' ? 1.45 : 0.78;
    utterance.volume = 1;
    utterance.onstart = () => {
      if (token !== run) return;
      clearTimeout(startTimer);
      status.textContent = `正在朗讀 · 第 ${index + 1}／${chunks.length} 段`;
    };
    utterance.onend = () => { if (token === run) { clearTimeout(startTimer); index++; speakNext(token); } };
    utterance.onerror = event => {
      if (token !== run) return;
      stop(event.error === 'not-allowed' ? '瀏覽器未允許播放，請再點一次「開始朗讀」。' : '朗讀無法繼續。請選擇其他中文聲音，或在手機文字轉語音設定中安裝中文語音後重試。');
    };
    startTimer = setTimeout(() => {
      if (token === run && state !== 'paused') stop('未收到語音播放回應。請檢查手機的中文文字轉語音設定，或選擇其他聲音再試。');
    }, 10000);
    try { synth.speak(utterance); } catch (_) { stop('目前無法朗讀，請確認裝置的中文語音設定。'); }
  }
  function start(text) {
    if (!supported) return;
    stop('正在準備中文朗讀…');
    chunks = split(text); index = 0;
    if (!text.trim()) { status.textContent = '此篇沒有可朗讀的內容。'; return; }
    populateVoices(); state = 'speaking'; controls(); speakNext(run);
  }
  function attach(container) {
    panel = document.createElement('section'); panel.className = 'narration-panel reader-settings';
    panel.setAttribute('aria-label','道理朗讀');
    panel.innerHTML = `<div class="narration-actions"><button id="narrationPlay" type="button">開始朗讀</button><button id="narrationPause" type="button" disabled>暫停</button><button id="narrationStop" type="button" disabled>停止</button></div>
      <div class="narration-options"><label>朗讀風格 <select id="narrationStyle"><option value="calm">沉穩男聲風格</option><option value="cute">可愛小朋友風格</option></select></label><label>中文聲音 <select id="narrationVoice"></select></label><label>語速 <select id="narrationRate"><option value="0.8">較慢</option><option value="0.9">沉穩</option><option value="1">標準</option><option value="1.05">輕快</option><option value="1.1">較快</option></select></label></div>
      <p id="narrationStatus" role="status" aria-live="polite"></p><p class="reading-hint">兩種風格以裝置中文聲音調整音高、語速呈現，效果依手機而異；可在「中文聲音」選擇喜歡的音色。離線朗讀需裝置已安裝中文語音；部分聲音需要網路。</p>`;
    container.querySelector('h2').after(panel);
    status = panel.querySelector('#narrationStatus'); play = panel.querySelector('#narrationPlay'); pause = panel.querySelector('#narrationPause'); stopButton = panel.querySelector('#narrationStop'); voiceSelect = panel.querySelector('#narrationVoice'); rateSelect = panel.querySelector('#narrationRate');
    styleSelect = panel.querySelector('#narrationStyle');
    styleSelect.value = selectedStyle === 'cute' ? 'cute' : 'calm';
    rateSelect.value = ['0.8','0.9','1','1.05','1.1'].includes(selectedRate) ? selectedRate : '0.9';
    status.textContent = supported ? '可朗讀標題與整篇道理。' : '此瀏覽器不支援朗讀，請改用 Chrome、Edge 或 Safari。';
    voiceSelect.disabled = rateSelect.disabled = styleSelect.disabled = !supported;
    populateVoices(); controls();
    play.addEventListener('click', () => start(`${document.getElementById('readerTitle').textContent}\n\n${document.getElementById('readerText').textContent}`));
    stopButton.addEventListener('click', () => stop());
    pause.addEventListener('click', () => {
      if (state === 'speaking') { state = 'paused'; synth.pause(); status.textContent = '已暫停，按「繼續」接著朗讀。'; }
      else if (state === 'paused') { state = 'speaking'; synth.resume(); status.textContent = '繼續朗讀中…'; }
      controls();
    });
    function settingsChanged() {
      selectedVoice = voiceSelect.value;
      try { localStorage.setItem('homily-narration-style', styleSelect.value); localStorage.setItem('homily-narration-voice', selectedVoice); localStorage.setItem('homily-narration-rate', rateSelect.value); } catch (_) {}
      if (state !== 'idle') stop('聲音設定已變更，請點「開始朗讀」以新設定重新播放。');
    }
    styleSelect.addEventListener('change', () => {
      voiceSelect.value = '';
      rateSelect.value = styleSelect.value === 'cute' ? '1.05' : '0.9';
      settingsChanged();
    });
    voiceSelect.addEventListener('change', settingsChanged); rateSelect.addEventListener('change', settingsChanged);
    if (supported) synth.addEventListener('voiceschanged', populateVoices);
  }
  window.addEventListener('pagehide', () => stop());
  window.HomilyNarration = {attach, start, stop};
})();
