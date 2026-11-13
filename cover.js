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
  const door = document.getElementById('doorTransition');
  let entering = false;
  let entryToken = 0;
  let animations = [];
  function finishEntry() {
    // Keep the compositor transparent before cancelling transforms, so the
    // closed doors cannot flash back during animation cleanup.
    door.style.opacity = '0';
    door.hidden = true;
    animations.forEach(animation => animation.cancel());
    animations = [];
    document.body.classList.remove('is-entering');
    Object.values(pages).forEach(page => { page.inert = false; });
    enter.disabled = false;
    enter.removeAttribute('aria-busy');
    entering = false;
  }
  function animate(element, frames, options) {
    const animation = element.animate(frames, {...options, fill: 'forwards'});
    animations.push(animation);
    return animation.finished;
  }
  enter.addEventListener('click', async () => {
    if (entering) return;
    if (document.getElementById('welcomeSound').checked) {
      window.dispatchEvent(new Event('welcome-music-play'));
    }
    if (document.getElementById('entranceSound').checked) window.dispatchEvent(new Event('entrance-light-sound'));
    // Honor reduced-motion preferences and older browsers without Web Animations.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !door.animate) {
      showPage('verse', true);
      return;
    }
    entering = true;
    const token = ++entryToken;
    enter.disabled = true;
    enter.setAttribute('aria-busy', 'true');
    Object.values(pages).forEach(page => { page.inert = true; });
    document.body.classList.add('is-entering');
    door.style.opacity = '0';
    door.hidden = false;
    try {
      await animate(door, [{opacity: 0}, {opacity: 1}], {duration: 160, easing: 'ease-out'});
      if (token !== entryToken) return;
      // Let the opening drum strike land before either door begins to move.
      await animate(door, [{opacity: 1}, {opacity: 1}], {duration: 240});
      if (token !== entryToken) return;
      // The doors conceal the layout change. The second page is already in
      // place before they open, avoiding a white frame between the two pages.
      showPage('verse', true);
      const easing = 'cubic-bezier(.42,0,.22,1)';
      await Promise.all([
        animate(door.querySelector('.door-left'), [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(-102deg)'}], {duration: 4100, easing}),
        animate(door.querySelector('.door-right'), [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(102deg)'}], {duration: 4100, easing}),
        animate(door.querySelector('.door-glow'), [{opacity: 1}, {opacity: 0}], {duration: 3850, delay: 200, easing: 'ease-in-out'})
      ]);
      if (token !== entryToken) return;
      await animate(door, [{opacity: 1}, {opacity: 0}], {duration: 180, easing: 'ease-out'});
      if (token !== entryToken) return;
      finishEntry();
      document.getElementById('versePageHeading').focus({preventScroll: true});
    } catch (_) {
      if (token !== entryToken) return;
      finishEntry();
      if (!pages.verse.hidden) document.getElementById('versePageHeading').focus({preventScroll: true});
      else showPage('verse', true);
    }
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
    if (entering || event.button !== 0 || interactive(event.target) || window.getSelection()?.toString().trim()) return;
    if (event.detail && tap && (tap.moved || tap.selected || performance.now() - tap.start > 500)) return;
    showPage('home', true);
  });
  verse.addEventListener('keydown', event => {
    if (!entering && event.target === verse && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      showPage('home', true);
    }
  });
  // Block gestures on the overlay without hiding the document scrollbar or
  // changing the underlying page width at the end of the transition.
  door.addEventListener('wheel', event => event.preventDefault(), {passive: false});
  document.addEventListener('keydown', event => {
    if (entering && !event.altKey && !event.metaKey && !event.ctrlKey &&
        ['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) event.preventDefault();
  });
  window.addEventListener('popstate', () => {
    entryToken++;
    finishEntry();
    showPage(pageFromHash());
  });
  window.addEventListener('pagehide', () => { entryToken++; finishEntry(); });
  showPage(pageFromHash());
})();
