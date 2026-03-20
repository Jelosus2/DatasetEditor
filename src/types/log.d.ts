import type { LogType } from "../../shared/log";

export type LogEntry = {
    timestamp: Date;
    type: LogType;
    message: string;
}
