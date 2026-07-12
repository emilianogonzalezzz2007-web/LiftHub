(function(){
  const $ = (id) => document.getElementById(id);

  let foods = [];          // every food the user has ever created - saved automatically
  let todayLog = [];       // entries for whichever date is currently being viewed
  let openPopoverId = null;
  let foodFilter = '';

  function startOfDay(d){ const n = new Date(d); n.setHours(0,0,0,0); return n; }
  function dateKeyFor(d){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  const TODAY = startOfDay(new Date());
  let viewDate = startOfDay(new Date());
  function currentLogKey(){ return 'log:' + dateKeyFor(viewDate); }
  function isToday(){ return dateKeyFor(viewDate) === dateKeyFor(TODAY); }

  function showToast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  }

  function round(n){ return Math.round(n * 10) / 10; }
  function kcalFor(p,c,f){ return Math.round(p*4 + c*4 + f*9); }
  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------- persistence ---------- */
  async function loadFoods(){
    try{
      const r = await window.storage.get('foods');
      foods = r ? JSON.parse(r.value) : [];
    }catch(e){ foods = []; }
  }
  async function saveFoods(){
    try{ await window.storage.set('foods', JSON.stringify(foods)); }
    catch(e){ showToast('No se pudo guardar. Intenta de nuevo.'); }
  }
  async function loadLogForView(){
    try{
      const r = await window.storage.get(currentLogKey());
      todayLog = r ? JSON.parse(r.value) : [];
    }catch(e){ todayLog = []; }
  }
  async function saveLog(){
    try{ await window.storage.set(currentLogKey(), JSON.stringify(todayLog)); }
    catch(e){ showToast('No se pudo guardar. Intenta de nuevo.'); }
  }

  /* ---------- date navigation ---------- */
  function renderDate(){
    const opts = { weekday:'long', day:'numeric', month:'long' };
    let str = viewDate.toLocaleDateString('es-MX', opts);
    str = str.charAt(0).toUpperCase() + str.slice(1);
    $('dateLine').textContent = str;
    $('nextDay').disabled = isToday();
    $('gotoToday').style.display = isToday() ? 'none' : 'inline-block';
    $('logHeading').textContent = isToday() ? 'Registro de hoy' : 'Registro de este día';
    $('pastDayHint').style.display = isToday() ? 'none' : 'block';
  }
  async function goToDate(newDate){
    viewDate = startOfDay(newDate);
    openPopoverId = null;
    renderDate();
    await loadLogForView();
    renderAll();
  }

  /* ---------- totals ---------- */
  function renderTotals(){
    const totals = todayLog.reduce((acc, e) => {
      acc.p += e.protein; acc.c += e.carbs; acc.f += e.fat; acc.kcal += e.kcal;
      return acc;
    }, {p:0,c:0,f:0,kcal:0});
    $('kcalTotal').textContent = Math.round(totals.kcal).toLocaleString('es-MX');
    $('proteinTotal').textContent = round(totals.p) + ' g';
    $('carbsTotal').textContent = round(totals.c) + ' g';
    $('fatTotal').textContent = round(totals.f) + ' g';
    $('emptyNote').style.display = todayLog.length === 0 ? 'block' : 'none';
  }

  /* ---------- foods grid (formerly "favorites") ---------- */
  function visibleFoods(){
    let list = foods.slice();
    if(foodFilter.trim()){
      const q = foodFilter.trim().toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q) || (f.brand||'').toLowerCase().includes(q));
    }
    list.sort((a,b) => (b.isFavorite?1:0) - (a.isFavorite?1:0));
    return list;
  }

  function renderFoods(){
    const grid = $('favGrid');
    grid.innerHTML = '';
    const list = visibleFoods();
    if(list.length === 0){
      grid.innerHTML = foods.length === 0
        ? '<div class="fav-empty">Aún no has agregado alimentos. Usa el botón de arriba — se guardan solos, no hace falta marcarlos como favoritos.</div>'
        : '<div class="fav-empty">Nada coincide con tu búsqueda.</div>';
      return;
    }
    list.forEach(food => {
      const card = document.createElement('div');
      card.className = 'fav-card';
      const isPortion = food.basis === 'portion';
      const unitLabel = isPortion ? (food.portionUnit || 'porción') : '100g';
      const star = food.isFavorite ? '★' : '☆';
      card.innerHTML = `
        <button class="fav-star ${food.isFavorite ? 'active' : ''}" title="Marcar como favorito" data-star="${food.id}">${star}</button>
        <button class="fav-remove" title="Eliminar alimento" data-remove="${food.id}">&times;</button>
        <p class="fname">${escapeHtml(food.name)}${isPortion ? '<span class="basis-tag">porción</span>' : ''}${food.source === 'openfoodfacts' ? '<span class="basis-tag off-tag">OFF</span>' : ''}</p>
        <p class="fmacros">${food.protein}P · ${food.carbs}C · ${food.fat}G /${escapeHtml(unitLabel)}</p>
        <div class="popover-slot"></div>
      `;
      card.addEventListener('click', (ev) => {
        if(ev.target.closest('[data-remove]') || ev.target.closest('[data-star]')) return;
        togglePopover(food, card);
      });
      card.querySelector('[data-remove]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeFood(food.id);
      });
      card.querySelector('[data-star]').addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleFavorite(food.id);
      });
      grid.appendChild(card);
      if(openPopoverId === food.id) mountPopover(food, card);
    });
  }

  function togglePopover(food, card){
    openPopoverId = (openPopoverId === food.id) ? null : food.id;
    renderFoods();
  }

  function mountPopover(food, card){
    const slot = card.querySelector('.popover-slot');
    const isPortion = food.basis === 'portion';
    const unitLabel = isPortion ? (food.portionUnit || 'porción') : 'g';
    const defaultVal = isPortion ? 1 : 100;
    const step = isPortion ? 0.5 : 1;
    slot.innerHTML = `
      <div class="popover" onclick="event.stopPropagation()">
        <input type="number" min="0.1" step="${step}" value="${defaultVal}" id="amountInput-${food.id}"/>
        <span>${escapeHtml(unitLabel)}</span>
        <button class="btn btn-small" data-add="${food.id}">Agregar</button>
      </div>
    `;
    const input = slot.querySelector('input');
    input.focus(); input.select();
    input.addEventListener('keydown', (e) => { if(e.key === 'Enter') addLogEntry(food); });
    slot.querySelector('[data-add]').addEventListener('click', (e) => { e.stopPropagation(); addLogEntry(food); });
  }

  async function addLogEntry(food){
    const input = $('amountInput-' + food.id);
    const amount = parseFloat(input.value);
    if(!amount || amount <= 0){ showToast('Escribe una cantidad válida.'); return; }
    const isPortion = food.basis === 'portion';
    const scale = isPortion ? amount : (amount / 100);
    const entry = {
      id: 'e' + Date.now(),
      name: food.name,
      basis: food.basis || 'per100g',
      amount: amount,
      unitLabel: isPortion ? (food.portionUnit || 'porción') : 'g',
      protein: round(food.protein * scale),
      carbs: round(food.carbs * scale),
      fat: round(food.fat * scale),
      kcal: kcalFor(food.protein*scale, food.carbs*scale, food.fat*scale)
    };
    todayLog.unshift(entry);
    openPopoverId = null;
    renderAll();
    await saveLog();
    showToast(food.name + ' agregado');
  }

  async function removeFood(id){
    foods = foods.filter(f => f.id !== id);
    renderAll();
    await saveFoods();
  }
  async function toggleFavorite(id){
    const f = foods.find(f => f.id === id);
    if(f) f.isFavorite = !f.isFavorite;
    renderAll();
    await saveFoods();
  }
  async function deleteLogEntry(id){
    todayLog = todayLog.filter(e => e.id !== id);
    renderAll();
    await saveLog();
  }

  function renderLog(){
    const list = $('logList');
    list.innerHTML = '';
    if(todayLog.length === 0){
      list.innerHTML = '<div class="log-empty">Nada registrado este día.</div>';
      return;
    }
    todayLog.forEach(e => {
      const row = document.createElement('div');
      row.className = 'log-row';
      const qty = e.amount !== undefined ? e.amount : e.grams;
      const unit = e.unitLabel || 'g';
      row.innerHTML = `
        <div class="log-main">
          <b>${escapeHtml(e.name)}</b> · ${qty} ${escapeHtml(unit)}
          <div class="log-sub">${e.protein}P · ${e.carbs}C · ${e.fat}G</div>
        </div>
        <div class="log-right">
          <span class="log-kcal">${e.kcal} kcal</span>
          <button class="log-del" data-del="${e.id}" title="Eliminar">&times;</button>
        </div>
      `;
      row.querySelector('[data-del]').addEventListener('click', () => deleteLogEntry(e.id));
      list.appendChild(row);
    });
  }

  function renderAll(){
    renderTotals();
    renderFoods();
    renderLog();
  }

  /* ---------- add-food modal: Manual tab ---------- */
  let modalBasis = 'per100g';
  let modalTab = 'manual';

  function setModalBasis(basis){
    modalBasis = basis;
    $('basisToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.basis === basis));
    const isPortion = basis === 'portion';
    $('portionUnitField').style.display = isPortion ? 'block' : 'none';
    $('lblProtein').textContent = isPortion ? 'Proteína /porción' : 'Proteína /100g';
    $('lblCarbs').textContent = isPortion ? 'Carbos /porción' : 'Carbos /100g';
    $('lblFat').textContent = isPortion ? 'Grasas /porción' : 'Grasas /100g';
  }
  $('basisToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-basis]');
    if(btn) setModalBasis(btn.dataset.basis);
  });

  function setModalTab(tab){
    modalTab = tab;
    $('modalTabToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('manualTabPanel').style.display = tab === 'manual' ? 'block' : 'none';
    $('searchTabPanel').style.display = tab === 'search' ? 'block' : 'none';
    $('scanTabPanel').style.display = tab === 'scan' ? 'block' : 'none';
    if(tab !== 'scan') stopScanner();
  }
  $('modalTabToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if(btn) setModalTab(btn.dataset.tab);
  });

  let pendingSource = 'manual';

  function openAddFoodModal(){
    $('fName').value=''; $('fProtein').value=''; $('fCarbs').value=''; $('fFat').value=''; $('fPortionUnit').value='';
    $('offQuery').value = '';
    $('offResults').innerHTML = '';
    $('offStatus').textContent = '';
    pendingSource = 'manual';
    setModalBasis('per100g');
    setModalTab('manual');
    $('favOverlay').classList.add('open');
    setTimeout(() => $('fName').focus(), 50);
  }
  $('openAddFav').addEventListener('click', openAddFoodModal);
  $('cancelFav').addEventListener('click', () => { stopScanner(); $('favOverlay').classList.remove('open'); });
  $('favOverlay').addEventListener('click', (e) => { if(e.target.id === 'favOverlay'){ stopScanner(); $('favOverlay').classList.remove('open'); } });

  $('saveFav').addEventListener('click', async () => {
    const name = $('fName').value.trim();
    const protein = parseFloat($('fProtein').value) || 0;
    const carbs = parseFloat($('fCarbs').value) || 0;
    const fat = parseFloat($('fFat').value) || 0;
    if(!name){ showToast('Ponle un nombre al alimento.'); return; }
    if(protein === 0 && carbs === 0 && fat === 0){ showToast('Agrega al menos un macro.'); return; }
    const food = { id:'f'+Date.now(), name, protein, carbs, fat, basis: modalBasis, isFavorite:false, source: pendingSource };
    if(modalBasis === 'portion'){
      food.portionUnit = $('fPortionUnit').value.trim() || 'porción';
    }
    foods.unshift(food); // saved automatically - no forced favoriting
    $('favOverlay').classList.remove('open');
    renderAll();
    await saveFoods();
    showToast(name + ' guardado en Mis alimentos');
  });

  /* ---------- add-food modal: Open Food Facts search tab ---------- */
  let searchToken = 0;

  async function runSearch(){
    const q = $('offQuery').value.trim();
    if(q.length < 2){
      $('offStatus').textContent = 'Escribe al menos 2 letras.';
      $('offResults').innerHTML = '';
      return;
    }
    const myToken = ++searchToken;
    $('offStatus').textContent = 'Buscando en Open Food Facts…';
    $('offResults').innerHTML = '';
    try{
      const results = await window.OpenFoodFacts.search(q);
      if(myToken !== searchToken) return; // a newer search superseded this one
      if(results.length === 0){
        $('offStatus').textContent = 'Sin resultados con información nutrimental. Prueba otro término, o agrégalo manualmente.';
        return;
      }
      $('offStatus').textContent = results.length + ' resultado(s):';
      renderOffResults(results);
    }catch(err){
      if(myToken !== searchToken) return;
      if(err.message === 'rate_limited'){
        $('offStatus').textContent = 'Se alcanzó el límite de búsquedas de Open Food Facts. Espera un momento e intenta de nuevo.';
      } else if(err.message === 'network'){
        $('offStatus').textContent = 'No hay conexión a internet, o Open Food Facts no responde.';
      } else {
        $('offStatus').textContent = 'Ocurrió un error al buscar. Intenta de nuevo.';
      }
    }
  }

  function renderOffResults(results){
    const wrap = $('offResults');
    wrap.innerHTML = '';
    results.forEach(p => {
      const row = document.createElement('div');
      row.className = 'off-result';
      const macroBits = [
        p.protein !== null ? p.protein + 'P' : null,
        p.carbs !== null ? p.carbs + 'C' : null,
        p.fat !== null ? p.fat + 'G' : null
      ].filter(Boolean).join(' · ');
      row.innerHTML = `
        <div class="off-result-name">${escapeHtml(p.name)}${p.brand ? ' <span class="off-brand">· ' + escapeHtml(p.brand) + '</span>' : ''}</div>
        <div class="off-result-macros">${macroBits || 'Sin datos completos'} /100g${p.quantity ? ' · ' + escapeHtml(p.quantity) : ''}</div>
      `;
      row.addEventListener('click', () => useOffProduct(p));
      wrap.appendChild(row);
    });
  }

  function useOffProduct(p){
    pendingSource = 'openfoodfacts';
    $('fName').value = p.brand ? `${p.name} (${p.brand})` : p.name;
    $('fProtein').value = p.protein !== null ? p.protein : '';
    $('fCarbs').value = p.carbs !== null ? p.carbs : '';
    $('fFat').value = p.fat !== null ? p.fat : '';
    setModalBasis('per100g');
    setModalTab('manual');
    showToast('Datos cargados — revisa y guarda');
  }

  $('offSearchBtn').addEventListener('click', runSearch);
  $('offQuery').addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); runSearch(); } });

  /* ---------- add-food modal: barcode scan tab ---------- */
  let html5QrInstance = null;
  let scannerRunning = false;

  async function startScanner(){
    if(scannerRunning) return;
    if(typeof Html5Qrcode === 'undefined'){
      $('scanStatus').textContent = 'No se pudo cargar el lector de códigos. Revisa tu conexión e intenta de nuevo.';
      return;
    }
    $('scanStatus').textContent = 'Pidiendo permiso de cámara…';
    try{
      html5QrInstance = new Html5Qrcode('scanReader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E
        ]
      });
      const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const width = Math.floor(minEdge * 0.85);
        const height = Math.floor(width * 0.45); // wide rectangle, better for 1D barcodes
        return { width, height };
      };
      await html5QrInstance.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: qrboxFunction, aspectRatio: 1.4 },
        onBarcodeDetected,
        () => {} // ignore per-frame "not found" noise
      );
      scannerRunning = true;
      $('scanStatus').textContent = 'Cámara lista — alinea el código dentro del recuadro y mantén el pulso firme…';
      $('scanStartBtn').style.display = 'none';
      $('scanStopBtn').style.display = 'inline-block';
    }catch(err){
      scannerRunning = false;
      $('scanStatus').textContent = 'No se pudo abrir la cámara. Revisa que le diste permiso al navegador, o usa Buscar/Manual.';
    }
  }

  async function stopScanner(){
    if(!scannerRunning || !html5QrInstance) return;
    try{ await html5QrInstance.stop(); html5QrInstance.clear(); }catch(e){ /* already stopped */ }
    scannerRunning = false;
    $('scanStartBtn').style.display = 'inline-block';
    $('scanStopBtn').style.display = 'none';
  }

  let lastScannedCode = null;
  async function onBarcodeDetected(decodedText){
    if(decodedText === lastScannedCode) return; // avoid re-triggering on the same frame burst
    lastScannedCode = decodedText;
    $('scanStatus').textContent = `Código ${decodedText} detectado — buscando en Open Food Facts…`;
    await stopScanner();
    try{
      const product = await window.OpenFoodFacts.getByBarcode(decodedText);
      if(!product){
        $('scanStatus').textContent = `No encontramos el código ${decodedText} en Open Food Facts. Puedes agregarlo manualmente.`;
        setTimeout(() => { lastScannedCode = null; }, 500);
        return;
      }
      useOffProduct(product);
    }catch(err){
      if(err.message === 'rate_limited'){
        $('scanStatus').textContent = 'Se alcanzó el límite de consultas. Espera un momento e intenta de nuevo.';
      } else if(err.message === 'network'){
        $('scanStatus').textContent = 'No hay conexión a internet, o Open Food Facts no responde.';
      } else {
        $('scanStatus').textContent = 'Ocurrió un error al buscar el producto.';
      }
      lastScannedCode = null;
    }
  }

  $('scanStartBtn').addEventListener('click', () => { lastScannedCode = null; startScanner(); });
  $('scanStopBtn').addEventListener('click', stopScanner);

  /* ---------- filter box ---------- */
  $('foodFilterInput').addEventListener('input', (e) => {
    foodFilter = e.target.value;
    renderFoods();
  });

  /* ---------- date nav ---------- */
  $('prevDay').addEventListener('click', () => { const d=new Date(viewDate); d.setDate(d.getDate()-1); goToDate(d); });
  $('nextDay').addEventListener('click', () => { if(isToday()) return; const d=new Date(viewDate); d.setDate(d.getDate()+1); goToDate(d); });
  $('gotoToday').addEventListener('click', () => goToDate(new Date()));

  async function reload(){
    viewDate = startOfDay(new Date());
    openPopoverId = null;
    renderDate();
    await loadFoods();
    await loadLogForView();
    if(foods.length === 0){
      foods = [
        {id:'f1', name:'Pechuga de pollo', basis:'per100g', protein:31, carbs:0, fat:3.6, isFavorite:true, source:'manual'},
        {id:'f2', name:'Arroz blanco cocido', basis:'per100g', protein:2.7, carbs:28, fat:0.3, isFavorite:true, source:'manual'},
        {id:'f3', name:'Huevo entero', basis:'per100g', protein:13, carbs:1.1, fat:11, isFavorite:false, source:'manual'},
        {id:'f4', name:'Aguacate', basis:'per100g', protein:2, carbs:8.5, fat:15, isFavorite:false, source:'manual'}
      ];
      await saveFoods();
    }
    renderAll();
  }

  window.LiftHubFood = { reload };
})();
