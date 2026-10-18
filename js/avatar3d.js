/* ============================================================
 * avatar3d.js — 参数化 3D 人物模型（零依赖 Canvas 渲染）
 * 以几何体块（De Stijl 语言）拼装人体：
 * 围度来自 engine.measurements()，当前/目标体重分别驱动形变
 * ============================================================ */
(function (global) {
  'use strict';

  var INK = '#111111', PAPER = '#FAFAF5';
  var PAL = {
    skin:['#F2C9A0','#E0AC78'],
    red:'#E62325', yellow:'#F7D41A', blue:'#1E4E9C',
    gray:'#C9C9C2', dark:'#3A3A38', white:'#FFFFFF'
  };

  /* ---------- 3D 数学 ---------- */
  function rotY(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return { x:p.x * c + p.z * s, y:p.y, z:-p.x * s + p.z * c };
  }
  function rotX(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return { x:p.x, y:p.y * c - p.z * s, z:p.y * s + p.z * c };
  }
  function project(p, cx, cy, scale, view) {
    var d = view.d, s = d / (d + p.z);
    return { x:cx + p.x * scale * s, y:cy - p.y * scale * s, z:p.z, s:s };
  }

  /* 生成长方体 8 顶点（以原点为中心，y 偏移） */
  function box(w, h, d, y0) {
    var v = [], xs = [-w/2, w/2], ys = [y0, y0 + h], zs = [-d/2, d/2];
    ys.forEach(function (yy) {
      zs.forEach(function (zz) {
        xs.forEach(function (xx) { v.push({ x:xx, y:yy, z:zz }); });
      });
    });
    return v; // 0..7
  }
  var BOX_F = [[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]];
  var BOX_FE = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];

  function ellipsoid(cx, cy, cz, rx, ry, rz, lat, lon) {
    // 以经纬网格生成四边形片
    var faces = [];
    for (var i = 0; i < lat; i++) {
      var t0 = Math.PI * i / lat, t1 = Math.PI * (i + 1) / lat;
      for (var j = 0; j < lon; j++) {
        var p0 = Math.PI * 2 * j / lon, p1 = Math.PI * 2 * (j + 1) / lon;
        faces.push([
          { x:cx + rx * Math.sin(t0) * Math.cos(p0), y:cy + ry * Math.cos(t0), z:cz + rz * Math.sin(t0) * Math.sin(p0) },
          { x:cx + rx * Math.sin(t0) * Math.cos(p1), y:cy + ry * Math.cos(t0), z:cz + rz * Math.sin(t0) * Math.sin(p1) },
          { x:cx + rx * Math.sin(t1) * Math.cos(p1), y:cy + ry * Math.cos(t1), z:cz + rz * Math.sin(t1) * Math.sin(p1) },
          { x:cx + rx * Math.sin(t1) * Math.cos(p0), y:cy + ry * Math.cos(t1), z:cz + rz * Math.sin(t1) * Math.sin(p0) }
        ]);
      }
    }
    return faces;
  }

  function cylinder(cx, z0, y0, y1, rTop, rBot, seg) {
    var faces = [];
    for (var j = 0; j < seg; j++) {
      var a0 = Math.PI * 2 * j / seg, a1 = Math.PI * 2 * (j + 1) / seg;
      faces.push([
        { x:cx + rBot * Math.cos(a0), y:y0, z:z0 + rBot * Math.sin(a0) },
        { x:cx + rBot * Math.cos(a1), y:y0, z:z0 + rBot * Math.sin(a1) },
        { x:cx + rTop * Math.cos(a1), y:y1, z:z0 + rTop * Math.sin(a1) },
        { x:cx + rTop * Math.cos(a0), y:y1, z:z0 + rTop * Math.sin(a0) }
      ]);
    }
    return faces;
  }

  function shadeFix(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(Math.min(255, ((n >> 16) & 255) * k));
    var g = Math.round(Math.min(255, ((n >> 8) & 255) * k));
    var b = Math.round(Math.min(255, (n & 255) * k));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------- 由身体数据生成模型参数 ---------- */
  /* 围度→形变增益放大：真实围度变化 1% 视觉放大约 gain%，
     让小幅调整即可感知、大幅调整差异显著；cap 钳制防比例失调
     （躯干 cap 较高覆盖 40–160cm 输入区间，四肢 cap 较低防穿模） */
  function amp(v, gain, cap) {
    return Math.max(0.55, Math.min(cap || 1.68, 1 + (v - 1) * (gain || 2.2)));
  }
  /* m: measurements(含 height); bf: 体脂率%; sex */
  function buildBody(m, bf, sex, photoTone) {
    var fat = (bf - (sex === 'male' ? 15 : 22)) / 30; // 相对胖瘦
    var skinTone = photoTone != null
      ? ['#F2C9A0', '#E7B78A', '#D79B6A', '#B97C4E'][Math.max(0, Math.min(3, photoTone))]
      : (sex === 'male' ? PAL.skin[1] : PAL.skin[0]);
    // 身高→整体纵向比例（同绝对围度在更高人体上相对更窄，符合真实几何）
    var hs = Math.max(0.86, Math.min(1.14, (m.height || 175) / 175));
    var inv = 1 / hs;
    var male = sex === 'male';
    return {
      skin:skinTone,
      heightScale:hs,
      head:0.118 * inv,
      neck:0.045 * inv,
      // 以身高 1.75m 归一化 × 围度增益放大 × 身高补偿
      shoulderW:0.245 * amp(m.shoulder / (male ? 41.6 : 38.8), 1.9) * inv,
      chestW:0.155 * amp(m.chest / (male ? 90 : 87.5), 2.0, 1.85) * inv,
      chestD:0.115 * amp(m.chest / (male ? 90 : 87.5), 1.9, 1.75) * inv,
      waistW:0.135 * amp(m.waist / (male ? 73.5 : 67.4), 2.2, 2.0) * inv,
      waistD:0.100 * amp(m.waist / (male ? 73.5 : 67.4), 2.4, 2.0) * inv,
      hipW:0.150 * amp(m.hip / (male ? 72.6 : 77.8), 2.2, 1.9) * inv,
      hipD:0.118 * amp(m.hip / (male ? 72.6 : 77.8), 2.0, 1.8) * inv,
      armR:0.040 * amp(m.upperArm / (male ? 18.9 : 17.2), 2.6) * inv,
      thighR:0.062 * amp(m.thigh / (male ? 47.2 : 45.8), 2.5) * inv,
      calfR:0.042 * amp(m.calf / (male ? 24.8 : 23.8), 2.6) * inv,
      muscle:Math.max(0, -fat) * 0.35
    };
  }

  /* ---------- 主渲染 ---------- */
  function render(canvas, B, opt) {
    opt = opt || {};
    var stopped = false;
    // 目标参数 target 与当前渲染参数 cur 分离：每帧指数趋近实现平滑形变过渡，
    // cur 挂在 canvas 元素上，rebuild 后仍可无缝衔接（不从头跳变）
    var target = B;
    var cur = canvas.__bodyCur || null;
    var ratio = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));

    function size() {
      var w = canvas.clientWidth || 300, h = canvas.clientHeight || 330;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      return { w:w, h:h };
    }

    function frame(angle, dt) {
      /* —— 维度参数平滑插值：kk 随帧时长自适应，约 0.3s 收敛，无卡顿跳变 —— */
      if (!cur) cur = JSON.parse(JSON.stringify(target));
      var kk = dt != null ? 1 - Math.exp(-dt * 9) : 1;
      for (var pk in target) {
        if (typeof target[pk] === 'number') {
          var pv = cur[pk] != null ? cur[pk] : target[pk];
          cur[pk] = pv + (target[pk] - pv) * kk;
        } else cur[pk] = target[pk];
      }
      canvas.__bodyCur = cur;
      var B = cur;

      var sz = size(), ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      var w = sz.w, h = sz.h;
      ctx.clearRect(0, 0, w, h);

      // 地面网格
      var cy = h * 0.935, cx = w / 2;
      ctx.strokeStyle = '#D8D8D2'; ctx.lineWidth = 1;
      for (var gy = 0; gy < 4; gy++) {
        var yy = cy - 6 - gy * 14;
        ctx.beginPath(); ctx.moveTo(w * 0.12, yy); ctx.lineTo(w * 0.88, yy); ctx.stroke();
      }

      // 身高参与整体缩放；0.74 保证最高身高（hs=1.14）含透视外扩时头顶仍完整入画
      var SCALE = h * 0.74 * (B.heightScale || 1);
      var view = { d:3.2 };
      var sway = Math.sin(angle * 0.7) * 0.04;
      var P = function (p) {
        var q = rotY(p, angle);
        q = rotX(q, 0.05 + sway);
        return project(q, cx, cy, SCALE, view);
      };

      /* 收集所有可绘制面片 {depth, draw} */
      var items = [];

      function addFaces(faces, color, outline) {
        faces.forEach(function (f) {
          var q = f.map(P);
          var z = (q[0].z + q[1].z + q[2].z + q[3].z) / 4;
          // 光照：用法向量 y 分量近似（以屏幕法线）
          var ux = q[1].x - q[0].x, uy = q[1].y - q[0].y;
          var vx = q[3].x - q[0].x, vy = q[3].y - q[0].y;
          var nz = ux * vy - uy * vx;
          if (nz >= 0) return; // 背朝相机
          var light = 0.72 + 0.28 * Math.min(1, (z + 0.5) / 0.9);
          items.push({ z:z, fn:function () {
            ctx.beginPath();
            ctx.moveTo(q[0].x, q[0].y); q.slice(1).forEach(function (t) { ctx.lineTo(t.x, t.y); });
            ctx.closePath();
            ctx.fillStyle = shadeFix(color, light);
            ctx.fill();
            if (outline !== false) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke(); }
          }});
        });
      }

      /* x0/z0：关节与鞋等附属体块需跟随肢体横向/纵向位置，默认在身体中线 */
      function addBox(w0, hh, dd, y0, color, x0, z0) {
        var verts = box(w0, hh, dd, y0);
        if (x0 || z0) verts = verts.map(function (v) { return { x:v.x + (x0 || 0), y:v.y, z:v.z + (z0 || 0) }; });
        BOX_F.forEach(function (face, fi) {
          var q = face.map(function (idx) { return P(verts[idx]); });
          var z = q.reduce(function (s, t) { return s + t.z; }, 0) / 4;
          items.push({ z:z, fn:function () {
            ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); q.slice(1).forEach(function (t) { ctx.lineTo(t.x, t.y); }); ctx.closePath();
            ctx.fillStyle = shadeFix(color, 0.8 + 0.2 * Math.min(1, (z + 0.5) / 0.9));
            ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
          }});
        });
      }

      /* ===== 身体拼装（单位：身高 1.0，y=0 脚底） =====
       * De Stijl 纯几何语言：全身仅用方块/方柱/截顶盒概括人体，
       * 不使用曲面体，水平垂直构成 + 原色块面 + 黑色描边 */
      var ms = B.muscle || 0;
      // 头（方块）
      addBox(B.head * 1.56, B.head * 1.9, B.head * 1.6, 0.915 - B.head * 0.95, B.skin);
      // 颈（方柱）
      addBox(B.neck * 2.1, 0.04, B.neck * 2.1, 0.835, B.skin);
      // 躯干：胸（红/蓝衣块）— 用两段截顶盒近似
      torsoBlock(0.83, 0.62, B.chestW, Math.min(B.shoulderW * 0.96, B.chestW * 1.5), B.chestD, opt.shirt || PAL.red);
      // 腰（黄色）
      torsoBlock(0.62, 0.50, B.waistW * 1.02, Math.min(B.chestW * 0.94, B.waistW * 1.6), B.waistD, PAL.yellow);
      // 髋（深蓝裤）
      torsoBlock(0.50, 0.40, B.hipW, B.waistW * 1.05, B.hipD, PAL.blue);

      function torsoBlock(yTop, yBot, wBot, wTop, dep, color) {
        addFaces(frustumBox(wTop, wBot, dep * 1.02, dep * 0.96, yBot, yTop), color);
      }

      // 手臂（肩摆动）；半径钳制在肩宽比例内防止与躯干穿模；
      // 腰围增宽时手臂自然外推（贴靠体侧），避免手臂嵌入腹部
      var swing = Math.sin(angle * 0.7) * 0.18;
      var ra = Math.max(0.016, Math.min(B.armR * (1 + ms), B.shoulderW * 0.30));
      var attach = Math.max(B.shoulderW * 0.5, B.waistW * 0.5 + ra * 0.6);
      arm(1, swing, ra, attach);
      arm(-1, -swing, ra, attach);
      function arm(side, sw, r, sx) {
        // 关键：sx 必须乘以 side——右臂 +sx / 左臂 -sx，缺失会导致两臂重叠在同侧
        var ax = side * sx;
        // 上臂（方柱）
        addBox(r * 1.9, 0.21, r * 1.9, 0.59, side > 0 ? PAL.dark : PAL.gray, ax + side * sw * 0.02, 0);
        // 肘关节（黑色方块，跟随手臂横向位置）
        addBox(r * 1.5, r * 1.5, r * 1.5, 0.59 - r * 0.75, INK, ax + side * sw * 0.03, 0);
        // 前臂（方柱）
        addBox(r * 1.65, 0.18, r * 1.65, 0.40, B.skin, ax + side * sw * 0.05, 0);
        // 手（方块）
        addBox(r * 1.7, r * 2.1, r * 1.7, 0.38 - r * 1.05, B.skin, ax + side * sw * 0.06, 0);
      }

      // 腿
      var legSwing = -swing * 0.6;
      leg(1, legSwing, B);
      leg(-1, -legSwing, B);
      function leg(side, sw0, BB) {
        // 半径钳制：大腿不超过髋宽比例、小腿不超过大腿，防止双腿重叠穿模；
        // 粗腿向外撑开（hx 随 rT 外移），形变清晰且不重叠
        var rT = Math.max(0.028, Math.min(BB.thighR, BB.hipW * 0.55));
        var rC = Math.max(0.020, Math.min(BB.calfR, rT * 0.82));
        var hx = side * Math.max(BB.hipW * 0.42, rT * 0.95);
        // 大腿（方柱）
        addBox(rT * 2.0, 0.165, rT * 2.0, 0.235, side > 0 ? PAL.blue : '#173B78', hx + side * sw0 * 0.02, 0);
        // 膝（黑色方块，跟随腿部横向位置）
        addBox(rC * 1.5, rC * 1.5, rC * 1.5, 0.235 - rC * 0.75, INK, hx + side * sw0 * 0.025, 0);
        // 小腿（方柱）
        addBox(rC * 1.75, 0.18, rC * 1.75, 0.045, side > 0 ? '#3A3A38' : '#55514C', hx + side * sw0 * 0.03, 0);
        // 鞋（跟随脚部位置，微向前伸朝向镜头）
        addBox(rC * 2.2, rC * 1.1, rC * 3.2, 0.0, side > 0 ? PAL.white : PAL.red, hx + side * sw0 * 0.03, rC * 0.7);
      }

      // 深度排序绘制（画家算法）
      items.sort(function (a, b) { return a.z - b.z; });
      items.forEach(function (it) { it.fn(); });

      // 前景装饰：角落方块
      var cs = 12;
      ctx.fillStyle = PAL.red; ctx.fillRect(6, 6, cs, cs); ctx.strokeRect(6, 6, cs, cs);
      ctx.fillStyle = PAL.blue; ctx.fillRect(w - 6 - cs, h - 6 - cs, cs, cs); ctx.strokeRect(w - 6 - cs, h - 6 - cs, cs, cs);
    }

    function frustumBox(wTop, wBot, dTop, dBot, yBot, yTop) {
      var f = [[],[],[],[]];
      var combos = [
        [-1, yBot, -1, 0],[1, yBot, -1, 1],[1, yTop, -1, 2],[-1, yTop, -1, 3],
        [-1, yBot, 1],[1, yBot, 1]
      ];
      // 前面
      var faces = [];
      var A = { x:-wBot/2, y:yBot, z:-dBot/2 }, B = { x:wBot/2, y:yBot, z:-dBot/2 },
          C = { x:wTop/2, y:yTop, z:-dTop/2 }, D = { x:-wTop/2, y:yTop, z:-dTop/2 };
      var E = { x:-wBot/2, y:yBot, z:dBot/2 }, F = { x:wBot/2, y:yBot, z:dBot/2 },
          G = { x:wTop/2, y:yTop, z:dTop/2 }, H = { x:-wTop/2, y:yTop, z:dTop/2 };
      faces.push([A,B,C,D],[E,H,G,F],[A,E,H,D],[B,F,G,C],[D,C,G,H],[A,B,F,E]);
      return faces;
    }

    var t0 = 0, last = 0, running = true;
    function loop(ts) {
      if (stopped) return;
      if (!last) last = ts;
      var dt = Math.min(0.04, (ts - last) / 1000); last = ts;
      t0 += dt;
      if (!opt.staticAngle) frame(t0 * 1.1, dt);
      else frame(opt.staticAngle);
      requestAnimationFrame(loop);
    }
    if (opt.staticAngle != null) frame(opt.staticAngle);
    else requestAnimationFrame(loop);

    // 返回停止函数 + setBody：更新目标参数即可触发平滑形变，无需销毁重建
    var handle = function () { stopped = true; };
    handle.setBody = function (nb) { target = nb; };
    return handle;
  }

  /* ---------- 照片特征分析（本地，不上传） ----------
   * 输出：肤色档位 0-3、画面亮度、边缘比例、主色块
   * 仅用于风格化模型的肤色与体型微调提示，全部在本机计算
   */
  function analyzePhoto(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = 64; c.height = 96;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 64, 96);
        var data;
        try { data = ctx.getImageData(0, 0, 64, 96).data; } catch (e) { resolve(null); return; }
        var sumL = 0, skinLike = [], edge = 0, prevL = null;
        for (var y = 0; y < 96; y++) {
          for (var x = 0; x < 64; x++) {
            var i = (y * 64 + x) * 4;
            var r = data[i], g = data[i + 1], b = data[i + 2];
            var lum = 0.299 * r + 0.587 * g + 0.114 * b;
            sumL += lum;
            // 肤色判定（YCbCr 近似）
            var cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            var cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
            if (cr > 133 && cr < 180 && cb > 77 && cb < 127 && lum > 40) skinLike.push(lum);
            if (prevL != null && Math.abs(lum - prevL) > 40) edge++;
            prevL = lum;
          }
        }
        var avgL = sumL / (64 * 96);
        var skinLum = skinLike.length ? skinLike.reduce(function (a, b) { return a + b; }, 0) / skinLike.length : avgL;
        var tone = skinLum > 200 ? 0 : skinLum > 165 ? 1 : skinLum > 125 ? 2 : 3;
        resolve({
          tone:tone,
          brightness:Math.round(avgL),
          edgeRatio:Math.round(edge / (64 * 96) * 1000) / 10,
          skinCoverage:Math.round(skinLike.length / (64 * 96) * 100),
          width:img.naturalWidth, height:img.nativeHeight || img.naturalHeight
        });
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  global.FITAVATAR = { buildBody:buildBody, render:render, analyzePhoto:analyzePhoto };
})(window);
