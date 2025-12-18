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

    static async processMap<T>(array: string[], mapper: (item: string) => Promise<T>): Promise<T[]> {
        const results: T[] = new Array(array.length);
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
