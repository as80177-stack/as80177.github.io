(() => {
  function set(card, language) {
    const source = Array.from(card.querySelectorAll('.homily-translation-source')).find(item => item.dataset.language === language);
    if (!source) return;
    window.HomilyNarration?.hide();
    card.dataset.readingLanguage = language;
    card.dataset.homilyTitle = source.dataset.title;
    card.querySelector('.homily-title').textContent = `${card.dataset.homilyIndex}. ${source.dataset.title}`;
    const notes = card.querySelector('.notes');
    notes.textContent = source.textContent;
    notes.lang = language === 'en' ? 'en' : 'zh-Hant';
    card.querySelector('.homily-language').value = language;
    card.querySelector('.copy-status').textContent = '';
    const fallback = card.querySelector('.manual-copy');
    if (fallback) fallback.remove();
    card.dispatchEvent(new CustomEvent('homily-language-changed', {bubbles:true}));
  }
  document.getElementById('list').addEventListener('change', event => {
    if (event.target.matches('.homily-language')) set(event.target.closest('.homily-card'), event.target.value);
  });
  window.HomilyLanguages = {set};
})();
