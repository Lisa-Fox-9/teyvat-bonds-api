// Shared fetch helper — attaches the JWT to every request and normalises errors.
// Token + logged-in user are kept in localStorage so they survive page navigation
// (this is a static multi-page site, not a single-page app, so plain JS state
// would be lost every time the browser loads a new HTML page).

const TOKEN_KEY = 'teyvat_token';
const USER_KEY = 'teyvat_user';

const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: () => JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn: () => Boolean(localStorage.getItem(TOKEN_KEY)),
  requireLogin: () => {
    if (!auth.isLoggedIn()) window.location.href = 'login.html';
  },
};

/**
 * Wrapper around fetch that adds the Authorization header, parses JSON,
 * and throws a normal Error with a readable message on failure so callers
 * can just try/catch instead of checking res.ok everywhere.
 */
const api = async (path, { method = 'GET', body, auth: needsAuth = true } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (needsAuth) {
    const token = auth.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Is it running?');
  }

  // 204 No Content has no body to parse
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Session expired or invalid — bounce back to login
    if (res.status === 401 && needsAuth) {
      auth.clearSession();
    }
    const message = data?.error?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
};

/**
 * Popup toast — replaces the old inline banner. Slides in from the top,
 * auto-dismisses on success, stays until clicked away on error.
 * Creates its own container on first use so pages don't need extra markup.
 */
const showFeedback = (_unusedEl, message, type = 'error') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button class="toast-close" aria-label="Dismiss">&times;</button>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  };
  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  if (type === 'success') setTimeout(dismiss, 3200);
};
