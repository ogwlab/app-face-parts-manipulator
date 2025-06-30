#!/usr/bin/env python3
"""
スタンドアロン顔特徴点調整デモ
ブラウザ不要でローカル実行
"""

import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import os
import sys

# MediaPipe設定
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

LANDMARK_GROUPS = {
    'nose_tip': {'indices': [1, 2], 'color': (0, 255, 0), 'size': 12, 'label': '鼻先'},
    'nose_bridge': {'indices': [6, 9], 'color': (0, 170, 0), 'size': 8, 'label': '鼻梁'},
    'left_nostril': {'indices': [131, 134, 126], 'color': (255, 0, 0), 'size': 10, 'label': '左小鼻'},
    'right_nostril': {'indices': [102, 49, 48], 'color': (255, 102, 0), 'size': 10, 'label': '右小鼻'},
    'left_eye_center': {'indices': [159, 158, 157, 173], 'color': (0, 0, 255), 'size': 10, 'label': '左目'},
    'right_eye_center': {'indices': [386, 385, 384, 398], 'color': (0, 102, 255), 'size': 10, 'label': '右目'}
}

def calculate_landmark_center(landmarks, indices, image_shape):
    """複数のランドマークの中心座標を計算"""
    h, w = image_shape[:2]
    
    points = []
    for idx in indices:
        if idx < len(landmarks.landmark):
            point = landmarks.landmark[idx]
            points.append({
                'x': point.x * w,
                'y': point.y * h
            })
    
    if not points:
        return None
    
    center_x = sum(p['x'] for p in points) / len(points)
    center_y = sum(p['y'] for p in points) / len(points)
    
    return {'x': center_x, 'y': center_y}

def detect_and_draw_landmarks(image_path, output_path):
    """顔特徴点を検出して描画"""
    # 画像を読み込み
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ 画像の読み込みに失敗: {image_path}")
        return False
    
    print(f"✅ 画像を読み込み: {image.shape}")
    
    # MediaPipe Face Meshを初期化
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    )
    
    # BGR→RGB変換
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_image)
    
    if not results.multi_face_landmarks:
        print("❌ 顔を検出できませんでした")
        return False
    
    print("✅ 顔を検出しました！")
    landmarks = results.multi_face_landmarks[0]
    
    # 注釈付き画像を作成
    annotated_image = image.copy()
    
    # 基本的な顔メッシュを描画
    mp_drawing.draw_landmarks(
        image=annotated_image,
        landmark_list=landmarks,
        connections=mp_face_mesh.FACEMESH_CONTOURS,
        landmark_drawing_spec=None,
        connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
    )
    
    # 重要特徴点を強調描画
    print("\n📍 検出された特徴点:")
    for name, config in LANDMARK_GROUPS.items():
        center = calculate_landmark_center(landmarks, config['indices'], image.shape)
        if center:
            x, y = int(center['x']), int(center['y'])
            print(f"  {config['label']}: ({x}, {y})")
            
            # 特徴点を描画
            cv2.circle(annotated_image, (x, y), config['size'], config['color'], -1)
            cv2.circle(annotated_image, (x, y), config['size'] + 2, (255, 255, 255), 2)
            
            # ラベルを描画
            cv2.putText(annotated_image, config['label'], 
                       (x + 15, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    # 結果を保存
    cv2.imwrite(output_path, annotated_image)
    print(f"\n✅ 結果画像を保存: {output_path}")
    
    # 画像を表示（オプション）
    try:
        cv2.imshow('Face Landmarks', annotated_image)
        print("\n👁️  画像を表示中... 'q'キーで閉じます")
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    except:
        print("💡 画像表示がサポートされていません")
    
    return True

def create_sample_image():
    """サンプル顔画像を作成"""
    # 400x400の画像を作成
    img = np.ones((400, 400, 3), dtype=np.uint8) * 240
    
    # 顔の輪郭
    cv2.ellipse(img, (200, 200), (120, 150), 0, 0, 360, (220, 220, 220), -1)
    
    # 目
    cv2.circle(img, (170, 170), 15, (50, 50, 50), -1)  # 左目
    cv2.circle(img, (230, 170), 15, (50, 50, 50), -1)  # 右目
    cv2.circle(img, (175, 170), 5, (255, 255, 255), -1)  # 左目ハイライト
    cv2.circle(img, (235, 170), 5, (255, 255, 255), -1)  # 右目ハイライト
    
    # 鼻
    pts = np.array([[200, 200], [195, 220], [205, 220]], np.int32)
    cv2.fillPoly(img, [pts], (180, 180, 180))
    
    # 口
    cv2.ellipse(img, (200, 250), (25, 15), 0, 0, 180, (100, 100, 100), 3)
    
    # 眉毛
    cv2.ellipse(img, (170, 150), (20, 8), 15, 0, 180, (100, 100, 100), 3)
    cv2.ellipse(img, (230, 150), (20, 8), 165, 0, 180, (100, 100, 100), 3)
    
    return img

def main():
    """メイン関数"""
    print("🎭 スタンドアロン顔特徴点検出デモ")
    print("=" * 50)
    
    # 引数で画像パスが指定された場合
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if not os.path.exists(image_path):
            print(f"❌ ファイルが見つかりません: {image_path}")
            return
        
        base_name = os.path.splitext(image_path)[0]
        output_path = f"{base_name}_landmarks.jpg"
        
        success = detect_and_draw_landmarks(image_path, output_path)
        if success:
            print(f"\n🎉 完了！結果は {output_path} に保存されました。")
        
    else:
        print("📷 サンプル画像を作成してテストします...")
        
        # サンプル画像を作成
        sample_image = create_sample_image()
        sample_path = "sample_face.jpg"
        cv2.imwrite(sample_path, sample_image)
        print(f"✅ サンプル画像を作成: {sample_path}")
        
        # 検出を実行
        output_path = "sample_face_landmarks.jpg"
        success = detect_and_draw_landmarks(sample_path, output_path)
        
        if success:
            print(f"\n🎉 テスト完了！")
            print(f"📁 生成されたファイル:")
            print(f"  - 元画像: {sample_path}")
            print(f"  - 結果画像: {output_path}")
        
        # サンプルファイルを削除
        try:
            os.remove(sample_path)
        except:
            pass
    
    print(f"\n💡 使い方:")
    print(f"  python {sys.argv[0]} <画像ファイル>")
    print(f"  例: python {sys.argv[0]} my_face.jpg")

if __name__ == "__main__":
    main()