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
    // Franck, Panis angelicus, opening vocal phrase in A major:
    // C#5 C#5 B4 B4 A4 A4 (Pa-nis an-ge-li-cus).
    // Rhythm in quarter-note beats: 2, 1, 1, .75, .25, 1.
    // Score reference: O. Bornemann print, BnF btv1b108722495;
    // transcription cross-check: github.com/elreydiegofernando-collab/pitch-lab
    // commit c499c026667921073ee2e6756c0c1f5fe8249ec4, public/songs/panis-angelicus.txt.
    const melody = [[73,2], [73,1], [71,1], [71,0.75], [69,0.25], [69,1]];
    const beat = 60 / 80;
    const start = audio.currentTime + 0.03;
    let elapsed = 0;
    melody.forEach(([note, beats]) => {
      const time = start + elapsed * beat;
      const duration = beats * beat * 0.95;
      const frequency = 440 * 2 ** ((note - 69) / 12);
      const release = Math.min(0.16, duration * 0.35);
      [[1,0.7],[2,0.22],[3,0.07],[4,0.035]].forEach(([harmonic, level]) => {
        const oscillator = audio.createOscillator();
        const envelope = audio.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * harmonic;
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(level, time + Math.min(0.055, duration * 0.2));
        envelope.gain.setValueAtTime(level * 0.85, time + duration - release);
        envelope.gain.linearRampToValueAtTime(0, time + duration);
        oscillator.connect(envelope); envelope.connect(output);
        oscillator.start(time); oscillator.stop(time + duration + 0.02);
      });
      elapsed += beats;
    });
    const active = audio;
    setTimeout(() => { if (active.state !== 'closed') active.close().catch(() => {}); }, Math.ceil((elapsed * beat + 0.5) * 1000));
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
