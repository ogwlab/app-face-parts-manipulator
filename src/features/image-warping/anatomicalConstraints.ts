import type { Point, FaceLandmarks } from '../../types/face';
import type { TPSControlPoint } from './tpsWarping';

/**
 * 顔の解剖学的制約を適用するシステム
 * 
 * 目的:
 * - 顔の自然な形状を保持
 * - 極端な変形を防止
 * - 特徴点間の関係性を維持
 */

export interface AnatomicalConstraint {
  type: 'distance' | 'angle' | 'symmetry' | 'proportion';
  points: number[]; // 特徴点のインデックス
  originalValue: number;
  tolerance: number; // 許容誤差
  weight: number; // 制約の強度
}

/**
 * 顔特徴点のマッピング（68点モデル）
 */
export const FACIAL_LANDMARKS_68 = {
  jawline: Array.from({ length: 17 }, (_, i) => i), // 0-16
  rightEyebrow: Array.from({ length: 5 }, (_, i) => 17 + i), // 17-21
  leftEyebrow: Array.from({ length: 5 }, (_, i) => 22 + i), // 22-26
  nose: Array.from({ length: 9 }, (_, i) => 27 + i), // 27-35
  rightEye: Array.from({ length: 6 }, (_, i) => 36 + i), // 36-41
  leftEye: Array.from({ length: 6 }, (_, i) => 42 + i), // 42-47
  mouth: Array.from({ length: 20 }, (_, i) => 48 + i), // 48-67
} as const;

/**
 * 距離を計算
 */
function calculateDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 角度を計算（3点間）
 */
function calculateAngle(p1: Point, p2: Point, p3: Point): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
}

/**
 * 解剖学的制約を生成
 */
export function generateAnatomicalConstraints(
  landmarks: FaceLandmarks,
  imageScale: { x: number; y: number }
): AnatomicalConstraint[] {
  const constraints: AnatomicalConstraint[] = [];
  
  // すべての特徴点を統合
  const allPoints: Point[] = [
    ...landmarks.jawline.map(p => ({ x: p.x * imageScale.x, y: p.y * imageScale.y })),
    ...landmarks.rightEyebrow.map(p => ({ x: p.x * imageScale.x, y: p.y * imageScale.y })),
    ...landmarks.leftEyebrow.map(p => ({ x: p.x * imageScale.x, y: p.y * imageScale.y })),
    ...landmarks.nose.map(p => ({ x: p.x * imageScale.x, y: p.y * imageScale.y })),
    ...landmarks.rightEye.map(p => ({ x: p.x * imageScale.x, y: p.y * imageScale.y })),
    ...landmarks.leftEye.map(p => ({ x: p.x * imageScale.x, y: p.y * imageScale.y })),
    ...landmarks.mouth.map(p => ({ x: p.x * imageScale.x, y: p.y * imageScale.y }))
  ];

  // 1. 目の形状制約
  addEyeConstraints(constraints, allPoints);
  
  // 2. 口の形状制約
  addMouthConstraints(constraints, allPoints);
  
  // 3. 鼻の形状制約
  addNoseConstraints(constraints, allPoints);
  
  // 4. 顔全体の対称性制約
  addSymmetryConstraints(constraints, allPoints);
  
  // 5. プロポーション制約
  addProportionConstraints(constraints, allPoints);

  console.log(`🧬 解剖学的制約生成: ${constraints.length}個の制約`);
  return constraints;
}

/**
 * 目の形状制約を追加
 */
function addEyeConstraints(constraints: AnatomicalConstraint[], points: Point[]): void {
  // 右目の幅制約
  const rightEyeWidth = calculateDistance(points[36], points[39]);
  constraints.push({
    type: 'distance',
    points: [36, 39],
    originalValue: rightEyeWidth,
    tolerance: 0.3,
    weight: 0.8
  });

  // 左目の幅制約
  const leftEyeWidth = calculateDistance(points[42], points[45]);
  constraints.push({
    type: 'distance',
    points: [42, 45],
    originalValue: leftEyeWidth,
    tolerance: 0.3,
    weight: 0.8
  });

  // 目の高さ制約
  const rightEyeHeight = calculateDistance(points[37], points[41]);
  constraints.push({
    type: 'distance',
    points: [37, 41],
    originalValue: rightEyeHeight,
    tolerance: 0.4,
    weight: 0.7
  });

  const leftEyeHeight = calculateDistance(points[43], points[47]);
  constraints.push({
    type: 'distance',
    points: [43, 47],
    originalValue: leftEyeHeight,
    tolerance: 0.4,
    weight: 0.7
  });

  // 目の角度制約（目尻の角度）
  const rightEyeAngle = calculateAngle(points[36], points[39], points[42]);
  constraints.push({
    type: 'angle',
    points: [36, 39, 42],
    originalValue: rightEyeAngle,
    tolerance: 0.2,
    weight: 0.6
  });
}

/**
 * 口の形状制約を追加
 */
function addMouthConstraints(constraints: AnatomicalConstraint[], points: Point[]): void {
  // 口の幅制約
  const mouthWidth = calculateDistance(points[48], points[54]);
  constraints.push({
    type: 'distance',
    points: [48, 54],
    originalValue: mouthWidth,
    tolerance: 0.4,
    weight: 0.8
  });

  // 口の高さ制約
  const mouthHeight = calculateDistance(points[51], points[57]);
  constraints.push({
    type: 'distance',
    points: [51, 57],
    originalValue: mouthHeight,
    tolerance: 0.5,
    weight: 0.7
  });

  // 口角の角度制約
  const mouthCornerAngle = calculateAngle(points[48], points[51], points[54]);
  constraints.push({
    type: 'angle',
    points: [48, 51, 54],
    originalValue: mouthCornerAngle,
    tolerance: 0.3,
    weight: 0.6
  });
}

/**
 * 鼻の形状制約を追加
 */
function addNoseConstraints(constraints: AnatomicalConstraint[], points: Point[]): void {
  // 鼻の幅制約
  const noseWidth = calculateDistance(points[31], points[35]);
  constraints.push({
    type: 'distance',
    points: [31, 35],
    originalValue: noseWidth,
    tolerance: 0.3,
    weight: 0.8
  });

  // 鼻の高さ制約
  const noseHeight = calculateDistance(points[27], points[33]);
  constraints.push({
    type: 'distance',
    points: [27, 33],
    originalValue: noseHeight,
    tolerance: 0.4,
    weight: 0.7
  });
}

/**
 * 対称性制約を追加
 */
function addSymmetryConstraints(constraints: AnatomicalConstraint[], points: Point[]): void {
  // 目の対称性（Y座標の差）
  const eyeSymmetryY = Math.abs(points[39].y - points[42].y);
  constraints.push({
    type: 'symmetry',
    points: [39, 42],
    originalValue: eyeSymmetryY,
    tolerance: 0.1,
    weight: 0.9
  });

  // 目の対称性（サイズ）
  const rightEyeSize = calculateDistance(points[36], points[39]);
  const leftEyeSize = calculateDistance(points[42], points[45]);
  const eyeSizeRatio = leftEyeSize / rightEyeSize;
  constraints.push({
    type: 'proportion',
    points: [36, 39, 42, 45],
    originalValue: eyeSizeRatio,
    tolerance: 0.2,
    weight: 0.8
  });
}

/**
 * プロポーション制約を追加
 */
function addProportionConstraints(constraints: AnatomicalConstraint[], points: Point[]): void {
  // 目と口の距離比
  const eyeToMouthDistance = calculateDistance(
    { x: (points[39].x + points[42].x) / 2, y: (points[39].y + points[42].y) / 2 },
    { x: (points[48].x + points[54].x) / 2, y: (points[48].y + points[54].y) / 2 }
  );
  
  const faceHeight = calculateDistance(points[8], points[27]); // 顎から額まで
  const eyeMouthRatio = eyeToMouthDistance / faceHeight;
  
  constraints.push({
    type: 'proportion',
    points: [39, 42, 48, 54, 8, 27],
    originalValue: eyeMouthRatio,
    tolerance: 0.1,
    weight: 0.7
  });
}

/**
 * 制約違反を計算
 */
export function calculateConstraintViolations(
  controlPoints: TPSControlPoint[],
  constraints: AnatomicalConstraint[]
): { totalViolation: number; violations: { constraint: AnatomicalConstraint; violation: number }[] } {
  const violations: { constraint: AnatomicalConstraint; violation: number }[] = [];
  let totalViolation = 0;

  // 制御点から全特徴点の配列を再構築
  const currentPoints = new Array(68);
  controlPoints.forEach((cp, index) => {
    if (index < 68) {
      currentPoints[index] = cp.target;
    }
  });

  constraints.forEach(constraint => {
    let violation = 0;
    
    switch (constraint.type) {
      case 'distance':
        if (constraint.points.length >= 2) {
          const p1 = currentPoints[constraint.points[0]];
          const p2 = currentPoints[constraint.points[1]];
          if (p1 && p2) {
            const currentDistance = calculateDistance(p1, p2);
            const relativeChange = Math.abs(currentDistance - constraint.originalValue) / constraint.originalValue;
            violation = Math.max(0, relativeChange - constraint.tolerance);
          }
        }
        break;
        
      case 'angle':
        if (constraint.points.length >= 3) {
          const p1 = currentPoints[constraint.points[0]];
          const p2 = currentPoints[constraint.points[1]];
          const p3 = currentPoints[constraint.points[2]];
          if (p1 && p2 && p3) {
            const currentAngle = calculateAngle(p1, p2, p3);
            const angleChange = Math.abs(currentAngle - constraint.originalValue);
            violation = Math.max(0, angleChange - constraint.tolerance);
          }
        }
        break;
        
      case 'symmetry':
        if (constraint.points.length >= 2) {
          const p1 = currentPoints[constraint.points[0]];
          const p2 = currentPoints[constraint.points[1]];
          if (p1 && p2) {
            const currentSymmetry = Math.abs(p1.y - p2.y);
            violation = Math.max(0, currentSymmetry - constraint.tolerance);
          }
        }
        break;
        
      case 'proportion':
        // プロポーション制約の計算（簡略化）
        violation = 0;
        break;
    }
    
    const weightedViolation = violation * constraint.weight;
    violations.push({ constraint, violation: weightedViolation });
    totalViolation += weightedViolation;
  });

  return { totalViolation, violations };
}

/**
 * 制約を満たすように制御点を調整
 */
export function applyAnatomicalConstraints(
  controlPoints: TPSControlPoint[],
  constraints: AnatomicalConstraint[],
  maxIterations: number = 10,
  convergenceThreshold: number = 0.01
): TPSControlPoint[] {
  console.log('🧬 解剖学的制約適用開始');
  
  const adjustedPoints = [...controlPoints];
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const { totalViolation, violations } = calculateConstraintViolations(adjustedPoints, constraints);
    
    console.log(`🔄 制約適用 ${iteration + 1}/${maxIterations}: 違反度 ${totalViolation.toFixed(4)}`);
    
    if (totalViolation < convergenceThreshold) {
      console.log('✅ 制約収束完了');
      break;
    }
    
    // 最も大きな違反から修正
    violations.sort((a, b) => b.violation - a.violation);
    
    violations.slice(0, 3).forEach(({ constraint, violation }) => {
      if (violation > 0.001) {
        adjustConstraintViolation(adjustedPoints, constraint, violation);
      }
    });
  }
  
  console.log('✅ 解剖学的制約適用完了');
  return adjustedPoints;
}

/**
 * 特定の制約違反を修正
 */
function adjustConstraintViolation(
  controlPoints: TPSControlPoint[],
  constraint: AnatomicalConstraint,
  violation: number
): void {
  const adjustmentFactor = Math.min(0.1, violation * 0.5); // 小さな調整
  
  constraint.points.forEach(pointIndex => {
    if (pointIndex < controlPoints.length) {
      const cp = controlPoints[pointIndex];
      
      // 制約の種類に応じた調整
      switch (constraint.type) {
        case 'distance': {
          // 距離制約違反の場合、中心に向かって調整
          const adjustment = {
            x: (cp.original.x - cp.target.x) * adjustmentFactor,
            y: (cp.original.y - cp.target.y) * adjustmentFactor
          };
          cp.target.x += adjustment.x;
          cp.target.y += adjustment.y;
          break;
        }
          
        case 'symmetry':
          // 対称性制約違反の場合、Y座標を調整
          if (constraint.points.length >= 2) {
            const otherIndex = constraint.points.find(i => i !== pointIndex);
            if (otherIndex !== undefined && otherIndex < controlPoints.length) {
              const otherCP = controlPoints[otherIndex];
              const avgY = (cp.target.y + otherCP.target.y) / 2;
              cp.target.y += (avgY - cp.target.y) * adjustmentFactor;
            }
          }
          break;
      }
    }
  });
}
