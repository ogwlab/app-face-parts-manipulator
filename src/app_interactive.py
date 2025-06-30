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
    page_title="顔特徴点調整ツール (インタラクティブ版)",
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
        st.session_state.movement_threshold = 5.0


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
    
    # BGRからRGBに変換
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_image)
    
    if results.multi_face_landmarks:
        return results.multi_face_landmarks[0]
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
    
    return {'x': center_x, 'y': center_y}


def scale_coordinates(coords: Dict[str, float], from_size: Tuple[int, int], to_size: Tuple[int, int]) -> Dict[str, float]:
    """座標をスケーリング"""
    scale_x = to_size[0] / from_size[0]
    scale_y = to_size[1] / from_size[1]
    
    return {
        'x': coords['x'] * scale_x,
        'y': coords['y'] * scale_y
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
        
        # キャンバス座標にスケーリング
        canvas_coords = scale_coordinates(center, (w, h), (canvas_w, canvas_h))
        
        # 円オブジェクトを作成
        objects.append({
            'type': 'circle',
            'left': canvas_coords['x'] - config['size'],
            'top': canvas_coords['y'] - config['size'],
            'radius': config['size'],
            'fill': config['color'],
            'stroke': '#FFFFFF',
            'strokeWidth': 2,
            'selectable': True,
            'name': name,
            'originalX': canvas_coords['x'],
            'originalY': canvas_coords['y']
        })
    
    return objects


def update_adjustments_from_canvas(canvas_result, image_shape: Tuple[int, int], canvas_size: Tuple[int, int]):
    """キャンバスの結果から調整値を更新"""
    if not canvas_result.json_data:
        return
    
    objects = canvas_result.json_data.get('objects', [])
    h, w = image_shape
    canvas_w, canvas_h = canvas_size
    movement_threshold = st.session_state.movement_threshold
    
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
        
        color = tuple(int(config['color'][i:i+2], 16) for i in (5, 3, 1))  # HEXからBGRに変換
        
        # 円を描画
        cv2.circle(annotated_image, (int(center['x']), int(center['y'])), 
                  config['size'], color, -1)
        cv2.circle(annotated_image, (int(center['x']), int(center['y'])), 
                  config['size'] + 2, (255, 255, 255), 2)
    
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
    
    # 操作ボタン
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
        1. 🖱️ 色付きの円をドラッグして移動
        2. 🎯 閾値以上移動すると位置が更新
        3. ↶ 元に戻すで前の状態に復帰
        4. 🔄 リセットで初期状態に戻る
        
        **特徴点の色分け:**
        - 🟢 緑: 鼻（大=鼻先、小=鼻梁）
        - 🔵 青: 小鼻（濃=左、明=右）
        - 🔴 赤: 目（濃=左、橙=右）
        """)


def main():
    """メイン関数"""
    st.title("👤 顔特徴点調整ツール (インタラクティブ版)")
    st.markdown("ドラッグ&ドロップで特徴点を調整できる高精度ツール")
    
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
                st.error("❌ 顔を検出できませんでした。別の画像をお試しください。")
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
                        update_adjustments_from_canvas(canvas_result, (h, w), (canvas_w, canvas_h))
                
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
                
                # 検出情報
                with st.expander("📊 特徴点座標"):
                    cols = st.columns(3)
                    for i, (name, config) in enumerate(LANDMARK_GROUPS.items()):
                        with cols[i % 3]:
                            center = calculate_landmark_center(landmarks, config['indices'], (h, w))
                            if center:
                                # 手動調整がある場合
                                if name in st.session_state.manual_adjustments:
                                    pos = st.session_state.manual_adjustments[name]
                                    st.metric(
                                        f"{config['label']} ✏️",
                                        f"({pos['x']:.1f}, {pos['y']:.1f})",
                                        f"調整済み"
                                    )
                                else:
                                    st.metric(
                                        config['label'],
                                        f"({center['x']:.1f}, {center['y']:.1f})"
                                    )
        
        except Exception as e:
            st.error(f"❌ エラーが発生しました: {str(e)}")
    
    else:
        st.info("👆 上のボタンから画像をアップロードしてください")


if __name__ == "__main__":
    main()