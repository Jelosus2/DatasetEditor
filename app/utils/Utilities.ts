import { Worker } from "node:worker_threads";
import os from "node:os";

export class Utilities {
    static isStringNumeric(str: string) {
        if (typeof str !== "string")
            return false;

        return (
            !isNaN(parseFloat(str)) &&
            isFinite(str as unknown as number) &&
            str.trim().length > 0
        );
    }

    static formatTagOutput(tag: string, results: number) {
        let text = tag;

        if (results >= 1_000_000) {
            text += ` (${(results / 1_000_000).toFixed(1).replace('.0', '')}m)`;
        } else if (results >= 1000) {
            text += ` (${(results / 1000).toFixed(1).replace('.0', '')}k)`;
        } else {
            text += ` (${results})`;
        }

        return text;
    }

    static getErrorMessage(error: unknown) {
        if (error instanceof Error)
            return error.message;

        return String(error);
    }

    static async processMap<I, O>(items: I[], mapper: (item: I) => Promise<O>, concurrency: number = os.availableParallelism()): Promise<O[]> {
        const results: O[] = new Array(items.length);
        let nextIndex = 0;

        const worker = async () => {
            while (true) {
                const index = nextIndex++;
                if (index >= items.length)
                    break;

                results[index] = await mapper(items[index]);
            }
        }

        const workerCount = Math.min(items.length, concurrency);
        const workers = Array.from({ length: workerCount }, worker);

        await Promise.all(workers);
        return results;
    }

    static async runWorkerTask<I, O>(items: I[], workerPath: string, payloadFactory: (item: I, id: number) => Record<string, unknown>, onProgress?: (processed: number, total: number) => void): Promise<O[]> {
        const total = items.length;
        if (total === 0)
            return [];

        const results: O[] = [];
        const poolSize = os.availableParallelism();
        let nextIndex = 0;
        let processed = 0;

        const workers = Array.from({ length: poolSize }, () =>
            new Worker(workerPath)
        );

        const run = (worker: Worker) => new Promise<void>((resolve) => {
            const dispatch = () => {
                if (nextIndex >= total) {
                    resolve();
                    return;
                }

                const id = nextIndex++;
                const payload = payloadFactory(items[id], id);
                worker.postMessage({ id, ...payload });
            }

            worker.on("message", (message) => {
                if (message.type === "result") {
                    results.push(message.data);
                } else if (message.type === "error") {
                    console.error(`Worker error: ${Utilities.getErrorMessage(message.error)}`)
                }

                processed++;
                onProgress?.(processed, total);
                dispatch();
            });

            worker.on("error", (error) => {
                console.log(`Worker crashed: ${Utilities.getErrorMessage(error)}`);
                dispatch();
            });

            dispatch();
        });

        await Promise.all(workers.map(run));
        await Promise.all(workers.map((worker) => worker.terminate()));

        return results;
    }
}
