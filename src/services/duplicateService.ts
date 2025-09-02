import { useIpcRenderer } from '@/composables/useIpcRenderer';

export type DuplicateMethod = 'dhash' | 'phash';

export interface DuplicateResult {
  error: boolean;
  message?: string;
  groups: string[][];
}

export class DuplicateService {
  private ipc = useIpcRenderer([]);

  async findDuplicates(files: string[], method: DuplicateMethod = 'dhash', threshold: number): Promise<DuplicateResult> {
    return (await this.ipc.invoke<DuplicateResult>('find_duplicates', files, method, threshold)) as DuplicateResult;
  }
}
