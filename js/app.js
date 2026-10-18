/* ============================================================
 * app.js — 主控：路由 / 导航 / 通用 UI 工具
 * ============================================================ */
(function (global) {
  'use strict';

  var NAV = [
    { id:'dashboard', idx:'01', label:'总览' },
    { id:'avatar',    idx:'02', label:'3D形象' },
    { id:'profile',   idx:'03', label:'我的资料' },
    { id:'diet',      idx:'04', label:'饮食打卡' },
    { id:'exercise',  idx:'05', label:'运动数据' },
    { id:'health',    idx:'06', label:'健康评估' },
    { id:'recipe',    idx:'07', label:'智能食谱' }
  ];
  var TITLES = {
    dashboard:'总览 DASHBOARD', avatar:'3D 人物形象 AVATAR', profile:'个人资料 PROFILE',
    diet:'饮食打卡 DIET', exercise:'运动整合 EXERCISE', health:'健康评估 HEALTH',
    recipe:'智能食谱 RECIPE', onboarding:'建立档案 ONBOARDING'
  };

  /* ----------------- 工具 ----------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function n1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function n0(v) { return String(Math.round(v)); }
  function yuan(v) { return '¥' + (Math.round(v * 100) / 100).toFixed(2); }

  function toast(msg, type) {
    var root = $('#toastRoot');
    var t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 1800);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2300);
  }

  var modalCloser = null;
  function modal(title, bodyHtml, buttons, wide) {
    closeModal();
    var root = $('#modalRoot');
    root.innerHTML =
      '<div class="modal-mask">' +
        '<div class="modal" style="' + (wide ? 'max-width:760px;' : '') + '">' +
          '<div class="modal-h"><span>' + esc(title) + '</span><button class="modal x" data-act="modal-close" aria-label="关闭">×</button></div>' +
          '<div class="modal-b">' + bodyHtml + '</div>' +
          (buttons && buttons.length ? '<div class="modal-f"></div>' : '') +
        '</div>' +
      '</div>';
    var foot = $('.modal-f', root);
    if (foot) {
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'btn ' + (b.cls || '');
        btn.textContent = b.label;
        btn.addEventListener('click', function () { if (b.onClick) b.onClick(); });
        foot.appendChild(btn);
      });
    }
    $('.modal-mask', root).addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
    root.addEventListener('click', function (e) {
      var c = e.target.closest('[data-act="modal-close"]');
      if (c) closeModal();
    });
    modalCloser = function () { root.innerHTML = ''; };
    return root;
  }
  function closeModal() { if (modalCloser) { modalCloser(); modalCloser = null; } }

  function chooseImage(capture) {
    return new Promise(function (resolve) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      if (capture) inp.setAttribute('capture', 'environment');
      inp.addEventListener('change', function () {
        var file = inp.files && inp.files[0];
        if (!file) return;
        var fr = new FileReader();
        fr.onload = function () { resolve({ dataUrl:fr.result, file:file }); };
        fr.readAsDataURL(file);
      });
      inp.click();
    });
  }

  /* ----------------- 导航 ----------------- */
  function buildNav() {
    var side = $('#navList'), bottom = $('#bottomNav');
    side.innerHTML = NAV.map(function (n) {
      return '<button class="nav-item" data-go="' + n.id + '">' +
        '<span class="ni-idx">' + n.idx + '</span><span class="ni-bar"></span><span>' + n.label + '</span></button>';
    }).join('');
    bottom.innerHTML = NAV.map(function (n) {
      return '<button class="bnav" data-go="' + n.id + '"><span class="bn-ic"></span><span>' + n.label + '</span></button>';
    }).join('');
    document.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (b) go(b.getAttribute('data-go'));
    });
  }

  var current = 'dashboard';
  var viewStops = {};
  function setActive(id) {
    $$('.nav-item').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-go') === id); });
    $$('.bnav').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-go') === id); });
  }
  function setHeaderDate() {
    var d = new Date();
    var wd = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
    $('#todayStr').textContent = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    $('#weekdayStr').textContent = wd;
  }

  function go(id) {
    if (!FITSTORE.state.onboarded && id !== 'onboarding') id = 'onboarding';
    Object.keys(viewStops).forEach(function (k) { try { viewStops[k](); } catch (e) {} });
    viewStops = {};
    current = id;
    var view = $('#view');
    view.innerHTML = '';
    $('#pageTitle').textContent = TITLES[id] || '';
    setActive(id);
    view.scrollTop = 0;
    window.scrollTo(0, 0);
    var fn = FITVIEWS[id] || FITVIEWS.dashboard;
    var ctx = { stop:function (f) { viewStops[id] = f; } };
    try { fn(view, ctx); } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="empty">视图渲染异常：' + esc(err.message) + '</div>';
    }
  }

  function restart() { location.hash = ''; go(FITSTORE.state.onboarded ? 'dashboard' : 'onboarding'); }

  document.addEventListener('DOMContentLoaded', function () {
    FITSTORE.load();
    buildNav();
    setHeaderDate();
    window.addEventListener('hashchange', function () {
      var id = location.hash.replace('#/', '');
      if (FITVIEWS[id]) go(id);
    });
    var start = location.hash.replace('#/', '');
    if (FITVIEWS[start]) { go(start); }
    else go(FITSTORE.state.onboarded ? 'dashboard' : 'onboarding');
  });

  global.UI = {
    NAV:NAV, esc:esc, $:$, $$:$$, n1:n1, n0:n0, yuan:yuan,
    toast:toast, modal:modal, closeModal:closeModal, chooseImage:chooseImage,
    go:go, restart:restart,
    current:function () { return current; }
  };
})(window);
