import asyncio
import logging
import shutil
import tempfile
import traceback
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from core import load_model, verify_signature

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("signature_api")

SPECIMENS_DIR      = Path("specimens")
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg"}
DECISION_THRESHOLD = 0.6335
REVIEW_BAND        = 0.08

app = FastAPI(
    title="Signature Verification API",
    description="Verify a handwritten signature against stored customer specimens using a Siamese Neural Network.",
    version="1.0.0",
)

_model = None

@app.on_event("startup")
async def startup_event():
    global _model
    _model = await asyncio.to_thread(load_model)
    log.info("Model loaded. API ready.")

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Signature Verification API is running."}

@app.get("/customers", tags=["Customers"])
def list_customers():
    if not SPECIMENS_DIR.exists():
        return {"customers": [], "total": 0}
    customers = sorted([d.name for d in SPECIMENS_DIR.iterdir() if d.is_dir()])
    return {"customers": customers, "total": len(customers)}

@app.get("/customers/{customer_id}", tags=["Customers"])
def get_customer(customer_id: str):
    customer_dir = SPECIMENS_DIR / customer_id
    if not customer_dir.exists():
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
    specimens = sorted([f.name for f in customer_dir.iterdir() if f.suffix.lower() in ALLOWED_EXTENSIONS])
    return {"customer_id": customer_id, "specimen_count": len(specimens), "specimens": specimens}

@app.post("/verify", tags=["Verification"])
async def verify(
    customer_id: str        = Form(...),
    signature:   UploadFile = File(...),
    threshold:   float      = Form(DECISION_THRESHOLD),
    review_band: float      = Form(REVIEW_BAND),
):
    try:
        log.info("Request received | customer=%s | file=%s | type=%s", customer_id, signature.filename, signature.content_type)

        if signature.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=415, detail=f"Unsupported file type. Only PNG/JPG accepted.")
        ext = Path(signature.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=415, detail=f"Unsupported extension '{ext}'.")

        customer_dir = SPECIMENS_DIR / customer_id
        if not customer_dir.exists():
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        specimen_paths = sorted([f for f in customer_dir.iterdir() if f.suffix.lower() in ALLOWED_EXTENSIONS])
        if not specimen_paths:
            raise HTTPException(status_code=404, detail="No specimen images found.")

        log.info("Specimens found: %d", len(specimen_paths))

        tmp_dir  = Path(tempfile.mkdtemp())
        tmp_path = tmp_dir / signature.filename
        with tmp_path.open("wb") as f:
            shutil.copyfileobj(signature.file, f)

        log.info("Saved temp file: %s", tmp_path)

        result = await asyncio.to_thread(verify_signature, _model, specimen_paths, tmp_path, threshold, review_band)

        log.info("Verified | customer=%s | decision=%s | avg=%.4f", customer_id, result["decision"], result["average_score"])

        return JSONResponse(content={
            "customer_id":         customer_id,
            "decision":            result["decision"],
            "average_score":       result["average_score"],
            "max_score":           max(list(result["per_specimen_scores"].values())),
            "min_score":           min(list(result["per_specimen_scores"].values())),
            "threshold":           result["threshold"],
            "review_band_lower":   result["review_band_lower"],
            "case1_individual":    result["case1_individual"],
            "case2_average":       result["case2_average"],
            "per_specimen_scores": result["per_specimen_scores"],
        })

    except HTTPException:
        raise
    except Exception as e:
        log.error("FULL ERROR:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
