(() => {
  const button = document.getElementById('christmasOrgan');
  const status = document.getElementById('christmasOrganStatus');
  const volume = document.getElementById('christmasOrganVolume');
  if (!button) return;
  let active = null;
  let generation = 0;

  function reset(message = '') {
    button.textContent = '♫ 播放聖誕管風琴';
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
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.3;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 6500;
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
    const wet = context.createGain(); wet.gain.value = .28;
    filter.connect(reverb); reverb.connect(wet); wet.connect(compressor);

    const start = context.currentTime + .06;
    const beat = 60 / 72;
    function pipe(midi, at, beats, strength, lead = false) {
      const envelope = context.createGain();
      const time = start + at * beat;
      const length = beats * beat;
      const release = Math.min(.3, length * .25);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(strength, time + .07);
      envelope.gain.setValueAtTime(strength, time + length - release);
      envelope.gain.linearRampToValueAtTime(0, time + length);
      envelope.connect(bus);
      // Principal 8′ + octave 4′ + 2′ and restrained mixture ranks.
      const ranks = lead ? [[1,.7],[2,.46],[3,.1],[4,.25],[6,.07],[8,.04]]
                         : [[1,.65],[2,.25],[3,.07],[4,.12],[6,.025]];
      for (const [harmonic, level] of ranks) {
        const oscillator = context.createOscillator();
        const rank = context.createGain();
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12) * harmonic;
        rank.gain.value = level;
        oscillator.connect(rank); rank.connect(envelope);
        oscillator.start(time); oscillator.stop(time + length + .01);
      }
    }
    // Adolphe Adam, 1847: opening of O Holy Night, in C major (6/8).
    const melody = [[64,1.5],[64,.5],[64,1],[67,2],[67,1],
      [69,1.5],[69,.5],[65,1],[69,1],[72,1],[71,1],
      [69,1.5],[67,.5],[64,1],[67,1.5],[65,.5],[62,1],[60,3]];
    let cursor = 0;
    for (const [note, length] of melody) {
      pipe(note, cursor, length * .98, .7, true);
      cursor += length;
    }
    // Sustained four-part harmony and a separate, gentle 16′ pedal bass.
    const harmony = [
      [0,6,[36,48,55,60]], [6,3,[41,48,53,57]],
      [9,3,[36,48,52,55]], [12,3,[36,48,52,55]],
      [15,3,[43,50,53,59]], [18,3,[36,48,52,55]]
    ];
    for (const [at, length, notes] of harmony) {
      notes.forEach((note, i) => pipe(note, at, length + .12, i ? .3 : .36));
    }
    // Let the final tonic and the room decay together, without an extra note.
    const end = start + cursor * beat;
    ending.gain.setValueAtTime(1, end);
    ending.gain.linearRampToValueAtTime(0, end + 2.8);
    return (end + 3 - context.currentTime) * 1000;
  }
  button.addEventListener('click', async () => {
    if (active) { stop(); return; }
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
      status.textContent = '正在播放《O Holy Night》· 古典教堂管風琴';
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
  });
  volume.addEventListener('input', () => {
    if (!active) return;
    active.master.gain.cancelScheduledValues(active.context.currentTime);
    active.master.gain.setTargetAtTime(Number(volume.value), active.context.currentTime, .04);
  });
  document.getElementById('showCover').addEventListener('click', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
