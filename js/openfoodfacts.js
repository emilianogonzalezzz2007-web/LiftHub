/**
 * Open Food Facts integration.
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 *
 * TEXT SEARCH: tries TWO engines, in order:
 *   1. Search-a-licious (search.openfoodfacts.org) - OFF's newer replacement,
 *      still in beta, docs not publicly crawlable, so best-effort.
 *   2. Legacy /cgi/search.pl - OFF's old engine. As of mid-2026 it's been
 *      returning 503 globally (confirmed via OFF's GitHub issue tracker),
 *      but we still try it as a fallback in case it comes back online, or
 *      works for keywords the new engine misses.
 * If BOTH fail, the user gets a clear message and can fall back to
 * "Escanear" or "Manual", which don't depend on either search engine.
 *
 * BARCODE LOOKUP: uses the stable, documented /api/v2/product/{barcode}
 * endpoint - unaffected by either search engine's issues.
 */
window.OpenFoodFacts = (function(){
  const SEARCH_A_LICIOUS_BASE = 'https://search.openfoodfacts.org/search';
  const LEGACY_SEARCH_BASE = 'https://world.openfoodfacts.org/cgi/search.pl';
  const LEGACY_FIELDS = 'product_name,brands,nutriments,quantity,code';

  function debounce(fn, wait){
    let t = null;
    return function(...args){
      clearTimeout(t);
      return new Promise((resolve, reject) => {
        t = setTimeout(() => {
          fn(...args).then(resolve).catch(reject);
        }, wait);
      });
    };
  }

  async function searchViaSearchALicious(query){
    const url = `${SEARCH_A_LICIOUS_BASE}?q=${encodeURIComponent(query)}&page_size=15&langs=es,en`;
    let res;
    try{ res = await fetch(url); }catch(e){ throw new Error('network'); }
    if(!res.ok){
      if(res.status === 503 || res.status === 429) throw new Error('rate_limited');
      throw new Error('http_' + res.status);
    }
    let data;
    try{ data = await res.json(); }catch(e){ throw new Error('bad_response'); }
    // Defensive parsing - exact response shape isn't publicly documented.
    const hits = Array.isArray(data.hits) ? data.hits : (Array.isArray(data.hits?.hits) ? data.hits.hits : []);
    return hits;
  }

  async function searchViaLegacy(query){
    const url = `${LEGACY_SEARCH_BASE}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&fields=${LEGACY_FIELDS}`;
    let res;
    try{ res = await fetch(url); }catch(e){ throw new Error('network'); }
    if(!res.ok){
      if(res.status === 503 || res.status === 429) throw new Error('rate_limited');
      throw new Error('http_' + res.status);
    }
    let data;
    try{ data = await res.json(); }catch(e){ throw new Error('bad_response'); }
    return Array.isArray(data.products) ? data.products : [];
  }

  async function rawSearch(query){
    let firstError = null;
    try{
      const hits = await searchViaSearchALicious(query);
      if(hits.length > 0) return hits;
      // Empty result isn't necessarily an error - but try the legacy engine
      // too in case it has something the beta index is missing.
    }catch(err){
      firstError = err;
    }

    try{
      const hits = await searchViaLegacy(query);
      return hits;
    }catch(err){
      // Both engines failed (or both returned nothing) - surface the more
      // informative error if we have one.
      if(firstError && firstError.message !== 'network') throw firstError;
      throw err;
    }
  }

  const debouncedSearch = debounce(rawSearch, 700);

  function mapProduct(p){
    const n = p.nutriments || {};
    const protein = numOrNull(n.proteins_100g);
    const carbs = numOrNull(n.carbohydrates_100g);
    const fat = numOrNull(n.fat_100g);
    const kcal = numOrNull(n['energy-kcal_100g']);
    return {
      code: p.code || '',
      name: (p.product_name || '').trim() || 'Producto sin nombre',
      brand: (p.brands || '').split(',')[0].trim(),
      quantity: p.quantity || '',
      protein: protein,
      carbs: carbs,
      fat: fat,
      kcal: kcal,
      hasNutrition: protein !== null || carbs !== null || fat !== null
    };
  }

  function numOrNull(v){
    const n = parseFloat(v);
    return isNaN(n) ? null : Math.round(n * 10) / 10;
  }

  async function search(query){
    const products = await debouncedSearch(query);
    return products.map(mapProduct).filter(p => p.hasNutrition);
  }

  async function getByBarcode(barcode){
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,nutriments,quantity,code`;
    let res;
    try{
      res = await fetch(url, { headers: { 'User-Agent': 'LiftHub - Personal Macro Tracker' } });
    }catch(e){
      throw new Error('network');
    }
    if(!res.ok){
      if(res.status === 503) throw new Error('rate_limited');
      throw new Error('http_' + res.status);
    }
    const data = await res.json();
    if(data.status !== 1 || !data.product){
      return null; // product not found in Open Food Facts
    }
    return mapProduct(data.product);
  }

  return { search, getByBarcode };
})();
