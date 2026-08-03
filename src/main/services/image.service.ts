import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE_BYTES } from '../../shared/constants';
import type { ImageSelectResult } from '../../shared/types';
import { getImagesDir, sanitizeFileName, toAppImageUrl, toFileUrl } from '../utils/paths';

export async function selectAndStoreImage(prefix = 'product'): Promise<ImageSelectResult | null> {
  const result = await dialog.showOpenDialog({
    title: 'Selecionar imagem',
    filters: [
      {
        name: 'Imagens',
        extensions: ALLOWED_IMAGE_EXTENSIONS.map((ext) => ext.replace('.', '')),
      },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath).toLowerCase();

  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])) {
    throw new Error('Formato de imagem não permitido. Use JPG, PNG, WEBP ou GIF.');
  }

  const stats = fs.statSync(sourcePath);
  if (stats.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  const baseName = sanitizeFileName(path.basename(sourcePath, ext));
  const fileName = `${prefix}_${Date.now()}_${baseName}${ext}`;
  const destination = path.join(getImagesDir(), fileName);
  fs.copyFileSync(sourcePath, destination);

  return {
    relativePath: fileName,
    absolutePath: destination,
    url: toAppImageUrl(fileName) ?? toFileUrl(destination) ?? '',
  };
}
