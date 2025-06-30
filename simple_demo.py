#!/usr/bin/env python3
"""
シンプルな顔特徴点検出デモ（Streamlit不要）
MediaPipe、OpenCV、PILのみ使用
"""

import sys
import os

def check_dependencies():
    """依存関係をチェック"""
    missing = []
    
    try:
        import cv2
        print("✅ OpenCV OK")
    except ImportError:
        missing.append("opencv-python")
    
    try:
        import numpy as np
        print("✅ NumPy OK")
    except ImportError:
        missing.append("numpy")
    
    try:
        from PIL import Image
        print("✅ Pillow OK")
    except ImportError:
        missing.append("pillow")
    
    try:
        import mediapipe as mp
        print("✅ MediaPipe OK")
    except ImportError:
        missing.append("mediapipe")
    
    if missing:
        print(f"\n❌ 不足しているライブラリ: {', '.join(missing)}")
        print("以下のコマンドでインストールしてください:")
        print(f"pip install {' '.join(missing)}")
        return False
    
    print("\n🎉 全ての依存関係が揃っています！")
    return True

def simple_face_detection():
    """シンプルな顔検出テスト"""
    if not check_dependencies():
        return
    
    import cv2
    import mediapipe as mp
    import numpy as np
    
    # MediaPipe Face Meshを初期化
    mp_face_mesh = mp.solutions.face_mesh
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles
    
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    )
    
    # サンプル画像の作成（テスト用）
    print("\n📷 テスト用の簡単な画像を作成中...")
    
    # 300x300の白い画像を作成
    test_image = np.ones((300, 300, 3), dtype=np.uint8) * 255
    
    # 簡単な顔のような図形を描画（楕円と点）
    cv2.ellipse(test_image, (150, 150), (80, 100), 0, 0, 360, (200, 200, 200), -1)  # 顔の輪郭
    cv2.circle(test_image, (130, 130), 5, (0, 0, 0), -1)  # 左目
    cv2.circle(test_image, (170, 130), 5, (0, 0, 0), -1)  # 右目
    cv2.circle(test_image, (150, 150), 3, (0, 0, 0), -1)  # 鼻
    cv2.ellipse(test_image, (150, 180), (20, 10), 0, 0, 180, (0, 0, 0), 2)  # 口
    
    # 画像を保存
    test_path = "test_face.jpg"
    cv2.imwrite(test_path, test_image)
    print(f"✅ テスト画像を作成しました: {test_path}")
    
    # 顔検出を試行
    print("\n🔍 顔検出を実行中...")
    rgb_image = cv2.cvtColor(test_image, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_image)
    
    if results.multi_face_landmarks:
        print("✅ 顔を検出しました！")
        landmarks = results.multi_face_landmarks[0]
        print(f"📍 特徴点数: {len(landmarks.landmark)}")
        
        # 特徴点を描画
        annotated_image = test_image.copy()
        mp_drawing.draw_landmarks(
            image=annotated_image,
            landmark_list=landmarks,
            connections=mp_face_mesh.FACEMESH_CONTOURS,
            landmark_drawing_spec=None,
            connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
        )
        
        # 結果を保存
        result_path = "test_face_detected.jpg"
        cv2.imwrite(result_path, annotated_image)
        print(f"✅ 検出結果を保存しました: {result_path}")
        
        print("\n🎉 基本機能は正常に動作しています！")
        print("📝 Streamlitアプリも正常に動作するはずです。")
        
    else:
        print("❌ テスト画像では顔を検出できませんでした")
        print("💡 実際の顔写真を使用してください")
    
    # クリーンアップ
    try:
        os.remove(test_path)
        print(f"🗑️  テスト画像を削除しました: {test_path}")
    except:
        pass

def main():
    """メイン関数"""
    print("🔬 顔特徴点検出システム - 動作確認")
    print("=" * 50)
    
    simple_face_detection()
    
    print("\n📋 次のステップ:")
    print("1. 依存関係が全て揃っていれば、Streamlitアプリが動作します")
    print("2. ブラウザの問題の場合は、以下を試してください:")
    print("   - 別のブラウザを使用")
    print("   - プライベート/シークレットモードで開く")
    print("   - ブラウザのキャッシュをクリア")
    print("3. ポートの問題の場合は、以下のコマンドを試してください:")
    print("   streamlit run src/app_final.py --server.port=8505")

if __name__ == "__main__":
    main()