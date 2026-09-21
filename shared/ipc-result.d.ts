export type IpcError = {
    error: true;
    message: string;
};

export type IpcResult<
    TSuccess extends object = Record<never, never>,
    TFailure extends object = Record<never, never>
> =
    | ({
        error: false;
    } & TSuccess)
    | (IpcError & TFailure);

export type CancelableIpcResult<T extends object = Record<never, never>> =
    | ({
        error: false;
        canceled?: false;
    } & T)
    | {
        error: false;
        canceled: true;
    }
    | IpcError;

export type IpcSelectionResult<T extends object> =
    | ({
        canceled?: false;
    } & T)
    | {
        canceled: true;
    };

export type IpcValidationResult =
    | {
        ok: true;
    }
    | {
        ok: false;
        message: string;
    };

export type StoppableIpcResult<TSuccess extends object = Record<never, never>> =
    | ({
        stopped?: false;
    } & IpcResult<TSuccess>)
    | {
        stopped: true;
    };

export type AbortableIpcResult<TSuccess extends object> =
    | ({
        aborted?: false;
    } & IpcResult<TSuccess>)
    | {
        error: false;
        aborted: true;
        message: string;
    };
