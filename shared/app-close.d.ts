export type AppCloseAction = "check" | "save";

export type AppCloseRequestPayload = {
    requestId: number;
    action: AppCloseAction;
}

export type AppCloseResponsePayload = {
    requestId: number;
    allSaved: boolean;
    error?: string;
}
