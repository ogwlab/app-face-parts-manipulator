/**
 * Delaunay三角形分割の実装
 * Version 5.2.0
 */

import type { Point } from '../../../types/face';
import type { Triangle, TriangleMesh } from './types';

/**
 * 外接円の情報
 */
interface Circumcircle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Delaunay三角形分割を実行
 */
export function createDelaunayTriangulation(points: Point[]): TriangleMesh {
  console.log(`🔺 Delaunay三角形分割開始: ${points.length}点`);
  
  if (points.length < 3) {
    throw new Error('Delaunay三角形分割には最低3点が必要です');
  }

  // 1. スーパートライアングルを作成
  const superTriangle = createSuperTriangle(points);
  
  // 2. 初期三角形リストを作成
  const triangles: Triangle[] = [superTriangle];
  
  // 3. 各点を追加していく
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const badTriangles: Triangle[] = [];
    
    // 3.1. 外接円内に点を含む三角形を見つける（bad triangles）
    for (const triangle of triangles) {
      const circumcircle = getCircumcircle(triangle);
      if (isPointInCircle(point, circumcircle)) {
        badTriangles.push(triangle);
      }
    }
    
    // 3.2. bad trianglesの境界を見つける
    const polygon: [Point, Point][] = [];
    for (const triangle of badTriangles) {
      for (let j = 0; j < 3; j++) {
        const edge: [Point, Point] = [
          triangle.vertices[j],
          triangle.vertices[(j + 1) % 3]
        ];
        
        // この辺が他のbad triangleと共有されているかチェック
        let isShared = false;
        for (const otherTriangle of badTriangles) {
          if (triangle === otherTriangle) continue;
          if (triangleHasEdge(otherTriangle, edge)) {
            isShared = true;
            break;
          }
        }
        
        if (!isShared) {
          polygon.push(edge);
        }
      }
    }
    
    // 3.3. bad trianglesを削除
    for (const badTriangle of badTriangles) {
      const index = triangles.indexOf(badTriangle);
      if (index > -1) {
        triangles.splice(index, 1);
      }
    }
    
    // 3.4. 新しい三角形を作成
    for (const edge of polygon) {
      // 新しい三角形の頂点
      const newVertices: [Point, Point, Point] = [edge[0], edge[1], point];
      
      // 頂点のインデックスを見つける
      const indices: [number, number, number] = [
        findOrAddPoint(points, edge[0]),
        findOrAddPoint(points, edge[1]),
        i
      ];
      
      const newTriangle: Triangle = {
        vertices: newVertices,
        indices: indices
      };
      triangles.push(newTriangle);
    }
  }
  
  // 4. スーパートライアングルの頂点を含む三角形を削除
  const finalTriangles = triangles.filter(triangle => {
    // インデックスベースでチェック（負のインデックスはスーパートライアングルの頂点）
    const hasNegativeIndex = triangle.indices.some(idx => idx < 0);
    if (hasNegativeIndex) return false;
    
    // 頂点ベースでもチェック（念のため）
    const hasSuperVertex = triangle.vertices.some(vertex => 
      isSupertriVertex(vertex, superTriangle)
    );
    
    return !hasSuperVertex;
  });
  
  console.log(`📊 三角形統計: 総数=${triangles.length}, フィルタ前=${triangles.length}, フィルタ後=${finalTriangles.length}`);
  
  // デバッグ: なぜ0個になるのか調査
  if (finalTriangles.length === 0 && triangles.length > 0) {
    console.warn('⚠️ すべての三角形がフィルタリングされました');
    console.log('最初の三角形の例:', triangles[0]);
    console.log('スーパートライアングル:', superTriangle);
  }
  
  console.log(`✅ Delaunay三角形分割完了: ${finalTriangles.length}個の三角形`);
  
  return {
    vertices: points,
    triangles: finalTriangles
  };
}

/**
 * スーパートライアングルを作成
 */
function createSuperTriangle(points: Point[]): Triangle {
  // 全ての点を含む矩形を見つける
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  
  const dx = maxX - minX;
  const dy = maxY - minY;
  const deltaMax = Math.max(dx, dy);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  
  // 十分大きなスーパートライアングルを作成
  const p1: Point = { x: midX - 20 * deltaMax, y: midY - deltaMax };
  const p2: Point = { x: midX, y: midY + 20 * deltaMax };
  const p3: Point = { x: midX + 20 * deltaMax, y: midY - deltaMax };
  
  return {
    vertices: [p1, p2, p3],
    indices: [-1, -2, -3] // スーパートライアングルの頂点を識別するための特殊インデックス
  };
}

/**
 * 三角形の外接円を計算
 */
function getCircumcircle(triangle: Triangle): Circumcircle {
  const [p1, p2, p3] = triangle.vertices;
  
  const ax = p1.x;
  const ay = p1.y;
  const bx = p2.x;
  const by = p2.y;
  const cx = p3.x;
  const cy = p3.y;
  
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  
  if (Math.abs(d) < 1e-10) {
    // 三角形が退化している場合 - より適切な処理
    console.warn('Degenerate triangle detected:', triangle.vertices);
    // 三角形の重心を返し、半径は非常に大きな値にする
    const centroidX = (ax + bx + cx) / 3;
    const centroidY = (ay + by + cy) / 3;
    return { x: centroidX, y: centroidY, radius: Number.MAX_SAFE_INTEGER };
  }
  
  const ux = ((ax * ax + ay * ay) * (by - cy) + 
              (bx * bx + by * by) * (cy - ay) + 
              (cx * cx + cy * cy) * (ay - by)) / d;
  
  const uy = ((ax * ax + ay * ay) * (cx - bx) + 
              (bx * bx + by * by) * (ax - cx) + 
              (cx * cx + cy * cy) * (bx - ax)) / d;
  
  const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));
  
  return { x: ux, y: uy, radius };
}

/**
 * 点が円内にあるかチェック
 */
function isPointInCircle(point: Point, circle: Circumcircle): boolean {
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle.radius - 1e-10; // 浮動小数点誤差を考慮
}

/**
 * 三角形が指定された辺を持つかチェック
 */
function triangleHasEdge(triangle: Triangle, edge: [Point, Point]): boolean {
  const [e1, e2] = edge;
  const vertices = triangle.vertices;
  
  for (let i = 0; i < 3; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % 3];
    
    // 両方向をチェック
    if ((isSamePoint(v1, e1) && isSamePoint(v2, e2)) ||
        (isSamePoint(v1, e2) && isSamePoint(v2, e1))) {
      return true;
    }
  }
  
  return false;
}

/**
 * 2つの点が同じかチェック
 */
function isSamePoint(p1: Point, p2: Point): boolean {
  return Math.abs(p1.x - p2.x) < 1e-10 && Math.abs(p1.y - p2.y) < 1e-10;
}

/**
 * 点のインデックスを見つけるか、スーパートライアングルの頂点の場合は特別な値を返す
 */
function findOrAddPoint(points: Point[], point: Point): number {
  // まず既存の点から探す
  for (let i = 0; i < points.length; i++) {
    if (isSamePoint(points[i], point)) {
      return i;
    }
  }
  
  // スーパートライアングルの頂点に対して一意の負のインデックスを生成
  // または、より良い解決策として、super triangle vertices を明示的に追跡する
  console.warn('Unknown point found, treating as super-triangle vertex:', point);
  return -1; // すべて同じ値にするのではなく、呼び出し側で適切に処理する
}


/**
 * 頂点がスーパートライアングルの頂点かチェック
 */
function isSupertriVertex(vertex: Point, superTriangle: Triangle): boolean {
  return superTriangle.vertices.some(v => isSamePoint(v, vertex));
}

/**
 * 顔の特徴点用に最適化されたDelaunay三角形分割
 */
export function createFaceOptimizedTriangulation(
  points: Point[],
  imageWidth: number,
  imageHeight: number
): TriangleMesh {
  console.log('🎭 顔最適化Delaunay三角形分割開始');
  
  // 1. 画像境界に追加の点を配置
  const boundaryPoints = generateBoundaryPoints(imageWidth, imageHeight);
  const allPoints = [...points, ...boundaryPoints];
  
  // 2. Delaunay三角形分割を実行
  const mesh = createDelaunayTriangulation(allPoints);
  
  // 3. 三角形の品質を改善（オプション）
  optimizeTriangulation(mesh);
  
  return mesh;
}

/**
 * 画像境界に点を生成
 */
export function generateBoundaryPoints(width: number, height: number): Point[] {
  const points: Point[] = [];
  const spacing = 50; // 境界点の間隔
  
  // 上辺
  for (let x = 0; x <= width; x += spacing) {
    points.push({ x: Math.min(x, width - 1), y: 0 });
  }
  
  // 下辺
  for (let x = 0; x <= width; x += spacing) {
    points.push({ x: Math.min(x, width - 1), y: height - 1 });
  }
  
  // 左辺（角を除く）
  for (let y = spacing; y < height; y += spacing) {
    points.push({ x: 0, y: Math.min(y, height - 1) });
  }
  
  // 右辺（角を除く）
  for (let y = spacing; y < height; y += spacing) {
    points.push({ x: width - 1, y: Math.min(y, height - 1) });
  }
  
  return points;
}

/**
 * 三角形分割の最適化（品質改善）
 */
function optimizeTriangulation(mesh: TriangleMesh): void {
  // 非常に細長い三角形を検出して改善する
  for (const triangle of mesh.triangles) {
    const quality = calculateTriangleQuality(triangle);
    if (quality < 0.1) { // 品質が低い三角形
      // TODO: エッジフリップなどの最適化手法を適用
      // 現在は警告のみ
      console.warn('⚠️ 低品質な三角形を検出:', quality);
    }
  }
}

/**
 * 三角形の品質を計算（0-1の範囲、1が最高品質）
 */
function calculateTriangleQuality(triangle: Triangle): number {
  const [p1, p2, p3] = triangle.vertices;
  
  // 辺の長さを計算
  const a = Math.sqrt((p2.x - p3.x) ** 2 + (p2.y - p3.y) ** 2);
  const b = Math.sqrt((p1.x - p3.x) ** 2 + (p1.y - p3.y) ** 2);
  const c = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  
  // 面積を計算（ヘロンの公式）
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  
  // 品質指標（面積と周長の比率）
  const perimeter = a + b + c;
  const quality = (4 * Math.sqrt(3) * area) / (perimeter * perimeter);
  
  return Math.max(0, Math.min(1, quality));
}