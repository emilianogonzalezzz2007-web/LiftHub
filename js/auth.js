(function(){
  const $ = (id) => document.getElementById(id);
  let mode = 'login';

  function setMode(m){
    mode = m;
    $('authTabToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    $('authSubmitBtn').textContent = m === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
    $('authStatus').textContent = '';
  }
  $('authTabToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if(btn) setMode(btn.dataset.mode);
  });

  function translateAuthError(msg){
    if(/already registered|already exists/i.test(msg)) return 'Ese correo ya tiene una cuenta. Intenta iniciar sesión.';
    if(/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
    if(/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de iniciar sesión (revisa tu bandeja de entrada).';
    if(/password.*at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
    return msg;
  }

  async function handleSubmit(){
    if(!window.LiftHubConfigured){
      $('authStatus').innerHTML = '⚠️ Falta configurar tu proyecto de Supabase en <code>js/config.js</code>. Revisa el README.';
      return;
    }
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    if(!email || !password){ $('authStatus').textContent = 'Completa correo y contraseña.'; return; }
    if(password.length < 6){ $('authStatus').textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }

    $('authSubmitBtn').disabled = true;
    $('authStatus').textContent = mode === 'login' ? 'Entrando…' : 'Creando cuenta…';

    try{
      if(mode === 'login'){
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if(error) throw error;
        await onLoggedIn();
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if(error) throw error;
        if(data.session){
          await onLoggedIn();
        } else {
          $('authStatus').textContent = 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.';
          setMode('login');
        }
      }
    }catch(err){
      $('authStatus').textContent = translateAuthError(err.message || 'Ocurrió un error.');
    }finally{
      $('authSubmitBtn').disabled = false;
    }
  }
  $('authSubmitBtn').addEventListener('click', handleSubmit);
  $('authPassword').addEventListener('keydown', (e) => { if(e.key === 'Enter') handleSubmit(); });
  $('authEmail').addEventListener('keydown', (e) => { if(e.key === 'Enter') $('authPassword').focus(); });

  async function onLoggedIn(){
    const { data: { session } } = await supabaseClient.auth.getSession();
    window.LiftHubUser = session ? session.user : null;
    if(window.LiftHubUser) $('userEmailBadge').textContent = window.LiftHubUser.email;
    $('authEmail').value = ''; $('authPassword').value = '';
    if(window.LiftHubFood && window.LiftHubFood.reload) await window.LiftHubFood.reload();
    if(window.LiftHubGym && window.LiftHubGym.reload) await window.LiftHubGym.reload();
    window.LiftHubNav.show('screen-home');
  }

  $('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.LiftHubUser = null;
    window.LiftHubNav.show('screen-auth');
  });

  async function init(){
    if(!window.LiftHubConfigured){
      window.LiftHubNav.show('screen-auth');
      return;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(session && session.user){
      window.LiftHubUser = session.user;
      $('userEmailBadge').textContent = session.user.email;
      if(window.LiftHubFood && window.LiftHubFood.reload) await window.LiftHubFood.reload();
      if(window.LiftHubGym && window.LiftHubGym.reload) await window.LiftHubGym.reload();
      window.LiftHubNav.show('screen-home');
    } else {
      window.LiftHubNav.show('screen-auth');
    }
  }
  init();
})();
