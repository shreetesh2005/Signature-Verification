# SigVerify — Signature Verification System

SigVerify is a full-stack offline signature verification system built on a Siamese neural network. It compares a submitted handwritten signature against a customer's enrolled reference specimens and returns a PASS, REVIEW, or FAIL decision. It is designed for banking and document authentication workflows where human review of borderline cases is part of the process.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Dataset](#dataset)
- [Model](#model)
- [Decision Logic](#decision-logic)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Configuration](#configuration)

---

## Overview

The system takes a photo or scan of a handwritten signature, compares it to stored reference images for a given customer, and produces a similarity-based verification decision. There are three layers:

- ML Core — a Siamese CNN trained on the CEDAR signature dataset
- Backend — a FastAPI server that handles customer enrollment, specimen storage, and inference
- Frontend — a React single-page application with three pages: Verify, New Customer, and Manage Directory

---

## Architecture

```
React Frontend  (/verify · /enroll · /manage)
        |
        | HTTP via axios, proxied to port 8000
        |
        v
FastAPI Backend
  GET  /                  health check
  GET  /customers         list enrolled customers
  GET  /customers/:id     specimen info for a customer
  POST /enroll            register a new customer with specimens
  POST /verify            run inference against stored specimens
  POST /customers/:id/replace   replace a specimen file
        |
        |
        v
sigverify Python package
  image_utils.py    load and preprocess images
  model_loader.py   build and load the Siamese model
  verifier.py       scoring and PASS/REVIEW/FAIL logic
        |
        |
        v
model/best_signature_model.keras
```

---

## Dataset

The model is trained on the CEDAR (Center of Excellence for Document Analysis and Recognition) Handwritten Signature Dataset, which contains handwritten signatures from 55 writers with 24 samples per writer, giving 1,320 reference images in total.

Pairs are generated programmatically. Same-writer pairs are treated as positive matches, and cross-writer pairs are treated as impostors. Up to 100 same-writer pairs are sampled per writer, and cross-writer pairs are drawn from different writers to balance the dataset. An 80/20 stratified train/validation split is applied, keeping the same positive-to-impostor ratio in both sets.

---

## Model

The network is a Siamese CNN with a shared encoder and a learned similarity head.

**Encoder architecture**

The encoder takes a 128x256 grayscale image and passes it through four convolutional blocks. Each of the first three blocks consists of a Conv2D layer followed by Batch Normalization and Max Pooling. The filter counts increase from 32 to 64 to 128, and the fourth block uses 256 filters with Global Average Pooling instead of Max Pooling. The output is passed through a Dense(256) layer with ReLU activation and 0.3 dropout, then a Dense(128) layer with ReLU, and finally L2-normalized to produce a 128-dimensional unit embedding.

Both signatures pass through the same encoder. The absolute difference of the two embeddings is fed into a small classification head — Dense(64) with ReLU, 0.3 dropout, then Dense(1) with sigmoid — that outputs a similarity score between 0 and 1.

**Training**

- Loss: Binary crossentropy
- Optimizer: Adam
- Callbacks: EarlyStopping with patience 6, ReduceLROnPlateau, ModelCheckpoint saving the best validation loss
- Maximum epochs: 50

**Image preprocessing**

All images are resized to 128x256 pixels (H x W), converted to grayscale, and contrast-stretched via min-max normalization. The image is then inverted so ink strokes appear bright on a dark background, which is the format the network was trained on.

**Threshold selection**

The decision threshold is derived from Youden's J statistic on the validation ROC curve, which maximizes the sum of sensitivity and specificity. The default value is 0.6335 with a review band of 0.08 below that.

---

## Decision Logic

Each verification run compares the submitted signature against all enrolled specimens for that customer. Two independent criteria are evaluated.

Case 1 checks individual specimen scores. If any single specimen score falls below the threshold, Case 1 is FAIL. Otherwise it is PASS.

Case 2 checks the average score across all specimens. If the average is at or above the threshold it is PASS. If it falls within the review band (between threshold minus 0.08 and the threshold) it is REVIEW. Below the review band it is FAIL.

The final decision combines both cases. If both are PASS the result is PASS. If both are FAIL the result is FAIL. Any mixed combination — one PASS and one REVIEW, or one case PASS and one FAIL, or any other divergence — results in REVIEW, flagging the submission for manual inspection.

The frontend additionally promotes any result with an average score at or above 0.70 straight to PASS, and displays per-specimen score bars alongside a summary grid showing average, highest, and lowest scores.

---

## Project Structure

```
sigverify/
  model/
    best_signature_model.keras    trained weights (not tracked in git)

  sigverify/
    __init__.py
    image_utils.py                image loading and preprocessing
    model_loader.py               model architecture and weight loader
    verifier.py                   scoring and decision engine

  notebooks/
    Source_Code.ipynb             full training pipeline (Colab)
    verify_signature.ipynb        local inference and testing notebook

  frontend/
    public/
      index.html
    src/
      App.js
      index.js
      index.css
      api/
        client.js                 axios API wrappers
      components/
        DropZone.js               drag-and-drop image uploader
        MagnifiedImage.js         hover zoom lens component
        VerdictCard.js            result display with score breakdown

  README.md
```

---

## Setup and Installation

**Prerequisites**

- Python 3.10 or later
- Node.js 18 or later with npm
- TensorFlow 2.x (GPU recommended for training; CPU is sufficient for inference)

**Backend**

```bash
python -m venv .venv
source .venv/bin/activate
# On Windows: .venv\Scripts\activate

pip install tensorflow fastapi uvicorn python-multipart pillow
```

Place your trained model weights at `model/best_signature_model.keras` before starting the server.

**Frontend**

```bash
cd frontend
npm install
```

---

## Running the App

Start the FastAPI backend:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Start the React dev server:

```bash
cd frontend
npm start
```

The React app runs on `http://localhost:3000` and proxies all API calls to `http://127.0.0.1:8000` via the proxy setting in `package.json`.

**Local inference via notebook**

Open `notebooks/verify_signature.ipynb` and set the two path variables at the top:

```python
SPECIMEN_FOLDER = r"path/to/images/customer_XXX"
NEW_SIG_PATH    = r"path/to/new_signature.png"
```

Run all cells to see per-specimen scores, the average, and the final decision printed inline alongside visualizations of the specimens.

---

## API Reference

**GET /**
Health check. Returns `{ "status": "ok" }`.

**GET /customers**
Returns a list of all enrolled customer IDs and the total count.

**GET /customers/:id**
Returns the specimen count and filenames stored for a specific customer.

**POST /enroll**
Multipart form. Fields: `customer_id` (string) and `specimens` (one or more image files). Registers a new customer and saves their reference images to disk.

**POST /verify**
Multipart form. Required fields: `customer_id` (string) and `signature` (image file). Optional fields: `threshold` (float) and `review_band` (float) to override defaults. Returns a JSON object with the decision, average score, max score, min score, threshold values, individual case results, and a per-specimen score breakdown.

Example response:

```json
{
  "customer_id": "024",
  "decision": "PASS",
  "average_score": 0.7821,
  "max_score": 0.8103,
  "min_score": 0.7432,
  "threshold": 0.6335,
  "review_band_lower": 0.5535,
  "case1_individual": "PASS",
  "case2_average": "PASS",
  "per_specimen_scores": {
    "024_sig_1.png": 0.8103,
    "024_sig_2.png": 0.7432,
    "024_sig_3.png": 0.7921,
    "024_sig_4.png": 0.7828
  }
}
```

**POST /customers/:id/replace**
Multipart form. Fields: `filename` (the specimen to overwrite) and `new_specimen` (replacement image file). Swaps out a specific stored reference image for a customer.

---

## Frontend Pages

**Verify (/verify)**
Select an enrolled customer from the dropdown, upload a signature image via the drop zone, and submit. The result appears as a colour-coded verdict card — green for PASS, amber for REVIEW, red for FAIL — with a per-specimen score bar list and a three-metric summary showing average, highest, and lowest similarity scores.

**New Customer (/enroll)**
Enter a new customer ID and upload multiple reference specimen images in one step to register them in the system.

**Manage Directory (/manage)**
Browse all enrolled customers, inspect their stored specimens, and replace individual reference files without having to re-enroll the customer.

The navigation bar shows a live API status indicator that pings the health endpoint every 30 seconds.

---

## Configuration

All key parameters can be adjusted in the files listed below.

- Decision threshold: `0.6335` in `verifier.py` as `DECISION_THRESHOLD`
- Review band: `0.08` in `verifier.py` as `REVIEW_BAND`
- Image dimensions: `128 x 256` in `image_utils.py` as `IMG_H` and `IMG_W`
- Model path: `model/best_signature_model.keras` in `model_loader.py` as `MODEL_PATH`
- API proxy target: `http://127.0.0.1:8000` in `frontend/package.json` under `proxy`

---

## Notes

The model file is not included in this repository because of its size. Train it using `Source_Code.ipynb` on Google Colab with a GPU runtime and place the output at `model/best_signature_model.keras`.

The CEDAR dataset must be downloaded separately and mounted to Google Drive before running the training notebook.

For production use, the local file-system specimen store should be replaced with a proper database or object storage service, and authentication should be added to the FastAPI routes.
