type NodeHandler = (req: any, res: any) => unknown;

function withQuery(pathname: string, originalUrl: string): string {
  const queryIndex = originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
  return `${pathname}${query}`;
}

export function normalizeVercelApiUrl(req: any): void {
  const originalUrl: string = typeof req.url === 'string' ? req.url : '/';
  const queryIndex = originalUrl.indexOf('?');
  let pathname = queryIndex >= 0 ? originalUrl.slice(0, queryIndex) : originalUrl;

  const pathParam = req.query?.path;
  if (pathParam && (pathname === '/' || pathname === '' || pathname === '/api' || pathname === '/api/dispatch')) {
    const joined = (Array.isArray(pathParam) ? pathParam : [pathParam])
      .flatMap((part: string) => String(part).split('/'))
      .filter(Boolean)
      .join('/');
    if (joined) pathname = `/api/${joined}`;
  }

  if (pathname === '/' || pathname === '') {
    pathname = '/api';
  } else if (!pathname.startsWith('/api/') && pathname !== '/api') {
    pathname = pathname.startsWith('/') ? `/api${pathname}` : `/api/${pathname}`;
  }

  req.url = withQuery(pathname, originalUrl);
}

export function createVercelHandler(app: NodeHandler): NodeHandler {
  return (req, res) => {
    try {
      normalizeVercelApiUrl(req);
    } catch {
      // Fall through to Express default handling.
    }
    return app(req, res);
  };
}
