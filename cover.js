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
    const tone = audio.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    tone.Q.value = 0.5;
    output.connect(tone);
    tone.connect(audio.destination);
    // Locally generated stereo church-room impulse; no recording or download.
    const reverb = audio.createConvolver();
    const reverbSeconds = 3.0;
    const impulse = audio.createBuffer(2, Math.ceil(audio.sampleRate * reverbSeconds), audio.sampleRate);
    let seed = 1741;
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const seconds = i / audio.sampleRate;
        samples[i] = seconds < 0.025 ? 0 : (seed / 2147483648 - 1) * Math.exp(-seconds * 2.8) * (1 - i / samples.length);
      }
    }
    reverb.buffer = impulse;
    const room = audio.createGain();
    room.gain.value = 0.28;
    tone.connect(reverb); reverb.connect(room); room.connect(audio.destination);
    // A gentle plagal (IV–I) “Amen” cadence, without speech or singing.
    // F major → C major, with the soprano resolving F4 → E4.
    const chords = [
      { notes: [65,53,57,60], offset: 0, duration: 1.9, release: 0.65 },
      { notes: [64,48,55,60], offset: 1.7, duration: 5.5, release: 3.7 }
    ];
    const start = audio.currentTime + 0.03;
    chords.forEach(({ notes, offset, duration, release }) => {
      const time = start + offset;
      notes.forEach((note, voice) => {
        const frequency = 440 * 2 ** ((note - 69) / 12);
        const balance = voice === 0 ? 0.65 : 0.42;
        // Warm principal 8′, soft Bourdon 16′ and restrained flute 4′.
        [[1,0.7],[0.5,0.2],[2,0.23],[3,0.065],[4,0.035]].forEach(([harmonic, level]) => {
          const oscillator = audio.createOscillator();
          const envelope = audio.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency * harmonic;
          envelope.gain.setValueAtTime(0, time);
          envelope.gain.linearRampToValueAtTime(level * balance, time + 0.14);
          envelope.gain.setValueAtTime(level * balance, time + duration - release);
          const fade = Float32Array.from({length:128}, (_, i) =>
            i === 127 ? 0 : level * balance * Math.cos((i / 127) * Math.PI / 2) ** 2);
          envelope.gain.setValueCurveAtTime(fade, time + duration - release, release);
          oscillator.connect(envelope); envelope.connect(output);
          oscillator.start(time); oscillator.stop(time + duration + 0.02);
        });
      });
    });
    const active = audio;
    const soundEnd = start + Math.max(...chords.map(chord => chord.offset + chord.duration)) + reverbSeconds;
    setTimeout(() => { if (active.state !== 'closed') active.close().catch(() => {}); }, Math.ceil((soundEnd - audio.currentTime + 0.25) * 1000));
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
