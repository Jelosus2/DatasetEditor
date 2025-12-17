export class Utilities {
    static isStringNumeric(str: string): boolean {
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
}
