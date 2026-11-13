(() => {
  const button = document.getElementById('christmasOrgan');
  const status = document.getElementById('christmasOrganStatus');
  const song = document.getElementById('christmasSong');
  const songs = {
    'holy-night': { title: 'O Holy Night · 溫馨爵士藍調', jazz: true, melody: [[64,1],[64,.5],[64,.5],[67,2],[67,1],[69,1.5],[69,.5],[65,1],[69,1],[72,1.5],[71,.5],[69,1],[67,3]], harmony: [[0,2.4,[52,57,62,67]],[2.65,2.2,[52,57,62,67]],[5,1.7,[51,57,60,67]],[7.2,1.65,[51,57,60,67]],[9,1.3,[53,57,60,64]],[10.5,1.4,[53,59,64,69]],[12,3,[52,57,62,67]]], bass: [[0,36,1.8],[2,43,1.6],[4,40,.8],[5,41,1.6],[7,48,1.6],[9,38,1.2],[10.5,43,1.3],[12,36,1.8],[14,36,1]] },
    'silent-night': { title: 'Silent Night · 平安夜', melody: [[67,1.5],[69,.5],[67,1],[64,3],[67,1.5],[69,.5],[67,1],[64,3],[74,2],[74,1],[71,3],[72,2],[72,1],[67,3]], harmony: [[0,6,[36,48,52,55]],[6,6,[36,48,52,55]],[12,6,[43,50,55,59]],[18,6,[36,48,52,55]]] }
  };
  const volume = document.getElementById('christmasOrganVolume');
  if (!button) return;
  let active = null;
  let generation = 0;
  let lightSound = null;
  function stopLightSound() {
    if (!lightSound) return;
    const previous = lightSound;
    lightSound = null;
    clearTimeout(previous.timer);
    if (previous.context.state === 'closed') return;
    previous.gain.gain.setTargetAtTime(0, previous.context.currentTime, .035);
    setTimeout(() => previous.context.close().catch(() => {}), 160);
  }
  async function playLightSound() {
    // Use an independent layer: a light accent over music, or a fuller
    // warm-to-bright entrance chord when no Christmas song is playing.
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    stopLightSound();
    const standalone = !active || active.context.state === 'closed';
    const level = standalone ? .12 : .035;
    let context;
    let sound;
    try {
      context = new Audio();
      const gain = context.createGain();
      gain.gain.value = Number(volume.value) * level;
      gain.connect(context.destination);
      sound = {context, gain, level};
      lightSound = sound;
      await context.resume();
      if (lightSound !== sound) return;
      // A rounded game-door impact: low resonance with a little wooden body,
      // without a sharp transient or hardware vibration.
      const impactAt = context.currentTime + .025;
      for (const [from, to, peak] of [[130.81,65.41,1.05],[261.63,130.81,.24]]) {
        const impact = context.createOscillator();
        const pulse = context.createGain();
        impact.frequency.setValueAtTime(from, impactAt);
        impact.frequency.exponentialRampToValueAtTime(to, impactAt + .18);
        pulse.gain.setValueAtTime(0, impactAt);
        pulse.gain.linearRampToValueAtTime(peak, impactAt + .012);
        pulse.gain.exponentialRampToValueAtTime(.0001, impactAt + .43);
        pulse.gain.linearRampToValueAtTime(0, impactAt + .48);
        impact.connect(pulse); pulse.connect(gain);
        impact.start(impactAt); impact.stop(impactAt + .49);
      }
      // The music blooms after the initial impact as the doors start opening.
      const start = context.currentTime + .46;
      // The standalone Cmaj9 pad gently brightens as the doors open.
      const color = context.createBiquadFilter();
      color.type = 'lowpass';
      color.frequency.setValueAtTime(standalone ? 900 : 2200, start);
      color.frequency.linearRampToValueAtTime(standalone ? 2400 : 2600, start + .85);
      color.frequency.linearRampToValueAtTime(1400, start + 1.8);
      color.connect(gain);
      const notes = standalone ? [55,60,64,67,69,74] : [60,67,69,74];
      notes.forEach((note, index) => {
        const at = start + index * (standalone ? .065 : .055);
        const envelope = context.createGain();
        const attack = standalone ? .6 : .16;
        const end = standalone ? 1.75 : 1.12;
        const peak = standalone ? .3 - index * .025 : .5 - index * .06;
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(peak, at + attack);
        envelope.gain.exponentialRampToValueAtTime(.0001, at + end - .07);
        envelope.gain.linearRampToValueAtTime(0, at + end);
        envelope.connect(color);
        for (const [harmonic, strength] of standalone ? [[1,1],[2,.1],[3,.015]] : [[1,1]]) {
          const oscillator = context.createOscillator();
          const rank = context.createGain();
          rank.gain.value = strength;
          oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12) * harmonic;
          oscillator.connect(rank); rank.connect(envelope);
          oscillator.start(at);
          oscillator.stop(at + end + .01);
        }
      });
      sound.timer = setTimeout(() => {
        if (lightSound === sound) lightSound = null;
        context.close().catch(() => {});
      }, standalone ? 2900 : 2100);
    } catch (_) {
      if (lightSound === sound) lightSound = null;
      if (context && context.state !== 'closed') context.close().catch(() => {});
    }
  }
  window.addEventListener('entrance-light-sound', playLightSound);
  window.addEventListener('home-page-change', event => { if (event.detail.page === 'cover') stopLightSound(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopLightSound(); });
  window.addEventListener('pagehide', stopLightSound);


  function reset(message = '') {
    button.textContent = '♫ 試聽聖誕管風琴';
    button.setAttribute('aria-pressed', 'false');
    status.textContent = message;
  }
  function stop() {
    generation++;
    const previous = active;
    active = null;
    reset();
    if (!previous) return;
    clearTimeout(previous.timer);
    // A short fade prevents a click even when stopped during a chord.
    const now = previous.context.currentTime;
    previous.master.gain.cancelScheduledValues(now);
    previous.master.gain.setTargetAtTime(0, now, 0.06);
    setTimeout(() => previous.context.close().catch(() => {}), 250);
  }
  function schedule(context, master) {
    const selection = songs[song.value] || songs['holy-night'];
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.3;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 3800;
    const bus = context.createGain();
    bus.gain.value = 0.14;
    bus.connect(filter); filter.connect(compressor);
    const ending = context.createGain();
    compressor.connect(ending); ending.connect(master); master.connect(context.destination);

    // A locally synthesized stereo cathedral impulse: no external recordings.
    const reverb = context.createConvolver();
    const impulse = context.createBuffer(2, context.sampleRate * 3, context.sampleRate);
    let seed = 1847;
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const t = i / context.sampleRate;
        data[i] = t < .035 ? 0 : (seed / 2147483648 - 1) * Math.exp(-t * 2.4);
      }
    }
    reverb.buffer = impulse;
    const wet = context.createGain(); wet.gain.value = selection.jazz ? .19 : .28;
    filter.connect(reverb); reverb.connect(wet); wet.connect(compressor);

    const start = context.currentTime + .06;
    const beat = 60 / (selection.jazz ? 68 : 66);
    // Gently delay offbeat eighths while preserving the melody's pitches.
    const feel = at => {
      const whole = Math.floor(at), part = at - whole;
      return selection.jazz ? whole + (part <= .5 ? part * 1.2 : .6 + (part - .5) * .8) : at;
    };
    function pipe(midi, at, beats, strength, lead = false) {
      const envelope = context.createGain();
      const time = start + feel(at) * beat;
      const length = (feel(at + beats) - feel(at)) * beat;
      const release = Math.min(.3, length * .25);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(strength, time + (selection.jazz ? .085 : .13));
      envelope.gain.setValueAtTime(strength, time + length - release);
      envelope.gain.linearRampToValueAtTime(0, time + length);
      envelope.connect(bus);
      // Principal 8′ + octave 4′ + 2′ and restrained mixture ranks.
      const ranks = selection.jazz ? (lead ? [[1,.9],[2,.3],[3,.14],[4,.045]] : [[1,.75],[2,.16],[3,.055],[4,.025]]) : lead ? [[1,.9],[2,.26],[3,.055],[4,.065],[6,.012]]
                         : [[1,.75],[2,.16],[3,.035],[4,.035]];
      for (const [harmonic, level] of ranks) {
        const oscillator = context.createOscillator();
        const rank = context.createGain();
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12) * harmonic;
        rank.gain.value = level;
        oscillator.connect(rank); rank.connect(envelope);
        oscillator.start(time); oscillator.stop(time + length + .01);
      }
    }
    const melody = selection.melody;
    let cursor = 0;
    for (const [note, length] of melody) {
      pipe(note, cursor, length * 1.015, .8, true);
      cursor += length;
    }
    // Jazz voicings: C6/9 → F9 → Dm9 → G13 → C6/9.
    // A lightly syncopated accompaniment leaves the hymn melody in front.
    const harmony = selection.harmony;
    for (const [at, length, notes] of harmony) {
      notes.forEach((note, i) => pipe(note, at, length + .12, selection.jazz ? .23 : (i ? .3 : .36)));
    }
    for (const [at, note, length] of selection.bass || []) pipe(note, at, length, .4);
    if (selection.jazz) {
      // A quiet blue-note approach in the inner voice (B♭ → A), not the hymn tune.
      pipe(58, 4.3, .25, .12); pipe(57, 4.55, .35, .14);
    }
    // Let the final tonic and the room decay together, without an extra note.
    const end = start + cursor * beat;
    ending.gain.setValueAtTime(1, end);
    const tail = selection.jazz ? 1.6 : 2.8;
    ending.gain.linearRampToValueAtTime(0, end + tail);
    return (end + tail + .2 - context.currentTime) * 1000;
  }
  async function play() {
    if (active) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { reset('此瀏覽器無法播放，請使用 Chrome 或三星瀏覽器。'); return; }
    window.dispatchEvent(new Event('christmas-organ-start'));
    const token = ++generation;
    let context;
    try {
      context = new Audio();
      const master = context.createGain();
      master.gain.value = Number(volume.value);
      active = {context, master};
      button.textContent = '■ 停止播放';
      button.setAttribute('aria-pressed', 'true');
      await context.resume();
      if (token !== generation) return;
      const duration = schedule(context, master);
      status.textContent = `正在播放《${songs[song.value].title}》· ${songs[song.value].jazz ? '柔和搖擺 · 爵士管風琴' : '溫柔教堂管風琴'}`;
      active.timer = setTimeout(() => {
        if (token !== generation) return;
        active = null;
        context.close().catch(() => {});
        reset('播放完畢，願你在主內平安。');
      }, duration);
    } catch (error) {
      if (token !== generation) return;
      stop();
      if (context && context.state !== 'closed') context.close().catch(() => {});
      reset('暫時無法播放，請再點一次播放。');
    }
  }
  button.addEventListener('click', () => { if (active) stop(); else play(); });
  window.addEventListener('welcome-music-play', play);
  song.addEventListener('change', stop);
  volume.addEventListener('input', () => {
    if (lightSound) lightSound.gain.gain.setTargetAtTime(Number(volume.value) * lightSound.level, lightSound.context.currentTime, .04);
    if (!active) return;
    active.master.gain.cancelScheduledValues(active.context.currentTime);
    active.master.gain.setTargetAtTime(Number(volume.value), active.context.currentTime, .04);
  });
  window.addEventListener('home-page-change', event => { if (event.detail.page === 'cover') stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
