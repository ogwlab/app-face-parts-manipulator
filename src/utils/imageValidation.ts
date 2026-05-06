import type { ImageData } from '../types/face';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_RESOLUTION = 1920;
const SUPPORTED_FORMATS = new Set(['image/jpeg', 'image/png', 'image/jpg']);

export function validateImageFile(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    if (!SUPPORTED_FORMATS.has(file.type)) {
      reject(new Error('サポートされていないファイル形式です。JPEGまたはPNGファイルを選択してください。'));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE / 1024 / 1024}MB以下のファイルを選択してください。`));
      return;
    }

    const tempUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(tempUrl);

      if (width > MAX_RESOLUTION || height > MAX_RESOLUTION) {
        reject(new Error(`画像の解像度が大きすぎます。${MAX_RESOLUTION}px以下の画像を選択してください。`));
        return;
      }

      resolve({
        file,
        url: URL.createObjectURL(file),
        width,
        height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('画像ファイルの読み込みに失敗しました。'));
    };

    img.src = tempUrl;
  });
}
