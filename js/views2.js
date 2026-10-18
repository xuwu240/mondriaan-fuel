/* ============================================================
 * views2.js — 视图（2）：饮食打卡 / 运动数据 / 健康评估 / 智能食谱
 * ============================================================ */
(function (global) {
  'use strict';
  var D = global.FITDATA, E = global.FITENGINE, S = global.FITSTORE;
  // UI 由 app.js 在本脚本之后定义，这里用惰性包装保证调用时才访问
  function $(s, r) { return global.UI.$(s, r); }
  function $$(s, r) { return global.UI.$$(s, r); }
  function esc(s) { return global.UI.esc(s); }
  var H = global.FITVIEWS._helpers;

  var MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  var mealName = function (id) { return (D.byId(D.MEAL_NAMES, id) || { name:id }).name; };

  /* ============================================================
   * 4. 饮食打卡
   * ============================================================ */
  var curMeal = 'breakfast';
  function diet(root) {
    var p = S.state.profile;
    if (!p) { global.UI.go('onboarding'); return; }
    var T = E.targetMacros(p), intake = S.dayIntake();
    var day = S.ensureDietDay();

    root.innerHTML =
      '<div class="grid g4 mb16">' +
        H.stat('今日摄入', intake.kcal, 'kcal', '目标 ' + Math.round(T.kcal) + ' kcal', intake.kcal > T.kcal ? 'accent-r' : 'accent-k') +
        H.stat('蛋白质', global.UI.n1(intake.p), 'g', '目标 ' + global.UI.n1(T.protein) + ' g', 'accent-r') +
        H.stat('碳水', global.UI.n1(intake.c), 'g', '目标 ' + global.UI.n1(T.carbs) + ' g', 'accent-y') +
        H.stat('脂肪', global.UI.n1(intake.f), 'g', '目标 ' + global.UI.n1(T.fat) + ' g', 'accent-b') +
      '</div>' +
      '<div class="panel mb16"><div class="panel-h">' + H.panelHead('ph-k', '＋', '添加食物') + '</div><div class="panel-b">' +
        '<div class="opts">' +
          '<button class="btn btn-r" id="dCam">📷 拍照识别一餐</button>' +
          '<button class="btn btn-k" id="dManual">✍ 手动输入食物 / 分量</button>' +
        '</div>' +
        '<p class="tiny muted mt8">拍照识别在本机完成视觉推断（演示算法），可识别中式家常菜、主食、快餐、饮品等；识别结果均可手动校正分量。</p>' +
        '<p class="tiny mt8" id="srcChip"></p>' +
      '</div></div>' +

      '<div class="subtabs" id="mealTabs">' +
        D.MEAL_NAMES.map(function (m) {
          return '<button class="subtab ' + (m.id === curMeal ? 'on' : '') + '" data-meal="' + m.id + '">' + m.name + '</button>';
        }).join('') + '</div>' +
      '<div class="panel"><div class="panel-b" id="mealList"></div></div>';

    drawMealList();

    $('#mealTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-meal]'); if (!b) return;
      curMeal = b.getAttribute('data-meal');
      $$('#mealTabs .subtab').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-meal') === curMeal); });
      drawMealList();
    });
    $('#dCam').addEventListener('click', recognizeFlow);
    $('#dManual').addEventListener('click', manualFlow);

    // 数据源状态：联网（OpenFoodFacts 实时）/ 离线（本地库回退）
    var src = $('#srcChip');
    if (src && global.FITONLINE) {
      var on = global.FITONLINE.online();
      src.innerHTML = '<span class="chip ' + (on ? 'b' : 'r') + '">' +
        (on ? '● 热量数据源：' + global.FITONLINE.sourceName + '（联网实时）' : '● 热量数据源：本地食物库（离线回退，联网后自动恢复实时数据）') + '</span>';
    }

    function drawMealList() {
      var box = $('#mealList'), list = day[curMeal] || [];
      if (!list.length) {
        box.innerHTML = '<div class="empty">' + mealName(curMeal) + '还没有记录<br/><br/>点击上方「拍照识别」或「手动输入」开始打卡</div>';
        return;
      }
      box.innerHTML = list.map(function (x) {
        return '<div class="food-row"><span class="chip g">' + (x.source === 'ai' ? 'AI识别' : x.source === 'online' ? '联网' : '手动') + '</span>' +
          '<div class="fr-name">' + esc(x.name) + (x.source === 'online' ? ' <span class="chip b" style="font-size:10px">联网数据</span>' : x.source === 'ai' ? ' <span class="chip y" style="font-size:10px">AI识别</span>' : '') + '<small>' + global.UI.n1(x.grams) + ' g · P ' + global.UI.n1(x.p) +
          ' · C ' + global.UI.n1(x.c) + ' · F ' + global.UI.n1(x.f) + '</small></div>' +
          '<div class="fr-kcal">' + Math.round(x.kcal) + ' kcal</div>' +
          '<button class="btn btn-sm btn-r" data-del="' + x.uid + '">删</button></div>';
      }).join('');
      box.onclick = function (e) {
        var b = e.target.closest('[data-del]'); if (!b) return;
        S.removeFood(b.getAttribute('data-del'));
        global.UI.toast('已删除', 'r');
        diet(root);
      };
    }
  }

  /* ---------- 拍照识别流程 ---------- */
  function recognizeFlow() {
    global.UI.chooseImage(true).then(function (res) {
      var mroot = global.UI.modal('食物图像识别',
        '<div class="photo-box scanbox" style="min-height:200px"><img src="' + res.dataUrl + '"><div class="scanline"></div></div>' +
        '<div class="ta-c mt12"><div class="spin-sq" style="display:inline-block;vertical-align:middle"></div> ' +
        '<b id="scanTxt" style="vertical-align:middle;margin-left:8px">正在识别食材与分量…</b></div>', [], true);

      var stages = ['提取颜色与纹理特征…', '匹配食物特征库（' + D.FOODS.length + ' 种）…', '估算分量与营养成分…'];
      var si = 0;
      var timer = setInterval(function () {
        var t = $('#scanTxt', mroot);
        if (t && stages[si]) t.textContent = stages[si];
        si++;
      }, 600);

      setTimeout(function () {
        clearInterval(timer);
        // 由图片数据生成稳定伪随机
        var hsh = 7;
        var str = res.dataUrl.slice(0, 400);
        for (var i = 0; i < str.length; i++) hsh = (hsh * 31 + str.charCodeAt(i)) % 9973;
        var rnd = function () { hsh = (hsh * 1103515245 + 12345) % 2147483648; return hsh / 2147483648; };
        var n = 1 + Math.floor(rnd() * 2.4);
        var pool = D.FOODS.slice();
        var picked = [];
        for (var k = 0; k < n; k++) {
          var f = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
          picked.push({ food:f, grams:Math.round(f.std * (0.75 + rnd() * 0.6)), conf:Math.round(78 + rnd() * 19) });
        }
        var html =
          '<div class="photo-box" style="min-height:120px;max-height:140px"><img src="' + res.dataUrl + '"></div>' +
          '<div class="tiny muted mt8 mb8">识别结果（可校正分量后添加到当前餐次：<b>' + mealName(curMeal) + '</b>）</div>' +
          picked.map(function (x, idx) {
            return '<div class="list-row"><span class="chip y">AI ' + x.conf + '%</span>' + D.imgTag(x.food) +
              '<div class="lr-main"><div class="lr-title">' + esc(x.food.name) + '</div>' +
              '<div class="lr-sub">' + x.food.kcal + ' kcal/100g · P' + x.food.p + ' C' + x.food.c + ' F' + x.food.f + '</div></div>' +
              '<div class="inline-num"><input class="input scan-g" data-idx="' + idx + '" type="number" value="' + x.grams + '" style="width:78px"><span class="tiny">g</span></div></div>';
          }).join('') +
          '<div class="tiny mt8">▸ 识别有误？可用 <span class="td-u">手动输入</span> 搜索精确食物。';
        var mr = global.UI.modal('识别完成 · 请确认', html,
          [{ label:'手动输入', cls:'btn-g', onClick:function () { global.UI.closeModal(); manualFlow(); } },
           { label:'添加到' + mealName(curMeal), cls:'btn-r', onClick:function () {
               $$('.scan-g').forEach(function (inp, i) {
                 var g = Math.max(1, parseFloat(inp.value) || picked[i].grams);
                 var f = picked[i].food, a = g / 100;
                 S.addFood(curMeal, { name:f.name, grams:g, kcal:f.kcal * a, p:f.p * a, c:f.c * a, f:f.f * a, source:'ai' });
               });
               global.UI.closeModal();
               global.UI.toast('已添加 ' + picked.length + ' 项（AI 识别）', 'y');
               global.UI.go('diet');
             } }], true);
      }, 1900);
    });
  }

  /* ---------- 手动输入流程 ---------- */
  function manualFlow() {
    var staged = [];
    var body =
      '<div class="field"><label>搜索食物（家常菜 / 快餐 / 食材 / 饮品）</label>' +
      '<input class="input" id="m-search" placeholder="输入关键词，如：鸡胸、米饭、拿铁…"></div>' +
      '<div id="m-results" style="max-height:230px;overflow:auto;border:var(--bd);background:#fff"></div>' +
      '<div id="m-online"></div>' +
      '<div class="mt12"><div class="tiny fw9 mb8" style="letter-spacing:1px">已选 / 或自定义新食物</div><div id="m-staged"></div></div>' +
      '<div class="comp mt12"><span class="comp-bar"></span><div class="comp-bd"><h4>食物库中没有？自定义</h4>' +
        '<div class="row2"><div class="field"><label>名称</label><input class="input" id="c-name" placeholder="如：自制全麦三明治"></div>' +
        '<div class="field"><label>分量 (g/ml)</label><input class="input" id="c-g" type="number" value="200"></div></div>' +
        '<div class="row3"><div class="field"><label>千卡</label><input class="input" id="c-kcal" type="number" placeholder="kcal"></div>' +
        '<div class="field"><label>蛋白质 g</label><input class="input" id="c-p" type="number" step="0.1"></div>' +
        '<div class="field"><label>碳水 g</label><input class="input" id="c-c" type="number" step="0.1"></div></div>' +
        '<div class="row3"><div class="field"><label>脂肪 g</label><input class="input" id="c-f" type="number" step="0.1"></div>' +
        '<button class="btn btn-y" id="c-add" style="height:40px;align-self:end">加入已选</button></div>' +
      '</div></div>';
    var mr = global.UI.modal('手动添加到「' + mealName(curMeal) + '」', body,
      [{ label:'取消', cls:'btn-g', onClick:global.UI.closeModal },
       { label:'确认添加', cls:'btn-k', onClick:commit }], true);

    renderResults('');
    var onlineTimer = null, onlineItems = [];
    $('#m-search').addEventListener('input', function (e) {
      var q = e.target.value.trim();
      renderResults(q);
      clearTimeout(onlineTimer);
      onlineTimer = setTimeout(function () { searchOnline(q); }, 350);
    });
    function searchOnline(q) {
      var box = $('#m-online');
      if (!global.FITONLINE) return;
      if (!q) { box.innerHTML = ''; onlineItems = []; return; }
      if (!global.FITONLINE.online()) {
        box.innerHTML = '<div class="tiny muted mt8">⚠ 当前离线：联网数据源（' + global.FITONLINE.sourceName + '）不可用，仅显示本地食物库（' + D.FOODS.length + ' 种）</div>';
        return;
      }
      box.innerHTML = '<div class="tiny muted mt8">正在联网检索 ' + global.FITONLINE.sourceName + '…</div>';
      global.FITONLINE.searchFood(q).then(function (items) {
        if (!$('#m-online')) return; // 弹窗已关闭
        onlineItems = items || [];
        if (items == null) {
          box.innerHTML = '<div class="tiny muted mt8">⚠ 联网数据源超时/不可用，已回退本地库结果</div>';
        } else if (!items.length) {
          box.innerHTML = '<div class="tiny muted mt8">联网库无「' + esc(q) + '」匹配项</div>';
        } else {
          box.innerHTML = '<div class="tiny fw9 mt8 mb8" style="letter-spacing:1px">联网结果 · ' + global.FITONLINE.sourceName + '（实时数据，每 100g）</div>' +
            '<div style="max-height:200px;overflow:auto;border:var(--bd);background:#fff">' +
            items.map(function (f, i) {
              return '<div class="list-row"><span class="chip b">联网</span><div class="lr-main"><div class="lr-title">' + esc(f.name) + '</div>' +
                '<div class="lr-sub">' + f.kcal + ' kcal/100g · P' + f.p + ' C' + f.c + ' F' + f.f + '</div></div>' +
                '<button class="btn btn-sm btn-b" data-onlineadd="' + i + '">＋</button></div>';
            }).join('') + '</div>';
        }
      });
    }
    mr.addEventListener('click', function (e) {
      var add = e.target.closest('[data-foodadd]');
      if (add) {
        var f = D.byId(D.FOODS, add.getAttribute('data-foodadd'));
        staged.push({ name:f.name, grams:f.std, kcal:f.kcal * f.std / 100, p:f.p * f.std / 100, c:f.c * f.std / 100, f:f.f * f.std / 100, source:'manual' });
        renderStaged();
      }
      var oadd = e.target.closest('[data-onlineadd]');
      if (oadd) {
        var of = onlineItems[parseInt(oadd.getAttribute('data-onlineadd'))];
        if (of) { staged.push({ name:of.name, grams:100, kcal:of.kcal, p:of.p, c:of.c, f:of.f, source:'online' }); renderStaged(); }
      }
      var rm = e.target.closest('[data-rm]');
      if (rm) { staged.splice(parseInt(rm.getAttribute('data-rm')), 1); renderStaged(); }
      if (e.target.id === 'c-add') {
        var name = $('#c-name').value.trim(), g = parseFloat($('#c-g').value);
        if (!name || !(g > 0)) return global.UI.toast('请填写名称与分量', 'r');
        staged.push({ name:name, grams:g, kcal:parseFloat($('#c-kcal').value) || 0,
          p:parseFloat($('#c-p').value) || 0, c:parseFloat($('#c-c').value) || 0, f:parseFloat($('#c-f').value) || 0, source:'manual' });
        $('#c-name').value = '';
        renderStaged();
      }
    });
    mr.addEventListener('input', function (e) {
      var sg = e.target.closest('[data-sg]');
      if (sg) {
        var i = parseInt(sg.getAttribute('data-sg')), g = Math.max(1, parseFloat(sg.value) || 0);
        var f0 = staged[i];
        // 从食物库重算
        var base = D.FOODS.find(function (x) { return x.name === f0.name; });
        if (base) { f0.grams = g; f0.kcal = base.kcal * g / 100; f0.p = base.p * g / 100; f0.c = base.c * g / 100; f0.f = base.f * g / 100; }
        else { var ratio = g / (f0.grams || g); f0.grams = g; f0.kcal *= ratio; f0.p *= ratio; f0.c *= ratio; f0.f *= ratio; }
      }
    });

    function renderResults(q) {
      var list = q ? D.FOODS.filter(function (f) { return f.name.indexOf(q) >= 0; }).slice(0, 20) : D.FOODS.slice(0, 12);
      $('#m-results').innerHTML = list.length ? list.map(function (f) {
        return '<div class="list-row">' + D.imgTag(f) + '<div class="lr-main"><div class="lr-title">' + esc(f.name) + '</div>' +
          '<div class="lr-sub">标准份 ' + f.std + 'g · ' + f.kcal + ' kcal/100g</div></div>' +
          '<button class="btn btn-sm btn-y" data-foodadd="' + f.id + '">＋</button></div>';
      }).join('') : '<div class="empty small">未找到，使用下方自定义</div>';
    }
    function renderStaged() {
      var box = $('#m-staged');
      box.innerHTML = staged.length ? staged.map(function (x, i) {
        return '<div class="food-row"><div class="fr-name">' + esc(x.name) + (x.source === 'online' ? ' <span class="chip b" style="font-size:10px">联网</span>' : x.source === 'ai' ? ' <span class="chip y" style="font-size:10px">AI</span>' : '') + '</div>' +
          '<div class="inline-num"><input class="input" data-sg="' + i + '" type="number" value="' + Math.round(x.grams) + '" style="width:72px"><span class="tiny">g</span></div>' +
          '<div class="fr-kcal">' + Math.round(x.kcal) + '</div><button class="btn btn-sm btn-r" data-rm="' + i + '">×</button></div>';
      }).join('') : '<div class="tiny muted">尚未选择</div>';
    }
    function commit() {
      if (!staged.length) return global.UI.toast('请先添加至少一项食物', 'r');
      staged.forEach(function (x) { S.addFood(curMeal, x); });
      global.UI.closeModal();
      global.UI.toast('已记录 ' + staged.length + ' 项食物', 'y');
      global.UI.go('diet');
    }
  }

  /* ============================================================
   * 5. 运动数据整合
   * ============================================================ */
  function exercise(root) {
    var p = S.state.profile;
    if (!p) { global.UI.go('onboarding'); return; }
    var conn = S.state.exercise.connected;
    var today = S.syncedExercise();
    var intake = S.dayIntake();
    var st = E.calorieStatus(p, intake.kcal, today && today.kcal);

    root.innerHTML =
      '<div class="panel mb16"><div class="panel-h">' + H.panelHead(conn ? 'ph-b' : 'ph-k', '⌚', conn ? '已连接 · ' + esc(conn.name) : '连接运动手表 / 手环') + '</div><div class="panel-b">' +
        (conn ? '<div class="flex-between wrap mb12"><div class="small fw9">绑定时间：' + conn.since + ' · 数据每日自动同步（演示数据，基于日期稳定生成）</div>' +
          '<div class="opts"><button class="btn btn-b btn-sm" id="exSync">立即同步</button><button class="btn btn-r btn-sm" id="exOff">解除绑定</button></div></div>' :
          '<p class="small fw9 mb12">支持主流品牌健康数据授权对接（生产环境通过 HealthKit / Google Fit / Garmin Connect / Fitbit Web API OAuth 授权读取）。选择品牌进入授权：</p>') +
        '<div class="grid g3" id="brandGrid">' +
          S.BRANDS.map(function (b) {
            return '<div class="watch-card"><div class="wc-brand"><div class="wc-logo" style="background:' + brandColor(b.id) + ';color:#fff">' + b.mark + '</div><b>' + esc(b.name) + '</b></div>' +
              '<button class="btn btn-sm ' + (conn && conn.id === b.id ? 'btn-g' : 'btn-k') + '" data-brand="' + b.id + '">' +
              (conn && conn.id === b.id ? '已连接' : '授权连接') + '</button></div>';
          }).join('') + '</div>' +
      '</div></div>' +

      '<div class="grid g4 mb16">' +
        H.stat('今日步数', today ? today.steps.toLocaleString() : '—', '步', today ? '活动 ' + today.minutes + ' 分钟' : '连接后显示', 'accent-y') +
        H.stat('活动消耗', today ? today.kcal : '—', 'kcal', '手表同步', 'accent-r') +
        H.stat('摄入', st.intake, 'kcal', '饮食打卡合计', 'accent-k') +
        H.stat(st.label, Math.abs(st.deficit), 'kcal', '总消耗 ' + st.burn + ' kcal', st.ok ? 'accent-b' : 'accent-r') +
      '</div>' +

      '<div class="grid g2">' +
        '<div class="panel"><div class="panel-h">' + H.panelHead('ph-y', '01', '近 7 日步数') + '</div><div class="panel-b">' +
          '<canvas id="cSteps" style="height:210px"></canvas></div></div>' +
        '<div class="panel"><div class="panel-h">' + H.panelHead('ph-r', '02', '近 7 日活动消耗 (kcal)') + '</div><div class="panel-b">' +
          '<canvas id="cKcal" style="height:210px"></canvas></div></div>' +
      '</div>' +

      '<div class="panel mt16"><div class="panel-h">' + H.panelHead('ph-b', '03', '热量缺口可视化') + '</div><div class="panel-b">' +
        deficitBars(st) +
        '<div class="grid g3 mt16">' +
          '<div class="small fw9">基础代谢 <b>' + st.bmr + '</b><br><span class="tiny muted">维持生命的最低能量</span></div>' +
          '<div class="small fw9">职业活动 <b>+' + st.activity + '</b><br><span class="tiny muted">' + esc(E.occupation(p).label) + ' × ' + E.occupation(p).factor + '</span></div>' +
          '<div class="small fw9">刻意运动 <b>+' + st.exercise + '</b><br><span class="tiny muted">' + (conn ? esc(conn.name) + ' 同步' : '未连接手表，记 0') + '</span></div>' +
        '</div>' +
        '<div class="comp b mt12"><span class="comp-bar"></span><div class="comp-bd"><h4>结论</h4>' +
          '<p class="small fw9">今日总消耗 <b>' + st.burn + '</b> kcal，摄入 <b>' + st.intake + '</b> kcal，' +
          (st.deficit > 0 ? '形成 <b style="color:#1E4E9C">' + st.deficit + ' kcal 缺口</b>' : '形成 <b style="color:#E62325">' + Math.abs(st.deficit) + ' kcal 盈余</b>') +
          '。' + (st.ok ? '符合当前「' + goalCN(E.primaryGoal(p)) + '」目标节奏。' : '与目标节奏存在偏差，建议调整下一餐或运动量。') + '</p></div></div>' +
      '</div></div>';

    function brandColor(id) { return { apple:'#111', garmin:'#1E4E9C', fitbit:'#0FA3D9', huawei:'#1E4E9C', xiaomi:'#FF6900' }[id]; }

    if (today) {
      var wk = S.weekExercise();
      var labels = ['一','二','三','四','五','六','日'];
      var ordered = orderWeek(wk);
      global.FITCHARTS.bars($('#cSteps'), ordered.map(function (x, i) {
        return { label:labels[i], v1:x.data ? x.data.steps : 0 }; }), { c1:'#F7D41A', max:14000 });
      global.FITCHARTS.bars($('#cKcal'), ordered.map(function (x, i) {
        return { label:labels[i], v1:x.data ? x.data.kcal : 0 }; }), { c1:'#E62325' });
    }

    $('#brandGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-brand]'); if (!b) return;
      var id = b.getAttribute('data-brand'), brand = S.BRANDS.find(function (x) { return x.id === id; });
      if (conn && conn.id === id) return;
      b.textContent = '授权中…';
      setTimeout(function () {
        S.connectWatch(brand);
        global.UI.toast(brand.name + ' 已连接，数据已同步', 'y');
        exercise(root);
      }, 900);
    });
    var sync = $('#exSync'); if (sync) sync.addEventListener('click', function () {
      global.UI.toast('同步完成：' + today.kcal + ' kcal / ' + today.steps + ' 步', 'b'); exercise(root);
    });
    var off = $('#exOff'); if (off) off.addEventListener('click', function () {
      S.disconnectWatch(); global.UI.toast('已解除绑定', 'r'); exercise(root);
    });
  }

  function orderWeek(wk) {
    var out = new Array(7);
    wk.forEach(function (x) {
      var wd = (new Date(x.date + 'T00:00:00').getDay() + 6) % 7;
      out[wd] = x;
    });
    return out;
  }
  function deficitBars(st) {
    var max = Math.max(st.burn, st.intake, 1);
    function row(label, v, color, sub) {
      return '<div class="mb12"><div class="flex-between tiny fw9 mb8"><span>' + label + '</span><span>' + v + ' kcal</span></div>' +
        '<div class="bar"><i style="width:' + (v / max * 100) + '%;background:' + color + '"></i></div></div>';
    }
    return row('总消耗（BMR + 活动 + 运动）', st.burn, '#1E4E9C') +
      row('已摄入', st.intake, '#F7D41A');
  }
  function goalCN(g) { return { fatloss:'减脂', muscle:'增肌', posture:'体态修正', keep:'维持' }[g]; }

  /* ============================================================
   * 6. 健康状态评估
   * ============================================================ */
  function health(root) {
    var p = S.state.profile;
    if (!p) { global.UI.go('onboarding'); return; }
    var tk = S.todayKey();
    var h0 = S.getHealth() || { energy:3, sleep:3, sleepHours:7, discomforts:[], note:'' };
    var cyc = p.gender === 'female' ? E.cycleAnalysis(p.cycle, tk) : (p.tcycle ? E.testoAnalysis(p.tcycle, tk) : null);
    var rec = E.workoutRec(p, h0, cyc);
    var week = S.recentHealth(7);

    root.innerHTML =
      '<div class="grid g-21">' +
        '<div>' +
          '<div class="panel mb16"><div class="panel-h">' + H.panelHead('ph-k', '☼', '今日状态记录 · ' + tk) + '</div><div class="panel-b">' +
            '<div class="field"><label>精力水平</label>' + moodScale('energy', h0.energy, ['很疲惫','偏低','一般','不错','充沛']) + '</div>' +
            '<div class="field"><label>睡眠质量</label>' + moodScale('sleep', h0.sleep, ['失眠','较差','一般','良好','优质']) + '</div>' +
            '<div class="row2">' +
              '<div class="field"><label>睡眠时长 (小时)</label><input class="input" id="h-hours" type="number" min="0" max="16" step="0.5" value="' + h0.sleepHours + '"></div>' +
              '<div class="field"><label>身体不适（多选）</label><div class="opts wrap" id="h-dis">' +
                D.discomfortsFor(p.gender).map(function (x) {
                  return '<button type="button" class="opt ' + (h0.discomforts.indexOf(x) >= 0 ? 'on var-r' : '') + '" data-dis="' + esc(x) + '">' + x + '</button>';
                }).join('') + '</div></div>' +
            '</div>' +
            '<div class="field"><label>备注</label><textarea class="input" id="h-note" placeholder="' + (p.gender === 'female' ? '压力、饮酒、经期感觉、食欲变化…' : '压力、饮酒、晨间状态、训练欲望…') + '">' + esc(h0.note || '') + '</textarea></div>' +
            '<button class="btn btn-k btn-block" id="hSave" style="padding:13px">保存今日状态并生成推荐</button>' +
          '</div></div>' +

          '<div class="panel"><div class="panel-h">' + H.panelHead('ph-r', 'AI', '7 日健康趋势报告') + '</div><div class="panel-b">' +
            reportHtml(week) +
          '</div></div>' +
        '</div>' +

        '<div>' +
          '<div class="panel block-k mb16" style="box-shadow:5px 5px 0 #111"><div class="panel-b">' +
            '<div class="tiny" style="letter-spacing:2px;opacity:.7">RECOMMENDED TODAY</div>' +
            '<h3 style="font-size:19px;margin:6px 0">' + esc(rec.title) + '</h3>' +
            '<div class="small" style="opacity:.85;margin-bottom:8px">建议时长 ' + rec.minutes + ' 分钟' +
              (rec.tags && rec.tags.length ? ' · ' + rec.tags.slice(0, 3).map(esc).join(' / ') : '') + '</div>' +
            rec.items.map(function (x, i) { return '<div class="small" style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dashed rgba(255,255,255,.25)"><b style="color:#F7D41A">' + (i + 1) + '</b><span>' + esc(x) + '</span></div>'; }).join('') +
            '<div class="comp y mt12"><span class="comp-bar"></span><div class="comp-bd" style="color:#111"><h4>推荐理由</h4><p class="small fw9">' + esc(rec.reason) + '</p></div></div>' +
          '</div></div>' +

          (cyc && cyc.kind !== 'testo' ? '<div class="panel mb16"><div class="panel-h">' + H.panelHead('ph-r', '♀', '周期联动') + '</div><div class="panel-b tight">' +
            '<div class="flex-between"><span class="small fw9">周期第 ' + cyc.day + ' 天</span>' +
            '<span class="chip r">' + H.phaseName(cyc.phase) + '</span></div>' +
            '<div class="tiny muted mt8">预计下次月经 ' + cyc.nextDate + '（' + cyc.daysToNext + ' 天后），推荐已结合当前周期阶段调整。</div>' +
            '<button class="btn btn-sm btn-block mt8" data-go-profile>查看周期日历</button>' +
          '</div></div>' : '') +
          (cyc && cyc.kind === 'testo' ? '<div class="panel mb16"><div class="panel-h">' + H.panelHead('ph-b', '♂', '睾酮节律联动') + '</div><div class="panel-b tight">' +
            '<div class="flex-between"><span class="small fw9">节律指数 ' + cyc.index + '</span>' +
            '<span class="chip b">' + H.phaseName(cyc.phase) + '</span></div>' +
            '<div class="tiny muted mt8">晨峰窗口 ' + cyc.peakWindow + ' · ' + esc(cyc.bestTrainWindow) + '，训练推荐已结合当前睾酮节律调整。</div>' +
            '<button class="btn btn-sm btn-block mt8" data-go-profile>查看睾酮节律分析</button>' +
          '</div></div>' : '') +

          '<div class="panel"><div class="panel-h">' + H.panelHead('ph-y', '✚', '营养联动建议') + '</div><div class="panel-b tight">' +
            nutritionTips(h0, cyc).map(function (t) {
              return '<div class="small fw9" style="border-left:3px solid ' + t.c + ';padding:4px 0 4px 9px;margin:7px 0">' + esc(t.t) + '</div>';
            }).join('') + '</div></div>' +
        '</div>' +
      '</div>';

    var dis = h0.discomforts.slice();
    $('#h-dis').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dis]'); if (!b) return;
      var v = b.getAttribute('data-dis'), i = dis.indexOf(v);
      if (i >= 0) { dis.splice(i, 1); b.classList.remove('on', 'var-r'); }
      else { dis.push(v); b.classList.add('on', 'var-r'); }
    });
    $$('.mood').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        $$('.mood[data-key="' + key + '"]').forEach(function (x) { x.classList.remove('on', 'c1', 'c2', 'c3', 'c4', 'c5'); });
        btn.classList.add('on', 'c' + btn.getAttribute('data-v'));
      });
    });
    $('#hSave').addEventListener('click', function () {
      var hh = {
        energy:parseInt(active('energy')), sleep:parseInt(active('sleep')),
        sleepHours:parseFloat($('#h-hours').value) || 0,
        discomforts:dis.slice(), note:$('#h-note').value.trim()
      };
      S.setHealth(hh);
      global.UI.toast('已保存，推荐方案已更新', 'y');
      health(root);
    });
    var gp = $('[data-go-profile]'); if (gp) gp.addEventListener('click', function () { global.UI.go('profile'); });

    function active(key) { var x = $('.mood[data-key="' + key + '"].on', root); return x ? x.getAttribute('data-v') : '3'; }
  }

  function moodScale(key, val, labels) {
    var icons = ['①','②','③','④','⑤'];
    return '<div class="mood-scale">' + labels.map(function (l, i) {
      var v = i + 1;
      return '<button type="button" class="mood ' + (v === val ? 'on c' + v : '') + '" data-key="' + key + '" data-v="' + v + '">' +
        '<span class="m-ic">' + icons[i] + '</span>' + l + '</button>';
    }).join('') + '</div>';
  }

  function reportHtml(week) {
    var valid = week.filter(function (x) { return x.data; });
    if (valid.length < 2) return '<div class="empty small">至少记录 2 天后生成趋势报告（当前已记录 ' + valid.length + ' 天）</div>';
    var avg = function (k) { return valid.reduce(function (a, x) { return a + x.data[k]; }, 0) / valid.length; };
    var eAvg = avg('energy'), sAvg = avg('sleep'), hAvg = avg('sleepHours');
    var freq = {};
    valid.forEach(function (x) { (x.data.discomforts || []).forEach(function (d) { freq[d] = (freq[d] || 0) + 1; }); });
    var top = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, 4);
    var eVals = week.map(function (x) { return x.data ? x.data.energy : null; });
    var sVals = week.map(function (x) { return x.data ? x.data.sleep : null; });
    var trend = function (arr) {
        var a = arr.filter(function (x) { return x != null; });
        if (a.length < 2) return '数据不足';
        return a[a.length - 1] - a[0] >= 0.3 ? '上升 ↗' : (a[a.length - 1] - a[0] <= -0.3 ? '下降 ↘' : '平稳 →');
      };
    var advice = [];
    if (sAvg < 3) advice.push('睡眠质量持续偏低，建议固定就寝时间、睡前 1 小时远离屏幕，并将训练下调至低强度');
    if (hAvg < 7) advice.push('平均睡眠不足 7 小时，瘦素分泌受影响，减脂期容易饥饿，优先补觉再谈缺口');
    if (eAvg >= 4) advice.push('精力整体充沛，可规律安排高强度/大重量训练并逐步进阶负荷');
    if (top.indexOf('肌肉酸痛') >= 0 && freq['肌肉酸痛'] >= 2) advice.push('一周内多次肌肉酸痛，说明恢复不足，增加蛋白摄入并安排泡沫轴放松日');
    if (top.indexOf('肠胃不适') >= 0) advice.push('肠胃不适反复，排查油腻/乳制品/进食速度，食谱中优先易消化的蒸煮食材');
    if (!advice.length) advice.push('各项指标平稳，保持当前训练-饮食-睡眠节奏，每两周复盘一次进度即可');

    return '<div class="grid g2 mb12">' +
        '<div><div class="tiny fw9 muted" style="letter-spacing:1px">精力趋势 · ' + trend(eVals) + '</div><canvas id="rE" style="height:90px"></canvas></div>' +
        '<div><div class="tiny fw9 muted" style="letter-spacing:1px">睡眠质量 · ' + trend(sVals) + '</div><canvas id="rS" style="height:90px"></canvas></div>' +
      '</div>' +
      '<table class="tb"><thead><tr><th>指标</th><th class="num">7日均值</th><th>评价</th></tr></thead><tbody>' +
        '<tr><td>精力水平</td><td class="num">' + global.UI.n1(eAvg) + ' / 5</td><td>' + (eAvg >= 4 ? '良好' : eAvg >= 3 ? '一般' : '偏低') + '</td></tr>' +
        '<tr><td>睡眠质量</td><td class="num">' + global.UI.n1(sAvg) + ' / 5</td><td>' + (sAvg >= 4 ? '良好' : sAvg >= 3 ? '一般' : '需改善') + '</td></tr>' +
        '<tr><td>睡眠时长</td><td class="num">' + global.UI.n1(hAvg) + ' 小时</td><td>' + (hAvg >= 7 ? '达标' : '不足') + '</td></tr>' +
        '<tr><td>高频不适</td><td colspan="2">' + (top.length ? top.map(function (d) { return '<span class="chip r" style="margin:2px">' + esc(d) + ' × ' + freq[d] + '</span>'; }).join('') : '无 ✔') + '</td></tr>' +
      '</tbody></table>' +
      '<div class="comp b mt12"><span class="comp-bar"></span><div class="comp-bd"><h4>分析结论与行动建议</h4>' +
        advice.map(function (a) { return '<p class="small fw9" style="margin:4px 0">▸ ' + esc(a) + '</p>'; }).join('') +
        '<p class="tiny muted mt8">报告基于近 7 日本机记录生成，仅供自我管理参考，不构成医疗诊断。</p></div></div>';
  }
  // 报告图表在插入 DOM 后补绘
  function drawReportCharts(root2, week) {
    var ce = $('#rE', root2), cs = $('#rS', root2);
    var fill = function (arr) {
      var last = 3;
      return arr.map(function (v) { if (v != null) last = v; return v != null ? v : last; });
    };
    if (ce) global.FITCHARTS.spark(ce, fill(week.map(function (x) { return x.data ? x.data.energy : null; })), { color:'#E62325' });
    if (cs) global.FITCHARTS.spark(cs, fill(week.map(function (x) { return x.data ? x.data.sleep : null; })), { color:'#1E4E9C' });
  }

  function nutritionTips(h, cyc) {
    var tips = [];
    if (h.sleep < 3 || h.energy < 3) tips.push({ t:'状态低谷：今天减少咖啡因，午后补充复合碳水（燕麦/红薯）稳定血糖', c:'#F7D41A' });
    if ((h.discomforts || []).indexOf('肌肉酸痛') >= 0) tips.push({ t:'肌肉修复：蛋白质按 1.6–2.0 g/kg 体重分配，每餐含 25–40g 优质蛋白', c:'#E62325' });
    if ((h.discomforts || []).indexOf('肠胃不适') >= 0) tips.push({ t:'肠胃安抚：避免油炸与生冷，选择清蒸鱼、软米饭、熟蔬菜，少油 20g 内', c:'#1E4E9C' });
    if (cyc && cyc.phase === 'period') tips.push({ t:'经期补铁：安排瘦牛肉/鸭血类（本库可选瘦牛肉）搭配维C彩椒促进吸收', c:'#E62325' });
    if (cyc && cyc.kind === 'testo') {
      if (cyc.phase === '晨峰期' || cyc.phase === '日间高位') tips.push({ t:'睾酮高位窗口：主蛋白份额前置到早餐/午餐（各占 30–40%），训练前 1–2h 补充碳水 30–50g', c:'#1E4E9C' });
      if (cyc.phase === '夜间低谷') tips.push({ t:'夜间分泌准备：晚餐补锌（瘦红肉/贝类）与镁（坚果 10g），避免酒精，23:00 前入睡', c:'#1E4E9C' });
      if (cyc.morningScore <= 2) tips.push({ t:'晨间状态偏弱：优先排查睡眠时长（≥7h）、体脂率（>25% 会抑制睾酮）与长期热量缺口（>600 kcal/日）', c:'#E62325' });
    }
    if (cyc && cyc.phase === 'luteal') tips.push({ t:'黄体期控水肿：盐 ≤5g，增加富镁坚果 10g、深绿叶菜 300g', c:'#1E4E9C' });
    if (!tips.length) tips.push({ t:'状态良好：按智能食谱执行即可，训练后 30–60 分钟内补充碳水 + 蛋白', c:'#111' });
    tips.push({ t:'饮水：每日 ' + (S.state.profile.gender === 'male' ? 1700 : 1500) + ' ml 白水，运动每 30 分钟补 150–200 ml', c:'#9A9A94' });
    return tips;
  }

  /* ============================================================
   * 7. 智能食谱
   * ============================================================ */
  var recipeTab = 'plan';
  var libCat = 'protein';
  var libQuery = '';
  var plan = null;
  var planSeed = 1;

  function recipe(root) {
    var p = S.state.profile;
    if (!p) { global.UI.go('onboarding'); return; }
    var pantryCost = S.pantryTotals().cost;

    root.innerHTML =
      '<div class="panel mb16" id="budgetPanel"><div class="panel-h">' + H.panelHead('ph-y', '¥', '预算管理') + '</div><div class="panel-b">' +
        '<div class="grid g3" style="align-items:center">' +
          '<div class="field" style="margin:0"><label>每日食品预算 (元)</label><div class="inline-num"><button class="btn btn-sm btn-g" data-bd="daily" data-bv="-5">−</button>' +
            '<input class="input" id="bDaily" type="number" min="10" value="' + S.state.budget.daily + '"><button class="btn btn-sm btn-g" data-bd="daily" data-bv="5">＋</button></div></div>' +
          '<div class="field" style="margin:0"><label>每周食品预算 (元)</label><div class="inline-num"><button class="btn btn-sm btn-g" data-bd="weekly" data-bv="-20">−</button>' +
            '<input class="input" id="bWeekly" type="number" min="50" value="' + S.state.budget.weekly + '"><button class="btn btn-sm btn-g" data-bd="weekly" data-bv="20">＋</button></div></div>' +
          '<div><button class="btn btn-k btn-block" id="bSave">保存预算</button>' +
            '<div class="tiny muted mt8">当前食材篮花费 ' + global.UI.yuan(pantryCost) + '</div></div>' +
        '</div>' +
      '</div></div>' +

      '<div class="subtabs" id="rTabs">' +
        '<button class="subtab" data-rtab="plan">智能推荐食谱</button>' +
        '<button class="subtab" data-rtab="lib">食材库（' + D.INGREDIENTS.length + '）</button>' +
        '<button class="subtab" data-rtab="pantry">我的食材篮</button>' +
      '</div>' +
      '<div id="rBody"></div>';

    // 预算面板事件（面板随视图重建，监听器随之销毁）
    var bp = $('#budgetPanel');
    bp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bd]');
      if (b) {
        var key = b.getAttribute('data-bd'), inp = $('#b' + key.charAt(0).toUpperCase() + key.slice(1));
        inp.value = String(Math.max(0, (parseFloat(inp.value) || 0) + parseFloat(b.getAttribute('data-bv'))));
      }
      if (e.target.id === 'bSave') {
        S.setBudget(parseFloat($('#bDaily').value) || 45, parseFloat($('#bWeekly').value) || 300);
        global.UI.toast('预算已保存', 'y');
        setTab();
      }
    });

    var box = $('#rBody');
    // 单一委托：覆盖三个标签页内的全部动态操作，避免重复绑定
    box.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-swap]'))) { openSwap(t.getAttribute('data-swap'), box); return; }
      if ((t = e.target.closest('[data-rtabgo]'))) {
        recipeTab = t.getAttribute('data-rtabgo'); syncTabHeads(); setTab(); return;
      }
      if ((t = e.target.closest('[data-cat]'))) { libCat = t.getAttribute('data-cat'); renderLib(box); return; }
      if ((t = e.target.closest('[data-addlib]'))) {
        var id = t.getAttribute('data-addlib'), inp = $('.lib-g[data-id="' + id + '"]', box);
        var g = Math.max(1, parseFloat(inp && inp.value) || 100);
        S.pantryAdd(id, g);
        var ing = D.byId(D.INGREDIENTS, id);
        global.UI.toast('已加入 ' + ing.name + ' ' + g + 'g（' + global.UI.yuan(ing.price * g / 100) + '）', 'y');
        return;
      }
      if (e.target.id === 'pClear') { S.pantryClear(); global.UI.toast('已清空食材篮', 'r'); renderPantry(box, S.state.budget); return; }
      var pg = e.target.closest('[data-pg]');
      if (pg) {
        var pid = pg.getAttribute('data-pg'), cur = S.state.pantry.find(function (x) { return x.id === pid; });
        S.pantrySet(pid, (cur ? cur.g : 0) + parseFloat(pg.getAttribute('data-d')));
        renderPantry(box, S.state.budget);
      }
    });
    box.addEventListener('input', function (e) {
      var inp = e.target.closest('[data-pginput]');
      if (inp) S.pantrySet(inp.getAttribute('data-pginput'), parseFloat(inp.value) || 0);
      if (e.target.id === 'libSearch') { libQuery = e.target.value.trim(); drawLibGrid(box); }
    });

    $('#rTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rtab]'); if (!b) return;
      recipeTab = b.getAttribute('data-rtab'); syncTabHeads(); setTab();
    });

    function syncTabHeads() {
      $$('#rTabs .subtab').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-rtab') === recipeTab); });
    }
    function setTab() {
      if (recipeTab === 'plan') renderPlan(box, p, S.state.budget);
      if (recipeTab === 'lib') renderLib(box);
      if (recipeTab === 'pantry') renderPantry(box, S.state.budget);
    }
    setTab();
  }

  /* ---------- 智能推荐 ---------- */
  function renderPlan(box, p, budget) {
    var T = E.targetMacros(p);
    if (!plan) {
      box.innerHTML =
        '<div class="panel"><div class="panel-b ta-c" style="padding:40px 20px">' +
          '<div class="brand-squares" style="grid-template-columns:repeat(3,22px);grid-template-rows:repeat(3,22px);display:inline-grid;gap:3px;margin-bottom:18px">' +
            '<span class="sq sq-r"></span><span class="sq sq-w"></span><span class="sq sq-y"></span>' +
            '<span class="sq sq-b"></span><span class="sq sq-k"></span><span class="sq sq-w"></span>' +
            '<span class="sq sq-y"></span><span class="sq sq-w"></span><span class="sq sq-r"></span></div>' +
          '<h3 style="font-size:22px;margin-bottom:8px">按你的身体数据 + 目标 + 预算，生成克级食谱</h3>' +
          '<p class="small muted mb16" style="max-width:560px;margin:0 auto 18px">严格执行《中国居民膳食指南（2022）》：蔬菜 300–500g、水果 200–350g、全谷物占一半、油 25–30g、盐 ≤5g；' +
          '能量按 Mifflin-St Jeor 公式与「' + goalCN(E.primaryGoal(p)) + '」目标校准，蛋白质精确到 1.6–1.8 g/kg。</p>' +
          '<div class="grid g4" style="max-width:680px;margin:0 auto 20px">' +
            H.stat('目标能量', Math.round(T.kcal), 'kcal', '', 'accent-k') +
            H.stat('蛋白质', global.UI.n1(T.protein), 'g', T.kcal ? '' : '', 'accent-r') +
            H.stat('碳水', global.UI.n1(T.carbs), 'g', '', 'accent-y') +
            H.stat('脂肪', global.UI.n1(T.fat), 'g', '', 'accent-b') +
          '</div>' +
          '<button class="btn btn-r" id="genPlan" style="padding:14px 30px">⚡ 生成今日三餐 + 加餐（预算 ' + global.UI.yuan(budget.daily) + '/日）</button>' +
          guidelinesRef() +
        '</div></div>';
      $('#genPlan').addEventListener('click', function () {
        planSeed = 1 + Math.floor(Math.random() * 999);
        plan = E.bestMealPlan(p, budget.daily);
        global.UI.toast('食谱已生成，可逐项替换食材', 'y');
        renderPlan(box, p, budget);
      });
      return;
    }

    var t = plan.totals, tg = plan.targets;
    box.innerHTML =
      '<div class="grid g4 mb16">' +
        H.stat('合计能量', Math.round(t.kcal), 'kcal', '目标 ' + Math.round(tg.kcal), Math.abs(t.kcal - tg.kcal) / tg.kcal < 0.08 ? 'accent-k' : 'accent-r') +
        H.stat('蛋白质', global.UI.n1(t.p), 'g', '目标 ' + global.UI.n1(tg.protein), 'accent-r') +
        H.stat('碳水 / 脂肪', global.UI.n1(t.c) + ' / ' + global.UI.n1(t.f), 'g', '膳食纤维 ' + global.UI.n1(t.fiber) + 'g', 'accent-b') +
        H.stat('当日食材费', global.UI.yuan(t.cost), '', budget.daily ? '预算 ' + global.UI.yuan(budget.daily) : '', plan.overBudget ? 'accent-r' : 'accent-y') +
      '</div>' +

      (plan.gaps.length ? '<div class="panel mb16"><div class="panel-b tight"><div class="tiny fw9 mb8" style="letter-spacing:1px">营养差距判定（替换食材后实时更新）</div><div class="opts wrap">' +
        plan.gaps.map(function (g) {
          return '<span class="chip ' + (g.dir === '+' ? 'b' : 'r') + '">需 ' + g.dir + ' ' + g.name + ' ' + global.UI.n1(g.amount) + ' ' + g.unit + '</span>';
        }).join('') + '</div></div></div>' :
        '<div class="panel mb16"><div class="panel-b tight"><span class="chip b">✔ 各项营养素均已落入目标区间</span> ' +
        '<span class="chip y">蔬菜 ' + plan.vegG + 'g（指南 300–500g）</span> <span class="chip r">水果 ' + (plan.fruitG || 0) + 'g（指南 200–350g）</span> <span class="chip k">膳食纤维 ' + global.UI.n1(t.fiber) + 'g</span></div></div>') +

      budgetBar(t.cost, budget) +
      (plan.overBudget ? '<div class="comp r mb16"><span class="comp-bar"></span><div class="comp-bd"><h4>超出日预算</h4>' +
        '<p class="small fw9">当前最低营养需求约需 ' + global.UI.yuan(t.cost) + '/日。建议：① 将日预算提高到 ' + global.UI.yuan(plan.suggestBudget) + '；② 点击食材「换」用豆腐/鸡蛋/时蔬替代高价蛋白与水产。</p></div></div>' : '') +

      '<div class="grid" id="mealGrid">' + D.MEAL_NAMES.map(function (m) { return mealPanel(m, plan.meals[m.id] || []); }).join('') + '</div>' +
      '<div class="opts mt12"><button class="btn btn-k" id="pAgain">🎲 换一批搭配</button>' +
        '<button class="btn btn-b" id="pSave">💾 保存为今日食谱</button>' +
        '<button class="btn btn-g" id="pAddPantry">🧺 全部加入食材篮</button></div>' +
      guidelinesRef();

    $('#pAgain').addEventListener('click', function () {
      planSeed = Math.floor(Math.random() * 90000) + 1;
      plan = E.generateMealPlan(p, planSeed, budget.daily);
      renderPlan(box, p, budget);
    });
    $('#pSave').addEventListener('click', function () {
      S.savePlan(S.todayKey(), plan);
      global.UI.toast('今日食谱已保存', 'y');
    });
    $('#pAddPantry').addEventListener('click', function () {
      MEAL_ORDER.forEach(function (mid) {
        (plan.meals[mid] || []).forEach(function (it) { S.pantryAdd(it.ing.id, it.g); });
      });
      global.UI.toast('已全部加入食材篮', 'y');
    });
  }

  function mealPanel(m, items) {
    var kc = Math.round(items.reduce(function (a, it) { return a + E.nutritionOf(it.ing, it.g).kcal; }, 0));
    var cost = items.reduce(function (a, it) { return a + E.nutritionOf(it.ing, it.g).cost; }, 0);
    return '<div class="recipe-meal rm-' + m.color + '"><div class="rm-head"><span class="rm-idx">' +
      { breakfast:'早', lunch:'午', dinner:'晚', snack:'加' }[m.id] + '</span><span class="rm-name">' + m.name +
      ' · 约 ' + Math.round(m.ratio * 100) + '%</span><span class="rm-kcal">' + kc + ' kcal</span></div>' +
      (items.length ? items.map(function (it, idx) {
        var n = E.nutritionOf(it.ing, it.g);
        return '<div class="recipe-item"><div class="ri-name">' + D.ingImgTag(it.ing) + '<div class="ri-nt">' + esc(it.ing.name) +
            '<small>' + catCN(it.ing.cat) + ' · ' + global.UI.yuan(it.ing.price) + '/100g</small></div></div>' +
          '<div class="ri-g">' + global.UI.n1(it.g) + ' g</div>' +
          '<div class="ri-k">' + Math.round(n.kcal) + ' kcal</div>' +
          '<div class="ri-c">' + global.UI.yuan(n.cost) + '</div>' +
          '<button class="ri-swap" data-swap="' + m.id + ':' + idx + '" title="替换食材">换</button></div>';
      }).join('') : '<div class="empty small">无</div>') +
      '<div class="meal-foot"><span>P ' + global.UI.n1(items.reduce(function (a, it) { return a + E.nutritionOf(it.ing, it.g).p; }, 0)) +
        'g · C ' + global.UI.n1(items.reduce(function (a, it) { return a + E.nutritionOf(it.ing, it.g).c; }, 0)) +
        'g · F ' + global.UI.n1(items.reduce(function (a, it) { return a + E.nutritionOf(it.ing, it.g).f; }, 0)) + 'g</span><span>' + global.UI.yuan(cost) + '</span></div></div>';
  }

  function openSwap(token, box) {
    var parts = token.split(':'), mid = parts[0], idx = parseInt(parts[1]);
    var item = plan.meals[mid][idx];
    var alts = E.alternatives(item.ing);
    var mr = global.UI.modal('替换 · ' + item.ing.name + '（当前 ' + global.UI.n1(item.g) + 'g）',
      '<div class="tiny muted mb8">按「同类 + 营养密度相近」排序，替换保持克数，总成本与营养差距实时重算。</div>' +
      alts.map(function (a) {
        var n = E.nutritionOf(a, item.g);
        return '<div class="list-row"><span class="ic-cat ' + a.cat + '">' + catCN(a.cat) + '</span>' + D.ingImgTag(a) +
          '<div class="lr-main"><div class="lr-title">' + esc(a.name) + '</div>' +
          '<div class="lr-sub">/100g：' + a.kcal + ' kcal · P' + a.p + ' C' + a.c + ' F' + a.f + ' · ' + global.UI.yuan(a.price) + '</div></div>' +
          '<div class="lr-val">' + global.UI.yuan(n.cost) + '</div>' +
          '<button class="btn btn-sm btn-y" data-alt="' + a.id + '">替换</button></div>';
      }).join(''),
      [{ label:'关闭', cls:'btn-g', onClick:global.UI.closeModal }], true);
    mr.addEventListener('click', function (e) {
      var b = e.target.closest('[data-alt]'); if (!b) return;
      var ing = D.byId(D.INGREDIENTS, b.getAttribute('data-alt'));
      plan.meals[mid][idx] = { ing:ing, g:item.g };
      recomputePlan();
      global.UI.closeModal();
      global.UI.toast('已替换为「' + ing.name + '」', 'y');
      renderPlan(box, S.state.profile, S.state.budget);
    });
  }

  function recomputePlan() {
    var all = [];
    MEAL_ORDER.forEach(function (mid) {
      (plan.meals[mid] || []).forEach(function (it) { all.push(E.nutritionOf(it.ing, it.g)); });
    });
    plan.totals = E.sumNutrition(all);
    var T = plan.targets, gaps = [];
    function gap(name, val, tgt, unit, ratio) {
      var d = Math.round((tgt - val) * 10) / 10;
      if (Math.abs(d) > Math.max(3, tgt * (ratio || 0.06))) gaps.push({ name:name, dir:d > 0 ? '+' : '−', amount:Math.abs(d), unit:unit });
    }
    gap('蛋白质', plan.totals.p, T.protein, 'g', 0.10);
    gap('碳水', plan.totals.c, T.carbs, 'g', 0.06);
    gap('脂肪', plan.totals.f, T.fat, 'g', 0.08);
    var isVeg = function (it) {
      return it.ing.cat === 'vit' && (it.ing.meal.indexOf('lunch') >= 0 || it.ing.meal.indexOf('dinner') >= 0) &&
        it.ing.tags.join('').match(/维|叶酸|番茄|胡萝卜|低卡|补水/);
    };
    var isFruit = function (it) {
      return it.ing.cat === 'vit' && it.ing.tags.join('').match(/钾|果胶|维C|花青素|叶酸/) && !isVeg(it);
    };
    var vegG = 0, fruitG = 0;
    ['lunch', 'dinner'].forEach(function (mid) {
      (plan.meals[mid] || []).forEach(function (it) { if (isVeg(it)) vegG += it.g; });
    });
    ['breakfast', 'snack'].forEach(function (mid) {
      (plan.meals[mid] || []).forEach(function (it) { if (isFruit(it)) fruitG += it.g; });
    });
    plan.vegG = Math.round(vegG);
    plan.fruitG = Math.round(fruitG);
    if (vegG < T.veg[0]) gaps.push({ name:'蔬菜', dir:'+', amount:Math.round(T.veg[0] - vegG), unit:'g' });
    if (fruitG < T.fruit[0]) gaps.push({ name:'水果', dir:'+', amount:Math.round(T.fruit[0] - fruitG), unit:'g' });
    var fD = Math.round((T.fiber - plan.totals.fiber) * 10) / 10;
    if (fD > Math.max(2, T.fiber * 0.12)) gaps.push({ name:'膳食纤维', dir:'+', amount:fD, unit:'g' });
    plan.gaps = gaps;
    plan.overBudget = plan.budgetCap ? plan.totals.cost > plan.budgetCap : false;
    if (plan.overBudget) plan.suggestBudget = Math.ceil(plan.totals.cost / 5) * 5;
  }

  function budgetBar(cost, budget) {
    if (!budget.daily) return '';
    var pct = Math.min(120, cost / budget.daily * 100);
    var weekEst = cost * 7;
    return '<div class="panel mb16"><div class="panel-b tight">' +
      '<div class="flex-between tiny fw9 mb8"><span>日预算使用 ' + global.UI.yuan(cost) + ' / ' + global.UI.yuan(budget.daily) + '</span>' +
      '<span>' + Math.round(cost / budget.daily * 100) + '%</span></div>' +
      '<div class="bar ' + (cost > budget.daily ? 'r' : 'b') + ' cap"><i style="width:' + Math.min(100, pct) + '%"></i></div>' +
      '<div class="flex-between tiny muted mt8"><span>按此食谱周支出约 ' + global.UI.yuan(weekEst) + '</span><span>周预算 ' + global.UI.yuan(budget.weekly) + '</span></div>' +
      '</div></div>';
  }
  function guidelinesRef() {
    return '<div class="panel mt16"><div class="panel-h">' + H.panelHead('ph-w', '书', '《中国居民膳食指南（2022）》关键指标（成人/日）') + '</div><div class="panel-b tight">' +
      '<table class="tb"><tbody>' +
      '<tr><td>蔬菜</td><td class="num">300–500 g</td><td>水果</td><td class="num">200–350 g</td></tr>' +
      '<tr><td>谷类+薯类</td><td class="num">200–300 g</td><td>全谷物占比</td><td class="num">1/4–1/2</td></tr>' +
      '<tr><td>烹调油</td><td class="num">25–30 g</td><td>盐</td><td class="num">≤ 5 g</td></tr>' +
      '<tr><td>饮水(男/女)</td><td class="num">1700 / 1500 ml</td><td>膳食纤维</td><td class="num">25–30 g</td></tr>' +
      '</tbody></table></div></div>';
  }
  function catCN(c) { return { protein:'蛋白质', carbs:'碳水', fat:'脂肪', vit:'维生素', mineral:'矿物质' }[c]; }
  var CAT_TAB = [
    { id:'protein', label:'蛋白质', cls:'r' }, { id:'carbs', label:'碳水', cls:'y' },
    { id:'vit', label:'维生素', cls:'b' }, { id:'mineral', label:'矿物质', cls:'k' },
    { id:'fat', label:'脂肪', cls:'g' }
  ];

  /* ---------- 食材库（交互由 recipe() 中的统一委托处理） ---------- */
  function renderLib(box) {
    box.innerHTML =
      '<div class="panel mb16"><div class="panel-b tight">' +
        '<div class="opts mb8" id="libCats">' +
          CAT_TAB.map(function (c) { return '<button class="opt ' + (libCat === c.id ? 'on var-' + (c.cls === 'k' ? 'b' : c.cls) : '') + '" data-cat="' + c.id + '">' + c.label + '</button>'; }).join('') +
        '</div>' +
        '<input class="input" id="libSearch" placeholder="搜索食材名 / 标签（如：高铁、低GI、Omega-3）" value="' + esc(libQuery) + '">' +
      '</div></div>' +
      '<div class="grid g3" id="libGrid"></div>';
    drawLibGrid(box);
  }
  function drawLibGrid(box) {
    var grid = $('#libGrid', box);
    if (!grid) return;
    var q = libQuery;
    var list = D.INGREDIENTS.filter(function (x) {
      // 有关键词时跨全部分类搜索；无关键词时按当前营养分类浏览
      if (q) return x.name.indexOf(q) >= 0 || x.tags.join('').indexOf(q) >= 0;
      return x.cat === libCat;
    });
    grid.innerHTML = list.map(function (x) {
      return '<div class="ing-card"><div class="ic-top"><div class="ic-name">' + esc(x.name) + '</div>' +
        '<span class="ic-cat ' + x.cat + '">' + catCN(x.cat) + '</span></div>' +
        '<div class="ic-nums"><div><b>' + x.kcal + '</b>kcal</div><div><b style="color:#E62325">' + x.p + '</b>P</div><div><b>' + x.c + '</b>C</div></div>' +
        '<div class="ic-nums"><div><b style="color:#1E4E9C">' + x.f + '</b>F</div><div><b>' + global.UI.n1(E.fiberOf(x)) + '</b>纤维</div><div><b>' + x.tags.length + '</b>标签</div></div>' +
        '<div class="tiny muted">' + x.tags.map(esc).join(' · ') + '</div>' +
        '<div class="ic-price"><span>今日单价</span><span>' + global.UI.yuan(x.price) + '/100g</span></div>' +
        '<div class="inline-num"><input class="input lib-g" data-id="' + x.id + '" type="number" value="100" min="10" step="10"><span class="tiny">g</span>' +
        '<button class="btn btn-sm btn-k" data-addlib="' + x.id + '">加入篮</button></div></div>';
    }).join('') || '<div class="empty">无匹配食材</div>';
  }

  /* ---------- 食材篮 ---------- */
  function renderPantry(box, budget) {
    var items = S.state.pantry.map(function (x) {
      return { ing:D.byId(D.INGREDIENTS, x.id), g:x.g };
    }).filter(function (x) { return x.ing; });
    var t = S.pantryTotals();
    var T = E.targetMacros(S.state.profile);
    box.innerHTML =
      '<div class="grid g4 mb16">' +
        H.stat('篮中能量', Math.round(t.kcal), 'kcal', '目标 ' + Math.round(T.kcal), 'accent-k') +
        H.stat('蛋白/碳水', global.UI.n1(t.p) + ' / ' + global.UI.n1(t.c), 'g', '脂肪 ' + global.UI.n1(t.f) + 'g · 纤维 ' + global.UI.n1(t.fiber) + 'g', 'accent-r') +
        H.stat('食材总价', global.UI.yuan(t.cost), '', '日预算 ' + global.UI.yuan(budget.daily), t.cost > budget.daily ? 'accent-r' : 'accent-y') +
        '<div class="stat"><div class="s-label">操作</div><div class="opts mt8"><button class="btn btn-sm btn-r" id="pClear">清空</button>' +
        '<button class="btn btn-sm btn-b" data-rtabgo="plan">去生成食谱</button></div></div>' +
      '</div>' +
      (items.length ? '<div class="panel"><div class="panel-b tight">' + items.map(function (it, i) {
        var n = E.nutritionOf(it.ing, it.g);
        return '<div class="list-row"><span class="ic-cat ' + it.ing.cat + '">' + catCN(it.ing.cat) + '</span>' +
          '<div class="lr-main"><div class="lr-title">' + esc(it.ing.name) + '</div>' +
          '<div class="lr-sub">' + global.UI.n1(n.p) + 'P · ' + global.UI.n1(n.c) + 'C · ' + global.UI.n1(n.f) + 'F · ' + Math.round(n.kcal) + ' kcal</div></div>' +
          '<div class="inline-num"><button class="btn btn-sm btn-g" data-pg="' + it.ing.id + '" data-d="-10">−</button>' +
          '<input class="input" data-pginput="' + it.ing.id + '" style="width:74px" type="number" value="' + Math.round(it.g) + '">' +
          '<button class="btn btn-sm btn-g" data-pg="' + it.ing.id + '" data-d="10">＋</button></div>' +
          '<div class="lr-val" style="min-width:64px;text-align:right">' + global.UI.yuan(n.cost) + '</div></div>';
      }).join('') + '</div></div>' : '<div class="empty">食材篮为空<br/><br/>到「食材库」按营养分类挑选，或先生成智能食谱一键加入</div>');
  }

  /* ---------- 注入视图 ---------- */
  // 包装 health 以便在渲染后补绘报告图表
  var _health = health;
  health = function (root, ctx) {
    _health(root, ctx);
    drawReportCharts(root, S.recentHealth(7));
  };

  global.FITVIEWS = global.FITVIEWS || {};
  Object.assign(global.FITVIEWS, { diet:diet, exercise:exercise, health:health, recipe:recipe });
})(window);
