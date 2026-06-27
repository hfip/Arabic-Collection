/**
 * Kaptain's Mega Collection — Nuvio Setup Wizard
 * ----------------------------------------------
 * A guided modal that lets a visitor either:
 *   1) Push their picked collection straight into their Nuvio account
 *      (creating an account if they don't have one), or
 *   2) Take the safe hand-off route — download the file / copy the link —
 *      without sharing any login.
 *
 * Relies on globals from app.js (assembleFilteredDatabase, compileAndDownloadJSON,
 * showToast, window.KaptainExport) and window.NuvioPush from nuvio-push.js.
 */
(function () {
  const DEFAULT_PROFILE_NAME = "مجموعة كابتن";

  const state = {
    step: 'choose',     // choose | account | profile | pushing | done | error
    mode: 'create',     // create | signin
    email: '',
    password: '',
    profileName: DEFAULT_PROFILE_NAME,
    token: null,
    profiles: [],
    selectedProfileId: null,
    createNewProfile: true,
    resultProfileName: '',
    errorMsg: '',
  };

  function el(id) { return document.getElementById(id); }

  function countSelection() {
    // Re-derive the same numbers shown in the control bar.
    let folders = 0, sources = 0;
    try {
      const compiled = assembleFilteredDatabase();
      compiled.forEach((cat) => {
        (cat.folders || []).forEach((f) => {
          folders += 1;
          sources += (f.sources || []).length;
        });
      });
    } catch (e) { /* ignore */ }
    return { folders, sources };
  }

  function open() {
    state.step = 'choose';
    state.errorMsg = '';
    const overlay = el('wizard-overlay');
    if (overlay) overlay.classList.add('open');
    render();
  }

  function close() {
    const overlay = el('wizard-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function go(step) { state.step = step; render(); }

  // ----- ICONS -----
  const ICON = {
    rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
  };

  // ====================================================================
  // RENDER
  // ====================================================================
  function render() {
    const panel = el('wizard-panel');
    if (!panel) return;

    if (state.step === 'choose') return renderChoose(panel);
    if (state.step === 'account') return renderAccount(panel);
    if (state.step === 'profile') return renderProfile(panel);
    if (state.step === 'pushing') return renderPushing(panel);
    if (state.step === 'done') return renderDone(panel);
    if (state.step === 'error') return renderError(panel);
  }

  function header(title, subtitle, withBack) {
    return `
      <div class="wiz-header">
        ${withBack ? `<button class="wiz-back" id="wiz-back" title="رجوع">${ICON.back}</button>` : ''}
        <div class="wiz-header-text">
          <h3 class="wiz-title">${title}</h3>
          ${subtitle ? `<p class="wiz-sub">${subtitle}</p>` : ''}
        </div>
        <button class="wiz-close" id="wiz-close" aria-label="إغلاق">&times;</button>
      </div>`;
  }

  function renderChoose(panel) {
    const { folders, sources } = countSelection();
    panel.innerHTML = `
      ${header('أضف مجموعتك إلى Nuvio', `${folders} مجلدات · ${sources} مصدر جاهزة`, false)}
      <div class="wiz-body">
        <button class="wiz-option" id="wiz-pick-push">
          <span class="wiz-option-icon accent">${ICON.rocket}</span>
          <span class="wiz-option-text">
            <span class="wiz-option-title">إرسال مباشرة إلى Nuvio</span>
            <span class="wiz-option-desc">سجّل دخولك أو أنشئ حساب Nuvio وسيتم تحميل مجموعتك فوراً — متزامنةً على جميع أجهزتك.</span>
          </span>
        </button>
        <button class="wiz-option" id="wiz-pick-download">
          <span class="wiz-option-icon">${ICON.download}</span>
          <span class="wiz-option-text">
            <span class="wiz-option-title">تحميل الملف فقط</span>
            <span class="wiz-option-desc">تفضل عدم مشاركة بيانات تسجيل الدخول؟ احصل على الملف (أو انسخ رابط الاستيراد) وأضفه في Nuvio بنفسك.</span>
          </span>
        </button>
      </div>`;

    el('wiz-close').addEventListener('click', close);
    el('wiz-pick-push').addEventListener('click', () => {
      if (countSelection().folders === 0) {
        showToast('اختر مجلداً واحداً على الأقل قبل الإرسال إلى Nuvio.', 'error');
        return;
      }
      go('account');
    });
    el('wiz-pick-download').addEventListener('click', () => {
      close();
      if (typeof compileAndDownloadJSON === 'function') compileAndDownloadJSON();
    });
  }

  function renderAccount(panel) {
    const minLen = state.mode === 'create' ? 8 : 6;
    panel.innerHTML = `
      ${header('حساب Nuvio', state.mode === 'create'
        ? "سنُنشئ حساباً جديداً وملفاً شخصياً جديداً، ثم نحمّل مجموعتك."
        : "سنُسجّل دخولك ونحمّل مجموعتك في الملف الشخصي الذي تختاره.", true)}
      <div class="wiz-body">
        <div class="wiz-toggle">
          <button class="wiz-toggle-btn ${state.mode === 'create' ? 'active' : ''}" data-mode="create">إنشاء حساب</button>
          <button class="wiz-toggle-btn ${state.mode === 'signin' ? 'active' : ''}" data-mode="signin">تسجيل الدخول</button>
        </div>

        <label class="wiz-label">البريد الإلكتروني
          <input type="email" id="wiz-email" class="wiz-input" placeholder="you@example.com" value="${escapeAttr(state.email)}" autocomplete="email">
        </label>
        <label class="wiz-label">كلمة المرور <span class="wiz-hint">(الحد الأدنى ${minLen} أحرف)</span>
          <input type="password" id="wiz-password" class="wiz-input" placeholder="أدخل كلمة المرور..." value="${escapeAttr(state.password)}" autocomplete="${state.mode === 'create' ? 'new-password' : 'current-password'}">
        </label>
        ${state.mode === 'create' ? `
        <label class="wiz-label">اسم الملف الشخصي
          <input type="text" id="wiz-profile-name" class="wiz-input" placeholder="${DEFAULT_PROFILE_NAME}" value="${escapeAttr(state.profileName)}">
        </label>` : ''}

        <div class="wiz-privacy">
          <span class="wiz-privacy-icon">${ICON.lock}</span>
          <span>بريدك الإلكتروني وكلمة مرورك تذهبان مباشرةً إلى Nuvio من متصفحك. هذا الموقع مجرد صفحة ثابتة — لا يوجد خادم، لذا لا يُخزَّن أو يُرى أي شيء تكتبه.</span>
        </div>

        <div class="wiz-error" id="wiz-error" style="display:none;"></div>

        <button class="wiz-primary" id="wiz-continue">
          <span>${state.mode === 'create' ? 'إنشاء حساب & continue' : 'تسجيل الدخول & continue'}</span>
        </button>
      </div>`;

    el('wiz-close').addEventListener('click', close);
    el('wiz-back').addEventListener('click', () => go('choose'));
    panel.querySelectorAll('.wiz-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncInputs();
        state.mode = btn.getAttribute('data-mode');
        render();
      });
    });
    el('wiz-continue').addEventListener('click', onAccountContinue);
  }

  function renderProfile(panel) {
    const opts = state.profiles.map((p) =>
      `<option value="${p.profile_index}" ${state.selectedProfileId === p.profile_index && !state.createNewProfile ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
    ).join('');

    panel.innerHTML = `
      ${header('اختر ملفاً شخصياً', 'أين نضع مجموعتك؟', true)}
      <div class="wiz-body">
        <label class="wiz-label">الملف الشخصي
          <select id="wiz-profile-select" class="wiz-input">
            <option value="__new__" ${state.createNewProfile ? 'selected' : ''}>➕ إنشاء ملف شخصي جديد (موصى به)</option>
            ${opts}
          </select>
        </label>

        <div id="wiz-newprofile-wrap" class="wiz-label" style="${state.createNewProfile ? '' : 'display:none;'}">
          <span>اسم الملف الشخصي الجديد</span>
          <input type="text" id="wiz-profile-name" class="wiz-input" placeholder="${DEFAULT_PROFILE_NAME}" value="${escapeAttr(state.profileName)}">
        </div>

        <div class="wiz-note" id="wiz-profile-note">${profileNoteText()}</div>

        <div class="wiz-error" id="wiz-error" style="display:none;"></div>

        <button class="wiz-primary" id="wiz-push"><span>تحميل مجموعتي إلى Nuvio</span></button>
      </div>`;

    el('wiz-close').addEventListener('click', close);
    el('wiz-back').addEventListener('click', () => go('account'));

    const select = el('wiz-profile-select');
    select.addEventListener('change', () => {
      if (select.value === '__new__') {
        state.createNewProfile = true;
        state.selectedProfileId = null;
      } else {
        state.createNewProfile = false;
        state.selectedProfileId = Number(select.value);
      }
      el('wiz-newprofile-wrap').style.display = state.createNewProfile ? '' : 'none';
      el('wiz-profile-note').innerHTML = profileNoteText();
    });
    el('wiz-push').addEventListener('click', onPush);
  }

  function profileNoteText() {
    return state.createNewProfile
      ? 'سيتم إنشاء ملف شخصي جديد تماماً لهذه المجموعة. ملفاتك الشخصية الموجودة تبقى كما هي.'
      : '<strong>تنبيه:</strong> المجموعات الموجودة حالياً في هذا الملف الشخصي ستُستبدل باختيارك الجديد.';
  }

  function renderPushing(panel) {
    panel.innerHTML = `
      <div class="wiz-body wiz-center">
        <div class="popup-spinner"></div>
        <h3 class="wiz-title">${escapeHtml(state.pushingLabel || 'جاري إعداد Nuvio...')}</h3>
        <p class="wiz-sub">جاري الاتصال بـ Nuvio — هذا يستغرق لحظة فقط.</p>
      </div>`;
  }

  function renderDone(panel) {
    panel.innerHTML = `
      ${header('تم بنجاح! 🎉', '', false)}
      <div class="wiz-body wiz-center">
        <div class="wiz-success-badge">${ICON.check}</div>
        <p class="wiz-done-text">
          مجموعتك الآن في Nuvio على الملف الشخصي
          <strong>"${escapeHtml(state.resultProfileName)}"</strong> .
          افتح تطبيق Nuvio، انتقل إلى ذلك الملف الشخصي، وستجد مجلداتك بانتظارك.
        </p>
        <button class="wiz-primary" id="wiz-done-close"><span>تم</span></button>
      </div>`;
    el('wiz-close').addEventListener('click', close);
    el('wiz-done-close').addEventListener('click', close);
  }

  function renderError(panel) {
    panel.innerHTML = `
      ${header('حدث خطأ', '', true)}
      <div class="wiz-body">
        <div class="wiz-error" style="display:block;">${escapeHtml(state.errorMsg)}</div>
        <p class="wiz-note">يمكنك المحاولة مجدداً، أو استخدام خيار التحميل بدلاً من ذلك — لا حاجة لتسجيل الدخول.</p>
        <div class="wiz-btn-row">
          <button class="wiz-secondary" id="wiz-err-download"><span>تحميل بدلاً</span></button>
          <button class="wiz-primary" id="wiz-err-retry"><span>المحاولة مجدداً</span></button>
        </div>
      </div>`;
    el('wiz-close').addEventListener('click', close);
    el('wiz-back').addEventListener('click', () => go('account'));
    el('wiz-err-retry').addEventListener('click', () => go('account'));
    el('wiz-err-download').addEventListener('click', () => {
      close();
      if (typeof compileAndDownloadJSON === 'function') compileAndDownloadJSON();
    });
  }

  // ====================================================================
  // ACTIONS
  // ====================================================================
  function syncInputs() {
    const email = el('wiz-email');
    const pw = el('wiz-password');
    const pn = el('wiz-profile-name');
    if (email) state.email = email.value.trim();
    if (pw) state.password = pw.value;
    if (pn) state.profileName = pn.value;
  }

  function showInlineError(msg) {
    const box = el('wiz-error');
    if (box) { box.textContent = msg; box.style.display = 'block'; }
  }

  async function onAccountContinue() {
    syncInputs();
    const minLen = state.mode === 'create' ? 8 : 6;
    if (!state.email.includes('@')) return showInlineError('يرجى إدخال بريد إلكتروني صحيح.');
    if (state.password.length < minLen) return showInlineError(`كلمة المرور must be at least ${minLen} characters.`);
    if (state.mode === 'create' && !state.profileName.trim()) state.profileName = DEFAULT_PROFILE_NAME;

    try {
      if (state.mode === 'create') {
        state.pushingLabel = 'جاري إنشاء حساب Nuvio...';
        go('pushing');
        const auth = await window.NuvioPush.signup(state.email, state.password);
        state.token = auth.token;
        // Brand-new account → create the first profile and push right away.
        return await pushToNewProfile(state.profileName.trim() || DEFAULT_PROFILE_NAME);
      } else {
        state.pushingLabel = 'جاري تسجيل الدخول...';
        go('pushing');
        const auth = await window.NuvioPush.login(state.email, state.password);
        state.token = auth.token;
        state.profiles = await window.NuvioPush.getProfiles(state.token);
        // Default to the safe "create new profile" choice.
        state.createNewProfile = true;
        state.selectedProfileId = state.profiles[0] ? state.profiles[0].profile_index : null;
        go('profile');
      }
    } catch (err) {
      state.errorMsg = (err && err.message) || String(err);
      go('error');
    }
  }

  async function onPush() {
    const pn = el('wiz-profile-name');
    if (pn) state.profileName = pn.value;
    try {
      if (state.createNewProfile) {
        await pushToNewProfile(state.profileName.trim() || DEFAULT_PROFILE_NAME);
      } else {
        state.pushingLabel = 'جاري تحميل المجموعة...';
        go('pushing');
        const profile = state.profiles.find((p) => p.profile_index === state.selectedProfileId);
        await doPush(state.selectedProfileId, profile ? profile.name : `الملف الشخصي ${state.selectedProfileId}`);
      }
    } catch (err) {
      state.errorMsg = (err && err.message) || String(err);
      go('error');
    }
  }

  async function pushToNewProfile(name) {
    state.pushingLabel = 'جاري إنشاء الملف الشخصي...';
    go('pushing');
    const profile = await window.NuvioPush.createProfile(state.token, name);
    if (!profile) throw new Error('حسابك جاهز، لكن تعذّر إنشاء الملف الشخصي. يرجى المحاولة مجدداً.');
    await doPush(profile.profile_index, profile.name);
  }

  async function doPush(profileId, profileName) {
    state.pushingLabel = 'جاري تحميل المجموعة...';
    render();
    const collections = assembleFilteredDatabase();
    if (!collections || collections.length === 0) {
      throw new Error('لم يتم تحديد أي مجلدات، لا يوجد شيء للإرسال.');
    }
    await window.NuvioPush.pushCollections(state.token, profileId, collections);
    state.resultProfileName = profileName;
    go('done');
  }

  // ----- small helpers -----
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // Wire up the launcher button + overlay close, once the DOM is ready.
  document.addEventListener('DOMContentLoaded', () => {
    const launch = el('btn-send-to-nuvio');
    if (launch) launch.addEventListener('click', () => {
      // Route through the mobile-compatibility gate so the warning fires before
      // the wizard opens; fall back to opening directly if the gate is absent.
      if (window.KaptainExport && typeof window.KaptainExport.ensureMobileCompat === 'function') {
        window.KaptainExport.ensureMobileCompat(open);
      } else {
        open();
      }
    });

    const overlay = el('wizard-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) close();
    });
  });

  window.NuvioWizard = { open, close };
})();
