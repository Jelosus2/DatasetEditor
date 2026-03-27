import type { StyleCompareWSResponse } from "../types/tagger.js";
import type { TaggerWSPayload } from "../../shared/tagger.js";

import { App } from "../App.js";

export class APIClient {
    private static taggerWebsocket: WebSocket | null = null;
    private static styleCompareWebsocket: WebSocket | null = null;

    static async get<T>(url: string): Promise<[T, boolean, number]> {
        const response = await fetch(url);
        const data = await response.json() as T;

        return [data, response.ok, response.status];
    }

    static runTaggingWS(port: number, payload: TaggerWSPayload): Promise<Map<string, string[]>> {
        return new Promise((resolve, reject) => {
            const accumulator = new Map<string, Set<string>>();
            this.taggerWebsocket = new WebSocket(`ws://localhost:${port}`);

            this.taggerWebsocket.onopen = () => {
                this.taggerWebsocket?.send(JSON.stringify({
                    command: "tag",
                    ...payload
                }));
            }

            this.taggerWebsocket.onmessage = (event) => {
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
                    this.closeWSConnectionSafely(this.taggerWebsocket);
                    this.taggerWebsocket = null;
                }
            }

            this.taggerWebsocket.onerror = (error) => {
                this.taggerWebsocket!.onerror = null;
                this.taggerWebsocket!.onmessage = null;

                reject(error);
                this.closeWSConnectionSafely(this.taggerWebsocket);
                this.taggerWebsocket = null;
            }

            this.taggerWebsocket.onclose = () => {
                reject(new Error("Tagging was aborted"));
                this.taggerWebsocket = null;
            }
        });
    }

    static cancelTagging() {
        this.closeWSConnectionSafely(this.taggerWebsocket);
        this.taggerWebsocket = null;
    }

    static runStyleCompareWS(port: number, images: string[]): Promise<StyleCompareWSResponse> {
        return new Promise((resolve, reject) => {
            this.styleCompareWebsocket = new WebSocket(`ws://localhost:${port}`);

            this.styleCompareWebsocket.onopen = () => {
                this.styleCompareWebsocket?.send(JSON.stringify({
                    command: "compare_style",
                    images
                }));
            }

            this.styleCompareWebsocket.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === "progress")
                    return;

                if (data.error) {
                    reject(new Error(`${data.error}: ${data.details || "No details"}`));
                    this.closeWSConnectionSafely(this.styleCompareWebsocket);
                    this.styleCompareWebsocket = null;
                    return;
                }

                resolve(data);
                this.closeWSConnectionSafely(this.styleCompareWebsocket);
                this.styleCompareWebsocket = null;
            }

            this.styleCompareWebsocket.onerror = (error) => {
                this.styleCompareWebsocket!.onerror = null;
                this.styleCompareWebsocket!.onmessage = null;

                reject(error);
                this.closeWSConnectionSafely(this.styleCompareWebsocket);
                this.styleCompareWebsocket = null;
            }

            this.styleCompareWebsocket.onclose = () => {
                reject(new Error("Style comparison was aborted"));
                this.styleCompareWebsocket = null;
            }
        });
    }

    static cancelStyleCompare() {
        this.closeWSConnectionSafely(this.styleCompareWebsocket);
        this.styleCompareWebsocket = null;
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
                    reject(new Error(`${data.error}: ${data.details || "No details"}`));

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
