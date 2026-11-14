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
  let verseWidth = window.innerWidth;
  function pinVerseHeight() {
    pages.verse.style.minHeight = '';
    pages.verse.style.minHeight = getComputedStyle(pages.verse).minHeight;
    verseWidth = window.innerWidth;
  }
  function showPage(page, navigate = false, focus = true) {
    const settings = document.getElementById('appSettings');
    if (settings?.open) settings.close();
    if (navigate) history.pushState(null, '', location.pathname + location.search + (page === 'cover' ? '' : '#' + page));
    Object.entries(pages).forEach(([key, element]) => { element.hidden = key !== page; });
    if (page === 'verse') pinVerseHeight();
    if (focus) document.getElementById(headings[page]).focus({preventScroll: true});
    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('home-page-change', {detail: {page}}));
  }
  const door = document.getElementById('doorTransition');
  let entering = false;
  let entryToken = 0;
  let animations = [];
  let artworkReady = false;
  let doveArtworkReady = false;
  let artworkLoading = true;
  const enterLabel = enter.textContent;
  enter.disabled = true;
  enter.setAttribute('aria-busy', 'true');
  enter.textContent = '準備開門畫面…';
  // Decode the actual visible image elements, not just the resource URL.
  // A cold/slow first load must never reveal a plain door before its angels.
  const artwork = [...door.querySelectorAll('.door-art')];
  function decodeArtwork(image) {
    if (image.decode) return image.decode();
    if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error('door image'));
    return new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, {once: true});
      image.addEventListener('error', reject, {once: true});
    });
  }
  const dovePreparation = Promise.all([...door.querySelectorAll('.dove-art')].map(decodeArtwork))
    .then(() => true, () => false);
  Promise.all([Promise.all(artwork.map(decodeArtwork)), dovePreparation])
    .then(([, dovesReady]) => { artworkReady = artwork.length === 2; doveArtworkReady = dovesReady; }).catch(() => {
    // If the image cannot load, allow entry directly instead of a half-drawn door.
    enter.title = '開門圖案暫時無法載入，仍可進入聖經金句。';
  }).finally(() => {
    artworkLoading = false;
    enter.textContent = enterLabel;
    if (!entering) { enter.disabled = false; enter.removeAttribute('aria-busy'); }
  });
  function finishEntry() {
    // Keep the compositor transparent before cancelling transforms, so the
    // closed doors cannot flash back during animation cleanup.
    door.style.opacity = '0';
    door.hidden = true;
    animations.forEach(animation => animation.cancel());
    animations = [];
    document.body.classList.remove('is-entering');
    Object.values(pages).forEach(page => { page.inert = false; });
    enter.disabled = artworkLoading;
    if (!artworkLoading) enter.removeAttribute('aria-busy');
    entering = false;
  }
  function animate(element, frames, options) {
    const animation = element.animate(frames, {fill: 'forwards', ...options});
    animations.push(animation);
    return animation.finished;
  }
  function flightPoint(points, progress) {
    // Catmull–Rom interpolation gives continuous bends through each waypoint.
    const position = progress * (points.length - 1);
    const segment = Math.min(points.length - 2, Math.floor(position));
    const t = position - segment;
    return [0,1,2].map(axis => {
      const a = points[Math.max(0, segment - 1)][axis];
      const b = points[segment][axis];
      const c = points[segment + 1][axis];
      const d = points[Math.min(points.length - 1, segment + 2)][axis];
      return .5 * (2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t);
    });
  }
  function smoothStep(value) {
    const t = Math.max(0, Math.min(1, value));
    return t*t*(3-2*t);
  }
  enter.addEventListener('click', async event => {
    if (entering || artworkLoading) return;
    const keyboardEntry = event.detail === 0;
    if (document.getElementById('welcomeSound').checked) {
      window.dispatchEvent(new Event('welcome-music-play'));
    }
    if (document.getElementById('entranceSound').checked) window.dispatchEvent(new Event('entrance-light-sound'));
    // Honor reduced-motion preferences and older browsers without Web Animations.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !door.animate || !artworkReady) {
      showPage('verse', true, keyboardEntry);
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
      showPage('verse', true, false);
      const easing = 'cubic-bezier(.42,0,.58,1)';
      const flights = [
        {delay: 650, wingBeat: 1450, pan: -.8, points: [[0,0,6],[-4,-4,8],[-12,-9,10],[-20,-15,9],[-33,-25,11],[-65,-48,14]]},
        {delay: 1150, wingBeat: 1550, pan: .8, points: [[0,1,-3],[4,3,0],[12,2,-3],[21,-4,-6],[34,-14,-9],[65,-34,-12]]},
        {delay: 1650, wingBeat: 1500, pan: .2, points: [[0,0,0],[-3,-3,3],[-2,-8,2],[2,-16,-2],[8,-33,-5],[5,-74,-8]]}
      ];
      // Vary each route slightly per entry, but only once before interpolation;
      // never add per-frame randomness that would make the birds tremble.
      flights.forEach((flight, bird) => {
        flight.points = flight.points.map(([x,y,bank], point) => {
          if (point === 0) return [x,y,bank];
          const end = point === flight.points.length - 1;
          const jitter = range => (Math.random() * 2 - 1) * range;
          return [x + jitter(end ? (bird === 2 ? 7 : 3) : .7), y + jitter(end ? 2 : .4), bank + jitter(.8)];
        });
      });
      if (doveArtworkReady && document.getElementById('entranceSound').checked) {
        window.dispatchEvent(new CustomEvent('dove-wing-sound', {detail: {
          birds: flights.map(path => ({delay: path.delay, period: path.wingBeat, duration: 2700, pan: path.pan, strokePhase: .35}))
        }}));
      }
      const doveFlights = (doveArtworkReady ? [...door.querySelectorAll('.entry-dove')] : []).map((dove, index) => {
        const path = flights[index];
        // Blend adjacent anatomical poses instead of stepping/cutting frames.
        // One slow continuous stroke and recovery; no skipped reverse poses.
        const poses = [[0,0],[1,.18],[2,.36],[3,.54],[4,.72],[5,.87],[0,1]];
        dove.querySelectorAll('.dove-pose').forEach((layer, pose) => {
          animate(layer, poses.map(([frame, offset]) => ({
            opacity: frame === pose ? 1 : 0, offset, easing: 'ease-in-out'
          })), {
            duration: path.wingBeat, iterations: Math.ceil(2700 / path.wingBeat),
            delay: path.delay, easing: 'linear', fill: 'both'
          }).catch(() => {});
        });
        const route = Array.from({length: 65}, (_, frame) => {
          const progress = frame / 64;
          const [x,y,bank] = flightPoint(path.points, progress);
          const scale = .04 + .91 * progress ** 1.3;
          const opacity = smoothStep(progress / .14) * (1 - smoothStep((progress - .82) / .18));
          return {
            opacity, offset: progress,
            transform: `translate(-50%,-50%) translate(${x.toFixed(4)}vw,${y.toFixed(4)}vh) scale(${scale.toFixed(5)}) rotate(${bank.toFixed(3)}deg)`
          };
        });
        return animate(dove, route, {duration: 2700, delay: path.delay, easing: 'linear', fill: 'both'});
      });
      await Promise.all([
        ...doveFlights,
        animate(door.querySelector('.door-left'), [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(-90deg)'}], {duration: 4100, easing}),
        animate(door.querySelector('.door-right'), [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(90deg)'}], {duration: 4100, easing}),
        animate(door.querySelector('.door-gateway'), [{transform: 'scale(1)'}, {transform: 'scale(1.08)'}], {duration: 4100, easing}),
        animate(door.querySelector('.door-threshold-light'), [
          {opacity: 0, offset: 0}, {opacity: .8, offset: .16},
          {opacity: .65, offset: .36}, {opacity: 0, offset: .7}, {opacity: 0, offset: 1}
        ], {duration: 4100, easing}),
        // Doors, dispersing light and the verse share one timeline and easing.
        // Start revealing text through the light immediately: no gold-only hold.
        animate(door.querySelector('.door-glow'), [
          {opacity: 1, offset: 0}, {opacity: .72, offset: .12},
          {opacity: .34, offset: .35}, {opacity: .08, offset: .65}, {opacity: 0, offset: 1}
        ], {duration: 4100, easing}),
        animate(door.querySelector('.door-sunlight'), [
          {opacity: 0, transform: 'scale(.08)', offset: 0},
          {opacity: .45, transform: 'scale(.36)', offset: .12},
          {opacity: .8, transform: 'scale(1.05)', offset: .38},
          {opacity: .34, transform: 'scale(1.4)', offset: .7},
          {opacity: 0, transform: 'scale(1.65)', offset: 1}
        ], {duration: 4100, easing}),
        animate(pages.verse, [
          {opacity: 0, offset: 0}, {opacity: .3, offset: .12},
          {opacity: .7, offset: .35}, {opacity: .94, offset: .65}, {opacity: 1, offset: 1}
        ], {duration: 4100, easing, fill: 'both'}),
        animate(door.querySelector('.door-frame'), [{opacity: 1, offset: 0}, {opacity: 1, offset: .7}, {opacity: 0, offset: 1}], {duration: 4100, easing: 'linear'})
      ]);
      if (token !== entryToken) return;
      await animate(door, [{opacity: 1}, {opacity: 0}], {duration: 180, easing: 'ease-out'});
      if (token !== entryToken) return;
      finishEntry();
      if (keyboardEntry) document.getElementById('versePageHeading').focus({preventScroll: true});
    } catch (_) {
      if (token !== entryToken) return;
      finishEntry();
      if (pages.verse.hidden) showPage('verse', true, keyboardEntry);
      else if (keyboardEntry) document.getElementById('versePageHeading').focus({preventScroll: true});
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
  // Height-only changes on Android (browser bars settling) must not recenter
  // the verse. A real width/orientation change still gets a responsive layout.
  window.addEventListener('resize', () => {
    if (!pages.verse.hidden && window.innerWidth !== verseWidth) pinVerseHeight();
  });
  window.addEventListener('popstate', () => {
    entryToken++;
    finishEntry();
    showPage(pageFromHash());
  });
  window.addEventListener('pagehide', () => { entryToken++; finishEntry(); });
  showPage(pageFromHash());
})();
