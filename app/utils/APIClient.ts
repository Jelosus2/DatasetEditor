import type { TaggerWSPayload } from "../types/tagger.js";
import { App } from "../App.js";

export class APIClient {
    static websocket: WebSocket | null = null;

    static async get<T>(url: string): Promise<[T, boolean, number]> {
        const response = await fetch(url);
        const data = await response.json() as T;

        return [data, response.ok, response.status];
    }

    static getTaggerDeviceWS(port: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const websocket = new WebSocket(`ws://localhost:${port}`);

            const timeout = setTimeout(() => {
                websocket.close()
                reject(new Error("Timeout waiting for tagger device info"));
            }, 10000);

            websocket.onopen = () => {
                websocket.send(JSON.stringify({ command: "device" }));
            }

            websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === "info" && message.device) {
                    clearTimeout(timeout);
                    websocket.close();
                    resolve(message.device);
                }
            }

            websocket.onerror = (error) => {
                clearTimeout(timeout);
                websocket.close();
                reject(error);
            }
        });
    }

    static runTaggingWS(port: number, payload: TaggerWSPayload): Promise<Map<string, string[]>> {
        return new Promise((resolve, reject) => {
            const accumulator = new Map<string, Set<string>>();
            this.websocket = new WebSocket(`ws://localhost:${port}`);

            this.websocket.onopen = () => {
                this.websocket?.send(JSON.stringify({
                    command: "tag",
                    ...payload
                }));
            }

            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);

                if (message.type === "result") {
                    const file: string = message.file;
                    const tags: string[] = message.tags;

                    if (!accumulator.has(file))
                        accumulator.set(file, new Set());

                    const currentTags = accumulator.get(file)!;
                    tags.forEach((tag) => currentTags.add(tag));
                } else if (message.type === "error") {
                    App.logger.error(`[Tagger Manager] Tagger error from the websocket: ${message.error}`);
                } else if (message.type === "done") {
                    this.websocket?.close();

                    const results = new Map<string, string[]>();
                    for (const [file, tags] of accumulator)
                        results.set(file, Array.from(tags));

                    resolve(results);
                }
            }

            this.websocket.onerror = (error) => {
                this.websocket?.close();
                reject(error);
            }
        });
    }

    static cancelTagging() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }
}
