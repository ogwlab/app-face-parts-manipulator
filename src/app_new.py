import streamlit as st
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import io
from typing import Dict, Tuple, Optional, List, Any
import copy

# ページ設定
st.set_page_config(
    page_title="顔特徴点調整ツール",
    page_icon="👤",
    layout="wide"
)

# MediaPipe設定
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# 定数定義
LANDMARK_GROUPS = {
    'nose_tip': {'indices': [1, 2], 'color': '#00FF00', 'size': 12, 'label': '鼻先'},
    'nose_bridge': {'indices': [6, 9], 'color': '#00AA00', 'size': 8, 'label': '鼻梁'},
    'left_nostril': {'indices': [131, 134, 126], 'color': '#0000FF', 'size': 10, 'label': '左小鼻'},
    'right_nostril': {'indices': [102, 49, 48], 'color': '#0066FF', 'size': 10, 'label': '右小鼻'},
    'left_eye_center': {'indices': [159, 158, 157, 173], 'color': '#FF0000', 'size': 10, 'label': '左目'},
    'right_eye_center': {'indices': [386, 385, 384, 398], 'color': '#FF6600', 'size': 10, 'label': '右目'}
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
    if 'adjustment_mode' not in st.session_state:
        st.session_state.adjustment_mode = False


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


def calculate_landmark_center(landmarks, indices: List[int], image_shape: Tuple[int, int]) -> Dict[str, float]:
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


def get_landmark_positions(landmarks, image_shape: Tuple[int, int]) -> Dict[str, Dict[str, float]]:
    """各特徴点グループの位置を取得"""
    positions = {}
    
    for name, config in LANDMARK_GROUPS.items():
        center = calculate_landmark_center(landmarks, config['indices'], image_shape)
        if center:
            positions[name] = center
    
    return positions


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
    positions = get_landmark_positions(landmarks, (h, w))
    
    for name, pos in positions.items():
        # 手動調整がある場合は調整後の位置を使用
        if adjustments and name in adjustments:
            pos = adjustments[name]
        
        config = LANDMARK_GROUPS[name]
        color = tuple(int(config['color'][i:i+2], 16) for i in (5, 3, 1))  # HEXからBGRに変換
        
        # 円を描画
        cv2.circle(annotated_image, (int(pos['x']), int(pos['y'])), 
                  config['size'], color, -1)
        cv2.circle(annotated_image, (int(pos['x']), int(pos['y'])), 
                  config['size'] + 2, (255, 255, 255), 2)
        
        # ラベルを表示
        cv2.putText(annotated_image, config['label'], 
                   (int(pos['x']) + 15, int(pos['y']) - 5),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    return annotated_image


def create_adjustment_interface():
    """特徴点調整インターフェースを作成"""
    st.sidebar.header("🎯 特徴点調整")
    
    # 調整モードの切り替え
    st.session_state.adjustment_mode = st.sidebar.checkbox(
        "手動調整モード", 
        value=st.session_state.adjustment_mode
    )
    
    if st.session_state.adjustment_mode and st.session_state.landmarks:
        st.sidebar.info("特徴点を選択して位置を調整してください")
        
        # 特徴点の選択
        selected_point = st.sidebar.selectbox(
            "調整する特徴点:",
            options=list(LANDMARK_GROUPS.keys()),
            format_func=lambda x: LANDMARK_GROUPS[x]['label']
        )
        
        if selected_point:
            # 現在の位置を取得
            h, w = st.session_state.current_image.shape[:2]
            positions = get_landmark_positions(st.session_state.landmarks, (h, w))
            
            if selected_point in positions:
                current_pos = positions[selected_point]
                
                # 手動調整がある場合はその値を使用
                if selected_point in st.session_state.manual_adjustments:
                    current_pos = st.session_state.manual_adjustments[selected_point]
                
                st.sidebar.subheader(f"🎯 {LANDMARK_GROUPS[selected_point]['label']}の調整")
                
                # X座標の調整
                new_x = st.sidebar.slider(
                    "X座標",
                    min_value=0,
                    max_value=w,
                    value=int(current_pos['x']),
                    step=1
                )
                
                # Y座標の調整
                new_y = st.sidebar.slider(
                    "Y座標",
                    min_value=0,
                    max_value=h,
                    value=int(current_pos['y']),
                    step=1
                )
                
                # 調整を適用
                if new_x != int(current_pos['x']) or new_y != int(current_pos['y']):
                    # 履歴に保存
                    save_to_history()
                    # 新しい位置を保存
                    st.session_state.manual_adjustments[selected_point] = {
                        'x': float(new_x),
                        'y': float(new_y)
                    }
                
                # 微調整用
                st.sidebar.subheader("🔧 精密調整")
                col1, col2 = st.sidebar.columns(2)
                with col1:
                    x_offset = st.sidebar.number_input(
                        "X微調整",
                        min_value=-10.0,
                        max_value=10.0,
                        value=0.0,
                        step=0.1
                    )
                with col2:
                    y_offset = st.sidebar.number_input(
                        "Y微調整",
                        min_value=-10.0,
                        max_value=10.0,
                        value=0.0,
                        step=0.1
                    )
                
                if st.sidebar.button("微調整を適用"):
                    save_to_history()
                    current = st.session_state.manual_adjustments.get(selected_point, current_pos)
                    st.session_state.manual_adjustments[selected_point] = {
                        'x': current['x'] + x_offset,
                        'y': current['y'] + y_offset
                    }
                    st.rerun()
        
        # 操作ボタン
        col1, col2 = st.sidebar.columns(2)
        with col1:
            if st.button("🔄 リセット"):
                st.session_state.manual_adjustments = {}
                st.session_state.history = []
                st.rerun()
        
        with col2:
            if st.button("↶ 元に戻す") and st.session_state.history:
                restore_from_history()
                st.rerun()
        
        # 現在の調整状況
        if st.session_state.manual_adjustments:
            st.sidebar.success(f"📍 {len(st.session_state.manual_adjustments)}個の特徴点を調整中")
            
            with st.sidebar.expander("調整詳細"):
                for name, pos in st.session_state.manual_adjustments.items():
                    st.write(f"**{LANDMARK_GROUPS[name]['label']}**: ({pos['x']:.1f}, {pos['y']:.1f})")


def save_to_history():
    """現在の状態を履歴に保存"""
    current_state = copy.deepcopy(st.session_state.manual_adjustments)
    st.session_state.history.append(current_state)
    
    # 履歴の最大数を制限
    if len(st.session_state.history) > 20:
        st.session_state.history.pop(0)


def restore_from_history():
    """履歴から状態を復元"""
    if st.session_state.history:
        st.session_state.manual_adjustments = st.session_state.history.pop()


def main():
    """メイン関数"""
    st.title("👤 顔特徴点調整ツール")
    st.markdown("MediaPipeを使用した高精度な顔特徴点の検出と手動調整")
    
    # セッション状態を初期化
    initialize_session_state()
    
    # サイドバーで調整インターフェースを作成
    create_adjustment_interface()
    
    # ファイルアップローダー
    uploaded_file = st.file_uploader(
        "画像をアップロードしてください",
        type=['jpg', 'jpeg', 'png', 'bmp'],
        help="顔が正面を向いた画像を選択してください"
    )
    
    if uploaded_file is not None:
        # 画像を読み込み
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
                st.success("✅ 顔を検出しました！")
                st.session_state.landmarks = landmarks
                
                # 画像を表示
                col1, col2 = st.columns(2)
                
                with col1:
                    st.subheader("元画像")
                    st.image(pil_image, use_container_width=True)
                
                with col2:
                    st.subheader("特徴点表示")
                    # 特徴点を描画
                    annotated_image = draw_landmarks_on_image(
                        cv_image, 
                        landmarks,
                        st.session_state.manual_adjustments if st.session_state.adjustment_mode else None
                    )
                    # BGRからRGBに変換して表示
                    rgb_annotated = cv2.cvtColor(annotated_image, cv2.COLOR_BGR2RGB)
                    st.image(rgb_annotated, use_container_width=True)
                
                # 検出された特徴点の情報を表示
                with st.expander("📊 検出情報"):
                    positions = get_landmark_positions(landmarks, cv_image.shape[:2])
                    
                    cols = st.columns(3)
                    for i, (name, pos) in enumerate(positions.items()):
                        with cols[i % 3]:
                            # 手動調整がある場合はその値を表示
                            if st.session_state.adjustment_mode and name in st.session_state.manual_adjustments:
                                pos = st.session_state.manual_adjustments[name]
                                st.metric(
                                    f"{LANDMARK_GROUPS[name]['label']} (調整済み)",
                                    f"({pos['x']:.1f}, {pos['y']:.1f})"
                                )
                            else:
                                st.metric(
                                    LANDMARK_GROUPS[name]['label'],
                                    f"({pos['x']:.1f}, {pos['y']:.1f})"
                                )
        
        except Exception as e:
            st.error(f"❌ エラーが発生しました: {str(e)}")
    
    else:
        # 使い方の説明
        st.info("👆 上のボタンから画像をアップロードしてください")
        
        with st.expander("📖 使い方"):
            st.markdown("""
            ### 基本的な使い方
            
            1. **画像をアップロード** - JPG、PNG、BMPファイルに対応
            2. **顔の検出** - MediaPipeが自動的に顔と特徴点を検出
            3. **特徴点の確認** - 6つの主要な特徴点が色分けされて表示
            4. **手動調整** - サイドバーで調整モードを有効にして位置を調整
            
            ### 特徴点の説明
            - 🟢 **鼻先・鼻梁** - 緑色で表示
            - 🔵 **左右の小鼻** - 青色で表示
            - 🔴 **左右の目** - 赤・オレンジ色で表示
            
            ### 調整機能
            - スライダーで大まかな位置調整
            - 数値入力で精密な微調整
            - 履歴機能で操作を元に戻す
            """)


if __name__ == "__main__":
    main()