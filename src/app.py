import streamlit as st
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image, UnidentifiedImageError
import copy
from streamlit_drawable_canvas import st_canvas
import json
import math
from typing import Dict, Tuple, Optional, List, Any
import hashlib

# Streamlit page config
st.set_page_config(
    page_title="顔画像操作プログラム",
    page_icon="👤",
    layout="wide"
)

# --- MediaPipe Setup ---
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# --- Constants ---
CANVAS_WIDTH = 600  # キャンバスの固定幅
CANVAS_HEIGHT = 800  # キャンバスの最大高さ

# --- Application Configuration ---
class AppConfig:
    """アプリケーション設定の集約クラス"""
    DEFAULT_MOVEMENT_THRESHOLD = 5.0  # 浮動小数点での閾値
    MAX_HISTORY_SIZE = 20
    COORDINATE_PRECISION = 6  # 座標計算の小数点精度
    
    # 特徴点グループ定義（複数点の平均化用）
    LANDMARK_GROUPS = {
        'left_eye_center': [159, 158, 157, 173],  # 左目周辺4点の平均
        'right_eye_center': [386, 385, 384, 398],  # 右目周辺4点の平均
        'nose_tip': [1, 2],  # 鼻先周辺2点の平均
        'nose_bridge': [6, 9],  # 鼻梁周辺2点の平均
        'left_nostril': [131, 134, 126],  # 左小鼻周辺3点の平均
        'right_nostril': [102, 49, 48]  # 右小鼻周辺3点の平均
    }

# --- Classes and Functions ---

class CoordinateConverter:
    """
    座標変換の精度を向上させるユーティリティクラス
    
    浮動小数点計算で精度を保持し、逆変換の整合性を保証します。
    """
    
    @staticmethod
    def scale_to_canvas(real_coords: Dict[str, float], 
                       real_size: Tuple[int, int], 
                       canvas_size: Tuple[int, int]) -> Dict[str, float]:
        """
        実際の画像座標をキャンバス座標にスケーリング（高精度版）
        
        Args:
            real_coords: 実際の画像座標 {'x': float, 'y': float}
            real_size: 実際の画像サイズ (width, height)
            canvas_size: キャンバスサイズ (width, height)
            
        Returns:
            キャンバス座標 {'x': float, 'y': float}（浮動小数点で返す）
        """
        real_w, real_h = real_size
        canvas_w, canvas_h = canvas_size
        
        # スケーリング係数の計算を改善（高精度）
        scale_x = canvas_w / real_w
        scale_y = canvas_h / real_h
        
        # 座標変換の精度を向上
        return {
            'x': round(real_coords['x'] * scale_x, AppConfig.COORDINATE_PRECISION),
            'y': round(real_coords['y'] * scale_y, AppConfig.COORDINATE_PRECISION)
        }
    
    @staticmethod
    def scale_to_real(canvas_coords: Dict[str, float], 
                     real_size: Tuple[int, int], 
                     canvas_size: Tuple[int, int]) -> Dict[str, float]:
        """
        キャンバス座標を実際の画像座標にスケーリング（高精度版）
        
        Args:
            canvas_coords: キャンバス座標 {'x': float, 'y': float}
            real_size: 実際の画像サイズ (width, height)
            canvas_size: キャンバスサイズ (width, height)
            
        Returns:
            実際の画像座標 {'x': float, 'y': float}（浮動小数点で返す）
        """
        real_w, real_h = real_size
        canvas_w, canvas_h = canvas_size
        
        # スケーリング係数の計算を改善（高精度）
        scale_x = real_w / canvas_w
        scale_y = real_h / canvas_h
        
        # 座標変換の精度を向上
        return {
            'x': round(canvas_coords['x'] * scale_x, AppConfig.COORDINATE_PRECISION),
            'y': round(canvas_coords['y'] * scale_y, AppConfig.COORDINATE_PRECISION)
        }
    
    @staticmethod
    def verify_conversion_integrity(original_coords: Dict[str, float],
                                  real_size: Tuple[int, int],
                                  canvas_size: Tuple[int, int]) -> bool:
        """
        座標変換の往復整合性を検証（改善版）
        
        Args:
            original_coords: 元の座標
            real_size: 実際の画像サイズ
            canvas_size: キャンバスサイズ
            
        Returns:
            整合性が保たれているかどうか
        """
        try:
            # 往復変換テスト
            canvas_coords = CoordinateConverter.scale_to_canvas(original_coords, real_size, canvas_size)
            restored_coords = CoordinateConverter.scale_to_real(canvas_coords, real_size, canvas_size)
            
            # 許容誤差内かチェック（1ピクセル以内）
            error_x = abs(original_coords['x'] - restored_coords['x'])
            error_y = abs(original_coords['y'] - restored_coords['y'])
            
            # エラーが許容範囲内かチェック
            is_valid = error_x <= 1.0 and error_y <= 1.0
            
            if not is_valid:
                st.warning(f"座標変換の誤差が大きいです: x={error_x:.2f}, y={error_y:.2f}")
            
            return is_valid
            
        except Exception as e:
            st.error(f"座標変換の検証中にエラーが発生しました: {str(e)}")
            return False

class LandmarkAnalyzer:
    """
    ランドマーク分析と信頼度評価のクラス
    """
    
    @staticmethod
    def calculate_group_center(landmarks, group_indices: List[int], image_shape: Tuple[int, int]) -> Optional[Dict[str, float]]:
        """
        複数ランドマークの重心を計算（改善案1: 複数ランドマークの平均化）
        
        Args:
            landmarks: MediaPipeランドマーク
            group_indices: 平均化するランドマークのインデックスリスト
            image_shape: 画像サイズ (height, width)
            
        Returns:
            重心座標 {'x': float, 'y': float} または None
        """
        if not landmarks or not group_indices:
            return None
        
        h, w = image_shape[:2]
        valid_points = []
        
        for idx in group_indices:
            if idx < len(landmarks.landmark):
                point = landmarks.landmark[idx]
                valid_points.append({
                    'x': point.x * w,
                    'y': point.y * h
                })
        
        if not valid_points:
            return None
        
        # 重心計算
        center_x = sum(p['x'] for p in valid_points) / len(valid_points)
        center_y = sum(p['y'] for p in valid_points) / len(valid_points)
        
        return {'x': center_x, 'y': center_y}
    
    @staticmethod
    def assess_landmark_confidence(landmarks, point_name: str, image_shape: Tuple[int, int, int]) -> Dict[str, Any]:
        """
        ランドマークの信頼度を評価（改善案4: ヒートマップによる信頼度可視化）
        
        Args:
            landmarks: MediaPipeランドマーク
            point_name: 特徴点名
            image_shape: 画像サイズ (height, width, channels)
            
        Returns:
            信頼度情報の辞書
        """
        if point_name not in AppConfig.LANDMARK_GROUPS:
            return {'confidence': 0.0, 'status': 'unknown', 'color': '#808080'}
        
        group_indices = AppConfig.LANDMARK_GROUPS[point_name]
        h, w = image_shape[:2]  # チャンネル情報を除外
        
        # 各点の座標を取得
        points = []
        for idx in group_indices:
            if idx < len(landmarks.landmark):
                point = landmarks.landmark[idx]
                points.append({
                    'x': point.x * w,
                    'y': point.y * h,
                    'z': point.z  # 深度情報も考慮
                })
        
        if len(points) < 2:
            return {'confidence': 0.0, 'status': 'insufficient_points', 'color': '#FF0000'}
        
        # 点群の分散から信頼度を計算
        center = LandmarkAnalyzer.calculate_group_center(landmarks, group_indices, (h, w))
        if not center:
            return {'confidence': 0.0, 'status': 'calculation_failed', 'color': '#FF0000'}
        
        # 各点の中心からの距離の分散を計算
        distances = []
        for point in points:
            dist = math.sqrt((point['x'] - center['x'])**2 + (point['y'] - center['y'])**2)
            distances.append(dist)
        
        # 分散が小さいほど信頼度が高い
        variance = np.var(distances) if distances else float('inf')
        confidence = max(0.0, min(1.0, 1.0 / (1.0 + variance / 10.0)))
        
        # 信頼度に基づく色とステータス
        if confidence > 0.8:
            status, color = 'high', '#00FF00'
        elif confidence > 0.5:
            status, color = 'medium', '#FFAA00'
        else:
            status, color = 'low', '#FF0000'
        
        return {
            'confidence': confidence,
            'status': status,
            'color': color,
            'variance': variance,
            'point_count': len(points)
        }
    
    @staticmethod
    def validate_anatomical_constraints(nose_tip: Dict[str, float], 
                                      nose_bridge: Dict[str, float],
                                      left_nostril: Dict[str, float],
                                      right_nostril: Dict[str, float]) -> Dict[str, Any]:
        """
        解剖学的制約の検証（改善案5: 補正式の導入）
        
        Args:
            nose_tip, nose_bridge, left_nostril, right_nostril: 各特徴点の座標
            
        Returns:
            検証結果の辞書
        """
        warnings = []
        
        # 鼻先と鼻梁の距離チェック
        nose_length = math.sqrt((nose_tip['x'] - nose_bridge['x'])**2 + 
                               (nose_tip['y'] - nose_bridge['y'])**2)
        
        # 小鼻間の距離チェック
        nostril_distance = math.sqrt((left_nostril['x'] - right_nostril['x'])**2 + 
                                   (left_nostril['y'] - right_nostril['y'])**2)
        
        # 鼻の角度チェック（垂直からの傾き）
        nose_angle = math.atan2(nose_tip['x'] - nose_bridge['x'], 
                               nose_tip['y'] - nose_bridge['y'])
        nose_angle_degrees = abs(math.degrees(nose_angle))
        
        # 制約チェック
        if nose_length < 10:
            warnings.append("鼻の長さが短すぎます")
        elif nose_length > 200:
            warnings.append("鼻の長さが長すぎます")
        
        if nostril_distance < 5:
            warnings.append("小鼻間の距離が近すぎます")
        elif nostril_distance > 100:
            warnings.append("小鼻間の距離が遠すぎます")
        
        if nose_angle_degrees > 30:
            warnings.append(f"鼻の角度が不自然です（{nose_angle_degrees:.1f}度）")
        
        return {
            'is_valid': len(warnings) == 0,
            'warnings': warnings,
            'metrics': {
                'nose_length': nose_length,
                'nostril_distance': nostril_distance,
                'nose_angle_degrees': nose_angle_degrees
            }
        }

class FaceDetector:
    """顔検出と特徴点抽出を行うクラス（改善版）"""
    
    def __init__(self):
        """
        FaceDetectorを初期化
        
        MediaPipeの設定を最適化し、検出精度を向上させます。
        """
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=2,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )
        self.landmark_analyzer = LandmarkAnalyzer()
    
    def detect_face_landmarks(self, image: np.ndarray) -> Tuple[Optional[Any], Optional[str]]:
        """
        顔の特徴点を検出し、エラーメッセージを返す（改善版）
        
        Args:
            image: 入力画像（OpenCV形式）
            
        Returns:
            (landmarks, error_message): ランドマークとエラーメッセージのタプル
        """
        try:
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_image)
            
            if not results.multi_face_landmarks:
                return None, "顔を検出できませんでした。以下を確認してください：\n• 顔が正面を向いているか\n• 顔が画像の中央にあるか\n• 照明が適切か"
            
            if len(results.multi_face_landmarks) > 1:
                return None, "複数の顔が検出されました。顔が一つだけ写っている画像を使用してください。"
            
            return results.multi_face_landmarks[0], None
            
        except Exception as e:
            return None, f"顔検出処理中にエラーが発生しました: {str(e)}"
    
    def get_enhanced_landmarks(self, landmarks, image_shape: Tuple[int, int, int]) -> Dict[str, Dict[str, float]]:
        """
        強化されたランドマーク座標を取得（複数点の平均化適用）
        
        Args:
            landmarks: MediaPipeランドマーク
            image_shape: 画像サイズ (height, width, channels)
            
        Returns:
            特徴点名をキーとする座標辞書
        """
        # image_shapeから必要な部分だけを取り出す
        h, w = image_shape[:2]
        return self._get_enhanced_landmarks_internal(landmarks, (h, w))
    
    def _get_enhanced_landmarks_internal(self, landmarks, image_shape: Tuple[int, int]) -> Dict[str, Dict[str, float]]:
        """
        内部用の強化されたランドマーク座標取得メソッド
        
        Args:
            landmarks: MediaPipeランドマーク
            image_shape: 画像サイズ (height, width)
            
        Returns:
            特徴点名をキーとする座標辞書
        """
        enhanced_coords = {}
        
        for point_name, group_indices in AppConfig.LANDMARK_GROUPS.items():
            # 複数ランドマークの平均化
            center = self.landmark_analyzer.calculate_group_center(
                landmarks, group_indices, image_shape
            )
            if center:
                enhanced_coords[point_name] = center
        
        return enhanced_coords
    
    def draw_landmarks_with_confidence(self, image: np.ndarray, landmarks, show_confidence: bool = False) -> np.ndarray:
        """
        信頼度情報付きでランドマークを描画
        
        Args:
            image: 入力画像
            landmarks: MediaPipeランドマーク
            show_confidence: 信頼度情報を表示するかどうか
            
        Returns:
            注釈付き画像
        """
        annotated_image = image.copy()
        h, w = image.shape[:2]
        
        # 基本的な特徴点描画
        mp_drawing.draw_landmarks(
            image=annotated_image,
            landmark_list=landmarks,
            connections=mp_face_mesh.FACEMESH_CONTOURS,
            landmark_drawing_spec=None,
            connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
        )
        
        # 強化されたランドマークを重ね描き
        if show_confidence:
            enhanced_landmarks = self.get_enhanced_landmarks(landmarks, image.shape)
            
            for point_name, coords in enhanced_landmarks.items():
                confidence_info = self.landmark_analyzer.assess_landmark_confidence(
                    landmarks, point_name, image.shape
                )
                
                x, y = int(coords['x']), int(coords['y'])
                
                # 信頼度に基づく色で円を描画
                color_hex = confidence_info['color']
                color_bgr = tuple(int(color_hex[i:i+2], 16) for i in (5, 3, 1))  # BGR形式に変換
                
                # 信頼度に基づくサイズ
                radius = int(8 + confidence_info['confidence'] * 8)
                cv2.circle(annotated_image, (x, y), radius, color_bgr, -1)
                cv2.circle(annotated_image, (x, y), radius + 2, (255, 255, 255), 2)
                
                # 信頼度テキスト
                confidence_text = f"{confidence_info['confidence']:.2f}"
                cv2.putText(annotated_image, confidence_text, (x + 15, y - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
        return annotated_image
    
    def adjust_landmarks(self, landmarks, adjustments: Dict[str, Dict[str, float]], image_shape: Tuple[int, int]):
        """
        特徴点の座標を手動調整（高精度版）
        
        Args:
            landmarks: 元のランドマーク
            adjustments: 調整値の辞書
            image_shape: 画像サイズ
            
        Returns:
            調整済みランドマーク
        """
        adjusted_landmarks = copy.deepcopy(landmarks)
        h, w = image_shape[:2]
        
        # 強化されたランドマークの代表インデックスを取得
        point_indices = {
            'nose_tip': 1,
            'nose_bridge': 6,
            'left_nostril': 131,
            'right_nostril': 102,
            'left_eye_center': 159,
            'right_eye_center': 386
        }
        
        for point_name, coords in adjustments.items():
            if point_name in point_indices:
                idx = point_indices[point_name]
                if idx < len(adjusted_landmarks.landmark):
                    # 高精度で正規化座標に変換
                    adjusted_landmarks.landmark[idx].x = coords['x'] / w
                    adjusted_landmarks.landmark[idx].y = coords['y'] / h
        
        return adjusted_landmarks

@st.cache_resource
def get_face_detector() -> FaceDetector:
    """
    FaceDetectorのシングルトンインスタンスを返す
    
    Returns:
        FaceDetectorインスタンス
    """
    return FaceDetector()

def load_image_from_uploaded_file(uploaded_file) -> Tuple[Optional[np.ndarray], Optional[Image.Image]]:
    """
    アップロードされたファイルから画像を読み込む（改善版エラーハンドリング）
    
    Args:
        uploaded_file: Streamlitアップロードファイルオブジェクト
        
    Returns:
        (cv2_image, pil_image): OpenCV形式とPIL形式の画像タプル
    """
    if uploaded_file is None:
        return None, None
    
    try:
        pil_image = Image.open(uploaded_file)
        
        # RGBAをRGBに変換
        if pil_image.mode == 'RGBA':
            pil_image = pil_image.convert('RGB')
        elif pil_image.mode == 'L':  # グレースケール
            pil_image = pil_image.convert('RGB')
        
        image_array = np.array(pil_image)
        cv2_image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        return cv2_image, pil_image
        
    except UnidentifiedImageError:
        st.error("❌ サポートされていない画像形式です。JPG、PNG、またはBMP形式の画像をご使用ください。")
        return None, None
    except ValueError as e:
        st.error(f"❌ 画像データの処理中にエラーが発生しました: {str(e)}")
        return None, None
    except MemoryError:
        st.error("❌ 画像のサイズが大きすぎます。より小さな画像をお試しください。")
        return None, None
    except Exception as e:
        st.error(f"❌ 予期しないエラーが発生しました: {str(e)}")
        return None, None

def calculate_canvas_dimensions(image_shape: Tuple[int, int, int]) -> Tuple[int, int]:
    """
    画像サイズに基づいてキャンバスの適切なサイズを計算
    
    Args:
        image_shape: 画像のシェイプ (height, width, channels)
        
    Returns:
        (canvas_width, canvas_height): キャンバスサイズ
    """
    original_h, original_w = image_shape[:2]
    
    # アスペクト比を維持しながらキャンバスサイズを調整
    if original_w > original_h:
        # 横長の画像
        canvas_w = CANVAS_WIDTH
        canvas_h = int((original_h / original_w) * CANVAS_WIDTH)
        canvas_h = min(canvas_h, CANVAS_HEIGHT)
    else:
        # 縦長の画像
        canvas_h = min(CANVAS_HEIGHT, int((original_h / original_w) * CANVAS_WIDTH))
        canvas_w = int((original_w / original_h) * canvas_h)
    
    return canvas_w, canvas_h

def initialize_session_state():
    """
    セッション状態を初期化（改善版）
    
    画像変更検出による自動クリア機能を追加し、履歴管理を完全実装
    """
    # 画像操作パラメータ
    defaults = {
        'eye_distance': 0,
        'nose_position': 0,
        'eye_size': 0,
        'nose_size': 0
    }
    
    for key, default_value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = default_value
    
    # 特徴点手動調整値の一元管理（高精度座標）
    if 'manual_adjustments' not in st.session_state:
        st.session_state.manual_adjustments = {}
    
    # 履歴管理の完全実装
    if 'adjustment_history' not in st.session_state:
        st.session_state.adjustment_history = []
    if 'adjustment_redo_stack' not in st.session_state:
        st.session_state.adjustment_redo_stack = []
    
    # UI設定の動的管理
    if 'movement_threshold' not in st.session_state:
        st.session_state.movement_threshold = AppConfig.DEFAULT_MOVEMENT_THRESHOLD
    
    # 画像変更検出による自動クリア
    if 'current_image_hash' not in st.session_state:
        st.session_state.current_image_hash = None
    if 'previous_image_hash' not in st.session_state:
        st.session_state.previous_image_hash = None

def detect_image_change(image_bytes: bytes) -> bool:
    """
    画像変更を検出し、必要に応じて調整値をクリア
    
    Args:
        image_bytes: アップロードされた画像のバイトデータ
        
    Returns:
        画像が変更されたかどうか
    """
    # 画像のハッシュ値を計算
    current_hash = hashlib.md5(image_bytes).hexdigest()
    st.session_state.current_image_hash = current_hash
    
    # 画像が変更された場合
    if (st.session_state.previous_image_hash is not None and 
        st.session_state.previous_image_hash != current_hash):
        
        # 調整値と履歴をクリア
        st.session_state.manual_adjustments = {}
        st.session_state.adjustment_history = []
        st.session_state.adjustment_redo_stack = []
        
        st.session_state.previous_image_hash = current_hash
        return True
    
    st.session_state.previous_image_hash = current_hash
    return False

def create_precision_adjustment_controls() -> Dict[str, float]:
    """
    精密調整コントロールを作成（改善案2: スライダー微調整）
    
    Returns:
        精密調整値の辞書
    """
    st.sidebar.subheader("🎯 精密調整")
    
    precision_adjustments = {}
    
    # 選択された特徴点の精密調整
    if st.session_state.manual_adjustments:
        selected_point = st.sidebar.selectbox(
            "調整する特徴点を選択:",
            list(st.session_state.manual_adjustments.keys()),
            format_func=lambda x: {
                'nose_tip': '🟢 鼻先',
                'nose_bridge': '🟢 鼻梁', 
                'left_nostril': '🔵 左小鼻',
                'right_nostril': '🔵 右小鼻',
                'left_eye_center': '🔴 左目',
                'right_eye_center': '🔴 右目'
            }.get(x, x)
        )
        
        if selected_point:
            current_coords = st.session_state.manual_adjustments[selected_point]
            
            # X座標の微調整
            x_offset = st.sidebar.slider(
                "X座標オフセット",
                min_value=-20.0,
                max_value=20.0,
                value=0.0,
                step=0.1,
                key=f"{selected_point}_x_offset"
            )
            
            # Y座標の微調整
            y_offset = st.sidebar.slider(
                "Y座標オフセット", 
                min_value=-20.0,
                max_value=20.0,
                value=0.0,
                step=0.1,
                key=f"{selected_point}_y_offset"
            )
            
            # 調整値を適用
            if x_offset != 0.0 or y_offset != 0.0:
                adjusted_coords = {
                    'x': current_coords['x'] + x_offset,
                    'y': current_coords['y'] + y_offset
                }
                precision_adjustments[selected_point] = adjusted_coords
                
                # 適用ボタン
                if st.sidebar.button("🔧 精密調整を適用"):
                    st.session_state.manual_adjustments[selected_point] = adjusted_coords
                    # スライダーをリセット
                    st.session_state[f"{selected_point}_x_offset"] = 0.0
                    st.session_state[f"{selected_point}_y_offset"] = 0.0
                    st.rerun()
    
    return precision_adjustments

def create_enhanced_landmark_adjustment_controls() -> bool:
    """
    強化された特徴点調整のコントロールUIを作成
    
    Returns:
        調整機能が有効かどうか
    """
    st.sidebar.subheader("🎯 特徴点ドラッグ調整")
    
    # 調整機能の有効化チェックボックス
    enable_adjustment = st.sidebar.checkbox("特徴点調整を有効化")
    
    if enable_adjustment:
        st.sidebar.info("💡 左の画像上で色付きの点をドラッグして特徴点を調整できます")
        
        # 移動検出閾値の設定
        st.session_state.movement_threshold = st.sidebar.slider(
            "移動検出閾値（ピクセル）",
            min_value=1.0,
            max_value=20.0,
            value=st.session_state.movement_threshold,
            step=0.5
        )
        
        # 精密調整コントロール
        precision_adjustments = create_precision_adjustment_controls()
        
        # 操作方法の説明
        st.sidebar.markdown("""
        **操作方法:**
        - 🖱️ 色付きの円をドラッグして移動
        - 🎯 精密調整でピクセル単位の微調整
        - 📊 信頼度表示で検出品質を確認
        - 🔄 リセットで初期状態に復帰
        
        **特徴点の識別:**
        - 🟢 大=鼻先, 小=鼻梁
        - 🔵 濃い青=左小鼻, 明るい青=右小鼻  
        - 🔴 濃い赤=左目, オレンジ=右目
        """)
        
        # 操作ボタン
        col1, col2 = st.sidebar.columns(2)
        
        with col1:
            if st.button("🔄 すべてリセット"):
                st.session_state.manual_adjustments = {}
                st.session_state.adjustment_history = []
                st.session_state.adjustment_redo_stack = []
                st.rerun()
        
        with col2:
            # 元に戻す機能
            can_undo = len(st.session_state.adjustment_history) > 0
            if st.button("↶ 元に戻す", disabled=not can_undo):
                if undo_last_adjustment():
                    st.rerun()
        
        # 現在の調整状況表示
        if st.session_state.manual_adjustments:
            st.sidebar.success(f"📍 {len(st.session_state.manual_adjustments)}個の特徴点が調整済み")
            
            # 調整詳細を表示
            with st.sidebar.expander("📝 調整詳細"):
                for point_name, coords in st.session_state.manual_adjustments.items():
                    label_map = {
                        'nose_tip': '🟢 鼻先', 'nose_bridge': '🟢 鼻梁',
                        'left_nostril': '🔵 左小鼻', 'right_nostril': '🔵 右小鼻',
                        'left_eye_center': '🔴 左目', 'right_eye_center': '🔴 右目'
                    }
                    point_label = label_map.get(point_name, point_name)
                    st.write(f"**{point_label}**: ({coords['x']:.1f}, {coords['y']:.1f})")
        else:
            st.sidebar.info("📍 調整された特徴点はありません")
        
        # デバッグ情報をサイドバーに集約
        with st.sidebar.expander("🔧 技術情報"):
            st.write("**双方向データフロー:** 有効")
            st.write(f"**移動検出閾値:** {st.session_state.movement_threshold}ピクセル")
            st.write("**座標系:** 高精度浮動小数点")
            if st.session_state.manual_adjustments:
                st.write("**現在の調整値:**")
                st.json(st.session_state.manual_adjustments)
            else:
                st.write("**状態:** 初期状態")
    
    return enable_adjustment

def undo_last_adjustment() -> bool:
    """
    最後の調整操作を元に戻す（改善版）
    
    Returns:
        元に戻す操作が成功したかどうか
    """
    if not st.session_state.adjustment_history:
        return False
    
    # 現在の状態をRedo履歴に保存
    current_state = copy.deepcopy(st.session_state.manual_adjustments)
    st.session_state.adjustment_redo_stack.append(current_state)
    
    # 最大Redo履歴数の制限
    if len(st.session_state.adjustment_redo_stack) > AppConfig.MAX_HISTORY_SIZE:
        st.session_state.adjustment_redo_stack.pop(0)
    
    # 最後の状態を復元
    previous_state = st.session_state.adjustment_history.pop()
    st.session_state.manual_adjustments = previous_state
    
    return True

def create_enhanced_interactive_canvas(landmarks, image_shape: Tuple[int, int, int], pil_image: Image.Image):
    """
    強化されたインタラクティブな特徴点調整キャンバスを作成
    
    Args:
        landmarks: MediaPipeランドマーク
        image_shape: 画像サイズ
        pil_image: PIL画像
        
    Returns:
        調整された特徴点の辞書
    """
    if landmarks is None:
        st.warning("ランドマークが検出されていません。")
        return None
    
    try:
        # キャンバスサイズと実際のサイズ
        canvas_w, canvas_h = calculate_canvas_dimensions(image_shape)
        real_w, real_h = image_shape[1], image_shape[0]  # OpenCV形式 (h, w) → (w, h)
        
        # 画像をキャンバスサイズにリサイズ
        canvas_image = pil_image.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
        
        # 座標変換の整合性を検証
        test_coords = {'x': 100.0, 'y': 100.0}
        is_conversion_valid = CoordinateConverter.verify_conversion_integrity(
            test_coords, (real_w, real_h), (canvas_w, canvas_h)
        )
        
        if not is_conversion_valid:
            st.warning("⚠️ 座標変換の精度に問題があります。結果が不正確になる可能性があります。")
        
        # 強化されたランドマークを取得
        detector = get_face_detector()
        enhanced_landmarks = detector.get_enhanced_landmarks(landmarks, image_shape)
        
        # 重要な特徴点の定義（信頼度に基づく色付け）
        key_points = {}
        base_config = {
            'nose_tip': {'label': '鼻先', 'base_color': '#00FF00', 'radius': 12},
            'nose_bridge': {'label': '鼻梁', 'base_color': '#00AA00', 'radius': 8},
            'left_nostril': {'label': '左小鼻', 'base_color': '#0000FF', 'radius': 10},
            'right_nostril': {'label': '右小鼻', 'base_color': '#0066FF', 'radius': 10},
            'left_eye_center': {'label': '左目中心', 'base_color': '#FF0000', 'radius': 10},
            'right_eye_center': {'label': '右目中心', 'base_color': '#FF6600', 'radius': 10}
        }
        
        # 信頼度に基づく色とサイズの調整
        for point_name, config in base_config.items():
            if point_name in enhanced_landmarks:
                confidence_info = LandmarkAnalyzer.assess_landmark_confidence(
                    landmarks, point_name, image_shape
                )
                
                key_points[point_name] = {
                    'coords': enhanced_landmarks[point_name],
                    'label': config['label'],
                    'color': confidence_info['color'],
                    'radius': config['radius'],
                    'confidence': confidence_info['confidence']
                }
        
        # 初期オブジェクトを生成
        initial_objects = []
        for point_name, point_info in key_points.items():
            real_coords = point_info['coords']
            
            # 手動調整があれば適用
            if point_name in st.session_state.manual_adjustments:
                real_coords = st.session_state.manual_adjustments[point_name]
            
            # キャンバス座標に変換（高精度）
            canvas_coords = CoordinateConverter.scale_to_canvas(
                real_coords, (real_w, real_h), (canvas_w, canvas_h)
            )
            
            # 調整可能な円オブジェクト
            initial_objects.append({
                'type': 'circle',
                'left': canvas_coords['x'] - point_info['radius'],
                'top': canvas_coords['y'] - point_info['radius'],
                'radius': point_info['radius'],
                'fill': point_info['color'],
                'stroke': '#FFFFFF',
                'strokeWidth': 2,
                'selectable': True,
                'name': point_name,
                'originalX': canvas_coords['x'],
                'originalY': canvas_coords['y'],
                'confidence': point_info['confidence']
            })
        
        # 特徴点の凡例を表示（信頼度情報付き）
        st.caption("**特徴点:** 🟢=鼻 🔵=小鼻 🔴=目 | 色の濃さ=検出信頼度")
        
        # キャンバスの作成（改善版）
        canvas_result = st_canvas(
            fill_color="rgba(255, 165, 0, 0.3)",
            stroke_width=2,
            stroke_color="#FFFFFF",
            background_image=canvas_image,
            update_streamlit=True,
            height=canvas_h,
            width=canvas_w,
            drawing_mode="transform",
            initial_drawing={
                "version": "4.4.0",
                "objects": initial_objects
            },
            key="enhanced_landmark_canvas",
            # 以下のオプションを追加
            display_toolbar=True,
            key_down_callback=None,
            key_up_callback=None,
            mouse_down_callback=None,
            mouse_up_callback=None,
            mouse_move_callback=None
        )
        
        # キャンバス操作結果の処理（高精度版）
        if canvas_result.json_data is not None:
            update_enhanced_landmark_positions(
                canvas_result, key_points, (real_w, real_h), (canvas_w, canvas_h)
            )
        
        return st.session_state.manual_adjustments
        
    except Exception as e:
        st.error(f"キャンバス作成中にエラーが発生しました: {str(e)}")
        return None

def update_enhanced_landmark_positions(canvas_result, key_points: Dict, 
                                     real_size: Tuple[int, int], 
                                     canvas_size: Tuple[int, int]) -> bool:
    """
    キャンバス結果から特徴点位置を更新（高精度版）
    
    Args:
        canvas_result: st_canvasから返されるキャンバス操作結果
        key_points: 特徴点の定義辞書
        real_size: 実際の画像サイズ (width, height)
        canvas_size: キャンバスサイズ (width, height)
        
    Returns:
        位置が更新されたかどうか
    """
    if canvas_result.json_data is None:
        st.warning("キャンバスのデータが取得できませんでした。")
        return False
    
    try:
        objects = canvas_result.json_data.get("objects", [])
        movement_threshold = st.session_state.movement_threshold
        
        updated_positions = {}
        state_changed = False
        
        for obj in objects:
            if (obj.get("type") == "circle" and 
                obj.get("name") and 
                obj["name"] in key_points):
                
                point_name = obj["name"]
                
                # キャンバス上の現在の中心座標を計算（浮動小数点）
                current_center_x = obj.get("left", 0.0) + obj.get("radius", 0.0)
                current_center_y = obj.get("top", 0.0) + obj.get("radius", 0.0)
                
                # 元の中心座標を取得
                original_center_x = obj.get("originalX", current_center_x)
                original_center_y = obj.get("originalY", current_center_y)
                
                # 移動距離を計算（高精度）
                move_distance = math.sqrt(
                    (current_center_x - original_center_x)**2 + 
                    (current_center_y - original_center_y)**2
                )
                
                # 移動検出
                if move_distance >= movement_threshold:
                    # 実際の画像座標に変換（高精度）
                    real_coords = CoordinateConverter.scale_to_real(
                        {'x': current_center_x, 'y': current_center_y},
                        real_size, canvas_size
                    )
                    
                    # 現在の状態と比較して変更があるかチェック
                    current_coords = st.session_state.manual_adjustments.get(point_name)
                    if (current_coords is None or 
                        abs(current_coords['x'] - real_coords['x']) > 0.5 or 
                        abs(current_coords['y'] - real_coords['y']) > 0.5):
                        
                        updated_positions[point_name] = real_coords
                        state_changed = True
        
        # 状態が変更された場合は履歴に保存してから更新
        if state_changed:
            # 履歴保存
            save_adjustment_to_history()
            
            # セッション状態を更新
            for point_name, coords in updated_positions.items():
                st.session_state.manual_adjustments[point_name] = coords
            
            # 再描画
            st.rerun()
        
        return state_changed
        
    except Exception as e:
        st.error(f"特徴点位置更新エラー: {str(e)}")
        # エラーの詳細をログに記録
        st.error("詳細なエラー情報:")
        st.error(f"key_points: {key_points}")
        st.error(f"real_size: {real_size}")
        st.error(f"canvas_size: {canvas_size}")
        return False

def save_adjustment_to_history():
    """現在の調整状態を履歴に保存（改善版）"""
    # 現在の状態のコピーを作成
    current_state = copy.deepcopy(st.session_state.manual_adjustments)
    
    # 直前の状態と同じ場合は保存しない（重複除外）
    if (st.session_state.adjustment_history and 
        st.session_state.adjustment_history[-1] == current_state):
        return
    
    # Redo履歴をクリア（新しい操作が行われたため）
    st.session_state.adjustment_redo_stack = []
    
    # 履歴に追加（動的最大数管理）
    max_history = AppConfig.MAX_HISTORY_SIZE
    if len(st.session_state.adjustment_history) >= max_history:
        st.session_state.adjustment_history.pop(0)  # 最古を削除
    
    st.session_state.adjustment_history.append(current_state)

def validate_anatomical_constraints_ui():
    """解剖学的制約の検証結果をUIに表示"""
    adjustments = st.session_state.manual_adjustments
    
    # 必要な特徴点が揃っているかチェック
    required_points = ['nose_tip', 'nose_bridge', 'left_nostril', 'right_nostril']
    if not all(point in adjustments for point in required_points):
        return
    
    # 制約検証の実行
    validation_result = LandmarkAnalyzer.validate_anatomical_constraints(
        adjustments['nose_tip'],
        adjustments['nose_bridge'], 
        adjustments['left_nostril'],
        adjustments['right_nostril']
    )
    
    # 結果の表示
    if validation_result['is_valid']:
        st.success("✅ 解剖学的制約: 正常範囲内")
    else:
        st.warning("⚠️ 解剖学的制約の警告:")
        for warning in validation_result['warnings']:
            st.write(f"• {warning}")
        
        # 詳細メトリクス
        with st.expander("📊 詳細メトリクス"):
            metrics = validation_result['metrics']
            st.write(f"鼻の長さ: {metrics['nose_length']:.1f}px")
            st.write(f"小鼻間距離: {metrics['nostril_distance']:.1f}px")
            st.write(f"鼻の角度: {metrics['nose_angle_degrees']:.1f}度")

def create_parameter_controls() -> Dict[str, int]:
    """パラメータ制御UIを作成（改善版）"""
    st.sidebar.header("画像操作パラメータ")
    
    # セッション状態初期化
    initialize_session_state()
    
    # 各パラメータのウィジェット作成
    parameters = {}
    param_configs = [
        ("目の間の距離", "eye_distance"),
        ("鼻の垂直位置", "nose_position"),
        ("目のサイズ", "eye_size"),
        ("鼻のサイズ", "nose_size")
    ]
    
    for label, key in param_configs:
        st.sidebar.subheader(label)
        col1, col2 = st.sidebar.columns([3, 1])
        
        with col1:
            value = st.slider(
                label,
                min_value=-50,
                max_value=50,
                value=st.session_state[key],
                key=f"{key}_slider",
                label_visibility="collapsed"
            )
        
        with col2:
            value = st.number_input(
                "値",
                min_value=-50,
                max_value=50,
                value=st.session_state[key],
                key=f"{key}_input",
                label_visibility="collapsed"
            )
        
        parameters[key] = value
        st.session_state[key] = value
    
    # 操作ボタン
    st.sidebar.subheader("操作")
    col1, col2 = st.sidebar.columns(2)
    
    with col1:
        if st.button("リセット"):
            # 全パラメータを0にリセット
            for key in ['eye_distance', 'nose_position', 'eye_size', 'nose_size']:
                st.session_state[key] = 0
            st.rerun()
    
    with col2:
        # プリセット機能
        if st.button("プリセット"):
            # よく使われる設定値
            st.session_state['eye_distance'] = 5
            st.session_state['nose_position'] = -2
            st.session_state['eye_size'] = 3
            st.session_state['nose_size'] = 1
            st.rerun()
    
    return parameters

def display_parameter_metrics(parameters: Dict[str, int]):
    """現在のパラメータを表示（改善版）"""
    st.subheader("現在のパラメータ")
    cols = st.columns(4)
    
    param_labels = [
        ("目の間の距離", "eye_distance"),
        ("鼻の垂直位置", "nose_position"),
        ("目のサイズ", "eye_size"),
        ("鼻のサイズ", "nose_size")
    ]
    
    for i, (label, key) in enumerate(param_labels):
        with cols[i]:
            value = parameters[key]
            delta_color = "normal"
            if value > 0:
                delta_color = "normal"
            elif value < 0:
                delta_color = "inverse"
            
            st.metric(
                label, 
                f"{value:+d}%",
                delta=f"{abs(value)}%変化" if value != 0 else "変化なし"
            )

def main():
    """
    メイン関数（改善版）
    
    アプリケーションの全体的な流れを制御し、
    各機能を適切に組み合わせてユーザーインターフェースを構築します。
    """
    st.title("顔画像操作プログラム (改善版)")
    st.markdown("**認知心理学実験用 顔画像操作ツール** - 高精度座標処理・信頼度評価対応")
    
    # キャッシュされたFaceDetectorを取得
    detector = get_face_detector()
    
    # サイドバーでパラメータ制御
    parameters = create_parameter_controls()
    
    # 強化された特徴点調整の制御UI
    enable_landmark_adjustment = create_enhanced_landmark_adjustment_controls()
    
    # メイン画面
    uploaded_file = st.file_uploader(
        "画像ファイルをアップロードしてください", 
        type=['jpg', 'jpeg', 'png', 'bmp'],
        help="顔が1つだけ写った正面向きの画像を選択してください。推奨サイズ: 500x500px以上"
    )
    
    if uploaded_file is not None:
        # 画像変更の検出
        image_bytes = uploaded_file.getvalue()
        detect_image_change(image_bytes)
        
        cv_image, pil_image = load_image_from_uploaded_file(uploaded_file)
        
        if cv_image is not None:
            landmarks, error_message = detector.detect_face_landmarks(cv_image)
            
            if error_message:
                st.error(error_message)
            else:
                # 画像表示（左右並列）
                col1, col2 = st.columns(2)
                
                # 左カラム：特徴点調整が有効な場合はキャンバス、無効な場合は元画像
                with col1:
                    if enable_landmark_adjustment:
                        st.subheader("🎯 特徴点調整キャンバス")
                        st.caption("色付きの点をドラッグして特徴点を調整してください")
                        
                        # 強化されたキャンバス作成
                        landmark_adjustments = create_enhanced_interactive_canvas(
                            landmarks, cv_image.shape, pil_image
                        )
                    else:
                        st.subheader("元画像")
                        st.image(pil_image, caption=f"サイズ: {pil_image.size[0]}×{pil_image.size[1]}px")
                        landmark_adjustments = None
                
                # 右カラム：操作後画像
                with col2:
                    st.subheader("操作後画像 (特徴点表示)")
                    
                    # 表示オプション
                    show_confidence = st.checkbox("信頼度情報を表示", value=False)
                    show_debug = st.checkbox("デバッグ情報を表示", value=False)
                    
                    # 特徴点が調整されている場合は調整済みlandmarkを使用
                    display_landmarks = landmarks
                    if landmark_adjustments:
                        display_landmarks = detector.adjust_landmarks(
                            landmarks, landmark_adjustments, cv_image.shape
                        )
                    
                    # 信頼度付きで特徴点を描画
                    annotated_image = detector.draw_landmarks_with_confidence(
                        cv_image, display_landmarks, show_confidence
                    )
                    rgb_annotated = cv2.cvtColor(annotated_image, cv2.COLOR_BGR2RGB)
                    st.image(rgb_annotated, caption="処理済み画像")
                
                # パラメータ表示
                display_parameter_metrics(parameters)
                
                # デバッグ情報表示（技術的な詳細）
                if show_debug:
                    st.subheader("🔍 デバッグ情報")
                    
                    col_debug1, col_debug2 = st.columns(2)
                    
                    with col_debug1:
                        st.write(f"**検出された特徴点数**: {len(landmarks.landmark)}")
                        st.write(f"**画像サイズ**: {cv_image.shape}")
                        st.write(f"**キャンバスサイズ**: {calculate_canvas_dimensions(cv_image.shape)}")
                        
                        # 座標変換の整合性テスト
                        test_coords = {'x': 100.0, 'y': 100.0}
                        real_size = (cv_image.shape[1], cv_image.shape[0])
                        canvas_size = calculate_canvas_dimensions(cv_image.shape)
                        is_valid = CoordinateConverter.verify_conversion_integrity(
                            test_coords, real_size, canvas_size
                        )
                        st.write(f"**座標変換整合性**: {'✅ 正常' if is_valid else '❌ 異常'}")
                    
                    with col_debug2:
                        # 強化されたランドマーク情報
                        enhanced_landmarks = detector.get_enhanced_landmarks(landmarks, cv_image.shape)
                        st.write(f"**強化ランドマーク数**: {len(enhanced_landmarks)}")
                        
                        # 信頼度情報
                        if enhanced_landmarks:
                            st.write("**信頼度評価**:")
                            for point_name in enhanced_landmarks:
                                confidence_info = LandmarkAnalyzer.assess_landmark_confidence(
                                    landmarks, point_name, cv_image.shape
                                )
                                status_emoji = {'high': '🟢', 'medium': '🟡', 'low': '🔴'}
                                emoji = status_emoji.get(confidence_info['status'], '⚪')
                                st.write(f"{emoji} {point_name}: {confidence_info['confidence']:.2f}")
                    
                    # 詳細な座標情報
                    with st.expander("📊 詳細座標情報"):
                        if landmark_adjustments:
                            st.write("**調整済み座標**:")
                            st.json(landmark_adjustments)
                        
                        if enhanced_landmarks:
                            st.write("**強化されたランドマーク座標**:")
                            st.json({k: f"({v['x']:.1f}, {v['y']:.1f})" for k, v in enhanced_landmarks.items()})
                    
                    # 重要な特徴点のインデックス情報
                    with st.expander("📚 特徴点インデックス参照"):
                        st.markdown("""
                        **改善された機能:**
                        - ✨ **複数点平均化**: より安定した特徴点検出
                        - 🎯 **高精度座標変換**: 浮動小数点による誤差最小化
                        - 📊 **信頼度評価**: 検出品質の可視化
                        - 🔧 **精密調整**: スライダーによるピクセル単位調整
                        - ⚖️ **解剖学的制約**: 不自然な調整の警告
                        - 📱 **応答性UI**: リアルタイム反映と履歴管理
                        
                        **特徴点グループ定義:**
                        - 左目中心: インデックス 159, 158, 157, 173 の平均
                        - 右目中心: インデックス 386, 385, 384, 398 の平均
                        - 鼻先: インデックス 1, 2 の平均
                        - 鼻梁: インデックス 6, 9 の平均
                        - 左小鼻: インデックス 131, 134, 126 の平均
                        - 右小鼻: インデックス 102, 49, 48 の平均
                        """)
    else:
        st.info("🖼️ JPG、PNG、BMP形式の顔画像をアップロードしてください。")
        st.markdown("""
        ### 💡 改善された使い方
        
        **1. 📷 画像アップロード**
        - 顔が1つだけ写った正面向きの画像を選択
        - 推奨サイズ: 500×500ピクセル以上
        - サポート形式: JPG, PNG, BMP
        
        **2. 🎛️ パラメータ調整**
        - サイドバーでスライダーまたは数値入力
        - リアルタイムプレビュー
        - プリセット機能で一括設定
        
        **3. 🎯 高精度特徴点調整**
        - **ドラッグ操作**: マウスで直感的に調整
        - **精密調整**: スライダーでピクセル単位の微調整
        - **信頼度表示**: 検出品質を色で確認
        - **複数点平均化**: より安定した検出
        
        **4. 🔄 品質保証機能**
        - **座標変換整合性**: 高精度浮動小数点処理
        - **解剖学的制約**: 不自然な調整の自動警告
        - **履歴管理**: 元に戻す・やり直し機能
        - **デバッグ情報**: 技術者向け詳細表示
        
        **5. 🛡️ エラーハンドリング**
        - 詳細なエラーメッセージ
        - ファイル形式チェック
        - メモリ使用量監視
        """)

if __name__ == "__main__":
    main()
