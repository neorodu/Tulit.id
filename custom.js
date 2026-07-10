
(function(){
  "use strict";

  /* ============ AUDIO ENGINE ============ */
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  let masterGain, analyser, bassF, lowMidF, midF, highMidF, trebleF, mixBus;
  let audioReady = false;

  const bands = [
    { key:'bass',    label:'Bass',     freq:100,  type:'lowshelf', color:'--band-bass'    },
    { key:'lowmid',  label:'Low Mid',  freq:400,  type:'peaking',  color:'--band-lowmid', Q:1 },
    { key:'mid',     label:'Mid',      freq:1000, type:'peaking',  color:'--band-mid',    Q:1 },
    { key:'highmid', label:'High Mid', freq:2500, type:'peaking',  color:'--band-highmid',Q:1 },
    { key:'treble',  label:'Treble',   freq:6500, type:'highshelf',color:'--band-treble'  },
  ];
  const bandValues = { bass:0, lowmid:0, mid:0, highmid:0, treble:0 }; // stored dB, -15..15
  let eqEnabled = false;
  let volume = 0.75;

  // Media element for regular MP3 tracks
  const audioEl = new Audio();
  audioEl.crossOrigin = "anonymous";
  let audioSourceNode = null;
  let usingMedia = false; // whether current track is the audio element

  function initAudio(){
    if(audioReady) return;
    actx = new AudioCtx();

    mixBus = actx.createGain();
    mixBus.gain.value = 1;

    bassF = actx.createBiquadFilter();
    bassF.type = 'lowshelf'; bassF.frequency.value = 100; bassF.gain.value = 0;

    lowMidF = actx.createBiquadFilter();
    lowMidF.type = 'peaking'; lowMidF.frequency.value = 400; lowMidF.Q.value = 1; lowMidF.gain.value = 0;

    midF = actx.createBiquadFilter();
    midF.type = 'peaking'; midF.frequency.value = 1000; midF.Q.value = 1; midF.gain.value = 0;

    highMidF = actx.createBiquadFilter();
    highMidF.type = 'peaking'; highMidF.frequency.value = 2500; highMidF.Q.value = 1; highMidF.gain.value = 0;

    trebleF = actx.createBiquadFilter();
    trebleF.type = 'highshelf'; trebleF.frequency.value = 6500; trebleF.gain.value = 0;

    masterGain = actx.createGain();
    masterGain.gain.value = volume;

    analyser = actx.createAnalyser();
    analyser.fftSize = 128;

    // chain: mixBus -> filters -> masterGain -> analyser -> destination
    mixBus.connect(bassF).connect(lowMidF).connect(midF).connect(highMidF).connect(trebleF)
      .connect(masterGain).connect(analyser).connect(actx.destination);

    audioReady = true;
    startViz();
  }

  const filterMap = { bass:()=>bassF, lowmid:()=>lowMidF, mid:()=>midF, highmid:()=>highMidF, treble:()=>trebleF };

  function applyBandGain(key, dB){
    bandValues[key] = dB;
    if(!audioReady) return;
    const f = filterMap[key]();
    const target = eqEnabled ? dB : 0;
    f.gain.setTargetAtTime(target, actx.currentTime, 0.05);
  }

  function applyAllBands(){
    Object.keys(bandValues).forEach(k => applyBandGain(k, bandValues[k]));
  }

  /* ============ TRACK /  DATA ============ */
  const tracks = [
    {
      title: "gemagus",
      artist: "FLUTEMUSIC",
      genre: "gemagus",
      src: "https://archive.org/download/a-1gemagus-x-adtuying-imam/A1gemagus%20x%20ad%2Ctuying%20%28imam%29.mp3",
    },
    {
      title: " gemagas",
      artist: "FLUTEMUSIC",
      genre: "meneng",
      cover: "https://picsum.photos/id/1074/300/300",
      src: "https://archive.org/download/a-1gemagus-x-adtuying-imam/Gemagus%28imam%29.mp3"
    },
    {
      title: "gemagas Heart",
      artist: "FLUTEMUSIC",
      genre: "maen",
      cover: "https://picsum.photos/id/110/300/300",
      src: "https://archive.org/download/a-1gemagus-x-adtuying-imam/a%2C%28imam%29sergmen.mp3"
    },
    {
      title: "gemagus",
      artist: "udan",
      genre: "Ambient",
      cover: "https://picsum.photos/id/145/300/300",
      src: "https://archive.org/download/udan-di-desa/hujan%20gerimis%20suara%20katak%20dan%20jangkrik%20suasana%20desa%20dijamin%20langsung%20tidur%20-%20Dunia%20Relaksasi.mp3"
    },
    {
      title: "main lah",
      artist: "udan rain",
      genre: "hujan",
      cover: "https://picsum.photos/id/160/300/300",
      src: "https://archive.org/download/raingueudan/rain%28gueudan%29.mp3"
    },
    {
      title: "music5",
      artist: "FLUTEMUSIC",
      genre: "Instrumental",
      cover: "https://picsum.photos/id/177/300/300",
      src: "https://archive.org/download/a-2-pendekar-3-x-adtuying-mashup/A2%20-%20pendekar3%20x%20ad%2Ctuying%20%28Mashup%29.mp3"
    },
    {
      title: "main lah",
      artist: "udan rain",
      genre: "huja",
      cover: "https://picsum.photos/id/160/300/300",
      src: "https://archive.org/download/a-1gemagus-x-adtuying-imam/A1gemagus%20x%20ad%2Ctuying%20%28imam%29.mp3"
    },
    {
      title: "music6",
      artist: "FLUTEMUSIC",
      genre: "Instrumental",
      cover: "https://picsum.photos/id/177/300/300",
      src: "https://archive.org/download/iringan-2/Iringan2.mp3"
    },
    {
      title: "flute",
      artist: "gemagus",
      genre: "gabut",
      cover: "https://picsum.photos/id/160/300/300",
      src: "https://archive.org/download/a-1gemagus-x-adtuying-imam/Gemagus%28imam%29.mp3"
    },
  ];

  let currentTrack = 0;
  let isPlaying = false;
  let noiseBuffer = null;

  function getNoiseBuffer(){
    if(noiseBuffer) return noiseBuffer;
    const len = actx.sampleRate * 0.2;
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2);
    noiseBuffer = buf;
    return buf;
  }

  function playHat(time, vol){
    const src = actx.createBufferSource();
    src.buffer = getNoiseBuffer();
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    const hp = actx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6000;
    src.connect(hp).connect(g).connect(mixBus);
    src.start(time); src.stop(time+0.06);
  }

  function playBassNote(freq, time, dur){
    if(!freq) return;
    const o = actx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, time);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.35, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    const lp = actx.createBiquadFilter();
    lp.type='lowpass'; lp.frequency.value = 900;
    o.connect(lp).connect(g).connect(mixBus);
    o.start(time); o.stop(time+dur+0.02);
  }

  function playArpNote(freq, time, dur){
    if(!freq) return;
    const o = actx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, time);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.14, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur*0.9);
    o.connect(g).connect(mixBus);
    o.start(time); o.stop(time+dur);
  }

  function playPad(chord, time, dur){
    if(!chord || !chord.length) return;
    chord.forEach((freq,i)=>{
      const o = actx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq/2, time);
      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.08, time + dur*0.3);
      g.gain.linearRampToValueAtTime(0.0001, time + dur);
      o.connect(g).connect(mixBus);
      o.start(time); o.stop(time+dur+0.05);
    });
  }

  let schedulerTimer = null;
  let step16 = 0;
  let nextStepTime = 0;

  function scheduler(){
    const t = tracks[currentTrack];
    // Guard: if track has no bpm, stop scheduler (this prevents NaN)
    if(!t || !t.bpm){
      fullStopScheduler();
      return;
    }
    const stepDur = 60 / t.bpm / 4; // 16th note
    while(nextStepTime < actx.currentTime + 0.15){
      const bassFreq = t.bassPattern ? t.bassPattern[step16 % t.bassPattern.length] : 0;
      const arpFreq = t.arpPattern ? t.arpPattern[step16 % t.arpPattern.length] : 0;
      playBassNote(bassFreq, nextStepTime, stepDur*1.8);
      playArpNote(arpFreq, nextStepTime, stepDur*0.9);
      if(t.hatEvery && (step16 % t.hatEvery) === 0) playHat(nextStepTime, 0.18);
      if(step16 % 16 === 0) playPad(t.padChord || [], nextStepTime, stepDur*16);
      step16++;
      nextStepTime += stepDur;
    }
    schedulerTimer = setTimeout(scheduler, 40);
  }

  function startPlayback(){
    initAudio();
    if(actx.state === 'suspended') actx.resume();
    applyAllBands();

    const t = tracks[currentTrack];
    if(t && t.src){
      // play via HTMLAudioElement connected to WebAudio (media element)
      usingMedia = true;
      if(!audioSourceNode){
        try{
          audioSourceNode = actx.createMediaElementSource(audioEl);
          audioSourceNode.connect(mixBus);
        }catch(e){
          // createMediaElementSource throws if audioEl already connected to another context
          console.warn('media element source creation failed', e);
        }
      }
      audioEl.play().catch(err => {
        console.warn('audioEl.play() failed:', err);
      });
    }else{
      // use synth scheduler
      usingMedia = false;
      if(!schedulerTimer){
        step16 = 0;
        nextStepTime = actx.currentTime + 0.05;
        scheduler();
      }
    }

    isPlaying = true;
    updatePlayUI();
  }

  function stopPlayback(pauseOnly){
    if(usingMedia){
      audioEl.pause();
    }else{
      if(pauseOnly && actx) actx.suspend();
      else fullStopScheduler();
    }
    isPlaying = false;
    updatePlayUI();
  }

  function fullStopScheduler(){
    if(schedulerTimer){ clearTimeout(schedulerTimer); schedulerTimer = null; }
  }

  /* ============ UI: PLAYLIST ============ */
  const playlistEl = document.getElementById('playlist');
  const sceneDotsEl = document.getElementById('sceneDots');

  function buildPlaylist(){
    playlistEl.innerHTML = '';
    sceneDotsEl.innerHTML = '';
    tracks.forEach((t, i)=>{
      const item = document.createElement('div');
      item.className = 'p-item' + (i===currentTrack ? ' active':'');
      item.innerHTML = `<div class="p-left"><span class="p-idx">${String(i+1).padStart(2,'0')}</span><span class="p-name">${t.title}</span></div><span class="p-genre">${t.genre}</span>`;
      item.addEventListener('click', ()=> selectTrack(i));
      playlistEl.appendChild(item);

      const dot = document.createElement('div');
      dot.className = 'scene-dot' + (i===currentTrack ? ' active':'');
      dot.addEventListener('click', ()=> selectTrack(i));
      sceneDotsEl.appendChild(dot);
    });
  }

  function selectTrack(i){
    currentTrack = i;
    step16 = 0;
    document.querySelectorAll('.p-item').forEach((el,idx)=> el.classList.toggle('active', idx===i));
    document.querySelectorAll('.scene-dot').forEach((el,idx)=> el.classList.toggle('active', idx===i));
    document.querySelectorAll('.slide').forEach((el,idx)=> el.classList.toggle('active', idx===i));
    document.getElementById('sceneBadge').textContent = 'TRK.0'+(i+1);
    document.getElementById('trackTitle').textContent = tracks[i].title;
    document.getElementById('trackArtist').textContent = tracks[i].artist;

    const t = tracks[i];
    // if there is a media src, load it into audioEl
    if(t && t.src){
      audioEl.src = t.src;
      audioEl.load();
      // update UI durations when metadata available
      audioEl.onloadedmetadata = ()=>{
        if(isFinite(audioEl.duration) && audioEl.duration > 0){
          document.getElementById('tTotal').textContent = fmt(Math.floor(audioEl.duration));
        }
      };
      // ensure progress updates follow audio element
      audioEl.ontimeupdate = ()=>{
        if(!usingMedia) return;
        const cur = audioEl.currentTime || 0;
        const dur = audioEl.duration || 0;
        document.getElementById('tCur').textContent = fmt(Math.floor(cur));
        const percent = dur ? (cur/dur*100) : 0;
        document.getElementById('barFill').style.width = percent + '%';
      };
      audioEl.onended = ()=>{
        // move to next track
        selectTrack((currentTrack + 1) % tracks.length);
        if(isPlaying) startPlayback();
      };
    }else{
      // if no src, reset progress to conceptual default
      document.getElementById('tTotal').textContent = fmt(120);
      document.getElementById('tCur').textContent = fmt(0);
      document.getElementById('barFill').style.width = '0%';
    }

    // If currently playing, start playback of new track
    if(isPlaying){
      // ensure audio context resumed
      if(actx && actx.state === 'suspended') actx.resume();
      startPlayback();
    }
  }

  document.getElementById('prevBtn').addEventListener('click', ()=>{
    selectTrack((currentTrack - 1 + tracks.length) % tracks.length);
    if(!isPlaying) startPlayback(); else { if(usingMedia) audioEl.play(); else if(actx) actx.resume(); }
  });
  document.getElementById('nextBtn').addEventListener('click', ()=>{
    selectTrack((currentTrack + 1) % tracks.length);
    if(!isPlaying) startPlayback(); else { if(usingMedia) audioEl.play(); else if(actx) actx.resume(); }
  });

  /* ============ UI: TRANSPORT ============ */
  const playBtn = document.getElementById('playBtn');
  const playIcon = document.getElementById('playIcon');
  const statusText = document.getElementById('statusText');

  function updatePlayUI(){
    playIcon.innerHTML = isPlaying
      ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    statusText.textContent = isPlaying ? 'PLAYING' : 'PAUSED';
  }

  playBtn.addEventListener('click', ()=>{
    if(!audioReady) { startPlayback(); return; }
    if(isPlaying){ stopPlayback(true); }
    else { startPlayback(); }
  });

  /* progress (now follows actual audioEl when present) */
  let elapsed = 0;
  let progressTimer = null;
  const DURATION = 120;
  function fmt(s){ const m=Math.floor(s/60); const sec=Math.floor(s%60); return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); }

  function startProgress(){
    if(progressTimer) return;
    progressTimer = setInterval(()=>{
      if(!isPlaying) return;
      if(usingMedia){
        // handled by audioEl.ontimeupdate
        return;
      }else{
        elapsed = (elapsed + 1) % DURATION;
        document.getElementById('tCur').textContent = fmt(elapsed);
        document.getElementById('barFill').style.width = (elapsed/DURATION*100)+'%';
      }
    }, 1000);
  }

  document.getElementById('tTotal').textContent = fmt(DURATION);

  /* ============ UI: VISUALIZER ============ */
  const canvas = document.getElementById('viz');
  const ctx2d = canvas.getContext('2d');
  function resizeCanvas(){
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
  }
  window.addEventListener('resize', resizeCanvas);

  function startViz(){
    resizeCanvas();
    const data = new Uint8Array(analyser.frequencyBinCount);
    function draw(){
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx2d.clearRect(0,0,canvas.width,canvas.height);
      const barCount = data.length;
      const barW = canvas.width / barCount;
      for(let i=0;i<barCount;i++){
        const v = data[i]/255;
        const h = v * canvas.height;
        const hue = 200 - (i/barCount)*180;
        ctx2d.fillStyle = `hsl(${hue+120*(i/barCount)}, 90%, ${55+v*15}%)`;
        ctx2d.shadowColor = ctx2d.fillStyle;
        ctx2d.shadowBlur = 6;
        ctx2d.fillRect(i*barW, canvas.height - h, barW*0.7, h);
      }
    }
    draw();
  }

  /* ============ ============ */
  const MIN_DB = -15, MAX_DB = 15;
  const knobsGrid = document.getElementById('knobsGrid');

  function dbToAngle(dB){ return ((dB - MIN_DB) / (MAX_DB - MIN_DB)) * 270 - 135; }

  function buildKnobs(){
    bands.forEach(b=>{
      const cell = document.createElement('div');
      cell.className = 'knob-cell';
      cell.id = 'cell-'+b.key;
      cell.innerHTML = `
        <div class="knob" id="knob-${b.key}" style="--kc:var(${b.color});">
          <div class="knob-indicator" id="ind-${b.key}" style="--kc:var(${b.color});"></div>
        </div>
        <div class="knob-label">${b.label}</div>
        <div class="knob-val" id="val-${b.key}">0.0 dB</div>
      `;
      knobsGrid.appendChild(cell);
      attachKnobDrag(document.getElementById('knob-'+b.key), (dB)=>{
        applyBandGain(b.key, dB);
        updateKnobVisual(b.key, dB);
      }, MIN_DB, MAX_DB, 0, (val)=>val.toFixed(1)+' dB');
    });
  }

  function updateKnobVisual(key, dB){
    const ind = document.getElementById('ind-'+key);
    const val = document.getElementById('val-'+key);
    ind.style.transform = `translateX(-50%) rotate(${dbToAngle(dB)}deg)`;
    val.textContent = dB.toFixed(1)+' dB';
    const knob = document.getElementById('knob-'+key);
    if(Math.abs(dB) > 0.5 && eqEnabled) knob.classList.add('glow'); else knob.classList.remove('glow');
  }

  function attachKnobDrag(el, onChange, min, max, startVal, fmtFn){
    let value = startVal;
    let dragging = false;
    let startY = 0;
    let startVal2 = 0;

    function setFromDrag(clientY){
      const delta = startY - clientY;
      const range = max - min;
      let v = startVal2 + (delta / 140) * range;
      v = Math.max(min, Math.min(max, v));
      value = v;
      onChange(value);
    }

    el.addEventListener('pointerdown', (e)=>{
      if(el.closest('.knob-cell').classList.contains('dis')) return;
      dragging = true;
      startY = e.clientY;
      startVal2 = value;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e)=>{
      if(!dragging) return;
      setFromDrag(e.clientY);
    });
    el.addEventListener('pointerup', ()=> dragging = false);
    el.addEventListener('pointercancel', ()=> dragging = false);
    el.addEventListener('dblclick', ()=>{
      value = startVal;
      onChange(value);
    });
    el.addEventListener('wheel', (e)=>{
      if(el.closest('.knob-cell').classList.contains('dis')) return;
      e.preventDefault();
      const range = max - min;
      value = Math.max(min, Math.min(max, value - Math.sign(e.deltaY) * (range*0.02)));
      onChange(value);
    }, {passive:false});
  }

  /* volume knob */
  function buildVolumeKnob(){
    const knob = document.getElementById('volKnob');
    attachKnobDrag(knob, (v)=>{
      volume = v;
      if(audioReady) masterGain.gain.setTargetAtTime(volume, actx.currentTime, 0.05);
      document.getElementById('volVal').textContent = Math.round(volume*100)+'%';
      const ind = document.getElementById('volIndicator');
      const angle = (volume) * 270 - 135;
      ind.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    }, 0, 1, volume);
    // init visual
    document.getElementById('volVal').textContent = Math.round(volume*100)+'%';
    document.getElementById('volIndicator').style.transform = `translateX(-50%) rotate(${volume*270-135}deg)`;
  }

  /* ============ EQ TOGGLE ============ */
  const eqSwitch = document.getElementById('eqSwitch');
  const eqToggleWrap = document.getElementById('eqToggleWrap');
  const eqToggleLabel = document.getElementById('eqToggleLabel');

  function setEqEnabled(state){
    eqEnabled = state;
    eqSwitch.classList.toggle('on', state);
    eqToggleLabel.textContent = state ? 'EQ ON' : 'EQ OFF';
    bands.forEach(b=>{
      document.getElementById('cell-'+b.key).classList.toggle('dis', !state);
    });
    applyAllBands();
    bands.forEach(b=> updateKnobVisual(b.key, bandValues[b.key]));
  }

  eqToggleWrap.addEventListener('click', ()=>{
    initAudio();
    setEqEnabled(!eqEnabled);
  });

  /* ============ INIT ============ */
  buildKnobs();
  buildVolumeKnob();
  buildPlaylist();
  setEqEnabled(false);
  // ensure first track metadata loaded if it has src
  if(tracks[0] && tracks[0].src){
    audioEl.src = tracks[0].src;
    audioEl.load();
    audioEl.onloadedmetadata = ()=> {
      if(isFinite(audioEl.duration) && audioEl.duration > 0){
        document.getElementById('tTotal').textContent = fmt(Math.floor(audioEl.duration));
      }
    };
  }
})();
