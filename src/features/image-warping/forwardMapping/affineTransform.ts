/**
 * アフィン変換の実装
 * Version 5.2.0
 */

import type { Point } from '../../../types/face';
import type { Triangle, AffineTransform } from '../triangulation/types';

/**
 * 3点からアフィン変換行列を計算
 * 
 * 元の三角形から変形後の三角形への変換行列を求める
 */
export function calculateAffineTransform(
  sourceTriangle: Triangle,
  targetTriangle: Triangle
): AffineTransform {
  const [s1, s2, s3] = sourceTriangle.vertices;
  const [t1, t2, t3] = targetTriangle.vertices;
  
  // 元の三角形の行列を作成
  // | x1 x2 x3 |
  // | y1 y2 y3 |
  // | 1  1  1  |
  const sourceMatrix = [
    [s1.x, s2.x, s3.x],
    [s1.y, s2.y, s3.y],
    [1, 1, 1]
  ];
  
  // 変形後の三角形の座標
  const targetX = [t1.x, t2.x, t3.x];
  const targetY = [t1.y, t2.y, t3.y];
  
  // 逆行列を計算
  const invSource = invertMatrix3x3(sourceMatrix);
  
  if (!invSource) {
    console.warn('⚠️ 逆行列が計算できません（退化した三角形）');
    // 単位行列を返す
    return {
      a: 1, b: 0, tx: 0,
      c: 0, d: 1, ty: 0
    };
  }
  
  // アフィン変換パラメータを計算
  // [a, b, tx] = targetX * invSource
  // [c, d, ty] = targetY * invSource
  
  const transformX = multiplyVector3(targetX, invSource);
  const transformY = multiplyVector3(targetY, invSource);
  
  return {
    a: transformX[0],
    b: transformX[1],
    tx: transformX[2],
    c: transformY[0],
    d: transformY[1],
    ty: transformY[2]
  };
}

/**
 * アフィン変換を点に適用
 */
export function applyAffineTransform(
  point: Point,
  transform: AffineTransform
): Point {
  return {
    x: transform.a * point.x + transform.b * point.y + transform.tx,
    y: transform.c * point.x + transform.d * point.y + transform.ty
  };
}

/**
 * 逆アフィン変換を計算
 */
export function invertAffineTransform(transform: AffineTransform): AffineTransform | null {
  const det = transform.a * transform.d - transform.b * transform.c;
  
  if (Math.abs(det) < 1e-10) {
    return null; // 変換が可逆でない
  }
  
  const invDet = 1 / det;
  
  return {
    a: transform.d * invDet,
    b: -transform.b * invDet,
    c: -transform.c * invDet,
    d: transform.a * invDet,
    tx: (transform.b * transform.ty - transform.d * transform.tx) * invDet,
    ty: (transform.c * transform.tx - transform.a * transform.ty) * invDet
  };
}

/**
 * アフィン変換の合成
 */
export function composeAffineTransforms(
  first: AffineTransform,
  second: AffineTransform
): AffineTransform {
  return {
    a: first.a * second.a + first.b * second.c,
    b: first.a * second.b + first.b * second.d,
    c: first.c * second.a + first.d * second.c,
    d: first.c * second.b + first.d * second.d,
    tx: first.a * second.tx + first.b * second.ty + first.tx,
    ty: first.c * second.tx + first.d * second.ty + first.ty
  };
}

/**
 * 恒等変換を作成
 */
export function createIdentityTransform(): AffineTransform {
  return {
    a: 1, b: 0, tx: 0,
    c: 0, d: 1, ty: 0
  };
}

/**
 * スケール変換を作成
 */
export function createScaleTransform(sx: number, sy: number, center?: Point): AffineTransform {
  if (!center) {
    return {
      a: sx, b: 0, tx: 0,
      c: 0, d: sy, ty: 0
    };
  }
  
  // 中心点を基準にスケール
  return {
    a: sx, b: 0, tx: center.x * (1 - sx),
    c: 0, d: sy, ty: center.y * (1 - sy)
  };
}

/**
 * 平行移動変換を作成
 */
export function createTranslationTransform(dx: number, dy: number): AffineTransform {
  return {
    a: 1, b: 0, tx: dx,
    c: 0, d: 1, ty: dy
  };
}

/**
 * 回転変換を作成
 */
export function createRotationTransform(angle: number, center?: Point): AffineTransform {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  if (!center) {
    return {
      a: cos, b: -sin, tx: 0,
      c: sin, d: cos, ty: 0
    };
  }
  
  // 中心点を基準に回転
  return {
    a: cos,
    b: -sin,
    tx: center.x * (1 - cos) + center.y * sin,
    c: sin,
    d: cos,
    ty: center.y * (1 - cos) - center.x * sin
  };
}

/**
 * 3x3行列の逆行列を計算
 */
function invertMatrix3x3(matrix: number[][]): number[][] | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  
  if (Math.abs(det) < 1e-10) {
    return null;
  }
  
  const invDet = 1 / det;
  
  return [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet]
  ];
}

/**
 * ベクトルと行列の積を計算
 */
function multiplyVector3(vector: number[], matrix: number[][]): number[] {
  return [
    vector[0] * matrix[0][0] + vector[1] * matrix[0][1] + vector[2] * matrix[0][2],
    vector[0] * matrix[1][0] + vector[1] * matrix[1][1] + vector[2] * matrix[1][2],
    vector[0] * matrix[2][0] + vector[1] * matrix[2][1] + vector[2] * matrix[2][2]
  ];
}

/**
 * 点が三角形内にあるかを判定（重心座標を使用）
 */
export function isPointInTriangle(point: Point, triangle: Triangle): boolean {
  // 重心座標を計算
  const barycentric = calculateBarycentricCoordinates(point, triangle);
  
  // すべての係数が0以上1以下なら三角形内
  return barycentric.u >= 0 && barycentric.v >= 0 && barycentric.w >= 0 &&
         barycentric.u <= 1 && barycentric.v <= 1 && barycentric.w <= 1;
}

/**
 * 重心座標を計算
 */
export function calculateBarycentricCoordinates(
  point: Point,
  triangle: Triangle
): { u: number; v: number; w: number } {
  const [p1, p2, p3] = triangle.vertices;
  
  const v0x = p3.x - p1.x;
  const v0y = p3.y - p1.y;
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v2x = point.x - p1.x;
  const v2y = point.y - p1.y;
  
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  
  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  const w = 1 - u - v;
  
  return { u, v, w };
}

/**
 * 重心座標から実座標に変換
 */
export function barycentricToCartesian(
  barycentric: { u: number; v: number; w: number },
  triangle: Triangle
): Point {
  const [p1, p2, p3] = triangle.vertices;
  
  return {
    x: barycentric.w * p1.x + barycentric.v * p2.x + barycentric.u * p3.x,
    y: barycentric.w * p1.y + barycentric.v * p2.y + barycentric.u * p3.y
  };
}