// ค่าทั้งหมด (ชื่อ วัน เวลา คำถาม) อยู่ใน config.js

const Q = CONFIG.questions;
const answers = [];
let idx = 0;

const $ = s => document.querySelector(s);
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

document.querySelectorAll('[data-bind]').forEach(e => { e.textContent = CONFIG[e.dataset.bind] ?? ''; });

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo({ top: 0 });
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- ลูกเล่นหัวใจ ---------- */
(function bgHearts() {
  const bg = $('#bg');
  for (let i = 0; i < 12; i++) {
    const s = h('span', 'bg-heart', '♥');
    s.style.left = Math.random() * 100 + '%';
    s.style.fontSize = 12 + Math.random() * 22 + 'px';
    s.style.animationDuration = 12 + Math.random() * 14 + 's';
    s.style.animationDelay = -Math.random() * 20 + 's';
    bg.append(s);
  }
})();

document.addEventListener('pointerdown', e => {
  const s = h('span', 'tap-heart', '♥');
  s.style.left = e.clientX + 'px';
  s.style.top = e.clientY + 'px';
  document.body.append(s);
  s.addEventListener('animationend', () => s.remove());
});

function burst(x, y, n = 18) {
  const icons = ['💗', '💖', '💕', '✨', '🌸'];
  for (let i = 0; i < n; i++) {
    const s = h('span', 'spark', icons[i % icons.length]);
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 110;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist - 40 + 'px');
    s.style.setProperty('--r', Math.random() * 90 - 45 + 'deg');
    document.body.append(s);
    s.addEventListener('animationend', () => s.remove());
  }
}

/* ---------- เวลา ----------
   เฟส: ก่อน pickupTime = ขับรถ → ถึง letterTime = ระหว่างเดท → หลังจากนั้น = จดหมาย + คำถาม
   ทดลองดูเวลาไหนก็ได้: ต่อท้ายลิงก์ด้วย ?at=13:59:50 หรือ ?at=18:59:50 */
const pad2 = n => String(n).padStart(2, '0');

// 'HH:MM' (หรือ 'HH.MM') ของวันเดท → timestamp เวลาไทย
function at(hm) {
  if (!CONFIG.date || !hm) return 0;
  const [hh, mm = 0, ss = 0] = String(hm).split(/[:.]/).map(Number);
  const t = Date.parse(`${CONFIG.date}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}+07:00`);
  return isNaN(t) ? 0 : t;
}

const TEST_AT = new URLSearchParams(location.search).get('at');
const clockOffset = TEST_AT && at(TEST_AT) ? at(TEST_AT) - Date.now() : 0;
const now = () => Date.now() + clockOffset;

const PICKUP = at(CONFIG.pickupTime);
const LETTER = at(CONFIG.letterTime);

const thaiTime = t => new Date(t).toLocaleTimeString('th-TH', {
  timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit',
}) + ' น.';

function timeLeft(ms) {
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const hms = `${pad2(Math.floor(s % 86400 / 3600))}:${pad2(Math.floor(s % 3600 / 60))}:${pad2(s % 60)}`;
  return d ? `${d} วัน ${hms}` : hms;
}

function phaseNow() {
  const t = now();
  if (t < PICKUP) return 'drive';
  if (t < LETTER) return 'date';
  return 'letter';
}

/* ---------- 0) ก่อนเวลารับ → กำลังขับรถไปหา ---------- */
let arrived = false;

function honk() {
  const car = $('#car');
  car.classList.remove('honking');
  void car.offsetWidth;
  car.classList.add('honking');
}
$('#car').addEventListener('click', honk);

/* ---------- เพลงในรถ (มีไฟล์ถึงจะโชว์ปุ่ม) ---------- */
const audio = new Audio();
const playlist = [];
let track = 0;
let noteTimer;

// ไล่หา music/song_1.mp3, song_2.mp3, ... (ใช้ fetch เพราะ iPhone ไม่โหลดไฟล์เสียงล่วงหน้า)
(async function findSongs() {
  for (let n = 1; n <= 30; n++) {
    const src = `music/song_${n}.mp3`;
    try {
      const r = await fetch(src, { method: 'HEAD' });
      if (!r.ok) break;
      playlist.push(src);
    } catch { break; }
  }
  if (!playlist.length) return;
  audio.src = playlist[0];
  $('#radio-prev').hidden = $('#radio-next').hidden = playlist.length < 2;
  $('#radio').hidden = false;
  updateRadio();
})();

function playTrack(i) {
  track = (i + playlist.length) % playlist.length;
  audio.src = playlist[track];
  audio.play().catch(() => {});
  updateRadio();
}
audio.addEventListener('ended', () => playTrack(track + 1)); // จบแล้วต่อเพลงถัดไป วนกลับเพลงแรก
$('#radio-next').addEventListener('click', () => playTrack(track + 1));
// ⏮ : ถ้าเล่นไปเกิน 3 วิ = กลับไปต้นเพลง ไม่งั้นไปเพลงก่อนหน้า
$('#radio-prev').addEventListener('click', () => {
  if (audio.currentTime > 3) { audio.currentTime = 0; audio.play().catch(() => {}); }
  else playTrack(track - 1);
});

const songTitle = () => (CONFIG.musicTitles || [])[track]
  || (playlist.length > 1 ? `เพลงที่ ${track + 1}/${playlist.length} 🎶` : 'กำลังเล่นเพลง 🎶');

function spawnNote() {
  const scene = $('#scene');
  const car = $('#car');
  const n = h('span', 'music-note', Math.random() < .5 ? '♪' : '♫');
  n.style.left = car.offsetLeft + 30 + Math.random() * (car.offsetWidth - 60) + 'px';
  n.style.top = car.offsetTop + 10 + 'px';
  n.style.setProperty('--nx', Math.random() * 40 - 20 + 'px');
  n.style.setProperty('--nr', Math.random() * 40 - 20 + 'deg');
  scene.append(n);
  n.addEventListener('animationend', () => n.remove());
}

function updateRadio() {
  const on = !audio.paused;
  $('#radio').classList.toggle('on', on);
  $('#radio-play').setAttribute('aria-label', on ? 'หยุดเพลง' : 'เล่นเพลง');
  $('#radio-label').textContent = on ? songTitle() : (CONFIG.musicLabel || 'กดฟังเพลง');
  clearInterval(noteTimer);
  if (on) noteTimer = setInterval(spawnNote, 700);
}
audio.addEventListener('play', updateRadio);
audio.addEventListener('pause', updateRadio);

$('#radio-play').addEventListener('click', async () => {
  if (!audio.paused) return audio.pause();
  try { await audio.play(); } catch { toast('เปิดเพลงไม่ได้ 🥲'); }
});

// ค่อย ๆ เบาเสียงแล้วหยุด (iPhone ปรับ volume ไม่ได้ ก็จะหยุดหลังครบเวลาเอง)
function fadeOutMusic() {
  if (audio.paused) return;
  let step = 0;
  const t = setInterval(() => {
    step++;
    try { audio.volume = Math.max(0, 1 - step / 20); } catch {}
    if (step >= 20) {
      clearInterval(t);
      audio.pause();
      try { audio.volume = 1; } catch {}
    }
  }, 100);
}

function arrive() {
  arrived = true;
  fadeOutMusic();
  $('#scene').classList.add('arrived');
  $('#drive-title').textContent = `ถึงหน้าบ้าน${CONFIG.to}แล้ว! 🎉`;
  $('#eta-label').textContent = 'ลงมาได้เลยน้า~';
  $('#eta').textContent = '00:00:00';
  honk();
  const r = $('#car').getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, 24);
  setTimeout(() => $('#s-drive').classList.add('leave'), 2600);
  setTimeout(() => enter(phaseNow()), 3000);
}

/* ---------- 1) ระหว่างเดท: ไทม์ไลน์เซอร์ไพรส์ ---------- */
const STOPS = [
  ...(CONFIG.timeline || []).map(s => ({ ...s, t: at(s.time) })),
  { time: CONFIG.letterTime, icon: '💌', title: 'จดหมายปิดท้าย', note: 'เปิดอ่าน + ตอบคำถามกัน', t: LETTER, known: true },
].filter(s => s.t).sort((a, b) => a.t - b.t);

let tlSig = '';
function renderTimeline() {
  const t = now();
  let cur = -1;
  STOPS.forEach((s, i) => { if (s.t <= t) cur = i; });
  const states = STOPS.map((_, i) => (i < cur ? 'past' : i === cur ? 'now' : 'future'));
  const sig = states.join();
  if (sig === tlSig) return;
  const prev = tlSig ? tlSig.split(',') : null;
  tlSig = sig;

  const ol = $('#timeline');
  ol.replaceChildren(...STOPS.map((s, i) => {
    const st = states[i];
    const open = st !== 'future' || s.known;
    const li = h('li', st + (s.known ? ' known' : ''));
    if (prev && prev[i] === 'future' && st !== 'future') li.classList.add('reveal');
    const what = h('div', 'what', open ? `${s.icon || ''} ${s.title}`.trim() : '??? 🔒');
    if (st === 'now') what.append(h('span', 'here', 'ตอนนี้'));
    const body = h('div');
    body.append(what);
    const note = open ? s.note : `เปิดเผยตอน ${thaiTime(s.t)}`;
    if (note) body.append(h('div', 'note', note));
    li.append(h('span', 'pin'), h('span', 'time', thaiTime(s.t).replace(' น.', '')), body);
    return li;
  }));

  const rv = ol.querySelector('.reveal:not(.known)');
  if (rv) {
    const r = rv.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + 14, 16);
    toast('เปิดจุดต่อไปแล้ว! ✨');
  }
}

/* ---------- ข้อมูลที่เซฟ (ผูกกับ PIN) ----------
   state = { wallet: คูปองที่สุ่มได้, answers: คำตอบ, submitted: ส่งแล้วหรือยัง }
   เซฟในเครื่อง + ส่งไปเก็บที่ Google Apps Script (ถ้าใส่ saveUrl ใน config)
   PIN admin / ?at= = โหมดทดสอบ ไม่เซฟอะไรเลย */
let PIN = '';
let testMode = !!TEST_AT;
let state = { wallet: [], answers: [], submitted: false, sent: false };
const stateKey = () => `date-${CONFIG.date}-${PIN}`;

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(stateKey())); } catch { return null; }
}

// ส่งไปหา Apps Script (body เป็น text ธรรมดา จะได้ไม่ติด CORS)
async function api(body) {
  if (!CONFIG.saveUrl || testMode) return null;
  // Google บางครั้งตอบหน้า HTML แทน JSON ในครั้งแรก (ตอนสคริปต์เพิ่งตื่น) → ลองใหม่สูงสุด 3 ครั้ง
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(CONFIG.saveUrl, { method: 'POST', body: JSON.stringify({ ...body, pin: PIN }) });
      return JSON.parse(await r.text());
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(res => setTimeout(res, 800 * (i + 1)));
    }
  }
}

let syncTimer;
function saveState() {
  if (testMode) return;
  try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch {}
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => api({ action: 'save', state }).catch(() => {}), 800);
}

// รวมของในเครื่องกับของบนเซิร์ฟเวอร์ (คูปองไม่หาย ใช้แล้วก็ยังนับว่าใช้แล้ว)
function mergeState(a, b) {
  if (!b) return a;
  if (!a) return b;
  const byText = new Map();
  [...(b.wallet || []), ...(a.wallet || [])].forEach(c => {
    const x = byText.get(c.text);
    byText.set(c.text, { text: c.text, used: !!(c.used || (x && x.used)) });
  });
  const done = a.submitted ? a : b.submitted ? b : a;
  return {
    wallet: [...byText.values()],
    answers: done.answers || [],
    submitted: !!(a.submitted || b.submitted),
    sent: !!(a.sent || b.sent),
  };
}

// โหลดของในเครื่องทันที (ไม่ต้องรอ Google ที่บางทีช้าหลายวินาที)
function loadState() {
  if (testMode) return;
  state = { ...state, ...(loadLocal() || {}) };
  answers.splice(0, answers.length, ...(state.answers || []));
}

// แล้วค่อยไปดึงของบนเซิร์ฟเวอร์มารวมเบื้องหลัง
async function syncFromServer() {
  if (testMode || !CONFIG.saveUrl) return;
  let res;
  try { res = await api({ action: 'load' }); } catch { return; }
  if (!res || !res.ok) return;
  state = mergeState(state, res.state);
  if (!document.querySelector('#s-quiz.active')) answers.splice(0, answers.length, ...(state.answers || []));
  if (document.querySelector('#s-date.active')) renderWallet();
  saveState();
  // เคยกดส่งแล้วแต่ส่งไม่ถึง (เช่นปิดหน้าไปก่อน) → ส่งใหม่ให้เอง
  if (state.submitted && !state.sent) sendAnswers();
}

/* ---------- 1) ระหว่างเดท: คูปองความรัก ---------- */
const COUPONS = CONFIG.coupons || [];
let spinning = false;

const drawsLeft = () => Math.min(
  (CONFIG.couponDraws || 0) - state.wallet.length,
  COUPONS.filter(c => !state.wallet.some(w => w.text === c)).length,
);

function updateDrawUI() {
  const left = Math.max(0, drawsLeft());
  $('#cp-left').textContent = left ? `สุ่มได้อีก ${left} ใบ` : 'สุ่มครบแล้ว';
  $('#draw').disabled = !left || spinning;
  $('#draw').textContent = left ? 'สุ่มคูปอง 🎲' : 'สุ่มครบแล้ว 🎉';
}

function renderWallet(animateFirst) {
  $('#wallet').replaceChildren(...state.wallet.map((c, i) => {
    const li = h('li', 'ticket' + (c.used ? ' used' : '') + (animateFirst && i === 0 ? ' new' : ''));
    li.append(h('span', 't-text', c.text));
    if (c.used) {
      li.append(h('span', 't-stamp', 'ใช้แล้ว ✓'));
      return li;
    }
    // กด 2 ครั้งถึงจะใช้ กันเผลอกด
    const b = h('button', 't-use', 'ใช้คูปอง');
    b.type = 'button';
    let armed = false, timer;
    b.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        b.textContent = 'แตะอีกทีเพื่อใช้';
        b.classList.add('armed');
        timer = setTimeout(() => { armed = false; b.textContent = 'ใช้คูปอง'; b.classList.remove('armed'); }, 2500);
        return;
      }
      clearTimeout(timer);
      c.used = true;
      saveState();
      renderWallet();
      toast(`ใช้คูปองแล้ว! ยื่นให้${CONFIG.from}ดูได้เลย 💗`);
    });
    li.append(b);
    return li;
  }));
  updateDrawUI();
}

$('#draw').addEventListener('click', () => {
  if (spinning || drawsLeft() <= 0) return;
  const pool = COUPONS.filter(c => !state.wallet.some(w => w.text === c));
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const slot = $('#slot');
  spinning = true;
  updateDrawUI();
  slot.classList.remove('landed');
  slot.classList.add('spinning');
  let i = 0;
  const spin = setInterval(() => { slot.textContent = COUPONS[i++ % COUPONS.length]; }, 70);
  setTimeout(() => {
    clearInterval(spin);
    slot.classList.remove('spinning');
    slot.textContent = pick;
    void slot.offsetWidth;
    slot.classList.add('landed');
    const r = slot.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 18);
    state.wallet.unshift({ text: pick, used: false });
    saveState();
    spinning = false;
    renderWallet(true);
  }, 1200);
});

/* ---------- 1) ระหว่างเดท: นับถอยหลังถึงจดหมาย ---------- */
let letterReady = false;
function updateLetterPill() {
  const left = LETTER - now();
  if (left > 0) {
    $('#letter-eta').textContent = timeLeft(left);
    return;
  }
  if (letterReady) return;
  letterReady = true;
  $('#letter-pill').hidden = true;
  $('#letter-go').hidden = false;
  if (document.querySelector('#s-date.active')) {
    const r = $('#letter-go').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 20);
    toast('ถึงเวลาเปิดจดหมายแล้ว 💌');
  }
}
$('#letter-go').addEventListener('click', () => enter('letter'));
$('#to-date').addEventListener('click', () => enter('date'));

/* ---------- สลับหน้าตามเวลา ---------- */
function enter(phase) {
  if (phase === 'drive') {
    $('#pickup-time').textContent = thaiTime(PICKUP);
    $('#eta').textContent = timeLeft(PICKUP - now());
    show('s-drive');
  } else if (phase === 'date') {
    $('#tl-panel').hidden = !STOPS.length;
    $('#cp-panel').hidden = !COUPONS.length || !CONFIG.couponDraws;
    $('#letter-time').textContent = thaiTime(LETTER);
    $('#slot').textContent = !state.wallet.length ? 'จะได้อะไรน้า 👀' : drawsLeft() > 0 ? 'ลุ้นใบต่อไป 👀' : 'สุ่มครบแล้ว ใช้ให้คุ้มนะ 💗';
    renderTimeline();
    renderWallet();
    updateLetterPill();
    show('s-date');
  } else {
    // มีช่วงระหว่างเดท → โชว์ปุ่มย้อนกลับไปดูแผนเดท & คูปอง
    $('#to-date').hidden = !(LETTER > PICKUP && (STOPS.length > 1 || COUPONS.length));
    show('s-intro');
  }
}

function tick() {
  const t = now();
  if (document.querySelector('#s-drive.active') && !arrived) {
    if (t >= PICKUP) arrive();
    else $('#eta').textContent = timeLeft(PICKUP - t);
  }
  if (document.querySelector('#s-date.active')) {
    renderTimeline();
    updateLetterPill();
  }
}

/* ---------- 2) เปิดซอง ---------- */
$('#envelope').addEventListener('click', e => {
  const env = e.currentTarget;
  if (now() < LETTER || env.classList.contains('open')) return;
  env.classList.add('open');
  const r = env.getBoundingClientRect();
  setTimeout(() => burst(r.left + r.width / 2, r.top, 16), 650);
  setTimeout(() => $('#s-intro').classList.add('leave'), 1600);
  // เคยส่งคำตอบแล้ว → เปิดใบสรุปเดิมเลย
  setTimeout(() => { if (state.submitted) finish(false); else { show('s-quiz'); render(); } }, 2000);
});

/* ---------- 3) คำถามแต่ละแบบ ---------- */
const renderers = {
  rating(q, body, set, cur) {
    const row = h('div', 'hearts');
    const label = h('p', 'rate-label', cur ? q.labels[cur - 1] : 'แตะหัวใจได้เลย');
    const btns = [];
    for (let i = 1; i <= 5; i++) {
      const b = h('button', 'heart' + (cur && i <= cur ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', `${i} ดวง — ${q.labels[i - 1]}`);
      b.innerHTML = HEART_SVG;
      b.addEventListener('click', () => {
        btns.forEach((x, j) => {
          x.classList.toggle('on', j < i);
          x.classList.remove('pop');
          if (j < i) { void x.offsetWidth; x.style.animationDelay = j * 50 + 'ms'; x.classList.add('pop'); }
        });
        label.textContent = q.labels[i - 1];
        set(i);
        if (i === 5) {
          const r = b.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top + r.height / 2, 14);
        }
      });
      btns.push(b);
      row.append(b);
    }
    body.append(row, label);
  },

  yesno(q, body, set, cur) {
    const area = h('div', 'yn');
    const yes = h('button', 'btn btn-primary yes-btn', q.yes);
    const no = h('button', 'btn btn-soft no-btn', q.no);
    yes.type = no.type = 'button';
    const hint = h('p', 'yn-hint', cur ? q.yesReply : '');
    const lines = q.noTexts || ['แน่ใจหรอ? 🥺'];
    let tries = 0;

    // ปุ่ม "ไม่" หนี — หาตำแหน่งใหม่ที่ไม่ทับปุ่ม "ใช่"
    const dodge = e => {
      e.preventDefault();
      // ครั้งแรก: ตรึงปุ่มไว้ที่ตำแหน่งเดิมก่อน แล้วค่อยให้ "ไม่" วิ่งหนี
      if (!area.classList.contains('loose')) {
        const pos = [yes, no].map(b => [b.offsetLeft, b.offsetTop]);
        area.classList.add('loose');
        [yes, no].forEach((b, i) => { b.style.left = pos[i][0] + 'px'; b.style.top = pos[i][1] + 'px'; });
        void no.offsetWidth;
      }
      tries++;
      if (tries > lines.length) {
        no.remove();
        hint.textContent = 'ปุ่ม "ไม่" หนีไปแล้ว 🏃💨';
        return;
      }
      no.textContent = lines[tries - 1];
      // ปุ่ม "ใช่" โตขึ้นเรื่อย ๆ แต่ไม่เกินกรอบ (จอเล็กจะได้ไม่ล้น)
      const cx = yes.offsetLeft + yes.offsetWidth / 2;
      const maxS = (2 * Math.min(cx, area.clientWidth - cx) - 4) / yes.offsetWidth;
      const s = Math.max(1, Math.min(1 + tries * 0.12, maxS));
      yes.style.transform = `scale(${s})`;
      // ใช้ขนาด layout จริง (ไม่โดน transition หลอก) แล้วขยายตาม scale ของปุ่ม "ใช่"
      const aw = area.clientWidth, ah = area.clientHeight;
      const bw = no.offsetWidth, bh = no.offsetHeight;
      const yw = yes.offsetWidth * s, yh = yes.offsetHeight * s;
      const yx = yes.offsetLeft - (yw - yes.offsetWidth) / 2;
      const yy = yes.offsetTop - (yh - yes.offsetHeight) / 2;
      const pad = 12;
      let x = 0, t = 0;
      for (let k = 0; k < 40; k++) {
        x = Math.random() * Math.max(0, aw - bw);
        t = Math.random() * Math.max(0, ah - bh);
        const hit = x < yx + yw + pad && x + bw > yx - pad && t < yy + yh + pad && t + bh > yy - pad;
        if (!hit) break;
      }
      no.style.left = x + 'px';
      no.style.top = t + 'px';
    };
    no.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') dodge(e); });
    no.addEventListener('pointerdown', dodge);
    no.addEventListener('click', e => { if (e.detail === 0) dodge(e); }); // คีย์บอร์ด

    yes.addEventListener('click', () => {
      set(q.yes);
      hint.textContent = q.yesReply;
      const r = yes.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, 20);
    });

    area.append(yes, no);
    body.append(area, hint);
  },

  choice(q, body, set, cur) {
    const grid = h('div', 'chips');
    q.options.forEach(opt => {
      const c = h('button', 'chip', opt);
      c.type = 'button';
      c.setAttribute('aria-pressed', String(cur === opt));
      c.addEventListener('click', () => {
        grid.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
        set(opt);
      });
      grid.append(c);
    });
    body.append(grid);
  },

  text(q, body, set, cur) {
    const t = h('textarea');
    t.placeholder = q.placeholder || '';
    t.value = cur || '';
    t.setAttribute('aria-label', q.q);
    t.addEventListener('input', () => set(t.value));
    body.append(t);
  },
};

const filled = v => v != null && String(v).trim() !== '';

function render() {
  const q = Q[idx];
  const card = $('#card');
  card.replaceChildren();
  card.classList.remove('enter');
  void card.offsetWidth;
  card.classList.add('enter');

  const last = idx === Q.length - 1;
  const next = h('button', 'btn btn-primary', last ? 'ส่งคำตอบ 💌' : 'ถัดไป →');
  const back = h('button', 'btn btn-ghost', '← ย้อน');
  next.type = back.type = 'button';
  back.style.visibility = idx === 0 ? 'hidden' : 'visible';

  const canGo = v => q.optional || filled(v);
  next.disabled = !canGo(answers[idx]);
  const set = v => {
    answers[idx] = v;
    next.disabled = !canGo(v);
    state.answers = answers.slice();
    saveState();
  };

  const body = h('div', 'body');
  card.append(h('p', 'step', `ข้อ ${idx + 1} จาก ${Q.length}`), h('h2', 'q', q.q), body);
  renderers[q.type](q, body, set, answers[idx]);

  const nav = h('div', 'nav');
  nav.append(back, next);
  card.append(nav);

  next.addEventListener('click', () => { if (last) finish(); else { idx++; render(); } });
  back.addEventListener('click', () => { idx--; render(); });

  const p = $('#progress');
  p.replaceChildren(...Q.map((_, i) => h('span', 'pdot' + (i < idx ? ' done' : i === idx ? ' now' : ''), '♥')));
}

/* ---------- 4) สรุป ---------- */
function fmt(q, a) {
  if (!filled(a)) return '(ไม่ได้ตอบ)';
  if (q.type === 'rating') return '♥'.repeat(a) + '♡'.repeat(5 - a) + '  ' + q.labels[a - 1];
  return String(a).trim();
}

function daysTogether() {
  if (!CONFIG.startDate) return null;
  const start = new Date(CONFIG.startDate + 'T00:00:00');
  const d = Math.floor((now() - start) / 86400000);
  return d >= 0 ? d : null;
}

// คำตอบทั้งหมด + คูปองที่สุ่มได้ระหว่างเดท
function summaryRows() {
  const rows = Q.map((q, i) => ({ q: q.q, a: fmt(q, answers[i]) }));
  if (state.wallet.length) {
    rows.push({
      q: 'คูปองความรักที่ได้ 🎟️',
      a: state.wallet.map(c => c.text + (c.used ? '  ✓ใช้แล้ว' : '')).join('\n'),
    });
  }
  return rows;
}

function answersText() {
  return [
    `💌 ใบสรุป${CONFIG.dateTitle}`,
    ...summaryRows().map((r, i) => `${i + 1}) ${r.q}\n→ ${r.a}`),
  ].join('\n\n');
}

// ส่งคำตอบไปเป็นไฟล์ .txt ใน GitHub (ผ่าน Apps Script)
async function sendAnswers() {
  const st = $('#send-status');
  st.className = 'send-status';
  if (testMode) { st.textContent = '🛠 โหมดทดสอบ: ไม่ได้ส่งคำตอบจริง'; return; }
  if (!CONFIG.saveUrl) { st.textContent = ''; return; }
  st.textContent = `กำลังส่งคำตอบให้${CONFIG.from}... อย่าเพิ่งปิดหน้านี้น้า`;
  try {
    const res = await api({ action: 'answers', text: answersText() });
    if (!res || !res.ok) throw new Error(res && res.error);
    state.sent = true;
    saveState();
    st.textContent = `ส่งคำตอบถึง${CONFIG.from}แล้ว ✓`;
    st.classList.add('ok');
  } catch {
    st.textContent = 'ส่งอัตโนมัติไม่สำเร็จ 🥲 กดปุ่มด้านล่างส่งทางแชทแทนได้น้า';
  }
}

function finish(send = true) {
  show('s-end');
  if (send) {
    state.answers = answers.slice();
    state.submitted = true;
    state.sent = false;
    saveState();
    sendAnswers();
  } else {
    $('#send-status').textContent = '';
  }
  $('#summary').replaceChildren(...summaryRows().map(r => {
    const li = h('li');
    li.append(h('div', 'sq', r.q), h('div', 'sa', r.a));
    return li;
  }));

  const d = daysTogether();
  $('#days').hidden = d == null;
  if (d != null) $('#days-n').textContent = d.toLocaleString();

  const stamp = $('#stamp');
  stamp.classList.remove('in');
  void stamp.offsetWidth;
  stamp.classList.add('in');

  [0, 300, 600].forEach((t, k) =>
    setTimeout(() => burst(innerWidth * (0.25 + k * 0.25), innerHeight * 0.3, 18), t));
}

$('#share').addEventListener('click', async () => {
  const text = answersText();

  // มือถือ → เปิดเมนูแชร์ (ส่งเข้า LINE ได้เลย) / คอม → คัดลอก
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ text }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = h('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;opacity:0';
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('คัดลอกแล้ว ไปวางในแชทได้เลย 💗');
});

$('#again').addEventListener('click', () => {
  answers.length = 0;
  state.answers = [];
  state.submitted = false;
  saveState();
  idx = 0;
  show('s-quiz');
  render();
});

/* ---------- รูป: photos/<หน้า>/1.png, 2.png, ... ---------- */
const PHOTO_EXT = ['png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG', 'JPEG'];

const loadImg = src => new Promise(res => {
  const img = new Image();
  img.onload = () => res(src);
  img.onerror = () => res(null);
  img.src = src;
});

// ไล่หา 1, 2, 3, ... จนกว่าจะเจอเลขที่ไม่มีรูป
async function findPhotos(dir) {
  const found = [];
  for (let n = 1; n <= 50; n++) {
    let src = null;
    for (const ext of PHOTO_EXT) {
      src = await loadImg(`photos/${dir}/${n}.${ext}`);
      if (src) break;
    }
    if (!src) break;
    found.push(src);
  }
  return found;
}

async function fillPhotos(box) {
  const dir = box.dataset.dir;
  const list = await findPhotos(dir);
  if (!list.length) return;
  box.querySelector('.photos-title').textContent = (CONFIG.photoTitles || {})[dir] || '';
  box.querySelector('.strip').replaceChildren(...list.map((src, i) => {
    const b = h('button', 'polaroid');
    b.type = 'button';
    b.style.setProperty('--tilt', (i % 2 ? 1 : -1) * (2 + (i * 7) % 3) + 'deg');
    const img = h('img');
    img.src = src;
    img.alt = `รูปที่ ${i + 1}`;
    img.decoding = 'async';
    b.append(img);
    b.addEventListener('click', () => openLightbox(list, i));
    return b;
  }));
  box.hidden = false;
}

let lbList = [], lbIdx = 0;
function showLb() {
  const img = $('#lb-img');
  img.src = lbList[lbIdx];
  img.alt = `รูปที่ ${lbIdx + 1}`;
  img.style.animation = 'none';
  void img.offsetWidth;
  img.style.animation = '';
  $('#lb-count').textContent = `${lbIdx + 1} / ${lbList.length}`;
  $('#lb-prev').hidden = $('#lb-next').hidden = lbList.length < 2;
}
function openLightbox(list, i) {
  lbList = list;
  lbIdx = i;
  showLb();
  $('#lightbox').hidden = false;
  document.body.classList.add('lb-open'); // กันหน้าข้างหลังเลื่อนตาม
}
function closeLightbox() {
  $('#lightbox').hidden = true;
  document.body.classList.remove('lb-open');
}
const lbStep = d => { lbIdx = (lbIdx + d + lbList.length) % lbList.length; showLb(); };
$('#lb-prev').addEventListener('click', () => lbStep(-1));
$('#lb-next').addEventListener('click', () => lbStep(1));
$('#lb-close').addEventListener('click', closeLightbox);
$('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });

// ปัดซ้าย/ขวาบนรูปเพื่อเปลี่ยนรูป
let swipeX = null;
$('#lb-img').addEventListener('touchstart', e => { swipeX = e.touches[0].clientX; }, { passive: true });
$('#lb-img').addEventListener('touchend', e => {
  if (swipeX == null) return;
  const dx = e.changedTouches[0].clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 40 && lbList.length > 1) lbStep(dx < 0 ? 1 : -1);
});

document.addEventListener('keydown', e => {
  if ($('#lightbox').hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lbStep(-1);
  if (e.key === 'ArrowRight') lbStep(1);
});

document.querySelectorAll('.photos').forEach(fillPhotos);

/* ---------- PIN ก่อนเข้าเว็บ ----------
   CONFIG.pin = PIN แฟน (เซฟคูปอง/คำตอบ) · CONFIG.adminPin = ทดสอบ ไม่เซฟอะไร */
const PIN_LEN = Math.max(String(CONFIG.pin || '').length, String(CONFIG.adminPin || '').length) || 6;
let typed = '';

function drawDots() {
  $('#pin-dots').replaceChildren(...Array.from({ length: PIN_LEN }, (_, i) => h('i', i < typed.length ? 'on' : '')));
}

function pressKey(k) {
  if ($('#keypad').dataset.busy) return;
  $('#pin-msg').textContent = '';
  $('#pin-dots').classList.remove('wrong');
  if (k === 'del') typed = typed.slice(0, -1);
  else if (typed.length < PIN_LEN) typed += k;
  drawDots();
  if (typed.length < PIN_LEN) return;

  const isAdmin = !!CONFIG.adminPin && typed === String(CONFIG.adminPin);
  if (typed === String(CONFIG.pin) || isAdmin) {
    unlock(typed, isAdmin);
    return;
  }
  // ผิด → สั่น แล้วล้าง
  $('#keypad').dataset.busy = '1';
  $('#pin-dots').classList.add('wrong');
  $('#lock').classList.remove('shake');
  void $('#lock').offsetWidth;
  $('#lock').classList.add('shake');
  $('#pin-msg').textContent = 'ไม่ใช่น้า ลองใหม่อีกที 🥺';
  if (navigator.vibrate) navigator.vibrate(120);
  setTimeout(() => { typed = ''; drawDots(); delete $('#keypad').dataset.busy; }, 700);
}

$('#keypad').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) pressKey(b.dataset.key || b.textContent.trim());
});
document.addEventListener('keydown', e => {
  if (!document.querySelector('#s-pin.active')) return;
  if (/^\d$/.test(e.key)) pressKey(e.key);
  if (e.key === 'Backspace') pressKey('del');
});

async function unlock(pin, isAdmin, instant) {
  PIN = pin;
  if (isAdmin) {
    testMode = true;
    document.body.classList.add('admin');
    $('#admin-bar').hidden = false;
  }
  if (!instant) {
    $('#keypad').dataset.busy = '1';
    $('#lock').textContent = '🔓';
    $('#lock').classList.add('open');
    $('#pin-msg').textContent = isAdmin ? '🛠 เข้าโหมดทดสอบ' : `ยินดีต้อนรับน้า${CONFIG.to} 💗`;
    const r = $('#lock').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 18);
  }
  loadState();
  if (!instant) await new Promise(r => setTimeout(r, 900));
  enter(phaseNow());
  syncFromServer();
}

// แถบ admin: กระโดดไปแต่ละช่วง (ใช้ ?at=)
const hhmmss = t => new Date(t).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });
document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => {
  const j = b.dataset.jump;
  if (j === 'exit') {
    location.href = location.pathname;
    return;
  }
  // ให้หน้าถัดไปข้าม PIN ได้ครั้งเดียว (รีเฟรชเองยังต้องใส่ PIN)
  try { sessionStorage.setItem('date-admin-jump', '1'); } catch {}
  const t = j === 'drive' ? PICKUP - 15000 : j === 'date' ? PICKUP + 60000 : LETTER - 10000;
  location.href = `${location.pathname}?at=${hhmmss(t)}`;
}));

/* ---------- เริ่ม ---------- */
// ต้องใส่ PIN ใหม่ทุกครั้งที่เปิด/รีเฟรช
(function start() {
  let jump = false;
  try {
    localStorage.removeItem('date-pin'); // ล้าง PIN ที่เวอร์ชันก่อนเคยจำไว้
    jump = sessionStorage.getItem('date-admin-jump') === '1';
    sessionStorage.removeItem('date-admin-jump');
  } catch {}
  if (!CONFIG.pin) return unlock('', false, true); // ไม่ตั้ง PIN = เข้าได้เลย
  if (jump && CONFIG.adminPin) return unlock(String(CONFIG.adminPin), true, true);
  drawDots();
  show('s-pin');
})();
setInterval(tick, 1000);
document.addEventListener('visibilitychange', tick);
