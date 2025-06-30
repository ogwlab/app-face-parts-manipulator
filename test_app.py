#!/usr/bin/env python3
"""
テスト用のシンプルな顔特徴点検出スクリプト
ブラウザ不要でローカルで実行可能
"""

import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import sys
import os

# MediaPipe設定
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# 特徴点グループ定義
LANDMARK_GROUPS = {
    'nose_tip': {'indices': [1, 2], 'label': '鼻先'},
    'nose_bridge': {'indices': [6, 9], 'label': '鼻梁'},
    'left_nostril': {'indices': [131, 134, 126], 'label': '左小鼻'},
    'right_nostril': {'indices': [102, 49, 48], 'label': '右小鼻'},
    'left_eye_center': {'indices': [159, 158, 157, 173], 'label': '左目'},
    'right_eye_center': {'indices': [386, 385, 384, 398], 'label': '右目'}
}

def detect_face_landmarks(image_path):
    """顔特徴点を検出してテスト"""
    # 画像を読み込み
    if not os.path.exists(image_path):
        print(f"❌ 画像ファイルが見つかりません: {image_path}")
        return False
    
    try:
        # OpenCVで画像を読み込み
        image = cv2.imread(image_path)
        if image is None:
            print(f"❌ 画像の読み込みに失敗しました: {image_path}")
            return False
        
        print(f"✅ 画像を読み込みました: {image.shape}")
        
        # MediaPipe Face Meshを初期化
        face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )
        
        # BGRからRGBに変換
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_image)
        
        if not results.multi_face_landmarks:
            print("❌ 顔を検出できませんでした")
            return False
        
        print("✅ 顔を検出しました！")
        landmarks = results.multi_face_landmarks[0]
        print(f"✅ 特徴点数: {len(landmarks.landmark)}")
        
        # 重要な特徴点の座標を計算
        h, w = image.shape[:2]
        print(f"\n📍 主要特徴点の座標:")
        
        for name, config in LANDMARK_GROUPS.items():
            # 複数点の平均を計算
            points = []
            for idx in config['indices']:
                if idx < len(landmarks.landmark):
                    point = landmarks.landmark[idx]
                    points.append({
                        'x': point.x * w,
                        'y': point.y * h
                    })
            
            if points:
                center_x = sum(p['x'] for p in points) / len(points)
                center_y = sum(p['y'] for p in points) / len(points)
                print(f"  {config['label']}: ({center_x:.1f}, {center_y:.1f})")
        
        # 注釈付き画像を作成
        annotated_image = image.copy()
        
        # 顔メッシュを描画
        mp_drawing.draw_landmarks(
            image=annotated_image,
            landmark_list=landmarks,
            connections=mp_face_mesh.FACEMESH_CONTOURS,
            landmark_drawing_spec=None,
            connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
        )
        
        # 重要特徴点を強調
        colors = {
            'nose_tip': (0, 255, 0),      # 緑
            'nose_bridge': (0, 170, 0),   # 暗い緑
            'left_nostril': (255, 0, 0),  # 青
            'right_nostril': (255, 102, 0), # 明るい青
            'left_eye_center': (0, 0, 255),  # 赤
            'right_eye_center': (0, 102, 255) # オレンジ
        }
        
        for name, config in LANDMARK_GROUPS.items():
            points = []
            for idx in config['indices']:
                if idx < len(landmarks.landmark):
                    point = landmarks.landmark[idx]
                    points.append({
                        'x': point.x * w,
                        'y': point.y * h
                    })
            
            if points:
                center_x = int(sum(p['x'] for p in points) / len(points))
                center_y = int(sum(p['y'] for p in points) / len(points))
                
                color = colors.get(name, (255, 255, 255))
                cv2.circle(annotated_image, (center_x, center_y), 8, color, -1)
                cv2.circle(annotated_image, (center_x, center_y), 10, (255, 255, 255), 2)
        
        # 結果画像を保存
        output_path = image_path.replace('.', '_detected.')
        cv2.imwrite(output_path, annotated_image)
        print(f"\n✅ 結果画像を保存しました: {output_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {str(e)}")
        return False

def main():
    """メイン関数"""
    print("🔍 顔特徴点検出テスト")
    print("=" * 50)
    
    # 引数で画像パスが指定された場合
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        success = detect_face_landmarks(image_path)
        if success:
            print("\n🎉 テスト完了！Streamlitアプリも正常に動作するはずです。")
        else:
            print("\n❌ テスト失敗。画像や環境を確認してください。")
    else:
        print("使用方法: python test_app.py <画像ファイルパス>")
        print("例: python test_app.py sample_face.jpg")
        
        # サンプル画像のパスを提案
        possible_paths = [
            "sample.jpg", "test.jpg", "face.jpg", "image.jpg",
            "~/Downloads/sample.jpg", "~/Desktop/sample.jpg"
        ]
        
        print("\n📁 以下のような画像ファイルを用意してください:")
        print("  - 顔が正面を向いた画像")
        print("  - JPG、PNG、BMP形式")
        print("  - 500x500ピクセル以上推奨")

if __name__ == "__main__":
    main()