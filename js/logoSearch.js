const LogoSearch = (() => {

  // ── Search by explicit domain ─────────────────────────────────────────────
  async function searchByDomain(domain) {
    if (!domain?.trim()) return null;
    const d = domain.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    if (!d || !d.includes('.')) return null;

    const candidates = [
      `https://logo.clearbit.com/${d}`,
      `https://www.google.com/s2/favicons?domain=${d}&sz=256`,
      `https://icons.duckduckgo.com/ip3/${d}.ico`,
    ];
    for (const url of candidates) {
      const result = await _testImage(url);
      if (result) return result;
    }
    return null;
  }

  // ── Search by company name (name → Clearbit autocomplete → domain fallback) ──
  async function searchByName(query) {
    if (!query?.trim()) return null;

    // 1. Clearbit Autocomplete: returns [{name, domain, logo}]
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      clearTimeout(tid);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          // Try the logo URL from the first result
          if (list[0].logo) {
            const ok = await _testImage(list[0].logo);
            if (ok) return ok;
          }
          // Fallback: use the domain from the result
          if (list[0].domain) {
            const r = await searchByDomain(list[0].domain);
            if (r) return r;
          }
        }
      }
    } catch (_) {}

    // 2. Guess a domain from the company name (works for English names)
    const guessed = _guessDomain(query);
    if (guessed) {
      const r = await searchByDomain(guessed);
      if (r) return r;
    }

    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _testImage(url, timeout = 5000) {
    return new Promise(resolve => {
      const img = new Image();
      const timer = setTimeout(() => { img.src = ''; resolve(null); }, timeout);
      img.onload  = () => { clearTimeout(timer); resolve(url); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  }

  function _guessDomain(query) {
    const clean = query.trim()
      .toLowerCase()
      .replace(/[א-תיִ-פְֿ-ׇ]+/g, '') // strip Hebrew
      .replace(/\s+(ltd|inc|corp|llc|group|בעמ|בע"מ)/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/^-+|-+$/g, '');
    return clean ? clean + '.com' : null;
  }

  async function toDataUrl(imgUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = img.naturalWidth  || 128;
          canvas.height = img.naturalHeight || 128;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) {
          resolve(imgUrl);
        }
      };
      img.onerror = () => resolve(imgUrl);
      img.src = imgUrl + (imgUrl.includes('?') ? '&' : '?') + '_cors=' + Date.now();
    });
  }

  return { searchByName, searchByDomain, toDataUrl };
})();
