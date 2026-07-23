import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

function sendError(response, statusCode, message) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
  });
  response.end(message);
}

function resolveRequestPath(root, requestUrl) {
  const url = new URL(requestUrl ?? '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.slice(1);
  const absolute = path.resolve(root, relative);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;

  if (absolute !== path.resolve(root) && !absolute.startsWith(rootPrefix)) {
    return null;
  }
  return absolute;
}

export async function serveDirectory(t, root) {
  const server = createServer(async (request, response) => {
    let target;
    try {
      target = resolveRequestPath(root, request.url);
    } catch {
      sendError(response, 400, 'Malformed URL');
      return;
    }

    if (!target) {
      sendError(response, 400, 'Invalid path');
      return;
    }

    try {
      const file = await stat(target);
      if (!file.isFile()) {
        sendError(response, 404, 'Not found');
        return;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendError(response, 404, 'Not found');
        return;
      }
      sendError(response, 500, 'Server error');
      return;
    }

    response.writeHead(200, {
      'content-type': CONTENT_TYPES.get(path.extname(target).toLowerCase())
        ?? 'application/octet-stream',
    });
    const stream = createReadStream(target);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  }));

  const address = server.address();
  return { origin: `http://127.0.0.1:${address.port}` };
}
