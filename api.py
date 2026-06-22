import asyncio
import logging
import shutil
import tempfile
import traceback
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles  

from core import load_model, verify_signature

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("signature_api")

# System Constants
SPECIMENS_DIR = Path("specimens")
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg"}
DECISION_THRESHOLD = 0.6335
REVIEW_BAND        = 0.08

# Initialize FastAPI Application
app = FastAPI(
    title="Signature Verification API",
    description="Verify a handwritten signature against stored customer specimens using a Siamese Neural Network.",
    version="1.0.0",
)

# Static Asset Serving Mount
app.mount("/specimens", StaticFiles(directory="specimens"), name="specimens")

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
    
    # Exclude the archived folder from primary active list array returns
    specimens = sorted([
        f.name for f in customer_dir.iterdir() 
        if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS
    ])
    return {"customer_id": customer_id, "specimen_count": len(specimens), "specimens": specimens}

@app.post("/enroll", tags=["Customers"])
async def enroll_customer(
    customer_id: str = Form(...),
    specimens: List[UploadFile] = File(...)
):
    try:
        customer_id = customer_id.strip()
        if not customer_id:
            raise HTTPException(status_code=400, detail="Customer ID cannot be empty.")
            
        customer_dir = SPECIMENS_DIR / customer_id
        if customer_dir.exists():
            raise HTTPException(status_code=400, detail=f"Registration conflict: Profile folder '{customer_id}' already exists.")
            
        customer_dir.mkdir(parents=True, exist_ok=True)
        saved_count = 0

        for idx, file in enumerate(specimens, start=1):
            ext = Path(file.filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                shutil.rmtree(customer_dir) 
                raise HTTPException(status_code=415, detail=f"Unsupported format item: {file.filename}.")
                
            filename = f"{customer_id}_sig_{idx}{ext}"
            target_path = customer_dir / filename
            
            with target_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_count += 1

        log.info("Successfully enrolled new customer: %s with %d reference specimens.", customer_id, saved_count)
        return {"status": "success", "message": f"Successfully created profile records for '{customer_id}' with {saved_count} items."}

    except HTTPException:
        raise
    except Exception as e:
        log.error("Enrollment error:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/customers/{customer_id}/replace", tags=["Customers"])
async def bulk_replace_and_archive(
    customer_id: str,
    specimens: List[UploadFile] = File(...)
):
    try:
        customer_id = customer_id.strip()
        customer_dir = SPECIMENS_DIR / customer_id
        
        if not customer_dir.exists():
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
            
        if not specimens or len(specimens) < 2:
            raise HTTPException(status_code=400, detail="Please upload at least 2 or more new specimen signatures.")

        # Create hidden archive path inside the customer folder if it doesn't exist
        archive_dir = customer_dir / "archived"
        archive_dir.mkdir(exist_ok=True)

        # 1. ARCHIVE RUN: Identify all current root-level active signature files
        current_active_files = [
            f for f in customer_dir.iterdir()
            if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS
        ]

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Safely move each file to archive with timestamp signature prefix headers
        for active_file in current_active_files:
            archived_filename = f"{timestamp}_{active_file.name}"
            shutil.move(str(active_file), str(archive_dir / archived_filename))

        # 2. SAVE NEW BATCH: Save the new file list array sequentially
        saved_count = 0
        for idx, file in enumerate(specimens, start=1):
            ext = Path(file.filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=415, detail=f"Unsupported extension '{ext}' inside batch files.")
                
            filename = f"{customer_id}_sig_{idx}{ext}"
            target_path = customer_dir / filename
            
            with target_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_count += 1

        log.info("Bulk archived old records and saved %d new baseline files for customer: %s", saved_count, customer_id)
        return {
            "status": "success", 
            "message": f"Successfully moved old signatures to archive folder and updated baseline with {saved_count} new entries."
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error("Bulk upload processing error:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/verify", tags=["Verification"])
async def verify(
    customer_id: str        = Form(...),
    signature:   UploadFile = File(...),
    threshold:   float      = Form(DECISION_THRESHOLD),
    review_band: float      = Form(REVIEW_BAND),
):
    try:
        log.info("Request received | customer=%s | file=%s", customer_id, signature.filename)

        if signature.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=415, detail="Unsupported file type. Only PNG/JPG accepted.")
        customer_dir = SPECIMENS_DIR / customer_id
        if not customer_dir.exists():
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        # Filter only root level items (ignores archived folder completely)
        specimen_paths = sorted([
            f for f in customer_dir.iterdir() 
            if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS
        ])
        if not specimen_paths:
            raise HTTPException(status_code=404, detail="No specimen images found.")

        tmp_dir  = Path(tempfile.mkdtemp())
        tmp_path = tmp_dir / signature.filename
        with tmp_path.open("wb") as f:
            shutil.copyfileobj(signature.file, f)

        result = await asyncio.to_thread(verify_signature, _model, specimen_paths, tmp_path, threshold, review_band)

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