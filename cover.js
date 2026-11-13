(() => {
  const cover = document.getElementById('welcomeCover');
  const home = document.getElementById('homeContent');
  const enter = document.getElementById('enterHome');
  function showHome() {
    cover.hidden = true;
    home.hidden = false;
    document.getElementById('homeHeading').focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
  enter.addEventListener('click', () => {
    if (document.getElementById('welcomeSound').checked) {
      window.dispatchEvent(new Event('welcome-music-play'));
    }
    history.replaceState(null, '', '#home');
    showHome();
  });
  document.getElementById('showCover').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname + location.search);
    home.hidden = true;
    cover.hidden = false;
    enter.focus({preventScroll:true});
    window.scrollTo(0, 0);
  });
  if (location.hash === '#home') showHome();
  else { home.hidden = true; cover.hidden = false; }
})();
