import tempfile
from pathlib import Path

import matplotlib.image as mpimg
import matplotlib.pyplot as plt
import streamlit as st
import tensorflow as tf
from tensorflow import keras

# ─────────────────────────────────────────────
#  PAGE CONFIG
# ─────────────────────────────────────────────
ICON_PATH = Path("signature_verification_icon.png")

st.set_page_config(
    page_title="Signature Verifier",
    page_icon=str(ICON_PATH) if ICON_PATH.exists() else "S",
    layout="wide",
)

# ─────────────────────────────────────────────
#  CONSTANTS
# ─────────────────────────────────────────────
IMG_H, IMG_W       = 128, 256
MODEL_PATH         = Path("model/best_signature_model.keras")
SPECIMENS_DIR      = Path("specimens")
DECISION_THRESHOLD = 0.6335
REVIEW_BAND        = 0.08

# ─────────────────────────────────────────────
#  CUSTOM CSS
# ─────────────────────────────────────────────
st.markdown("""
<style>
    .block-container { padding-top: 2rem; padding-bottom: 2rem; }
    .section-label {
        font-size: 13px; font-weight: 600; letter-spacing: 0.08em;
        text-transform: uppercase; color: #888; margin-bottom: 6px;
    }
    .card {
        background: #f9f9f9; border: 1px solid #e0e0e0;
        border-radius: 10px; padding: 18px 20px; margin-bottom: 12px;
    }
    .decision-banner {
        border-radius: 10px; padding: 18px 24px; margin-bottom: 20px;
    }
    .score-badge {
        border-radius: 8px; padding: 6px 12px;
        text-align: center; font-size: 13px; margin-top: 4px;
    }
    hr { margin: 1.2rem 0; }
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────
#  MODEL ARCHITECTURE
# ─────────────────────────────────────────────
def build_encoder(input_shape=(IMG_H, IMG_W, 1)):
    inp = keras.Input(shape=input_shape)
    x = keras.layers.Conv2D(32,  3, activation='relu', padding='same')(inp)
    x = keras.layers.BatchNormalization()(x)
    x = keras.layers.MaxPooling2D()(x)
    x = keras.layers.Conv2D(64,  3, activation='relu', padding='same')(x)
    x = keras.layers.BatchNormalization()(x)
    x = keras.layers.MaxPooling2D()(x)
    x = keras.layers.Conv2D(128, 3, activation='relu', padding='same')(x)
    x = keras.layers.BatchNormalization()(x)
    x = keras.layers.MaxPooling2D()(x)
    x = keras.layers.Conv2D(256, 3, activation='relu', padding='same')(x)
    x = keras.layers.GlobalAveragePooling2D()(x)
    x = keras.layers.Dense(256, activation='relu')(x)
    x = keras.layers.Dropout(0.3)(x)
    x = keras.layers.Dense(128, activation='relu')(x)
    x = keras.layers.Lambda(lambda v: tf.math.l2_normalize(v, axis=1))(x)
    return keras.Model(inp, x, name='encoder')


def build_siamese(input_shape=(IMG_H, IMG_W, 1)):
    encoder = build_encoder(input_shape)
    inp1 = keras.Input(shape=input_shape, name='signature_1')
    inp2 = keras.Input(shape=input_shape, name='signature_2')
    emb1 = encoder(inp1)
    emb2 = encoder(inp2)
    diff = keras.layers.Lambda(lambda t: tf.abs(t[0] - t[1]))([emb1, emb2])
    x    = keras.layers.Dense(64, activation='relu')(diff)
    x    = keras.layers.Dropout(0.3)(x)
    out  = keras.layers.Dense(1, activation='sigmoid', name='similarity_score')(x)
    return keras.Model(inputs=[inp1, inp2], outputs=out, name='siamese_network')


@st.cache_resource(show_spinner="Loading model weights...")
def load_model():
    if not MODEL_PATH.exists():
        return None
    model = build_siamese()
    model.load_weights(str(MODEL_PATH))
    return model


# ─────────────────────────────────────────────
#  IMAGE UTILITIES
# ─────────────────────────────────────────────
def load_image(path) -> tf.Tensor:
    raw = tf.io.read_file(str(path))
    img = tf.image.decode_image(raw, channels=1, expand_animations=False)
    img = tf.image.resize(img, [IMG_H, IMG_W])
    img = tf.cast(img, tf.float32) / 255.0
    i_min = tf.reduce_min(img)
    i_max = tf.reduce_max(img)
    img   = (img - i_min) / (i_max - i_min + 1e-6)
    img   = 1.0 - img
    img.set_shape([IMG_H, IMG_W, 1])
    return img


def show_image(path, figsize=(3, 1.8), title=None):
    img = mpimg.imread(str(path))
    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_facecolor('#f9f9f9')
    ax.set_facecolor('#f9f9f9')
    ax.imshow(img, cmap='gray' if img.ndim == 2 else None)
    if title:
        ax.set_title(title, fontsize=7, color='#555')
    ax.axis('off')
    plt.tight_layout(pad=0.1)
    st.pyplot(fig, use_container_width=True)
    plt.close(fig)


# ─────────────────────────────────────────────
#  VERIFICATION LOGIC
# ─────────────────────────────────────────────
def verify_signature(model, specimen_paths, new_sig_path,
                     threshold=DECISION_THRESHOLD,
                     review_band=REVIEW_BAND):

    # Load all images once
    new_img     = load_image(new_sig_path)
    spec_imgs   = [load_image(sp) for sp in specimen_paths]
    n           = len(spec_imgs)

    # Batch: repeat new_img n times, stack specimens → single forward pass
    new_batch  = tf.stack([new_img] * n, axis=0)
    spec_batch = tf.stack(spec_imgs,     axis=0)

    raw_scores = model.predict([new_batch, spec_batch], verbose=0, batch_size=n)
    scores     = [round(float(s[0]), 4) for s in raw_scores]

    avg   = round(sum(scores) / len(scores), 4)
    case1 = 'FAIL' if any(s < threshold for s in scores) else 'PASS'

    if avg >= threshold:
        case2 = 'PASS'
    elif avg >= (threshold - review_band):
        case2 = 'REVIEW'
    else:
        case2 = 'FAIL'

    if   case1 == 'PASS' and case2 == 'PASS': decision = 'PASS'
    elif case1 == 'FAIL' and case2 == 'FAIL': decision = 'FAIL'
    else:                                      decision = 'REVIEW'

    return {
        'per_specimen_scores': {sp.name: sc for sp, sc in zip(specimen_paths, scores)},
        'specimen_paths':      specimen_paths,
        'scores':              scores,
        'average_score':       avg,
        'threshold':           round(threshold, 4),
        'review_band_lower':   round(threshold - review_band, 4),
        'case1_individual':    case1,
        'case2_average':       case2,
        'decision':            decision,
    }


def decision_color(d):
    return {"PASS": "#155724", "FAIL": "#721c24", "REVIEW": "#856404"}.get(d, "#333")

def decision_bg(d):
    return {"PASS": "#d4edda", "FAIL": "#f8d7da", "REVIEW": "#fff3cd"}.get(d, "#eee")

def decision_border(d):
    return {"PASS": "#28a745", "FAIL": "#dc3545", "REVIEW": "#ffc107"}.get(d, "#aaa")

def score_status(score, threshold, review_band):
    if score >= threshold:
        return "PASS", "#d4edda", "#28a745"
    elif score >= threshold - review_band:
        return "REVIEW", "#fff3cd", "#ffc107"
    else:
        return "FAIL", "#f8d7da", "#dc3545"


# ─────────────────────────────────────────────
#  SESSION STATE
# ─────────────────────────────────────────────
for key, val in [("page","home"),("result",None),("customer_id",None),("new_sig_path",None)]:
    if key not in st.session_state:
        st.session_state[key] = val


# ─────────────────────────────────────────────
#  SIDEBAR
# ─────────────────────────────────────────────
with st.sidebar:
    if ICON_PATH.exists():
        st.image(str(ICON_PATH), width=72)
    st.title("Signature Verifier")
    st.markdown("---")
    st.markdown("**Settings**")
    threshold = st.slider("Decision Threshold", 0.40, 0.90, DECISION_THRESHOLD, 0.005,
                          help="Similarity score above which a signature is accepted.")
    review_band = st.slider("Review Band Width", 0.02, 0.20, REVIEW_BAND, 0.005,
                            help="Scores within this band below threshold go to REVIEW.")
    st.markdown("---")
    st.caption(f"Threshold: `{threshold}` | Lower: `{threshold - review_band:.4f}`")

    if st.session_state.page == "results":
        st.markdown("---")
        if st.button("Back to Home", use_container_width=True):
            st.session_state.page = "home"
            st.session_state.result = None
            st.rerun()


# ─────────────────────────────────────────────
#  LOAD MODEL
# ─────────────────────────────────────────────
model = load_model()
if model is None:
    st.error(f"Model not found at `{MODEL_PATH}`. Place `best_signature_model.keras` inside `model/`.")
    st.stop()


# ═════════════════════════════════════════════
#  PAGE 1 — HOME
# ═════════════════════════════════════════════
if st.session_state.page == "home":

    # Header
    st.title("Signature Verification System")
    st.markdown("Enter a **Customer ID** and upload a **scanned signature** to verify authenticity.")
    st.markdown("---")

    # ── Input cards side by side ──────────────────────────────────────────────
    col_left, col_right = st.columns(2, gap="large")

    with col_left:
        st.markdown('<p class="section-label">Customer ID</p>', unsafe_allow_html=True)
        customer_id = st.text_input(
            "customer_id", label_visibility="collapsed",
            placeholder="e.g. customer_001",
            help="Must match a folder name inside specimens/"
        )
        specimen_paths = []
        if customer_id:
            customer_dir = SPECIMENS_DIR / customer_id
            if customer_dir.exists() and customer_dir.is_dir():
                allowed = {'.png', '.jpg', '.jpeg'}
                specimen_paths = sorted([
                    f for f in customer_dir.iterdir()
                    if f.suffix.lower() in allowed
                ])
                if specimen_paths:
                    st.success(f"Found {len(specimen_paths)} specimen(s) for `{customer_id}`")
                else:
                    st.warning("Folder exists but contains no images.")
            else:
                st.error(f"No folder found for `{customer_id}` in specimens/")

    with col_right:
        st.markdown('<p class="section-label">Scanned Signature</p>', unsafe_allow_html=True)
        uploaded_new = st.file_uploader(
            "upload", label_visibility="collapsed",
            type=["png", "jpg", "jpeg"], key="new_sig"
        )
        new_sig_path = None
        if uploaded_new:
            tmp_new = Path(tempfile.mkdtemp()) / uploaded_new.name
            tmp_new.write_bytes(uploaded_new.read())
            new_sig_path = tmp_new
            img = mpimg.imread(str(new_sig_path))
            fig, ax = plt.subplots(figsize=(3, 1.2))
            fig.patch.set_facecolor('#f9f9f9')
            ax.set_facecolor('#f9f9f9')
            ax.imshow(img, cmap='gray' if img.ndim == 2 else None)
            ax.axis('off')
            plt.tight_layout(pad=0.1)
            st.pyplot(fig, use_container_width=False)
            plt.close(fig)

    # ── Match Button ──────────────────────────────────────────────────────────
    st.markdown("---")
    _, btn_col, _ = st.columns([2, 3, 2])
    with btn_col:
        match_btn = st.button(
            "Match Signature", type="primary",
            disabled=(not specimen_paths or new_sig_path is None),
            use_container_width=True,
        )

    if match_btn:
        with st.spinner("Running verification..."):
            result = verify_signature(
                model, specimen_paths, new_sig_path,
                threshold=threshold, review_band=review_band
            )
        st.session_state.result       = result
        st.session_state.customer_id  = customer_id
        st.session_state.new_sig_path = str(new_sig_path)
        st.session_state.page         = "results"
        st.rerun()


# ═════════════════════════════════════════════
#  PAGE 2 — RESULTS
# ═════════════════════════════════════════════
elif st.session_state.page == "results":

    result       = st.session_state.result
    customer_id  = st.session_state.customer_id
    new_sig_path = Path(st.session_state.new_sig_path)
    decision     = result['decision']
    specimen_paths = result['specimen_paths']
    scores         = result['scores']

    # ── Header ────────────────────────────────────────────────────────────────
    title_col, btn_col = st.columns([8, 2])
    with title_col:
        st.title(f"Verification Results — {customer_id}")
    with btn_col:
        st.markdown("<div style='height:18px'></div>", unsafe_allow_html=True)
        if st.button("Back", key="back_btn", use_container_width=True):
            st.session_state.page = "home"
            st.session_state.result = None
            st.rerun()
    st.markdown("---")

    # ── Decision Banner ───────────────────────────────────────────────────────
    st.markdown(
        f"""<div style="background:{decision_bg(decision)};
            border-left:5px solid {decision_border(decision)};
            border-radius:8px; padding:16px 22px; margin-bottom:20px;">
            <h3 style="margin:0; color:{decision_color(decision)}">
                Final Decision: {decision}
            </h3>
            <p style="margin:6px 0 0; color:#555; font-size:13px;">
                Customer: <strong>{customer_id}</strong> &nbsp;|&nbsp;
                Average Score: <strong>{result['average_score']}</strong> &nbsp;|&nbsp;
                Threshold: <strong>{result['threshold']}</strong> &nbsp;|&nbsp;
                Review Band Lower: <strong>{result['review_band_lower']}</strong>
            </p>
        </div>""",
        unsafe_allow_html=True,
    )

    # ── Specimens ABOVE new signature ─────────────────────────────────────────
    st.markdown('<p class="section-label">Reference Specimens</p>', unsafe_allow_html=True)
    n_cols = min(len(specimen_paths), 4)
    spec_cols = st.columns(n_cols)
    for i, (sp, score) in enumerate(zip(specimen_paths, scores)):
        with spec_cols[i % n_cols]:
            show_image(sp, figsize=(2.5, 1.6), title=sp.name)
            label, bg, border = score_status(score, result['threshold'], REVIEW_BAND)
            st.markdown(
                f"""<div style="background:{bg}; border:1px solid {border};
                    border-radius:6px; padding:5px 8px; text-align:center;
                    font-size:12px; margin-bottom:10px;">
                    <strong>{score:.4f}</strong> &nbsp; {label}
                </div>""",
                unsafe_allow_html=True,
            )

    st.markdown("---")

    # ── New Signature BELOW specimens ─────────────────────────────────────────
    st.markdown('<p class="section-label">Submitted Signature</p>', unsafe_allow_html=True)
    sig_col, _ = st.columns([1, 2])
    with sig_col:
        show_image(new_sig_path, figsize=(4, 2.2))

    st.markdown("---")

    # ── Verification Summary ──────────────────────────────────────────────────
    st.markdown('<p class="section-label">Verification Summary</p>', unsafe_allow_html=True)

    rows = [
        ("Customer ID",          customer_id),
        ("Average Score",        result['average_score']),
        ("Threshold",            result['threshold']),
        ("Review Band Lower",    result['review_band_lower']),
        ("Case 1 — Individual",  result['case1_individual']),
        ("Case 2 — Average",     result['case2_average']),
        ("Final Decision",       decision),
    ]

    table_html = """
    <table style="width:100%; border-collapse:collapse; font-size:14px; color:inherit;">
        <thead>
            <tr>
                <th style="text-align:left; padding:8px 12px; border-bottom:2px solid #888; color:inherit; opacity:0.7;">Metric</th>
                <th style="text-align:left; padding:8px 12px; border-bottom:2px solid #888; color:inherit; opacity:0.7;">Value</th>
            </tr>
        </thead>
        <tbody>
    """
    for metric, value in rows:
        if metric == "Final Decision":
            table_html += f"""
            <tr style="background:{decision_bg(decision)};">
                <td style="padding:10px 12px; border-bottom:1px solid #aaa;
                    font-weight:700; color:{decision_color(decision)};">{metric}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #aaa;
                    font-weight:700; color:{decision_color(decision)};
                    font-size:15px;">{value}</td>
            </tr>
            """
        else:
            table_html += f"""
            <tr>
                <td style="padding:8px 12px; border-bottom:1px solid #444; color:inherit;">{metric}</td>
                <td style="padding:8px 12px; border-bottom:1px solid #444; color:inherit;">{value}</td>
            </tr>
            """
    table_html += "</tbody></table>"

    import streamlit.components.v1 as components
    components.html(table_html, height=300, scrolling=False)