(() => {
  const cover = document.getElementById('welcomeCover');
  const home = document.getElementById('homeContent');
  const enter = document.getElementById('enterHome');
  let audio;
  function showHome() {
    cover.hidden = true;
    home.hidden = false;
    document.getElementById('homeHeading').focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
  async function playOrgan() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (audio) await audio.close();
    audio = new Audio();
    await audio.resume();
    const output = audio.createGain();
    output.gain.value = 0.12;
    output.connect(audio.destination);
    // Soft pipe-like harmonics, an original C–F–G–C cadence (no audio downloads).
    const chords = [[48,60,64,67], [41,60,65,69], [43,59,62,67], [48,60,64,67,72]];
    const start = audio.currentTime + 0.03;
    chords.forEach((notes, chord) => {
      const time = start + chord * 0.6;
      const duration = chord === 3 ? 1.4 : 0.85;
      notes.forEach(note => {
        const frequency = 440 * 2 ** ((note - 69) / 12);
        [[1,0.36],[2,0.14],[3,0.045],[4,0.025]].forEach(([harmonic, level]) => {
          const oscillator = audio.createOscillator();
          const envelope = audio.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency * harmonic;
          envelope.gain.setValueAtTime(0, time);
          envelope.gain.linearRampToValueAtTime(level, time + 0.09);
          envelope.gain.setValueAtTime(level * 0.85, time + duration - 0.3);
          envelope.gain.linearRampToValueAtTime(0, time + duration);
          oscillator.connect(envelope); envelope.connect(output);
          oscillator.start(time); oscillator.stop(time + duration + 0.02);
        });
      });
    });
    const active = audio;
    setTimeout(() => { if (active.state !== 'closed') active.close().catch(() => {}); }, 4000);
  }
  enter.addEventListener('click', () => {
    if (document.getElementById('welcomeSound').checked) {
      playOrgan().catch(() => {
        document.getElementById('welcomeAudioStatus').textContent = '目前無法播放音效，仍可正常閱讀。';
      });
    }
    history.replaceState(null, '', '#home');
    showHome();
  });
  document.getElementById('showCover').addEventListener('click', () => {
    if (audio && audio.state !== 'closed') audio.close().catch(() => {});
    history.replaceState(null, '', location.pathname + location.search);
    home.hidden = true;
    cover.hidden = false;
    enter.focus({preventScroll:true});
    window.scrollTo(0, 0);
  });
  if (location.hash === '#home') showHome();
  else { home.hidden = true; cover.hidden = false; }
})();
