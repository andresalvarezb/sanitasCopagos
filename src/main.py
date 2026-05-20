from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

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