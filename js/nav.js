(function(){
  const screens = ['screen-auth','screen-home','screen-food','screen-gym-muscles','screen-gym-exercises'];
  function show(id){
    screens.forEach(s => document.getElementById(s).style.display = (s === id ? 'block' : 'none'));
    window.scrollTo(0,0);
  }
  window.LiftHubNav = { show };

  document.getElementById('goFood').addEventListener('click', () => show('screen-food'));
  document.getElementById('backFromFood').addEventListener('click', () => show('screen-home'));
  document.getElementById('goGym').addEventListener('click', () => {
    show('screen-gym-muscles');
    if(window.LiftHubGym) window.LiftHubGym.renderMuscles();
  });
  document.getElementById('backFromGymMuscles').addEventListener('click', () => show('screen-home'));
  document.getElementById('backFromGymExercises').addEventListener('click', () => {
    show('screen-gym-muscles');
    if(window.LiftHubGym) window.LiftHubGym.renderMuscles();
  });
})();
