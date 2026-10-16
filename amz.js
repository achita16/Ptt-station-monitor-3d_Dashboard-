/* หน้า "ยอดขาย Café Amazon" — กดแท็บ "Café Amazon" เพื่อเปิด
 * ข้อมูล: Apps Script ?view=amz (แท็บ amz_daily / amz_hourly / amz_items) ถ้ายังไม่ตั้ง API_URL จะใช้ amz-sample.json
 * 1 บิล = 1 คน · แก้ว = หมวด Juice & Smoothies, NPD, กาแฟ, ชา, ช็อกโกแลต, นม · Supplier ดูจากท้ายชื่อเมนู (PAT / BAAN / AMZ)
 * ทุกการ์ดกดขยาย (⤢) ได้ และมีตัวเลือกช่วงวันที่/เรียงลำดับของตัวเอง */
(function () {
  'use strict';
  var CFG = window.STATION_CONFIG || {};
  var DN = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'], DS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  var MN = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var PAL = ['#6d4c41', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#94a3b8'];
  var SUPS = ['Patra', 'Ban Bakery', 'Bakery Factory', 'อื่นๆ'], SUPC = { 'Patra': '#f97316', 'Ban Bakery': '#3b82f6', 'Bakery Factory': '#14b8a6', 'อื่นๆ': '#94a3b8' };
  var SUPT = { 'Patra': 'PAT', 'Ban Bakery': 'BAAN', 'Bakery Factory': 'AMZ', 'อื่นๆ': '' };
  var ACC = ['#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6'];

  /* ---------- helpers ---------- */
  function n(x, d) { d = d || 0; return (+x || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
  function di(s) { var m = String(s).match(/(\d+)-(\d+)-(\d+)/); return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5); }
  function dt(d) { return new Date(d * 864e5); }
  function iso(d) { var x = dt(d); return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2); }
  function wdOf(d) { return (d + 3) % 7; }
  function sd(d) { var x = dt(d); return x.getUTCDate() + ' ' + MN[x.getUTCMonth()]; }
  function th(d) { var x = dt(d); return ('0' + x.getUTCDate()).slice(-2) + '/' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '/' + (x.getUTCFullYear() + 543); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nice(v) {
    if (!(v > 0)) return 1;
    var e = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  function kfmt(v) { return v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(Math.round(v * 10) / 10); }
  function dlt(a, b) { return b > 0 ? (a - b) / b * 100 : null; }
  function dtag(p, suf) {
    if (p === null) return '<div class="sx-d">–</div>';
    return '<div class="sx-d ' + (p >= 0 ? 'up' : 'dn') + '">' + (p >= 0 ? '▲ +' : '▼ ') + p.toFixed(1) + '%' + (suf === false ? '' : '<small>เทียบช่วงก่อนหน้า</small>') + '</div>';
  }
  function tip(h) { return ' data-tip="' + esc(h) + '"'; }
  function noData(msg) { return '<div class="sx-empty">' + (msg || 'ไม่มีข้อมูลในช่วงที่เลือก') + '</div>'; }
  function shortCat(c) { return String(c).replace(/\s*\(ให้คะแนน\)\s*/, ''); }
  function supOf(name) {
    if (/\bPAT\b/.test(name)) return 'Patra';
    if (/\bBAAN\b|\bBANN\b/.test(name)) return 'Ban Bakery';
    if (/\bAMZ\b/.test(name)) return 'Bakery Factory';
    return 'อื่นๆ';
  }
  function cleanName(name) { return String(name).replace(/\s+(PAT|BAAN|BANN|AMZ)\s*$/, ''); }
  function isDrink(c) { return /^(Juice & Smoothies|NPD|กาแฟ|ชา|ช็อ[คก]โกแลต|นม)$/.test(String(c).trim()); }
  function isBakery(c) { return /เบเกอรี/.test(c) || /^Bakery Factory/.test(c); }
  function supTag(sp) { return SUPT[sp] ? '<span class="ax-tg" style="background:' + SUPC[sp] + '">' + SUPT[sp] + '</span>' : ''; }

  /* ---------- data ---------- */
  var ITEMLAST = 0, DAY = {}, HRS = {}, RD = {}, MENU = [], CATS = [], BKC = [], DIS = [], FIRST = 0, LATEST = 0, HMIN = 7, HMAX = 18, READY = false;
  function ingest(p) {
    DAY = {}; HRS = {}; RD = {}; DIS = [];
    CATS = (p.cats || []).slice();
    MENU = (p.menu || []).map(function (m) { var c = CATS[m[1]] || ''; return { name: m[0], cat: m[1], catName: c, sup: supOf(m[0]), drink: isDrink(c), bk: isBakery(c) }; });
    var rk = function (i) { var c = CATS[i]; return /เบเกอรีสด/.test(c) ? 0 : /เบเกอรีแห้ง/.test(c) ? 1 : /Warm/.test(c) ? 2 : /Fresh/.test(c) ? 3 : /Ambient/.test(c) ? 4 : 5; };
    BKC = [[], [], [], [], []];   // 5 กลุ่มหมวดเบเกอรี่ (OEM สดรวมรายการเทศกาล)
    CATS.forEach(function (c, i) { if (isBakery(c)) BKC[Math.min(4, rk(i))].push(i); });
    var mk = function (d) { return DAY[d] || (DAY[d] = { b: 0, n: 0, cup: 0 }); };
    (p.days || []).forEach(function (r) { var d = di(r[0]), o = mk(d); o.b += +r[1] || 0; o.n += +r[2] || 0; });
    HMIN = 24; HMAX = -1;
    (p.hours || []).forEach(function (r) {
      var d = di(r[0]), a = HRS[d] || (HRS[d] = new Array(48).fill(0)), h = +r[1];
      a[h * 2] += +r[2] || 0; a[h * 2 + 1] += +r[3] || 0;
      if ((+r[2]) > 0) { if (h < HMIN) HMIN = h; if (h > HMAX) HMAX = h; }
    });
    if (HMAX < 0) { HMIN = 7; HMAX = 18; }
    (p.rows || []).forEach(function (r) {
      var d = di(r[0]), m = MENU[r[1]]; if (!m) return;
      (RD[d] || (RD[d] = [])).push([r[1], +r[2] || 0, +r[3] || 0]);
      if (m.drink) mk(d).cup += +r[2] || 0;
    });
    ITEMLAST = 0; Object.keys(RD).forEach(function (k) { if (+k > ITEMLAST) ITEMLAST = +k; });
    DIS = Object.keys(DAY).map(Number).sort(function (a, b) { return a - b; });
    FIRST = DIS[0] || 0; LATEST = DIS.length ? DIS[DIS.length - 1] : 0;
    READY = DIS.length > 0;
  }
  function prevOf(st) { var len = st.to - st.from + 1; return { from: st.from - len, to: st.from - 1 }; }
  function haveData(a, b) { for (var d = a; d <= b; d++) if (DAY[d]) return true; return false; }
  function daysIn(a, b, test) { var c = 0; for (var d = a; d <= b; d++) if (DAY[d] && (!test || test(d))) c++; return c; }
  function totDay(a, b, f) { var t = 0; for (var d = a; d <= b; d++) if (DAY[d]) t += DAY[d][f]; return t; }
  function dayVal(d, u) {
    var r = DAY[d]; if (!r) return null;
    if (u === 'cup' && !RD[d]) return null;   // วันที่ยังไม่มีรายการสินค้า
    return u === 'cup' ? r.cup : u === 'baht' ? r.n : u === 'cust' ? r.b : (r.b ? r.n / r.b : null);
  }
  // รวมตามเมนู: { idx: [qty, net] }
  function menuAgg(a, b, test) {
    var M = {};
    for (var d = a; d <= b; d++) (RD[d] || []).forEach(function (r) {
      if (test && !test(MENU[r[0]])) return;
      var x = M[r[0]] || (M[r[0]] = [0, 0]); x[0] += r[1]; x[1] += r[2];
    });
    return M;
  }
  function catAgg(a, b) {
    var C = {};
    for (var d = a; d <= b; d++) (RD[d] || []).forEach(function (r) {
      var c = MENU[r[0]].cat, x = C[c] || (C[c] = [0, 0]); x[0] += r[1]; x[1] += r[2];
    });
    return C;
  }
  function sumM(M) { var q = 0, v = 0; for (var k in M) { q += M[k][0]; v += M[k][1]; } return [q, v]; }

  /* ---------- state ---------- */
  var G = { from: 0, to: 0, cmp: true, pre: '30' };
  function clone(s) { return { from: s.from, to: s.to, cmp: s.cmp, pre: s.pre }; }
  function setPre(st, p) {
    st.pre = p;
    if (p === 'all') { st.from = FIRST; st.to = LATEST; }
    else if (/^\d+$/.test(p)) { st.to = LATEST; st.from = Math.max(FIRST, LATEST - (+p) + 1); }
  }

  /* ---------- SVG blocks ---------- */
  function yAxis(w, pl, pr, pt, h, pb, mx, fmt, ticks) {
    var s = '', Y = function (v) { return pt + (h - pt - pb) * (1 - v / mx); };
    for (var g = 0; g <= ticks; g++) { var v = mx * g / ticks; s += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e6edf6"/><text x="' + (pl - 7) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="#6a7a94">' + fmt(v) + '</text>'; }
    return s;
  }
  function legendHtml(items) {
    return '<div class="sx-lg">' + items.map(function (i) { return i.dash ? '<span><i class="sx-dash"></i>' + i.name + '</span>' : '<span><i class="sx-dot" style="background:' + i.c + '"></i>' + i.name + '</span>'; }).join('') + '</div>';
  }
  var UL = { cup: 'แก้ว', baht: 'บาท', cust: 'คน', tk: 'บาท/คน' };
  var DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="axO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ff5e62"/></linearGradient>' +
    '<linearGradient id="axI" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c8cff"/><stop offset="1" stop-color="#4f46e5"/></linearGradient>' +
    '<linearGradient id="axT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs></svg>';

  /* ---------- chart definitions ---------- */
  var C = {};

  // 1) ยอดขายรายวัน
  C.area = {
    title: 'ยอดขายรายวัน', cls: 'wide',
    opts: function () { return [{ k: 'unit', ch: [['cup', 'แก้ว'], ['baht', 'บาท'], ['cust', 'คน'], ['tk', 'ยอด/คน']] }]; },
    def: { unit: 'cup' },
    render: function (st, o, W, H, big) {
      var u = o.unit, N = st.to - st.from + 1, pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var cur = [], prv = [], i;
      for (i = 0; i < N; i++) { cur.push(dayVal(st.from + i, u)); prv.push(usePrev ? dayVal(pv.from + i, u) : null); }
      var vs = cur.filter(function (v) { return v !== null; });
      if (!vs.length) return { html: noData() };
      var all = vs.concat(prv.filter(function (v) { return v !== null; }));
      var pl = 52, pr = 12, pt = 14, pb = 28, mx = nice(Math.max.apply(null, all) * 1.08), Y = function (v) { return pt + (H - pt - pb) * (1 - v / mx); };
      var step = (W - pl - pr) / N, X = function (k) { return pl + step * (k + .5); }, bw = Math.min(26, Math.max(2, step * .66));
      var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + yAxis(W, pl, pr, pt, H, pb, mx, u === 'baht' ? kfmt : function (v) { return n(v); }, 4);
      var bars = N <= 62, p = '';
      cur.forEach(function (v, k) { if (v === null) return; if (bars) s += '<rect x="' + (X(k) - bw / 2) + '" y="' + Y(v) + '" width="' + bw + '" height="' + Math.max(0, Y(0) - Y(v)) + '" fill="url(#axO)" rx="' + (bw > 6 ? 5 : 1) + '"/>'; else p += (p ? 'L' : 'M') + X(k) + ',' + Y(v); });
      if (!bars) s += '<path d="' + p + '" fill="none" stroke="#ff7a4a" stroke-width="2"/>';
      if (usePrev) {
        var q = '', pen = false;
        prv.forEach(function (v, k) { if (v === null) { pen = false; return; } q += (pen ? 'L' : 'M') + X(k) + ',' + Y(v); pen = true; });
        s += '<path d="' + q + '" fill="none" stroke="#8593a9" stroke-width="1.8" stroke-dasharray="5 4"/>';
      }
      var av = vs.reduce(function (a, b) { return a + b; }, 0) / vs.length;
      s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(av) + '" y2="' + Y(av) + '" stroke="#17233a" stroke-opacity=".35" stroke-dasharray="2 4"/><text x="' + (W - pr) + '" y="' + (Y(av) - 5) + '" text-anchor="end" font-size="11" font-weight="700" fill="#17233a">เฉลี่ย ' + n(av, u === 'tk' ? 0 : 1).replace(/\.0$/, '') + '</text>';
      var every = Math.max(1, Math.ceil(N / Math.floor((W - pl) / 62)));
      cur.forEach(function (v, k) { if (k % every === 0) s += '<text x="' + X(k) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#6a7a94">' + sd(st.from + k) + '</text>'; });
      cur.forEach(function (v, k) {
        var d = st.from + k, h = '<b>' + DN[wdOf(d)] + ' ' + th(d) + '</b><br>' + (v === null ? 'ไม่มีข้อมูล' : n(v, u === 'tk' ? 0 : 0) + ' ' + UL[u]);
        if (usePrev && prv[k] !== null) h += '<br>ก่อนหน้า (' + sd(pv.from + k) + ') ' + n(prv[k]) + ' ' + UL[u];
        if (DAY[d]) h += '<br><span style="opacity:.7">' + n(DAY[d].b) + ' คน · ' + n(DAY[d].cup) + ' แก้ว · ' + n(DAY[d].n) + ' บาท</span>';
        s += '<rect x="' + (X(k) - step / 2) + '" y="' + pt + '" width="' + step + '" height="' + (H - pt - pb) + '" fill="transparent"' + tip(h) + '/>';
      });
      return { html: s + '</svg>' + legendHtml([{ c: '#ff7a4a', name: 'ช่วงนี้' }].concat(usePrev ? [{ dash: 1, name: 'ช่วงก่อนหน้า' }] : [])) };
    }
  };

  // 2) แต่ละวันในสัปดาห์
  function wkCalc(a, b, u) {
    var cnt = [0, 0, 0, 0, 0, 0, 0], sum = [0, 0, 0, 0, 0, 0, 0], d, w, v;
    for (d = a; d <= b; d++) { if (!DAY[d]) continue; v = dayVal(d, u); if (v === null) continue; w = wdOf(d); cnt[w]++; sum[w] += v; }
    return { cnt: cnt, avg: sum.map(function (s, i) { return cnt[i] ? s / cnt[i] : 0; }) };
  }
  C.wk = {
    title: 'แต่ละวันในสัปดาห์', sub: 'จันทร์–อาทิตย์ · ค่าเฉลี่ยต่อวัน',
    opts: function () { return [{ k: 'unit', ch: [['cust', 'คน'], ['baht', 'บาท'], ['cup', 'แก้ว']] }]; },
    def: { unit: 'cust' },
    render: function (st, o, W, H) {
      var u = o.unit, cur = wkCalc(st.from, st.to, u), pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to), prv = usePrev ? wkCalc(pv.from, pv.to, u) : null;
      if (!cur.cnt.some(function (c) { return c; })) return { html: noData() };
      var mxv = Math.max.apply(null, cur.avg.concat(prv ? prv.avg : [])), pl = 48, pr = 8, pt = 20, pb = 40, mx = nice(mxv * 1.12), Y = function (v) { return pt + (H - pt - pb) * (1 - v / mx); };
      var gap = (W - pl - pr) / 7, bw = Math.min(46, gap * .62), best = -1, low = -1, i;
      for (i = 0; i < 7; i++) if (cur.cnt[i]) { if (best < 0 || cur.avg[i] > cur.avg[best]) best = i; if (low < 0 || cur.avg[i] < cur.avg[low]) low = i; }
      var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + yAxis(W, pl, pr, pt, H, pb, mx, u === 'baht' ? kfmt : function (v) { return n(v); }, 4);
      for (i = 0; i < 7; i++) {
        var x = pl + gap * i + (gap - bw) / 2, v = cur.avg[i], dig = u === 'baht' ? 0 : 0;
        var h = '<b>วัน' + DN[i] + '</b> · ' + cur.cnt[i] + ' วัน<br>เฉลี่ย ' + n(v, dig) + ' ' + UL[u] + '/วัน' + (prv && prv.cnt[i] ? '<br>ก่อนหน้า ' + n(prv.avg[i], dig) : '');
        if (cur.cnt[i]) s += '<rect x="' + x + '" y="' + Y(v) + '" width="' + bw + '" height="' + Math.max(0, Y(0) - Y(v)) + '" fill="url(#axI)" opacity="' + (i === best ? 1 : .72) + '" rx="7"' + tip(h) + '/>' + (Y(0) - Y(v) > 20 ? '<text x="' + (x + bw / 2) + '" y="' + (Y(v) + 16) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" pointer-events="none">' + (u === 'baht' ? kfmt(v) : n(v)) + '</text>' : '');
        if (prv && prv.cnt[i]) s += '<line x1="' + (x - 3) + '" x2="' + (x + bw + 3) + '" y1="' + Y(prv.avg[i]) + '" y2="' + Y(prv.avg[i]) + '" stroke="#17233a" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>';
        s += '<text x="' + (x + bw / 2) + '" y="' + (H - 21) + '" text-anchor="middle" font-size="12" fill="' + (i >= 5 ? '#e0603a' : '#31415f') + '">' + DS[i] + '</text><text x="' + (x + bw / 2) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="10" fill="#8593a9">(' + cur.cnt[i] + ' วัน)</text>';
      }
      var note = '<div class="sx-note">📌 <b>วัน' + DN[best] + '</b> มากสุด ' + n(cur.avg[best]) + ' ' + UL[u] + '/วัน · น้อยสุด <b>วัน' + DN[low] + '</b> ' + n(cur.avg[low]) + '/วัน</div>';
      return { html: s + '</svg>' + legendHtml([{ c: '#6366f1', name: 'ช่วงนี้' }].concat(prv ? [{ dash: 1, name: 'ช่วงก่อนหน้า' }] : [])) + note };
    }
  };

  // 3) ลูกค้ารายชั่วโมง (+ตารางรายละเอียด/เรียงลำดับเมื่อขยาย)
  function hrCalc(a, b, wd) {
    var test = function (d) { var w = wdOf(d); return wd === 'wd' ? w < 5 : wd === 'we' ? w >= 5 : true; };
    var nd = daysIn(a, b, test), R = [], h, d;
    for (h = HMIN; h <= HMAX; h++) {
      var bills = 0, net = 0;
      for (d = a; d <= b; d++) if (DAY[d] && test(d) && HRS[d]) { bills += HRS[d][h * 2]; net += HRS[d][h * 2 + 1]; }
      R.push({ h: h, b: bills, n: net, c: nd ? bills / nd : 0, nn: nd ? net / nd : 0 });
    }
    return { nd: nd, R: R };
  }
  C.hr = {
    title: 'ลูกค้ารายชั่วโมง', sub: 'เฉลี่ยคน/วัน',
    opts: function (big) {
      var o = [{ k: 'unit', ch: [['cust', 'คน'], ['baht', 'บาท']] }];
      if (big) o.push({ k: 'wd', l: 'วัน', ch: [['all', 'ทุกวัน'], ['wd', 'จ.–ศ.'], ['we', 'ส.–อา.']] }, { k: 'sort', l: 'เรียงตาม', ch: [['h', 'ชั่วโมง'], ['c', 'ลูกค้า'], ['n', 'ยอดขาย'], ['tk', 'ยอด/คน'], ['d', '% เปลี่ยนแปลง']], dir: 1 });
      return o;
    },
    def: { unit: 'cust', wd: 'all', sort: 'c', dir: 'desc' },
    render: function (st, o, W, H, big) {
      var cur = hrCalc(st.from, st.to, o.wd), pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to), prv = usePrev ? hrCalc(pv.from, pv.to, o.wd) : null;
      if (!cur.nd) return { html: noData() };
      var u = o.unit, V = function (r) { return u === 'baht' ? r.nn : r.c; };
      var cw = big ? Math.floor(W * .42) : W, ch = big ? 330 : H;
      var all = cur.R.map(V).concat(prv ? prv.R.map(V) : []), mx = nice(Math.max.apply(null, all) * 1.1), pl = 42, pr = 8, pt = 10, pb = 26, N = cur.R.length;
      var X = function (i) { return pl + (cw - pl - pr) * (i + .5) / N; }, Y = function (v) { return pt + (ch - pt - pb) * (1 - v / mx); }, bw = Math.min(30, (cw - pl - pr) / N * .66);
      var s = '<svg width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">' + yAxis(cw, pl, pr, pt, ch, pb, mx, u === 'baht' ? kfmt : function (v) { return n(v, v < 10 && v % 1 ? 1 : 0); }, 4);
      cur.R.forEach(function (r, i) {
        var h = '<b>' + ('0' + r.h).slice(-2) + ':00–' + ('0' + (r.h + 1)).slice(-2) + ':00</b><br>' + n(r.c, 1) + ' คน/วัน · ' + n(r.nn) + ' บาท/วัน' + (prv ? '<br>ก่อนหน้า ' + n(prv.R[i].c, 1) + ' คน/วัน' : '');
        s += '<rect x="' + (X(i) - bw / 2) + '" y="' + Y(V(r)) + '" width="' + bw + '" height="' + Math.max(0, Y(0) - Y(V(r))) + '" fill="url(#axT)" rx="6"' + tip(h) + '/><text x="' + X(i) + '" y="' + (ch - 8) + '" text-anchor="middle" font-size="10.5" fill="#6a7a94">' + ('0' + r.h).slice(-2) + '</text>';
      });
      if (prv) s += '<path d="' + prv.R.map(function (r, i) { return (i ? 'L' : 'M') + X(i) + ',' + Y(V(r)); }).join('') + '" fill="none" stroke="#17233a" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>';
      s += '</svg>' + legendHtml([{ c: '#0ea5e9', name: 'ช่วงนี้' }].concat(prv ? [{ dash: 1, name: 'ช่วงก่อนหน้า' }] : []));
      if (!big) return { html: s };
      /* ตารางรายละเอียด */
      var T = cur.R.reduce(function (a, r) { return a + r.c; }, 0), rows = cur.R.map(function (r, i) {
        var pc = prv ? prv.R[i].c : 0; return { r: r, pc: pc, d: pc > 0 ? (r.c - pc) / pc * 100 : null, tk: r.b ? r.n / r.b : 0 };
      }).filter(function (x) { return x.r.b > 0 || (x.pc > 0); });
      var key = { h: function (x) { return x.r.h; }, c: function (x) { return x.r.c; }, n: function (x) { return x.r.nn; }, tk: function (x) { return x.tk; }, d: function (x) { return x.d === null ? -1e9 : x.d; } }[o.sort] || function (x) { return x.r.c; };
      var sgn = o.dir === 'asc' ? 1 : -1; rows.sort(function (a, b) { return (key(a) - key(b)) * sgn; });
      var t = '<div class="sx-tw"><table class="sx-t"><tr><th>#</th><th>ชั่วโมง</th><th>ลูกค้า/วัน</th>' + (prv ? '<th>ก่อนหน้า</th><th>เปลี่ยน</th>' : '') + '<th>ยอดขาย/วัน</th><th>ยอด/คน</th><th>% ลูกค้า</th></tr>';
      rows.forEach(function (x, i) {
        t += '<tr><td>' + (i + 1) + '</td><td><b>' + ('0' + x.r.h).slice(-2) + ':00–' + ('0' + (x.r.h + 1)).slice(-2) + ':00</b></td><td><b>' + n(x.r.c, 1) + '</b></td>' +
          (prv ? '<td>' + n(x.pc, 1) + '</td><td class="' + (x.d === null ? '' : x.d >= 0 ? 'up' : 'dn') + '">' + (x.d === null ? '–' : (x.d >= 0 ? '▲ +' : '▼ ') + x.d.toFixed(0) + '%') + '</td>' : '') +
          '<td>' + n(x.r.nn) + '</td><td>' + (x.tk ? n(x.tk) : '–') + '</td><td>' + (T ? (x.r.c / T * 100).toFixed(1) : 0) + '%</td></tr>';
      });
      t += '</table></div>';
      var srt = cur.R.slice().sort(function (a, b) { return b.c - a.c; }), top3 = srt.slice(0, 3).reduce(function (a, r) { return a + r.c; }, 0);
      var note = '<div class="sx-note">📌 ช่วงพีค <b>' + ('0' + srt[0].h).slice(-2) + ':00</b> (' + n(srt[0].c, 1) + ' คน/วัน) · 3 ชั่วโมงบนรวม <b>' + (T ? Math.round(top3 / T * 100) : 0) + '%</b> ของลูกค้าทั้งวัน · เฉลี่ย ' + n(T, 1) + ' คน/วัน จาก ' + cur.nd + ' วัน</div>';
      return { html: '<div class="ax-split"><div>' + s + '</div><div>' + t + '</div></div>' + note };
    }
  };

  // 4) สัดส่วนยอดขายตามหมวด
  C.cat = {
    title: 'สัดส่วนยอดขายตามหมวด', sub: '% ของยอดขายรวม',
    opts: function (big) {
      var o = [{ k: 'unit', ch: [['baht', 'บาท'], ['q', 'จำนวน']] }];
      if (big) o.push({ k: 'sort', l: 'เรียงตาม', ch: [['v', 'มาก→น้อย'], ['d', '% เปลี่ยนแปลง'], ['name', 'ชื่อหมวด']] });
      return o;
    },
    def: { unit: 'baht', sort: 'v' },
    render: function (st, o, W, H, big) {
      var cur = catAgg(st.from, st.to), pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to), prv = usePrev ? catAgg(pv.from, pv.to) : null, ix = o.unit === 'q' ? 0 : 1;
      var L = Object.keys(cur).map(Number).map(function (c) { return { c: c, name: shortCat(CATS[c]), v: cur[c][ix], q: cur[c][0], n: cur[c][1], p: prv && prv[c] ? prv[c][ix] : 0 }; }).filter(function (x) { return x.v > 0; });
      if (!L.length) return { html: noData() };
      var T = L.reduce(function (a, b) { return a + b.v; }, 0);
      var srt = function (arr) {
        if (big && o.sort === 'name') return arr.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
        if (big && o.sort === 'd') return arr.sort(function (a, b) { var x = a.p > 0 ? (a.v - a.p) / a.p : -9, y = b.p > 0 ? (b.v - b.p) / b.p : -9; return y - x; });
        return arr.sort(function (a, b) { return b.v - a.v; });
      };
      var sortedV = L.slice().sort(function (a, b) { return b.v - a.v; });
      var colOf = {}; sortedV.forEach(function (x, i) { colOf[x.c] = PAL[Math.min(i, 7)]; });
      var pie = function (list, R) {
        var cx = R + 4, cy = R + 4, ang = -Math.PI / 2, sv = '<svg width="' + (2 * R + 8) + '" height="' + (2 * R + 8) + '">';
        list.forEach(function (x) {
          var a = x.v / T * 2 * Math.PI, a2 = ang + a, lg = a > Math.PI ? 1 : 0, P = function (t) { return [cx + R * Math.cos(t), cy + R * Math.sin(t)]; };
          if (list.length === 1) sv += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + x.col + '"/>';
          else sv += '<path d="M' + P(ang) + 'A' + R + ',' + R + ' 0 ' + lg + ' 1 ' + P(a2) + 'L' + cx + ',' + cy + 'Z" fill="' + x.col + '" stroke="#fff" stroke-width="1.5"' + tip('<b>' + esc(x.name) + '</b><br>' + n(x.v) + ' ' + (ix ? 'บาท' : 'ชิ้น') + ' · ' + (x.v / T * 100).toFixed(1) + '%') + '/>';
          ang = a2;
        });
        return sv + '</svg>';
      };
      var fm = function (d) { return d === null ? '' : '<span class="' + (d >= 0 ? 'up' : 'dn') + '" style="font-size:11.5px;margin-left:6px">' + (d >= 0 ? '▲' : '▼') + Math.abs(d).toFixed(0) + '%</span>'; };
      if (!big) {
        var top = sortedV.slice(0, 7), rest = sortedV.slice(7), pl = top.map(function (x) { return { v: x.v, name: x.name, col: colOf[x.c] }; });
        if (rest.length) pl.push({ v: rest.reduce(function (a, b) { return a + b.v; }, 0), name: 'อื่นๆ (' + rest.length + ' หมวด)', col: PAL[7] });
        var h = '<div class="sx-piewrap" style="margin:2px 0 8px">' + pie(pl, 46) + '</div>' + pl.map(function (x) { return '<div class="ax-li"><i class="sx-dot" style="background:' + x.col + '"></i><span>' + esc(x.name) + '</span><b>' + (x.v / T * 100).toFixed(1) + '%</b></div>'; }).join('');
        return { html: h + '<button type="button" class="ax-more" data-ex="cat">⤢ ดูทุกหมวด</button>' };
      }
      var ordered = srt(L.slice());
      var t = '<div class="ax-split"><div class="sx-piewrap" style="align-items:flex-start;padding-top:10px">' + pie(sortedV.map(function (x) { return { v: x.v, name: x.name, col: colOf[x.c] }; }), 120) + '</div><div class="sx-tw"><table class="sx-t"><tr><th>หมวด</th><th>ยอดขาย (บาท)</th><th>จำนวน</th><th>สัดส่วน</th>' + (prv ? '<th>เทียบก่อนหน้า</th>' : '') + '</tr>';
      var TQ = L.reduce(function (a, b) { return a + b.q; }, 0), TN = L.reduce(function (a, b) { return a + b.n; }, 0);
      ordered.forEach(function (x) {
        var d = x.p > 0 ? (x.v - x.p) / x.p * 100 : null;
        t += '<tr><td><i class="sx-dot" style="background:' + colOf[x.c] + '"></i><b>' + esc(x.name) + '</b></td><td>' + n(x.n) + '</td><td>' + n(x.q) + '</td><td><span class="sx-bar" style="width:' + Math.round(x.v / T * 90) + 'px;background:' + colOf[x.c] + '"></span>' + (x.v / T * 100).toFixed(1) + '%</td>' + (prv ? '<td class="' + (d === null ? '' : d >= 0 ? 'up' : 'dn') + '">' + (d === null ? '–' : (d >= 0 ? '▲ +' : '▼ ') + d.toFixed(1) + '%') + '</td>' : '') + '</tr>';
      });
      t += '<tr class="t"><td>รวม</td><td>' + n(TN) + '</td><td>' + n(TQ) + '</td><td>100%</td>' + (prv ? '<td></td>' : '') + '</tr></table></div></div>';
      return { html: t };
    }
  };

  // รายการเมนู (ตารางขยาย) — ใช้ร่วมกันของ Top 10 / หมวดเบเกอรี่ / Supplier
  function itemRows(st, scope, o) {
    var cur = menuAgg(st.from, st.to, scope), pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to), prv = usePrev ? menuAgg(pv.from, pv.to, scope) : null;
    var spark = {}, len = st.to - st.from + 1, d;
    for (d = st.from; d <= st.to; d++) (RD[d] || []).forEach(function (r) { if (cur[r[0]]) (spark[r[0]] || (spark[r[0]] = new Array(len).fill(0)))[d - st.from] += r[1]; });
    var rows = Object.keys(cur).map(Number).map(function (i) { var m = MENU[i], p = prv && prv[i] ? prv[i][0] : 0; return { i: i, m: m, q: cur[i][0], n: cur[i][1], pq: p, d: p > 0 ? (cur[i][0] - p) / p * 100 : null, sp: spark[i] }; }).filter(function (x) { return x.q > 0 || x.n > 0; });
    return { rows: rows, usePrev: usePrev, prv: prv };
  }
  function sparkSvg(a) {
    if (!a || a.length < 2) return '';
    var w = 78, h = 22, mx = Math.max.apply(null, a) || 1, ag = a;
    if (a.length > 40) { var k = Math.ceil(a.length / 40); ag = []; for (var i = 0; i < a.length; i += k) ag.push(a.slice(i, i + k).reduce(function (x, y) { return x + y; }, 0)); mx = Math.max.apply(null, ag) || 1; }
    var bw = w / ag.length;
    return '<svg width="' + w + '" height="' + h + '" style="vertical-align:middle">' + ag.map(function (v, i) { var bh = Math.max(v > 0 ? 2 : 0, v / mx * (h - 2)); return '<rect x="' + (i * bw + .3) + '" y="' + (h - bh) + '" width="' + Math.max(1, bw - .8) + '" height="' + bh + '" fill="#a78bfa" rx="1"/>'; }).join('') + '</svg>';
  }
  function itemsTable(st, o, scope, opt) {
    var R = itemRows(st, scope), rows = R.rows;
    if (opt.cat !== undefined && o.cat !== 'all') { var set = opt.catSets().filter(function (s) { return s.id === String(o.cat); })[0]; if (set) rows = rows.filter(function (x) { return set.cats.indexOf(x.m.cat) >= 0; }); }
    if (o.sup && o.sup !== 'all') rows = rows.filter(function (x) { return x.m.sup === o.sup; });
    if (!rows.length) return noData();
    var key = { q: function (x) { return x.q; }, n: function (x) { return x.n; }, d: function (x) { return x.d === null ? -1e9 : x.d; }, name: function (x) { return x.m.name; } }[o.sort] || function (x) { return x.q; };
    var sg = o.dir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) { var x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * sg || b.q - a.q; });
    var TQ = rows.reduce(function (a, b) { return a + b.q; }, 0), TN = rows.reduce(function (a, b) { return a + b.n; }, 0), nd = Math.max(1, daysIn(st.from, st.to)), u = opt.unit || 'ชิ้น';
    var t = '<div class="sx-tw"><table class="sx-t ax-it"><tr><th>#</th><th>เมนู</th>' + (opt.showCat ? '<th>หมวด</th>' : '') + (opt.noSup ? '' : '<th>Supplier</th>') + '<th>' + u + '</th>' + (R.usePrev ? '<th>ก่อนหน้า</th><th>เปลี่ยน</th>' : '') + '<th>ยอดขาย (บาท)</th><th>% ของรายการ</th><th>บาท/' + u + '</th><th>' + u + '/วัน</th><th>แนวโน้มรายวัน</th></tr>';
    rows.forEach(function (x, i) {
      t += '<tr><td>' + (i + 1) + '</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis"><b>' + esc(cleanName(x.m.name)) + '</b></td>' + (opt.showCat ? '<td>' + esc(shortCat(x.m.catName)) + '</td>' : '') + (opt.noSup ? '' : '<td>' + (supTag(x.m.sup) || '<span style="color:#8593a9;font-size:12px">อื่นๆ</span>') + '</td>') + '<td><b>' + n(x.q) + '</b></td>' +
        (R.usePrev ? '<td>' + n(x.pq) + '</td><td class="' + (x.d === null ? '' : x.d >= 0 ? 'up' : 'dn') + '">' + (x.d === null ? 'ใหม่' : (x.d >= 0 ? '▲ +' : '▼ ') + x.d.toFixed(0) + '%') + '</td>' : '') +
        '<td>' + n(x.n) + '</td><td>' + (TN ? (x.n / TN * 100).toFixed(1) : 0) + '%</td><td>' + (x.q ? n(x.n / x.q) : '–') + '</td><td>' + n(x.q / nd, 2) + '</td><td>' + sparkSvg(x.sp) + '</td></tr>';
    });
    t += '<tr class="t"><td></td><td>รวม ' + rows.length + ' รายการ</td>' + (opt.showCat ? '<td></td>' : '') + (opt.noSup ? '' : '<td></td>') + '<td>' + n(TQ) + '</td>' + (R.usePrev ? '<td></td><td></td>' : '') + '<td>' + n(TN) + '</td><td>100%</td><td></td><td></td><td></td></tr></table></div>';
    return t;
  }
  function itemOpts(withCat, catSets, withSup) {
    return function (big) {
      if (!big) return [];
      var o = [{ k: 'sort', l: 'เรียงตาม', ch: [['q', 'จำนวน'], ['n', 'ยอดขาย'], ['d', '% เปลี่ยนแปลง'], ['name', 'ชื่อเมนู']], dir: 1 }];
      if (withSup) o.push({ k: 'sup', l: 'Supplier', ch: [['all', 'ทั้งหมด']].concat(SUPS.map(function (s) { return [s, s]; })) });
      if (withCat) o.push({ k: 'cat', l: 'หมวด', ch: [['all', 'ทุกหมวด']].concat(catSets().map(function (s) { return [s.id, s.label]; })), sets: catSets });
      return o;
    };
  }

  // 5) เมนูขายดี Top 10 (เครื่องดื่ม)
  var drinkScope = function (m) { return m.drink; };
  C.top = {
    title: 'เมนูขายดี Top 10', sub: 'เครื่องดื่ม', catSets: drinkSets,
    opts: function (big) { return big ? itemOptsTop(big) : [{ k: 'rank', ch: [['q', 'แก้ว'], ['n', 'บาท']] }]; },
    def: { rank: 'q', sort: 'q', dir: 'desc', cat: 'all', sup: 'all' },
    render: function (st, o, W, H, big) {
      if (big) return { html: itemsTable(st, o, drinkScope, { cat: 1, catSets: drinkSets, showCat: true, unit: 'แก้ว', noSup: true }) };
      var R = itemRows(st, drinkScope), k = o.rank === 'n' ? 'n' : 'q';
      var rows = R.rows.sort(function (a, b) { return b[k] - a[k]; }).slice(0, 10);
      if (!rows.length) return { html: noData() };
      var mx = rows[0][k] || 1;
      return {
        html: '<div class="ax-tp">' + rows.map(function (x, i) {
          var h = '<b>' + esc(cleanName(x.m.name)) + '</b><br>' + esc(shortCat(x.m.catName)) + '<br>' + n(x.q) + ' แก้ว · ' + n(x.n) + ' บาท' + (x.d !== null ? '<br>เทียบก่อนหน้า ' + (x.d >= 0 ? '+' : '') + x.d.toFixed(0) + '%' : '');
          return '<div class="ax-row"' + tip(h) + '><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(cleanName(x.m.name)) + '</span><span class="bar"><i style="width:' + (x[k] / mx * 100) + '%"></i></span><span class="v">' + n(x[k]) + (k === 'q' ? '' : '') + ' <small>· ' + (k === 'q' ? kfmt(x.n) : n(x.q) + ' แก้ว') + '</small></span></div>';
        }).join('') + '</div><button type="button" class="ax-more" data-ex="top">⤢ ดูเมนูทั้งหมด (' + R.rows.length + ' รายการ)</button>'
      };
    }
  };
  function itemOptsTop() { return itemOpts(true, drinkSets, false)(true); }

  // 6) เบเกอรี่: Supplier + 5 หมวด
  function bkScope(cats) { return function (m) { return cats.indexOf(m.cat) >= 0; }; }
  function drinkSets() { var o = []; CATS.forEach(function (c, i) { if (isDrink(c)) o.push({ id: String(i), label: shortCat(c), cats: [i] }); }); return o; }
  function grpName(g) { return g.map(function (i) { return shortCat(CATS[i]); }).sort(function (x, y) { return x.length - y.length; })[0] || '–'; }
  function bkSets() { return BKC.map(function (g, i) { return { id: String(i), label: grpName(g), cats: g }; }).filter(function (s) { return s.cats.length; }); }
  C.sup = {
    title: 'แยกตาม Supplier', sub: 'เบเกอรี่ทั้ง 5 หมวด',
    opts: itemOpts(true, bkSets, true), def: { sort: 'q', dir: 'desc', cat: 'all', sup: 'all' }, accent: '#14b8a6', catSets: bkSets,
    render: function (st, o, W, H, big) {
      var sc = function (m) { return m.bk; };
      if (big) return { html: itemsTable(st, o, sc, { cat: 1, catSets: bkSets, showCat: true, unit: 'ชิ้น' }) };
      var R = itemRows(st, sc), S = {}, TQ = 0, TN = 0, all = catAgg(st.from, st.to), T = 0, c;
      for (c in all) T += all[c][1];
      SUPS.forEach(function (s) { S[s] = [0, 0]; });
      R.rows.forEach(function (x) { S[x.m.sup][0] += x.q; S[x.m.sup][1] += x.n; TQ += x.q; TN += x.n; });
      if (!TN) return { html: noData() };
      var ord = SUPS.slice().sort(function (a, b) { return S[b][1] - S[a][1]; });
      return {
        html: '<div class="ax-tot">รวม <b>' + n(TN) + '</b> บาท · ' + n(TQ) + ' ชิ้น <span class="ax-pct" style="background:#14b8a622;color:#0f9a88">' + (T ? (TN / T * 100).toFixed(1) : 0) + '% ของยอดขายร้าน</span></div>' +
          ord.map(function (s) { return '<div class="ax-sp"' + tip('<b>' + s + '</b><br>' + n(S[s][0]) + ' ชิ้น · ' + n(S[s][1]) + ' บาท') + '><div class="h"><b>' + s + '</b><span>' + n(S[s][0]) + ' ชิ้น</span><b>' + n(S[s][1]) + ' ฿</b></div><div class="r"><div class="b"><i style="width:' + (S[s][1] / TN * 100) + '%;background:' + SUPC[s] + '"></i></div><b>' + (S[s][1] / TN * 100).toFixed(1) + '%</b></div></div>'; }).join('') +
          '<div class="ax-hint">PAT = Patra · BAAN = Ban Bakery · AMZ = Bakery Factory</div><button type="button" class="ax-more" data-ex="sup" style="background:#14b8a61a;color:#0f9a88">⤢ ขยายดูรายการแยกตาม Supplier</button>'
      };
    }
  };
  for (var bi = 0; bi < 5; bi++) (function (bi) {
    var id = 'bk' + bi;
    C[id] = {
      title: '', accent: ACC[bi], dyn: true,
      opts: itemOpts(false, null, true), def: { sort: 'q', dir: 'desc', sup: 'all' },
      cat: function () { return BKC[bi]; },
      render: function (st, o, W, H, big) {
        var c = BKC[bi]; if (!c || !c.length) return { html: noData('ไม่มีหมวดนี้ในข้อมูล') };
        var sc = bkScope(c);
        if (big) return { html: itemsTable(st, o, sc, { unit: 'ชิ้น' }) };
        var R = itemRows(st, sc), rows = R.rows.sort(function (a, b) { return b.q - a.q; });
        var all = catAgg(st.from, st.to), T = 0, k; for (k in all) T += all[k][1];
        var q = rows.reduce(function (a, b) { return a + b.q; }, 0), v = rows.reduce(function (a, b) { return a + b.n; }, 0);
        return {
          head: '<span class="ax-pct" style="background:' + ACC[bi] + '22;color:' + ACC[bi] + '">' + (T ? (v / T * 100).toFixed(1) : '0.0') + '%</span><small style="margin-left:auto">' + n(v) + ' ฿ · ' + n(q) + ' ชิ้น</small>',
          html: (rows.length ? rows.slice(0, 5).map(function (x, i) { return '<div class="ax-row2"' + tip('<b>' + esc(cleanName(x.m.name)) + '</b><br>' + n(x.q) + ' ชิ้น · ' + n(x.n) + ' บาท' + (x.d !== null ? '<br>เทียบก่อนหน้า ' + (x.d >= 0 ? '+' : '') + x.d.toFixed(0) + '%' : '')) + '><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(cleanName(x.m.name)) + supTag(x.m.sup) + '</span><span class="v">' + n(x.q) + ' ชิ้น</span></div>'; }).join('') : noData()) +
            '<button type="button" class="ax-more" data-ex="' + id + '" style="background:' + ACC[bi] + '1a;color:' + ACC[bi] + '">⤢ ดูทั้งหมด ' + rows.length + ' รายการ</button>'
        };
      }
    };
  })(bi);
  function cardTitle(id) { if (/^bk\d$/.test(id)) { var g = BKC[+id.slice(2)]; return g && g.length ? grpName(g) : 'เบเกอรี่'; } return C[id].title; }

  /* ---------- filters ---------- */
  function chipRow(items, cur, attr, extra) {
    return items.map(function (i) { return '<button type="button" class="sx-chip ' + (extra || '') + '" ' + attr + '="' + i[0] + '" aria-pressed="' + (String(cur) === String(i[0])) + '">' + i[1] + '</button>'; }).join('');
  }
  function prevLbl(st) { var p = prevOf(st); return haveData(p.from, p.to) ? th(p.from) + ' – ' + th(p.to) : 'ไม่มีข้อมูลช่วงก่อนหน้า'; }
  function filterBar(st) {
    var pres = [['7', '7 วัน'], ['30', '30 วัน'], ['90', '90 วัน'], ['all', 'ทั้งหมด']];
    return '<div class="sx-g">ช่วงเวลา ' + chipRow(pres, st.pre, 'data-pre') + '</div>' +
      '<div class="sx-g">กำหนดเอง <input type="date" class="sx-date" data-from min="' + iso(FIRST) + '" max="' + iso(LATEST) + '" value="' + iso(st.from) + '"> → <input type="date" class="sx-date" data-to min="' + iso(FIRST) + '" max="' + iso(LATEST) + '" value="' + iso(st.to) + '"></div>' +
      '<div class="sx-g">เทียบช่วงก่อนหน้า <button type="button" class="sx-tog" data-cmp aria-pressed="' + st.cmp + '" aria-label="เทียบช่วงก่อนหน้า"></button><span>' + prevLbl(st) + '</span></div>';
  }
  function bindFilters(host, st, onChange) {
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !host.contains(b)) return;
      if (b.dataset.pre) { setPre(st, b.dataset.pre); onChange(); }
      else if (b.hasAttribute('data-cmp')) { st.cmp = !st.cmp; onChange(); }
    });
    host.addEventListener('change', function (e) {
      var t = e.target; if (!t.classList.contains('sx-date')) return;
      var a = t.hasAttribute('data-from') ? 'from' : 'to', v = t.value; if (!v) return;
      st[a] = Math.min(LATEST, Math.max(FIRST, di(v)));
      if (st.from > st.to) { if (a === 'from') st.to = st.from; else st.from = st.to; }
      st.pre = 'custom'; onChange();
    });
  }

  /* ---------- cards ---------- */
  function optList(id, big) { var f = C[id].opts; return typeof f === 'function' ? f(big) : (f || []); }
  function cardHtml(id, big) {
    var d = C[id], title = cardTitle(id);
    return '<div class="sx-h"><h3>' + esc(title) + (d.sub ? '<small>' + d.sub + '</small>' : '') + '<span data-head></span></h3>' + (big ? '' : '<button type="button" class="sx-ex" data-ex="' + id + '" aria-label="ขยาย ' + esc(title) + '" title="ขยาย">⤢</button>') + '</div>' +
      '<div class="sx-opts" data-opts></div><div class="sx-body" data-body></div>';
  }
  function renderOpts(el, id, o, big) {
    el.innerHTML = optList(id, big).map(function (op) {
      var cur = o[op.k], ch = op.ch.map(function (i) {
        var on = String(cur) === String(i[0]), arrow = op.dir && on ? (o.dir === 'asc' ? ' ▲' : ' ▼') : '';
        return '<button type="button" class="sx-chip sm" data-o="' + op.k + '" data-v="' + i[0] + '" aria-pressed="' + on + '">' + i[1] + arrow + '</button>';
      }).join('');
      return '<div class="sx-og">' + (op.l ? op.l + ' ' : '') + ch + '</div>';
    }).join('');
  }
  function paint(card) {
    var id = card.id, o = card.o, st = card.st(), body = card.el.querySelector('[data-body]'), big = card.big;
    var W = Math.max(260, Math.floor(body.clientWidth || card.el.clientWidth - 32));
    var H = ({ area: big ? 400 : 300, wk: big ? 400 : 250, hr: 250 })[id] || 260;
    renderOpts(card.el.querySelector('[data-opts]'), id, o, big);
    var r; try { r = C[id].render(st, o, W, H, big); } catch (e) { r = { html: noData('แสดงผลไม่ได้: ' + esc(e.message)) }; }
    body.innerHTML = r.html;
    var hd = card.el.querySelector('[data-head]'); if (hd) hd.innerHTML = r.head || '';
    card.el.classList.toggle('hit', !big);
  }
  function mkCard(id, st, big) {
    var el = document.createElement('div'), acc = C[id].accent;
    el.className = 'sx-card ax-c c-' + id + (acc ? ' ax-acc' : ''); if (acc && !big) el.style.borderTopColor = acc;
    el.innerHTML = cardHtml(id, big);
    var o = {}; for (var k in C[id].def) o[k] = C[id].def[k];
    var c = { id: id, el: el, o: o, st: st, big: big };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-o]');
      if (b) {
        var k2 = b.dataset.o, op = optList(id, big).filter(function (x) { return x.k === k2; })[0];
        if (op && op.dir && String(o[k2]) === b.dataset.v) o.dir = o.dir === 'asc' ? 'desc' : 'asc';
        else { o[k2] = b.dataset.v; if (op && op.dir) o.dir = k2 === 'sort' && b.dataset.v === 'name' ? 'asc' : (k2 === 'sort' && b.dataset.v === 'h' ? 'asc' : 'desc'); }
        paint(c); return;
      }
      if (!big && (e.target.closest('[data-ex]') || (e.target.closest('[data-body]') && !e.target.closest('a,button,input')))) openModal(id, c.o);
    });
    return c;
  }

  function kpiHtml(st) {
    var pv = prevOf(st), up = st.cmp && haveData(pv.from, pv.to);
    var nd = daysIn(st.from, st.to), pnd = up ? daysIn(pv.from, pv.to) : 0;
    var A = function (f) { return totDay(st.from, st.to, f); }, P = function (f) { return up ? totDay(pv.from, pv.to, f) : 0; };
    var net = A('n'), cu = A('b'), cp = A('cup');
    var D = function (a, b) { return up && b ? dtag(dlt(a, b)) : '<div class="sx-d">&nbsp;</div>'; };
    var K = [['ยอดขายรวม', n(net), 'บาท', D(net, P('n'))], ['จำนวนลูกค้า (1 บิล = 1 คน)', n(cu), 'คน', D(cu, P('b'))], ['จำนวนแก้ว', n(cp), 'แก้ว', D(cp, P('cup'))],
      ['ยอดต่อคน', cu ? n(net / cu) : '–', 'บาท/คน', D(cu ? net / cu : 0, P('b') ? P('n') / P('b') : 0)], ['ลูกค้าเฉลี่ยต่อวัน', nd ? n(cu / nd) : '–', 'คน/วัน', D(nd ? cu / nd : 0, pnd ? P('b') / pnd : 0)]];
    return K.map(function (k, i) { return '<div class="sx-card sx-kpi ax-k' + i + '"><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '<small>' + k[2] + '</small></div>' + k[3] + '</div>'; }).join('');
  }

  var root, tipEl, modal = null, pageCards = [];
  var LOGO = '<img class="sx-logo" src="amz.png" alt="Café Amazon">';
  function build() {
    root.innerHTML = DEFS + '<div class="sx-in"><div class="sx-top"><button type="button" class="sx-back" id="axBack">← ภาพรวม</button>' + LOGO + '<h1>ยอดขาย Café Amazon</h1><span class="by" id="axBy"></span></div>' +
      '<div class="sx-card sx-fil" id="axFil"></div><div class="sx-kpis" id="axK"></div>' +
      '<div class="sx-grid g2" id="a1"></div><div class="sx-grid g3e" id="a2"></div>' +
      '<div class="ax-sec">เบเกอรี่ &amp; ขนม<small>แยกตามหมวดและ Supplier · ตามช่วงที่เลือก</small></div><div class="sx-grid g3e" id="a3"></div>' +
      '<div class="sx-note" style="text-align:center;background:none">นับเฉพาะบิลที่ไม่ void · 1 บิล = 1 คน · จำนวนแก้ว นับเฉพาะหมวด Juice &amp; Smoothies, NPD, กาแฟ, ชา, ช็อกโกแลต, นม · Supplier ดูจากท้ายชื่อเมนู: PAT = Patra, BAAN = Ban Bakery, AMZ = Bakery Factory</div></div>';
    pageCards = [];
    var place = { a1: ['area', 'wk'], a2: ['hr', 'cat', 'top'], a3: ['sup', 'bk0', 'bk1', 'bk2', 'bk3', 'bk4'] };
    Object.keys(place).forEach(function (r) { place[r].forEach(function (id) { var c = mkCard(id, function () { return G; }, false); pageCards.push(c); root.querySelector('#' + r).appendChild(c.el); }); });
    root.querySelector('#axBack').onclick = close;
    bindFilters(root.querySelector('#axFil'), G, refresh);
    refresh();
  }
  function refresh() {
    root.querySelector('#axFil').innerHTML = filterBar(G);
    root.querySelector('#axK').innerHTML = kpiHtml(G);
    root.querySelector('#axBy').textContent = 'ข้อมูลถึง ' + th(LATEST) + ' · ช่วงที่เลือก ' + th(G.from) + ' – ' + th(G.to) + ' (' + daysIn(G.from, G.to) + ' วัน)' + (ITEMLAST && ITEMLAST < LATEST ? ' · ⚠ รายการสินค้า (แก้ว/เมนู) อัปเดตถึง ' + th(ITEMLAST) : '');
    pageCards.forEach(paint);
  }

  function openModal(id, o0) {
    closeModal();
    var st = clone(G), ov = document.createElement('div'); ov.className = 'sx-ov ax-ov';
    ov.innerHTML = '<div class="sx-md"><button type="button" class="sx-x" aria-label="ปิด">✕</button><div data-slot></div></div>';
    var c = mkCard(id, function () { return st; }, true);
    for (var k in o0) c.o[k] = o0[k];
    var slot = ov.querySelector('[data-slot]'), fil = document.createElement('div'); fil.className = 'sx-card sx-fil';
    var head = c.el.querySelector('.sx-h'); c.el.className = ''; c.el.style.borderTop = '0'; slot.appendChild(c.el);
    head.insertAdjacentElement('afterend', fil);
    var refreshM = function () { fil.innerHTML = filterBar(st); paint(c); };
    bindFilters(fil, st, refreshM);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.sx-x')) closeModal(); });
    document.body.appendChild(ov); modal = { ov: ov, c: c };
    refreshM();
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { if (modal) { modal.ov.remove(); modal = null; } }

  /* ---------- open / close / load ---------- */
  var loading = false, loaded = false;
  function endpoint() {
    var u = CFG.API_URL; if (!u) return null;
    return u + (u.indexOf('?') > -1 ? '&' : '?') + 'view=amz' + (CFG.TOKEN ? '&token=' + encodeURIComponent(CFG.TOKEN) : '');
  }
  function fetchJson(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function load() {
    if (loading) return; loading = true;
    root.innerHTML = '<div class="sx-in"><div class="sx-top"><button type="button" class="sx-back" id="axBack">← ภาพรวม</button>' + LOGO + '<h1>ยอดขาย Café Amazon</h1></div><div class="sx-load">กำลังโหลดข้อมูล…</div></div>';
    root.querySelector('#axBack').onclick = close;
    var u = endpoint();
    (u ? fetchJson(u) : fetchJson('amz-sample.json')).then(function (p) {
      if (p && p.error) throw new Error(p.error);
      ingest(p);
      if (!READY) throw new Error('ยังไม่มีข้อมูลในแท็บ amz_daily');
      setPre(G, G.pre); loaded = true; loading = false; build();
      if (!u) root.querySelector('#axBy').textContent += ' · ข้อมูลตัวอย่าง';
    }).catch(function (e) {
      loading = false;
      root.querySelector('.sx-load').innerHTML = 'โหลดข้อมูลไม่สำเร็จ: ' + esc(e.message) + '<br><br><button type="button" class="sx-chip" id="axRetry">ลองใหม่</button>';
      root.querySelector('#axRetry').onclick = load;
    });
  }
  function open() {
    if (!root) init();
    root.hidden = false; window.SX_OPEN = true; document.body.style.overflow = 'hidden';
    if (!loaded) load(); else build();
  }
  function hide() { closeModal(); if (root) root.hidden = true; }
  function close() { hide(); window.SX_OPEN = false; document.body.style.overflow = ''; var t = document.querySelector('.tab[data-k="ov"]'); if (t) t.click(); }

  var EXTRA = '#ax{background:linear-gradient(160deg,#eef2ff 0%,#f0f9ff 45%,#fdf2f8 100%)}#ax .sx-card{box-shadow:0 6px 24px rgba(79,70,229,.08);border:1px solid #fff}' +
    '#ax .sx-chip[aria-pressed=true]{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:#6366f1}#ax .sx-tog[aria-pressed=true]{background:#6366f1}' +
    '' +
    '.g3e{grid-template-columns:repeat(3,minmax(0,1fr))}#ax .ax-acc{border-top-width:4px}' +
    '#ax .ax-k0{border-top:4px solid #ff7a4a}#ax .ax-k1{border-top:4px solid #6366f1}#ax .ax-k2{border-top:4px solid #f59e0b}#ax .ax-k3{border-top:4px solid #ec4899}#ax .ax-k4{border-top:4px solid #14b8a6}' +
    '.ax-sec{font:700 17px var(--f-display,inherit);margin:6px 2px 10px;color:#17233a}.ax-sec small{font:400 12.5px var(--f-body,inherit);color:#6a7a94;margin-left:8px}' +
    '.ax-more{display:block;width:100%;margin-top:10px;text-align:center;font:700 12.5px var(--f-body,inherit);color:#0f9a88;background:#14b8a61a;border:0;border-radius:10px;padding:8px;cursor:pointer}' +
    '.ax-li{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:2.5px 0}.ax-li span{flex:1}.ax-li b{width:48px;text-align:right}' +
    '.ax-tp .ax-row{display:flex;align-items:center;gap:8px;font-size:12.5px;margin:7px 0}.ax-row .rk{width:20px;color:#6a7a94;font-weight:700}.ax-row .nm{width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ax-row .bar{flex:1;height:14px;background:#eef3fa;border-radius:8px;overflow:hidden}.ax-row .bar i{display:block;height:100%;background:linear-gradient(90deg,#a78bfa,#ec4899);border-radius:8px}.ax-row .v{width:84px;text-align:right;font-weight:600}.ax-row .v small{color:#8593a9;font-weight:400}' +
    '.ax-row2{display:flex;align-items:center;gap:8px;font-size:12.5px;margin:8px 0}.ax-row2 .rk{width:18px;color:#6a7a94;font-weight:700}.ax-row2 .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ax-row2 .v{font-weight:600;white-space:nowrap}' +
    '.ax-tg{font-size:10.5px;padding:1px 6px;border-radius:8px;color:#fff;margin-left:5px;font-weight:600}.ax-pct{display:inline-block;border-radius:10px;padding:2px 9px;font-size:12px;font-weight:700;margin-left:8px}' +
    '.ax-tot{font-size:12.5px;color:#31415f;margin-bottom:6px}.ax-sp{margin:11px 0}.ax-sp .h{display:flex;font-size:13px;gap:10px}.ax-sp .h b:first-child{flex:1}.ax-sp .h span{color:#6a7a94}.ax-sp .r{display:flex;align-items:center;gap:8px}.ax-sp .b{flex:1;height:14px;background:#eef3fa;border-radius:6px;overflow:hidden}.ax-sp .b i{display:block;height:100%}.ax-sp .r b{width:48px;text-align:right;font-size:12.5px}.ax-hint{font-size:11.5px;color:#8593a9;margin-top:6px}' +
    '.ax-split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:18px}.ax-ov .sx-md{width:min(1400px,100%)}.ax-it th:nth-child(2),.ax-it td:nth-child(2){text-align:left}.ax-ov .sx-chip[aria-pressed=true]{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:#6366f1}.ax-ov .sx-tog[aria-pressed=true]{background:#6366f1}.ax-ov .sx-t td{padding:8px 6px}' +
    '@media(max-width:1100px){.g3e{grid-template-columns:1fr}.ax-split{grid-template-columns:1fr}}';

  function init() {
    var cs = (window.SX_CSS || '').replace(/#sx\b/g, '#ax');
    if (!document.getElementById('sxcss')) { var s0 = document.createElement('style'); s0.id = 'sxcss'; s0.textContent = window.SX_CSS || ''; document.head.appendChild(s0); }
    var st = document.createElement('style'); st.textContent = cs + EXTRA; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'ax'; root.hidden = true; document.body.appendChild(root);
    if (!document.getElementById('sxtip')) {
      tipEl = document.createElement('div'); tipEl.id = 'sxtip'; tipEl.hidden = true; document.body.appendChild(tipEl);
      document.addEventListener('mousemove', function (e) {
        var t = e.target.closest && e.target.closest('[data-tip]');
        if (!t) { tipEl.hidden = true; return; }
        tipEl.innerHTML = t.getAttribute('data-tip'); tipEl.hidden = false;
        var w = tipEl.offsetWidth, h = tipEl.offsetHeight, x = e.clientX + 14, y = e.clientY + 14;
        if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14;
        tipEl.style.left = Math.max(4, x) + 'px'; tipEl.style.top = Math.max(4, y) + 'px';
      });
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (modal) closeModal(); else if (root && !root.hidden) close(); } });
    var rz = 0; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (root && !root.hidden && loaded) { pageCards.forEach(paint); if (modal) paint(modal.c); } }, 150); });
  }

  window.AmzPage = { open: open, close: close };
  document.addEventListener('DOMContentLoaded', function () {
    var tabs = document.getElementById('tabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      if (b.dataset.k === 'amz') open();
      else if (root && !root.hidden) { hide(); if (b.dataset.k !== 'fuel') { window.SX_OPEN = false; document.body.style.overflow = ''; } }
    }, true);
  });
})();
