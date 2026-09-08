/* ======================================================================
   Hadeej'Art Admin — Authentification
   ====================================================================== */

let CURRENT_ADMIN = null; /* { id, email, full_name } une fois vérifié admin */

function showLogin(message) {
  document.getElementById('loginScreen').hidden = false;
  document.getElementById('adminApp').hidden = true;
  const err = document.getElementById('loginError');
  if (err) { err.textContent = message || ''; err.hidden = !message; }
}

function showApp() {
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('adminApp').hidden = false;
  const who = document.getElementById('whoami');
  if (who && CURRENT_ADMIN) who.textContent = CURRENT_ADMIN.full_name || CURRENT_ADMIN.email;
}

async function checkAdminProfile(user) {
  const { data, error } = await sb.from('profiles').select('id, role, full_name').eq('id', user.id).single();
  if (error || !data || data.role !== 'admin') return null;
  return { id: user.id, email: user.email, full_name: data.full_name };
}

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    const admin = await checkAdminProfile(session.user);
    if (admin) { CURRENT_ADMIN = admin; showApp(); onAdminReady(); return; }
    await sb.auth.signOut();
  }
  showLogin();

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Connexion…';
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const admin = await checkAdminProfile(data.user);
      if (!admin) {
        await sb.auth.signOut();
        showLogin('Ce compte n’a pas les droits administrateur.');
        return;
      }
      CURRENT_ADMIN = admin;
      showApp();
      onAdminReady();
    } catch (err) {
      showLogin(err.message === 'Invalid login credentials' ? 'Identifiants incorrects.' : (err.message || 'Connexion impossible.'));
    } finally {
      btn.disabled = false; btn.textContent = 'Se connecter';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    CURRENT_ADMIN = null;
    location.reload();
  });
}
