// Port Almar — sound: synthesized WebAudio effects and a procedural
// music loop. No audio files: every sound is an oscillator or noise
// burst shaped in code, and the music is a bassline plus a sparse
// lead over a swung hat pattern, in A minor.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.step = 0;
    this.nextNote = 0;
    this.bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    this.leadNotes = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.nextNote = this.ctx.currentTime + 0.1;
  }

  setMuted(m) {
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot(kind) {
    if (kind === 'shotgun') { this.noise(0.22, 0.5, 900); this.tone(90, 0.18, 'sawtooth', 0.25, 40); }
    else if (kind === 'smg') { this.noise(0.08, 0.3, 2400); this.tone(220, 0.06, 'square', 0.18, 90); }
    else { this.noise(0.12, 0.35, 1800); this.tone(180, 0.1, 'square', 0.2, 70); }
  }

  punch() { this.noise(0.08, 0.3, 700); this.tone(120, 0.08, 'sine', 0.25, 60); }
  crash() { this.noise(0.3, 0.5, 500); this.tone(70, 0.3, 'sawtooth', 0.2, 30); }
  pickup() { this.tone(660, 0.09, 'sine', 0.25); setTimeout(() => this.tone(990, 0.12, 'sine', 0.25), 70); }
  missionPass() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.28), i * 110));
  }
  missionFail() {
    [392, 311.13, 233.08].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.18), i * 140));
  }
  siren() { this.tone(720, 0.4, 'sine', 0.08, 960); }
  engine(rpm) { this.tone(50 + rpm * 0.9, 0.08, 'sawtooth', 0.05); }
  cash() { this.tone(880, 0.07, 'sine', 0.2); setTimeout(() => this.tone(1318, 0.1, 'sine', 0.2), 60); }
  phone() { this.tone(1200, 0.1, 'sine', 0.15); setTimeout(() => this.tone(1200, 0.1, 'sine', 0.15), 180); }

  // Called every frame while playing: schedules the next 16th notes.
  updateMusic(dt, wanted) {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / 112 / 4; // 112 BPM, 16th notes
    while (this.nextNote < this.ctx.currentTime + 0.12) {
      const s = this.step % 32;
      const bar = Math.floor(this.step / 8) % 4;
      // Bass on beats 0, 3, 6 of each 8-step bar.
      if (s % 8 === 0 || s % 8 === 3 || s % 8 === 6) {
        this.playNoteAt(this.bassNotes[bar * 2 + (s % 8 === 6 ? 1 : 0)] || 55, this.nextNote, spb * 2.4, 'triangle', 0.22);
      }
      // Hat every other 16th.
      if (s % 2 === 0) this.playHatAt(this.nextNote, wanted > 0 ? 0.1 : 0.05);
      // Sparse lead every other bar.
      if (s % 16 === 8 && Math.random() > 0.4) {
        this.playNoteAt(this.leadNotes[(bar * 3 + 1) % this.leadNotes.length], this.nextNote, spb * 3, 'sine', 0.09);
      }
      // Snare-ish noise on 4 and 12.
      if (s % 16 === 4 || s % 16 === 12) this.playNoiseAt(this.nextNote, 0.06, 0.12, 3000);
      this.step++;
      this.nextNote += spb;
    }
  }

  playNoteAt(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  playHatAt(t, vol) {
    const len = Math.floor(this.ctx.sampleRate * 0.03);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  playNoiseAt(t, dur, vol, freq) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
}
