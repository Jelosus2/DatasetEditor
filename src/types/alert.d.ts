export type AlertItem = {
    type: AlertType;
    message: string;
    duration: number;
}

export type AlertType = "success" | "error" | "warning" | "info";
