/* ============================================================
 * charts.js — 极简几何图表（Canvas，DPR 自适应）
 * ============================================================ */
(function (global) {
  'use strict';

  function setup(c) {
    var ratio = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    var w = c.clientWidth || +c.getAttribute('width') || 200;
    var h = c.clientHeight || +c.getAttribute('height') || 200;
    c.width = Math.round(w * ratio);
    c.height = Math.round(h * ratio);
    var ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, w, h);
    return { ctx:ctx, w:w, h:h };
  }

  function drawText(ctx, txt, x, y, size, bold, align, color) {
    ctx.fillStyle = color || '#111';
    ctx.font = (bold ? '900 ' : '700 ') + size + 'px Arial,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
  }

  /* ---------- 环形仪表 ---------- */
  function ring(canvas, opt) {
    var s = setup(canvas), ctx = s.ctx, w = s.w, h = s.h;
    var cx = w / 2, cy = h / 2 + (opt.dy || 0);
    var r = Math.min(w, h) / 2 - (opt.thick || 12);
    var thick = opt.thick || 12;
    var pct = Math.max(0, Math.min(1.15, (opt.value || 0) / (opt.max || 1)));
    // 底色网格
    ctx.strokeStyle = '#E4E4DE'; ctx.lineWidth = thick;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // 数值弧
    var over = pct > 1;
    ctx.strokeStyle = over ? '#E62325' : (opt.color || '#1E4E9C');
    ctx.lineWidth = thick;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pct)); ctx.stroke();
    // 外框黑环（风格派特征）
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r + thick / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r - thick / 2, 0, Math.PI * 2); ctx.stroke();
    // 中央文字
    drawText(ctx, opt.center, cx, cy - 7, opt.big || 26, true, 'center', '#111');
    if (opt.sub) drawText(ctx, opt.sub, cx, cy + 16, 11, true, 'center', '#9A9A94');
    if (opt.label) drawText(ctx, opt.label, cx, h - 12, 10.5, true, 'center', '#6B6B6B');
  }

  /* ---------- 分组柱状（摄入 vs 消耗） ---------- */
  function bars(canvas, items, opt) {
    opt = opt || {};
    var s = setup(canvas), ctx = s.ctx, w = s.w, h = s.h;
    var padL = 34, padB = 24, padT = 14, padR = 8;
    var max = opt.max || Math.max.apply(null, items.map(function (it) {
      return Math.max(it.v1 || 0, it.v2 || 0); })) * 1.15 || 100;
    // 网格线
    ctx.strokeStyle = '#D8D8D2'; ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = padT + (h - padT - padB) * i / 4;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }
    var n = items.length, slot = (w - padL - padR) / n;
    items.forEach(function (it, idx) {
      var x0 = padL + slot * idx;
      var bw = Math.min(16, slot * 0.28);
      var bh = (h - padT - padB) * (it.v1 || 0) / max;
      var x = x0 + slot / 2 - bw - 2;
      ctx.fillStyle = opt.c1 || '#1E4E9C';
      ctx.fillRect(x, h - padB - bh, bw, bh);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(x, h - padB - bh, bw, bh);
      if (it.v2 != null) {
        var bh2 = (h - padT - padB) * it.v2 / max;
        var x2 = x0 + slot / 2 + 2;
        ctx.fillStyle = opt.c2 || '#F7D41A';
        ctx.fillRect(x2, h - padB - bh2, bw, bh2);
        ctx.strokeRect(x2, h - padB - bh2, bw, bh2);
      }
      drawText(ctx, it.label, x0 + slot / 2, h - 9, 10, true, 'center', '#6B6B6B');
    });
    // 轴框
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();
  }

  /* ---------- 折线趋势 ---------- */
  function spark(canvas, values, opt) {
    opt = opt || {};
    var s = setup(canvas), ctx = s.ctx, w = s.w, h = s.h;
    var pad = 16;
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    if (max === min) { max += 1; min -= 1; }
    var stepX = (w - pad * 2) / Math.max(1, values.length - 1);
    // 网格
    ctx.strokeStyle = '#E4E4DE'; ctx.lineWidth = 1;
    for (var g = 0; g <= values.length - 1; g++) {
      var gx = pad + stepX * g;
      ctx.beginPath(); ctx.moveTo(gx, 8); ctx.lineTo(gx, h - 18); ctx.stroke();
    }
    function pt(i) {
      return { x:pad + stepX * i, y:h - 18 - (h - 32) * (values[i] - min) / (max - min) };
    }
    // 面积
    ctx.beginPath();
    values.forEach(function (v, i) { var p = pt(i); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.lineTo(pt(values.length - 1).x, h - 18); ctx.lineTo(pt(0).x, h - 18); ctx.closePath();
    ctx.fillStyle = opt.fill || 'rgba(247,212,26,.25)'; ctx.fill();
    // 线
    ctx.beginPath();
    values.forEach(function (v, i) { var p = pt(i); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.strokeStyle = opt.color || '#E62325'; ctx.lineWidth = 3; ctx.stroke();
    // 点
    values.forEach(function (v, i) {
      var p = pt(i);
      ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
    });
  }

  global.FITCHARTS = { ring:ring, bars:bars, spark:spark };
})(window);
