import type { DuplicatesWorkerPayload } from "../types/image.js";

import { Utilities } from "../utils/Utilities.js";
import { parentPort } from "node:worker_threads";
import sharp from "sharp";

async function computeDHash(imagePath: string) {
    const { data } = await sharp(imagePath)
        .rotate()
        .resize(9, 8, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const output = new Uint8Array(8);
    let bitIndex = 0;

    for (let y = 0; y < 8; y++) {
        const rowOffset = y * 9;

        for (let x = 0; x < 8; x++) {
            const left = data[rowOffset + x];
            const right = data[rowOffset + x + 1];

            if (left < right)
                output[bitIndex >>> 3] |= (1 << (7 - (bitIndex % 8)));
            bitIndex++;
        }
    }

    return output;
}

async function computePHash(filePath: string) {
    const SIZE = 32;
    const { data } = await sharp(filePath)
        .rotate()
        .resize(SIZE, SIZE, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const matrix = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < data.length; i++)
        matrix[i] = data[i];

    const rows = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++)
        dct1D(matrix, rows, y * SIZE, y * SIZE, SIZE);

    const columns = new Float32Array(SIZE * SIZE);
    const columnInput = new Float32Array(SIZE);
    const columnOutput = new Float32Array(SIZE);

    for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++)
            columnInput[y] = rows[y * SIZE + x];
        dct1DSimple(columnInput, columnOutput, SIZE);

        for (let y = 0; y < SIZE; y++)
            columns[y * SIZE + x] = columnOutput[y];
    }

    const SMALL_SIZE = 8;
    const lowFrequency = [];

    for (let y = 0; y < SMALL_SIZE; y++) {
        for (let x = 0; x < SMALL_SIZE; x++) {
            lowFrequency.push(columns[y * SIZE + x]);
        }
    }

    const values = lowFrequency.slice(1);
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];

    const output = new Uint8Array(8);
    let bitIndex = 0;

    for (let i = 0; i < lowFrequency.length; i++) {
        if (lowFrequency[i] > median)
            output[bitIndex >>> 3] |= (1 << (7 - (bitIndex % 8)));
        bitIndex++;
    }

    return output;
}

function dct1D(src: Float32Array<ArrayBuffer>, dest: Float32Array<ArrayBuffer>, srcOffset: number, destOffset: number, size: number) {
    for (let u = 0; u < size; u++) {
        let sum = 0;

        for (let x = 0; x < size; x++)
            sum += src[srcOffset + x] * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));

        const Cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        dest[destOffset + u] = sum * Cu * Math.sqrt(2 / size);
    }
}

function dct1DSimple(src: Float32Array<ArrayBuffer>, dest: Float32Array<ArrayBuffer>, size: number) {
    dct1D(src, dest, 0, 0, size);
}

parentPort?.on("message", async (message: DuplicatesWorkerPayload) => {
    if (message?.type === "hash") {
        try {
            const bytes = message.method === "phash"
                ? await computePHash(message.file)
                : await computeDHash(message.file);

            parentPort?.postMessage({ type: "result", data: { file: message.file, hash: Array.from(bytes) } });
        } catch (error) {
            parentPort?.postMessage({ type: "error", error:  Utilities.getErrorMessage(error), file: message.file });
        }
    }
});
