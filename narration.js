(() => {
  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  let panel, status, play, pause, stopButton, voiceSelect, rateSelect;
  let language = 'zh';
  let voices = [], chunks = [], index = 0, run = 0, state = 'idle';
  let selectedVoice = '', selectedRate = '0.9';
  let activeUtterance;
  let startTimer;
  try {
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
    voices = synth.getVoices().filter(v => language === 'en' ? /^en([-_]|$)/i.test(v.lang) : /^(zh|cmn|yue)([-_]|$)/i.test(v.lang));
    voiceSelect.replaceChildren(new Option(language === 'en' ? '自動選擇英文聲音' : '自動選擇中文聲音', ''));
    voices.forEach(v => voiceSelect.add(new Option(`${v.name} · ${v.lang}${v.localService ? '（裝置聲音）' : '（可能需連線）'}`, v.voiceURI)));
    voiceSelect.value = voices.some(v => v.voiceURI === selectedVoice) ? selectedVoice : '';
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
    const chosen = voices.find(v => v.voiceURI === voiceSelect.value) || voices.find(v => /^zh[-_]TW$/i.test(v.lang)) || voices.find(v => /^zh[-_]CN$/i.test(v.lang)) || voices[0];
    if (chosen) utterance.voice = chosen;
    utterance.lang = chosen?.lang || (language === 'en' ? 'en-US' : 'zh-TW');
    utterance.rate = Number(rateSelect.value);
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => {
      if (token !== run) return;
      clearTimeout(startTimer);
      status.textContent = `正在朗讀 · 第 ${index + 1}／${chunks.length} 段`;
    };
    utterance.onend = () => { if (token === run) { clearTimeout(startTimer); index++; speakNext(token); } };
    utterance.onerror = event => {
      if (token !== run) return;
      stop(event.error === 'not-allowed' ? '瀏覽器未允許播放，請再點一次「開始朗讀」。' : '朗讀無法繼續。請選擇其他聲音，或在手機文字轉語音設定中安裝對應語言後重試。');
    };
    startTimer = setTimeout(() => {
      if (token === run && state !== 'paused') stop('未收到語音播放回應。請檢查手機的文字轉語音設定，或選擇其他聲音再試。');
    }, 10000);
    try { synth.speak(utterance); } catch (_) { stop('目前無法朗讀，請確認裝置的語音設定。'); }
  }
  function start(text, card) {
    language = card?.dataset.readingLanguage === 'en' ? 'en' : 'zh';
    if (panel) panel.querySelector('#narrationVoiceLabel').textContent = language === 'en' ? '英文聲音' : '中文聲音';
    if (card) card.querySelector('.homily-actions').after(panel);
    panel.hidden = false;
    if (!supported) return;
    stop(language === 'en' ? '正在準備英文朗讀…' : '正在準備中文朗讀…');
    chunks = split(text); index = 0;
    if (!text.trim()) { status.textContent = '此篇沒有可朗讀的內容。'; return; }
    populateVoices(); state = 'speaking'; controls(); speakNext(run);
  }
  function attach() {
    panel = document.createElement('section'); panel.className = 'narration-panel'; panel.hidden = true;
    panel.setAttribute('aria-label','道理朗讀');
    panel.innerHTML = `<div class="narration-actions"><button id="narrationPlay" type="button">開始朗讀</button><button id="narrationPause" type="button" disabled>暫停</button><button id="narrationStop" type="button" disabled>停止</button></div>
      <details class="narration-settings"><summary>聲音與語速</summary><div class="narration-options"><label><span id="narrationVoiceLabel">中文聲音</span> <select id="narrationVoice"></select></label><label>語速 <select id="narrationRate"><option value="0.8">較慢</option><option value="0.9">稍慢</option><option value="1">標準</option><option value="1.05">輕快</option><option value="1.1">較快</option></select></label></div><p class="reading-hint">使用裝置原有聲音；離線需已安裝對應語言的語音資料。</p></details>
      <p id="narrationStatus" role="status" aria-live="polite"></p>`;
    document.body.append(panel);
    status = panel.querySelector('#narrationStatus'); play = panel.querySelector('#narrationPlay'); pause = panel.querySelector('#narrationPause'); stopButton = panel.querySelector('#narrationStop'); voiceSelect = panel.querySelector('#narrationVoice'); rateSelect = panel.querySelector('#narrationRate');
    rateSelect.value = ['0.8','0.9','1','1.05','1.1'].includes(selectedRate) ? selectedRate : '0.9';
    status.textContent = supported ? '可朗讀標題與整篇道理。' : '此瀏覽器不支援朗讀，請改用 Chrome、Edge 或 Safari。';
    voiceSelect.disabled = rateSelect.disabled = !supported;
    populateVoices(); controls();
    play.addEventListener('click', () => {
      const card = panel.closest('.homily-card');
      if (card) start(`${card.dataset.homilyTitle}\n\n${card.querySelector('.notes').textContent}`, card);
    });
    stopButton.addEventListener('click', () => stop());
    pause.addEventListener('click', () => {
      if (state === 'speaking') { state = 'paused'; synth.pause(); status.textContent = '已暫停，按「繼續」接著朗讀。'; }
      else if (state === 'paused') { state = 'speaking'; synth.resume(); status.textContent = '繼續朗讀中…'; }
      controls();
    });
    function settingsChanged() {
      selectedVoice = voiceSelect.value;
      try { localStorage.setItem('homily-narration-voice', selectedVoice); localStorage.setItem('homily-narration-rate', rateSelect.value); } catch (_) {}
      if (state !== 'idle') stop('聲音設定已變更，請點「開始朗讀」以新設定重新播放。');
    }
    voiceSelect.addEventListener('change', settingsChanged); rateSelect.addEventListener('change', settingsChanged);
    if (supported) synth.addEventListener('voiceschanged', populateVoices);
    document.getElementById('list').addEventListener('click', event => {
      if (!event.target.closest('.homily-toggle,.homily-collapse,.folder-button')) return;
      const card = panel.closest('.homily-card');
      if (card && (!card.classList.contains('open') || !card.closest('.folder')?.classList.contains('open'))) hide();
    });
    new MutationObserver(() => {
      if (state !== 'idle' && !panel.isConnected) hide();
    }).observe(document.getElementById('list'), {childList:true, subtree:true});
  }
  window.addEventListener('pagehide', () => stop());
  function hide() { stop(); if (panel) panel.hidden = true; }
  window.HomilyNarration = {attach, start, stop, hide};
})();
