import * as fabric from 'fabric';

export interface CanvasManager {
  canvas: fabric.Canvas | null;
  initialize: (canvasElement: HTMLCanvasElement) => void;
  loadImage: (imageUrl: string) => Promise<fabric.Image>;
  updateImage: (image: fabric.Image) => void;
  dispose: () => void;
  getCanvasDataURL: () => string;
}

export class FabricCanvasManager implements CanvasManager {
  public canvas: fabric.Canvas | null = null;
  private currentImage: fabric.Image | null = null;

  initialize(canvasElement: HTMLCanvasElement): void {
    if (this.canvas) {
      this.dispose();
    }

    this.canvas = new fabric.Canvas(canvasElement, {
      width: 800,
      height: 600,
      backgroundColor: '#f0f0f0',
      selection: false, // 選択を無効化
      preserveObjectStacking: true,
    });

    // Canvas のイベントリスナーを設定
    this.canvas.on('path:created', () => {
      this.canvas?.renderAll();
    });
  }

  async loadImage(imageUrl: string): Promise<fabric.Image> {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(imageUrl, {
        crossOrigin: 'anonymous'
      }).then((img: fabric.Image) => {
        if (!img || !this.canvas) {
          reject(new Error('画像の読み込みまたはCanvas初期化に失敗しました'));
          return;
        }

        // 画像をCanvasサイズに合わせてスケール調整
        const canvasWidth = this.canvas.getWidth();
        const canvasHeight = this.canvas.getHeight();
        
        const scaleX = canvasWidth / (img.width || 1);
        const scaleY = canvasHeight / (img.height || 1);
        const scale = Math.min(scaleX, scaleY) * 0.9; // 少し余白を残す

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: canvasWidth / 2,
          top: canvasHeight / 2,
          originX: 'center',
          originY: 'center',
          selectable: false, // 選択を無効化
          evented: false, // イベントを無効化
        });

        // 既存の画像があれば削除
        if (this.currentImage) {
          this.canvas.remove(this.currentImage);
        }

        this.currentImage = img;
        this.canvas.add(img);
        this.canvas.bringObjectToFront(img); // 画像を前面に持ってくる
        this.canvas.renderAll();

        resolve(img);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  updateImage(image: fabric.Image): void {
    if (!this.canvas) return;

    // 既存の画像を削除
    if (this.currentImage) {
      this.canvas.remove(this.currentImage);
    }

    // 新しい画像を追加
    this.currentImage = image;
    this.canvas.add(image);
    this.canvas.bringObjectToFront(image);
    this.canvas.renderAll();
  }

  dispose(): void {
    if (this.canvas) {
      this.canvas.dispose();
      this.canvas = null;
    }
    this.currentImage = null;
  }

  getCanvasDataURL(): string {
    if (!this.canvas) {
      throw new Error('Canvas が初期化されていません');
    }
    return this.canvas.toDataURL({
      format: 'png' as const,
      quality: 1.0,
      multiplier: 1,
    });
  }

  getCurrentImage(): fabric.Image | null {
    return this.currentImage;
  }

  getCanvas(): fabric.Canvas | null {
    return this.canvas;
  }
}

// シングルトンインスタンス
export const canvasManager = new FabricCanvasManager();