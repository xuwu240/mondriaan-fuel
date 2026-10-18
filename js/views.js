/* ============================================================
 * views.js — 视图（1）：建档 / 总览 / 3D形象 / 个人资料
 * 视图（2）：见 views2.js
 * ============================================================ */
(function (global) {
  'use strict';
  var D = global.FITDATA, E = global.FITENGINE, S = global.FITSTORE;
  // UI 由 app.js 在本脚本之后定义，这里用惰性包装保证调用时才访问
  function $(s, r) { return global.UI.$(s, r); }
  function $$(s, r) { return global.UI.$$(s, r); }
  function esc(s) { return global.UI.esc(s); }
  function n1(v) { return global.UI.n1(v); }
  function n0(v) { return global.UI.n0(v); }

  function panelHead(tabCls, tabText, titleHtml) {
    return '<div class="panel-h"><span class="ph-tab ' + tabCls + '">' + tabText + '</span>' +
      '<div class="ph-title">' + titleHtml + '</div></div>';
  }
  function bmiCat(v) {
    if (v < 18.5) return { t:'偏瘦', c:'b' };
    if (v < 24) return { t:'正常', c:'y' };
    if (v < 28) return { t:'超重', c:'r' };
    return { t:'肥胖', c:'r' };
  }
  function goalText(p) {
    var g = p.goals || {}, arr = [];
    if (g.fatloss) arr.push('减脂 → 体脂 ' + g.targetBF + '%');
    if (g.muscle) arr.push('增肌 · ' + ((g.muscleParts || []).join('/') || '全身'));
    if (g.posture) arr.push('体态修正 · ' + ((g.postureParts || []).join('/') || '—'));
    return arr.length ? arr.join('；') : '维持现状';
  }

  /* ============================================================
   * 通用：个人资料表单（建档 & 编辑共用）
   * ============================================================ */
  function renderProfileForm(root, p0, opts) {
    opts = opts || {};
    function html(p) {
      var female = p.gender === 'female';
      var g = p.goals || { fatloss:false, muscle:false, posture:false, targetBF:20, muscleParts:[], postureParts:[] };
      return '' +
      (opts.hero ? '' : '') +
      '<div class="grid g2">' +
        '<div class="panel"><div class="panel-h">' + panelHead('ph-k', 'A', '基础信息') + '</div><div class="panel-b">' +
          '<div class="field"><label>性别 <span class="req">*</span></label>' +
            '<div class="opts" data-gender>' +
              '<button type="button" class="opt var-b ' + (p.gender === 'male' ? 'on' : '') + '" data-v="male">男</button>' +
              '<button type="button" class="opt var-r ' + (female ? 'on' : '') + '" data-v="female">女</button>' +
            '</div></div>' +
          '<div class="row2">' +
            numField('weight', '体重 (kg)', p.weight, 30, 250, 0.1) +
            numField('targetWeight', '目标体重 (kg)', p.targetWeight, 30, 250, 0.1) +
            numField('height', '身高 (cm)', p.height, 120, 220, 1) +
            numField('age', '年龄 (岁)', p.age, 12, 90, 1) +
          '</div>' +
          (female ? '<div class="comp r mt8"><span class="comp-bar"></span><div class="comp-bd"><h4>生理周期记录</h4>' +
            '<div class="row2">' +
              '<div class="field"><label>最近一次月经首日</label><input class="input" type="date" id="f-cycleDate" value="' + esc((p.cycle && p.cycle.lastDate) || '') + '"></div>' +
              '<div class="row2"><div class="field"><label>周期长度(天)</label><input class="input" id="f-cycleLen" type="number" min="21" max="40" value="' + ((p.cycle && p.cycle.len) || 28) + '"></div>' +
              '<div class="field"><label>经期(天)</label><input class="input" id="f-cyclePer" type="number" min="2" max="10" value="' + ((p.cycle && p.cycle.period) || 5) + '"></div></div>' +
            '</div><p class="tiny muted">用于生成周期日历、排卵期预测与经期专属训练/营养建议，数据仅存本机。</p></div></div>' :
          '<div class="comp b mt8"><span class="comp-bar"></span><div class="comp-bd"><h4>睾酮激素周期记录</h4>' +
            '<div class="field"><label>自觉晨峰时段（精力/状态最佳）</label><div class="opts wrap" data-tpeak>' +
              D.TESTO_PEAKS.map(function (x) { return '<button type="button" class="opt ' + (((p.tcycle && p.tcycle.peak) || 'p2') === x.id ? 'on var-b' : '') + '" data-v="' + x.id + '">' + x.label + '</button>'; }).join('') + '</div></div>' +
            '<div class="field"><label>晨间状态自评（晨勃频率，睾酮水平间接指标）</label><div class="opts wrap" data-tmorn>' +
              D.TESTO_MORNING.map(function (x) { return '<button type="button" class="opt ' + (((p.tcycle && p.tcycle.morningId) || 'm3') === x.id ? 'on var-y' : '') + '" data-v="' + x.id + '">' + x.label + '</button>'; }).join('') + '</div></div>' +
            '<div class="field"><label>每周力量训练次数 (0–7)</label><input class="input" id="f-trainDays" type="number" min="0" max="7" value="' + ((p.tcycle && p.tcycle.trainDays) != null ? p.tcycle.trainDays : 3) + '"></div>' +
            '<p class="tiny muted">用于生成睾酮昼夜/周节律分析与训练窗口建议（睾酮晨峰期力量输出较高），数据仅存本机。</p></div></div>') +
        '</div></div>' +

        '<div class="panel"><div class="panel-h">' + panelHead('ph-y', 'B', '职业与健身背景') + '</div><div class="panel-b">' +
          '<div class="field"><label>职业类型 <span class="req">*</span></label><div class="opts wrap" data-occ>' +
            D.OCCUPATIONS.map(function (o) {
              return '<button type="button" class="opt ' + (p.occupation === o.id ? 'on' : '') + '" data-v="' + o.id + '">' + o.label +
                '<small>' + esc(o.examples) + '</small></button>';
            }).join('') +
          '</div></div>' +
          '<div class="field"><label>个性化需求描述</label>' +
            '<textarea class="input" id="f-need" placeholder="如：乳糖不耐受 / 只吃清真餐 / 每天两餐 / 预算有限 / 膝盖旧伤不能跑跳…">' + esc(p.needText || '') + '</textarea></div>' +
          '<div class="field"><label>健身年限</label><div class="opts" data-exp>' +
            D.EXPERIENCE.map(function (x) {
              return '<button type="button" class="opt var-b ' + (p.experience === x.id ? 'on' : '') + '" data-v="' + x.id + '">' + x.label + '<small>' + esc(x.desc) + '</small></button>';
            }).join('') +
          '</div></div>' +
        '</div></div>' +
      '</div>' +

      '<div class="panel mt16"><div class="panel-h">' + panelHead('ph-r', 'C', '健身目标（可多选，推荐引擎将分别给出方案）') + '</div><div class="panel-b">' +
        '<div class="grid g3">' +
          '<div><button type="button" class="opt btn-block var-r ' + (g.fatloss ? 'on' : '') + '" data-goaltoggle="fatloss" style="padding:12px">减脂</button>' +
            '<div class="field mt8" id="fatlossBox" style="display:' + (g.fatloss ? 'block' : 'none') + '">' +
              '<label>目标体脂率 (%)</label><div class="inline-num"><input class="input" id="f-targetBF" type="number" min="8" max="45" step="0.5" value="' + (g.targetBF || 20) + '">' +
              '<span class="small muted">男推荐 12-18% / 女 20-25%</span></div></div></div>' +
          '<div><button type="button" class="opt btn-block var-y ' + (g.muscle ? 'on' : '') + '" data-goaltoggle="muscle" style="padding:12px">增肌</button>' +
            '<div class="field mt8" id="muscleBox" style="display:' + (g.muscle ? 'block' : 'none') + '">' +
              '<label>目标部位（多选）</label><div class="opts wrap" data-mparts>' +
                D.BODY_PARTS_MUSCLE.map(function (x) {
                  return '<button type="button" class="opt ' + ((g.muscleParts || []).indexOf(x) >= 0 ? 'on var-b' : '') + '" data-v="' + x + '">' + x + '</button>';
                }).join('') + '</div></div></div>' +
          '<div><button type="button" class="opt btn-block var-b ' + (g.posture ? 'on' : '') + '" data-goaltoggle="posture" style="padding:12px">体态修正</button>' +
            '<div class="field mt8" id="postureBox" style="display:' + (g.posture ? 'block' : 'none') + '">' +
              '<label>需修正部位（多选）</label><div class="opts wrap" data-pparts>' +
                D.BODY_PARTS_POSTURE.map(function (x) {
                  return '<button type="button" class="opt ' + ((g.postureParts || []).indexOf(x) >= 0 ? 'on var-r' : '') + '" data-v="' + x + '">' + x + '</button>';
                }).join('') + '</div></div></div>' +
        '</div>' +
        '<div class="mt16 flex"><button class="btn btn-k" id="f-save" style="flex:1;padding:14px">' + (opts.submitLabel || '保存档案') + '</button></div>' +
      '</div></div>';
    }

    function numField(id, label, val, min, max, step) {
      return '<div class="field"><label>' + label + '</label>' +
        '<div class="inline-num"><button type="button" class="btn btn-sm btn-g" data-step="-" data-target="f-' + id + '" data-stepv="' + step + '">−</button>' +
        '<input class="input" id="f-' + id + '" type="number" min="' + min + '" max="' + max + '" step="' + step + '" value="' + (val == null ? '' : val) + '">' +
        '<button type="button" class="btn btn-sm btn-g" data-step="+" data-target="f-' + id + '" data-stepv="' + step + '">＋</button></div></div>';
    }

    function draw(p) {
      var shell = document.createElement('div');
      shell.innerHTML = html(p);
      root.innerHTML = '';
      while (shell.firstChild) root.appendChild(shell.firstChild);
      // 事件绑定到一次性容器，避免重复渲染造成监听器堆积
      var binder = document.createElement('div');
      binder.style.display = 'contents';
      // 直接在当前内容节点上绑定：内容在下一次 draw 时随 innerHTML 一并销毁
      root._bindClick && root.removeEventListener('click', root._bindClick);
      root._bindClick = onClick;
      root.addEventListener('click', onClick);
      root._bindChange && root.removeEventListener('change', root._bindChange);
      root._bindChange = onChange;
      root.addEventListener('change', onChange);
    }
    function onClick(e) {
      var gender = e.target.closest('[data-gender] button');
      if (gender) {
        var p = gather(); p.gender = gender.getAttribute('data-v');
        if (p.gender === 'female' && !p.cycle) p.cycle = { lastDate:'', len:28, period:5 };
        if (p.gender === 'male' && !p.tcycle) p.tcycle = { peak:'p2', morningId:'m3', morningScore:3, trainDays:3 };
        rebind(p); draw(p); return;
      }
      var tp = e.target.closest('[data-tpeak] button');
      if (tp) { var pt = gather(); pt.tcycle = pt.tcycle || {}; pt.tcycle.peak = tp.getAttribute('data-v'); rebind(pt); draw(pt); return; }
      var tm = e.target.closest('[data-tmorn] button');
      if (tm) {
        var pm = gather(); pm.tcycle = pm.tcycle || {}; pm.tcycle.morningId = tm.getAttribute('data-v');
        var mo = D.byId(D.TESTO_MORNING, pm.tcycle.morningId); pm.tcycle.morningScore = mo ? mo.score : 3;
        rebind(pm); draw(pm); return;
      }
      var occ = e.target.closest('[data-occ] button');
      if (occ) { var po = gather(); po.occupation = occ.getAttribute('data-v'); rebind(po); draw(po); return; }
      var exp = e.target.closest('[data-exp] button');
      if (exp) { var pe = gather(); pe.experience = exp.getAttribute('data-v'); rebind(pe); draw(pe); return; }
      var mp = e.target.closest('[data-mparts] button');
      if (mp) {
        var v = mp.getAttribute('data-v'), pg = gather();
        pg.goals.muscleParts = pg.goals.muscleParts || [];
        var i = pg.goals.muscleParts.indexOf(v);
        if (i >= 0) pg.goals.muscleParts.splice(i, 1); else pg.goals.muscleParts.push(v);
        rebind(pg); draw(pg); return;
      }
      var ppp = e.target.closest('[data-pparts] button');
      if (ppp) {
        var pv = ppp.getAttribute('data-v'), q = gather();
        q.goals.postureParts = q.goals.postureParts || [];
        var j = q.goals.postureParts.indexOf(pv);
        if (j >= 0) q.goals.postureParts.splice(j, 1); else q.goals.postureParts.push(pv);
        rebind(q); draw(q); return;
      }
      var gt = e.target.closest('[data-goaltoggle]');
      if (gt) {
        var key = gt.getAttribute('data-goaltoggle'), pk = gather();
        pk.goals[key] = !pk.goals[key];
        rebind(pk); draw(pk); return;
      }
      var st = e.target.closest('[data-step]');
      if (st) {
        var inp = document.getElementById(st.getAttribute('data-target'));
        var d = parseFloat(st.getAttribute('data-stepv')) * (st.getAttribute('data-step') === '+' ? 1 : -1);
        inp.value = String(Math.round((parseFloat(inp.value || 0) + d) * 100) / 100);
        return;
      }
      if (e.target.id === 'f-save') {
        var data = gather(), err = validate(data);
        if (err) { global.UI.toast(err, 'r'); return; }
        if (opts.onSave) opts.onSave(data);
      }
    }
    function onChange() { /* 数值直接从 DOM 收集，无需即时响应 */ }

    function rebind(p) { root._formVal = p; }
    function gather() {
      var base = root._formVal || p0;
      var p = JSON.parse(JSON.stringify(base));
      p.goals = p.goals || { fatloss:false, muscle:false, posture:false, targetBF:20, muscleParts:[], postureParts:[] };
      p.gender = active('[data-gender] button');
      p.weight = num('#f-weight'); p.targetWeight = num('#f-targetWeight');
      p.height = num('#f-height'); p.age = num('#f-age');
      p.occupation = active('[data-occ] button') || p.occupation;
      p.experience = active('[data-exp] button') || p.experience;
      p.needText = val('#f-need');
      if (p.gender === 'female') {
        p.cycle = { lastDate:val('#f-cycleDate'), len:parseInt(val('#f-cycleLen')) || 28, period:parseInt(val('#f-cyclePer')) || 5 };
      } else {
        var tPk = active('[data-tpeak] button') || (p.tcycle && p.tcycle.peak) || 'p2';
        var tMn = active('[data-tmorn] button') || (p.tcycle && p.tcycle.morningId) || 'm3';
        var tMo = D.byId(D.TESTO_MORNING, tMn);
        p.tcycle = {
          peak:tPk, morningId:tMn,
          morningScore:tMo ? tMo.score : 3,
          trainDays:Math.max(0, Math.min(7, parseInt(val('#f-trainDays')) || 0))
        };
      }
      p.goals.fatloss = !!$('[data-goaltoggle="fatloss"].on', root);
      p.goals.muscle = !!$('[data-goaltoggle="muscle"].on', root);
      p.goals.posture = !!$('[data-goaltoggle="posture"].on', root);
      p.goals.targetBF = parseFloat(val('#f-targetBF')) || 20;
      // 部位选择区仅在对应目标开启时渲染；未渲染时保留状态中已选部位，避免开关切换瞬间被清空
      var mpBtns = $$('[data-mparts] button', root);
      var ppBtns = $$('[data-pparts] button', root);
      p.goals.muscleParts = mpBtns.length
        ? mpBtns.filter(function (x) { return x.classList.contains('on'); }).map(function (x) { return x.getAttribute('data-v'); })
        : (p.goals.muscleParts || []);
      p.goals.postureParts = ppBtns.length
        ? ppBtns.filter(function (x) { return x.classList.contains('on'); }).map(function (x) { return x.getAttribute('data-v'); })
        : (p.goals.postureParts || []);
      return p;
      function active(sel) { var x = $(sel + '.on', root); return x ? x.getAttribute('data-v') : null; }
      function num(sel) { var v = parseFloat(val(sel)); return isNaN(v) ? null : v; }
      function val(sel) { var x = $(sel, root); return x ? x.value.trim() : ''; }
    }
    function validate(p) {
      if (!p.gender) return '请选择性别';
      if (!(p.weight > 0)) return '请填写体重';
      if (!(p.height > 0)) return '请填写身高';
      if (!(p.age > 0)) return '请填写年龄';
      if (!(p.targetWeight > 0)) return '请填写目标体重';
      if (p.weight < 30 || p.weight > 250) return '体重数值异常';
      if (p.gender === 'female' && !p.cycle.lastDate) return '请记录最近一次月经首日（用于周期分析）';
      return null;
    }

    draw(p0);
    return { gather:gather };
  }

  /* ============================================================
   * 0. 建档引导
   * ============================================================ */
  function onboarding(root) {
    var p = S.state.profile || {
      gender:'female', weight:60, height:165, age:24, targetWeight:53,
      occupation:'sedentary', experience:'newbie', needText:'',
      goals:{ fatloss:false, targetBF:22, muscle:false, muscleParts:[], posture:false, postureParts:[] },
      cycle:{ lastDate:'', len:28, period:5 },
      tcycle:{ peak:'p2', morningId:'m3', morningScore:3, trainDays:3 }
    };
    root.innerHTML =
      '<div class="onb">' +
        '<div class="onb-hero mb16"><div class="oh-l">' +
          '<div class="legend mb8"><span><i style="background:#E62325"></i>RED</span><span><i style="background:#F7D41A"></i>YELLOW</span><span><i style="background:#1E4E9C"></i>BLUE</span></div>' +
          '<h2>EAT BY<br/>THE GRID.</h2>' +
          '<div class="oh-sub">个人健身餐定制 · 荷兰风格派</div>' +
          '<p class="small fw9" style="line-height:1.8">以红黄蓝三原色与粗黑网格重构你的营养系统：身体建模 → 目标拆解 → 克级食谱 → 数据闭环。' +
          '所有计算依据《中国居民膳食指南（2022）》与 Mifflin-St Jeor 能量公式，全部数据仅保存在本机浏览器。</p>' +
        '</div><div class="oh-r"><div class="block-r">BODY</div><div class="block-y">FUEL</div><div class="block-b" style="color:#fff">GRID</div></div></div>' +
        '<div class="onb-grid mb16"><div><h5>① 3D 形象</h5><p>拍照分析 + 体型参数，生成当前/目标双形象</p></div>' +
        '<div><h5>② 数据闭环</h5><p>饮食拍照识别、手表同步、热量缺口可视</p></div>' +
        '<div><h5>③ 克级食谱</h5><p>预算约束下的三餐加餐与食材替代方案</p></div></div>' +
        '<div id="onbForm"></div>' +
      '</div>';
    renderProfileForm($('#onbForm', root), p, {
      submitLabel:'建立我的营养网格 →',
      onSave:function (data) {
        if (!S.state.profile) data.startWeight = data.weight;
        else data.startWeight = S.state.profile.startWeight || data.weight;
        S.setProfile(data);
        global.UI.toast('档案已建立，欢迎进入网格', 'y');
        global.UI.go('avatar');
      }
    });
  }

  /* ============================================================
   * 1. 总览
   * ============================================================ */
  function dashboard(root, ctx) {
    var p = S.state.profile;
    if (!p) { global.UI.go('onboarding'); return; }
    var T = E.targetMacros(p), intake = S.dayIntake();
    var ex = S.syncedExercise();
    var st = E.calorieStatus(p, intake.kcal, ex && ex.kcal);
    var wp = E.weightProgress(p);
    var h = S.getHealth();
    var cyc = p.gender === 'female' ? E.cycleAnalysis(p.cycle, S.todayKey())
      : (p.tcycle ? E.testoAnalysis(p.tcycle, S.todayKey()) : null);
    var rec = E.workoutRec(p, h, cyc);
    var bmiV = E.bmi(p), bf = E.bodyFat(p), cat = bmiCat(bmiV);
    var day = S.ensureDietDay();

    root.innerHTML =
      '<div class="grid g4 mb16">' +
        stat('当前体重', n1(p.weight), 'kg', '目标 ' + n1(p.targetWeight) + ' kg', 'accent-k') +
        stat('BMI', n1(bmiV), cat.t, '身高 ' + p.height + 'cm', 'accent-' + cat.c) +
        stat('估算体脂率', n1(bf), '%', p.gender === 'male' ? '男性' : '女性' + ' · Deurenberg', 'accent-r') +
        stat('每日目标能量', n0(T.kcal), 'kcal', 'TDEE ' + n0(E.tdee(p)), 'accent-b') +
      '</div>' +

      '<div class="grid g-21">' +
        '<div>' +
          '<div class="panel"><div class="panel-h">' + panelHead('ph-b', '01', '今日能量 · 摄入 / 消耗') + '</div><div class="panel-b">' +
            '<div class="grid g3" style="align-items:center">' +
              '<div style="position:relative"><canvas id="ringKcal" style="height:190px"></canvas></div>' +
              '<div class="grid" style="gap:10px">' +
                energyRow('基础代谢 BMR', st.bmr, 'k') +
                energyRow('职业活动', st.activity, 'g') +
                energyRow('刻意运动', st.exercise, ex ? '' : 'g', ex ? null : '未连手表') +
                energyRow('总消耗', st.burn, 'k') +
                energyRow('已摄入', st.intake, 'r') +
              '</div>' +
              '<div class="ta-c">' +
                '<div class="bar cap ' + (st.deficit > 0 ? 'b' : 'r') + '" style="margin-bottom:10px"><i style="width:' + Math.min(100, Math.abs(st.deficit) / 800 * 100) + '%"></i>' +
                  '<span class="bar-txt">' + st.label + ' ' + Math.abs(st.deficit) + ' KCAL</span></div>' +
                verdict(st) +
                '<div class="tiny muted mt8">摄入 ' + n0(T.kcal * 0.9) + '–' + n0(T.kcal * 1.1) + ' kcal 为达标区间</div>' +
              '</div>' +
            '</div>' +
            '<div class="deco-strip mt16"><span></span><span></span><span></span><span></span></div>' +
            '<div class="grid g3">' + macroBar('蛋白质 P', intake.p, T.protein, '#E62325') +
              macroBar('碳水 C', intake.c, T.carbs, '#F7D41A') + macroBar('脂肪 F', intake.f, T.fat, '#1E4E9C') + '</div>' +
          '</div></div>' +

          '<div class="panel"><div class="panel-h">' + panelHead('ph-y', '02', '三餐 + 加餐 · 实时摄入') + '</div><div class="panel-b tight">' +
            D.MEAL_NAMES.map(function (m) {
              var list = day[m.id] || [], kc = Math.round(list.reduce(function (a, x) { return a + (x.kcal || 0); }, 0));
              return '<div class="list-row"><span class="chip ' + m.color + '">' + m.name + '</span>' +
                '<div class="lr-main"><div class="lr-title">' + list.length + ' 项记录</div>' +
                '<div class="lr-sub">' + (list.slice(0, 2).map(function (x) { return x.name; }).join('、') || '尚未打卡') + '</div></div>' +
                '<div class="lr-val">' + kc + ' <span class="s-unit">kcal</span></div></div>';
            }).join('') +
            '<button class="btn btn-k btn-block mt12" data-go="diet">去饮食打卡 →</button>' +
          '</div></div>' +

          '<div class="panel"><div class="panel-h">' + panelHead('ph-r', '03', '近 7 日能量趋势') + '</div><div class="panel-b">' +
            '<canvas id="weekBars" style="height:200px"></canvas>' +
            '<div class="legend mt8"><span><i style="background:#1E4E9C"></i>摄入</span><span><i style="background:#F7D41A"></i>消耗</span></div>' +
          '</div></div>' +
        '</div>' +

        '<div>' +
          '<div class="panel block-k" style="box-shadow:5px 5px 0 #111"><div class="panel-b">' +
            '<div class="tiny" style="letter-spacing:2px;opacity:.7">TODAY’S WORKOUT</div>' +
            '<h3 style="font-size:20px;margin:6px 0 4px">' + esc(rec.title) + '</h3>' +
            '<div class="small" style="opacity:.85">建议时长 ' + rec.minutes + ' 分钟</div>' +
            '<div class="mt8">' + rec.items.slice(0, 3).map(function (x) { return '<div class="small" style="border-left:3px solid #F7D41A;padding:2px 0 2px 8px;margin:5px 0">' + esc(x) + '</div>'; }).join('') + '</div>' +
            '<button class="btn btn-y btn-block mt12" data-go="health">查看完整推荐</button>' +
          '</div></div>' +

          '<div class="panel"><div class="panel-h">' + panelHead('ph-y', '04', '目标进度') + '</div><div class="panel-b">' +
            '<div class="flex-between"><span class="small fw9">已完成</span><b style="font-family:var(--cond);font-size:22px">' + n1(wp.pct) + '%</b></div>' +
            '<div class="bar y cap mt8"><i style="width:' + wp.pct + '%"></i><span class="bar-txt">' + esc(goalText(p)) + '</span></div>' +
            '<div class="grid g2 mt12">' +
              '<div class="stat"><div class="s-label">距目标</div><div class="s-value">' + Math.abs(wp.gap) + '<span class="s-unit">kg</span></div></div>' +
              '<div class="stat"><div class="s-label">体重曲线</div><canvas id="wtSpark" style="height:46px"></canvas></div>' +
            '</div>' +
            '<button class="btn btn-sm btn-block mt12" id="logWt">记录今日体重</button>' +
          '</div></div>' +

          (cyc && cyc.kind !== 'testo' ? '<div class="panel"><div class="panel-h">' + panelHead('ph-r', '★', '生理周期') + '</div><div class="panel-b tight">' +
            '<div class="flex-between"><span class="small fw9">周期第 ' + cyc.day + ' 天</span><span class="chip r">' + phaseName(cyc.phase) + '</span></div>' +
            '<div class="tiny muted mt8">距下次月经约 ' + cyc.daysToNext + ' 天 · 预计 ' + cyc.nextDate + '</div>' +
            '<button class="btn btn-sm btn-block mt8" data-go="health">周期分析与日历</button>' +
          '</div></div>' : '') +
          (cyc && cyc.kind === 'testo' ? '<div class="panel"><div class="panel-h">' + panelHead('ph-b', '♂', '睾酮激素周期') + '</div><div class="panel-b tight">' +
            '<div class="flex-between"><span class="small fw9">节律指数 ' + cyc.index + '</span><span class="chip b">' + phaseName(cyc.phase) + '</span></div>' +
            '<div class="tiny muted mt8">晨峰窗口 ' + cyc.peakWindow + ' · ' + esc(cyc.bestTrainWindow) + '</div>' +
            '<button class="btn btn-sm btn-block mt8" data-go="health">睾酮节律分析</button>' +
          '</div></div>' : '') +

          '<div class="panel"><div class="panel-h">' + panelHead('ph-b', '05', '快捷操作') + '</div><div class="panel-b tight" style="display:grid;gap:8px">' +
            '<button class="btn btn-r btn-block" data-go="diet">📷 拍照识别一餐</button>' +
            '<button class="btn btn-b btn-block" data-go="exercise">' + (ex ? '🔄 同步手表数据' : '⌚ 连接运动手表') + '</button>' +
            '<button class="btn btn-y btn-block" data-go="recipe">🍱 生成今日克级食谱</button>' +
            '<button class="btn btn-block" data-go="avatar">🧍 更新 3D 形象</button>' +
          '</div></div>' +
        '</div>' +
      '</div>';

    global.FITCHARTS.ring($('#ringKcal'), {
      value:intake.kcal, max:Math.max(T.kcal, intake.kcal),
      center:intake.kcal + '', sub:'/ ' + n0(T.kcal) + ' kcal',
      label:'今日已摄入', color:'#1E4E9C', thick:16, big:30
    });
    global.FITCHARTS.bars($('#weekBars'), weekItems(), { c1:'#1E4E9C', c2:'#F7D41A' });
    var wl = (S.state.weightLog.length >= 2 ? S.state.weightLog : [
      { weight:p.startWeight || p.weight }, { weight:p.weight }
    ]).slice(-14).map(function (x) { return x.weight; });
    global.FITCHARTS.spark($('#wtSpark'), wl, { color:'#E62325' });

    $('#logWt').addEventListener('click', function () {
      global.UI.modal('记录今日体重',
        '<div class="field"><label>体重 (kg)</label><input class="input" id="m-wt" type="number" step="0.1" value="' + p.weight + '"></div>',
        [{ label:'取消', cls:'btn-g', onClick:global.UI.closeModal },
         { label:'保存', cls:'btn-k', onClick:function () {
             var v = parseFloat($('#m-wt').value);
             if (!(v > 0)) return global.UI.toast('请输入有效体重', 'r');
             p.weight = v; S.setProfile(p); S.logWeight(v); global.UI.closeModal();
             global.UI.toast('已记录 ' + v + ' kg', 'y'); global.UI.go('dashboard');
           } }]);
    });

    ctx.stop(function () {});
  }

  function stat(label, value, unit, sub, cls) {
    return '<div class="stat ' + (cls || '') + '"><div class="s-label">' + label + '</div>' +
      '<div class="s-value">' + value + '<span class="s-unit">' + (unit || '') + '</span></div>' +
      (sub ? '<div class="s-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function energyRow(label, v, cls, sub) {
    return '<div class="flex-between" style="border-bottom:2px solid #eee;padding:6px 0">' +
      '<span class="small fw9">' + label + (sub ? '<br><span class="tiny muted">' + esc(sub) + '</span>' : '') + '</span>' +
      '<b style="font-family:var(--cond);font-size:18px">' + n0(v) + '</b></div>';
  }
  function verdict(st) {
    var map = {
      fatloss:'今日建议保持 250–600 kcal 缺口，避免节食过狠流失肌肉',
      muscle:'增肌期建议 200–400 kcal 温和盈余，配合力量训练',
      keep:'摄入围绕消耗 ±250 kcal 波动即属理想平衡'
    };
    return '<div class="small fw9" style="border:var(--bd);padding:8px 10px;background:' + (st.ok ? '#F7D41A' : '#fff') + '">' +
      (st.ok ? '✔ ' : '⚠ ') + esc(map[st.goal] || '') + '</div>';
  }
  function macroBar(name, v, t, color) {
    var pct = Math.min(100, v / t * 100);
    return '<div><div class="flex-between tiny fw9 mb8"><span>' + name + '</span><span>' + global.UI.n1(v) + ' / ' + global.UI.n1(t) + ' g</span></div>' +
      '<div class="bar"><i style="width:' + pct + '%;background:' + color + '"></i></div></div>';
  }
  function weekItems() {
    var labels = ['一','二','三','四','五','六','日'];
    var out = [];
    var now = new Date();
    var monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday); d.setDate(monday.getDate() + i);
      var k = S.todayKey(d);
      var intake = S.dayIntake(k).kcal;
      var ex = S.syncedExercise(k);
      var pp = S.state.profile;
      var burn = pp ? Math.round(E.bmr(pp) * E.occupation(pp).factor + (ex ? ex.kcal : 0)) : 0;
      out.push({ label:labels[i], v1:intake, v2:burn });
    }
    return out;
  }
  function phaseName(ph) {
    return { period:'经期', follicular:'卵泡期', fertile:'易孕期', ovulation:'排卵日', luteal:'黄体期',
      '晨峰期':'晨峰期', '日间高位':'日间高位', '午后回落':'午后回落', '夜间低谷':'夜间低谷' }[ph] || ph;
  }

  /* ============================================================
   * 2. 3D 人物形象
   * ============================================================ */
  function avatar(root, ctx) {
    var p = S.state.profile;
    if (!p) { global.UI.go('onboarding'); return; }
    var stops = [];
    function stopAll() { stops.forEach(function (f) { try { f(); } catch (e) {} }); }
    ctx.stop(stopAll);

    var bfNow = E.bodyFat(p);
    var targetBF = p.goals && p.goals.fatloss ? parseFloat(p.goals.targetBF) :
      Math.max(p.gender === 'male' ? 12 : 18, bfNow - (p.gender === 'male' ? 3 : 2));
    var pT = JSON.parse(JSON.stringify(p)); pT.weight = p.targetWeight; delete pT.measure;
    // 实测围度覆盖（用户手动录入），目标侧始终用模型估算；身高参与 3D 建模
    function effMeasure(pp) {
      var m = E.measurements(pp), ov = pp.measure || {};
      ['chest','waist','hip','thigh'].forEach(function (k) { if (ov[k] != null) m[k] = ov[k]; });
      m.height = pp.height;
      return m;
    }
    var mNow = effMeasure(p), mTar = effMeasure(pT);
    var Bnow = global.FITAVATAR.buildBody(mNow, bfNow, p.gender, p.photoTone);
    var Btar = global.FITAVATAR.buildBody(mTar, targetBF, p.gender, p.photoTone);
    var M_RANGE = { weight:[30,250], chest:[50,160], waist:[40,160], hip:[50,170], thigh:[25,100] };
    var M_LABEL = { weight:'体重', chest:'胸围', waist:'腰围', hip:'臀围', thigh:'大腿围' };
    var M_UNIT = { weight:'kg', chest:'cm', waist:'cm', hip:'cm', thigh:'cm' };
    function mVal(k) {
      if (k === 'weight') return p.weight;
      return (p.measure && p.measure[k] != null) ? p.measure[k] : mNow[k];
    }

    root.innerHTML =
      '<div class="panel mb16"><div class="panel-h">' + panelHead('ph-k', '3D', '拍照生成 · 个性化 3D 人物模型') + '</div><div class="panel-b">' +
        '<div class="grid g-12">' +
          '<div class="photo-box scanbox" id="photoBox" style="min-height:230px">' +
            '<span class="pb-corner" style="left:6px;top:6px"></span><span class="pb-corner" style="right:6px;bottom:6px;background:var(--blue)"></span>' +
            (p.photo ? '<img src="' + p.photo + '" alt="用户照片">' :
              '<div class="pb-empty">尚无全身/半身照<br/><br/>建议：正面、紧身衣物、光线均匀</div>') +
          '</div>' +
          '<div>' +
            '<div class="opts" style="margin-bottom:10px">' +
              '<button class="btn btn-k" id="btnCam">📷 拍照上传</button>' +
              '<button class="btn" id="btnFile">🖼 从相册选择</button>' +
              (p.photo ? '<button class="btn btn-g" id="btnClearPhoto">移除照片</button>' : '') +
            '</div>' +
            '<div class="small fw9 mb8">模型参数 = 照片特征（肤色/轮廓）+ 身体数据（身高/体重/体脂/围度估算）</div>' +
            '<div id="photoResult" class="tiny muted">' + (p.photoTone != null ? photoResultHtml(p) : '上传照片后将在本机完成图像分析，不会上传到任何服务器。') + '</div>' +
            '<button class="btn btn-r btn-block mt12" id="btnBuild">重新生成双状态 3D 形象</button>' +
          '</div>' +
        '</div>' +
      '</div></div>' +

      '<div class="avatar-stage">' +
        avatarCol('as-head', '当前状态 · NOW', 'r', Bnow, mNow, p.weight, bfNow, 'canvasNow') +
        avatarCol('as-head', '目标状态 · TARGET', 'b', Btar, mTar, p.targetWeight, targetBF, 'canvasTar') +
      '</div>' +

      '<div class="panel mt16 mb16"><div class="panel-h">' + panelHead('ph-b', '✎', '身体数据实测录入（手动输入 · 即时更新 3D 形象）') + '</div><div class="panel-b">' +
        '<div class="grid g5" id="measGrid">' +
          ['weight','chest','waist','hip','thigh'].map(function (k) {
            return '<div class="field" style="margin:0"><label>' + M_LABEL[k] + ' (' + M_UNIT[k] + ')</label>' +
              '<input class="input meas-inp" id="meas-' + k + '" data-mk="' + k + '" type="number" step="0.1" value="' + mVal(k) + '" ' +
              'min="' + M_RANGE[k][0] + '" max="' + M_RANGE[k][1] + '" placeholder="' + M_RANGE[k][0] + '–' + M_RANGE[k][1] + '">' +
              '<div class="tiny muted meas-hint" data-mh="' + k + '">范围 ' + M_RANGE[k][0] + '–' + M_RANGE[k][1] + ' ' + M_UNIT[k] + '</div></div>';
          }).join('') +
        '</div>' +
        '<div class="flex-between wrap mt8"><span class="tiny muted">清空某项输入并回车 = 恢复该项模型估算；体重修改会同步写入档案与体重日志。</span>' +
        '<button class="btn btn-g btn-sm" id="measReset">全部恢复模型估算</button></div>' +
        '<div id="measErr" class="tiny mt8" style="color:#E62325;font-weight:700"></div>' +
      '</div></div>' +

      '<div class="panel"><div class="panel-h">' + panelHead('ph-y', 'Δ', '体型变化预测（当前 → 目标）') + '</div><div class="panel-b">' +
        '<table class="tb"><thead><tr><th>指标</th><th class="num">当前</th><th class="num">目标</th><th class="num">变化</th></tr></thead>' +
        '<tbody id="diffBody">' + diffRows() + '</tbody></table>' +
        '<p class="tiny muted mt8">围度为实测值（已录入项）或基于身高/BMI/体脂率的人群模型估算值，用于形象对比与趋势参考。</p>' +
      '</div></div>';

    function diffRows() {
      var mN = effMeasure(p);
      return diffRow('体重', p.weight, p.targetWeight, 'kg') +
        diffRow('体脂率', bfNow, targetBF, '%') +
        diffRow('腰围' + (p.measure && p.measure.waist != null ? '(实测)' : '(估)'), mN.waist, mTar.waist, 'cm') +
        diffRow('臀围' + (p.measure && p.measure.hip != null ? '(实测)' : '(估)'), mN.hip, mTar.hip, 'cm') +
        diffRow('胸围' + (p.measure && p.measure.chest != null ? '(实测)' : '(估)'), mN.chest, mTar.chest, 'cm') +
        diffRow('大腿围' + (p.measure && p.measure.thigh != null ? '(实测)' : '(估)'), mN.thigh, mTar.thigh, 'cm');
    }

    function avatarCol(headCls, title, cc, B, m, w, bf, cid) {
      var now = cid === 'canvasNow';
      return '<div class="as-col"><div class="as-head"><span>' + title + '</span><span class="chip ' + cc + '"' + (now ? ' id="asChipNow"' : '') + '>' + n1(w) + ' KG · ' + n1(bf) + '%</span></div>' +
        '<div class="as-canvas-wrap"><canvas id="' + cid + '"></canvas></div>' +
        '<div class="as-meta"' + (now ? ' id="asMetaNow"' : '') + '>' +
          '<span>肩宽 <b>' + m.shoulder + '</b> cm</span><span>胸围 <b>' + m.chest + '</b> cm</span>' +
          '<span>腰围 <b>' + m.waist + '</b> cm</span><span>臀围 <b>' + m.hip + '</b> cm</span>' +
          '<span>大腿 <b>' + m.thigh + '</b> cm</span><span>BMI <b>' + n1(E.bmi({ gender:p.gender, weight:w, height:p.height, age:p.age })) + '</b></span>' +
        '</div></div>';
    }

    // —— 围度手动输入：校验 → 应用 → 即时重渲染 3D ——
    function measValidate(k, raw) {
      if (raw === '' || raw == null) return { empty:true };
      var v = parseFloat(raw);
      if (!isFinite(v)) return { err:M_LABEL[k] + ' 必须为数字' };
      var r = M_RANGE[k];
      if (v < r[0] || v > r[1]) return { err:M_LABEL[k] + ' 需在 ' + r[0] + '–' + r[1] + ' ' + M_UNIT[k] + ' 之间' };
      return { v:Math.round(v * 10) / 10 };
    }
    function rebuildStageNow() {
      var bf2 = E.bodyFat(p);
      var m2 = effMeasure(p);
      var B2 = global.FITAVATAR.buildBody(m2, bf2, p.gender, p.photoTone);
      var r0 = stops[0];
      if (r0 && r0.setBody) {
        r0.setBody(B2); // 平滑形变过渡，保持行走动画连续
      } else {
        if (r0) { try { r0(); } catch (e) {} }
        stops[0] = global.FITAVATAR.render($('#canvasNow'), B2, {});
      }
      var meta = $('#asMetaNow');
      if (meta) meta.innerHTML =
        '<span>肩宽 <b>' + m2.shoulder + '</b> cm</span><span>胸围 <b>' + m2.chest + '</b> cm</span>' +
        '<span>腰围 <b>' + m2.waist + '</b> cm</span><span>臀围 <b>' + m2.hip + '</b> cm</span>' +
        '<span>大腿 <b>' + m2.thigh + '</b> cm</span><span>BMI <b>' + n1(E.bmi(p)) + '</b></span>';
      var chip = $('#asChipNow'); if (chip) chip.textContent = n1(p.weight) + ' KG · ' + n1(bf2) + '%';
      var db = $('#diffBody'); if (db) db.innerHTML = diffRows();
    }
    var measTimer = null, weightChanged = false;
    function applyMeasInput(inp, commit) {
      var k = inp.getAttribute('data-mk'), raw = inp.value.trim();
      var r = measValidate(k, raw);
      var errBox = $('#measErr');
      if (r.err) {
        inp.style.borderColor = '#E62325'; inp.style.background = '#FDECEA';
        if (errBox) errBox.textContent = r.err;
        return false;
      }
      inp.style.borderColor = ''; inp.style.background = '';
      if (errBox) errBox.textContent = '';
      if (k === 'weight') {
        if (r.empty) { inp.value = p.weight; return true; } // 体重不允许为空
        if (r.v !== p.weight) { p.weight = r.v; weightChanged = true; }
      } else {
        p.measure = p.measure || {};
        if (r.empty) delete p.measure[k]; else p.measure[k] = r.v;
      }
      S.setProfile(p);
      rebuildStageNow();
      if (commit && weightChanged) { S.logWeight(p.weight); weightChanged = false; }
      return true;
    }
    $$('.meas-inp', root).forEach(function (inp) {
      inp.addEventListener('input', function () {
        clearTimeout(measTimer);
        measTimer = setTimeout(function () { applyMeasInput(inp, false); }, 450);
      });
      inp.addEventListener('change', function () {
        clearTimeout(measTimer); applyMeasInput(inp, true);
      });
    });
    $('#measReset').addEventListener('click', function () {
      delete p.measure; S.setProfile(p);
      stopAll(); avatar(root, ctx);
      global.UI.toast('围度已恢复模型估算', 'y');
    });

    requestAnimationFrame(function () {
      stops.push(global.FITAVATAR.render($('#canvasNow'), Bnow, {}));
      stops.push(global.FITAVATAR.render($('#canvasTar'), Btar, { shirt:'#1E4E9C' }));
    });

    $('#btnCam').addEventListener('click', function () { upload(true); });
    $('#btnFile').addEventListener('click', function () { upload(false); });
    var bc = $('#btnClearPhoto'); if (bc) bc.addEventListener('click', function () {
      p.photo = null; p.photoTone = null; S.setProfile(p); avatar(root, ctx);
    });
    $('#btnBuild').addEventListener('click', function () { stopAll(); avatar(root, ctx); global.UI.toast('已按最新数据重建模型', 'y'); });

    function upload(cam) {
      global.UI.chooseImage(cam).then(function (res) {
        var box = $('#photoBox');
        box.innerHTML = '<img src="' + res.dataUrl + '"><div class="scanline"></div>';
        global.FITAVATAR.analyzePhoto(res.dataUrl).then(function (a) {
          p.photo = res.dataUrl;
          p.photoTone = a ? a.tone : null;
          p.photoMeta = a || null;
          S.setProfile(p);
          global.UI.toast('照片分析完成，3D 形象已更新', 'y');
          stopAll(); avatar(root, ctx);
        });
      });
    }
  }

  function photoResultHtml(p) {
    var a = p.photoMeta || {};
    var tones = ['偏浅肤色', '浅中肤色', '健康小麦色', '深肤色'];
    return '<div class="list-row"><div class="lr-main"><div class="lr-title">' + esc(tones[p.photoTone] || '标准肤色') +
      '</div><div class="lr-sub">皮肤检出 ' + (a.skinCoverage != null ? a.skinCoverage + '%' : '—') +
      ' · 轮廓边缘 ' + (a.edgeRatio != null ? a.edgeRatio + '%' : '—') + ' · 画面亮度 ' + (a.brightness != null ? a.brightness : '—') +
      '</div></div><span class="chip y">本地分析</span></div>';
  }

  function diffRow(name, a, b, unit) {
    var d = Math.round((b - a) * 10) / 10;
    var arrow = d < 0 ? '↓ −' : (d > 0 ? '↑ +' : '= ±');
    var cls = d < 0 ? 'r' : (d > 0 ? 'b' : 'g');
    return '<tr><td>' + name + '</td><td class="num">' + n1(a) + ' ' + unit + '</td><td class="num">' + n1(b) + ' ' + unit +
      '</td><td class="num"><span class="chip ' + cls + '">' + arrow + Math.abs(d) + ' ' + unit + '</span></td></tr>';
  }

  /* ============================================================
   * 3. 个人资料
   * ============================================================ */
  function profile(root) {
    var p = S.state.profile;
    if (!p) { global.UI.go('onboarding'); return; }
    var bmiV = E.bmi(p), bf = E.bodyFat(p), cat = bmiCat(bmiV), wp = E.weightProgress(p);

    root.innerHTML =
      '<div class="grid g4 mb16">' +
        stat('BMI', n1(bmiV), cat.t, '18.5–23.9 正常', 'accent-' + cat.c) +
        stat('体脂率', n1(bf), '%', 'Deurenberg 估算', 'accent-r') +
        stat('基础代谢', n0(E.bmr(p)), 'kcal', 'Mifflin-St Jeor', 'accent-k') +
        stat('日常总消耗', n0(E.tdee(p)), 'kcal', esc((E.occupation(p).label)), 'accent-b') +
      '</div>' +
      '<div class="panel mb16"><div class="panel-h">' + panelHead('ph-y', '◐', '体重目标追踪') + '</div><div class="panel-b">' +
        '<div class="grid g3" style="align-items:center">' +
          '<div class="stat"><div class="s-label">起始 → 当前 → 目标</div><div class="s-value" style="font-size:20px">' + n1(p.startWeight || p.weight) + ' → ' + n1(p.weight) + ' → ' + n1(p.targetWeight) + '</div></div>' +
          '<div><div class="bar b cap"><i style="width:' + wp.pct + '%"></i><span class="bar-txt">达成 ' + n1(wp.pct) + '%</span></div>' +
          '<div class="tiny muted mt8">距目标还差 ' + Math.abs(wp.gap) + ' kg（健康速度 0.3–0.8 kg/周）</div></div>' +
          '<div><canvas id="pSpark" style="height:80px"></canvas></div>' +
        '</div>' +
      '</div></div>' +

      (p.gender === 'female' ? cyclePanel(p) : testoPanel(p)) +
      '<div id="pForm"></div>' +
      '<div class="panel mt16"><div class="panel-h">' + panelHead('ph-k', '⚠', '数据管理') + '</div><div class="panel-b tight">' +
        '<div class="flex-between wrap"><span class="small fw9">所有资料、照片与日志均存储于本机浏览器 localStorage，清除浏览器数据将一并删除。</span>' +
        '<button class="btn btn-r" id="btnReset">清空全部数据</button></div></div></div>';

    global.FITCHARTS.spark($('#pSpark'),
      (S.state.weightLog.length >= 2 ? S.state.weightLog : [{ weight:p.startWeight || p.weight }, { weight:p.weight }]).slice(-30).map(function (x) { return x.weight; }),
      { color:'#1E4E9C' });
    if (p.gender === 'male' && p.tcycle) {
      var an0 = E.testoAnalysis(p.tcycle, S.todayKey());
      global.FITCHARTS.spark($('#tCurve'), an0.curve, { color:'#1E4E9C' });
      global.FITCHARTS.spark($('#tWeek'), an0.weekly, { color:'#E62325' });
    }

    renderProfileForm($('#pForm', root), p, {
      submitLabel:'保存修改',
      onSave:function (data) {
        data.startWeight = p.startWeight || data.weight;
        data.photo = p.photo; data.photoTone = p.photoTone; data.photoMeta = p.photoMeta;
        S.setProfile(data);
        global.UI.toast('资料已更新', 'y');
        global.UI.go('profile');
      }
    });

    $('#btnReset').addEventListener('click', function () {
      global.UI.modal('确认清空全部数据？', '<p class="small fw9">将删除个人资料、照片、饮食/健康日志、手表绑定、预算与全部食谱记录，且无法恢复。</p>',
        [{ label:'取消', cls:'btn-g', onClick:global.UI.closeModal },
         { label:'确认清空', cls:'btn-r', onClick:function () { S.resetAll(); global.UI.closeModal(); global.UI.toast('已清空', 'r'); global.UI.restart(); } }]);
    });
  }

  function testoPanel(p) {
    if (!p.tcycle) return '';
    var tk = S.todayKey(), an = E.testoAnalysis(p.tcycle, tk);
    var nowH = new Date().getHours();
    var tips = {
      '晨峰期':'晨峰期：睾酮与皮质醇同步走高，神经兴奋性好，是安排大重量主项（深蹲/硬拉/卧推）的黄金窗口；训练前补充碳水 30–50g。',
      '日间高位':'日间高位：水平仍处高位平台，适合安排技术练习与中等强度训练；注意午后前完成主要蛋白质摄入。',
      '午后回落':'午后回落：浓度自然下行，避免追加高强度训练，可安排有氧或拉伸；补充镁（坚果 10g）与锌（瘦红肉/贝类）。',
      '夜间低谷':'夜间低谷：分泌转入低谷并为夜间脉冲做准备，避免深夜训练与酒精；保证 23:00 前入睡，深睡期是脉冲式分泌高峰。'
    };
    var mLabel = (D.byId(D.TESTO_MORNING, p.tcycle.morningId) || {}).label || '多数天数';
    return '<div class="panel mb16"><div class="panel-h">' + panelHead('ph-b', '♂', '睾酮激素周期变化与分析') + '</div><div class="panel-b">' +
      '<div class="grid g-21">' +
        '<div>' +
          '<div class="flex-between tiny fw9 mb8"><span>24 小时昼夜节律（当前 ' + nowH + ':00 · ' + an.phase + '）</span><span>指数 ' + an.nowLevel + '</span></div>' +
          '<canvas id="tCurve" style="height:110px"></canvas>' +
          '<div class="legend mt12"><span><i style="background:#1E4E9C"></i>昼夜曲线（峰值 ' + an.peakWindow + '）</span></div>' +
          '<div class="flex-between tiny fw9 mb8 mt12"><span>本周节律（训练日次日超量恢复）</span><span>今日 ' + an.weekly[an.weekDay] + '</span></div>' +
          '<canvas id="tWeek" style="height:70px"></canvas>' +
          '<div class="legend mt12"><span><i style="background:#E62325"></i>周节律（每周力量 ' + an.trainDays + ' 次）</span></div>' +
        '</div>' +
        '<div>' +
          '<div class="list-row"><span class="chip b">' + an.phase + '</span><div class="lr-main"><div class="lr-title">节律指数 ' + an.index + ' / 100</div>' +
            '<div class="lr-sub">晨峰窗口 ' + an.peakWindow + ' · 晨间自评：' + esc(mLabel) + '</div></div></div>' +
          '<div class="list-row"><div class="lr-main"><div class="lr-title">最佳训练窗口</div><div class="lr-sub">基于昼夜曲线与周恢复节律</div></div><b class="small">' + esc(an.bestTrainWindow) + '</b></div>' +
          '<div class="comp b"><span class="comp-bar"></span><div class="comp-bd"><h4>阶段建议</h4><p class="small fw9">' + tips[an.phase] + '</p></div></div>' +
          '<div class="comp mt12"><span class="comp-bar"></span><div class="comp-bd"><h4>维持睾酮水平要点</h4><p class="small fw9">睡眠 7–9h · 体脂率 12–20% · 锌/镁/维D 充足 · 力量训练 ' + an.trainDays + ' 次/周 · 避免长期过量有氧与饮酒</p></div></div>' +
        '</div>' +
      '</div></div></div>';
  }

  function cyclePanel(p) {
    var tk = S.todayKey(), an = E.cycleAnalysis(p.cycle, tk);
    var d = new Date(tk + 'T00:00:00');
    var y = d.getFullYear(), m = d.getMonth();
    var first = new Date(y, m, 1), startWd = (first.getDay() + 6) % 7;
    var days = new Date(y, m + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < startWd; i++) cells += '<span></span>';
    function dayPhase(dateStr) {
      var diff = E.dayDiff(p.cycle.lastDate, dateStr);
      if (diff < 0) return null;
      var len = p.cycle.len || 28, period = p.cycle.period || 5;
      var idx = Math.floor(diff / len), day = diff - idx * len + 1;
      var ovDay = len - 14;
      var future = idx > 0;
      if (day <= period) return future ? 'period predict' : 'period';
      if (day === ovDay || day === ovDay - 1) return future ? 'ovulation predict' : 'ovulation';
      if (day >= ovDay - 5 && day <= ovDay + 2) return future ? 'fertile predict' : 'fertile';
      return null;
    }
    for (var dd = 1; dd <= days; dd++) {
      var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
      var ph = dayPhase(ds);
      cells += '<span class="cc-cell ' + (ph || '') + (ds === tk ? ' today' : '') + '" title="' + ds + '">' + dd + '</span>';
    }
    var tips = {
      period:'经期：保证铁与蛋白质（瘦红肉、动物肝脏可选）、保暖与低强度活动；避免高糖暴食。',
      follicular:'卵泡期：体能回升，可安排渐进负重训练，碳水供能充足。',
      fertile:'易孕期：体温略升，注意补水与电解质平衡。',
      ovulation:'排卵日：力量表现通常较好，注意动作质量与恢复。',
      luteal:'黄体期：易水肿与情绪波动，控制高盐高糖，增加富含镁的坚果、深绿叶菜。'
    };
    return '<div class="panel mb16"><div class="panel-h">' + panelHead('ph-r', '♀', '生理周期日历与分析（' + (m + 1) + '月）') + '</div><div class="panel-b">' +
      '<div class="grid g-21">' +
        '<div><div class="cycle-cal">' +
          ['一','二','三','四','五','六','日'].map(function (w) { return '<span class="cc-d">' + w + '</span>'; }).join('') +
          cells + '</div>' +
          '<div class="legend mt12"><span><i style="background:#E62325"></i>经期</span><span><i style="background:#F7D41A"></i>易孕期</span>' +
          '<span><i style="background:#1E4E9C"></i>排卵日</span><span><i style="background:#fff"></i>虚线=预测</span></div></div>' +
        '<div><div class="list-row"><span class="chip r">周期第 ' + an.day + ' 天</span><div class="lr-main"><div class="lr-title">' + phaseName(an.phase) + '</div></div></div>' +
        '<div class="list-row"><div class="lr-main"><div class="lr-title">预计下次月经</div><div class="lr-sub">排卵日约 ' + an.ovulationDate + '</div></div><b>' + an.nextDate + '</b></div>' +
        '<div class="comp ' + (an.phase === 'period' ? 'r' : an.phase === 'ovulation' ? 'b' : 'y') + '"><span class="comp-bar"></span><div class="comp-bd"><h4>阶段建议</h4><p class="small fw9">' + tips[an.phase] + '</p></div></div></div>' +
      '</div></div></div>';
  }

  global.FITVIEWS = global.FITVIEWS || {};
  Object.assign(global.FITVIEWS, { onboarding:onboarding, dashboard:dashboard, avatar:avatar, profile:profile,
    _helpers:{ stat:stat, phaseName:phaseName, goalText:goalText, bmiCat:bmiCat, panelHead:panelHead } });
})(window);
