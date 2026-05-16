const LogoSearch = (() => {

  function testImage(url, timeout = 6000) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => { img.src = ''; resolve(null); }, timeout);
      img.onload  = () => { clearTimeout(timer); resolve(url); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    });
  }

  // המרת שם חברה ל-domain candidates
  function companyToDomainCandidates(company) {
    const clean = company.trim()
      .toLowerCase()
      .replace(/[א-תיִ-פֿ]+/g, '') // הסרת עברית
      .replace(/\s+(ltd|inc|corp|llc|group|בעמ|בע"מ|גרופ|מטרו|תכנון|בניין|נדלן|נדל"ן)/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/^-+|-+$/g, '');

    if (!clean) return [];

    return [
      `${clean}.com`,
      `${clean}.co.il`,
      `${clean}.org`,
      `${clean}.net`,
      `${clean}.il`,
    ];
  }

  function toCandidateUrls(query) {
    const isHebrew = /[א-ת]/.test(query);
    const urls = [];

    if (!isHebrew && query.includes('.')) {
      // כבר domain
      const domain = query.trim().toLowerCase();
      urls.push(
        `https://logo.clearbit.com/${domain}`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      );
    } else {
      // שם חברה - נסה domains מגוזרים
      const domains = companyToDomainCandidates(query);
      for (const d of domains) {
        urls.push(`https://logo.clearbit.com/${d}`);
      }
      // Google Favicon עם guess
      if (domains.length > 0) {
        urls.push(`https://www.google.com/s2/favicons?domain=${domains[0]}&sz=128`);
      }
      // DuckDuckGo icon API
      const encoded = encodeURIComponent(query.replace(/[א-ת\s]/g, '').trim() || query.split(/\s/)[0]);
      if (encoded) {
        urls.push(`https://icons.duckduckgo.com/ip3/${encoded}.com.ico`);
      }
    }
    return urls;
  }

  async function searchByDomain(query) {
    if (!query?.trim()) return null;
    const candidates = toCandidateUrls(query);
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
