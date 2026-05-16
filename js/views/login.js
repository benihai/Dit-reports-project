const LoginView = (() => {

  function render() {
    App.setHeader('', false, '');
    document.getElementById('view-container').innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <img src="icons/dit-logo.png" alt="DIT Report" class="login-logo">
          <h1 class="login-title">כניסה למערכת</h1>
          <form class="login-form" onsubmit="LoginView.submit(); return false;">
            <div class="form-group">
              <label for="login-email">דואר אלקטרוני</label>
              <input id="login-email" type="email" placeholder="your@email.com" autocomplete="email" required>
            </div>
            <div class="form-group">
              <label for="login-password">סיסמה</label>
              <input id="login-password" type="password" placeholder="••••••••" autocomplete="current-password" required>
            </div>
            <div id="login-error" class="login-error hidden"></div>
            <button type="submit" class="btn btn-primary btn-full" id="login-submit">כניסה</button>
          </form>
        </div>
      </div>
    `;
  }

  async function submit() {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl  = document.getElementById('login-error');
    const btn      = document.getElementById('login-submit');

    if (!email || !password) return;

    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'מתחבר...';

    try {
      await Auth.login(email, password);
      // Show loading overlay while profile loads and app starts
      App.showLoading('טוען...');
    } catch (err) {
      errorEl.textContent = 'אימייל או סיסמה שגויים';
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'כניסה';
    }
  }

  return { render, submit };
})();
