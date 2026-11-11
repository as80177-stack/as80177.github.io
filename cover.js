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
    output.gain.value = 0.16;
    const tone = audio.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 7500;
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
    // Three warm chords, without speech or singing: F major → D minor → C major.
    // User recording: approximately F3 → D3 → E3, with compact, sung-like pacing.
    const chords = [
      { notes: [53,41,45,48], offset: 0, duration: 1.4, release: 0.3 },
      { notes: [50,38,41,45], offset: 1.25, duration: 1.3, release: 0.3 },
      { notes: [52,36,43,48], offset: 2.4, duration: 3.0, release: 1.3, breathe: true }
    ];
    const start = audio.currentTime + 0.03;
    // Fade the room naturally after the final sustained chord; no extra notes.
    const finalEnd = start + Math.max(...chords.map(chord => chord.offset + chord.duration));
    room.gain.setValueAtTime(0.28, finalEnd);
    room.gain.linearRampToValueAtTime(0, finalEnd + 1.2);
    chords.forEach(({ notes, offset, duration, release, attack = 0.14, strength = 1, breathe = false }) => {
      const time = start + offset;
      notes.forEach((note, voice) => {
        const frequency = 440 * 2 ** ((note - 69) / 12);
        const balance = (voice === 0 ? 0.65 : 0.42) * strength;
        // Bright principal 8′ and flute 4′, balanced with a gentle upper mixture.
        [[1,0.7],[0.5,0.12],[2,0.5],[3,0.22],[4,0.2],[6,0.08],[8,0.05]].forEach(([harmonic, level]) => {
          const oscillator = audio.createOscillator();
          const envelope = audio.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency * harmonic;
          const peak = level * balance;
          envelope.gain.setValueAtTime(0, time);
          envelope.gain.linearRampToValueAtTime(peak, time + attack);
          if (breathe) {
            envelope.gain.linearRampToValueAtTime(peak * 0.6, time + 0.7);
            envelope.gain.linearRampToValueAtTime(peak * 0.9, time + 1.4);
          }
          envelope.gain.setValueAtTime(breathe ? peak * 0.9 : peak, time + duration - release);
          const fade = Float32Array.from({length:128}, (_, i) =>
            i === 127 ? 0 : peak * (breathe ? 0.9 : 1) * Math.cos((i / 127) * Math.PI / 2) ** 2);
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
