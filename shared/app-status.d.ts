export type AppStatusState = "start" | "progress" | "success" | "error";

export type AppStatusPayload = {
    id: string;
    title: string;
    message?: string;
    state: AppStatusState;
}
