import { parentPort } from 'node:worker_threads';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

async function computeDHashBytes(filePath) {
  const input = readFileSync(filePath);
  const pixels = await sharp(input)
    .rotate()
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  const out = new Uint8Array(8);
  let bitIndex = 0;
  for (let y = 0; y < 8; y++) {
    const rowStart = y * 9;
    for (let x = 0; x < 8; x++) {
      const left = pixels[rowStart + x];
      const right = pixels[rowStart + x + 1];
      const bit = left < right ? 1 : 0;
      const byteIndex = (bitIndex / 8) | 0;
      out[byteIndex] = (out[byteIndex] << 1) | bit;
      bitIndex++;
    }
  }
  const remaining = 8 - (bitIndex % 8);
  if (remaining !== 8) out[(bitIndex / 8) | 0] <<= remaining;
  return out;
}

function dct2D(matrix) {
  const N = matrix.length;
  const M = matrix[0].length;
  const cosX = Array.from({ length: N }, () => new Array(N));
  const cosY = Array.from({ length: M }, () => new Array(M));
  for (let u = 0; u < N; u++)
    for (let x = 0; x < N; x++)
      cosX[u][x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
  for (let v = 0; v < M; v++)
    for (let y = 0; y < M; y++)
      cosY[v][y] = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * M));

  const result = Array.from({ length: N }, () => new Array(M).fill(0));
  for (let u = 0; u < N; u++) {
    const Cu = u === 0 ? 1 / Math.sqrt(2) : 1;
    for (let v = 0; v < M; v++) {
      const Cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      let sum = 0;
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < M; y++) {
          sum += matrix[x][y] * cosX[u][x] * cosY[v][y];
        }
      }
      result[u][v] = 0.25 * Cu * Cv * sum;
    }
  }
  return result;
}

async function computePHashBytes(filePath) {
  const size = 32;
  const small = 8;

  const input = readFileSync(filePath);
  const pixels = await sharp(input)
    .rotate()
    .grayscale()
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer();

  const img = Array.from({ length: size }, (_, y) => {
    const row = new Array(size);
    for (let x = 0; x < size; x++) row[x] = pixels[y * size + x];
    return row;
  });

  const dct = dct2D(img);

  const block = [];
  for (let y = 0; y < small; y++) {
    for (let x = 0; x < small; x++) block.push(dct[y][x]);
  }

  const vals = block.slice(1);
  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted[(sorted.length / 2) | 0];

  const out = new Uint8Array(8);
  let bitIndex = 0;
  for (let i = 0; i < block.length; i++) {
    const v = block[i];
    const bit = v > median ? 1 : 0;
    const byteIndex = (bitIndex / 8) | 0;
    out[byteIndex] = (out[byteIndex] << 1) | bit;
    bitIndex++;
  }
  const remaining = 8 - (bitIndex % 8);
  if (remaining !== 8) out[(bitIndex / 8) | 0] <<= remaining;
  return out;
}

parentPort.on('message', async (msg) => {
  if (!msg || msg.type !== 'hash') return;
  const { file, method } = msg;
  try {
    const bytes = method === 'dhash' ? await computeDHashBytes(file) : await computePHashBytes(file);
    parentPort.postMessage({ type: 'result', file, bytes: Array.from(bytes) });
  } catch (err) {
    parentPort.postMessage({ type: 'error', file, error: err?.message || String(err) });
  }
});

