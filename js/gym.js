(function(){
  const $ = (id) => document.getElementById(id);
  const MUSCLES = ['Pecho','Espalda','Pierna','Hombros','Tríceps','Bíceps','Abdominales'];
  let gymData = {};
  let currentMuscle = null;
  let currentExerciseId = null;
  let currentSetUnit = 'kg';
  let historyExerciseRef = null;

  const BARBELL_SVG = '<svg viewBox="0 0 48 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">'+
    '<rect x="0" y="9" width="4" height="6" rx="1"/><rect x="5" y="7" width="4" height="10" rx="1"/>'+
    '<rect x="11" y="11" width="26" height="2"/>'+
    '<rect x="39" y="7" width="4" height="10" rx="1"/><rect x="44" y="9" width="4" height="6" rx="1"/></svg>';

  function showToast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1600);
  }
  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadGymData(){
    try{
      const r = await window.storage.get('gymData');
      gymData = r ? JSON.parse(r.value) : {};
    }catch(e){ gymData = {}; }
    MUSCLES.forEach(m => { if(!gymData[m]) gymData[m] = []; });
    MUSCLES.forEach(m => {
      (gymData[m] || []).forEach(ex => {
        if(!ex.history){
          ex.history = (ex.lastAttempt && ex.lastAttempt.sets && ex.lastAttempt.sets.length)
            ? [{ date: ex.lastAttempt.date, unit: ex.lastAttempt.unit || 'kg', sets: ex.lastAttempt.sets }]
            : [];
        }
        delete ex.lastAttempt;
      });
    });
  }
  async function saveGymData(){
    try{ await window.storage.set('gymData', JSON.stringify(gymData)); }
    catch(e){ showToast('No se pudo guardar. Intenta de nuevo.'); }
  }

  function renderMuscles(){
    const grid = $('muscleGrid');
    grid.innerHTML = '';
    MUSCLES.forEach(m => {
      const count = (gymData[m] || []).length;
      const card = document.createElement('div');
      card.className = 'muscle-card';
      card.innerHTML = `
        <span class="m-icon">${BARBELL_SVG}</span>
        <span class="m-name">${escapeHtml(m)}</span>
        <span class="m-count">${count} ejercicio${count === 1 ? '' : 's'}</span>
      `;
      card.addEventListener('click', () => openMuscle(m));
      grid.appendChild(card);
    });
  }

  function openMuscle(muscle){
    currentMuscle = muscle;
    $('muscleTitle').textContent = muscle;
    renderExercises();
    window.LiftHubNav.show('screen-gym-exercises');
  }

  function summarizeSets(sets, unit){
    return sets.map(s => `${s.weight}${unit}×${s.reps}`).join(' · ');
  }

  function renderExercises(){
    const list = $('exerciseList');
    list.innerHTML = '';
    const items = gymData[currentMuscle] || [];
    if(items.length === 0){
      list.innerHTML = '<div class="list-empty">Aún no tienes ejercicios en ' + escapeHtml(currentMuscle) + '. Agrega uno arriba.</div>';
      return;
    }
    items.forEach(ex => {
      const row = document.createElement('div');
      row.className = 'exercise-row';
      const last = ex.history && ex.history[0];
      let inner = `<button class="ex-remove" data-remove="${ex.id}" title="Eliminar ejercicio">&times;</button>`;
      inner += `<div class="ex-name">${escapeHtml(ex.name)}</div>`;
      if(last && last.sets && last.sets.length){
        inner += `<div class="ex-last"><i>Último (${last.date}):</i> ${summarizeSets(last.sets, last.unit || 'kg')}</div>`;
      } else {
        inner += `<div class="ex-none">Sin registros aún — toca para agregar tu primer intento</div>`;
      }
      if(ex.history && ex.history.length > 0){
        inner += `<button class="ex-history-btn" data-hist="${ex.id}">Ver historial completo (${ex.history.length})</button>`;
      }
      row.innerHTML = inner;
      row.addEventListener('click', (ev) => {
        if(ev.target.closest('[data-remove]') || ev.target.closest('[data-hist]')) return;
        openSetModal(ex);
      });
      row.querySelector('[data-remove]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeExercise(ex.id);
      });
      const histBtn = row.querySelector('[data-hist]');
      if(histBtn){
        histBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openHistoryModal(ex);
        });
      }
      list.appendChild(row);
    });
  }

  async function removeExercise(id){
    gymData[currentMuscle] = (gymData[currentMuscle] || []).filter(e => e.id !== id);
    renderExercises();
    renderMuscles();
    await saveGymData();
  }

  $('openAddExercise').addEventListener('click', () => {
    $('exName').value = '';
    $('exerciseOverlay').classList.add('open');
    setTimeout(() => $('exName').focus(), 50);
  });
  $('cancelExercise').addEventListener('click', () => $('exerciseOverlay').classList.remove('open'));
  $('exerciseOverlay').addEventListener('click', (e) => { if(e.target.id === 'exerciseOverlay') $('exerciseOverlay').classList.remove('open'); });
  $('saveExercise').addEventListener('click', async () => {
    const name = $('exName').value.trim();
    if(!name){ showToast('Escribe el nombre del ejercicio.'); return; }
    gymData[currentMuscle] = gymData[currentMuscle] || [];
    gymData[currentMuscle].unshift({ id:'ex'+Date.now(), name, history: [] });
    $('exerciseOverlay').classList.remove('open');
    renderExercises();
    renderMuscles();
    await saveGymData();
    showToast(name + ' agregado');
  });

  function todayStr(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function setSetUnit(unit){
    currentSetUnit = unit;
    $('setUnitToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.unit === unit));
    $('setsGrid').querySelectorAll('.mini.weight label').forEach(l => { l.textContent = 'Peso (' + unit + ')'; });
  }
  $('setUnitToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-unit]');
    if(btn) setSetUnit(btn.dataset.unit);
  });

  function openSetModal(ex){
    currentExerciseId = ex.id;
    $('setModalTitle').textContent = ex.name;

    const last = ex.history && ex.history[0];
    const box = $('lastAttemptBox');
    if(last && last.sets && last.sets.length){
      const lines = last.sets.map((s,i) => {
        let l = `Set ${i+1}: <b>${s.weight}${last.unit || 'kg'} × ${s.reps}</b>`;
        if(s.comment) l += ` — ${escapeHtml(s.comment)}`;
        return l;
      }).join('<br/>');
      box.innerHTML = `Tu último intento (${last.date}):<br/>${lines}`;
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }

    setSetUnit((last && last.unit) || 'kg');

    const grid = $('setsGrid');
    grid.innerHTML = '';
    for(let i = 0; i < 4; i++){
      const prev = (last && last.sets[i]) || {};
      const row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `
        <span class="set-label">Set ${i+1}</span>
        <div class="set-inputs">
          <div class="mini weight">
            <label>Peso (${currentSetUnit})</label>
            <input type="number" step="0.5" min="0" placeholder="${prev.weight !== undefined ? prev.weight : '0'}" id="setWeight-${i}"/>
          </div>
          <div class="mini">
            <label>Reps</label>
            <input type="number" step="1" min="0" placeholder="${prev.reps !== undefined ? prev.reps : '0'}" id="setReps-${i}"/>
          </div>
          <div class="mini note">
            <label>Nota (opcional)</label>
            <input type="text" placeholder="ej. buena forma" id="setNote-${i}"/>
          </div>
        </div>
      `;
      grid.appendChild(row);
    }

    $('setOverlay').classList.add('open');
  }

  $('cancelSet').addEventListener('click', () => $('setOverlay').classList.remove('open'));
  $('setOverlay').addEventListener('click', (e) => { if(e.target.id === 'setOverlay') $('setOverlay').classList.remove('open'); });

  $('saveSet').addEventListener('click', async () => {
    const sets = [];
    for(let i = 0; i < 4; i++){
      const w = parseFloat($('setWeight-' + i).value);
      const r = parseFloat($('setReps-' + i).value);
      const c = $('setNote-' + i).value.trim();
      if((w && w > 0) || (r && r > 0)){
        sets.push({ weight: w || 0, reps: r || 0, comment: c });
      }
    }
    if(sets.length === 0){ showToast('Ingresa al menos un set con peso o reps.'); return; }

    const list = gymData[currentMuscle] || [];
    const ex = list.find(e => e.id === currentExerciseId);
    if(ex){
      ex.history = ex.history || [];
      ex.history.unshift({ date: todayStr(), unit: currentSetUnit, sets: sets });
    }
    $('setOverlay').classList.remove('open');
    renderExercises();
    await saveGymData();
    showToast('Intento guardado');
  });

  function openHistoryModal(ex){
    historyExerciseRef = ex;
    $('historyModalTitle').textContent = 'Historial — ' + ex.name;
    renderHistoryList();
    $('historyOverlay').classList.add('open');
  }

  function renderHistoryList(){
    const list = $('historyList');
    list.innerHTML = '';
    const ex = historyExerciseRef;
    if(!ex || !ex.history || ex.history.length === 0){
      list.innerHTML = '<div class="list-empty">Sin intentos registrados todavía.</div>';
      return;
    }
    ex.history.forEach((att, idx) => {
      const row = document.createElement('div');
      row.className = 'history-row';
      const setsHtml = att.sets.map((s,i) => {
        let l = `Set ${i+1}: <b>${s.weight}${att.unit || 'kg'} × ${s.reps}</b>`;
        if(s.comment) l += ` — ${escapeHtml(s.comment)}`;
        return l;
      }).join('<br/>');
      row.innerHTML = `
        <div class="history-date">${att.date}${idx === 0 ? ' <span class="history-recent-tag">más reciente</span>' : ''}</div>
        <div class="history-sets">${setsHtml}</div>
        <button class="history-del" data-histdel="${idx}" title="Eliminar este intento">&times;</button>
      `;
      row.querySelector('[data-histdel]').addEventListener('click', () => deleteHistoryEntry(idx));
      list.appendChild(row);
    });
  }

  async function deleteHistoryEntry(idx){
    if(!historyExerciseRef) return;
    historyExerciseRef.history.splice(idx, 1);
    renderHistoryList();
    renderExercises();
    await saveGymData();
  }

  $('closeHistory').addEventListener('click', () => $('historyOverlay').classList.remove('open'));
  $('historyOverlay').addEventListener('click', (e) => { if(e.target.id === 'historyOverlay') $('historyOverlay').classList.remove('open'); });

  function escapeCsv(v){
    if(v === null || v === undefined) v = '';
    v = String(v);
    if(/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  function exportGymCSV(){
    const rows = [['Musculo','Ejercicio','Fecha','Unidad','Set','Peso','Reps','Nota']];
    MUSCLES.forEach(m => {
      (gymData[m] || []).forEach(ex => {
        (ex.history || []).forEach(att => {
          att.sets.forEach((s, i) => {
            rows.push([m, ex.name, att.date, att.unit || 'kg', i + 1, s.weight, s.reps, s.comment || '']);
          });
        });
      });
    });
    if(rows.length === 1){ showToast('Todavía no hay datos de gym para exportar.'); return; }
    const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifthub-hierro-' + todayStr() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Descargando CSV…');
  }
  $('exportGymBtn').addEventListener('click', exportGymCSV);

  async function reload(){
    await loadGymData();
  }

  window.LiftHubGym = { renderMuscles, reload };
})();
