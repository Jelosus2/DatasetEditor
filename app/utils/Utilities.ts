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

    static formatTagOutput(tag: string, results: string) {
        const numResults = parseInt(results, 10);
        let text = tag;

        if (numResults >= 1_000_000) {
            text += ` (${(numResults / 1_000_000).toFixed(1).replace('.0', '')}m)`;
        } else if (numResults >= 1000) {
            text += ` (${(numResults / 1000).toFixed(1).replace('.0', '')}k)`;
        } else {
            text += ` (${numResults})`;
        }

        return text;
    }

    static getErrorMessage(error: unknown) {
        if (error instanceof Error)
            return error.message;

        return String(error);
    }

    static async processMap<I, O>(array: I[], mapper: (item: I) => Promise<O>, concurrency: number = os.availableParallelism()): Promise<O[]> {
        const results: O[] = new Array(array.length);
        const queue = array.map((item, index) => ({ item, index }));
        const worker = async () => {
            while (queue.length > 0) {
                const entry = queue.shift();
                if (entry) {
                    const result = await mapper(entry.item);
                    results[entry.index] = result;
                }
            }
        }

        await Promise.all(Array.from({ length: os.availableParallelism() }, worker));
        return results;
    }
}
