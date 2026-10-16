/* หน้า "ยอดขายน้ำมัน" — กดแท็บ "น้ำมัน" เพื่อเปิด
 * ข้อมูล: Apps Script ?view=sales (แท็บ fuel_daily / fuel_hourly) ถ้ายังไม่ตั้ง API_URL จะใช้ sales-sample.json
 * ทุกการ์ดกดขยาย (⤢) ได้ และมีตัวเลือกช่วงวันที่ของตัวเอง */
(function () {
  'use strict';
  var CFG = window.STATION_CONFIG || {};
  var SZ = ['เล็ก', 'กลาง', 'ใหญ่'], SC = ['#ff8fa8', '#7cc8ff', '#5ee85e'];
  var FN = ['G95', 'G91', 'E20', 'Diesel'], FC = ['#f26a1f', '#1fa95a', '#7bd36d', '#1769e8'];
  var DN = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  var MN = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var PU = '#7b3fe4', BLUE = '#1f6be6';

  /* ---------- helpers ---------- */
  function n(x, d) { d = d || 0; return (+x || 0).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
  function di(s) { var m = String(s).match(/(\d+)-(\d+)-(\d+)/); return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5); }
  function dt(d) { return new Date(d * 864e5); }
  function iso(d) { var x = dt(d); return x.getUTCFullYear() + '-' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + x.getUTCDate()).slice(-2); }
  function wdOf(d) { return (d + 3) % 7; }                       // 0 = จันทร์
  function sd(d) { var x = dt(d); return x.getUTCDate() + ' ' + MN[x.getUTCMonth()]; }
  function th(d) { var x = dt(d); return ('0' + x.getUTCDate()).slice(-2) + '/' + ('0' + (x.getUTCMonth() + 1)).slice(-2) + '/' + (x.getUTCFullYear() + 543); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nice(v) {
    if (!(v > 0)) return 1;
    var e = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  function kfmt(v) { return v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : String(v); }
  function dlt(a, b) { return b > 0 ? (a - b) / b * 100 : null; }
  function dtag(p, suf) {
    if (p === null) return '<div class="sx-d">–</div>';
    return '<div class="sx-d ' + (p >= 0 ? 'up' : 'dn') + '">' + (p >= 0 ? '▲ +' : '▼ ') + p.toFixed(1) + '%' + (suf === false ? '' : '<small>เทียบช่วงก่อนหน้า</small>') + '</div>';
  }

  /* ---------- data ---------- */
  var DAY = {}, HRS = {}, DIS = [], LATEST = 0, FIRST = 0, READY = false;
  function ingest(p) {
    DAY = {}; HRS = {}; DIS = [];
    (p.daily || []).forEach(function (r) {
      var d = di(r[0]), f = r[1];
      if (!DAY[d]) DAY[d] = [null, null, null, null];
      var a = DAY[d][f] || (DAY[d][f] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      for (var i = 0; i < 11; i++) a[i] += +r[i + 2] || 0;
    });
    (p.hourly || []).forEach(function (r) {
      var d = di(r[0]);
      var a = HRS[d] || (HRS[d] = new Array(24 * 4 * 3).fill(0)), b = (r[1] * 4 + r[2]) * 3;
      a[b] += +r[3] || 0; a[b + 1] += +r[4] || 0; a[b + 2] += +r[5] || 0;
    });
    DIS = Object.keys(DAY).map(Number).sort(function (a, b) { return a - b; });
    FIRST = DIS[0] || 0; LATEST = DIS.length ? DIS[DIS.length - 1] : 0;
    READY = DIS.length > 0;
  }
  // row: [L, baht, carsS, carsM, carsL, Ls, Lm, Ll, Bs, Bm, Bl]
  function val(r, unit, s) {
    if (unit === 'cars') return s < 0 ? r[2] + r[3] + r[4] : r[2 + s];
    if (unit === 'L') return s < 0 ? r[0] : r[5 + s];
    return s < 0 ? r[1] : r[8 + s];
  }
  function fv(d, f, unit, s) { var r = DAY[d] && DAY[d][f]; return r ? val(r, unit, s) : 0; }
  function sv(d, fsel, unit, s) { var t = 0; for (var f = 0; f < 4; f++) if (fsel[f]) t += fv(d, f, unit, s); return t; }
  function prevOf(st) { var len = st.to - st.from + 1; return { from: st.from - len, to: st.from - 1 }; }
  function haveData(a, b) { for (var d = a; d <= b; d++) if (DAY[d]) return true; return false; }
  function daysIn(a, b, test) { var c = 0; for (var d = a; d <= b; d++) if (DAY[d] && (!test || test(d))) c++; return c; }
  function tot(a, b, fsel, unit, s) { var t = 0; for (var d = a; d <= b; d++) if (DAY[d]) t += sv(d, fsel, unit, s); return t; }
  function totF(a, b, f, unit, s) { var t = 0; for (var d = a; d <= b; d++) if (DAY[d]) t += fv(d, f, unit, s); return t; }

  /* ---------- state ---------- */
  var G = { from: 0, to: 0, cmp: true, fsel: [true, true, true, true], pre: '90' };
  function clone(s) { return { from: s.from, to: s.to, cmp: s.cmp, fsel: s.fsel.slice(), pre: s.pre }; }
  function setPre(st, p) {
    st.pre = p;
    if (p === 'all') { st.from = FIRST; st.to = LATEST; }
    else if (/^\d+$/.test(p)) { st.to = LATEST; st.from = Math.max(FIRST, LATEST - (+p) + 1); }
  }

  /* ---------- SVG building blocks ---------- */
  function yAxis(w, h, pl, pr, pt, pb, mx, fmt, ticks) {
    var s = '', Y = function (v) { return pt + (h - pt - pb) * (1 - v / mx); };
    for (var g = 0; g <= ticks; g++) {
      var v = mx * g / ticks;
      s += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e6edf6"/><text x="' + (pl - 7) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="#6a7a94">' + fmt(v) + '</text>';
    }
    return s;
  }
  function legendHtml(items) {
    return '<div class="sx-lg">' + items.map(function (i) {
      return i.dash ? '<span><i class="sx-dash"></i>' + i.name + '</span>' : '<span><i class="sx-dot" style="background:' + i.c + '"></i>' + i.name + '</span>';
    }).join('') + '</div>';
  }
  function tip(h) { return ' data-tip="' + esc(h) + '"'; }
  function noData(msg) { return '<div class="sx-empty">' + (msg || 'ไม่มีข้อมูลในช่วงที่เลือก') + '</div>'; }
  var UL = { baht: 'บาท', L: 'ลิตร', cars: 'คัน' };

  /* ---------- chart definitions ---------- */
  var C = {};

  // 1) ยอดขายรายวันแยกตามชนิด
  C.area = {
    title: 'ยอดขายแยกตามชนิดน้ำมัน', cls: 'wide',
    opts: [
      { k: 'unit', ch: [['baht', 'บาท'], ['L', 'ลิตร'], ['cars', 'คัน']] },
      { k: 'grain', l: 'แสดงเป็น', ch: [['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['month', 'รายเดือน']] }
    ], def: { unit: 'baht', grain: 'day' },
    render: function (st, o, W, H) {
      var key = function (d) {
        if (o.grain === 'week') return d - wdOf(d);
        if (o.grain === 'month') { var x = dt(d); return x.getUTCFullYear() * 12 + x.getUTCMonth(); }
        return d;
      };
      var B = [], idx = {};
      for (var d = st.from; d <= st.to; d++) {
        if (!DAY[d]) continue;
        var k = key(d);
        if (idx[k] === undefined) { idx[k] = B.length; B.push({ k: k, d: d, v: [0, 0, 0, 0], n: 0 }); }
        var b = B[idx[k]]; b.n++;
        for (var f = 0; f < 4; f++) if (st.fsel[f]) b.v[f] += fv(d, f, o.unit, -1);
      }
      if (!B.length) return { html: noData() };
      var N = B.length, pl = 52, pr = 12, pt = 10, pb = 28, mxv = 0;
      B.forEach(function (b) { var t = b.v.reduce(function (a, c) { return a + c; }, 0); b.t = t; if (t > mxv) mxv = t; });
      var mx = nice(mxv * 1.05), Y = function (v) { return pt + (H - pt - pb) * (1 - v / mx); };
      var bars = o.grain !== 'day' || N < 3, step = (W - pl - pr) / Math.max(1, bars ? N : N - 1);
      var X = function (i) { return bars ? pl + step * (i + .5) : pl + step * i; };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '">' + yAxis(W, H, pl, pr, pt, pb, mx, kfmt, 4);
      var order = [0, 1, 2, 3].filter(function (f) { return st.fsel[f]; });
      if (bars) {
        var bw = Math.min(46, step * .72);
        B.forEach(function (b, i) { var y0 = 0; order.forEach(function (f) { var v = b.v[f]; s += '<rect x="' + (X(i) - bw / 2) + '" y="' + Y(y0 + v) + '" width="' + bw + '" height="' + Math.max(0, Y(y0) - Y(y0 + v)) + '" fill="' + FC[f] + '" rx="1"/>'; y0 += v; }); });
      } else {
        for (var q = order.length - 1; q >= 0; q--) {
          var p = 'M' + X(0) + ',' + Y(0);
          B.forEach(function (b, i) { var a = 0; for (var z = 0; z <= q; z++) a += b.v[order[z]]; p += 'L' + X(i) + ',' + Y(a); });
          s += '<path d="' + p + 'L' + X(N - 1) + ',' + Y(0) + 'Z" fill="' + FC[order[q]] + '" opacity=".9"/>';
        }
      }
      var every = Math.max(1, Math.ceil(N / Math.max(2, Math.floor((W - pl) / 78))));
      B.forEach(function (b, i) {
        if (i % every) return;
        var lab = o.grain === 'month' ? MN[dt(b.d).getUTCMonth()] + ' ' + String((dt(b.d).getUTCFullYear() + 543) % 100) : sd(b.d);
        s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#6a7a94">' + lab + '</text>';
      });
      B.forEach(function (b, i) {
        var head = o.grain === 'day' ? th(b.d) : o.grain === 'week' ? 'สัปดาห์ ' + th(b.d) : MN[dt(b.d).getUTCMonth()] + ' ' + (dt(b.d).getUTCFullYear() + 543);
        var h = '<b>' + head + '</b>' + order.map(function (f) { return '<br><i class="sx-dot" style="background:' + FC[f] + '"></i>' + FN[f] + ' ' + n(b.v[f]); }).join('') + '<br><b>รวม ' + n(b.t) + ' ' + UL[o.unit] + '</b>';
        s += '<rect x="' + (X(i) - step / 2) + '" y="' + pt + '" width="' + step + '" height="' + (H - pt - pb) + '" fill="transparent"' + tip(h) + '/>';
      });
      return { html: s + '</svg>' + legendHtml(order.map(function (f) { return { c: FC[f], name: FN[f] }; })) };
    }
  };

  // 2) รถเข้าแต่ละวันในสัปดาห์
  function seriesDefs(by, fsel) {
    if (by === 'size') return SZ.map(function (z, i) { return { name: 'รถ' + z, c: SC[i], f: -1, s: i }; });
    if (by === 'fuel') return [0, 1, 2, 3].filter(function (f) { return fsel[f]; }).map(function (f) { return { name: FN[f], c: FC[f], f: f, s: -1 }; });
    return [{ name: 'รวม', c: BLUE, f: -1, s: -1 }];
  }
  function sdv(d, df, fsel, unit) {
    if (df.f >= 0) return fv(d, df.f, unit, df.s);
    return sv(d, fsel, unit, df.s);
  }
  function wkCalc(a, b, fsel, unit, defs) {
    var cnt = [0, 0, 0, 0, 0, 0, 0], sum = defs.map(function () { return [0, 0, 0, 0, 0, 0, 0]; });
    for (var d = a; d <= b; d++) {
      if (!DAY[d]) continue;
      var w = wdOf(d); cnt[w]++;
      defs.forEach(function (df, i) { sum[i][w] += sdv(d, df, fsel, unit); });
    }
    return { cnt: cnt, sum: sum };
  }
  C.wk = {
    title: 'รถเข้าแต่ละวันในสัปดาห์', sub: 'จันทร์–อาทิตย์',
    opts: [
      { k: 'show', l: 'แสดง', ch: [['avg', 'เฉลี่ยต่อวัน'], ['sum', 'รวมทั้งช่วง']] },
      { k: 'by', l: 'แยกตาม', ch: [['size', 'ขนาดรถ'], ['fuel', 'ชนิดน้ำมัน'], ['none', 'รวม']] },
      { k: 'unit', l: 'หน่วย', ch: [['cars', 'คัน'], ['L', 'ลิตร'], ['baht', 'บาท']] }
    ], def: { show: 'avg', by: 'size', unit: 'cars' },
    render: function (st, o, W, H) {
      var defs = seriesDefs(o.by, st.fsel);
      var cur = wkCalc(st.from, st.to, st.fsel, o.unit, defs);
      if (!cur.cnt.some(function (c) { return c; })) return { html: noData() };
      var pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var prv = usePrev ? wkCalc(pv.from, pv.to, st.fsel, o.unit, defs) : null;
      var V = function (c, i, w) { var c0 = c.cnt[w]; return c0 ? (o.show === 'avg' ? c.sum[i][w] / c0 : c.sum[i][w]) : 0; };
      var T = function (c, w) { var t = 0; defs.forEach(function (_, i) { t += V(c, i, w); }); return t; };
      var mxv = 0; for (var w = 0; w < 7; w++) { mxv = Math.max(mxv, T(cur, w), prv ? T(prv, w) : 0); }
      var pl = 52, pr = 10, pt = 22, pb = 40, mx = nice(mxv * 1.08), Y = function (v) { return pt + (H - pt - pb) * (1 - v / mx); };
      var gap = (W - pl - pr) / 7, bw = Math.min(58, gap * .66);
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '">' + yAxis(W, H, pl, pr, pt, pb, mx, kfmt, 4);
      var best = 0, worst = -1, ts = [];
      for (w = 0; w < 7; w++) { ts[w] = T(cur, w); if (cur.cnt[w]) { if (ts[w] > ts[best] || !cur.cnt[best]) best = w; if (worst < 0 || ts[w] < ts[worst]) worst = w; } }
      for (w = 0; w < 7; w++) {
        var x = pl + gap * w + (gap - bw) / 2, y0 = 0;
        defs.forEach(function (df, i) {
          var v = V(cur, i, w); s += '<rect x="' + x + '" y="' + Y(y0 + v) + '" width="' + bw + '" height="' + Math.max(0, Y(y0) - Y(y0 + v)) + '" fill="' + df.c + '"/>'; y0 += v;
        });
        if (prv && prv.cnt[w]) s += '<line x1="' + (x - 5) + '" x2="' + (x + bw + 5) + '" y1="' + Y(T(prv, w)) + '" y2="' + Y(T(prv, w)) + '" stroke="#17233a" stroke-width="2" stroke-dasharray="4 3"/>';
        if (cur.cnt[w]) s += '<text x="' + (x + bw / 2) + '" y="' + (Y(ts[w]) - 6) + '" text-anchor="middle" font-size="12.5" font-weight="700" fill="' + (w === best ? BLUE : '#17233a') + '">' + n(ts[w]) + '</text>';
        s += '<text x="' + (x + bw / 2) + '" y="' + (H - 22) + '" text-anchor="middle" font-size="12" font-weight="' + (w === best ? 700 : 400) + '" fill="' + (w >= 5 ? '#e0603a' : '#31415f') + '">' + DN[w] + '</text>';
        s += '<text x="' + (x + bw / 2) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="10" fill="#8593a9">(' + cur.cnt[w] + ' วัน)</text>';
        var h = '<b>วัน' + DN[w] + '</b> · ' + cur.cnt[w] + ' วันในช่วงนี้' + defs.map(function (df, i) { return '<br><i class="sx-dot" style="background:' + df.c + '"></i>' + df.name + ' ' + n(V(cur, i, w), o.show === 'avg' ? 1 : 0); }).join('') + '<br><b>รวม ' + n(ts[w], o.show === 'avg' ? 1 : 0) + ' ' + UL[o.unit] + (o.show === 'avg' ? '/วัน' : '') + '</b>' + (prv && prv.cnt[w] ? '<br>ก่อนหน้า ' + n(T(prv, w), o.show === 'avg' ? 1 : 0) : '');
        s += '<rect x="' + (pl + gap * w) + '" y="' + pt + '" width="' + gap + '" height="' + (H - pt - pb) + '" fill="transparent"' + tip(h) + '/>';
      }
      var lg = defs.map(function (df) { return { c: df.c, name: df.name }; });
      if (prv) lg.push({ dash: 1, name: 'ช่วงก่อนหน้า' });
      var note = '';
      if (worst >= 0 && best !== worst) {
        note = '<div class="sx-note">📌 <b>วัน' + DN[best] + '</b> สูงสุด ' + n(ts[best], o.show === 'avg' ? 0 : 0) + ' ' + UL[o.unit] + (o.show === 'avg' ? '/วัน' : '') + ' · ต่ำสุด <b>วัน' + DN[worst] + '</b> ' + n(ts[worst]) + ' (ต่างกัน ' + (ts[worst] ? ((ts[best] - ts[worst]) / ts[worst] * 100).toFixed(0) : '–') + '%)</div>';
      }
      var few = daysIn(st.from, st.to) < 14 ? '<div class="sx-note warn">ช่วงสั้นกว่า 2 สัปดาห์ ค่าเฉลี่ยอาจแกว่งได้ (บางวันมีข้อมูลน้อย)</div>' : '';
      return { html: s + '</svg>' + legendHtml(lg) + note + few };
    }
  };

  // 3) Ticket size รายวัน
  C.tk = {
    title: 'Ticket size รายวัน', sub: 'บาท/คัน', cls: 'wide',
    opts: [{ k: 'fuel', ch: [['all', 'รวม'], ['0', 'G95'], ['1', 'G91'], ['2', 'E20'], ['3', 'Diesel']] }],
    def: { fuel: 'all' },
    render: function (st, o, W, H) {
      var fs = o.fuel === 'all' ? st.fsel : [0, 1, 2, 3].map(function (f) { return String(f) === o.fuel; });
      var ser = function (a, b) {
        var r = [];
        for (var d = a; d <= b; d++) { if (!DAY[d]) { r.push(null); continue; } var c = sv(d, fs, 'cars', -1); r.push(c ? sv(d, fs, 'baht', -1) / c : null); }
        return r;
      };
      var cur = ser(st.from, st.to), pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var prv = usePrev ? ser(pv.from, pv.to) : null;
      var all = cur.concat(prv || []).filter(function (v) { return v !== null; });
      if (!all.length) return { html: noData() };
      var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = (hi - lo) * .12 || 10;
      var mn = Math.max(0, Math.floor((lo - pad) / 10) * 10), mx = Math.ceil((hi + pad) / 10) * 10;
      var pl = 50, pr = 12, pt = 12, pb = 28, N = cur.length;
      var X = function (i) { return pl + (W - pl - pr) * (N > 1 ? i / (N - 1) : .5); }, Y = function (v) { return pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn)); };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '">';
      for (var g = 0; g <= 4; g++) { var v = mn + (mx - mn) * g / 4; s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e6edf6"/><text x="' + (pl - 7) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="#6a7a94">' + Math.round(v) + '</text>'; }
      var path = function (a, c, w, da, scale) {
        var p = '', pen = false;
        a.forEach(function (v, i) { if (v === null) { pen = false; return; } p += (pen ? 'L' : 'M') + X(scale ? i * (N - 1) / Math.max(1, a.length - 1) : i) + ',' + Y(v); pen = true; });
        return '<path d="' + p + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" ' + (da ? 'stroke-dasharray="5 4"' : '') + ' stroke-linejoin="round"/>';
      };
      if (prv) s += path(prv, '#8593a9', 1.8, 1, true);
      s += path(cur, PU, 2.3, 0, false);
      var vs = cur.filter(function (v) { return v !== null; }), tc = tot(st.from, st.to, fs, 'cars', -1), av = tc ? tot(st.from, st.to, fs, 'baht', -1) / tc : 0;
      s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(av) + '" y2="' + Y(av) + '" stroke="' + PU + '" stroke-opacity=".4" stroke-dasharray="2 4"/><text x="' + (W - pr - 2) + '" y="' + (Y(av) - 5) + '" text-anchor="end" font-size="11" font-weight="700" fill="' + PU + '">เฉลี่ย ' + n(av) + '</text>';
      var every = Math.max(1, Math.ceil(N / Math.max(2, Math.floor((W - pl) / 80))));
      cur.forEach(function (v, i) { if (i % every === 0) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#6a7a94">' + sd(st.from + i) + '</text>'; });
      var step = (W - pl - pr) / Math.max(1, N - 1);
      cur.forEach(function (v, i) {
        if (v === null) return;
        var h = '<b>' + th(st.from + i) + '</b><br>Ticket size ' + n(v) + ' บาท/คัน' + (prv && prv[i] != null ? '<br>ก่อนหน้า ' + n(prv[i]) : '');
        s += '<rect x="' + (X(i) - step / 2) + '" y="' + pt + '" width="' + step + '" height="' + (H - pt - pb) + '" fill="transparent"' + tip(h) + '/>';
      });
      var lg = [{ c: PU, name: 'ช่วงนี้' }]; if (prv) lg.push({ dash: 1, name: 'ช่วงก่อนหน้า' });
      return { html: s + '</svg>' + legendHtml(lg) };
    }
  };

  // 4) Ticket size ตามวัน/ขนาดรถ
  C.tkw = {
    title: 'Ticket size ตามวัน/ขนาดรถ', sub: 'บาท/คัน',
    opts: [], def: {},
    render: function (st, o, W, H) {
      var pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var calc = function (a, b) {
        var bs = [0, 0, 0, 0, 0, 0, 0], cs = [0, 0, 0, 0, 0, 0, 0];
        for (var d = a; d <= b; d++) { if (!DAY[d]) continue; var w = wdOf(d); bs[w] += sv(d, st.fsel, 'baht', -1); cs[w] += sv(d, st.fsel, 'cars', -1); }
        return bs.map(function (x, i) { return cs[i] ? x / cs[i] : 0; });
      };
      var cur = calc(st.from, st.to), prv = usePrev ? calc(pv.from, pv.to) : null;
      if (!cur.some(function (v) { return v; })) return { html: noData() };
      var h2 = Math.max(150, H - 110), pl = 40, pr = 8, pt = 8, pb = 26, mx = nice(Math.max.apply(null, cur.concat(prv || [])) * 1.1), Y = function (v) { return pt + (h2 - pt - pb) * (1 - v / mx); };
      var gap = (W - pl - pr) / 7, bw = Math.min(40, gap * .64), best = cur.indexOf(Math.max.apply(null, cur));
      var s = '<svg viewBox="0 0 ' + W + ' ' + h2 + '" width="100%" height="' + h2 + '">' + yAxis(W, h2, pl, pr, pt, pb, mx, kfmt, 2);
      cur.forEach(function (v, i) {
        var x = pl + gap * i + (gap - bw) / 2;
        s += '<rect x="' + x + '" y="' + Y(v) + '" width="' + bw + '" height="' + Math.max(0, Y(0) - Y(v)) + '" fill="' + PU + '" opacity="' + (i === best ? 1 : .55) + '" rx="4"/>';
        if (prv && prv[i]) s += '<line x1="' + (x - 4) + '" x2="' + (x + bw + 4) + '" y1="' + Y(prv[i]) + '" y2="' + Y(prv[i]) + '" stroke="#17233a" stroke-width="2" stroke-dasharray="4 3"/>';
        s += '<text x="' + (x + bw / 2) + '" y="' + (Y(v) + 16) + '" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff">' + Math.round(v) + '</text><text x="' + (x + bw / 2) + '" y="' + (h2 - 8) + '" text-anchor="middle" font-size="11.5" fill="' + (i >= 5 ? '#e0603a' : '#31415f') + '">' + DN[i].slice(0, 3) + (i === 3 ? 'ฤ' : '') + '</text>';
        s += '<rect x="' + (pl + gap * i) + '" y="' + pt + '" width="' + gap + '" height="' + (h2 - pt - pb) + '" fill="transparent"' + tip('<b>วัน' + DN[i] + '</b><br>' + n(v) + ' บาท/คัน' + (prv && prv[i] ? '<br>ก่อนหน้า ' + n(prv[i]) : '')) + '/>';
      });
      s += '</svg>';
      var box = SZ.map(function (z, i) {
        var tc = tot(st.from, st.to, st.fsel, 'cars', i), t = tc ? tot(st.from, st.to, st.fsel, 'baht', i) / tc : 0;
        var pc = usePrev ? tot(pv.from, pv.to, st.fsel, 'cars', i) : 0, p = pc ? tot(pv.from, pv.to, st.fsel, 'baht', i) / pc : 0;
        return '<div class="sx-sbox"><i class="sx-dot" style="background:' + SC[i] + '"></i><b>รถ' + z + '</b><div class="v">' + n(t) + '<small> บาท</small></div>' + (usePrev && p ? dtag(dlt(t, p), false) : '') + '</div>';
      }).join('');
      return { html: s + '<div class="sx-sub">แยกตามขนาดรถ</div><div class="sx-sgrid">' + box + '</div>' };
    }
  };

  // 5) พาย สัดส่วนยอดขายตามชนิดน้ำมัน
  C.pie = {
    title: 'สัดส่วนยอดขายตามชนิดน้ำมัน', sub: 'ตามช่วงที่เลือก',
    opts: [{ k: 'unit', ch: [['baht', 'บาท'], ['L', 'ลิตร'], ['cars', 'คัน']] }], def: { unit: 'baht' },
    render: function (st, o, W, H) {
      var pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var fs = [0, 1, 2, 3].filter(function (f) { return st.fsel[f]; });
      var cur = fs.map(function (f) { return totF(st.from, st.to, f, o.unit, -1); }), T = cur.reduce(function (a, b) { return a + b; }, 0);
      if (!T) return { html: noData() };
      var pr = fs.map(function (f) { return usePrev ? totF(pv.from, pv.to, f, o.unit, -1) : 0; }), PT = pr.reduce(function (a, b) { return a + b; }, 0);
      var R = Math.min(86, (Math.min(W, 420) - 20) / 2, (H - 170) / 2 + 40), cx = 90, cy = R + 6, ang = -Math.PI / 2;
      var s = '<div class="sx-piewrap"><svg viewBox="0 0 ' + (cx * 2) + ' ' + (cy * 2 + 4) + '" width="' + (cx * 2) + '" height="' + (cy * 2 + 4) + '">';
      cur.forEach(function (v, i) {
        var a = v / T * 2 * Math.PI, a2 = ang + a, f = fs[i];
        var h = '<b>' + FN[f] + '</b><br>' + n(v) + ' ' + UL[o.unit] + ' (' + (v / T * 100).toFixed(1) + '%)';
        if (v / T > .9999) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + FC[f] + '"' + tip(h) + '/>';
        else if (v > 0) s += '<path d="M' + (cx + R * Math.cos(ang)) + ',' + (cy + R * Math.sin(ang)) + 'A' + R + ',' + R + ' 0 ' + (a > Math.PI ? 1 : 0) + ' 1 ' + (cx + R * Math.cos(a2)) + ',' + (cy + R * Math.sin(a2)) + 'L' + cx + ',' + cy + 'Z" fill="' + FC[f] + '" stroke="#fff" stroke-width="2"' + tip(h) + '/>';
        if (v / T > .06) { var m = ang + a / 2; s += '<text x="' + (cx + R * .62 * Math.cos(m)) + '" y="' + (cy + R * .62 * Math.sin(m) + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" pointer-events="none">' + Math.round(v / T * 100) + '%</text>'; }
        ang = a2;
      });
      s += '</svg></div><div class="sx-plist">' + cur.map(function (v, i) {
        var f = fs[i], sh = v / T * 100, d = usePrev && PT ? sh - pr[i] / PT * 100 : null;
        return '<div><i class="sx-dot" style="background:' + FC[f] + '"></i><b>' + FN[f] + '</b><span class="m">' + n(v) + ' ' + UL[o.unit] + '</span><b>' + sh.toFixed(1) + '%</b>' + (d === null ? '<span class="d"></span>' : '<span class="d ' + (Math.abs(d) < .05 ? '' : d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '▲ +' : '▼ ') + d.toFixed(1) + ' จุด</span>') + '</div>';
      }).join('') + '</div>';
      var top = cur.indexOf(Math.max.apply(null, cur));
      return { html: s + '<div class="sx-note">📌 <b>' + FN[fs[top]] + '</b> สัดส่วนสูงสุด ' + (cur[top] / T * 100).toFixed(1) + '%' + (usePrev ? ' · เทียบช่วงก่อนหน้าแสดงเป็น "จุด" (เปอร์เซ็นต์พอยต์)' : '') + '</div>' };
    }
  };

  // 6) ตารางสรุป
  C.tbl = {
    title: 'สรุปตามชนิดน้ำมัน', cls: 'wide', opts: [], def: {},
    render: function (st) {
      var pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var fs = [0, 1, 2, 3].filter(function (f) { return st.fsel[f]; });
      var row = function (a, b, f) { return { L: totF(a, b, f, 'L', -1), B: totF(a, b, f, 'baht', -1), c: totF(a, b, f, 'cars', -1) }; };
      var R = fs.map(function (f) { return row(st.from, st.to, f); }), P = fs.map(function (f) { return usePrev ? row(pv.from, pv.to, f) : { L: 0, B: 0, c: 0 }; });
      var T = R.reduce(function (a, r) { return { L: a.L + r.L, B: a.B + r.B, c: a.c + r.c }; }, { L: 0, B: 0, c: 0 });
      var PT = P.reduce(function (a, r) { return { L: a.L + r.L, B: a.B + r.B, c: a.c + r.c }; }, { L: 0, B: 0, c: 0 });
      if (!T.B) return { html: noData() };
      var h = '<div class="sx-tw"><table class="sx-t"><tr><th>ชนิด</th><th>ลิตร</th><th>ยอดขาย (บาท)</th><th>สัดส่วน</th><th>คัน</th><th>ลิตร/คัน</th><th>Ticket (บาท/คัน)</th><th>เทียบก่อนหน้า</th></tr>';
      R.forEach(function (r, i) {
        var f = fs[i], d = usePrev ? dlt(r.B, P[i].B) : null;
        h += '<tr><td><i class="sx-dot" style="background:' + FC[f] + '"></i><b>' + FN[f] + '</b></td><td>' + n(r.L) + '</td><td>' + n(r.B) + '</td><td><span class="sx-bar" style="width:' + Math.round(r.B / T.B * 80) + 'px;background:' + FC[f] + '"></span>' + (r.B / T.B * 100).toFixed(1) + '%</td><td>' + n(r.c) + '</td><td>' + (r.c ? (r.L / r.c).toFixed(1) : '–') + '</td><td><b>' + (r.c ? n(r.B / r.c) : '–') + '</b></td><td class="' + (d === null ? '' : d >= 0 ? 'up' : 'dn') + '">' + (d === null ? '–' : (d >= 0 ? '▲ +' : '▼ ') + d.toFixed(1) + '%') + '</td></tr>';
      });
      var dT = usePrev ? dlt(T.B, PT.B) : null;
      h += '<tr class="t"><td>รวม</td><td>' + n(T.L) + '</td><td>' + n(T.B) + '</td><td>100%</td><td>' + n(T.c) + '</td><td>' + (T.c ? (T.L / T.c).toFixed(1) : '–') + '</td><td>' + (T.c ? n(T.B / T.c) : '–') + '</td><td class="' + (dT === null ? '' : dT >= 0 ? 'up' : 'dn') + '">' + (dT === null ? '–' : (dT >= 0 ? '▲ +' : '▼ ') + dT.toFixed(1) + '%') + '</td></tr></table></div>';
      return { html: h };
    }
  };

  // 7) ประเภทรถ
  C.sz = {
    title: 'ประเภทรถ', sub: 'จำนวนคัน แยกตามขนาด', opts: [], def: {},
    render: function (st) {
      var c = SZ.map(function (_, i) { return tot(st.from, st.to, st.fsel, 'cars', i); }), T = c[0] + c[1] + c[2];
      if (!T) return { html: noData() };
      var pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var s = '<div class="sx-szbar">' + c.map(function (v, i) { return '<div style="width:' + Math.max(v / T * 100, v ? 1.2 : 0) + '%;background:' + SC[i] + '"' + tip('<b>รถ' + SZ[i] + '</b><br>' + n(v) + ' คัน') + '></div>'; }).join('') + '</div><div class="sx-szrow">' +
        c.map(function (v, i) {
          var p = usePrev ? tot(pv.from, pv.to, st.fsel, 'cars', i) : 0;
          return '<div><i class="sx-dot" style="background:' + SC[i] + '"></i><b>รถ' + SZ[i] + '</b><br><span class="big">' + n(v) + '</span> <span class="mut">' + (v / T * 100).toFixed(1) + '%</span>' + (usePrev && p ? dtag(dlt(v, p), false) : '') + '</div>';
        }).join('') + '</div><div class="sx-sub">สัดส่วนขนาดรถของแต่ละชนิด</div>';
      [0, 1, 2, 3].filter(function (f) { return st.fsel[f]; }).forEach(function (f) {
        var r = SZ.map(function (_, i) { return totF(st.from, st.to, f, 'cars', i); }), t = r[0] + r[1] + r[2];
        if (!t) return;
        s += '<div class="sx-fz"><div class="nm"><i class="sx-dot" style="background:' + FC[f] + '"></i>' + FN[f] + '</div><div class="b">' + r.map(function (v, i) { return '<div style="width:' + v / t * 100 + '%;background:' + SC[i] + '"' + tip('<b>' + FN[f] + ' · รถ' + SZ[i] + '</b><br>' + n(v) + ' คัน (' + (v / t * 100).toFixed(1) + '%)') + '></div>'; }).join('') + '</div><div class="pc">' + Math.round(r[1] / t * 100) + '% กลาง</div></div>';
      });
      return { html: s };
    }
  };

  // 8) รถรายชั่วโมง
  function hrCalc(a, b, fsel, o, defs) {
    var wdTest = function (d) { var w = wdOf(d); return o.day === 'all' || (o.day === 'wd' ? w < 5 : w >= 5); };
    var nd = 0, sum = defs.map(function () { return new Array(24).fill(0); });
    for (var d = a; d <= b; d++) {
      if (!DAY[d] || !wdTest(d)) continue; nd++;
      var A = HRS[d]; if (!A) continue;
      for (var h = 0; h < 24; h++) for (var f = 0; f < 4; f++) {
        if (!fsel[f]) continue;
        var base = (h * 4 + f) * 3;
        defs.forEach(function (df, i) {
          if (df.f >= 0 && df.f !== f) return;
          sum[i][h] += df.s >= 0 ? A[base + df.s] : A[base] + A[base + 1] + A[base + 2];
        });
      }
    }
    return { nd: nd, v: sum.map(function (r) { return r.map(function (x) { return nd ? (o.show === 'avg' ? x / nd : x) : 0; }); }) };
  }
  C.hr = {
    title: 'รถรายชั่วโมง', sub: 'เฉลี่ยคัน/วัน',
    opts: [
      { k: 'day', l: 'วัน', ch: [['all', 'ทุกวัน'], ['wd', 'จันทร์–ศุกร์'], ['we', 'เสาร์–อาทิตย์']] },
      { k: 'by', l: 'แยกตาม', ch: [['size', 'ขนาดรถ'], ['fuel', 'ชนิดน้ำมัน'], ['none', 'รวม']] },
      { k: 'show', l: 'แสดง', ch: [['avg', 'เฉลี่ยต่อวัน'], ['sum', 'รวมทั้งช่วง']] }
    ], def: { day: 'all', by: 'size', show: 'avg' },
    render: function (st, o, W, H, big) {
      var defs = seriesDefs(o.by, st.fsel), all = [{ f: -1, s: -1 }];
      var cur = hrCalc(st.from, st.to, st.fsel, o, defs), tc = hrCalc(st.from, st.to, st.fsel, o, all).v[0];
      if (!cur.nd) return { html: noData() };
      var pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
      var pt0 = usePrev ? hrCalc(pv.from, pv.to, st.fsel, o, all) : null, pp = pt0 && pt0.nd ? pt0.v[0] : null;
      var mxv = Math.max.apply(null, tc.concat(pp || [])), mx = nice(mxv * 1.1);
      var pl = 44, pr = 12, pt = 14, pb = 28, X = function (i) { return pl + (W - pl - pr) * i / 23; }, Y = function (v) { return pt + (H - pt - pb) * (1 - v / mx); };
      var pk = tc.indexOf(Math.max.apply(null, tc)), s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '">' + yAxis(W, H, pl, pr, pt, pb, mx, kfmt, 4);
      for (var h = 0; h < 24; h += (W > 700 ? 1 : 4)) s += '<text x="' + X(h) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#6a7a94">' + ('0' + h).slice(-2) + (W > 700 ? '' : '.00') + '</text>';
      s += '<rect x="' + (X(pk) - (W - pl - pr) / 46) + '" y="' + pt + '" width="' + ((W - pl - pr) / 23) + '" height="' + (H - pt - pb) + '" fill="' + BLUE + '" opacity=".08" rx="6"/>';
      var path = function (a, c, w, da) { return '<path d="' + a.map(function (v, i) { return (i ? 'L' : 'M') + X(i) + ',' + Y(v); }).join('') + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" ' + (da ? 'stroke-dasharray="6 4"' : '') + ' stroke-linejoin="round"/>'; };
      if (pp) s += path(pp, '#17233a', 2, 1);
      if (defs.length > 1) {
        defs.forEach(function (df, i) { s += path(cur.v[i], df.c, 2.4) + (big ? cur.v[i].map(function (v, k) { return '<circle cx="' + X(k) + '" cy="' + Y(v) + '" r="2.8" fill="' + df.c + '"/>'; }).join('') : ''); });
        s += path(tc, BLUE, 3);
      } else s += path(tc, BLUE, 3);
      s += '<circle cx="' + X(pk) + '" cy="' + Y(tc[pk]) + '" r="5" fill="#fff" stroke="' + BLUE + '" stroke-width="3"/>';
      var colw = (W - pl - pr) / 23;
      for (h = 0; h < 24; h++) {
        var tp = '<b>' + ('0' + h).slice(-2) + '.00–' + ('0' + (h + 1)).slice(-2) + '.00 น.</b>' + (defs.length > 1 ? defs.map(function (df, i) { return '<br><i class="sx-dot" style="background:' + df.c + '"></i>' + df.name + ' ' + n(cur.v[i][h], 1); }).join('') : '') + '<br><b>รวม ' + n(tc[h], 1) + '</b>' + (pp ? '<br>ก่อนหน้า ' + n(pp[h], 1) : '');
        s += '<rect x="' + (X(h) - colw / 2) + '" y="' + pt + '" width="' + colw + '" height="' + (H - pt - pb) + '" fill="transparent"' + tip(tp) + '/>';
      }
      s += '</svg>';
      var lg = defs.length > 1 ? defs.map(function (df) { return { c: df.c, name: df.name }; }).concat([{ c: BLUE, name: 'รวม' }]) : [{ c: BLUE, name: 'รวม' }];
      if (pp) lg.push({ dash: 1, name: 'รวม ช่วงก่อนหน้า' });
      var sumd = tc.reduce(function (a, b) { return a + b; }, 0), seg = function (a, b) { return sumd ? tc.slice(a, b).reduce(function (x, y) { return x + y; }, 0) / sumd * 100 : 0; };
      var extra = '<div class="sx-mini"><div>ชั่วโมงพีค<b>' + ('0' + pk).slice(-2) + '.00–' + ('0' + (pk + 1)).slice(-2) + '.00 น.</b></div><div>ในชั่วโมงพีค<b>' + n(tc[pk], o.show === 'avg' ? 0 : 0) + (o.show === 'avg' ? ' คัน/ชม.' : ' คัน') + '</b></div><div>ช่วงเช้า 06–09 น.<b>' + seg(6, 9).toFixed(0) + '% ของทั้งวัน</b></div><div>ช่วงเย็น 16–19 น.<b>' + seg(16, 19).toFixed(0) + '% ของทั้งวัน</b></div></div>';
      var tbl = '';
      if (big) {
        var hs = []; for (h = 0; h < 24; h++) if (tc[h] > 0.05 || (pp && pp[h] > 0.05)) hs.push(h);
        tbl = '<div class="sx-tw"><table class="sx-ht"><tr><th>ชั่วโมง</th>' + hs.map(function (h) { return '<th>' + ('0' + h).slice(-2) + '</th>'; }).join('') + '</tr><tr><td>รวม (คัน)</td>' + hs.map(function (h) { return '<td><b>' + n(tc[h], o.show === 'avg' ? 0 : 0) + '</b></td>'; }).join('') + '</tr>' +
          (pp ? '<tr><td>ก่อนหน้า</td>' + hs.map(function (h) { return '<td class="mut">' + n(pp[h]) + '</td>'; }).join('') + '</tr><tr><td>เปลี่ยนแปลง</td>' + hs.map(function (h) { var d = dlt(tc[h], pp[h]); return '<td class="' + (d === null ? '' : d >= 0 ? 'up' : 'dn') + '"><b>' + (d === null ? '–' : (d >= 0 ? '+' : '') + d.toFixed(0) + '%') + '</b></td>'; }).join('') + '</tr>' : '') + '</table></div>';
      }
      return { html: (big ? extra : '') + s + legendHtml(lg) + tbl };
    }
  };

  var ORDER = ['area', 'wk', 'tk', 'tkw', 'pie', 'tbl', 'sz', 'hr'];

  /* ---------- UI ---------- */
  var root, tipEl, cards = {}, modal = null;
  var CSS = '#sx{position:fixed;inset:0;z-index:60;overflow:auto;background:linear-gradient(180deg,#bfe0fb 0,#dcedfc 220px,#eaf3fc 100%);font-family:var(--f-body,inherit);color:#17233a;-webkit-overflow-scrolling:touch}#sx[hidden]{display:none}' +
    '#sx *{box-sizing:border-box}.sx-in{max-width:1640px;margin:0 auto;padding:14px 16px 34px}' +
    '.sx-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}.sx-back{border:0;background:#fff;border-radius:12px;padding:9px 14px;font:500 14px var(--f-display,inherit);box-shadow:0 2px 8px #1b3a6a1a;cursor:pointer}' +
    '.sx-top h1{margin:0;font:600 clamp(20px,4vw,28px) var(--f-display,inherit)}.sx-top .by{color:#6a7a94;font-size:13px}' +
    '.sx-card{min-width:0;background:#fff;border-radius:18px;box-shadow:0 3px 12px #1b3a6a1a;padding:14px 16px;position:relative}' +
    '.sx-fil{display:flex;flex-wrap:wrap;gap:10px 20px;align-items:center;padding:12px 16px;margin-bottom:12px}.sx-g{display:flex;align-items:center;gap:7px;font-size:13px;color:#51617c;flex-wrap:wrap}' +
    '.sx-chip{border:1px solid #dbe5f3;background:#eef3fa;color:#31415f;border-radius:18px;padding:6px 12px;font:500 13px var(--f-body,inherit);cursor:pointer;white-space:nowrap}.sx-chip[aria-pressed=true]{background:#1f6be6;color:#fff;border-color:#1f6be6;font-weight:600}' +
    '.sx-chip.sm{padding:4px 10px;font-size:12px}.sx-chip.fx[aria-pressed=false]{opacity:.45}.sx-chip.fx{display:flex;align-items:center;gap:5px}' +
    '.sx-date{border:1px solid #c9d7ea;border-radius:10px;padding:6px 8px;font:600 13px var(--f-body,inherit);background:#fff;color:#17233a}' +
    '.sx-tog{width:38px;height:22px;border-radius:12px;border:0;background:#c7d3e6;position:relative;cursor:pointer;padding:0}.sx-tog:after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}.sx-tog[aria-pressed=true]{background:#1f6be6}.sx-tog[aria-pressed=true]:after{left:19px}' +
    '.sx-dot{display:inline-block;width:11px;height:11px;border-radius:3px;box-shadow:0 0 0 1.5px #fff;margin-right:5px;vertical-align:-1px}.sx-dash{display:inline-block;width:18px;border-top:2px dashed #17233a;vertical-align:3px;margin-right:5px}' +
    '.sx-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:12px}.sx-kpi .l{font-size:13px;color:#5b6b85}.sx-kpi .v{font:700 clamp(22px,2.4vw,30px) var(--f-display,inherit);margin:3px 0 1px}.sx-kpi .v small{font-size:13px;font-weight:500;color:#5b6b85;margin-left:4px}' +
    '.sx-d{font-size:12.5px;font-weight:600}.sx-d small{color:#8593a9;font-weight:400;margin-left:4px}.up{color:#12a150}.dn{color:#e03a3a}' +
    '.sx-grid{display:grid;gap:12px;margin-bottom:12px}.g2{grid-template-columns:1.55fr 1fr}.g3{grid-template-columns:1.5fr 1fr 1fr}.g4{grid-template-columns:1.25fr 1fr 1fr}' +
    '.sx-h{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px}.sx-h h3{margin:0;font:600 16px var(--f-display,inherit);flex:1}.sx-h h3 small{font:400 12px var(--f-body,inherit);color:#6a7a94;margin-left:6px}' +
    '.sx-ex{border:0;background:#eef3fa;border-radius:10px;width:32px;height:32px;cursor:pointer;color:#31415f;font-size:16px;flex:none}.sx-ex:hover{background:#dbe8fb}' +
    '.sx-opts{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0 0 8px;font-size:12px;color:#51617c}.sx-og{display:flex;align-items:center;gap:5px;flex-wrap:wrap}' +
    '.sx-body{cursor:default;overflow:hidden}.sx-card.hit .sx-body{cursor:zoom-in}.sx-lg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;color:#31415f;margin-top:6px}' +
    '.sx-note{margin-top:8px;font-size:12.5px;color:#31415f;background:#f3f7fd;border-radius:10px;padding:8px 12px}.sx-note.warn{background:#fff6e6;color:#8a5a00}' +
    '.sx-empty{padding:40px 10px;text-align:center;color:#8593a9;font-size:14px}.sx-sub{font-size:12px;color:#6a7a94;margin:10px 0 5px}' +
    '.sx-sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sx-sbox{border:1px solid #e4ebf5;border-radius:12px;padding:8px 10px;font-size:12.5px}.sx-sbox .v{font:700 19px var(--f-display,inherit);margin-top:2px}.sx-sbox small{font-size:11px;color:#6a7a94;font-weight:400}' +
    '.sx-piewrap{display:flex;justify-content:center}.sx-plist>div{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0}.sx-plist .m{flex:1;color:#6a7a94}.sx-plist b:first-of-type{width:52px}.sx-plist .d{width:66px;text-align:right;font-size:12px}' +
    '.sx-tw{overflow-x:auto}.sx-t{width:100%;border-collapse:collapse;font-size:13.5px}.sx-t th{font-weight:600;color:#6a7a94;font-size:12px;text-align:right;padding:6px;border-bottom:1px solid #e4ebf5}.sx-t td{text-align:right;padding:9px 6px;border-bottom:1px solid #eef2f8;white-space:nowrap}.sx-t th:first-child,.sx-t td:first-child{text-align:left}.sx-t tr.t td{font-weight:700;border-bottom:0}.sx-bar{display:inline-block;height:8px;border-radius:4px;vertical-align:middle;margin-right:6px}' +
    '.sx-szbar{display:flex;height:32px;border-radius:9px;overflow:hidden;margin:4px 0 8px}.sx-szrow{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-bottom:8px}.sx-szrow .big{font:700 20px var(--f-display,inherit)}.sx-szrow .mut{color:#6a7a94;font-size:12px}' +
    '.sx-fz{display:flex;align-items:center;gap:8px;margin:7px 0;font-size:12.5px}.sx-fz .nm{width:62px}.sx-fz .b{flex:1;display:flex;height:16px;border-radius:5px;overflow:hidden}.sx-fz .pc{width:74px;text-align:right;color:#6a7a94;white-space:nowrap}' +
    '.sx-mini{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:4px 0 12px}.sx-mini div{background:#f3f7fd;border-radius:12px;padding:9px 13px;font-size:12.5px;color:#5b6b85}.sx-mini b{display:block;font:700 clamp(15px,1.6vw,21px) var(--f-display,inherit);color:#17233a;margin-top:2px}' +
    '.sx-ht{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}.sx-ht td,.sx-ht th{padding:5px 6px;text-align:center;border-bottom:1px solid #eef2f8;white-space:nowrap}.sx-ht th:first-child,.sx-ht td:first-child{text-align:left;color:#6a7a94}.sx-ht .mut{color:#8593a9}' +
    '.sx-ov{position:fixed;inset:0;z-index:80;background:rgba(15,29,58,.55);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;overflow:auto}.sx-md{width:min(1300px,100%);background:#fff;border-radius:22px;box-shadow:0 20px 60px rgba(11,26,58,.4);padding:20px 24px 24px;position:relative}.sx-md .sx-h h3{font-size:22px}' +
    '.sx-md .sx-x{position:absolute;right:16px;top:14px;width:36px;height:36px;border-radius:50%;border:0;background:#eef3fa;font-size:18px;cursor:pointer}.sx-md .sx-fil{box-shadow:none;border:1px solid #e4ebf5;padding:10px 12px;margin:10px 0}' +
    '#sxtip{position:fixed;z-index:120;pointer-events:none;background:#17233a;color:#fff;border-radius:10px;padding:8px 11px;font-size:12.5px;line-height:1.5;max-width:260px;box-shadow:0 6px 20px rgba(0,0,0,.3)}#sxtip[hidden]{display:none}#sxtip .sx-dot{margin-right:5px}' +
    '.sx-logo{height:46px;width:auto;max-width:90px;object-fit:contain;display:block}.sx-top h1{display:flex;align-items:center}' +
    '.sx-load{padding:80px 20px;text-align:center;color:#51617c;font-size:15px}' +
    '@media(max-width:1100px){.sx-kpis{grid-template-columns:repeat(2,1fr)}.g2,.g3,.g4{grid-template-columns:1fr}.sx-mini{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.sx-in{padding:10px 10px 30px}.sx-md{padding:16px 12px}}';

  window.SX_CSS = CSS;
  function chipRow(items, cur, attr, extra) {
    return items.map(function (i) { return '<button type="button" class="sx-chip ' + (extra || '') + '" ' + attr + '="' + i[0] + '" aria-pressed="' + (String(cur) === String(i[0])) + '">' + i[1] + '</button>'; }).join('');
  }
  function filterBar(st, withFuel) {
    var pres = [['7', '7 วัน'], ['30', '30 วัน'], ['90', '90 วัน'], ['all', 'ทั้งหมด']];
    return '<div class="sx-g">ช่วงเวลา ' + chipRow(pres, st.pre, 'data-pre') + '</div>' +
      '<div class="sx-g">กำหนดเอง <input type="date" class="sx-date" data-from min="' + iso(FIRST) + '" max="' + iso(LATEST) + '" value="' + iso(st.from) + '"> → <input type="date" class="sx-date" data-to min="' + iso(FIRST) + '" max="' + iso(LATEST) + '" value="' + iso(st.to) + '"></div>' +
      '<div class="sx-g">เทียบช่วงก่อนหน้า <button type="button" class="sx-tog" data-cmp aria-pressed="' + st.cmp + '" aria-label="เทียบช่วงก่อนหน้า"></button><span data-prevlbl>' + prevLbl(st) + '</span></div>' +
      (withFuel ? '<div class="sx-g">ชนิด ' + [0, 1, 2, 3].map(function (f) { return '<button type="button" class="sx-chip sm fx" data-fuel="' + f + '" aria-pressed="' + st.fsel[f] + '"><i class="sx-dot" style="background:' + FC[f] + ';margin:0"></i>' + FN[f] + '</button>'; }).join('') + '</div>' : '');
  }
  function prevLbl(st) { var p = prevOf(st); return haveData(p.from, p.to) ? th(p.from) + ' – ' + th(p.to) : 'ไม่มีข้อมูลช่วงก่อนหน้า'; }

  function bindFilters(host, st, onChange, withFuel) {
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !host.contains(b)) return;
      if (b.dataset.pre) { setPre(st, b.dataset.pre); onChange(true); }
      else if (b.hasAttribute('data-cmp')) { st.cmp = !st.cmp; onChange(true); }
      else if (b.dataset.fuel !== undefined && withFuel) {
        var f = +b.dataset.fuel, c = st.fsel.filter(Boolean).length;
        if (st.fsel[f] && c === 1) return;
        st.fsel[f] = !st.fsel[f]; onChange(true);
      }
    });
    host.addEventListener('change', function (e) {
      var t = e.target; if (!t.classList.contains('sx-date')) return;
      var a = t.hasAttribute('data-from') ? 'from' : 'to', v = t.value; if (!v) return;
      st[a] = Math.min(LATEST, Math.max(FIRST, di(v)));
      if (st.from > st.to) { if (a === 'from') st.to = st.from; else st.from = st.to; }
      st.pre = 'custom'; onChange(true);
    });
  }

  function cardHtml(id, big) {
    var d = C[id];
    return '<div class="sx-h"><h3>' + d.title + (d.sub ? '<small>' + d.sub + '</small>' : '') + '</h3>' + (big ? '' : '<button type="button" class="sx-ex" data-ex="' + id + '" aria-label="ขยาย ' + d.title + '" title="ขยาย">⤢</button>') + '</div>' +
      '<div class="sx-opts" data-opts></div><div class="sx-body" data-body></div>';
  }
  function renderOpts(el, id, o) {
    el.innerHTML = C[id].opts.map(function (op) {
      return '<div class="sx-og">' + (op.l ? op.l + ' ' : '') + chipRow(op.ch, o[op.k], 'data-o="' + op.k + '" data-v', 'sm') + '</div>';
    }).join('');
  }
  // เมื่อเลือกหน่วยเป็นลิตร/บาท ในกราฟที่ไม่มีหน่วยนั้น ให้ปรับอัตโนมัติ (ตอนนี้ทุกหน่วยใช้ได้ทุกแบบ)
  function paint(card) {
    var id = card.id, o = card.o, st = card.st(), body = card.el.querySelector('[data-body]');
    var W = Math.max(280, Math.floor(body.clientWidth || card.el.clientWidth - 32)), big = card.big;
    var H = ({ area: big ? 400 : 340, wk: big ? 420 : 280, tk: big ? 380 : 300, tkw: big ? 330 : 280, pie: 260, tbl: 0, sz: 0, hr: big ? 380 : 250 })[id] || 260;
    renderOpts(card.el.querySelector('[data-opts]'), id, o);
    var r;
    try { r = C[id].render(st, o, W, H, big); } catch (e) { r = { html: noData('แสดงผลไม่ได้: ' + esc(e.message)) }; }
    body.innerHTML = r.html;
    card.el.classList.toggle('hit', !big);
  }
  function mkCard(id, st, big) {
    var el = document.createElement('div'); el.className = 'sx-card' + (big ? '' : ' c-' + id); el.innerHTML = cardHtml(id, big);
    var o = {}; for (var k in C[id].def) o[k] = C[id].def[k];
    var c = { id: id, el: el, o: o, st: st, big: big };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-o]');
      if (b) { c.o[b.dataset.o] = b.dataset.v; paint(c); return; }
      if (!big && (e.target.closest('[data-ex]') || e.target.closest('[data-body]') && !e.target.closest('a,button'))) openModal(id, c.o);
    });
    return c;
  }

  function kpiHtml(st) {
    var pv = prevOf(st), usePrev = st.cmp && haveData(pv.from, pv.to);
    var tb = tot(st.from, st.to, st.fsel, 'baht', -1), tl = tot(st.from, st.to, st.fsel, 'L', -1), tc = tot(st.from, st.to, st.fsel, 'cars', -1), nd = daysIn(st.from, st.to);
    var P = function (u) { return usePrev ? tot(pv.from, pv.to, st.fsel, u, -1) : 0; }, pnd = usePrev ? daysIn(pv.from, pv.to) : 0;
    var D = function (a, b) { return usePrev && b ? dtag(dlt(a, b)) : '<div class="sx-d">&nbsp;</div>'; };
    var K = [['ยอดขายรวม', n(tb), 'บาท', D(tb, P('baht'))], ['ปริมาณขาย (จาก POS)*', n(tl), 'ลิตร', D(tl, P('L'))], ['จำนวนรถ', n(tc), 'คัน', D(tc, P('cars'))],
      ['Ticket size เฉลี่ย', tc ? n(tb / tc) : '–', 'บาท/คัน', D(tc ? tb / tc : 0, P('cars') ? P('baht') / P('cars') : 0)], ['เฉลี่ยต่อวัน', nd ? n(tc / nd) : '–', 'คัน', D(nd ? tc / nd : 0, pnd ? P('cars') / pnd : 0)]];
    return K.map(function (k) { return '<div class="sx-card sx-kpi"><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '<small>' + k[2] + '</small></div>' + k[3] + '</div>'; }).join('');
  }

  var pageCards = [];
  function build() {
    root.innerHTML = '<div class="sx-in"><div class="sx-top"><button type="button" class="sx-back" id="sxBack">← ภาพรวม</button><img class="sx-logo" src="pttm.png" alt="ปตท."><h1>ยอดขายน้ำมัน</h1><span class="by" id="sxBy"></span></div>' +
      '<div class="sx-card sx-fil" id="sxFil"></div><div class="sx-kpis" id="sxK"></div>' +
      '<div class="sx-grid g2" id="r1"></div><div class="sx-grid g3" id="r2"></div><div class="sx-grid g4" id="r3"></div>' +
      '<div class="sx-note" style="text-align:center;background:none">เกณฑ์ขนาดรถ: ≤4 ลิตร เล็ก · >4–80 ลิตร กลาง · >80 ลิตร ใหญ่ · 1 รายการ = 1 คัน (รายงานลูกค้าทั่วไป) · รายการ “เปลี่ยนแปลงการชำระ” ที่ซ้ำนับเป็น 1 รายการ</div>' +
      '<div class="sx-note" style="text-align:center;background:none;margin-top:2px">* ลิตรจาก POS สูงกว่ายอดมิเตอร์ของ ปตท. ราว 1% เนื่องจาก POS คำนวณลิตรจากยอดเงิน ส่วนมิเตอร์วัดน้ำมันที่จ่ายจริง</div></div>';
    pageCards = [];
    var place = { r1: ['area', 'wk'], r2: ['tk', 'tkw', 'pie'], r3: ['tbl', 'sz', 'hr'] };
    Object.keys(place).forEach(function (r) { place[r].forEach(function (id) { var c = mkCard(id, function () { return G; }, false); pageCards.push(c); root.querySelector('#' + r).appendChild(c.el); }); });
    root.querySelector('#sxBack').onclick = close;
    bindFilters(root.querySelector('#sxFil'), G, function () { refresh(); }, true);
    refresh();
  }
  function refresh() {
    root.querySelector('#sxFil').innerHTML = filterBar(G, true);
    root.querySelector('#sxK').innerHTML = kpiHtml(G);
    root.querySelector('#sxBy').textContent = 'ข้อมูลถึง ' + th(LATEST) + ' · ช่วงที่เลือก ' + th(G.from) + ' – ' + th(G.to) + ' (' + daysIn(G.from, G.to) + ' วัน)';
    pageCards.forEach(paint);
  }

  function openModal(id, o0) {
    closeModal();
    var st = clone(G), ov = document.createElement('div'); ov.className = 'sx-ov';
    ov.innerHTML = '<div class="sx-md"><button type="button" class="sx-x" aria-label="ปิด">✕</button><div data-slot></div></div>';
    var c = mkCard(id, function () { return st; }, true);
    for (var k in o0) c.o[k] = o0[k];
    var slot = ov.querySelector('[data-slot]'), fil = document.createElement('div'); fil.className = 'sx-card sx-fil';
    var head = c.el.querySelector('.sx-h'); c.el.className = ''; slot.appendChild(c.el);
    head.insertAdjacentElement('afterend', fil);
    var refreshM = function () { fil.innerHTML = filterBar(st, true); paint(c); };
    bindFilters(fil, st, refreshM, true);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.sx-x')) closeModal(); });
    document.body.appendChild(ov); modal = { ov: ov, c: c, repaint: function () { paint(c); } };
    refreshM();
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { if (modal) { modal.ov.remove(); modal = null; } if (root && root.hidden) document.body.style.overflow = ''; else document.body.style.overflow = ''; }

  /* ---------- open / close / load ---------- */
  var loading = false, loaded = false;
  function endpoint() {
    var u = CFG.API_URL;
    if (!u) return null;
    return u + (u.indexOf('?') > -1 ? '&' : '?') + 'view=sales' + (CFG.TOKEN ? '&token=' + encodeURIComponent(CFG.TOKEN) : '');
  }
  function fetchJson(u) {
    return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function load() {
    if (loading) return; loading = true;
    root.innerHTML = '<div class="sx-in"><div class="sx-top"><button type="button" class="sx-back" id="sxBack">← ภาพรวม</button><img class="sx-logo" src="pttm.png" alt="ปตท."><h1>ยอดขายน้ำมัน</h1></div><div class="sx-load">กำลังโหลดข้อมูล…</div></div>';
    root.querySelector('#sxBack').onclick = close;
    var u = endpoint();
    (u ? fetchJson(u) : fetchJson('sales-sample.json')).then(function (p) {
      if (p && p.error) throw new Error(p.error);
      ingest(p);
      if (!READY) throw new Error('ยังไม่มีข้อมูลในแท็บ fuel_daily');
      setPre(G, G.pre); loaded = true; loading = false; build();
      if (!u) root.querySelector('#sxBy').textContent += ' · ข้อมูลตัวอย่าง';
    }).catch(function (e) {
      loading = false;
      root.querySelector('.sx-load').innerHTML = 'โหลดข้อมูลไม่สำเร็จ: ' + esc(e.message) + '<br><br><button type="button" class="sx-chip" id="sxRetry">ลองใหม่</button>';
      root.querySelector('#sxRetry').onclick = load;
    });
  }
  function open() {
    if (!root) init();
    root.hidden = false; window.SX_OPEN = true; document.body.style.overflow = 'hidden';
    if (!loaded) load(); else { build(); }
  }
  function close() { closeModal(); window.SX_OPEN = false; if (root) root.hidden = true; document.body.style.overflow = ''; var t = document.querySelector('.tab[data-k="ov"]'); if (t) t.click(); }
  function init() {
    if (!document.getElementById('sxcss')) { var st = document.createElement('style'); st.id = 'sxcss'; st.textContent = CSS; document.head.appendChild(st); }
    root = document.createElement('div'); root.id = 'sx'; root.hidden = true; document.body.appendChild(root);
    tipEl = document.getElementById('sxtip');
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'sxtip'; tipEl.hidden = true; document.body.appendChild(tipEl);
    document.addEventListener('mousemove', function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]');
      if (!t) { tipEl.hidden = true; return; }
      tipEl.innerHTML = t.getAttribute('data-tip'); tipEl.hidden = false;
      var w = tipEl.offsetWidth, h = tipEl.offsetHeight, x = e.clientX + 14, y = e.clientY + 14;
      if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 14;
      tipEl.style.left = Math.max(4, x) + 'px'; tipEl.style.top = Math.max(4, y) + 'px';
    }); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (modal) closeModal(); else if (root && !root.hidden) close(); } });
    var rz = 0; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (root && !root.hidden && loaded) { pageCards.forEach(paint); if (modal) modal.repaint(); } }, 150); });
  }

  window.SalesPage = { open: open, close: close };
  document.addEventListener('DOMContentLoaded', function () {
    var tabs = document.getElementById('tabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      if (b.dataset.k === 'fuel') open();
      else if (root && !root.hidden) { root.hidden = true; window.SX_OPEN = false; closeModal(); document.body.style.overflow = ''; }
    }, true);
  });
})();
