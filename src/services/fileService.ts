import { useIpcRenderer } from '@/composables/useIpcRenderer';

export interface TrashResult {
  error: boolean;
  message?: string;
}

export class FileService {
  private ipc = useIpcRenderer([]);

  async trashFiles(paths: string[]): Promise<TrashResult> {
    return (await this.ipc.invoke<TrashResult>('trash_files', paths)) as TrashResult;
  }

  async renameFiles(paths: string[], startAt: number): Promise<{ error: boolean; message?: string; renamed?: number; mappings?: { from: string; to: string; mtime: number }[] }>{
    return (await this.ipc.invoke<{ error: boolean; message?: string; renamed?: number; mappings?: { from: string; to: string; mtime: number }[] }>('rename_files', paths, startAt)) as { error: boolean; message?: string; renamed?: number; mappings?: { from: string; to: string; mtime: number }[] };
  }
}
