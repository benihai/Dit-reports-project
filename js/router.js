const Router = (() => {
  let routes = [];

  function clear() { routes = []; }

  function register(pattern, handler) {
    const paramNames = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler });
  }

  function navigate(path) {
    window.location.hash = path;
  }

  function getCurrent() {
    return window.location.hash.slice(1) || '/';
  }

  function dispatch(path) {
    for (const route of routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((n, i) => { params[n] = match[i + 1]; });
        route.handler(params);
        return;
      }
    }
    navigate('/');
  }

  function init() {
    window.addEventListener('hashchange', () => dispatch(getCurrent()));
    dispatch(getCurrent());
  }

  return { register, navigate, init, getCurrent, clear };
})();
