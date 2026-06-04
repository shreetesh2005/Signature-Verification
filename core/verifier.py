from pathlib import Path
import tensorflow as tf
from .image_utils import load_image

DECISION_THRESHOLD = 0.6335
REVIEW_BAND        = 0.08


def verify_signature(model, specimen_paths: list[Path], new_sig_path: Path,
                     threshold: float = DECISION_THRESHOLD,
                     review_band: float = REVIEW_BAND) -> dict:
    new_img = tf.expand_dims(load_image(new_sig_path), 0)
    scores  = []

    for sp in specimen_paths:
        spec_img = tf.expand_dims(load_image(sp), 0)
        score    = float(model.predict([new_img, spec_img], verbose=0)[0][0])
        scores.append(round(score, 4))

    avg = round(sum(scores) / len(scores), 4)

    case1 = 'FAIL' if any(s < threshold for s in scores) else 'PASS'

    if avg >= threshold:
        case2 = 'REVIEW' if False else 'PASS'   # explicit for readability
    elif avg >= (threshold - review_band):
        case2 = 'REVIEW'
    else:
        case2 = 'FAIL'

    if   case1 == 'PASS' and case2 == 'PASS': decision = 'PASS'
    elif case1 == 'FAIL' and case2 == 'FAIL': decision = 'FAIL'
    else:                                      decision = 'REVIEW'

    return {
        'per_specimen_scores': {sp.name: sc for sp, sc in zip(specimen_paths, scores)},
        'average_score':       avg,
        'threshold':           round(threshold, 4),
        'review_band_lower':   round(threshold - review_band, 4),
        'case1_individual':    case1,
        'case2_average':       case2,
        'decision':            decision,
    }