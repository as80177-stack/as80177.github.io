(() => {
  const pages = {
    cover: document.getElementById('welcomeCover'),
    verse: document.getElementById('versePage'),
    home: document.getElementById('homeContent')
  };
  const headings = {cover: 'welcomeTitle', verse: 'versePageHeading', home: 'homeHeading'};
  const enter = document.getElementById('enterHome');
  document.getElementById('welcomeTitle').tabIndex = -1;
  function pageFromHash() {
    return location.hash === '#home' ? 'home' : location.hash === '#verse' ? 'verse' : 'cover';
  }
  function showPage(page, navigate = false) {
    if (navigate) history.pushState(null, '', location.pathname + location.search + (page === 'cover' ? '' : '#' + page));
    Object.entries(pages).forEach(([key, element]) => { element.hidden = key !== page; });
    document.getElementById(headings[page]).focus({preventScroll: true});
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('home-page-change', {detail: {page}}));
  }
  enter.addEventListener('click', () => {
    if (document.getElementById('welcomeSound').checked) window.dispatchEvent(new Event('welcome-music-play'));
    showPage('verse', true);
  });
  document.querySelectorAll('[data-home-page]').forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.homePage, true));
  });
  const verse = pages.verse;
  let gesture = null;
  const interactive = target => target.closest('button, a, input, select, textarea, label, summary, details');
  verse.addEventListener('pointerdown', event => {
    if (!event.isPrimary) { if (gesture) gesture.moved = true; return; }
    gesture = {x: event.clientX, y: event.clientY, start: performance.now(), moved: false, selected: Boolean(window.getSelection()?.toString().trim())};
  });
  verse.addEventListener('pointermove', event => {
    if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 12) gesture.moved = true;
  });
  verse.addEventListener('pointercancel', () => { if (gesture) gesture.moved = true; });
  verse.addEventListener('click', event => {
    const tap = gesture;
    gesture = null;
    if (event.button !== 0 || interactive(event.target) || window.getSelection()?.toString().trim()) return;
    if (event.detail && tap && (tap.moved || tap.selected || performance.now() - tap.start > 500)) return;
    showPage('home', true);
  });
  verse.addEventListener('keydown', event => {
    if (event.target === verse && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      showPage('home', true);
    }
  });
  window.addEventListener('popstate', () => showPage(pageFromHash()));
  showPage(pageFromHash());
})();
