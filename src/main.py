from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from src.database.conection import get_db
from sqlalchemy.orm import Session
from src.schemas import ImportBatchOut
from src.services.import_service import import_file

app = FastAPI(
    title="Sanitas Copagos API",
    version="1.0.0",
    description="API para gestionar los copagos de Sanitas",
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html", media_type="text/html")

@app.get("/admin")
def admin():
    return FileResponse(STATIC_DIR / "admin.html", media_type="text/html")


# carga de archivos de datos al iniciar la aplicación
@app.post("/api/imports/upload", response_model=ImportBatchOut)
async def upload_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    return await import_file(db, file)