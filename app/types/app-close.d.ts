export type PendingCloseRequest = {
    resolve: (payload: AppCloseResponsePayload) => void;
    timeout: ReturnType<typeof setTimeout>;
}
