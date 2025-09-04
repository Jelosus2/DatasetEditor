import { request as httpRequest } from 'node:http';

async function postJsonLong(urlStr, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const url = new URL(urlStr);
  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  return await new Promise((resolve, reject) => {
    const req = httpRequest(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.setTimeout(0);
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function removeRedundantTagsHelper(tags, removeUnderscores) {
  const separator = removeUnderscores ? ' ' : '_';
  const tagArray = Array.from(tags);
  const cleaned = [...tagArray];

  for (const tag of [...cleaned]) {
    for (const otherTag of cleaned) {
      if (
        tag !== otherTag &&
        otherTag.includes(tag) &&
        (otherTag.startsWith(tag + separator) ||
          otherTag.endsWith(separator + tag) ||
          otherTag.includes(separator + tag + separator))
      ) {
        const index = cleaned.indexOf(tag);
        if (index !== -1) cleaned.splice(index, 1);
        break;
      }
    }
  }

  return new Set(cleaned);
}

export class TaggerApiClient {
  constructor(host = 'http://localhost', mainWindow) {
    this.host = host;
    this.mainWindow = mainWindow;
  }

  async getTaggerDevice(port) {
    try {
      const response = await fetch(`${this.host}:${port}/device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.device;
    } catch (error) {
      const message = `Error getting tagger device: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      this.mainWindow?.webContents.send('app-log', { type: 'error', message });
      return 'Unknown';
    }
  }

  async autoTagImages(props, port) {
    try {
      const {
        images,
        generalThreshold,
        characterThreshold,
        removeUnderscores,
        selectedModels,
        removeRedundantTags,
        tagsIgnored,
      } = props;

      const results = new Map();

      for (const model of selectedModels) {
        const body = {
          images,
          model,
          character_threshold: characterThreshold,
          general_threshold: generalThreshold,
          remove_underscores: removeUnderscores,
          tags_ignored: [...new Set(tagsIgnored)],
        };

        const data = await postJsonLong(`${this.host}:${port}/tagger`, body);

        if (data.error) return null;

        for (const key in data) {
          const incoming = new Set(data[key]);
          if (!results.has(key)) {
            const finalSet = removeRedundantTags
              ? removeRedundantTagsHelper(incoming, removeUnderscores)
              : incoming;
            results.set(key, finalSet);
          } else {
            const combined = new Set([...results.get(key), ...incoming]);
            const finalSet = removeRedundantTags
              ? removeRedundantTagsHelper(combined, removeUnderscores)
              : combined;
            results.set(key, finalSet);
          }
        }
      }

      return results;
    } catch (error) {
      const message = `Error auto tagging images: ${error.code ? '[' + error.code + '] ' : ''}${error.message}`;
      this.mainWindow?.webContents.send('app-log', { type: 'error', message });
      return null;
    }
  }
}
