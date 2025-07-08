/**
 * 画像処理堅牢性システム
 * 
 * 画像の読み込み、検証、変換、EXIF処理などを安全に行うためのシステム
 */

import ErrorHandlingManager, { ErrorType } from './errorHandling';

// 画像メタデータ
export interface ImageMetadata {
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  orientation?: number;
  hasEXIF: boolean;
  colorSpace?: string;
  bitDepth?: number;
  created?: Date;
  modified?: Date;
  deviceMake?: string;
  deviceModel?: string;
  software?: string;
  quality?: number;
}

// EXIF方向値
export enum ExifOrientation {
  NORMAL = 1,
  FLIP_HORIZONTAL = 2,
  ROTATE_180 = 3,
  FLIP_VERTICAL = 4,
  ROTATE_90_CW_FLIP = 5,
  ROTATE_90_CW = 6,
  ROTATE_90_CCW_FLIP = 7,
  ROTATE_90_CCW = 8
}

// 画像処理オプション
export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maintainAspectRatio?: boolean;
  autoCorrectOrientation?: boolean;
  validateIntegrity?: boolean;
  sanitizeMetadata?: boolean;
}

/**
 * 画像整合性バリデーター
 */
export class ImageValidator {
  private static readonly MAGIC_NUMBERS = {
    JPEG: [0xFF, 0xD8, 0xFF],
    PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    WEBP: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    GIF: [0x47, 0x49, 0x46] // "GIF"
  };

  /**
   * ファイルヘッダーによる形式検証
   */
  static async validateImageFormat(file: File): Promise<{
    isValid: boolean;
    detectedFormat: string | null;
    declaredFormat: string;
  }> {
    try {
      const arrayBuffer = await file.slice(0, 20).arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      let detectedFormat: string | null = null;
      
      // JPEG検証
      if (this.matchesSignature(bytes, this.MAGIC_NUMBERS.JPEG)) {
        detectedFormat = 'image/jpeg';
      }
      // PNG検証
      else if (this.matchesSignature(bytes, this.MAGIC_NUMBERS.PNG)) {
        detectedFormat = 'image/png';
      }
      // WEBP検証
      else if (this.matchesSignature(bytes, this.MAGIC_NUMBERS.WEBP)) {
        // WEBPの場合、8-11バイト目に"WEBP"があることを確認
        if (bytes.length >= 12) {
          const webpSignature = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
          if (this.matchesSignature(bytes.slice(8), webpSignature)) {
            detectedFormat = 'image/webp';
          }
        }
      }
      // GIF検証
      else if (this.matchesSignature(bytes, this.MAGIC_NUMBERS.GIF)) {
        detectedFormat = 'image/gif';
      }

      const declaredFormat = file.type;
      const isValid = detectedFormat === declaredFormat;

      return {
        isValid,
        detectedFormat,
        declaredFormat
      };
    } catch (error) {
      throw new Error(`画像形式の検証に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * バイト配列がシグネチャにマッチするかチェック
   */
  private static matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
    if (bytes.length < signature.length) return false;
    
    for (let i = 0; i < signature.length; i++) {
      if (bytes[i] !== signature[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 画像の破損チェック
   */
  static async validateImageIntegrity(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      let timeoutId: number | null = null;
      let resolved = false;

      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        URL.revokeObjectURL(url);
      };

      const resolveOnce = (value: boolean) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(value);
        }
      };

      img.onload = () => {
        // 画像が正常に読み込まれ、サイズが妥当であれば整合性OK
        resolveOnce(img.naturalWidth > 0 && img.naturalHeight > 0);
      };

      img.onerror = () => {
        resolveOnce(false);
      };

      // タイムアウト設定（10秒）
      timeoutId = window.setTimeout(() => {
        resolveOnce(false);
      }, 10000);

      img.src = url;
    });
  }

  /**
   * セキュリティチェック
   */
  static async performSecurityCheck(file: File): Promise<{
    isSafe: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // ファイルサイズチェック
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      issues.push(`ファイルサイズが大きすぎます（最大${maxSize / 1024 / 1024}MB）`);
    }

    // ファイル名チェック（悪意のある文字の検出）
    const suspiciousPatterns = [
      /\.(exe|bat|cmd|com|pif|scr|vbs|js)$/i,
      /[<>:"\/\\|?*]/,
      /\x00-\x1f/
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(file.name)) {
        issues.push('ファイル名に不正な文字または拡張子が含まれています');
        break;
      }
    }

    // MIME type vs 拡張子の整合性チェック
    const extension = file.name.toLowerCase().split('.').pop();
    const expectedMimeTypes: Record<string, string[]> = {
      'jpg': ['image/jpeg'],
      'jpeg': ['image/jpeg'],
      'png': ['image/png'],
      'gif': ['image/gif'],
      'webp': ['image/webp']
    };

    if (extension && expectedMimeTypes[extension]) {
      if (!expectedMimeTypes[extension].includes(file.type)) {
        issues.push('ファイル拡張子とMIME typeが一致しません');
      }
    }

    return {
      isSafe: issues.length === 0,
      issues
    };
  }
}

/**
 * EXIF処理システム
 */
export class EXIFProcessor {
  /**
   * EXIFデータを抽出
   */
  static async extractEXIF(file: File): Promise<ImageMetadata> {
    const metadata: ImageMetadata = {
      width: 0,
      height: 0,
      fileSize: file.size,
      mimeType: file.type,
      hasEXIF: false
    };

    try {
      // 基本的な画像情報を取得
      const imageInfo = await this.getBasicImageInfo(file);
      metadata.width = imageInfo.width;
      metadata.height = imageInfo.height;

      // JPEG の場合のみEXIF処理
      if (file.type === 'image/jpeg') {
        const exifData = await this.parseJPEGEXIF(file);
        if (exifData) {
          metadata.hasEXIF = true;
          metadata.orientation = exifData.orientation;
          metadata.deviceMake = exifData.make;
          metadata.deviceModel = exifData.model;
          metadata.software = exifData.software;
          metadata.created = exifData.dateTime;
        }
      }

      return metadata;
    } catch (error) {
      console.warn('EXIF データの抽出に失敗しました:', error);
      return metadata;
    }
  }

  /**
   * 基本的な画像情報を取得
   */
  private static async getBasicImageInfo(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = url;
    });
  }

  /**
   * JPEG EXIFデータを解析
   */
  private static async parseJPEGEXIF(file: File): Promise<any | null> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const dataView = new DataView(arrayBuffer);

      // JPEG SOI マーカー確認
      if (dataView.getUint16(0) !== 0xFFD8) {
        return null;
      }

      let offset = 2;
      
      // APP1 セグメント（EXIF）を探す
      while (offset < dataView.byteLength - 1) {
        const marker = dataView.getUint16(offset);
        
        if (marker === 0xFFE1) { // APP1 marker
          const segmentLength = dataView.getUint16(offset + 2);
          const segmentData = new DataView(arrayBuffer, offset + 4, segmentLength - 2);
          
          // "Exif\0\0" ヘッダーを確認
          if (this.readString(segmentData, 0, 4) === 'Exif') {
            return this.parseEXIFSegment(segmentData);
          }
        }
        
        if ((marker & 0xFF00) !== 0xFF00) break;
        
        const segmentLength = dataView.getUint16(offset + 2);
        offset += 2 + segmentLength;
      }

      return null;
    } catch (error) {
      console.warn('EXIF解析エラー:', error);
      return null;
    }
  }

  /**
   * EXIFセグメントを解析
   */
  private static parseEXIFSegment(dataView: DataView): any {
    try {
      // TIFF ヘッダー開始位置（"Exif\0\0" の後）
      const tiffOffset = 6;
      
      // エンディアンチェック
      const endian = dataView.getUint16(tiffOffset);
      const isLittleEndian = endian === 0x4949; // "II"
      
      // TIFF マジックナンバー確認
      const magic = isLittleEndian ? 
        dataView.getUint16(tiffOffset + 2, true) : 
        dataView.getUint16(tiffOffset + 2, false);
      
      if (magic !== 0x002A) {
        return null;
      }

      // IFD0 オフセット
      const ifd0Offset = isLittleEndian ?
        dataView.getUint32(tiffOffset + 4, true) :
        dataView.getUint32(tiffOffset + 4, false);

      return this.parseIFD(dataView, tiffOffset + ifd0Offset, isLittleEndian);
    } catch (error) {
      console.warn('EXIFセグメント解析エラー:', error);
      return null;
    }
  }

  /**
   * IFD（Image File Directory）を解析
   */
  private static parseIFD(dataView: DataView, offset: number, isLittleEndian: boolean): any {
    const result: any = {};

    try {
      const entryCount = isLittleEndian ?
        dataView.getUint16(offset, true) :
        dataView.getUint16(offset, false);

      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 2 + (i * 12);
        
        const tag = isLittleEndian ?
          dataView.getUint16(entryOffset, true) :
          dataView.getUint16(entryOffset, false);

        const type = isLittleEndian ?
          dataView.getUint16(entryOffset + 2, true) :
          dataView.getUint16(entryOffset + 2, false);

        const count = isLittleEndian ?
          dataView.getUint32(entryOffset + 4, true) :
          dataView.getUint32(entryOffset + 4, false);

        // よく使用されるタグのみ解析
        switch (tag) {
          case 0x0112: // Orientation
            if (type === 3 && count === 1) { // SHORT
              result.orientation = isLittleEndian ?
                dataView.getUint16(entryOffset + 8, true) :
                dataView.getUint16(entryOffset + 8, false);
            }
            break;
          case 0x010F: // Make
            result.make = this.readStringValue(dataView, entryOffset + 8, count, type, isLittleEndian);
            break;
          case 0x0110: // Model
            result.model = this.readStringValue(dataView, entryOffset + 8, count, type, isLittleEndian);
            break;
          case 0x0131: // Software
            result.software = this.readStringValue(dataView, entryOffset + 8, count, type, isLittleEndian);
            break;
          case 0x0132: // DateTime
            const dateTimeStr = this.readStringValue(dataView, entryOffset + 8, count, type, isLittleEndian);
            if (dateTimeStr) {
              result.dateTime = this.parseDateTime(dateTimeStr);
            }
            break;
        }
      }
    } catch (error) {
      console.warn('IFD解析エラー:', error);
    }

    return result;
  }

  /**
   * 文字列値を読み取り
   */
  private static readStringValue(
    dataView: DataView, 
    offset: number, 
    count: number, 
    type: number, 
    isLittleEndian: boolean
  ): string | null {
    try {
      if (type !== 2) return null; // ASCII type only
      
      let stringOffset = offset;
      if (count > 4) {
        // 値が4バイトを超える場合はオフセットを参照
        stringOffset = isLittleEndian ?
          dataView.getUint32(offset, true) :
          dataView.getUint32(offset, false);
      }

      return this.readString(dataView, stringOffset, Math.min(count - 1, 100)); // NULL終端を除く
    } catch (error) {
      return null;
    }
  }

  /**
   * 文字列を読み取り
   */
  private static readString(dataView: DataView, offset: number, length: number): string {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      const byte = dataView.getUint8(offset + i);
      if (byte === 0) break; // NULL終端
      bytes.push(byte);
    }
    return String.fromCharCode(...bytes);
  }

  /**
   * EXIF日時文字列を解析
   */
  private static parseDateTime(dateTimeStr: string): Date | undefined {
    try {
      // EXIF日時形式: "YYYY:MM:DD HH:MM:SS"
      const match = dateTimeStr.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (!match) return undefined;

      return new Date(
        parseInt(match[1]), // year
        parseInt(match[2]) - 1, // month (0-based)
        parseInt(match[3]), // day
        parseInt(match[4]), // hour
        parseInt(match[5]), // minute
        parseInt(match[6])  // second
      );
    } catch (error) {
      return undefined;
    }
  }

  /**
   * 方向に基づいて画像を回転
   */
  static async correctOrientation(
    imageElement: HTMLImageElement, 
    orientation: ExifOrientation
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Canvas 2D context の取得に失敗しました');
    }

    const { width: origWidth, height: origHeight } = imageElement;

    // 方向に応じてcanvasサイズと変換を設定
    switch (orientation) {
      case ExifOrientation.NORMAL:
        canvas.width = origWidth;
        canvas.height = origHeight;
        ctx.drawImage(imageElement, 0, 0);
        break;
        
      case ExifOrientation.FLIP_HORIZONTAL:
        canvas.width = origWidth;
        canvas.height = origHeight;
        ctx.scale(-1, 1);
        ctx.drawImage(imageElement, -origWidth, 0);
        break;
        
      case ExifOrientation.ROTATE_180:
        canvas.width = origWidth;
        canvas.height = origHeight;
        ctx.rotate(Math.PI);
        ctx.drawImage(imageElement, -origWidth, -origHeight);
        break;
        
      case ExifOrientation.FLIP_VERTICAL:
        canvas.width = origWidth;
        canvas.height = origHeight;
        ctx.scale(1, -1);
        ctx.drawImage(imageElement, 0, -origHeight);
        break;
        
      case ExifOrientation.ROTATE_90_CW_FLIP:
        canvas.width = origHeight;
        canvas.height = origWidth;
        ctx.rotate(Math.PI / 2);
        ctx.scale(1, -1);
        ctx.drawImage(imageElement, 0, -origHeight);
        break;
        
      case ExifOrientation.ROTATE_90_CW:
        canvas.width = origHeight;
        canvas.height = origWidth;
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(imageElement, 0, -origHeight);
        break;
        
      case ExifOrientation.ROTATE_90_CCW_FLIP:
        canvas.width = origHeight;
        canvas.height = origWidth;
        ctx.rotate(-Math.PI / 2);
        ctx.scale(1, -1);
        ctx.drawImage(imageElement, -origWidth, 0);
        break;
        
      case ExifOrientation.ROTATE_90_CCW:
        canvas.width = origHeight;
        canvas.height = origWidth;
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(imageElement, -origWidth, 0);
        break;
        
      default:
        canvas.width = origWidth;
        canvas.height = origHeight;
        ctx.drawImage(imageElement, 0, 0);
    }

    return canvas;
  }
}

/**
 * 画像リサイズ・最適化システム
 */
export class ImageOptimizer {
  /**
   * 画像をリサイズ
   */
  static async resizeImage(
    imageElement: HTMLImageElement,
    options: ImageProcessingOptions
  ): Promise<HTMLCanvasElement> {
    const {
      maxWidth = 4000,
      maxHeight = 4000,
      quality = 0.9,
      maintainAspectRatio = true
    } = options;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Canvas 2D context の取得に失敗しました');
    }

    const { naturalWidth: origWidth, naturalHeight: origHeight } = imageElement;

    // 新しいサイズを計算
    let { width: newWidth, height: newHeight } = this.calculateNewSize(
      origWidth,
      origHeight,
      maxWidth,
      maxHeight,
      maintainAspectRatio
    );

    canvas.width = newWidth;
    canvas.height = newHeight;

    // 高品質リサイズのための設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 段階的リサイズ（大幅なサイズ変更の場合）
    const scaleRatio = Math.min(newWidth / origWidth, newHeight / origHeight);
    
    if (scaleRatio < 0.5) {
      // 2段階でリサイズ
      const intermediateCanvas = document.createElement('canvas');
      const intermediateCtx = intermediateCanvas.getContext('2d')!;
      
      const intermediateWidth = Math.floor(origWidth * 0.5);
      const intermediateHeight = Math.floor(origHeight * 0.5);
      
      intermediateCanvas.width = intermediateWidth;
      intermediateCanvas.height = intermediateHeight;
      intermediateCtx.imageSmoothingEnabled = true;
      intermediateCtx.imageSmoothingQuality = 'high';
      
      // 第1段階
      intermediateCtx.drawImage(imageElement, 0, 0, intermediateWidth, intermediateHeight);
      
      // 第2段階
      ctx.drawImage(intermediateCanvas, 0, 0, newWidth, newHeight);
    } else {
      // 1段階でリサイズ
      ctx.drawImage(imageElement, 0, 0, newWidth, newHeight);
    }

    return canvas;
  }

  /**
   * 新しいサイズを計算
   */
  private static calculateNewSize(
    origWidth: number,
    origHeight: number,
    maxWidth: number,
    maxHeight: number,
    maintainAspectRatio: boolean
  ): { width: number; height: number } {
    if (!maintainAspectRatio) {
      return {
        width: Math.min(origWidth, maxWidth),
        height: Math.min(origHeight, maxHeight)
      };
    }

    const aspectRatio = origWidth / origHeight;
    
    let newWidth = origWidth;
    let newHeight = origHeight;

    // 幅の制限をチェック
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / aspectRatio;
    }

    // 高さの制限をチェック
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }

    return {
      width: Math.floor(newWidth),
      height: Math.floor(newHeight)
    };
  }

  /**
   * メモリ効率的な画像変換
   */
  static async optimizeForMemory(
    file: File,
    maxMemoryUsage: number = 100 * 1024 * 1024 // 100MB
  ): Promise<{ optimizedFile: File; metadata: ImageMetadata }> {
    // メタデータを取得
    const metadata = await EXIFProcessor.extractEXIF(file);
    
    // 推定メモリ使用量を計算（RGBA: 4 bytes per pixel）
    const estimatedMemory = metadata.width * metadata.height * 4;
    
    if (estimatedMemory <= maxMemoryUsage) {
      return { optimizedFile: file, metadata };
    }

    // メモリ制限を超える場合はリサイズ
    const maxPixels = maxMemoryUsage / 4;
    const scale = Math.sqrt(maxPixels / (metadata.width * metadata.height));
    
    const maxWidth = Math.floor(metadata.width * scale);
    const maxHeight = Math.floor(metadata.height * scale);

    // 画像を読み込み
    const imageElement = await this.loadImageFromFile(file);
    
    // リサイズ
    const resizedCanvas = await this.resizeImage(imageElement, {
      maxWidth,
      maxHeight,
      quality: 0.8
    });

    // ファイルに変換
    const optimizedFile = await this.canvasToFile(resizedCanvas, file.type, 0.8);
    
    // 新しいメタデータを作成
    const optimizedMetadata: ImageMetadata = {
      ...metadata,
      width: resizedCanvas.width,
      height: resizedCanvas.height,
      fileSize: optimizedFile.size
    };

    return { optimizedFile, metadata: optimizedMetadata };
  }

  /**
   * ファイルから画像要素を作成
   */
  private static async loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = url;
    });
  }

  /**
   * Canvasをファイルに変換
   */
  private static async canvasToFile(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality: number
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas の変換に失敗しました'));
          return;
        }
        
        const file = new File([blob], 'optimized-image', {
          type: mimeType,
          lastModified: Date.now()
        });
        
        resolve(file);
      }, mimeType, quality);
    });
  }
}

/**
 * 統合画像処理システム
 */
export class RobustImageProcessor {
  private errorManager: ErrorHandlingManager | null = null;

  constructor() {
    this.initializeErrorManager();
  }

  /**
   * エラーマネージャー初期化
   */
  private async initializeErrorManager(): Promise<void> {
    try {
      this.errorManager = ErrorHandlingManager.getInstance();
      await this.errorManager.initialize();
    } catch (error) {
      console.warn('エラーマネージャーの初期化に失敗しました:', error);
    }
  }

  /**
   * 包括的画像検証・処理
   */
  async processImage(
    file: File,
    options: ImageProcessingOptions = {}
  ): Promise<{
    processedImage: HTMLImageElement;
    metadata: ImageMetadata;
    canvas?: HTMLCanvasElement;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      // セキュリティチェック
      const securityCheck = await ImageValidator.performSecurityCheck(file);
      if (!securityCheck.isSafe) {
        throw new Error(`セキュリティチェック失敗: ${securityCheck.issues.join(', ')}`);
      }

      // 画像形式検証
      const formatValidation = await ImageValidator.validateImageFormat(file);
      if (!formatValidation.isValid) {
        warnings.push(`ファイル形式の不整合: 宣言=${formatValidation.declaredFormat}, 検出=${formatValidation.detectedFormat}`);
      }

      // 整合性チェック
      if (options.validateIntegrity) {
        const isIntegrityValid = await ImageValidator.validateImageIntegrity(file);
        if (!isIntegrityValid) {
          throw new Error('画像ファイルが破損しています');
        }
      }

      // メタデータ抽出
      const metadata = await EXIFProcessor.extractEXIF(file);

      // メモリ効率化
      const memoryInfo = this.errorManager ? await this.errorManager.monitorMemory() : null;
      let processedFile = file;
      
      if (memoryInfo?.isLowMemory) {
        const optimized = await ImageOptimizer.optimizeForMemory(file);
        processedFile = optimized.optimizedFile;
        warnings.push('メモリ不足のため画像を最適化しました');
      }

      // 画像要素を作成
      const imageElement = await this.loadImageElement(processedFile);

      // EXIF方向補正
      let canvas: HTMLCanvasElement | undefined;
      if (options.autoCorrectOrientation && metadata.orientation && metadata.orientation !== ExifOrientation.NORMAL) {
        canvas = await EXIFProcessor.correctOrientation(imageElement, metadata.orientation);
        warnings.push('EXIF方向情報に基づいて画像を回転しました');
      }

      // サイズ制限チェック・リサイズ
      if (options.maxWidth || options.maxHeight) {
        const needsResize = 
          (options.maxWidth && imageElement.naturalWidth > options.maxWidth) ||
          (options.maxHeight && imageElement.naturalHeight > options.maxHeight);

        if (needsResize) {
          canvas = await ImageOptimizer.resizeImage(imageElement, options);
          warnings.push('サイズ制限によりリサイズしました');
        }
      }

      return {
        processedImage: imageElement,
        metadata,
        canvas,
        warnings
      };

    } catch (error) {
      if (this.errorManager) {
        await this.errorManager.reportError(
          error instanceof Error ? error : new Error(String(error)),
          'image-processing'
        );
      }
      throw error;
    }
  }

  /**
   * ファイルから画像要素を作成
   */
  private async loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像の読み込みに失敗しました'));
      };

      // タイムアウト設定
      setTimeout(() => {
        URL.revokeObjectURL(url);
        reject(new Error('画像読み込みタイムアウト'));
      }, 30000);

      img.src = url;
    });
  }
}

// グローバルインスタンス
export const globalImageProcessor = new RobustImageProcessor();

// エクスポート
export default {
  ImageValidator,
  EXIFProcessor,
  ImageOptimizer,
  RobustImageProcessor,
  globalImageProcessor,
  ExifOrientation
};