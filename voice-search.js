(() => {
  const button = document.getElementById('voiceSearchButton');
  const status = document.getElementById('voiceSearchStatus');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition, listening = false, handled = false, cancelled = false, timer;
  function idle() {
    clearTimeout(timer); listening = false;
    button.textContent = '🎙 語音找道理'; button.setAttribute('aria-pressed','false');
  }
  function cancel(message) {
    cancelled = true;
    if (recognition) recognition.abort();
    idle(); if (message) status.textContent = message;
  }
  button.addEventListener('click', () => {
    if (!Recognition) {
      status.textContent = '此瀏覽器不支援內建語音搜尋。請點搜尋欄，再用手機鍵盤的麥克風輸入。';
      document.getElementById('searchInput').focus(); return;
    }
    if (listening) { cancel('已停止語音辨識。'); return; }
    recognition = new Recognition();
    recognition.lang = 'zh-TW'; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
    handled = cancelled = false; listening = true;
    button.textContent = '停止辨識'; button.setAttribute('aria-pressed','true');
    status.textContent = '正在聆聽，請說關鍵字或位置，例如「找甲年第七主日」。語音辨識可能需要網路。';
    recognition.onresult = async event => {
      if (cancelled || handled) return;
      for (let i=event.resultIndex;i<event.results.length;i++) {
        const result = event.results[i]; const text = result[0].transcript.trim();
        if (!result.isFinal) { status.textContent = `聽到「${text}」⋯辨識中`; continue; }
        handled = true;
        try { recognition.stop(); } catch (_) {}
        idle(); button.disabled = true;
        try {
          const command = window.HomilyVoiceCommands.parse(text);
          if (!command.query && !command.folderId && !command.section && !command.cycle) throw new Error('沒有辨識到搜尋內容，請再試一次。');
          const outcome = await window.HomilySearch.navigate(command);
          const target = [...command.location,command.query].filter(Boolean).join('・') || text;
          status.textContent = outcome ? `已聽到「${text}」；搜尋：${target}。` : `已聽到「${text}」，但目前沒有符合的道理。可修改搜尋文字再試。`;
        } catch(error) { status.textContent = error.message || '語音搜尋失敗，請重試或使用文字搜尋。'; }
        finally { button.disabled = false; }
        return;
      }
    };
    recognition.onerror = event => {
      if (cancelled || handled) return;
      handled = true; idle();
      status.textContent = ({'not-allowed':'麥克風未獲允許。請在瀏覽器網站權限中允許麥克風，或用鍵盤語音輸入。','service-not-allowed':'瀏覽器未允許語音辨識服務，請改用鍵盤上的麥克風輸入。','audio-capture':'找不到可用的麥克風，請檢查手機麥克風權限。','no-speech':'沒有聽到語音，請再按一次並清楚說出關鍵字。',network:'語音辨識連線失敗，請確認網路；仍可使用文字搜尋。',aborted:'已停止語音辨識。'})[event.error] || '無法完成語音辨識，請重試或改用文字搜尋。';
    };
    recognition.onend = () => { idle(); if (!handled && !cancelled) status.textContent = '沒有取得搜尋內容，請再按一次並說出關鍵字。'; };
    try { recognition.start(); timer = setTimeout(() => cancel('已結束聆聽，請再按一次開始語音搜尋。'),15000); }
    catch (_) { cancel('目前無法啟動語音辨識，請重試或用手機鍵盤的麥克風輸入。'); }
  });
  document.getElementById('voiceSearchClear').addEventListener('click', () => {
    if (listening) cancel();
    window.HomilySearch.reset(); status.textContent = '已清除語音篩選，顯示目前年度與類別的全部資料夾。';
  });
  window.addEventListener('pagehide', () => cancel());
  document.addEventListener('visibilitychange', () => { if (document.hidden && listening) cancel('已停止語音辨識。'); });
})();
