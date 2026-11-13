(async () => {
  const text = document.getElementById('verseText');
  const reference = document.getElementById('verseReference');
  const button = document.getElementById('nextVerse');
  let remaining = [];
  let lastReference = '';
  try {
    const response = await fetch('data/verses.json');
    if (!response.ok) throw new Error('無法讀取金句');
    const data = await response.json();
    if (!Array.isArray(data.verses) || data.verses.length !== 100) throw new Error('金句資料不完整');
    function show() {
      if (!remaining.length) {
        remaining = [...data.verses];
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        if (remaining.length > 1 && remaining[remaining.length - 1].reference === lastReference) {
          [remaining[0], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[0]];
        }
      }
      const verse = remaining.pop();
      text.textContent = verse.text;
      reference.textContent = `${verse.reference} · ${data.translation}（${data.note}）`;
      lastReference = verse.reference;
    }
    button.addEventListener('click', show);
    // Keep the visible verse stable if a slow fetch completes after entry.
    // The loaded collection is available as soon as the reader taps Next.
    const page = document.getElementById('versePage');
    if (!page || page.hidden) show();
    button.disabled = false;
  } catch (_) {
    text.textContent = '你們醒寤祈禱罷！免陷於誘惑。';
    reference.textContent = '瑪竇福音 26:41 · 思高聖經（經文節錄）';
    const errorMessage = '其餘金句暫時無法載入，請連線後按「檢查更新」。';
    if (document.getElementById('versePage')?.hidden !== false) {
      document.getElementById('verseHelp').textContent = errorMessage;
    } else {
      button.title = errorMessage;
    }
  }
})();
