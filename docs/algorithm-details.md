# Face Parts Manipulator アルゴリズム詳細仕様書

## 目次

1. [画像変形アルゴリズムの詳細](#1-画像変形アルゴリズムの詳細)
2. [制御点生成アルゴリズム](#2-制御点生成アルゴリズム)
3. [🆕 輪郭操作アルゴリズム](#3-輪郭操作アルゴリズム)
4. [座標変換の数学的詳細](#4-座標変換の数学的詳細)
5. [パフォーマンス最適化技術](#5-パフォーマンス最適化技術)
6. [エッジケースの処理](#6-エッジケースの処理)

---

## 1. 画像変形アルゴリズムの詳細

### 1.1 Triangle Mesh Deformation の実装

#### 基本原理
画像を三角形メッシュに分割し、各三角形を個別にアフィン変換することで自然な変形を実現。

#### 実装手順

**Step 1: メッシュ生成**
```typescript
// src/features/image-warping/forwardMapping/meshDeformation.ts
export function deformImageWithTriangleMesh(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  sourceLandmarks: Point[],
  deformedLandmarks: Point[],
  imageWidth: number,
  imageHeight: number,
  renderMode: 'forward' | 'backward' | 'hybrid' = 'forward'
): void {
  // 1. 境界点を生成（画像エッジに28点）
  const boundaryPoints = generateBoundaryPoints(imageWidth, imageHeight);
  
  // 2. 全ての点を結合（68 + 28 = 96点）
  const allSourcePoints = [...sourceLandmarks, ...boundaryPoints];
  const allDeformedPoints = [...deformedLandmarks, ...boundaryPoints];
  
  // 3. Delaunay三角分割
  const triangulation = createFaceOptimizedTriangulation(sourceLandmarks, imageWidth, imageHeight);
}
```

**Step 2: 三角形ペアの生成**
```typescript
const trianglePairs: Array<{
  source: Triangle;
  target: Triangle;
  transform?: AffineTransform;
}> = [];

triangulation.triangles.forEach(triangle => {
  const sourceTriangle: Triangle = {
    vertices: [
      allSourcePoints[triangle.indices[0]],
      allSourcePoints[triangle.indices[1]],
      allSourcePoints[triangle.indices[2]]
    ]
  };
  
  const targetTriangle: Triangle = {
    vertices: [
      allDeformedPoints[triangle.indices[0]],
      allDeformedPoints[triangle.indices[1]],
      allDeformedPoints[triangle.indices[2]]
    ]
  };
  
  trianglePairs.push({ source: sourceTriangle, target: targetTriangle });
});
```

### 1.2 Delaunay 三角分割アルゴリズム

#### Bowyer-Watson アルゴリズムの実装
```typescript
// src/features/image-warping/triangulation/delaunay.ts
export function delaunayTriangulation(points: Point[]): Triangle[] {
  // 1. スーパートライアングルの作成
  const superTriangle = createSuperTriangle(points);
  const triangles: DelaunayTriangle[] = [superTriangle];
  
  // 2. 各点を逐次的に追加
  points.forEach((point, pointIndex) => {
    const badTriangles: DelaunayTriangle[] = [];
    
    // 外接円に点が含まれる三角形を見つける
    triangles.forEach(triangle => {
      if (isPointInCircumcircle(point, triangle)) {
        badTriangles.push(triangle);
      }
    });
    
    // ポリゴンホールの境界を見つける
    const polygon: Edge[] = [];
    badTriangles.forEach(triangle => {
      triangle.edges.forEach(edge => {
        const isShared = badTriangles.some(other => 
          other !== triangle && other.edges.some(otherEdge => 
            edgesAreEqual(edge, otherEdge)
          )
        );
        if (!isShared) {
          polygon.push(edge);
        }
      });
    });
    
    // 不正な三角形を削除
    badTriangles.forEach(triangle => {
      const index = triangles.indexOf(triangle);
      if (index > -1) {
        triangles.splice(index, 1);
      }
    });
    
    // 新しい三角形を作成
    polygon.forEach(edge => {
      const newTriangle = createTriangle(edge.p1, edge.p2, point, pointIndex);
      triangles.push(newTriangle);
    });
  });
  
  // 3. スーパートライアングルを含む三角形を削除
  return triangles.filter(triangle => 
    !triangle.vertices.some(v => v.index < 0)
  );
}
```

#### 外接円判定の最適化
```typescript
function isPointInCircumcircle(point: Point, triangle: DelaunayTriangle): boolean {
  const { center, radius } = triangle.circumcircle;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distSquared = dx * dx + dy * dy;
  
  // 浮動小数点誤差を考慮したイプシロン
  const EPSILON = 1e-10;
  return distSquared < radius * radius + EPSILON;
}
```

### 1.3 アフィン変換の計算

#### 変換行列の導出
```typescript
// src/features/image-warping/forwardMapping/affineTransform.ts
export function computeAffineTransform(
  src: Triangle,
  dst: Triangle
): AffineTransform {
  const [s0, s1, s2] = src.vertices;
  const [d0, d1, d2] = dst.vertices;
  
  // ソース三角形の行列
  const srcMatrix = [
    [s0.x, s0.y, 1, 0, 0, 0],
    [0, 0, 0, s0.x, s0.y, 1],
    [s1.x, s1.y, 1, 0, 0, 0],
    [0, 0, 0, s1.x, s1.y, 1],
    [s2.x, s2.y, 1, 0, 0, 0],
    [0, 0, 0, s2.x, s2.y, 1]
  ];
  
  // ターゲット座標ベクトル
  const dstVector = [d0.x, d0.y, d1.x, d1.y, d2.x, d2.y];
  
  // 線形方程式を解く（ガウス消去法）
  const coefficients = solveLinearSystem(srcMatrix, dstVector);
  
  return {
    a: coefficients[0],
    b: coefficients[1],
    c: coefficients[2],
    d: coefficients[3],
    e: coefficients[4],
    f: coefficients[5]
  };
}
```

---

## 2. 制御点生成アルゴリズム

### 2.1 Independent Deformation System

#### 目の制御点生成（3層構造）
```typescript
// src/features/image-warping/independentDeformation.ts
function generateEyeControlPoints(
  eyeLandmarks: Point[],
  params: EyeParams,
  eyeType: 'left' | 'right'
): ControlPoint[] {
  const controlPoints: ControlPoint[] = [];
  const center = calculateCenter(eyeLandmarks);
  
  // 1. 輪郭制御点（目の形状）
  eyeLandmarks.forEach((point, index) => {
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const distance = Math.sqrt(
      Math.pow(point.x - center.x, 2) + 
      Math.pow(point.y - center.y, 2)
    );
    
    const scaledDistance = distance * params.size;
    const targetX = center.x + Math.cos(angle) * scaledDistance + params.positionX;
    const targetY = center.y + Math.sin(angle) * scaledDistance + params.positionY;
    
    controlPoints.push({
      original: point,
      target: { x: targetX, y: targetY },
      weight: 1.0,
      influenceRadius: 60,
      partType: 'eye'
    });
  });
  
  // 2. 瞳孔中心制御点（完全固定）
  const eyeCenterTarget = {
    x: center.x + params.positionX,
    y: center.y + params.positionY
  };
  
  controlPoints.push({
    original: center,
    target: eyeCenterTarget,
    weight: 1.5,  // 高い重みで中心を固定
    influenceRadius: 20,
    partType: 'eye'
  });
  
  // 3. 虹彩境界制御点（円形保持）
  const irisRadius = calculateIrisRadius(eyeLandmarks);
  const irisPoints = generateCircularControlPoints(center, irisRadius, 8);
  
  irisPoints.forEach(point => {
    controlPoints.push({
      original: point,
      target: {
        x: point.x + params.positionX,
        y: point.y + params.positionY
      },
      weight: 1.2,
      influenceRadius: 30,
      partType: 'eye'
    });
  });
  
  return controlPoints;
}
```

#### 口の制御点生成
```typescript
function generateMouthControlPoints(
  mouthLandmarks: Point[],
  params: MouthParams
): ControlPoint[] {
  const center = calculateCenter(mouthLandmarks);
  const bounds = calculateBounds(mouthLandmarks);
  
  return mouthLandmarks.map(point => {
    // 中心からの相対位置を計算
    const relX = (point.x - center.x) / (bounds.width / 2);
    const relY = (point.y - center.y) / (bounds.height / 2);
    
    // スケーリング適用
    const scaledX = relX * params.width;
    const scaledY = relY * params.height;
    
    // 絶対座標に変換
    const targetX = center.x + scaledX * (bounds.width / 2) + params.positionX;
    const targetY = center.y + scaledY * (bounds.height / 2) + params.positionY;
    
    return {
      original: point,
      target: { x: targetX, y: targetY },
      weight: 1.0,
      influenceRadius: 70,
      partType: 'mouth'
    };
  });
}
```

### 2.2 Adaptive Warping System

#### TPS (Thin Plate Spline) 基底関数
```typescript
// src/features/image-warping/tpsWarping.ts
function tpsBasisFunction(r: number): number {
  if (r === 0) return 0;
  return r * r * Math.log(r);
}

function computeTPSWeights(
  controlPoints: Point[],
  targetPoints: Point[]
): TPSWeights {
  const n = controlPoints.length;
  const K = new Array(n).fill(0).map(() => new Array(n).fill(0));
  
  // K行列の構築
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = controlPoints[i].x - controlPoints[j].x;
      const dy = controlPoints[i].y - controlPoints[j].y;
      const r = Math.sqrt(dx * dx + dy * dy);
      K[i][j] = tpsBasisFunction(r);
    }
  }
  
  // P行列の構築
  const P = controlPoints.map(p => [1, p.x, p.y]);
  
  // 線形システムを解く
  // [K P] [W]   [V]
  // [P' 0] [A] = [0]
  
  return solveTPSSystem(K, P, targetPoints);
}
```

---

## 3. 🆕 輪郭操作アルゴリズム

### 3.1 Jawline-based制御点生成

#### 基本原理
顔の輪郭操作は68点ランドマークのJawline（0-16番）を基準とし、解剖学的に自然な変形を実現します。

#### 制御点生成プロセス
```typescript
// src/features/image-warping/contourDeformation.ts
export function generateContourControlPoints(
  landmarks: FaceLandmarks,
  params: ContourParams
): { original: Point[]; target: Point[] } {
  
  const jawline = landmarks.jawline; // 0-16番の17点
  const faceCenter = calculateFaceCenter(landmarks);
  const faceBounds = calculateFaceBounds(landmarks);
  
  const originalPoints: Point[] = [];
  const targetPoints: Point[] = [];
  
  jawline.forEach((point, index) => {
    // 1. 領域分類による処理分岐
    const region = classifyJawlineRegion(index);
    
    // 2. 変形計算の実行
    const transformedPoint = calculatePointTransformation(
      point, index, region, params, faceCenter, faceBounds
    );
    
    originalPoints.push(point);
    targetPoints.push(transformedPoint);
  });
  
  // 3. 平滑化処理の適用
  if (params.smoothness > 0) {
    applySmoothness(targetPoints, params.smoothness);
  }
  
  return { original: originalPoints, target: targetPoints };
}
```

### 3.2 領域別変形計算

#### 領域分類システム
```typescript
function classifyJawlineRegion(index: number): JawlineRegion {
  if (index >= 3 && index <= 13) {
    return 'lowerJaw';    // 下顎部（丸み・角張り、顎の長さ）
  } else if (index <= 4 || index >= 12) {
    return 'sideJaw';     // 側面部（顎の幅）
  } else {
    return 'cheekArea';   // 頬部（頬の膨らみ）
  }
}
```

#### パラメータ別変形計算
```typescript
function calculatePointTransformation(
  point: Point,
  index: number,
  region: JawlineRegion,
  params: ContourParams,
  faceCenter: Point,
  faceBounds: FaceBounds
): Point {
  
  let dx = 0;
  let dy = 0;
  
  // 基準座標の計算
  const relX = (point.x - faceCenter.x) / faceBounds.width;
  const relY = (point.y - faceCenter.y) / faceBounds.height;
  
  // 1. roundness: 丸み⇔角張り (-1.0〜1.0)
  if (params.roundness !== 0 && region === 'lowerJaw') {
    const roundnessEffect = params.roundness * 0.1;
    dx += relX * roundnessEffect * faceBounds.width;
    
    // 顎先の特別処理（丸みの場合は少し上げる）
    if (params.roundness > 0 && (index === 8 || index === 9)) {
      dy -= faceBounds.height * params.roundness * 0.02;
    }
  }
  
  // 2. jawWidth: 顎の幅 (0.7〜1.3)
  if (params.jawWidth !== 1.0 && region === 'sideJaw') {
    const widthEffect = (params.jawWidth - 1.0);
    dx += relX * widthEffect * faceBounds.width * 0.5;
  }
  
  // 3. cheekFullness: 頬の膨らみ (0.7〜1.3)
  if (params.cheekFullness !== 1.0 && region === 'cheekArea') {
    const fullnessEffect = (params.cheekFullness - 1.0);
    dx += Math.sign(relX) * faceBounds.width * fullnessEffect * 0.1;
    dy += faceBounds.height * fullnessEffect * 0.02;
  }
  
  // 4. chinHeight: 顎の長さ (0.8〜1.2)
  if (params.chinHeight !== 1.0 && region === 'lowerJaw') {
    const heightEffect = (params.chinHeight - 1.0);
    const lowerJawRatio = (index - 3) / 10; // 0.0〜1.0
    const centerRatio = 1 - Math.abs(lowerJawRatio - 0.5) * 2;
    dy += faceBounds.height * heightEffect * centerRatio * 0.15;
  }
  
  return {
    x: point.x + dx,
    y: point.y + dy
  };
}
```

### 3.3 平滑化アルゴリズム

#### 3点重み付き平均による平滑化
```typescript
function applySmoothness(points: Point[], smoothness: number): void {
  const iterations = Math.round(smoothness * 5); // 最大5回反復
  
  for (let iter = 0; iter < iterations; iter++) {
    const smoothedPoints = [...points];
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // 重み付き平均（中心重み0.5、隣接各0.25）
      smoothedPoints[i] = {
        x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
        y: prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25
      };
    }
    
    // 結果を元配列にコピー（参照を維持）
    for (let i = 0; i < points.length; i++) {
      points[i].x = smoothedPoints[i].x;
      points[i].y = smoothedPoints[i].y;
    }
  }
}
```

### 3.4 メッシュ統合システム

#### 条件付き輪郭処理
```typescript
// src/features/image-warping/forwardMapping/meshDeformation.ts
function isContourChangeDetected(contour: ContourParams): boolean {
  return (
    contour.roundness !== 0 ||
    contour.jawWidth !== 1.0 ||
    contour.cheekFullness !== 1.0 ||
    contour.chinHeight !== 1.0 ||
    contour.smoothness !== 0.5
  );
}

function deformLandmarks(
  landmarks: FaceLandmarks,
  faceParams: FaceParams
): Point[] {
  const deformedLandmarks = [...landmarks.all];
  
  // 輪郭処理の条件付き実行
  if (isContourChangeDetected(faceParams.contour)) {
    console.log('🔷 輪郭変形を実行:', faceParams.contour);
    
    const contourResult = generateContourControlPoints(
      landmarks,
      faceParams.contour
    );
    
    // Jawline（0-16番）を直接更新
    contourResult.target.forEach((point, i) => {
      if (i < 17) { // Jawlineの範囲内
        deformedLandmarks[i] = point;
      }
    });
  }
  
  // 他のパーツ処理...
  
  return deformedLandmarks;
}
```

#### デバッグログシステム
```typescript
function logContourDeformation(params: ContourParams): void {
  console.log('🔷 輪郭操作アルゴリズム実行:');
  
  if (params.roundness !== 0) {
    console.log(`  • 丸み: ${params.roundness > 0 ? '丸く' : '角張り'} (${params.roundness})`);
  }
  
  if (params.jawWidth !== 1.0) {
    console.log(`  • 顎の幅: ${params.jawWidth * 100}%`);
  }
  
  if (params.cheekFullness !== 1.0) {
    console.log(`  • 頬の膨らみ: ${params.cheekFullness * 100}%`);
  }
  
  if (params.chinHeight !== 1.0) {
    console.log(`  • 顎の長さ: ${params.chinHeight * 100}%`);
  }
  
  if (params.smoothness !== 0.5) {
    console.log(`  • 滑らかさ: ${params.smoothness * 100}%`);
  }
}
```

### 3.5 パフォーマンス最適化

#### 計算量削減
```typescript
// ランドマーク変形の最適化
function optimizedContourDeformation(landmarks: FaceLandmarks): void {
  // 1. 一度だけ計算する共通値
  const faceCenter = calculateFaceCenter(landmarks);
  const faceBounds = calculateFaceBounds(landmarks);
  
  // 2. Jawlineのみ処理（68点中17点のみ）
  const jawlineOnly = landmarks.jawline;
  
  // 3. 必要時のみ平滑化実行
  if (params.smoothness > 0) {
    applySmoothness(targetPoints, params.smoothness);
  }
}
```

#### メモリ効率
```typescript
// 既存配列の in-place 更新
function updateLandmarksInPlace(
  deformedLandmarks: Point[],
  contourResult: { target: Point[] }
): void {
  // 新しい配列を作らずに既存要素を更新
  contourResult.target.forEach((point, i) => {
    if (i < 17) {
      deformedLandmarks[i].x = point.x;
      deformedLandmarks[i].y = point.y;
    }
  });
}
```

---

## 4. 座標変換の数学的詳細

### 4.1 バリセントリック座標

#### 定義と計算
```typescript
// src/features/image-warping/forwardMapping/affineTransform.ts
export function calculateBarycentricCoordinates(
  point: Point,
  triangle: Triangle
): { u: number; v: number; w: number } {
  const [v0, v1, v2] = triangle.vertices;
  
  // ベクトル計算
  const v0v1 = { x: v1.x - v0.x, y: v1.y - v0.y };
  const v0v2 = { x: v2.x - v0.x, y: v2.y - v0.y };
  const v0p = { x: point.x - v0.x, y: point.y - v0.y };
  
  // 内積計算
  const dot00 = v0v2.x * v0v2.x + v0v2.y * v0v2.y;
  const dot01 = v0v2.x * v0v1.x + v0v2.y * v0v1.y;
  const dot02 = v0v2.x * v0p.x + v0v2.y * v0p.y;
  const dot11 = v0v1.x * v0v1.x + v0v1.y * v0v1.y;
  const dot12 = v0v1.x * v0p.x + v0v1.y * v0p.y;
  
  // 重心座標の計算
  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  
  // 数値安定性チェック
  if (!isFinite(invDenom)) {
    return { u: 0, v: 0, w: 1 };
  }
  
  const v = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const w = (dot00 * dot12 - dot01 * dot02) * invDenom;
  const u = 1 - v - w;
  
  return { u, v, w };
}
```

#### 座標変換への応用
```typescript
function transformPoint(
  point: Point,
  sourceTriangle: Triangle,
  targetTriangle: Triangle
): Point {
  const bary = calculateBarycentricCoordinates(point, sourceTriangle);
  const [t0, t1, t2] = targetTriangle.vertices;
  
  return {
    x: bary.u * t0.x + bary.v * t1.x + bary.w * t2.x,
    y: bary.u * t0.y + bary.v * t1.y + bary.w * t2.y
  };
}
```

### 4.2 座標系のスケーリング

#### Canvas座標への変換
```typescript
// src/features/image-warping/forwardMapping/meshDeformation.ts
function scaleLandmarksToCanvas(
  landmarks: Point[],
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): Point[] {
  const scaleX = canvasWidth / imageWidth;
  const scaleY = canvasHeight / imageHeight;
  
  return landmarks.map(point => ({
    x: point.x * scaleX,
    y: point.y * scaleY
  }));
}
```

---

## 5. パフォーマンス最適化技術

### 5.1 バウンディングボックス最適化

```typescript
// src/features/image-warping/forwardMapping/hybridRenderer.ts
function calculateTriangleBounds(triangle: Triangle): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  const xs = triangle.vertices.map(v => v.x);
  const ys = triangle.vertices.map(v => v.y);
  
  return {
    minX: Math.floor(Math.min(...xs)),
    minY: Math.floor(Math.min(...ys)),
    maxX: Math.ceil(Math.max(...xs)),
    maxY: Math.ceil(Math.max(...ys))
  };
}
```

### 5.2 スキャンライン最適化

```typescript
// src/features/image-warping/forwardMapping/triangleRenderer.ts
function getScanlineIntersections(
  y: number,
  triangle: Triangle
): number[] | null {
  const intersections: number[] = [];
  const vertices = triangle.vertices;
  const epsilon = 0.001;
  
  for (let i = 0; i < 3; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % 3];
    
    const minY = Math.min(v1.y, v2.y);
    const maxY = Math.max(v1.y, v2.y);
    
    // エッジがスキャンラインと交差するかチェック
    if (y >= minY - epsilon && y <= maxY + epsilon) {
      if (Math.abs(v2.y - v1.y) < epsilon) {
        // 水平エッジの特別処理
        if (Math.abs(y - v1.y) < epsilon) {
          intersections.push(v1.x);
          intersections.push(v2.x);
        }
      } else {
        // 交点のX座標を計算
        const t = (y - v1.y) / (v2.y - v1.y);
        const x = v1.x + t * (v2.x - v1.x);
        intersections.push(x);
      }
    }
  }
  
  // 重複を除去してソート
  const unique = [...new Set(intersections)].sort((a, b) => a - b);
  return unique.length >= 2 ? unique : null;
}
```

### 5.3 キャッシュ戦略

```typescript
// アフィン変換のキャッシュ
const transformCache = new Map<string, AffineTransform>();

function getCachedTransform(
  source: Triangle,
  target: Triangle
): AffineTransform {
  const key = generateTriangleKey(source, target);
  
  if (!transformCache.has(key)) {
    const transform = computeAffineTransform(source, target);
    transformCache.set(key, transform);
  }
  
  return transformCache.get(key)!;
}
```

---

## 6. エッジケースの処理

### 6.1 退化三角形の処理

```typescript
function isDegenerate(triangle: Triangle): boolean {
  const [v0, v1, v2] = triangle.vertices;
  
  // 三角形の面積を計算
  const area = Math.abs(
    (v1.x - v0.x) * (v2.y - v0.y) - 
    (v2.x - v0.x) * (v1.y - v0.y)
  ) / 2;
  
  return area < 1e-10;
}
```

### 6.2 境界処理

```typescript
function handleBoundaryPixels(
  x: number,
  y: number,
  width: number,
  height: number,
  imageData: ImageData
): { r: number; g: number; b: number; a: number } {
  // クランプ処理
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  
  // エッジ拡張
  if (x < 0 || x >= width || y < 0 || y >= height) {
    // 最近傍ピクセルの値を使用
    const idx = (Math.floor(clampedY) * width + Math.floor(clampedX)) * 4;
    return {
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2],
      a: imageData.data[idx + 3]
    };
  }
  
  // 通常のバイリニア補間
  return samplePixelBilinear(x, y, imageData, width, height);
}
```

### 6.3 数値安定性

```typescript
// 浮動小数点誤差の対策
const EPSILON = 1e-10;

function safeNormalize(vector: { x: number; y: number }): { x: number; y: number } {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  
  if (length < EPSILON) {
    return { x: 0, y: 0 };
  }
  
  return {
    x: vector.x / length,
    y: vector.y / length
  };
}
```

---

## 付録: 実装のベストプラクティス

### メモリ効率
1. ImageDataの再利用
2. 一時オブジェクトの最小化
3. 大きな配列の事前確保

### 並列処理の可能性
1. Web Workers による三角形単位の並列レンダリング
2. OffscreenCanvas の活用
3. GPU アクセラレーション（WebGL）への移行パス

### テストとデバッグ
1. 境界値テストケース
2. パフォーマンスプロファイリング
3. 視覚的デバッグツール（特徴点表示など）

---

最終更新日: 2025年08月04日