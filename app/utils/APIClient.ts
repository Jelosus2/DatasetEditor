import type { TaggerWSPayload } from "../../shared/tagger.js";

import { App } from "../App.js";

export class APIClient {
    static websocket: WebSocket | null = null;

    static async get<T>(url: string): Promise<[T, boolean, number]> {
        const response = await fetch(url);
        const data = await response.json() as T;

        return [data, response.ok, response.status];
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
                const data = JSON.parse(event.data);

                if (data.type === "result") {
                    const file: string = data.file;
                    const tags: string[] = data.tags;

                    if (!accumulator.has(file))
                        accumulator.set(file, new Set());

                    const currentTags = accumulator.get(file)!;
                    tags.forEach((tag) => currentTags.add(tag));
                } else if (data.type === "error") {
                    App.logger.error(`[Tagger Manager] Tagger error from the websocket: ${data.error}: ${data.details || "No details"}`);
                } else if (data.type === "done") {
                    const results = new Map<string, string[]>();
                    for (const [file, tags] of accumulator)
                        results.set(file, Array.from(tags));

                    resolve(results);
                    this.closeWSConnectionSafely(this.websocket);
                }
            }

            this.websocket.onerror = (error) => {
                this.websocket!.onerror = null;
                this.websocket!.onmessage = null;

                reject(error);
                this.closeWSConnectionSafely(this.websocket);
            }

            this.websocket.onclose = () => {
                reject(new Error("Tagging was aborted"));
            }
        });
    }

    static cancelTagging() {
        this.closeWSConnectionSafely(this.websocket);
        this.websocket = null;
    }

    static sendCommandWS<T>(port: number, payload: unknown, timeout?: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const websocket = new WebSocket(`ws://localhost:${port}`);

            const _timeout = timeout ? setTimeout(() => {
                    reject(new Error("The response timed out"));
                    this.closeWSConnectionSafely(websocket);
                }, timeout) : null;

            websocket.onopen = () => websocket.send(JSON.stringify(payload));

            websocket.onmessage = (event) => {
                if (_timeout != null)
                    clearTimeout(_timeout);

                const data = JSON.parse(event.data);
                if (data.error)
                    reject(`${data.error}: ${data.details || "No details"}`);

                resolve(data);
                this.closeWSConnectionSafely(websocket);
            }

            websocket.onerror = (error) => {
                websocket.onerror = null;
                websocket.onmessage = null;

                if (_timeout != null)
                    clearTimeout(_timeout);

                reject(error);
                this.closeWSConnectionSafely(websocket);
            }

            websocket.onclose = (event) => {
                reject(new Error(`Connection to the service lost (Code: ${event.code})`));
            }
        });
    }

    private static closeWSConnectionSafely(websocket: WebSocket | null) {
        if (websocket && websocket.readyState < WebSocket.CLOSING)
            websocket.close();
    }
}
