from pathlib import Path
import tensorflow as tf

IMG_H, IMG_W = 128, 256


def load_image(path) -> tf.Tensor:
    """Load PNG/JPG as grayscale float tensor with contrast stretch and inversion."""
    raw = tf.io.read_file(str(path))
    img = tf.image.decode_image(raw, channels=1, expand_animations=False)
    img = tf.image.resize(img, [IMG_H, IMG_W])
    img = tf.cast(img, tf.float32) / 255.0

    i_min = tf.reduce_min(img)
    i_max = tf.reduce_max(img)
    img   = (img - i_min) / (i_max - i_min + 1e-6)

    img = 1.0 - img          # invert: ink strokes → bright
    img.set_shape([IMG_H, IMG_W, 1])
    return img