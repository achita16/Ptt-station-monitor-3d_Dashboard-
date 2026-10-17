/* น้องมิ่งขวัญ — ผู้ช่วยตอบคำถามจากข้อมูลใน Dashboard (แบบกฎ ไม่ใช้ AI ภายนอก)
 * ตอบเรื่อง: ยอดน้ำมัน, Café Amazon, ราคาน้ำมันหน้าป้าย
 * ข้อมูล: ดึงจากแหล่งเดียวกับหน้า น้ำมัน / Café Amazon (Apps Script ?view=sales / ?view=amz หรือไฟล์ตัวอย่าง)
 * ต่อ AI ภายหลัง: กำหนด window.MINGKWAN_AI = function (question, ctx) { return Promise<string> } ระบบจะเรียกเมื่อกฎตอบไม่ได้ */
(function () {
  'use strict';
  var CFG = window.STATION_CONFIG || {};
  var MN = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var WD = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  var FN = ['G95', 'G91', 'E20', 'Diesel'];

  /* ---------- helpers ---------- */
  function n(x, d) { d = d || 0; return (+x || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
  function di(s) { var m = String(s).match(/(\d+)-(\d+)-(\d+)/); return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5); }
  function dt(d) { return new Date(d * 864e5); }
  function ymd(d) { var x = dt(d); return [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()]; }
  function mk(y, m, d) { return Math.round(Date.UTC(y, m, d) / 864e5); }
  function wdOf(d) { return (d + 3) % 7; }   // 0 = จันทร์
  function sd(d) { var p = ymd(d); return p[2] + ' ' + MN[p[1]] + ' ' + String((p[0] + 543) % 100); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lab(a, b) {
    if (a === b) return 'วันที่ ' + sd(a);
    var x = ymd(a), y = ymd(b);
    if (x[0] === y[0] && x[1] === y[1]) return x[2] + '–' + y[2] + ' ' + MN[y[1]] + ' ' + String((y[0] + 543) % 100);
    return sd(a) + ' – ' + sd(b);
  }
  function dlt(a, b) { return b > 0 ? (a - b) / b * 100 : null; }
  function dtag(p) {
    if (p === null) return '–';
    return '<span style="color:' + (p >= 0 ? '#16a05a' : '#e0443e') + ';font-weight:700">' + (p >= 0 ? '▲ +' : '▼ ') + p.toFixed(1) + '%</span>';
  }
  function today() { return Math.floor((Date.now() + 7 * 36e5) / 864e5); }   // วันที่ปัจจุบันเวลาไทย
  function hh(h) { return ('0' + h).slice(-2) + ':00–' + ('0' + h).slice(-2) + ':59'; }

  /* ---------- data ---------- */
  var FD = { DAY: {}, HRS: {}, LAST: 0, FIRST: 0, ok: false };
  var AD = { DAY: {}, HRS: {}, RD: {}, MENU: [], CATS: [], LAST: 0, FIRST: 0, ok: false };
  var loaded = false, loading = null, SAMPLE = false;

  function ingestFuel(p) {
    FD.DAY = {}; FD.HRS = {};
    (p.daily || []).forEach(function (r) {
      var d = di(r[0]), f = r[1];
      if (!FD.DAY[d]) FD.DAY[d] = [null, null, null, null];
      var a = FD.DAY[d][f] || (FD.DAY[d][f] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      for (var i = 0; i < 11; i++) a[i] += +r[i + 2] || 0;
    });
    (p.hourly || []).forEach(function (r) {
      var d = di(r[0]), a = FD.HRS[d] || (FD.HRS[d] = new Array(24 * 4 * 3).fill(0)), b = (r[1] * 4 + r[2]) * 3;
      a[b] += +r[3] || 0; a[b + 1] += +r[4] || 0; a[b + 2] += +r[5] || 0;
    });
    var k = Object.keys(FD.DAY).map(Number).sort(function (a, b) { return a - b; });
    FD.FIRST = k[0] || 0; FD.LAST = k.length ? k[k.length - 1] : 0; FD.ok = k.length > 0;
  }
  function isDrink(c) { return /^(Juice & Smoothies|NPD|กาแฟ|ชา|ช็อ[คก]โกแลต|นม)$/.test(String(c).trim()); }
  function isBakery(c) { return /เบเกอรี/.test(c) || /^Bakery Factory/.test(c); }
  function supOf(name) {
    if (/\bPAT\b/.test(name)) return 'Patra';
    if (/\bBAAN\b|\bBANN\b/.test(name)) return 'Ban Bakery';
    if (/\bAMZ\b/.test(name)) return 'Bakery Factory';
    return 'อื่นๆ';
  }
  function clean(name) { return String(name).replace(/\s+(PAT|BAAN|BANN|AMZ)\s*$/, ''); }
  function ingestAmz(p) {
    AD.DAY = {}; AD.HRS = {}; AD.RD = {};
    AD.CATS = (p.cats || []).slice();
    AD.MENU = (p.menu || []).map(function (m) { var c = AD.CATS[m[1]] || ''; return { name: m[0], cat: c, drink: isDrink(c), bk: isBakery(c), sup: supOf(m[0]) }; });
    (p.days || []).forEach(function (r) { var d = di(r[0]); AD.DAY[d] = { b: +r[1] || 0, n: +r[2] || 0, cup: 0 }; });
    (p.hours || []).forEach(function (r) {
      var d = di(r[0]), a = AD.HRS[d] || (AD.HRS[d] = new Array(48).fill(0)), h = +r[1];
      a[h * 2] += +r[2] || 0; a[h * 2 + 1] += +r[3] || 0;
    });
    (p.rows || []).forEach(function (r) {
      var d = di(r[0]), m = AD.MENU[r[1]]; if (!m) return;
      (AD.RD[d] || (AD.RD[d] = [])).push([r[1], +r[2] || 0, +r[3] || 0]);
      if (m.drink && AD.DAY[d]) AD.DAY[d].cup += +r[2] || 0;
    });
    var k = Object.keys(AD.DAY).map(Number).sort(function (a, b) { return a - b; });
    AD.FIRST = k[0] || 0; AD.LAST = k.length ? k[k.length - 1] : 0; AD.ok = k.length > 0;
  }
  function getJson(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function ep(view) {
    var u = CFG.API_URL; if (!u) return null;
    return u + (u.indexOf('?') > -1 ? '&' : '?') + 'view=' + view + (CFG.TOKEN ? '&token=' + encodeURIComponent(CFG.TOKEN) : '');
  }
  function load() {
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    SAMPLE = !CFG.API_URL;
    var f = ep('sales'), a = ep('amz');
    loading = Promise.all([
      getJson(f || 'sales-sample.json').then(function (p) { if (p && p.error) throw new Error(p.error); ingestFuel(p); }).catch(function () { }),
      getJson(a || 'amz-sample.json').then(function (p) { if (p && p.error) throw new Error(p.error); ingestAmz(p); }).catch(function () { })
    ]).then(function () { loaded = true; loading = null; });
    return loading;
  }

  /* ---------- วันที่ในคำถาม ---------- */
  function monthIn(q) {   // คืน [{m, idx}] ตามลำดับที่ปรากฏ
    var out = [], i, re;
    for (i = 0; i < 12; i++) {
      re = new RegExp(MF[i].replace(/\./g, '\\.') + '|' + MF[i].slice(0, 5) + '|' + MN[i].replace(/\./g, '\\.'), 'g');
      var m; while ((m = re.exec(q))) out.push({ m: i, at: m.index, len: m[0].length });
    }
    out.sort(function (a, b) { return a.at - b.at; });
    // กรองซ้อนทับ (เช่น "กันยายน" ชนกับ "กัน")
    var res = []; out.forEach(function (o) { if (!res.length || o.at >= res[res.length - 1].at + res[res.length - 1].len) res.push(o); });
    return res;
  }
  function monthRange(y, m, last) { var a = mk(y, m, 1), b = mk(y, m + 1, 0); return { a: a, b: Math.min(b, last) }; }

  /* คืน {a,b,explicit,note,prev:{a,b}|null,two:{a,b}|null} */
  function parseRange(q, last) {
    var t = today(), R = { a: last, b: last, explicit: false, note: '', prev: null, two: null }, m, ly = ymd(last)[0], lm = ymd(last)[1];
    var months = monthIn(q);
    if ((m = q.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?!\d)/))) {                       // 16/10
      var d0 = +m[1], mo0 = +m[2] - 1; if (d0 >= 1 && d0 <= 31 && mo0 >= 0 && mo0 <= 11) { R.a = R.b = mk(ly, mo0, d0); R.explicit = true; return R; }
    }
    if (months.length) {                                                               // 16 ต.ค. / กันยายน / ก.ย. กับ ส.ค.
      var before = q.slice(0, months[0].at), dm = before.match(/(\d{1,2})\s*$/);
      if (dm && months.length === 1 && +dm[1] >= 1 && +dm[1] <= 31) { R.a = R.b = mk(ly, months[0].m, +dm[1]); R.explicit = true; return R; }
      var yy = function (mm) { return mm > lm ? ly - 1 : ly; };
      var r1 = monthRange(yy(months[0].m), months[0].m, last); R.a = r1.a; R.b = r1.b; R.explicit = true;
      if (months.length >= 2) { var r2 = monthRange(yy(months[1].m), months[1].m, last); R.two = r2; }
      return R;
    }
    if (/เมื่อวาน/.test(q)) { R.a = R.b = t - 1; R.explicit = true; return R; }
    if (/วันนี้/.test(q)) { R.a = R.b = t; R.explicit = true; return R; }
    if (/เดือน(ที่แล้ว|ก่อน)/.test(q) && /เดือนนี้/.test(q)) {                              // เดือนนี้ กับ เดือนที่แล้ว
      var c = monthRange(ly, lm, last), pm = lm === 0 ? [ly - 1, 11] : [ly, lm - 1]; var p = monthRange(pm[0], pm[1], mk(pm[0], pm[1] + 1, 0));
      R.a = c.a; R.b = c.b; R.explicit = true; R.two = { a: p.a, b: Math.min(p.b, p.a + (c.b - c.a)) }; R.twoNote = 'เทียบจำนวนวันเท่ากัน'; return R;
    }
    if (/เดือน(ที่แล้ว|ก่อน)/.test(q)) { var pm2 = lm === 0 ? [ly - 1, 11] : [ly, lm - 1]; var r3 = monthRange(pm2[0], pm2[1], mk(pm2[0], pm2[1] + 1, 0)); R.a = r3.a; R.b = r3.b; R.explicit = true; return R; }
    if (/เดือนนี้/.test(q)) { var r4 = monthRange(ly, lm, last); R.a = r4.a; R.b = r4.b; R.explicit = true; R.prevMonth = true; return R; }
    if (/(สัปดาห์|อาทิตย์)(ที่แล้ว|ก่อน)/.test(q)) { var w0 = last - wdOf(last) - 7; R.a = w0; R.b = w0 + 6; R.explicit = true; return R; }
    if (/(สัปดาห์|อาทิตย์)นี้/.test(q)) { R.a = last - wdOf(last); R.b = last; R.explicit = true; return R; }
    if ((m = q.match(/(\d+)\s*วัน/))) { var k = Math.max(1, Math.min(400, +m[1])); R.a = last - k + 1; R.b = last; R.explicit = true; return R; }
    if (/ปีนี้|ทั้งปี|ต้นปี/.test(q)) { R.a = mk(ly, 0, 1); R.b = last; R.explicit = true; return R; }
    return R;
  }
  function hasDay(DAY, a, b) { for (var d = a; d <= b; d++) if (DAY[d]) return true; return false; }
  function prevOf(R) {
    if (R.prev) return R.prev;
    var y = ymd(R.a);
    if (y[2] === 1 && R.b - R.a >= 6) {   // ช่วงที่เริ่มต้นเดือน → เทียบกับเดือนก่อนหน้า จำนวนวันเท่ากัน (ไม่เกินสิ้นเดือน)
      var pm = y[1] === 0 ? [y[0] - 1, 11] : [y[0], y[1] - 1], s0 = mk(pm[0], pm[1], 1), e0 = mk(pm[0], pm[1] + 1, 0);
      return { a: s0, b: Math.min(e0, s0 + (R.b - R.a)) };
    }
    var len = R.b - R.a + 1; return { a: R.a - len, b: R.a - 1 };
  }
  function wantCmp(q) { return /เทียบ|เปรียบ|เพิ่มขึ้น|ลดลง|โต|ต่างจาก|เมื่อเทียบ|vs/i.test(q); }

  /* ---------- ตอบ: ราคาหน้าป้าย ---------- */
  function priceAns() {
    var P = window.getFuelPrices ? window.getFuelPrices() : window.PRICES, rows = [], ok = 0;
    if (P) FN.forEach(function (f) { var v = Number(P[f]); if (isFinite(v) && v > 0) { ok++; rows.push('<li>' + f + ' — <b>' + v.toFixed(2) + '</b> บาท/ลิตร</li>'); } else rows.push('<li>' + f + ' — ยังไม่ได้กรอก</li>'); });
    if (!P || !ok) return 'ตอนนี้ยังไม่มีราคาหน้าป้ายในระบบค่ะ กรอกที่แท็บ <b>prices</b> ใน Sheet ได้เลยนะคะ';
    return '<b>ราคาน้ำมันหน้าป้ายตอนนี้ค่ะ</b><ol style="list-style:none;padding:0;margin:6px 0 2px">' + rows.join('') + '</ol>' + src('แท็บ prices' + (SAMPLE ? ' · ข้อมูลตัวอย่าง' : ''));
  }
  function src(s) { return '<small>ที่มา: ' + esc(s) + '</small>'; }

  /* ---------- ตอบ: น้ำมัน ---------- */
  function fuelSel(q) {
    var s = [];
    if (/g\s?95|แก๊สโซฮอล์\s?95|แก๊สโซฮอล์95/i.test(q)) s.push(0);
    if (/g\s?91|แก๊สโซฮอล์\s?91|แก๊สโซฮอล์91|(^|[^0-9])91([^0-9]|$)/i.test(q)) s.push(1);
    if (/e\s?20|อี\s?20/i.test(q)) s.push(2);
    if (/ดีเซล|diesel/i.test(q)) s.push(3);
    return s.length ? s : null;
  }
  function fSum(a, b, fs) {
    var t = { L: 0, B: 0, C: 0, days: 0 };
    for (var d = a; d <= b; d++) if (FD.DAY[d]) {
      t.days++;
      for (var f = 0; f < 4; f++) if ((!fs || fs.indexOf(f) > -1) && FD.DAY[d][f]) { var r = FD.DAY[d][f]; t.L += r[0]; t.B += r[1]; t.C += r[2] + r[3] + r[4]; }
    }
    return t;
  }
  function fuelAns(q, R) {
    if (!FD.ok) return 'ขอโทษค่ะ ตอนนี้ยังโหลดข้อมูลยอดน้ำมันไม่ได้ ลองรีเฟรชหน้าแล้วถามใหม่นะคะ';
    var fs = fuelSel(q), pre = '', a = R.a, b = R.b;
    if (!hasDay(FD.DAY, a, b)) {
      if (!R.explicit || a === b) { var nd = FD.LAST; pre = 'ยังไม่มีข้อมูลของ' + (a === b ? 'วันที่ ' + sd(a) : 'ช่วงนี้') + ' ค่ะ ใช้วันล่าสุดที่มี (' + sd(nd) + ') แทนนะคะ<br>'; a = b = nd; }
      else return 'ยังไม่มีข้อมูลน้ำมันของ ' + lab(a, b) + ' ค่ะ (ข้อมูลมีตั้งแต่ ' + sd(FD.FIRST) + ' ถึง ' + sd(FD.LAST) + ')';
    }
    if (b > FD.LAST) b = FD.LAST;
    var name = fs ? fs.map(function (i) { return FN[i]; }).join(' + ') : 'น้ำมันทุกชนิด';
    // ชั่วโมงที่ขายดี
    if (/ชั่วโมง|ช่วงเวลา|ช่วงไหน|กี่โมง|ชั่วโมงไหน/.test(q)) {
      var span = (b - a < 6 && !R.explicit) ? { a: FD.LAST - 29, b: FD.LAST } : { a: a, b: b };
      var H = new Array(24).fill(0), dd = 0;
      for (var d = span.a; d <= span.b; d++) if (FD.HRS[d]) { dd++; for (var h = 0; h < 24; h++) for (var f = 0; f < 4; f++) if (!fs || fs.indexOf(f) > -1) { var o = (h * 4 + f) * 3; H[h] += FD.HRS[d][o] + FD.HRS[d][o + 1] + FD.HRS[d][o + 2]; } }
      if (!dd) return 'ยังไม่มีข้อมูลรายชั่วโมงในช่วงนี้ค่ะ';
      var ord = H.map(function (v, i) { return [i, v]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 3), tot = H.reduce(function (s, v) { return s + v; }, 0);
      return '<b>ช่วงเวลาที่มีรถเข้าเติม ' + esc(name) + ' มากสุด</b> (' + lab(span.a, span.b) + ')<ol>' + ord.map(function (x) { return '<li>' + hh(x[0]) + ' — เฉลี่ย ' + n(x[1] / dd, 1) + ' คัน/วัน (' + n(x[1] / tot * 100, 1) + '%)</li>'; }).join('') + '</ol>' + src('ยอดน้ำมันรายชั่วโมง · ' + dd + ' วัน');
    }
    // วันในสัปดาห์
    if (/วันไหน|วันอะไร|วันใน(สัปดาห์|อาทิตย์)/.test(q)) {
      var sp = (b - a < 13 && !R.explicit) ? { a: FD.LAST - 89, b: FD.LAST } : { a: a, b: b }, S = new Array(7).fill(0), C = new Array(7).fill(0);
      for (var x = sp.a; x <= sp.b; x++) if (FD.DAY[x]) { S[wdOf(x)] += fSum(x, x, fs).C; C[wdOf(x)]++; }
      var av = S.map(function (v, i) { return C[i] ? [i, v / C[i]] : null; }).filter(Boolean).sort(function (p, r) { return r[1] - p[1]; });
      if (!av.length) return 'ยังไม่มีข้อมูลพอจะเทียบวันในสัปดาห์ค่ะ';
      return '<b>วันที่มีรถเข้ามากสุด (' + esc(name) + ')</b> เฉลี่ยต่อวัน · ' + lab(sp.a, sp.b) + '<ol>' + av.slice(0, 3).map(function (z) { return '<li>วัน' + WD[z[0]] + ' — ' + n(z[1]) + ' คัน/วัน</li>'; }).join('') + '</ol>น้อยสุดคือวัน' + WD[av[av.length - 1][0]] + ' (' + n(av[av.length - 1][1]) + ' คัน/วัน)' + src('ยอดน้ำมันรายวัน');
    }
    // สรุปยอด
    var T = fSum(a, b, fs), out = pre + '<b>ยอดน้ำมัน ' + esc(name) + ' · ' + lab(a, b) + '</b><br>';
    out += 'ยอดขาย <b>' + n(T.B) + '</b> บาท · <b>' + n(T.L) + '</b> ลิตร · <b>' + n(T.C) + '</b> คัน';
    if (T.days > 1) out += '<br>เฉลี่ย ' + n(T.B / T.days) + ' บาท/วัน (' + T.days + ' วัน)';
    if (!fs) {
      var per = FN.map(function (f, i) { var s = fSum(a, b, [i]); return [f, s]; }).sort(function (x, y) { return y[1].B - x[1].B; });
      out += '<ol style="list-style:none;padding:0;margin:6px 0 2px">' + per.map(function (x) { return '<li>' + x[0] + ' — ' + n(x[1].B) + ' บาท · ' + n(x[1].L) + ' ลิตร · ' + n(x[1].C) + ' คัน</li>'; }).join('') + '</ol>';
    }
    if (R.two && hasDay(FD.DAY, R.two.a, R.two.b)) { var T2 = fSum(R.two.a, R.two.b, fs); out += '<br>เทียบกับ ' + lab(R.two.a, R.two.b) + ': ' + n(T2.B) + ' บาท → ' + dtag(dlt(T.B, T2.B)) + ' (รถ ' + dtag(dlt(T.C, T2.C)) + ')' + (R.twoNote ? ' <small>' + R.twoNote + '</small>' : ''); }
    else if (wantCmp(q) || R.explicit === false || T.days >= 1) {
      var pv = prevOf({ a: a, b: b });
      if (hasDay(FD.DAY, pv.a, pv.b)) { var P = fSum(pv.a, pv.b, fs); out += '<br>เทียบ ' + lab(pv.a, pv.b) + ': ' + dtag(dlt(T.B, P.B)) + ' (รถ ' + dtag(dlt(T.C, P.C)) + ')'; }
    }
    return out + src('ยอดขายน้ำมัน (POS)' + (SAMPLE ? ' · ข้อมูลตัวอย่าง' : '') + ' · ข้อมูลล่าสุด ' + sd(FD.LAST));
  }

  /* ---------- ตอบ: Café Amazon ---------- */
  function aSum(a, b) {
    var t = { b: 0, n: 0, cup: 0, days: 0, cupDays: 0 };
    for (var d = a; d <= b; d++) if (AD.DAY[d]) { var r = AD.DAY[d]; t.days++; t.b += r.b; t.n += r.n; if (AD.RD[d]) { t.cup += r.cup; t.cupDays++; } }
    return t;
  }
  function menuAgg(a, b, test) {
    var M = {}; for (var d = a; d <= b; d++) (AD.RD[d] || []).forEach(function (r) { var m = AD.MENU[r[0]]; if (test && !test(m)) return; var x = M[r[0]] || (M[r[0]] = [0, 0]); x[0] += r[1]; x[1] += r[2]; });
    return Object.keys(M).map(function (k) { return { m: AD.MENU[+k], q: M[k][0], v: M[k][1] }; });
  }
  function amzAns(q, R) {
    if (!AD.ok) return 'ขอโทษค่ะ ตอนนี้ยังโหลดข้อมูล Café Amazon ไม่ได้ ลองรีเฟรชหน้าแล้วถามใหม่นะคะ';
    var pre = '', a = R.a, b = R.b;
    var wide = /เมนู|ขายดี|อันดับ|หมวด|สัดส่วน|เบเกอรี|supplier|ซัพ|ขนม|ชั่วโมง|ช่วงไหน|ช่วงเวลา|กี่โมง|วันไหน|วันอะไร/i.test(q);
    if (wide && !R.explicit) { a = AD.LAST - 29; b = AD.LAST; pre = '(ไม่ได้ระบุช่วง ใช้ 30 วันล่าสุด)<br>'; }
    if (!hasDay(AD.DAY, a, b)) {
      if (!R.explicit || a === b) { a = b = AD.LAST; pre = 'ยังไม่มีข้อมูลของ' + (R.a === R.b ? 'วันที่ ' + sd(R.a) : 'ช่วงนี้') + ' ค่ะ ใช้วันล่าสุดที่มี (' + sd(a) + ') แทนนะคะ<br>'; }
      else return 'ยังไม่มีข้อมูล Café Amazon ของ ' + lab(a, b) + ' ค่ะ (ข้อมูลมีตั้งแต่ ' + sd(AD.FIRST) + ' ถึง ' + sd(AD.LAST) + ')';
    }
    if (b > AD.LAST) b = AD.LAST;
    var title = '<b>Café Amazon · ' + lab(a, b) + '</b><br>';
    var haveItems = false; for (var d = a; d <= b; d++) if (AD.RD[d]) { haveItems = true; break; }

    // ชั่วโมง
    if (/ชั่วโมง|ช่วงไหน|ช่วงเวลา|กี่โมง/.test(q)) {
      var sp = (b - a < 6 && !R.explicit) ? { a: AD.LAST - 89, b: AD.LAST } : { a: a, b: b }, H = new Array(24).fill(0), dd = 0;
      for (var x = sp.a; x <= sp.b; x++) if (AD.HRS[x]) { dd++; for (var h = 0; h < 24; h++) H[h] += AD.HRS[x][h * 2]; }
      if (!dd) return 'ยังไม่มีข้อมูลรายชั่วโมงในช่วงนี้ค่ะ';
      var tot = H.reduce(function (s, v) { return s + v; }, 0), ord = H.map(function (v, i) { return [i, v]; }).sort(function (p, r) { return r[1] - p[1]; }).slice(0, 3);
      return '<b>ช่วงเวลาที่ลูกค้าเข้า Café Amazon มากสุด</b> (' + lab(sp.a, sp.b) + ')<ol>' + ord.map(function (z) { return '<li>' + hh(z[0]) + ' — เฉลี่ย ' + n(z[1] / dd, 1) + ' คน/วัน (' + n(z[1] / tot * 100, 1) + '%)</li>'; }).join('') + '</ol>' + src('บิลรายชั่วโมง · ' + dd + ' วัน');
    }
    // วันในสัปดาห์
    if (/วันไหน|วันอะไร|วันใน(สัปดาห์|อาทิตย์)/.test(q)) {
      var sp2 = (b - a < 13 && !R.explicit) ? { a: AD.LAST - 89, b: AD.LAST } : { a: a, b: b }, S = new Array(7).fill(0), C = new Array(7).fill(0);
      for (var y = sp2.a; y <= sp2.b; y++) if (AD.DAY[y]) { S[wdOf(y)] += AD.DAY[y].b; C[wdOf(y)]++; }
      var av = S.map(function (v, i) { return C[i] ? [i, v / C[i]] : null; }).filter(Boolean).sort(function (p, r) { return r[1] - p[1]; });
      return '<b>วันที่ลูกค้าเยอะที่สุด (Café Amazon)</b> เฉลี่ยต่อวัน · ' + lab(sp2.a, sp2.b) + '<ol>' + av.slice(0, 3).map(function (z) { return '<li>วัน' + WD[z[0]] + ' — ' + n(z[1]) + ' คน/วัน</li>'; }).join('') + '</ol>น้อยสุดคือวัน' + WD[av[av.length - 1][0]] + ' (' + n(av[av.length - 1][1]) + ' คน/วัน)' + src('บิลรายวัน');
    }
    // ซัพพลายเออร์เบเกอรี่
    if (/supplier|ซัพ/i.test(q)) {
      if (!haveItems) return pre + 'ช่วงนี้ยังไม่มีข้อมูลรายการสินค้าค่ะ';
      var SP = {}; menuAgg(a, b, function (m) { return m.bk; }).forEach(function (r) { var s = SP[r.m.sup] || (SP[r.m.sup] = [0, 0]); s[0] += r.q; s[1] += r.v; });
      var sl = Object.keys(SP).sort(function (p, r) { return SP[r][1] - SP[p][1]; }), st = sl.reduce(function (s, k) { return s + SP[k][1]; }, 0);
      return pre + title + '<b>ยอดเบเกอรี่แยกตาม Supplier</b><ol>' + sl.map(function (k) { return '<li>' + esc(k) + ' — ' + n(SP[k][1]) + ' บาท (' + n(SP[k][1] / st * 100, 1) + '%) · ' + n(SP[k][0]) + ' ชิ้น</li>'; }).join('') + '</ol>' + src('รายการสินค้า Café Amazon');
    }
    // เมนูขายดี
    if (/เมนู|ขายดี|อันดับ|เบเกอรี|ขนม/.test(q) && !/หมวด|สัดส่วน/.test(q)) {
      if (!haveItems) return pre + 'ช่วงนี้ยังไม่มีข้อมูลรายการสินค้าค่ะ';
      var bk = /เบเกอรี|ขนม/.test(q), L = menuAgg(a, b, function (m) { return bk ? m.bk : m.drink; }).sort(function (p, r) { return r.q - p.q; }), tq = L.reduce(function (s, r) { return s + r.q; }, 0);
      return pre + title + '<b>' + (bk ? 'เบเกอรี่' : 'เครื่องดื่ม') + 'ขายดี 5 อันดับ</b><ol>' + L.slice(0, 5).map(function (r) { return '<li>' + esc(clean(r.m.name)) + ' — ' + n(r.q) + ' ' + (bk ? 'ชิ้น' : 'แก้ว') + ' (' + n(r.v) + ' บาท)</li>'; }).join('') + '</ol>รวมทั้งช่วง ' + n(tq) + ' ' + (bk ? 'ชิ้น' : 'แก้ว') + src('รายการสินค้า Café Amazon');
    }
    // สัดส่วนหมวด
    if (/หมวด|สัดส่วน/.test(q)) {
      if (!haveItems) return pre + 'ช่วงนี้ยังไม่มีข้อมูลรายการสินค้าค่ะ';
      var CT = {}, ct = 0; menuAgg(a, b).forEach(function (r) { CT[r.m.cat] = (CT[r.m.cat] || 0) + r.v; ct += r.v; });
      var cl = Object.keys(CT).sort(function (p, r) { return CT[r] - CT[p]; });
      return pre + title + '<b>สัดส่วนยอดขายตามหมวด</b><ol>' + cl.slice(0, 6).map(function (k) { return '<li>' + esc(String(k).replace(/\s*\(ให้คะแนน\)\s*/, '')) + ' — ' + n(CT[k] / ct * 100, 1) + '% (' + n(CT[k]) + ' บาท)</li>'; }).join('') + '</ol>' + (cl.length > 6 ? 'และอีก ' + (cl.length - 6) + ' หมวด' : '') + src('รายการสินค้า Café Amazon');
    }
    // สรุปยอด
    var T = aSum(a, b), out = pre + title;
    out += 'ยอดขาย <b>' + n(T.n) + '</b> บาท · ลูกค้า <b>' + n(T.b) + '</b> คน (1 บิล = 1 คน) · เฉลี่ย ' + n(T.b ? T.n / T.b : 0) + ' บาท/บิล';
    if (T.cupDays) out += '<br>เครื่องดื่ม <b>' + n(T.cup) + '</b> แก้ว' + (T.cupDays < T.days ? ' <small>(มีรายการสินค้า ' + T.cupDays + ' จาก ' + T.days + ' วัน)</small>' : '');
    if (T.days > 1) out += '<br>เฉลี่ย ' + n(T.n / T.days) + ' บาท/วัน (' + T.days + ' วัน)';
    if (R.two && hasDay(AD.DAY, R.two.a, R.two.b)) { var T2 = aSum(R.two.a, R.two.b); out += '<br>เทียบกับ ' + lab(R.two.a, R.two.b) + ': ' + n(T2.n) + ' บาท → ' + dtag(dlt(T.n, T2.n)) + ' (ลูกค้า ' + dtag(dlt(T.b, T2.b)) + (T.cupDays && T2.cupDays ? ' · แก้ว ' + dtag(dlt(T.cup, T2.cup)) : '') + ')' + (R.twoNote ? ' <small>' + R.twoNote + '</small>' : ''); }
    else {
      var pv = prevOf({ a: a, b: b });
      if (hasDay(AD.DAY, pv.a, pv.b)) { var P = aSum(pv.a, pv.b); out += '<br>เทียบ ' + lab(pv.a, pv.b) + ': ' + dtag(dlt(T.n, P.n)) + ' (ลูกค้า ' + dtag(dlt(T.b, P.b)) + ')'; }
    }
    return out + src('ยอดขาย Café Amazon' + (SAMPLE ? ' · ข้อมูลตัวอย่าง' : '') + ' · ข้อมูลล่าสุด ' + sd(AD.LAST));
  }

  /* ---------- ตัดสินหัวข้อ ---------- */
  var HELP = 'ตอนนี้หนูตอบได้เรื่อง<br>• <b>ยอดน้ำมัน</b> (ยอด/ลิตร/จำนวนรถ แยกชนิด เทียบช่วง ช่วงเวลาและวันที่ขายดี)<br>• <b>Café Amazon</b> (ยอด/ลูกค้า/แก้ว เมนูขายดี เบเกอรี่ Supplier สัดส่วนหมวด)<br>• <b>ราคาน้ำมันหน้าป้าย</b><br>ลองถามแบบ “ยอดน้ำมันเมื่อวาน” หรือ “เมนูขายดี Amazon เดือนกันยายน” ได้เลยค่ะ';
  function answer(q0) {
    var q = String(q0 || '').trim().toLowerCase();
    if (!q) return null;
    if (/^(สวัสดี|หวัดดี|hello|hi)/.test(q) && q.length < 25) return 'สวัสดีค่า ผู้บริหาร 💙 อยากรู้เรื่องอะไรถามได้เลยนะคะ';
    if (/ขอบคุณ|ขอบใจ|thanks/.test(q)) return 'ยินดีค่า 💙 มีอะไรถามต่อได้เสมอนะคะ';
    if (/เซเว่น|7-?eleven|เซเว่น|seven/.test(q)) return 'ข้อมูล 7-Eleven ยังไม่ได้เชื่อมเข้าระบบค่ะ เดี๋ยวเพิ่มให้เร็วๆ นี้นะคะ ตอนนี้ถามเรื่องน้ำมัน Café Amazon และราคาหน้าป้ายได้ค่ะ';
    var isP = /ราคา|ป้าย/.test(q) && !/ยอด|เมนู|ลูกค้า|ต่อบิล/.test(q);
    if (isP) return priceAns();
    var amz = /amazon|อเมซอน|คาเฟ่|กาแฟ|แก้ว|เมนู|เบเกอรี|เครื่องดื่ม|ลูกค้า|บิล|supplier|ซัพ|ขนม|หมวด/.test(q);
    var fuel = /น้ำมัน|ลิตร|รถ|คัน|g\s?95|g\s?91|e\s?20|ดีเซล|diesel|แก๊ส|ปั๊ม|ปตท/.test(q);
    if (!amz && !fuel) {
      if (/ยอด|ขายได้|รายได้|สรุป|ภาพรวม/.test(q)) { amz = fuel = true; } else return null;
    }
    var out = [];
    if (fuel && !(amz && /amazon|อเมซอน|แก้ว|เมนู|เบเกอรี|กาแฟ|คาเฟ่/.test(q))) { var Rf = parseRange(q, FD.LAST || AD.LAST); out.push(fuelAns(q, Rf)); }
    if (amz) { var Ra = parseRange(q, AD.LAST || FD.LAST); out.push(amzAns(q, Ra)); }
    return out.join('<hr style="border:0;border-top:1px solid #e6edf6;margin:9px 0">');
  }

  /* ---------- UI ---------- */
  var CSS = '#mk{position:fixed;right:30px;bottom:88px;z-index:40;font-family:"Noto Sans Thai","Sarabun",sans-serif;cursor:pointer}' +
    '#mk .bub{position:absolute;right:120px;bottom:90px;background:#fff;border-radius:16px 16px 4px 16px;padding:10px 14px;font-size:13.5px;box-shadow:0 8px 24px rgba(20,60,120,.22);white-space:nowrap;color:#17233a;animation:mkb 6s ease-in-out infinite}' +
    '@keyframes mkb{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}' +
    '#mk .av{width:130px;height:170px;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 6px 10px rgba(11,47,122,.35));transition:transform .2s}#mk:hover .av{transform:translateY(-4px) scale(1.03)}' +
    '#mk .av img{height:170px;width:auto;display:block}' +
    '#mk .dot{position:absolute;right:6px;top:4px;width:16px;height:16px;border-radius:50%;background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff}' +
    '#cp{position:fixed;right:22px;bottom:22px;width:min(390px,calc(100vw - 24px));height:min(610px,calc(100vh - 44px));background:#fff;border-radius:22px;box-shadow:0 20px 60px rgba(11,26,58,.4);z-index:41;display:flex;flex-direction:column;overflow:hidden;font-family:"Noto Sans Thai","Sarabun",sans-serif;color:#17233a}' +
    '#cp[hidden],#mk[hidden]{display:none}' +
    '#cp .hd{background:linear-gradient(135deg,#1e78e6,#0b2f7a);padding:12px 16px;display:flex;align-items:center;gap:12px;color:#fff}' +
    '#cp .hd b{font-size:17px;display:block}#cp .hd span{font-size:12px;opacity:.92}#cp .hd .x{margin-left:auto;font-size:20px;opacity:.9;cursor:pointer;background:none;border:0;color:#fff;padding:4px 8px}' +
    '#cp .hd .face{width:54px;height:54px;background:#fff;border-radius:50%;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.2);flex:none}#cp .hd .face img{width:92px;margin-top:-4px}' +
    '#cp .bd{flex:1;overflow-y:auto;padding:14px 14px 6px;background:#f6f8fc;display:flex;flex-direction:column;gap:10px}' +
    '#cp .m{max-width:88%;padding:9px 13px;border-radius:16px;font-size:13.5px;line-height:1.55;word-break:break-word}' +
    '#cp .m.u{align-self:flex-end;background:linear-gradient(135deg,#1e78e6,#0b4bb3);color:#fff;border-bottom-right-radius:4px}' +
    '#cp .m.b{align-self:flex-start;background:#fff;box-shadow:0 2px 8px rgba(27,58,106,.1);border-bottom-left-radius:4px}' +
    '#cp .m.b ol{margin:5px 0 3px 18px;padding:0}#cp .m.b small{display:block;color:#8593a9;margin-top:6px;font-size:11px}#cp .m.b li small{display:inline;margin:0}' +
    '#cp .chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;background:#f6f8fc}#cp .chips button{font:inherit;font-size:12px;background:#fff;border:1px solid #dbe5f3;border-radius:16px;padding:5px 11px;color:#31415f;cursor:pointer}#cp .chips button:hover{background:#eaf2ff;border-color:#9cc2f5}' +
    '#cp .in{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e6edf6}#cp .in input{flex:1;background:#eef3fa;border:0;border-radius:20px;padding:10px 14px;font:inherit;font-size:13px;color:#17233a;outline:none;min-width:0}' +
    '#cp .in button{width:40px;height:40px;border-radius:50%;border:0;background:linear-gradient(135deg,#1e78e6,#0b4bb3);color:#fff;font-size:17px;cursor:pointer;flex:none}' +
    '#cp .typing{align-self:flex-start;background:#fff;border-radius:16px;padding:10px 14px;box-shadow:0 2px 8px rgba(27,58,106,.1);letter-spacing:3px;color:#8593a9}' +
    '@media(max-width:700px){#mk{right:8px;bottom:70px}#mk .av,#mk .av img{height:110px;width:auto}#mk .bub{right:70px;bottom:60px;font-size:12px}}';
  var CHIPS = ['ยอดน้ำมันเมื่อวาน', 'ราคาน้ำมันหน้าป้าย', 'เมนูขายดี Amazon เดือนนี้', 'ช่วงเวลาที่ลูกค้า Amazon เยอะ', 'ยอด Amazon เทียบเดือนนี้กับเดือนที่แล้ว', 'น้ำมันวันไหนรถเข้าเยอะ'];
  var mkEl, cpEl, bd, inp, opened = false, busy = false;

  function addMsg(html, cls) {
    var d = document.createElement('div'); d.className = 'm ' + cls; d.innerHTML = html; bd.appendChild(d); bd.scrollTop = bd.scrollHeight; return d;
  }
  function ask(q) {
    q = String(q || '').trim(); if (!q || busy) return;
    busy = true; addMsg(esc(q), 'u'); inp.value = '';
    var ty = document.createElement('div'); ty.className = 'typing'; ty.textContent = '● ● ●'; bd.appendChild(ty); bd.scrollTop = bd.scrollHeight;
    load().then(function () { return new Promise(function (r) { setTimeout(r, 350); }); }).then(function () {
      var a; try { a = answer(q); } catch (e) { a = 'ขอโทษค่ะ หนูประมวลผลคำถามนี้ไม่สำเร็จ ลองถามใหม่อีกครั้งนะคะ'; }
      if (a === null && typeof window.MINGKWAN_AI === 'function') {
        return Promise.resolve(window.MINGKWAN_AI(q, { fuel: FD, amz: AD })).then(function (t) { return t ? esc(t) : HELP; }).catch(function () { return HELP; });
      }
      return a === null ? 'ขอโทษค่ะ หนูยังไม่เข้าใจคำถามนี้<br><br>' + HELP : a;
    }).then(function (a) { ty.remove(); addMsg(a, 'b'); busy = false; });
  }
  function open() {
    mkEl.hidden = true; cpEl.hidden = false; opened = true;
    if (!bd.children.length) addMsg('สวัสดีค่า ผู้บริหาร 💙 หนูคือน้องมิ่งขวัญ ถามยอดขายน้ำมัน Café Amazon หรือราคาน้ำมันหน้าป้ายได้เลยนะคะ', 'b');
    load(); setTimeout(function () { inp.focus(); }, 50);
  }
  function close() { cpEl.hidden = true; mkEl.hidden = false; opened = false; var dot = mkEl.querySelector('.dot'); if (dot) dot.style.display = 'none'; }
  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    mkEl = document.createElement('div'); mkEl.id = 'mk'; mkEl.setAttribute('role', 'button'); mkEl.setAttribute('aria-label', 'เปิดแชทกับน้องมิ่งขวัญ');
    mkEl.innerHTML = '<div class="bub">สวัสดีค่า ผู้บริหาร 💙 อยากรู้ยอดอะไร ถามได้เลย!</div><div class="av"><img src="mingkwan.png" alt="น้องมิ่งขวัญ"></div><div class="dot">1</div>';
    mkEl.onclick = open;
    cpEl = document.createElement('div'); cpEl.id = 'cp'; cpEl.hidden = true;
    cpEl.innerHTML = '<div class="hd"><div class="face"><img src="mingkwan.png" alt=""></div><div><b>น้องมิ่งขวัญ</b><span>● ออนไลน์ · ตอบจากข้อมูลใน Dashboard</span></div><button class="x" type="button" aria-label="ปิด">✕</button></div><div class="bd"></div><div class="chips"></div><form class="in"><input type="text" placeholder="พิมพ์คำถามที่นี่…" autocomplete="off"><button type="submit" aria-label="ส่ง">➤</button></form>';
    document.body.appendChild(mkEl); document.body.appendChild(cpEl);
    bd = cpEl.querySelector('.bd'); inp = cpEl.querySelector('input');
    cpEl.querySelector('.x').onclick = close;
    cpEl.querySelector('form').onsubmit = function (e) { e.preventDefault(); ask(inp.value); };
    var ch = cpEl.querySelector('.chips');
    CHIPS.forEach(function (t) { var b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = function () { ask(t); }; ch.appendChild(b); });
    setInterval(function () {   // ซ่อนเมื่อเปิดหน้ารายละเอียด (น้ำมัน / Amazon) เต็มจอ
      var hide = !!window.SX_OPEN; mkEl.style.display = hide ? 'none' : ''; cpEl.style.display = hide ? 'none' : '';
    }, 300);
  }
  window.Mingkwan = { ask: function (q) { return load().then(function () { return answer(q); }); }, open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
