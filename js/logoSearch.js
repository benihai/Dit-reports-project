const LogoSearch = (() => {

  // ── Clearbit Autocomplete — free, no API key, works with company names ────────
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
        if (Array.isArray(list) && list.length > 0 && list[0].logo) {
          return list[0].logo;
        }
      }
    } catch (_) {}

    // 2. Fall back to domain-guessing approach
    return _searchByDomain(query);
  }

  // ── Domain-guess fallback ─────────────────────────────────────────────────────
  function _testImage(url, timeout = 5000) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => { img.src = ''; resolve(null); }, timeout);
      img.onload  = () => { clearTimeout(timer); resolve(url); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  }

  function _toCandidateUrls(query) {
    const isHebrew = /[א-ת]/.test(query);
    const urls = [];

    if (!isHebrew && query.includes('.')) {
      const domain = query.trim().toLowerCase();
      urls.push(
        `https://logo.clearbit.com/${domain}`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      );
    } else {
      const clean = query.trim()
        .toLowerCase()
        .replace(/[א-תיִ-פֿ]+/g, '')
        .replace(/\s+(ltd|inc|corp|llc|group|בעמ|בע"מ)/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '')
        .replace(/^-+|-+$/g, '');

      if (clean) {
        urls.push(
          `https://logo.clearbit.com/${clean}.com`,
          `https://logo.clearbit.com/${clean}.co.il`,
          `https://www.google.com/s2/favicons?domain=${clean}.com&sz=128`
        );
      }
    }
    return urls;
  }

  async function _searchByDomain(query) {
    const candidates = _toCandidateUrls(query);
    for (const url of candidates) {
      const result = await _testImage(url);
      if (result) return result;
    }
    return null;
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
      img.src = imgUrl;
    });
  }

  return { searchByName, toDataUrl };
})();
