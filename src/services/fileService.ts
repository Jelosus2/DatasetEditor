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
}

