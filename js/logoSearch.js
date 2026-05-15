const LogoSearch = (() => {

  function testImage(url, timeout = 5000) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => { img.src = ''; resolve(null); }, timeout);
      img.onload  = () => { clearTimeout(timer); resolve(url); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  }

  function toCandidates(domain) {
    domain = domain.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9.\-]/g, '');
    if (!domain) return [];

    const hasDot = domain.includes('.');
    const candidates = [];

    if (hasDot) {
      candidates.push(
        `https://logo.clearbit.com/${domain}`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      );
    } else {
      candidates.push(
        `https://logo.clearbit.com/${domain}.com`,
        `https://logo.clearbit.com/${domain}.co.il`,
        `https://logo.clearbit.com/${domain}.org`,
        `https://logo.clearbit.com/${domain}.net`,
        `https://www.google.com/s2/favicons?domain=${domain}.com&sz=128`,
      );
    }
    return candidates;
  }

  async function searchByDomain(domain) {
    if (!domain?.trim()) return null;
    const candidates = toCandidates(domain);
    for (const url of candidates) {
      const result = await testImage(url);
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
        } catch (e) {
          resolve(imgUrl);
        }
      };
      img.onerror = () => resolve(imgUrl);
      img.src = imgUrl;
    });
  }

  return { searchByDomain, toDataUrl };
})();
