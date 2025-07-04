/**
 * 三角形メッシュベースの変形システムの型定義
 * Version 5.2.0
 */

import type { Point } from '../../../types/face';

/**
 * 三角形の定義
 */
export interface Triangle {
  /** 三角形の3つの頂点 */
  vertices: [Point, Point, Point];
  /** 頂点配列内のインデックス */
  indices: [number, number, number];
}

/**
 * 三角形メッシュ
 */
export interface TriangleMesh {
  /** すべての頂点 */
  vertices: Point[];
  /** 三角形のリスト */
  triangles: Triangle[];
}

/**
 * アフィン変換行列 (2x3)
 * | a b tx |
 * | c d ty |
 */
export interface AffineTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/**
 * 変形された三角形ペア
 */
export interface DeformedTrianglePair {
  /** 元の三角形 */
  source: Triangle;
  /** 変形後の三角形 */
  target: Triangle;
  /** 変換行列 */
  transform: AffineTransform;
}

/**
 * メッシュ変形の結果
 */
export interface MeshDeformationResult {
  /** 元のメッシュ */
  sourceMesh: TriangleMesh;
  /** 変形後のメッシュ */
  targetMesh: TriangleMesh;
  /** 三角形ペアのリスト */
  trianglePairs: DeformedTrianglePair[];
}

/**
 * 三角形内の点かどうかを判定するための型
 */
export interface BarycentricCoordinates {
  u: number;
  v: number;
  w: number;
}

/**
 * スキャンライン用の辺情報
 */
export interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  slope: number;
}