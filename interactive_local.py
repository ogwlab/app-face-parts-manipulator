#!/usr/bin/env python3
"""
ローカル実行可能な顔特徴点調整ツール
ブラウザ不要・GUI付き（OpenCV使用）
"""

import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import os
import sys
import math
from typing import Dict, List, Tuple, Optional

# MediaPipe設定
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# 定数
WINDOW_NAME = "顔特徴点調整ツール"
CANVAS_SIZE = (800, 600)

LANDMARK_GROUPS = {
    'nose_tip': {'indices': [1, 2], 'color': (0, 255, 0), 'size': 12, 'label': '鼻先'},
    'nose_bridge': {'indices': [6, 9], 'color': (0, 170, 0), 'size': 8, 'label': '鼻梁'},
    'left_nostril': {'indices': [131, 134, 126], 'color': (255, 0, 0), 'size': 10, 'label': '左小鼻'},
    'right_nostril': {'indices': [102, 49, 48], 'color': (255, 102, 0), 'size': 10, 'label': '右小鼻'},
    'left_eye_center': {'indices': [159, 158, 157, 173], 'color': (0, 0, 255), 'size': 10, 'label': '左目'},
    'right_eye_center': {'indices': [386, 385, 384, 398], 'color': (0, 102, 255), 'size': 10, 'label': '右目'}
}

class FaceLandmarkEditor:
    def __init__(self):
        self.image = None
        self.landmarks = None
        self.landmark_positions = {}
        self.adjustments = {}
        self.history = []
        self.selected_point = None
        self.dragging = False
        self.last_mouse_pos = None
        self.scale_factor = 1.0
        self.offset = (0, 0)
        
        # MediaPipe Face Mesh初期化
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )
    
    def calculate_landmark_center(self, landmarks, indices: List[int]) -> Optional[Dict[str, float]]:
        """複数のランドマークの中心座標を計算"""
        if not self.image is None:
            h, w = self.image.shape[:2]
        else:
            return None
        
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
    
    def load_image(self, image_path: str) -> bool:
        """画像を読み込んで顔検出を実行"""
        # 画像読み込み
        self.image = cv2.imread(image_path)
        if self.image is None:
            print(f"❌ 画像の読み込みに失敗: {image_path}")
            return False
        
        print(f"✅ 画像を読み込み: {self.image.shape}")
        
        # 顔検出
        rgb_image = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_image)
        
        if not results.multi_face_landmarks:
            print("❌ 顔を検出できませんでした")
            return False
        
        print("✅ 顔を検出しました！")
        self.landmarks = results.multi_face_landmarks[0]
        
        # 特徴点位置を計算
        self.landmark_positions = {}
        for name, config in LANDMARK_GROUPS.items():
            center = self.calculate_landmark_center(self.landmarks, config['indices'])
            if center:
                self.landmark_positions[name] = center
        
        # 表示用のスケーリングを計算
        self.calculate_display_params()
        
        print(f"📍 {len(self.landmark_positions)}個の主要特徴点を検出")
        return True
    
    def calculate_display_params(self):
        """表示用のスケーリングパラメータを計算"""
        if self.image is None:
            return
        
        h, w = self.image.shape[:2]
        canvas_w, canvas_h = CANVAS_SIZE
        
        # アスペクト比を保持してスケーリング
        scale_x = canvas_w / w
        scale_y = canvas_h / h
        self.scale_factor = min(scale_x, scale_y)
        
        # 中央配置のためのオフセット
        scaled_w = int(w * self.scale_factor)
        scaled_h = int(h * self.scale_factor)
        self.offset = ((canvas_w - scaled_w) // 2, (canvas_h - scaled_h) // 2)
    
    def image_to_canvas(self, x: float, y: float) -> Tuple[int, int]:
        """画像座標をキャンバス座標に変換"""
        canvas_x = int(x * self.scale_factor + self.offset[0])
        canvas_y = int(y * self.scale_factor + self.offset[1])
        return canvas_x, canvas_y
    
    def canvas_to_image(self, canvas_x: int, canvas_y: int) -> Tuple[float, float]:
        """キャンバス座標を画像座標に変換"""
        x = (canvas_x - self.offset[0]) / self.scale_factor
        y = (canvas_y - self.offset[1]) / self.scale_factor
        return x, y
    
    def find_nearest_landmark(self, canvas_x: int, canvas_y: int, threshold: int = 20) -> Optional[str]:
        """最も近い特徴点を見つける"""
        min_distance = float('inf')
        nearest_point = None
        
        for name, pos in self.landmark_positions.items():
            # 調整済み位置があればそれを使用
            if name in self.adjustments:
                pos = self.adjustments[name]
            
            point_x, point_y = self.image_to_canvas(pos['x'], pos['y'])
            distance = math.sqrt((canvas_x - point_x)**2 + (canvas_y - point_y)**2)
            
            if distance < threshold and distance < min_distance:
                min_distance = distance
                nearest_point = name
        
        return nearest_point
    
    def save_to_history(self):
        """現在の状態を履歴に保存"""
        self.history.append(self.adjustments.copy())
        if len(self.history) > 20:  # 履歴を制限
            self.history.pop(0)
    
    def undo(self):
        """操作を元に戻す"""
        if self.history:
            self.adjustments = self.history.pop()
            return True
        return False
    
    def reset_adjustments(self):
        """調整をリセット"""
        self.adjustments = {}
        self.history = []
    
    def mouse_callback(self, event, x, y, flags, param):
        """マウスイベントのコールバック"""
        if event == cv2.EVENT_LBUTTONDOWN:
            # 特徴点を選択
            self.selected_point = self.find_nearest_landmark(x, y)
            if self.selected_point:
                self.dragging = True
                self.save_to_history()
                print(f"🎯 {LANDMARK_GROUPS[self.selected_point]['label']}を選択")
            self.last_mouse_pos = (x, y)
        
        elif event == cv2.EVENT_MOUSEMOVE and self.dragging and self.selected_point:
            # ドラッグ中の更新
            img_x, img_y = self.canvas_to_image(x, y)
            self.adjustments[self.selected_point] = {'x': img_x, 'y': img_y}
            print(f"📍 {LANDMARK_GROUPS[self.selected_point]['label']}: ({img_x:.1f}, {img_y:.1f})")
        
        elif event == cv2.EVENT_LBUTTONUP:
            # ドラッグ終了
            if self.dragging and self.selected_point:
                print(f"✅ {LANDMARK_GROUPS[self.selected_point]['label']}の調整完了")
            self.dragging = False
            self.selected_point = None
    
    def draw_image(self) -> np.ndarray:
        """描画用の画像を作成"""
        if self.image is None:
            return np.zeros((CANVAS_SIZE[1], CANVAS_SIZE[0], 3), dtype=np.uint8)
        
        # キャンバスサイズの画像を作成
        canvas = np.zeros((CANVAS_SIZE[1], CANVAS_SIZE[0], 3), dtype=np.uint8)
        
        # 画像をリサイズして配置
        h, w = self.image.shape[:2]
        scaled_w = int(w * self.scale_factor)
        scaled_h = int(h * self.scale_factor)
        resized_image = cv2.resize(self.image, (scaled_w, scaled_h))
        
        # 画像を中央に配置
        y_start = self.offset[1]
        y_end = y_start + scaled_h
        x_start = self.offset[0] 
        x_end = x_start + scaled_w
        canvas[y_start:y_end, x_start:x_end] = resized_image
        
        # 基本的な顔メッシュを描画（リサイズ後の画像に）
        if self.landmarks:
            # スケーリングされた座標でランドマークを描画
            temp_landmarks = self.landmarks
            annotated_resized = resized_image.copy()
            
            mp_drawing.draw_landmarks(
                image=annotated_resized,
                landmark_list=temp_landmarks,
                connections=mp_face_mesh.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
            )
            
            canvas[y_start:y_end, x_start:x_end] = annotated_resized
        
        # 特徴点を描画
        for name, config in LANDMARK_GROUPS.items():
            if name in self.landmark_positions:
                # 調整済み位置があればそれを使用
                pos = self.adjustments.get(name, self.landmark_positions[name])
                
                canvas_x, canvas_y = self.image_to_canvas(pos['x'], pos['y'])
                
                # 選択中の点は強調表示
                if name == self.selected_point:
                    cv2.circle(canvas, (canvas_x, canvas_y), config['size'] + 5, (255, 255, 255), 3)
                
                # 特徴点を描画
                cv2.circle(canvas, (canvas_x, canvas_y), config['size'], config['color'], -1)
                cv2.circle(canvas, (canvas_x, canvas_y), config['size'] + 2, (255, 255, 255), 2)
                
                # 調整済みの点にはマークを表示
                if name in self.adjustments:
                    cv2.putText(canvas, "✓", (canvas_x + 15, canvas_y - 5),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        return canvas
    
    def draw_info_panel(self, canvas: np.ndarray):
        """情報パネルを描画"""
        # 操作説明
        info_text = [
            "操作方法:",
            "・色付きの点をドラッグして調整",
            "・'u': 元に戻す",
            "・'r': リセット", 
            "・'s': 保存",
            "・'q': 終了",
            "",
            f"調整済み: {len(self.adjustments)}個"
        ]
        
        y_offset = 30
        for i, text in enumerate(info_text):
            cv2.putText(canvas, text, (10, y_offset + i * 25),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        
        # 特徴点の説明
        legend_text = [
            "特徴点:",
            "緑: 鼻 (大=先端, 小=梁)",
            "青: 小鼻 (濃=左, 明=右)",
            "赤: 目 (濃=左, 明=右)"
        ]
        
        y_offset = CANVAS_SIZE[1] - 120
        for i, text in enumerate(legend_text):
            cv2.putText(canvas, text, (10, y_offset + i * 25),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    
    def save_result(self, output_path: str):
        """結果を保存"""
        if self.image is None or not self.adjustments:
            print("❌ 保存するデータがありません")
            return False
        
        # 元画像に調整済み特徴点を描画
        result_image = self.image.copy()
        
        # 基本的な顔メッシュを描画
        mp_drawing.draw_landmarks(
            image=result_image,
            landmark_list=self.landmarks,
            connections=mp_face_mesh.FACEMESH_CONTOURS,
            landmark_drawing_spec=None,
            connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
        )
        
        # 調整済み特徴点を描画
        for name, pos in self.adjustments.items():
            config = LANDMARK_GROUPS[name]
            x, y = int(pos['x']), int(pos['y'])
            
            cv2.circle(result_image, (x, y), config['size'], config['color'], -1)
            cv2.circle(result_image, (x, y), config['size'] + 2, (255, 255, 255), 2)
            cv2.putText(result_image, config['label'], (x + 15, y - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        cv2.imwrite(output_path, result_image)
        print(f"✅ 結果を保存: {output_path}")
        return True
    
    def run(self, image_path: str):
        """メインループ"""
        if not self.load_image(image_path):
            return False
        
        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(WINDOW_NAME, self.mouse_callback)
        
        print("\n🎮 操作開始！")
        print("📖 操作方法:")
        print("  ・色付きの点をドラッグして位置を調整")
        print("  ・'u'キー: 元に戻す")
        print("  ・'r'キー: 全てリセット")
        print("  ・'s'キー: 結果を保存")
        print("  ・'q'キー: 終了")
        
        while True:
            # 画像を描画
            canvas = self.draw_image()
            self.draw_info_panel(canvas)
            
            cv2.imshow(WINDOW_NAME, canvas)
            
            # キー入力処理
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('q'):
                break
            elif key == ord('u'):
                if self.undo():
                    print("↶ 操作を元に戻しました")
                else:
                    print("❌ 元に戻す操作がありません")
            elif key == ord('r'):
                self.reset_adjustments()
                print("🔄 調整をリセットしました")
            elif key == ord('s'):
                base_name = os.path.splitext(image_path)[0]
                output_path = f"{base_name}_adjusted.jpg"
                self.save_result(output_path)
        
        cv2.destroyAllWindows()
        return True

def main():
    """メイン関数"""
    print("🎭 ローカル顔特徴点調整ツール")
    print("=" * 50)
    
    if len(sys.argv) != 2:
        print("使用方法: python interactive_local.py <画像ファイル>")
        print("例: python interactive_local.py face.jpg")
        return
    
    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"❌ ファイルが見つかりません: {image_path}")
        return
    
    editor = FaceLandmarkEditor()
    success = editor.run(image_path)
    
    if success:
        print("\n🎉 セッション完了！")
        if editor.adjustments:
            print(f"📍 {len(editor.adjustments)}個の特徴点を調整しました")
            for name, pos in editor.adjustments.items():
                label = LANDMARK_GROUPS[name]['label']
                print(f"  {label}: ({pos['x']:.1f}, {pos['y']:.1f})")
    else:
        print("\n❌ セッションが失敗しました")

if __name__ == "__main__":
    main()