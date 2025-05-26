import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const _dirname = (url) => dirname(fileURLToPath(url));
