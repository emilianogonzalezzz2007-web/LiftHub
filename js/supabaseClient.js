const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Friendly warning if the person hasn't configured their project yet.
window.LiftHubConfigured = !SUPABASE_URL.includes('TU-PROYECTO') && !SUPABASE_ANON_KEY.includes('TU-ANON-KEY');

document.addEventListener('DOMContentLoaded', () => {
  if(!window.LiftHubConfigured){
    const el = document.getElementById('authStatus');
    if(el) el.innerHTML = '⚠️ Falta configurar tu proyecto de Supabase en <code>js/config.js</code>. Revisa el README.';
  }
});
