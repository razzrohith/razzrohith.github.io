(function () {
  const config = window.DealNestConfig || {};
  let supabaseUrl = (config.SUPABASE_URL || '').replace(/\/$/, '');
  let anonKey = config.SUPABASE_ANON_KEY || '';
  const sessionKey = 'dealnest:authSession';
  const actionKey = 'dealnest:pendingAction';
  const listeners = new Set();
  let session = readSession();
  let authReadyResolver;

  function readSession() {
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.access_token || !parsed?.user?.id) return null;
      if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
        localStorage.removeItem(sessionKey);
        return null;
      }
      return parsed;
    } catch (error) {
      localStorage.removeItem(sessionKey);
      return null;
    }
  }

  function saveSession(nextSession) {
    session = nextSession;
    if (session?.access_token) localStorage.setItem(sessionKey, JSON.stringify(session));
    else localStorage.removeItem(sessionKey);
    listeners.forEach((listener) => listener(session));
    renderHeaderAuth();
  }

  function authHeaders(useSession = false) {
    const token = useSession ? session?.access_token : anonKey;
    return {
      apikey: anonKey,
      Authorization: `Bearer ${token || anonKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
  }

  function isMissingConfig() {
    return !supabaseUrl || !anonKey;
  }

  function parseEnv(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .reduce((env, line) => {
        const index = line.indexOf('=');
        env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
        return env;
      }, {});
  }

  async function resolveConfig() {
    if (!isMissingConfig()) return;
    const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
    if (!isLocal) return;
    try {
      const response = await fetch('./.env', { cache: 'no-store' });
      if (!response.ok) return;
      const env = parseEnv(await response.text());
      supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
      anonKey = env.SUPABASE_ANON_KEY || '';
    } catch (error) {
      supabaseUrl = '';
      anonKey = '';
    }
  }

  async function authRequest(path, options = {}) {
    if (isMissingConfig()) throw new Error('Supabase runtime config is missing.');
    const response = await fetch(`${supabaseUrl}${path}`, {
      ...options,
      headers: {
        ...authHeaders(options.useSession),
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(body?.msg || body?.message || body?.error_description || `Request failed with ${response.status}`);
    }
    return body;
  }

  async function rest(path, options = {}) {
    if (isMissingConfig()) throw new Error('Supabase runtime config is missing.');
    if (!session?.access_token) throw new Error('Please sign in first.');
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers: {
        ...authHeaders(true),
        Prefer: options.prefer || 'return=representation',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(body?.message || body?.details || `Request failed with ${response.status}`);
    }
    return body;
  }

  async function publicRest(path, options = {}) {
    if (isMissingConfig()) throw new Error('Supabase runtime config is missing.');
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers: {
        ...authHeaders(false),
        Prefer: options.prefer || 'return=representation',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(body?.message || body?.details || `Request failed with ${response.status}`);
    }
    return body;
  }

  function storagePath(path) {
    return String(path || '')
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  function publicStorageUrl(bucket, path) {
    if (isMissingConfig()) return '';
    return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${storagePath(path)}`;
  }

  async function uploadFile(bucket, path, file, options = {}) {
    if (isMissingConfig()) throw new Error('Supabase runtime config is missing.');
    if (!session?.access_token) throw new Error('Please sign in first.');
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath(path)}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': options.upsert ? 'true' : 'false'
      },
      body: file
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (error) {
      body = text;
    }
    if (!response.ok) {
      throw new Error(body?.message || body?.error || `Upload failed with ${response.status}`);
    }
    return { ...body, path, publicUrl: publicStorageUrl(bucket, path) };
  }

  function toast(message) {
    let node = document.querySelector('.toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2200);
  }

  function userLabel() {
    const metadata = session?.user?.user_metadata || {};
    return metadata.display_name || metadata.full_name || session?.user?.email?.split('@')[0] || 'Member';
  }

  function renderHeaderAuth() {
    document.querySelectorAll('.header-actions').forEach((actions) => {
      const existing = actions.querySelector('.auth-actions');
      existing?.remove();
      actions.querySelectorAll('a, button').forEach((item) => {
        const href = item.getAttribute('href') || '';
        const label = item.textContent.trim().toLowerCase();
        const isLegacyLogin = href.endsWith('login.html') || ['login', 'log in', 'sign up', 'logout', 'dashboard'].includes(label);
        if (isLegacyLogin && !item.closest('.auth-actions')) item.remove();
      });
      const primaryPost = actions.querySelector('a[href="./post-deal.html"], a[href="post-deal.html"]');
      const wrap = document.createElement('div');
      wrap.className = 'auth-actions';
      if (session?.user) {
        wrap.innerHTML = `
          <a class="ghost-button link-button" href="./dashboard.html">Dashboard</a>
          <button class="ghost-button auth-user-button" type="button" data-auth-action="user-menu">${userLabel()}</button>
          <button class="post-button" type="button" data-auth-action="logout">Logout</button>
        `;
      } else {
        wrap.innerHTML = `
          <button class="ghost-button" type="button" data-auth-action="login">Login</button>
          <button class="post-button" type="button" data-auth-action="signup">Sign up</button>
        `;
      }
      actions.insertBefore(wrap, primaryPost || null);
    });
  }

  function ensureModal() {
    let modal = document.getElementById('authModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.id = 'authModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button class="auth-close" type="button" data-auth-action="close" aria-label="Close login dialog">Close</button>
        <p class="eyebrow" id="authEyebrow">Member access</p>
        <h2 id="authTitle">Sign in to continue</h2>
        <p id="authMessage">Create an account to sync your deal activity across devices.</p>
        <div class="auth-tabs" role="tablist">
          <button type="button" class="active" data-auth-mode="login">Login</button>
          <button type="button" data-auth-mode="signup">Sign up</button>
        </div>
        <form class="auth-form" id="authForm">
          <label class="auth-name-field">Display name<input name="displayName" autocomplete="name" placeholder="Raj"></label>
          <label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="At least 6 characters"></label>
          <button class="post-button" type="submit">Continue</button>
          <output id="authOutput" aria-live="polite"></output>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function setMode(mode) {
    const modal = ensureModal();
    modal.dataset.mode = mode;
    modal.querySelectorAll('[data-auth-mode]').forEach((button) => button.classList.toggle('active', button.dataset.authMode === mode));
    modal.querySelector('#authTitle').textContent = mode === 'signup' ? 'Create your DealNest account' : 'Sign in to continue';
    modal.querySelector('#authEyebrow').textContent = mode === 'signup' ? 'New member' : 'Member access';
    modal.querySelector('.auth-name-field').classList.toggle('hidden', mode !== 'signup');
    modal.querySelector('input[name="password"]').setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
  }

  function openAuth(options = {}) {
    const modal = ensureModal();
    setMode(options.mode || 'login');
    modal.querySelector('#authMessage').textContent = options.message || 'Create an account to sync your deal activity across devices.';
    modal.querySelector('#authOutput').textContent = '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('input[name="email"]').focus();
    if (options.action) {
      localStorage.setItem(actionKey, JSON.stringify(options.action));
    }
  }

  function closeAuth() {
    const modal = ensureModal();
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function upsertProfile(user, displayName = '') {
    if (!user?.id || !session?.access_token) return;
    const username = (displayName || user.email?.split('@')[0] || `member-${user.id.slice(0, 8)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28);
    await rest('profiles?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: {
        id: user.id,
        username: username || `member_${user.id.slice(0, 8)}`,
        display_name: displayName || user.email?.split('@')[0] || 'DealNest member'
      }
    }).catch((error) => console.warn('Profile upsert skipped:', error.message));
  }

  async function getRoles() {
    if (!session?.user) return [];
    const rows = await rest(`user_roles?select=role&user_id=eq.${encodeURIComponent(session.user.id)}`, {
      headers: { Prefer: 'return=representation' }
    }).catch(() => []);
    return rows.map((row) => row.role);
  }

  async function signIn(email, password) {
    const body = await authRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    saveSession(body);
    await upsertProfile(body.user);
    return body;
  }

  async function signUp(email, password, displayName) {
    const body = await authRequest('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { display_name: displayName } })
    });
    if (body?.access_token) {
      saveSession(body);
      await upsertProfile(body.user, displayName);
    }
    return body;
  }

  async function logout() {
    if (session?.access_token) {
      await authRequest('/auth/v1/logout', { method: 'POST', useSession: true }).catch(() => {});
    }
    saveSession(null);
    toast('Logged out');
    window.dispatchEvent(new CustomEvent('dealnest:auth-changed', { detail: { session: null } }));
  }

  function requireAuth(options = {}) {
    if (session?.user) return true;
    openAuth({
      mode: options.mode || 'login',
      message: options.message || 'Sign in to use this member action.',
      action: options.action || { type: options.type || 'protected', page: location.href }
    });
    return false;
  }

  function handlePendingAction() {
    const raw = localStorage.getItem(actionKey);
    if (!raw || !session?.user) return null;
    localStorage.removeItem(actionKey);
    try {
      const action = JSON.parse(raw);
      window.dispatchEvent(new CustomEvent('dealnest:resume-action', { detail: action }));
      return action;
    } catch (error) {
      return null;
    }
  }

  function bindModal() {
    document.body.addEventListener('click', (event) => {
      const button = event.target.closest('[data-auth-action], [data-auth-mode]');
      if (!button) return;
      if (button.dataset.authAction === 'login') openAuth({ mode: 'login' });
      if (button.dataset.authAction === 'signup') openAuth({ mode: 'signup' });
      if (button.dataset.authAction === 'user-menu') window.location.href = './dashboard.html';
      if (button.dataset.authAction === 'logout') logout();
      if (button.dataset.authAction === 'close') closeAuth();
      if (button.dataset.authMode) setMode(button.dataset.authMode);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const modal = document.getElementById('authModal');
      if (modal?.classList.contains('open')) closeAuth();
    });

    document.body.addEventListener('submit', async (event) => {
      if (event.target.id !== 'authForm') return;
      event.preventDefault();
      const modal = ensureModal();
      const output = modal.querySelector('#authOutput');
      const mode = modal.dataset.mode || 'login';
      const values = Object.fromEntries(new FormData(event.target).entries());
      output.textContent = 'Working...';
      try {
        const result = mode === 'signup'
          ? await signUp(values.email, values.password, values.displayName)
          : await signIn(values.email, values.password);
        if (mode === 'signup' && !result?.access_token) {
          output.textContent = 'Check your email to confirm your account, then sign in.';
          return;
        }
        output.textContent = 'Signed in.';
        closeAuth();
        toast('Welcome to DealNest');
        window.dispatchEvent(new CustomEvent('dealnest:auth-changed', { detail: { session } }));
        handlePendingAction();
      } catch (error) {
        output.textContent = error.message;
      }
    });
  }

  async function init() {
    await resolveConfig();
    ensureModal();
    bindModal();
    renderHeaderAuth();
    if (session?.access_token) {
      await authRequest('/auth/v1/user', { method: 'GET', useSession: true })
        .then((user) => {
          session.user = user;
          saveSession(session);
        })
        .catch(() => saveSession(null));
    }
    authReadyResolver?.(session);
  }

  window.DealNestAuthReady = new Promise((resolve) => {
    authReadyResolver = resolve;
  });

  window.DealNestAuth = {
    get session() { return session; },
    get user() { return session?.user || null; },
    get isConfigured() { return Boolean(supabaseUrl && anonKey); },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    openAuth,
    closeAuth,
    requireAuth,
    rest,
    publicRest,
    uploadFile,
    publicStorageUrl,
    getRoles,
    toast,
    signIn,
    signUp,
    logout,
    currentUserId() { return session?.user?.id || null; },
    handlePendingAction
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
