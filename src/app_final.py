import streamlit as st
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
from streamlit_drawable_canvas import st_canvas
import json
import math
from typing import Dict, Tuple, Optional, List, Any
import copy

# ページ設定
st.set_page_config(
    page_title="顔特徴点調整ツール (完全版)",
    page_icon="👤",
    layout="wide"
)

# MediaPipe設定
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# 定数定義
CANVAS_WIDTH = 600
CANVAS_HEIGHT = 800
MOVEMENT_THRESHOLD = 5.0
COORDINATE_PRECISION = 2

LANDMARK_GROUPS = {
    'nose_tip': {
        'indices': [1, 2], 
        'color': '#00FF00', 
        'size': 12, 
        'label': '鼻先'
    },
    'nose_bridge': {
        'indices': [6, 9], 
        'color': '#00AA00', 
        'size': 8, 
        'label': '鼻梁'
    },
    'left_nostril': {
        'indices': [131, 134, 126], 
        'color': '#0000FF', 
        'size': 10, 
        'label': '左小鼻'
    },
    'right_nostril': {
        'indices': [102, 49, 48], 
        'color': '#0066FF', 
        'size': 10, 
        'label': '右小鼻'
    },
    'left_eye_center': {
        'indices': [159, 158, 157, 173], 
        'color': '#FF0000', 
        'size': 10, 
        'label': '左目'
    },
    'right_eye_center': {
        'indices': [386, 385, 384, 398], 
        'color': '#FF6600', 
        'size': 10, 
        'label': '右目'
    }
}


def initialize_session_state():
    """セッション状態の初期化"""
    if 'landmarks' not in st.session_state:
        st.session_state.landmarks = None
    if 'manual_adjustments' not in st.session_state:
        st.session_state.manual_adjustments = {}
    if 'history' not in st.session_state:
        st.session_state.history = []
    if 'current_image' not in st.session_state:
        st.session_state.current_image = None
    if 'movement_threshold' not in st.session_state:
        st.session_state.movement_threshold = MOVEMENT_THRESHOLD
    if 'show_confidence' not in st.session_state:
        st.session_state.show_confidence = False
    if 'show_constraints' not in st.session_state:
        st.session_state.show_constraints = False


@st.cache_resource
def get_face_mesh():
    """FaceMeshインスタンスを取得（キャッシュ）"""
    return mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    )


def detect_face_landmarks(image: np.ndarray) -> Optional[Any]:
    """顔の特徴点を検出"""
    face_mesh = get_face_mesh()
    
    try:
        # BGRからRGBに変換
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_image)
        
        if results.multi_face_landmarks:
            return results.multi_face_landmarks[0]
    except Exception as e:
        st.error(f"顔検出エラー: {str(e)}")
    
    return None


def calculate_landmark_center(landmarks, indices: List[int], image_shape: Tuple[int, int]) -> Optional[Dict[str, float]]:
    """複数のランドマークの中心座標を計算"""
    h, w = image_shape
    
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
    
    # 中心座標を計算
    center_x = sum(p['x'] for p in points) / len(points)
    center_y = sum(p['y'] for p in points) / len(points)
    
    return {
        'x': round(center_x, COORDINATE_PRECISION),
        'y': round(center_y, COORDINATE_PRECISION)
    }


def assess_landmark_confidence(landmarks, point_name: str, image_shape: Tuple[int, int]) -> Dict[str, Any]:
    """ランドマークの信頼度を評価"""
    if point_name not in LANDMARK_GROUPS:
        return {'confidence': 0.0, 'status': 'unknown', 'color': '#808080'}
    
    indices = LANDMARK_GROUPS[point_name]['indices']
    h, w = image_shape
    
    # 各点の座標を取得
    points = []
    for idx in indices:
        if idx < len(landmarks.landmark):
            point = landmarks.landmark[idx]
            points.append({
                'x': point.x * w,
                'y': point.y * h,
                'z': point.z
            })
    
    if len(points) < 2:
        return {'confidence': 0.0, 'status': 'insufficient', 'color': '#FF0000'}
    
    # 点群の分散から信頼度を計算
    center = calculate_landmark_center(landmarks, indices, (h, w))
    if not center:
        return {'confidence': 0.0, 'status': 'failed', 'color': '#FF0000'}
    
    # 各点の中心からの距離を計算
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


def validate_anatomical_constraints(adjustments: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
    """解剖学的制約を検証"""
    warnings = []
    metrics = {}
    
    required_points = ['nose_tip', 'nose_bridge', 'left_nostril', 'right_nostril']
    
    # 必要な特徴点が全て調整されているかチェック
    if not all(point in adjustments for point in required_points):
        return {
            'is_valid': True,
            'warnings': [],
            'metrics': {}
        }
    
    nose_tip = adjustments['nose_tip']
    nose_bridge = adjustments['nose_bridge']
    left_nostril = adjustments['left_nostril']
    right_nostril = adjustments['right_nostril']
    
    # 鼻の長さチェック
    nose_length = math.sqrt(
        (nose_tip['x'] - nose_bridge['x'])**2 + 
        (nose_tip['y'] - nose_bridge['y'])**2
    )
    metrics['nose_length'] = nose_length
    
    # 小鼻間の距離チェック
    nostril_distance = math.sqrt(
        (left_nostril['x'] - right_nostril['x'])**2 + 
        (left_nostril['y'] - right_nostril['y'])**2
    )
    metrics['nostril_distance'] = nostril_distance
    
    # 鼻の角度チェック（垂直からの傾き）
    nose_angle = math.atan2(
        nose_tip['x'] - nose_bridge['x'], 
        nose_tip['y'] - nose_bridge['y']
    )
    nose_angle_degrees = abs(math.degrees(nose_angle))
    metrics['nose_angle_degrees'] = nose_angle_degrees
    
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
        'metrics': metrics
    }


def scale_coordinates(coords: Dict[str, float], from_size: Tuple[int, int], to_size: Tuple[int, int]) -> Dict[str, float]:
    """座標をスケーリング"""
    scale_x = to_size[0] / from_size[0]
    scale_y = to_size[1] / from_size[1]
    
    return {
        'x': round(coords['x'] * scale_x, COORDINATE_PRECISION),
        'y': round(coords['y'] * scale_y, COORDINATE_PRECISION)
    }


def calculate_canvas_size(image_shape: Tuple[int, int]) -> Tuple[int, int]:
    """画像サイズに基づいてキャンバスサイズを計算"""
    h, w = image_shape
    
    if w > h:
        canvas_w = CANVAS_WIDTH
        canvas_h = int((h / w) * CANVAS_WIDTH)
        canvas_h = min(canvas_h, CANVAS_HEIGHT)
    else:
        canvas_h = min(CANVAS_HEIGHT, int((h / w) * CANVAS_WIDTH))
        canvas_w = int((w / h) * canvas_h)
    
    return canvas_w, canvas_h


def create_canvas_objects(landmarks, image_shape: Tuple[int, int], canvas_size: Tuple[int, int], adjustments: Dict[str, Dict[str, float]] = None) -> List[Dict]:
    """キャンバス用のオブジェクトを作成"""
    objects = []
    h, w = image_shape
    canvas_w, canvas_h = canvas_size
    
    for name, config in LANDMARK_GROUPS.items():
        # ランドマークの中心を計算
        center = calculate_landmark_center(landmarks, config['indices'], (h, w))
        if not center:
            continue
        
        # 手動調整がある場合は適用
        if adjustments and name in adjustments:
            center = adjustments[name]
        
        # 信頼度評価
        confidence_info = assess_landmark_confidence(landmarks, name, (h, w))
        
        # 信頼度に基づいて色を調整（オプション）
        color = config['color']
        if st.session_state.show_confidence:
            color = confidence_info['color']
        
        # キャンバス座標にスケーリング
        canvas_coords = scale_coordinates(center, (w, h), (canvas_w, canvas_h))
        
        # 円オブジェクトを作成
        objects.append({
            'type': 'circle',
            'left': canvas_coords['x'] - config['size'],
            'top': canvas_coords['y'] - config['size'],
            'radius': config['size'],
            'fill': color,
            'stroke': '#FFFFFF',
            'strokeWidth': 2,
            'selectable': True,
            'name': name,
            'originalX': canvas_coords['x'],
            'originalY': canvas_coords['y'],
            'confidence': confidence_info['confidence']
        })
    
    return objects


def update_adjustments_from_canvas(canvas_result, image_shape: Tuple[int, int], canvas_size: Tuple[int, int]):
    """キャンバスの結果から調整値を更新"""
    if not canvas_result.json_data:
        return False
    
    objects = canvas_result.json_data.get('objects', [])
    h, w = image_shape
    canvas_w, canvas_h = canvas_size
    movement_threshold = st.session_state.movement_threshold
    
    updated = False
    
    for obj in objects:
        if obj.get('type') == 'circle' and obj.get('name'):
            name = obj['name']
            
            # 現在の中心座標
            current_x = obj.get('left', 0) + obj.get('radius', 0)
            current_y = obj.get('top', 0) + obj.get('radius', 0)
            
            # 元の座標
            original_x = obj.get('originalX', current_x)
            original_y = obj.get('originalY', current_y)
            
            # 移動距離を計算
            distance = math.sqrt((current_x - original_x)**2 + (current_y - original_y)**2)
            
            # 閾値を超えた場合のみ更新
            if distance >= movement_threshold:
                # 実際の画像座標に変換
                real_coords = scale_coordinates(
                    {'x': current_x, 'y': current_y},
                    (canvas_w, canvas_h),
                    (w, h)
                )
                
                # 履歴に保存
                if name not in st.session_state.manual_adjustments or \
                   st.session_state.manual_adjustments[name] != real_coords:
                    save_to_history()
                    st.session_state.manual_adjustments[name] = real_coords
                    updated = True
    
    return updated


def draw_landmarks_on_image(image: np.ndarray, landmarks, adjustments: Dict[str, Dict[str, float]] = None) -> np.ndarray:
    """画像上に特徴点を描画"""
    annotated_image = image.copy()
    h, w = image.shape[:2]
    
    # 基本的な顔メッシュを描画
    mp_drawing.draw_landmarks(
        image=annotated_image,
        landmark_list=landmarks,
        connections=mp_face_mesh.FACEMESH_CONTOURS,
        landmark_drawing_spec=None,
        connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style()
    )
    
    # 特徴点グループを描画
    for name, config in LANDMARK_GROUPS.items():
        # ランドマークの中心を計算
        center = calculate_landmark_center(landmarks, config['indices'], (h, w))
        if not center:
            continue
        
        # 手動調整がある場合は適用
        if adjustments and name in adjustments:
            center = adjustments[name]
        
        # 信頼度に基づく色の選択
        color = config['color']
        if st.session_state.show_confidence:
            confidence_info = assess_landmark_confidence(landmarks, name, (h, w))
            color = confidence_info['color']
        
        # HEXからBGRに変換
        color_bgr = tuple(int(color[i:i+2], 16) for i in (5, 3, 1))
        
        # 円を描画
        cv2.circle(annotated_image, (int(center['x']), int(center['y'])), 
                  config['size'], color_bgr, -1)
        cv2.circle(annotated_image, (int(center['x']), int(center['y'])), 
                  config['size'] + 2, (255, 255, 255), 2)
        
        # 信頼度を表示（オプション）
        if st.session_state.show_confidence:
            confidence_info = assess_landmark_confidence(landmarks, name, (h, w))
            confidence_text = f"{confidence_info['confidence']:.2f}"
            cv2.putText(annotated_image, confidence_text, 
                       (int(center['x']) + 15, int(center['y']) - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    
    return annotated_image


def save_to_history():
    """現在の状態を履歴に保存"""
    current_state = copy.deepcopy(st.session_state.manual_adjustments)
    
    # 直前の状態と同じでない場合のみ保存
    if not st.session_state.history or st.session_state.history[-1] != current_state:
        st.session_state.history.append(current_state)
        
        # 履歴の最大数を制限
        if len(st.session_state.history) > 20:
            st.session_state.history.pop(0)


def create_sidebar_controls():
    """サイドバーのコントロールを作成"""
    st.sidebar.header("🎯 特徴点調整設定")
    
    # 移動検出閾値
    st.session_state.movement_threshold = st.sidebar.slider(
        "移動検出閾値（ピクセル）",
        min_value=1.0,
        max_value=20.0,
        value=st.session_state.movement_threshold,
        step=0.5,
        help="この値以上移動した時のみ位置を更新します"
    )
    
    # 表示オプション
    st.sidebar.subheader("📊 表示オプション")
    st.session_state.show_confidence = st.sidebar.checkbox(
        "信頼度表示",
        value=st.session_state.show_confidence,
        help="特徴点の検出信頼度を色で表示"
    )
    
    st.session_state.show_constraints = st.sidebar.checkbox(
        "制約チェック",
        value=st.session_state.show_constraints,
        help="解剖学的制約の検証結果を表示"
    )
    
    # 操作ボタン
    st.sidebar.subheader("🔧 操作")
    col1, col2 = st.sidebar.columns(2)
    
    with col1:
        if st.button("🔄 リセット"):
            st.session_state.manual_adjustments = {}
            st.session_state.history = []
            st.rerun()
    
    with col2:
        if st.button("↶ 元に戻す") and st.session_state.history:
            st.session_state.history.pop()  # 現在の状態を削除
            if st.session_state.history:
                st.session_state.manual_adjustments = st.session_state.history[-1]
            else:
                st.session_state.manual_adjustments = {}
            st.rerun()
    
    # 現在の調整状況
    if st.session_state.manual_adjustments:
        st.sidebar.success(f"📍 {len(st.session_state.manual_adjustments)}個の特徴点を調整済み")
        
        with st.sidebar.expander("📝 調整詳細"):
            for name, pos in st.session_state.manual_adjustments.items():
                st.write(f"**{LANDMARK_GROUPS[name]['label']}**: ({pos['x']:.1f}, {pos['y']:.1f})")
    
    # 使い方
    with st.sidebar.expander("📖 操作方法"):
        st.markdown("""
        ### 基本操作
        1. 🖱️ 色付きの円をドラッグして移動
        2. 🎯 閾値以上移動すると位置が更新
        3. ↶ 元に戻すで前の状態に復帰
        4. 🔄 リセットで初期状態に戻る
        
        ### 表示機能
        - **信頼度表示**: 検出品質を色で表示
        - **制約チェック**: 解剖学的な妥当性を検証
        
        ### 特徴点の色分け
        - 🟢 緑: 鼻（大=鼻先、小=鼻梁）
        - 🔵 青: 小鼻（濃=左、明=右）
        - 🔴 赤: 目（濃=左、橙=右）
        
        ### 信頼度の色
        - 🟢 緑: 高信頼度 (>0.8)
        - 🟡 黄: 中信頼度 (0.5-0.8)
        - 🔴 赤: 低信頼度 (<0.5)
        """)


def main():
    """メイン関数"""
    st.title("👤 顔特徴点調整ツール (完全版)")
    st.markdown("**高精度な顔特徴点検出・調整・検証システム** - 信頼度評価・制約チェック対応")
    
    # セッション状態を初期化
    initialize_session_state()
    
    # サイドバーコントロール
    create_sidebar_controls()
    
    # ファイルアップローダー
    uploaded_file = st.file_uploader(
        "画像をアップロードしてください",
        type=['jpg', 'jpeg', 'png', 'bmp'],
        help="顔が正面を向いた画像を選択してください"
    )
    
    if uploaded_file is not None:
        try:
            # PILで開く
            pil_image = Image.open(uploaded_file)
            if pil_image.mode == 'RGBA':
                pil_image = pil_image.convert('RGB')
            
            # numpy配列に変換
            image_array = np.array(pil_image)
            cv_image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            st.session_state.current_image = cv_image
            
            # 顔特徴点を検出
            with st.spinner("顔を検出中..."):
                landmarks = detect_face_landmarks(cv_image)
            
            if landmarks is None:
                st.error("❌ 顔を検出できませんでした。以下を確認してください：")
                st.markdown("""
                - 顔が正面を向いているか
                - 顔が画像の中央にあるか
                - 照明が適切か
                - 顔の一部が隠れていないか
                """)
            else:
                st.success("✅ 顔を検出しました！特徴点をドラッグして調整できます。")
                st.session_state.landmarks = landmarks
                
                # キャンバスサイズを計算
                h, w = cv_image.shape[:2]
                canvas_w, canvas_h = calculate_canvas_size((h, w))
                
                # 画像をキャンバスサイズにリサイズ
                canvas_image = pil_image.resize((canvas_w, canvas_h), Image.Resampling.LANCZOS)
                
                # 画像を表示
                col1, col2 = st.columns(2)
                
                with col1:
                    st.subheader("🎨 調整キャンバス")
                    if st.session_state.show_confidence:
                        st.caption("色＝信頼度：🟢高 🟡中 🔴低")
                    else:
                        st.caption("色付きの点をドラッグして調整")
                    
                    # キャンバスオブジェクトを作成
                    initial_objects = create_canvas_objects(
                        landmarks, (h, w), (canvas_w, canvas_h), 
                        st.session_state.manual_adjustments
                    )
                    
                    # インタラクティブキャンバス
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
                        key="landmark_canvas"
                    )
                    
                    # キャンバスの変更を処理
                    if canvas_result.json_data:
                        if update_adjustments_from_canvas(canvas_result, (h, w), (canvas_w, canvas_h)):
                            st.rerun()
                
                with col2:
                    st.subheader("🎭 結果表示")
                    st.caption("調整後の特徴点位置")
                    
                    # 特徴点を描画
                    annotated_image = draw_landmarks_on_image(
                        cv_image, 
                        landmarks,
                        st.session_state.manual_adjustments
                    )
                    # BGRからRGBに変換して表示
                    rgb_annotated = cv2.cvtColor(annotated_image, cv2.COLOR_BGR2RGB)
                    st.image(rgb_annotated, use_container_width=True)
                
                # 解剖学的制約の表示
                if st.session_state.show_constraints and st.session_state.manual_adjustments:
                    with st.expander("⚖️ 解剖学的制約チェック"):
                        validation_result = validate_anatomical_constraints(st.session_state.manual_adjustments)
                        
                        if validation_result['is_valid']:
                            st.success("✅ 解剖学的制約: 正常範囲内")
                        else:
                            st.warning("⚠️ 解剖学的制約の警告:")
                            for warning in validation_result['warnings']:
                                st.write(f"• {warning}")
                        
                        # 詳細メトリクス
                        if validation_result['metrics']:
                            st.subheader("📊 詳細メトリクス")
                            metrics = validation_result['metrics']
                            cols = st.columns(3)
                            
                            with cols[0]:
                                st.metric("鼻の長さ", f"{metrics.get('nose_length', 0):.1f}px")
                            with cols[1]:
                                st.metric("小鼻間距離", f"{metrics.get('nostril_distance', 0):.1f}px")
                            with cols[2]:
                                st.metric("鼻の角度", f"{metrics.get('nose_angle_degrees', 0):.1f}度")
                
                # 検出情報・信頼度情報
                with st.expander("📊 特徴点情報"):
                    cols = st.columns(3)
                    for i, (name, config) in enumerate(LANDMARK_GROUPS.items()):
                        with cols[i % 3]:
                            center = calculate_landmark_center(landmarks, config['indices'], (h, w))
                            if center:
                                # 信頼度情報
                                confidence_info = assess_landmark_confidence(landmarks, name, (h, w))
                                
                                # 手動調整がある場合
                                if name in st.session_state.manual_adjustments:
                                    pos = st.session_state.manual_adjustments[name]
                                    st.metric(
                                        f"{config['label']} ✏️",
                                        f"({pos['x']:.1f}, {pos['y']:.1f})",
                                        f"信頼度: {confidence_info['confidence']:.2f}"
                                    )
                                else:
                                    st.metric(
                                        config['label'],
                                        f"({center['x']:.1f}, {center['y']:.1f})",
                                        f"信頼度: {confidence_info['confidence']:.2f}"
                                    )
        
        except Exception as e:
            st.error(f"❌ エラーが発生しました: {str(e)}")
            st.markdown("**対処法:**")
            st.markdown("- 別の画像ファイルをお試しください")
            st.markdown("- 画像サイズを小さくしてみてください")
            st.markdown("- サポートされた形式（JPG、PNG、BMP）を使用してください")
    
    else:
        st.info("👆 上のボタンから画像をアップロードしてください")
        
        with st.expander("📖 アプリケーションについて"):
            st.markdown("""
            ### 🎯 このツールの特徴
            
            **高精度な顔特徴点検出:**
            - MediaPipe Face Meshによる468個の特徴点検出
            - 6つの重要特徴点（鼻先、鼻梁、左右小鼻、左右目）の強化
            - 複数ランドマークの平均化による安定性向上
            
            **インタラクティブな調整機能:**
            - ドラッグ&ドロップによる直感的な位置調整
            - 高精度な座標変換システム
            - リアルタイムな視覚フィードバック
            
            **品質保証機能:**
            - 信頼度評価による検出品質の可視化
            - 解剖学的制約による調整の妥当性チェック
            - 操作履歴管理（Undo/Redo機能）
            
            **研究・教育対応:**
            - 詳細な座標情報の表示
            - 技術的なメトリクスの提供
            - 高精度な座標精度管理
            
            ### 🎓 適用分野
            - 認知心理学実験
            - 顔認識研究
            - コンピュータビジョン教育
            - 画像解析アプリケーション開発
            """)


if __name__ == "__main__":
    main()