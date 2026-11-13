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
  window.addEventListener('popstate', () => showPage(pageFromHash()));
  showPage(pageFromHash());
})();
