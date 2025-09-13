import { parentPort } from 'node:worker_threads';
import { renameSync } from 'node:fs';

function tryRename(src, dest) {
  if (!src || !dest || src === dest) return;
  renameSync(src, dest);
}

parentPort?.on('message', (msg) => {
  try {
    if (!msg || (msg.type !== 'finalize' && msg.type !== 'stage')) {
      parentPort?.postMessage({ type: 'error', id: msg?.id, file: msg?.image?.src ?? 'unknown', error: 'Invalid message' });
      return;
    }

    const { image, caption, id } = msg;

    tryRename(image?.src, image?.dest);
    if (caption?.src && caption?.dest) {
      tryRename(caption.src, caption.dest);
    }

    parentPort?.postMessage({ type: 'result', id, file: image?.dest || image?.src });
  } catch (err) {
    parentPort?.postMessage({ type: 'error', id: msg?.id, file: msg?.image?.src ?? 'unknown', error: err.message });
  }
});

