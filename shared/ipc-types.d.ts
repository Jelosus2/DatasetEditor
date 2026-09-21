import type { Dataset, DatasetPersistable, DatasetRenameOptions, RenameProgressPayload, RenameMapping, RenamePreviewItem, GlobalTags } from "./dataset.js";
import type { IpcResult, CancelableIpcResult, IpcSelectionResult, IpcValidationResult, StoppableIpcResult, AbortableIpcResult } from "./ipc-result.js";
import type { TaggerModelsStatus, TaggerModelConfiguration, TaggerWSPayload, StyleCompareItem } from "./tagger.js";
import type { SettingsDefinition, SettingsActionId, Settings } from "./settings-schema.js";
import type { AppCloseRequestPayload, AppCloseResponsePayload } from "./app-close.js";
import type { DanbooruWikiPage, DanbooruPostPreview, Rating } from "./danbooru.js";
import type { CompletionItem } from "./autocompletion.js";
import type { AppStatusPayload } from "./app-status.js";
import type { Rect, DuplicateMethod } from "./image.js";
import type { WhatsNewPayload } from "./whats-new.js";
import type { TagGroups } from "./tag-groups.js";
import type { LogType } from "./log.js";

export type IpcInvokeMap = {
    "dataset:load": {
        args: [isAllSaved: boolean, reloadDataset: boolean, lastDirectory: string | null];
        result: CancelableIpcResult<{
            directoryPath: string;
            dataset: Dataset;
            globalTags: GlobalTags;
        }>;
    }
    "dataset:save": {
        args: [dataset: DatasetPersistable];
        result: IpcResult;
    }
    "dataset:compare": {
        args: [dataset: DatasetPersistable];
        result: boolean;
    }
    "dataset:trash": {
        args: [filePaths: string[]];
        result: IpcResult<{
            message: string;
        }>;
    }
    "dataset:rename": {
        args: [imagePaths: string[], options: DatasetRenameOptions];
        result: IpcResult<
            | {
                renamedCount: 0;
                preview: RenamePreviewItem[];
                conflicts: number;
                mappings?: never;
            }
            | {
                renamedCount: number;
                mappings: RenameMapping[];
                preview: RenamePreviewItem[];
                conflicts: 0;
            },
            {
                preview: RenamePreviewItem[];
                conflicts: number;
            }
        >;
    }
    "dataset:open_in_explorer": {
        args: [filePath: string];
        result: IpcResult;
    }
    "tag_groups:load": {
        args: [];
        result: IpcResult<{
            tagGroups: TagGroups;
        }>;
    }
    "tag_groups:save": {
        args: [tagGroups: TagGroups];
        result: IpcResult;
    }
    "tag_groups:import": {
        args: [];
        result: CancelableIpcResult<{
            tagGroups: TagGroups;
        }>;
    }
    "tag_groups:export": {
        args: [tagGroups: TagGroups];
        result: CancelableIpcResult;
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
        result: IpcResult<{
            settings: Settings;
        }>;
    }
    "settings:action": {
        args: [actionId: SettingsActionId];
        result: CancelableIpcResult<{
            message: string;
        }>;
    }
    "settings:pick_directory": {
        args: [];
        result: IpcSelectionResult<{
            path: string;
        }>;
    }
    "settings:validate_directory": {
        args: [path: string];
        result: IpcValidationResult;
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
        result: IpcResult<{
            isUpdateAvailable: boolean;
        }>;
    }
    "update:download": {
        args: [];
        result: IpcResult;
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
        result: IpcResult<{
            message: string;
        }>;
    }
    "tagger:install": {
        args: [];
        result: StoppableIpcResult<{
            message: string;
        }>;
    }
    "tagger:uninstall": {
        args: [];
        result: StoppableIpcResult<{
            message: string;
        }>;
    }
    "tagger:start": {
        args: [];
        result: IpcResult<{
            port: number;
        }>;
    }
    "tagger:stop": {
        args: [];
        result: IpcResult<{
            message: string;
        }>;
    }
    "tagger:resize_terminal": {
        args: [columns: number, rows: number];
        result: void;
    }
    "tagger:get_device": {
        args: [];
        result: IpcResult<{
            device: string;
        }>;
    }
    "tagger:download_model": {
        args: [modelRepo: string, modelFile: string, tagsFile: string];
        result: IpcResult<{
            message: string;
            cacheSizeBytes: number;
        }>;
    }
    "tagger:models_status": {
        args: [];
        result: IpcResult<{
            status: TaggerModelsStatus;
            cacheSizeBytes: number;
        }>;
    }
    "tagger:delete_model": {
        args: [modelRepo: string];
        result: IpcResult<{
            success: boolean;
            message: string;
            cacheSizeBytes: number;
        }>;
    }
    "tagger:tag_images": {
        args: [payload: TaggerWSPayload, removeRedundantTags: boolean];
        result: AbortableIpcResult<{
            message: string;
            results: Map<string, string[]>;
        }>;
    }
    "tagger:stop_tagging": {
        args: [];
        result: void;
    }
    "tagger:compare_style": {
        args: [images: string[]];
        result: AbortableIpcResult<{
            folderCohesion: number;
            results: StyleCompareItem[];
        }>;
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
        result: IpcResult<{
            data: DanbooruWikiPage;
        }>;
    }
    "danbooru:fetch_posts": {
        args: [tag: string, rating: Rating];
        result: IpcResult<{
            data: DanbooruPostPreview[];
        }>;
    }
    "image:set_background": {
        args: [images: string[], color: string];
        result: IpcResult<{
            message: string;
        }>;
    }
    "image:crop": {
        args: [imagePath: string, cropRects: Rect[], overwrite: boolean];
        result: CancelableIpcResult<{
            message: string;
        }>;
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
        result: IpcResult<{
            groups: string[][];
        }>;
    }
    "whats_new:get": {
        args: [];
        result: IpcResult<{
            payload: WhatsNewPayload;
        }>;
    }
    "whats_new:mark_seen": {
        args: [];
        result: IpcResult;
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
