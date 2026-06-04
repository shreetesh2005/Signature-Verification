import streamlit as st
from pathlib import Path
from tensorflow import keras
import tensorflow as tf

IMG_H, IMG_W = 128, 256
MODEL_PATH   = Path("model/best_signature_model.keras")


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


@st.cache_resource(show_spinner="Loading model weights…")
def load_model():
    if not MODEL_PATH.exists():
        return None
    model = build_siamese()
    model.load_weights(str(MODEL_PATH))
    return model