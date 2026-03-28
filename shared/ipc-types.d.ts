import type { Dataset, DatasetPersistable, DatasetRenameOptions, RenameProgressPayload, RenameMapping, RenamePreviewItem, GlobalTags } from "./dataset";
import type { TaggerModelsStatus, TaggerModelConfiguration, TaggerWSPayload, StyleCompareItem } from "./tagger";
import type { AppCloseRequestPayload, AppCloseResponsePayload } from "./app-close";
import type { DanbooruWikiPage, DanbooruPostPreview, Rating } from "./danbooru";
import type { SettingsDefinition, Settings } from "./settings-schema";
import type { CompletionItem } from "./autocompletion";
import type { AppStatusPayload } from "./app-status";
import type { Rect, DuplicateMethod } from "./image";
import type { TagGroups } from "./tag-groups";
import type { LogType } from "./log";

export type IpcInvokeMap = {
    "dataset:load": {
        args: [isAllSaved: boolean, reloadDataset: boolean];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
            dataset?: Dataset;
            globalTags?: GlobalTags;
        }
    }
    "dataset:save": {
        args: [dataset: DatasetPersistable];
        result: {
            error: boolean;
            message?: string;
        }
    }
    "dataset:compare": {
        args: [dataset: DatasetPersistable];
        result: boolean;
    }
    "dataset:trash": {
        args: [filePaths: string[]];
        result: {
            error: boolean;
            message: string;
        }
    }
    "dataset:rename": {
        args: [imagePaths: string[], options: DatasetRenameOptions];
        result: {
            error: boolean;
            message?: string;
            renamedCount?: number;
            mappings?: RenameMapping[];
            preview?: RenamePreviewItem[];
            conflicts?: number;
        }
    }
    "dataset:open_in_explorer": {
        args: [filePath: string];
        result: {
            error: boolean;
            message?: string;
        }
    }
    "tag_groups:load": {
        args: [];
        result: {
            error: boolean;
            message?: string;
            tagGroups?: TagGroups;
        }
    }
    "tag_groups:save": {
        args: [tagGroups: TagGroups];
        result: {
            error: boolean;
            message?: string;
        }
    }
    "tag_groups:import": {
        args: [];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
            tagGroups?: TagGroups;
        }
    }
    "tag_groups:export": {
        args: [tagGroups: TagGroups];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
        }
    }
    "tag_groups:compare": {
        args: [tagGroups: TagGroups];
        result: boolean;
    }
    "settings:get_schema": {
        args: [];
        result: SettingsDefinition[];
    }
    "settings:load": {
        args: [];
        result: Settings;
    }
    "settings:update": {
        args: [partial: Partial<Settings>];
        result: {
            error: boolean;
            message?: string;
            settings?: Settings;
        }
    }
    "settings:action": {
        args: [actionId: string];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
        }
    }
    "settings:pick_directory": {
        args: [];
        result: {
            canceled?: boolean;
            path?: string;
        }
    }
    "settings:validate_directory": {
        args: [path: string];
        result: {
            ok: boolean;
            message?: string;
        }
    }
    "utilities:open_url": {
        args: [url: string];
        result: void;
    }
    "utilities:restart_app": {
        args: [];
        result: void;
    }
    "update:check": {
        args: [];
        result: {
            error: boolean;
            isUpdateAvailable?: boolean;
            message?: string;
        };
    }
    "update:download": {
        args: [];
        result: {
            error: boolean;
            message?: string;
        };
    }
    "update:install": {
        args: [];
        result: void;
    }
    "update:availability": {
        args: [];
        result: boolean;
    }
    "tagger:load_models_config": {
        args: [];
        result: TaggerModelConfiguration;
    }
    "tagger:update_models_config": {
        args: [config: TaggerModelConfiguration];
        result: {
            error: boolean;
            message: string;
        }
    }
    "tagger:install": {
        args: [];
        result: {
            error: boolean;
            message?: string;
            stopped?: boolean;
        }
    }
    "tagger:uninstall": {
        args: [];
        result: {
            error: boolean;
            message?: string;
            stopped?: boolean;
        }
    }
    "tagger:start": {
        args: [];
        result: {
            error: boolean;
            message?: string;
            port?: number;
        }
    }
    "tagger:stop": {
        args: [];
        result: {
            error: boolean;
            message: string;
        }
    }
    "tagger:resize_terminal": {
        args: [columns: number, rows: number];
        result: void;
    }
    "tagger:get_device": {
        args: [];
        result: {
            error: boolean;
            message?: string;
            device?: string;
        }
    }
    "tagger:download_model": {
        args: [modelRepo: string, modelFile: string, tagsFile: string];
        result: {
            error: boolean;
            message: string;
            cacheSizeBytes?: number;
        }
    }
    "tagger:models_status": {
        args: [];
        result: {
            error: boolean;
            message?: string;
            status?: TaggerModelsStatus;
            cacheSizeBytes?: number;
        }
    }
    "tagger:delete_model": {
        args: [modelRepo: string];
        result: {
            error: boolean;
            success?: boolean;
            message: string;
            cacheSizeBytes?: number;
        }
    }
    "tagger:tag_images": {
        args: [payload: TaggerWSPayload, removeRedundantTags: boolean];
        result: {
            error: boolean;
            message: string;
            results?: Map<string, string[]>;
        }
    }
    "tagger:stop_tagging": {
        args: [];
        result: void;
    }
    "tagger:compare_style": {
        args: [images: string[]];
        result: {
            error: boolean;
            message?: string;
            folderCohesion?: number;
            results?: StyleCompareItem[];
        }
    }
    "tagger:stop_style_compare": {
        args: [];
        result: void;
    }
    "database:retrieve_completions": {
        args: [tagHint: string];
        result: CompletionItem[];
    }
    "danbooru:fetch_wiki": {
        args: [tag: string];
        result: {
            error: boolean;
            message?: string;
            data?: DanbooruWikiPage;
        }
    }
    "danbooru:fetch_posts": {
        args: [tag: string, rating: Rating];
        result: {
            error: boolean;
            message?: string;
            data?: DanbooruPostPreview[];
        }
    }
    "image:set_background": {
        args: [images: string[], color: string];
        result: {
            error: boolean;
            message: string;
        }
    }
    "image:crop": {
        args: [imagePath: string, cropRects: Rect[], overwrite: boolean];
        result: {
            error: boolean;
            canceled?: boolean;
            message?: string;
        }
    }
    "image:dimensions": {
        args: [imagePath: string];
        result: {
            width: number;
            height: number;
        }
    }
    "image:find_duplicates": {
        args: [imagePaths: string[], method: DuplicateMethod, threshold: number];
        result: {
            error: boolean;
            message?: string;
            groups: string[][];
        }
    }
}

export type IpcOnMap = {
    "app:log": {
        args: [{ type: LogType; message: string; }];
    }
    "app:status": {
        args: [AppStatusPayload];
    }
    "app:update_available": {
        args: [];
    }
    "app:update_progress": {
        args: [progress: number];
    }
    "app:update_downloaded": {
        args: [];
    }
    "app:update_error": {
        args: [];
    }
    "app:close_request": {
        args: [payload: AppCloseRequestPayload];
    }
    "app:close_response": {
        args: [payload: AppCloseResponsePayload];
    }
    "tagger:output": {
        args: [line: string];
    }
    "tagger:service_stopped": {
        args: [erroredOut: boolean];
    }
    "dataset:rename-progress": {
        args: [payload: RenameProgressPayload];
    }
    "image:duplicate-progress": {
        args: [{ processed: number; total: number; }];
    }
}
