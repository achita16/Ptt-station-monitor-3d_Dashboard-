/* สภาพอากาศ + เทียบกับยอดขายรายวัน (หน้าภาพรวม)
 * - ช่องสภาพอากาศมุมขวาบนแสดงอากาศปัจจุบันของอุดรธานี (Open-Meteo) กดเพื่อเปิดแผงรายละเอียด
 * - แผง: เลือกดูทีละวัน → สภาพอากาศของวันนั้น + ยอด Café Amazon / น้ำมัน เทียบกับวันเดียวกันในสัปดาห์ + กราฟรายชั่วโมง
 * - ข้อมูลอากาศ: Open-Meteo (ฟรี ไม่ต้องใช้ key) · ข้อมูลยอดขาย: ใช้ชุดเดียวกับน้องมิ่งขวัญ (window.Mingkwan.data)
 * - ถ้าดึงข้อมูลอากาศไม่ได้ จะแสดง --°C และยังดูยอดขายในแผงได้ตามปกติ */
(function () {
  'use strict';
  var LAT = 17.41, LON = 102.79, TZ = 'Asia%2FBangkok';   // อุดรธานี
  var CK = 'wxcache_v1', TTL = 3 * 36e5, START_MIN = '2026-01-01';
  var MN = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var WD = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  var HV = 'temperature_2m,precipitation,cloud_cover,weather_code';
  var DV = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration';

  /* ---------- helpers ---------- */
  function n(x, d) { d = d || 0; return (+x || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
  function di(s) { var m = String(s).match(/(\d+)-(\d+)-(\d+)/); return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5); }
  function iso(d) { var x = new Date(d * 864e5); return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2); }
  function wdOf(d) { return (d + 3) % 7; }
  function sd(d) { var x = new Date(d * 864e5); return WD[wdOf(d)] + ' ' + x.getUTCDate() + ' ' + MN[x.getUTCMonth()] + ' ' + String((x.getUTCFullYear() + 543) % 100); }
  function today() { return Math.floor((Date.now() + 7 * 36e5) / 864e5); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pct(a, b) { return b > 0 ? (a / b - 1) * 100 : null; }
  function tag(p) { if (p === null) return '<span class="dl">–</span>'; return '<span class="dl ' + (p >= 0 ? 'up' : 'dn') + '">' + (p >= 0 ? '▲ +' : '▼ ') + p.toFixed(1) + '%</span>'; }
  function hh(h) { return ('0' + h).slice(-2) + ':00'; }
  function getJ(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }

  /* ---------- สภาพอากาศ ---------- */
  var W = { H: {}, D: {}, cur: null, histOk: false, histLoading: null };

  function merge(j) {
    if (j.hourly && j.hourly.time) {
      var h = j.hourly;
      h.time.forEach(function (t, i) {
        if (h.temperature_2m[i] === null && h.precipitation[i] === null && h.cloud_cover[i] === null) return;   // ยังไม่มีข้อมูล
        var d = t.slice(0, 10), hr = +t.slice(11, 13);
        (W.H[d] || (W.H[d] = []))[hr] = { t: h.temperature_2m[i], p: h.precipitation[i] || 0, c: h.cloud_cover[i], w: h.weather_code[i] };
      });
    }
    if (j.daily && j.daily.time) {
      var dd = j.daily;
      dd.time.forEach(function (d, i) {
        if (dd.temperature_2m_max[i] === null) return;
        W.D[d] = { tmax: dd.temperature_2m_max[i], tmin: dd.temperature_2m_min[i], rain: dd.precipitation_sum[i] || 0, sun: dd.sunshine_duration ? (dd.sunshine_duration[i] || 0) / 3600 : null, code: dd.weather_code[i] };
      });
    }
  }
  function fcUrl(past) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
      '&current=temperature_2m,weather_code,cloud_cover,relative_humidity_2m,wind_speed_10m,precipitation' +
      '&hourly=' + HV + '&daily=' + DV + '&past_days=' + past + '&forecast_days=2&timezone=' + TZ;
  }
  function arUrl(a, b) {
    return 'https://archive-api.open-meteo.com/v1/archive?latitude=' + LAT + '&longitude=' + LON + '&start_date=' + a + '&end_date=' + b +
      '&hourly=' + HV + '&daily=' + DV + '&timezone=' + TZ;
  }
  function loadCurrent() {
    return getJ(fcUrl(0)).then(function (j) { W.cur = j.current || null; merge(j); paintHeader(); }).catch(function () { W.cur = null; paintHeader(); });
  }
  function loadHist(startIso) {
    if (W.histOk) return Promise.resolve();
    if (W.histLoading) return W.histLoading;
    try {
      var c = JSON.parse(localStorage.getItem(CK) || 'null');
      if (c && Date.now() - c.t < TTL && c.start <= startIso) { W.H = c.H; W.D = c.D; W.histOk = true; return Promise.resolve(); }
    } catch (e) { }
    var t = today(), arEnd = iso(t - 8), jobs = [getJ(fcUrl(14)).then(function (j) { W.cur = j.current || W.cur; return j; }).catch(function () { return null; })];
    if (startIso <= arEnd) jobs.push(getJ(arUrl(startIso, arEnd)).catch(function () { return null; }));
    W.histLoading = Promise.all(jobs).then(function (rs) {
      var fc = rs[0], ar = rs[1];
      if (ar) merge(ar);
      if (fc) merge(fc);   // ข้อมูลล่าสุดทับ
      W.histOk = !!(ar || fc); W.histLoading = null;
      if (W.histOk) { try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), start: startIso, H: W.H, D: W.D })); } catch (e) { } }
    });
    return W.histLoading;
  }

  /* ---------- จัดกลุ่ม/ไอคอน ---------- */
  function hourIcon(x, hr) {
    if (!x) return '·';
    if (x.p >= 2.5) return '🌧';
    if (x.p >= 0.2) return '🌦';
    if (x.w >= 95) return '⛈';
    if (hr < 6 || hr >= 19) return x.c < 50 ? '🌙' : '☁️';
    return x.c < 30 ? '☀️' : x.c < 70 ? '⛅' : '☁️';
  }
  function dayCloud(date) {
    var H = W.H[date]; if (!H) return null;
    var s = 0, c = 0; for (var h = 7; h <= 18; h++) if (H[h] && H[h].c !== null) { s += H[h].c; c++; }
    return c ? s / c : null;
  }
  function skyDay(date) {
    var D = W.D[date]; if (!D) return null;
    var H = W.H[date] || [], storm = false;
    for (var h = 0; h < 24; h++) if (H[h] && H[h].w >= 95) storm = true;
    var cl = dayCloud(date);
    if (storm) return { k: 'storm', label: 'พายุฝนฟ้าคะนอง', ic: '⛈', cloud: cl };
    if (D.rain >= 10) return { k: 'hrain', label: 'ฝนตกหนัก', ic: '🌧', cloud: cl };
    if (D.rain >= 1) return { k: 'lrain', label: 'ฝนเล็กน้อย', ic: '🌦', cloud: cl };
    if (cl === null) return { k: 'unk', label: 'ไม่ทราบท้องฟ้า', ic: '·', cloud: null };
    if (cl < 30) return { k: 'sun', label: 'แดดจัด', ic: '☀️', cloud: cl };
    if (cl < 70) return { k: 'part', label: 'เมฆบางส่วน', ic: '⛅', cloud: cl };
    return { k: 'cloud', label: 'เมฆครึ้ม', ic: '☁️', cloud: cl };
  }
  function nowSky() {
    var c = W.cur; if (!c) return null;
    if (c.precipitation >= 2.5) return { label: 'ฝนตกหนัก', ic: '🌧' };
    if (c.precipitation >= 0.2) return { label: 'ฝนตก', ic: '🌦' };
    if (c.weather_code >= 95) return { label: 'พายุฝนฟ้าคะนอง', ic: '⛈' };
    var hr = +String(c.time || '').slice(11, 13), night = hr < 6 || hr >= 19;
    if (c.cloud_cover < 30) return { label: night ? 'ท้องฟ้าโปร่ง' : 'แดดจัด', ic: night ? '🌙' : '☀️' };
    if (c.cloud_cover < 70) return { label: 'เมฆบางส่วน', ic: night ? '☁️' : '⛅' };
    return { label: 'เมฆครึ้ม', ic: '☁️' };
  }
  function rainWin(date) {
    var H = W.H[date]; if (!H) return '';
    var f = -1, l = -1; for (var h = 0; h < 24; h++) if (H[h] && H[h].p >= 0.2) { if (f < 0) f = h; l = h; }
    return f < 0 ? 'ไม่มีฝนตก' : 'ฝนตกช่วง ' + hh(f) + '–' + hh(l + 1) + ' น.';
  }

  /* ---------- ข้อมูลยอดขาย ---------- */
  var SD = null;   // { FD, AD }
  function dayAmz(d) { var r = SD && SD.AD.DAY[d]; return r ? { n: r.n, b: r.b, cup: SD.AD.RD[d] ? r.cup : null } : null; }
  function dayFuel(d) {
    var r = SD && SD.FD.DAY[d]; if (!r) return null;
    var B = 0, C = 0, L = 0; r.forEach(function (x) { if (x) { B += x[1]; L += x[0]; C += x[2] + x[3] + x[4]; } });
    return { B: B, C: C, L: L };
  }
  function refDays(d, has) {   // วันเดียวกันในสัปดาห์ ก่อนวันที่ d (ไม่รวม d) สูงสุด 12 วันที่มีข้อมูล
    var out = [], x = d - 7; while (out.length < 12 && x > d - 7 * 40) { if (has(x)) out.push(x); x -= 7; } return out;
  }
  function avgOf(list, f) { return list.length ? list.reduce(function (a, x) { return a + f(x); }, 0) / list.length : 0; }
  function hourVal(kind, d, h) {
    if (kind === 'amz') { var a = SD.AD.HRS[d]; return a ? a[h * 2] : 0; }
    var a2 = SD.FD.HRS[d]; if (!a2) return 0; var s = 0; for (var f = 0; f < 4; f++) { var o = (h * 4 + f) * 3; s += a2[o] + a2[o + 1] + a2[o + 2]; } return s;
  }
  function hasHrs(kind, d) { return kind === 'amz' ? !!SD.AD.HRS[d] : !!SD.FD.HRS[d]; }

  /* ---------- UI ---------- */
  var CSS = '#wxp{position:fixed;right:14px;top:78px;width:min(468px,calc(100vw - 20px));max-height:calc(100vh - 92px);overflow:auto;background:#fff;border-radius:20px;box-shadow:0 22px 60px rgba(11,26,58,.38);z-index:60;font-family:"Noto Sans Thai","Sarabun",sans-serif;color:#17233a}' +
    '#wxp[hidden]{display:none}' +
    '#wxp .hd{background:linear-gradient(135deg,#4aa3f0,#1e5fd0);color:#fff;padding:14px 18px;display:flex;align-items:center;gap:14px;border-radius:20px 20px 0 0}' +
    '#wxp .hd .ic{font-size:44px;line-height:1}#wxp .hd .big{font-size:38px;font-weight:700;line-height:1}#wxp .hd small{display:block;font-size:12px;opacity:.92;margin-top:3px}' +
    '#wxp .hd .r{margin-left:auto;text-align:right;font-size:12px;line-height:1.6;opacity:.95}#wxp .hd .x{background:none;border:0;color:#fff;font-size:20px;cursor:pointer;padding:4px 6px;opacity:.9}' +
    '#wxp .bd{padding:14px 18px 12px}' +
    '#wxp .nav{display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap}' +
    '#wxp .nav button{width:30px;height:30px;border-radius:50%;border:0;background:#eef3fa;font-size:18px;color:#31415f;cursor:pointer;line-height:1}#wxp .nav button:disabled{opacity:.35;cursor:default}' +
    '#wxp .nav label{position:relative;background:#fff;border:1.5px solid #1e78e6;color:#0b4bb3;font-weight:700;border-radius:16px;padding:5px 14px;font-size:13.5px;cursor:pointer}' +
    '#wxp .nav label input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}' +
    '#wxp .nav .td{width:auto;height:auto;border-radius:14px;padding:4px 10px;background:#fff;border:1px solid #bcd6f7;color:#1e78e6;font-size:12px}' +
    '#wxp .wxday{display:flex;gap:12px;align-items:center;background:linear-gradient(135deg,#eaf3ff,#f6faff);border:1px solid #d6e6fb;border-radius:14px;padding:10px 12px;margin-bottom:10px}' +
    '#wxp .wxday .e{font-size:38px;line-height:1}#wxp .wxday .t b{font-size:16px;display:block}#wxp .wxday .t small{font-size:11.5px;color:#5b6b85;display:block;max-width:150px;line-height:1.35}' +
    '#wxp .wxday .k{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-left:auto}#wxp .wxday .k div{text-align:right}#wxp .wxday .k b{font-size:13px;display:block}#wxp .wxday .k small{font-size:10.5px;color:#8593a9}' +
    '#wxp .nodata{background:#fff8e6;border:1px solid #f3dca0;color:#7a5a00;border-radius:12px;padding:10px 12px;font-size:12.5px;margin-bottom:10px}' +
    '#wxp .tiles{display:flex;gap:10px}#wxp .tl{flex:1;background:#fff;border:1px solid #e1e9f5;border-radius:14px;padding:9px 12px;min-width:0}#wxp .tl h4{margin:0 0 3px;font-size:12.5px}' +
    '#wxp .tl .bg{font-size:21px;font-weight:700}#wxp .tl .bg small{font-size:12px;font-weight:500}#wxp .tl .sm{font-size:12px;color:#5b6b85;margin:1px 0 3px}#wxp .tl small{font-size:10.5px;color:#8593a9}' +
    '#wxp .dl{font-size:11.5px;font-weight:700}#wxp .up{color:#16a05a}#wxp .dn{color:#e0443e}' +
    '#wxp h3{font-size:13px;margin:10px 0 2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '#wxp .seg{display:inline-flex;background:#eef3fa;border-radius:16px;padding:2px;gap:2px}#wxp .seg button{border:0;background:none;font:inherit;font-size:11.5px;padding:3px 11px;border-radius:13px;color:#31415f;cursor:pointer}#wxp .seg button.on{background:#1e78e6;color:#fff;font-weight:600}' +
    '#wxp .strip{display:flex;margin-top:4px}#wxp .strip>div{flex:1;text-align:center;font-size:10px;color:#5b6b85}#wxp .strip i{display:block;font-style:normal;font-size:14px;line-height:1.1}#wxp .strip small{display:block;font-size:9px;color:#2f6fe0;height:10px}#wxp .strip.xl{margin-top:1px;color:#8593a9}' +
    '#wxp .ch svg{display:block;width:100%;height:auto}' +
    '#wxp .legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#5b6b85;margin:2px 0 0 2px}#wxp .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}' +
    '#wxp .ins{background:#f2f7ff;border:1px solid #d6e6fb;border-radius:12px;padding:9px 12px;font-size:12.5px;line-height:1.55;margin:8px 0}#wxp .ins b{color:#0b4bb3}' +
    '#wxp .ft{font-size:10.8px;color:#8593a9;margin-top:8px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}' +
    '.wx{cursor:pointer;border-radius:14px;padding:2px 6px;transition:background .15s}.wx:hover{background:rgba(255,255,255,.6)}.wx .wxi{font-size:28px;line-height:1;width:38px;text-align:center}';
  var P, S = { d: 0, kind: 'amz' }, MINDAY = 0;

  function paintHeader() {
    var el = document.querySelector('.wx'); if (!el) return;
    var s = nowSky(), c = W.cur, b = el.querySelector('b'), sp = el.querySelector('span'), svg = el.querySelector('svg'), ic = el.querySelector('.wxi');
    if (!ic) { ic = document.createElement('span'); ic.className = 'wxi'; if (svg) svg.replaceWith(ic); else el.insertBefore(ic, el.firstChild); }
    if (c && s) { ic.textContent = s.ic; b.textContent = Math.round(c.temperature_2m) + '°C'; sp.textContent = 'อุดรธานี · ' + s.label; el.title = 'กดดูสภาพอากาศกับยอดขาย'; }
    else { ic.textContent = '·'; b.textContent = '--°C'; sp.textContent = 'อุดรธานี'; el.title = 'ยังดึงข้อมูลสภาพอากาศไม่ได้ · กดดูยอดขายรายวัน'; }
    if (P && !P.hidden) paintTop();
  }
  function paintTop() {
    var c = W.cur, s = nowSky(), t = W.D[iso(today())];
    P.querySelector('.hd').innerHTML = '<div class="ic">' + (s ? s.ic : '·') + '</div><div><div class="big">' + (c ? Math.round(c.temperature_2m) + '°C' : '--°C') + '</div><small>อุดรธานี · ' + (s ? s.label : 'ยังดึงข้อมูลไม่ได้') + '</small></div>' +
      '<div class="r">' + (c ? 'เมฆปกคลุม ' + Math.round(c.cloud_cover) + '% · ความชื้น ' + Math.round(c.relative_humidity_2m) + '%<br>ลม ' + Math.round(c.wind_speed_10m) + ' กม./ชม.' + (t ? '<br>ฝนวันนี้ ' + n(t.rain, 1) + ' มม.' : '') : 'ตอนนี้ยังไม่มีข้อมูลอากาศ<br>ลองรีเฟรชหน้า') + '</div><button class="x" type="button" aria-label="ปิด">✕</button>';
    P.querySelector('.x').onclick = closeP;
  }
  function paintBody() {
    var d = S.d, date = iso(d), t = today(), dl = W.D[date], sk = skyDay(date), mx = t;
    var A = dayAmz(d), F = dayFuel(d);
    var html = '<div class="nav"><button type="button" id="wxPrev" aria-label="วันก่อนหน้า"' + (d <= MINDAY ? ' disabled' : '') + '>‹</button>' +
      '<label>📅 ' + sd(d) + '<input type="date" id="wxDate" value="' + date + '" min="' + iso(MINDAY) + '" max="' + iso(mx) + '"></label>' +
      '<button type="button" id="wxNext" aria-label="วันถัดไป"' + (d >= mx ? ' disabled' : '') + '>›</button><button type="button" class="td" id="wxToday">วันนี้</button></div>';
    // สภาพอากาศของวัน
    if (dl && sk) {
      html += '<div class="wxday"><div class="e">' + sk.ic + '</div><div class="t"><b>' + sk.label + '</b><small>' + rainWin(date) + '</small></div><div class="k">' +
        '<div><b>' + Math.round(dl.tmin) + '–' + Math.round(dl.tmax) + '°C</b><small>อุณหภูมิ</small></div>' +
        '<div><b>' + (sk.cloud === null ? '–' : Math.round(sk.cloud) + '%') + '</b><small>เมฆปกคลุม (07–19 น.)</small></div>' +
        '<div><b>' + n(dl.rain, 1) + ' มม.</b><small>ฝนสะสม</small></div>' +
        '<div><b>' + (dl.sun === null ? '–' : n(dl.sun, 1) + ' ชม.') + '</b><small>ชั่วโมงแดด</small></div></div></div>';
    } else html += '<div class="nodata">ยังไม่มีข้อมูลสภาพอากาศของวันนี้ (อาจยังดึงไม่ได้ หรือเป็นวันที่ข้อมูลย้อนหลังยังไม่พร้อม) · ยังดูยอดขายของวันนี้ได้ตามปกติ</div>';
    // ยอดขาย
    var aRef = refDays(d, function (x) { return SD && SD.AD.DAY[x]; }), fRef = refDays(d, function (x) { return SD && SD.FD.DAY[x]; });
    var aAvg = avgOf(aRef, function (x) { return SD.AD.DAY[x].n; }), fAvg = avgOf(fRef, function (x) { return dayFuel(x).B; });
    html += '<div class="tiles"><div class="tl"><h4>☕ Café Amazon</h4>' + (A ? '<div class="bg">' + n(A.n) + ' <small>บาท</small></div><div class="sm">' + n(A.b) + ' คน' + (A.cup !== null ? ' · ' + n(A.cup) + ' แก้ว' : '') + '</div><div>' + tag(pct(A.n, aAvg)) + ' <small>เทียบวัน' + WD[wdOf(d)] + 'ทั่วไป' + (aAvg ? ' (' + n(aAvg) + ')' : '') + '</small></div>' : '<div class="sm" style="margin-top:8px">ยังไม่มีข้อมูลยอดขายของวันนี้</div>') + '</div>' +
      '<div class="tl"><h4>⛽ น้ำมัน</h4>' + (F ? '<div class="bg">' + n(F.B) + ' <small>บาท</small></div><div class="sm">' + n(F.C) + ' คัน · ' + n(F.L) + ' ลิตร</div><div>' + tag(pct(F.B, fAvg)) + ' <small>เทียบวัน' + WD[wdOf(d)] + 'ทั่วไป</small></div>' : '<div class="sm" style="margin-top:8px">ยังไม่มีข้อมูลยอดขายของวันนี้</div>') + '</div></div>';
    // รายชั่วโมง
    html += '<h3>ลูกค้ารายชั่วโมง กับสภาพอากาศ <span class="seg" id="wxKind"><button type="button" data-k="amz" class="' + (S.kind === 'amz' ? 'on' : '') + '">Amazon (คน)</button><button type="button" data-k="fuel" class="' + (S.kind === 'fuel' ? 'on' : '') + '">น้ำมัน (คัน)</button></span></h3>';
    html += hourly(d, date);
    html += '<div class="ft"><span>ที่มา: Open-Meteo (อุดรธานี) · ' + (SD && SD.SAMPLE ? 'ยอดขายตัวอย่าง' : 'POS') + '</span><span>ความสัมพันธ์ ไม่ใช่การพิสูจน์สาเหตุ</span></div>';
    P.querySelector('.bd').innerHTML = html;
    P.querySelector('#wxPrev').onclick = function () { go(S.d - 1); };
    P.querySelector('#wxNext').onclick = function () { go(S.d + 1); };
    P.querySelector('#wxToday').onclick = function () { go(today()); };
    P.querySelector('#wxDate').onchange = function (e) { if (e.target.value) go(di(e.target.value)); };
    P.querySelectorAll('#wxKind button').forEach(function (b) { b.onclick = function () { S.kind = b.dataset.k; paintBody(); }; });
  }
  function hourly(d, date) {
    var kind = S.kind, unit = kind === 'amz' ? 'คน' : 'คัน', ref = refDays(d, function (x) { return SD && hasHrs(kind, x); });
    if (!SD || !hasHrs(kind, d)) return '<div class="nodata">ยังไม่มีข้อมูลรายชั่วโมงของวันนี้</div>';
    var H = W.H[date] || [], h0 = kind === 'amz' ? 7 : 5, h1 = kind === 'amz' ? 18 : 22, list = [];
    for (var h = h0; h <= h1; h++) list.push({ h: h, v: hourVal(kind, d, h), t: avgOf(ref, function (x) { return hourVal(kind, x, h); }), w: H[h] });
    var mxv = Math.max.apply(null, list.map(function (x) { return Math.max(x.v, x.t); })) + 2, CW = 428, CH = 104, bw = CW / list.length;
    var svg = '<svg viewBox="0 0 ' + CW + ' ' + CH + '">';
    list.forEach(function (x, i) {
      var r = x.w ? x.w.p : 0;
      if (r >= 0.2) svg += '<rect x="' + (i * bw) + '" y="0" width="' + bw + '" height="' + CH + '" fill="#6fb4f5" opacity="' + (0.10 + Math.min(r, 7) / 7 * 0.16).toFixed(2) + '"/>';
      var hgt = x.v / mxv * (CH - 14);
      svg += '<rect x="' + (i * bw + 5) + '" y="' + (CH - hgt) + '" width="' + (bw - 10) + '" height="' + hgt + '" rx="3" fill="#f08a1c"/><text x="' + (i * bw + bw / 2) + '" y="' + (CH - hgt - 3) + '" font-size="9.5" text-anchor="middle" fill="#7a4a07" font-weight="700">' + x.v + '</text>';
    });
    if (ref.length) svg += '<path d="M' + list.map(function (x, i) { return (i * bw + bw / 2) + ',' + (CH - x.t / mxv * (CH - 14)); }).join(' L') + '" fill="none" stroke="#31415f" stroke-width="1.8" stroke-dasharray="4 3"/>';
    svg += '</svg>';
    var strip = '<div class="strip">' + list.map(function (x) { return '<div><i>' + hourIcon(x.w, x.h) + '</i><small>' + (x.w && x.w.p >= 0.2 ? n(x.w.p, 1) : '') + '</small></div>'; }).join('') + '</div>';
    var xl = '<div class="strip xl">' + list.map(function (x) { return '<div>' + ('0' + x.h).slice(-2) + '</div>'; }).join('') + '</div>';
    // ข้อความสรุป
    var rl = list.filter(function (x) { return x.w && x.w.p >= 0.2; }), ins = '';
    if (!ref.length) ins = 'ยังไม่มีวัน' + WD[wdOf(d)] + 'ก่อนหน้าให้เทียบค่ะ';
    else if (!H.length) ins = 'ไม่มีข้อมูลสภาพอากาศรายชั่วโมงของวันนี้ จึงเทียบกับช่วงฝนไม่ได้';
    else if (rl.length) {
      var sv = rl.reduce(function (a, x) { return a + x.v; }, 0), st = rl.reduce(function (a, x) { return a + x.t; }, 0), first = rl[0].h, last = rl[rl.length - 1].h;
      ins = 'ช่วงฝนตก ' + hh(first) + '–' + hh(last + 1) + ' น. (' + rl.length + ' ชม.) ลูกค้า<b>' + (kind === 'amz' ? ' Amazon' : 'น้ำมัน') + ' ' + n(sv) + ' ' + unit + '</b> เทียบค่าเฉลี่ยของวัน' + WD[wdOf(d)] + 'ทั่วไป <b>' + n(st) + ' ' + unit + '</b>' + (st >= 1 ? ' (' + (sv >= st ? '+' : '') + ((sv / st - 1) * 100).toFixed(0) + '%)' : '');
    } else {
      var tv = list.reduce(function (a, x) { return a + x.v; }, 0), tt = list.reduce(function (a, x) { return a + x.t; }, 0);
      ins = 'ไม่มีฝนตกในช่วงเวลาที่แสดง · รวมทั้งช่วง ' + n(tv) + ' ' + unit + ' เทียบค่าเฉลี่ย ' + n(tt) + ' ' + unit + (tt >= 1 ? ' (' + (tv >= tt ? '+' : '') + ((tv / tt - 1) * 100).toFixed(0) + '%)' : '');
    }
    var warn = ref.length && ref.length < 4 ? ' <small style="color:#9a6a00">· เทียบจากแค่ ' + ref.length + ' วัน ผลอาจคลาดเคลื่อน</small>' : '';
    return strip + '<div class="ch">' + svg + '</div>' + xl + '<div class="legend"><span><i style="background:#f08a1c"></i>วันที่เลือก</span><span><i style="background:#31415f"></i>ค่าเฉลี่ยวัน' + WD[wdOf(d)] + 'ทั่วไป' + (ref.length ? ' (' + ref.length + ' วัน)' : '') + '</span><span><i style="background:#9fcaf7"></i>ชั่วโมงที่ฝนตก</span></div><div class="ins">💡 ' + ins + warn + '</div>';
  }
  function go(d) { var t = today(); S.d = Math.max(MINDAY, Math.min(t, d)); paintBody(); }

  function openP() {
    P.hidden = false; paintTop();
    P.querySelector('.bd').innerHTML = '<div class="nodata" style="background:#f2f7ff;border-color:#d6e6fb;color:#31415f">กำลังโหลดข้อมูล…</div>';
    var md = window.Mingkwan && window.Mingkwan.data ? window.Mingkwan.data() : Promise.resolve(null);
    md.then(function (d) {
      SD = d;
      var first = START_MIN, a = SD && SD.AD.FIRST ? iso(SD.AD.FIRST) : null, f = SD && SD.FD.FIRST ? iso(SD.FD.FIRST) : null;
      [a, f].forEach(function (x) { if (x && x < first) first = x; });
      MINDAY = di(first);
      var last = Math.max(SD && SD.AD.LAST || 0, SD && SD.FD.LAST || 0);
      if (!S.d) S.d = last && last <= today() ? last : today();
      return loadHist(first);
    }).then(function () { paintTop(); paintBody(); }).catch(function () { paintBody(); });
  }
  function closeP() { P.hidden = true; }
  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    P = document.createElement('div'); P.id = 'wxp'; P.hidden = true; P.innerHTML = '<div class="hd"></div><div class="bd"></div>'; document.body.appendChild(P);
    var el = document.querySelector('.wx');
    if (el) { el.setAttribute('role', 'button'); el.tabIndex = 0; el.onclick = function () { P.hidden ? openP() : closeP(); }; el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }; }
    P.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !P.hidden) closeP(); });
    document.addEventListener('click', function (e) { if (!P.hidden && !P.contains(e.target) && !(el && el.contains(e.target))) closeP(); });
    setInterval(function () { if (window.SX_OPEN && !P.hidden) closeP(); }, 400);   // เปิดหน้าน้ำมัน/Amazon เต็มจอ → ปิดแผง
    loadCurrent(); setInterval(loadCurrent, 15 * 60 * 1000);
  }
  window.WeatherPanel = { open: openP, close: closeP, _skyDay: skyDay };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
