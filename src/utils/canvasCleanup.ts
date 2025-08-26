/**
 * Canvas cleanup utilities for memory management
 * Properly disposes of canvas resources to prevent memory leaks
 */

import { logger } from './logger';

/**
 * Clean up canvas element and release resources
 * @param canvas - Canvas element to clean up
 */
export function cleanupCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;

  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Reset dimensions to release backing store
    canvas.width = 0;
    canvas.height = 0;

    logger.debug('Canvas cleanup completed');
  } catch (error) {
    logger.error('Canvas cleanup failed:', error);
  }
}

/**
 * Clean up ImageData object
 * @param imageData - ImageData to clean up
 */
export function cleanupImageData(imageData: ImageData | null): void {
  if (!imageData) return;

  try {
    // Clear the data array (helps garbage collection)
    if (imageData.data) {
      imageData.data.fill(0);
    }
    logger.debug('ImageData cleanup completed');
  } catch (error) {
    logger.error('ImageData cleanup failed:', error);
  }
}

/**
 * Clean up OffscreenCanvas
 * @param offscreenCanvas - OffscreenCanvas to clean up
 */
export function cleanupOffscreenCanvas(offscreenCanvas: OffscreenCanvas | null): void {
  if (!offscreenCanvas) return;

  try {
    const ctx = offscreenCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }

    // Reset dimensions
    offscreenCanvas.width = 0;
    offscreenCanvas.height = 0;

    logger.debug('OffscreenCanvas cleanup completed');
  } catch (error) {
    logger.error('OffscreenCanvas cleanup failed:', error);
  }
}

/**
 * Create a temporary canvas for operations with automatic cleanup
 * @param width - Canvas width
 * @param height - Canvas height
 * @param operation - Function to perform on the canvas
 * @returns Result of the operation
 */
export async function withTemporaryCanvas<T>(
  width: number,
  height: number,
  operation: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => T | Promise<T>
): Promise<T> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  try {
    const result = await operation(canvas, ctx);
    return result;
  } finally {
    // Always cleanup, even if operation fails
    cleanupCanvas(canvas);
  }
}

/**
 * Memory-efficient image resize with cleanup
 * @param source - Source image/canvas
 * @param targetWidth - Target width
 * @param targetHeight - Target height
 * @returns Resized canvas
 */
export async function resizeImageWithCleanup(
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): Promise<HTMLCanvasElement> {
  return withTemporaryCanvas(targetWidth, targetHeight, (canvas, ctx) => {
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    
    // Create a new canvas to return (original will be cleaned up)
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = targetWidth;
    resultCanvas.height = targetHeight;
    
    const resultCtx = resultCanvas.getContext('2d');
    if (!resultCtx) {
      throw new Error('Failed to get 2D context for result');
    }
    
    resultCtx.drawImage(canvas, 0, 0);
    return resultCanvas;
  });
}

/**
 * Batch cleanup for multiple canvases
 * @param canvases - Array of canvases to clean up
 */
export function cleanupCanvasBatch(canvases: (HTMLCanvasElement | null)[]): void {
  canvases.forEach(canvas => cleanupCanvas(canvas));
}

/**
 * Monitor canvas memory usage
 * @returns Object with memory stats
 */
export function getCanvasMemoryEstimate(canvas: HTMLCanvasElement): {
  widthPx: number;
  heightPx: number;
  bytesEstimate: number;
  mbEstimate: number;
} {
  const bytes = canvas.width * canvas.height * 4; // 4 bytes per pixel (RGBA)
  return {
    widthPx: canvas.width,
    heightPx: canvas.height,
    bytesEstimate: bytes,
    mbEstimate: bytes / (1024 * 1024)
  };
}

export default {
  cleanupCanvas,
  cleanupImageData,
  cleanupOffscreenCanvas,
  withTemporaryCanvas,
  resizeImageWithCleanup,
  cleanupCanvasBatch,
  getCanvasMemoryEstimate
};