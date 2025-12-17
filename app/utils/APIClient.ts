import http from "node:http";

export class APIClient {
    static async get<T>(url: string): Promise<[T, boolean, number]> {
        const response = await fetch(url);
        const data = await response.json();

        return [data, response.ok, response.status];
    }

    static async post<T>(url: string, body?: BodyInit, expectLongResponseTime?: boolean): Promise<[T, boolean, number]> {
        let data: T;
        let responseOk: boolean;
        let status: number;

        body = body ? JSON.stringify(body) : undefined;

        if (!expectLongResponseTime) {
            const response = await fetch(url, {
                method: 'POST',
                body,
                headers: {
                    "Content-Type": "application/json"
                }
            });

            data = await response.json();
            responseOk = response.ok;
            status = response.status;
        } else {
            const result = await this.postWithHttp<T>(url, body);

            data = result.data;
            responseOk = result.ok;
            status = result.status;
        }

        return [data, responseOk, status];
    }

    static async postWithHttp<T>(urlStr: string, body?: string): Promise<{ data: T, ok: boolean, status: number }> {
        const url = new URL(urlStr);
        body = body ?? "";

        const options: http.RequestOptions = {
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let rawData = '';
                res.setEncoding('utf-8');
                res.on('data', (chunk) => (rawData += chunk));
                res.on('end', () => {
                    const status = res.statusCode || 0;
                    const ok = status >= 200 && status < 300;
                    let data = {} as T;

                    try {
                        data = JSON.parse(rawData || "{}");
                    } catch (error: unknown) {
                        console.error("JSON Parse error:", error);
                    }

                    resolve({ data, ok, status })
                });
            });

            req.setTimeout(0);
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
}
