from fastapi import FastAPI, UploadFile, File, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from src.database.conection import get_db, engine
from src.database.models import Base, ImportBatch, RegistroActual
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from src.schemas import ImportBatchOut, RegistrosSearchOut, PacienteInfo, CategoriaUpdateIn, CategoriaUpdateOut
from src.services.import_service import import_file
from src.services.normalization import clean_document, clean_text, calculate_copago, CATEGORY_RATES
from contextlib import asynccontextmanager
from decimal import Decimal

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Sanitas Copagos API",
    version="1.0.0",
    description="API para gestionar los copagos de Sanitas",
    lifespan=lifespan,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html", media_type="text/html")

@app.get("/admin")
def admin():
    return FileResponse(STATIC_DIR / "admin.html", media_type="text/html")

# * ADMIN VIEW API ENDPOINTS

# carga de archivos de datos al iniciar la aplicación
@app.post("/api/imports/upload", response_model=ImportBatchOut)
async def upload_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    return await import_file(db, file)

@app.get("/api/imports", response_model=list[ImportBatchOut])
def list_imports(db: Session = Depends(get_db)):
    stmt = select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(50)
    return db.scalars(stmt).all()

# * INDEX VIEW API ENDPOINTS
# Buscar dirreccionamientos por paciente

def build_patient_info(records: list[RegistroActual]) -> PacienteInfo:
    if not records:
        return PacienteInfo()

    first = records[0]
    categorias = {r.categoria for r in records if r.categoria}
    categoria_actual = list(categorias)[0] if len(categorias) == 1 else None

    return PacienteInfo(
        identificacion_paciente=first.identificacion_paciente,
        tipo_doc_paciente=first.tipo_doc_paciente,
        nombre=first.nombre,
        eps=first.eps,
        municipio=first.municipio,
        departamento=first.departamento,
        categoria_actual=categoria_actual,
    )

@app.get("/api/registros", response_model=RegistrosSearchOut)
def search_records(
    query: str = Query(..., min_length=1),
    tipo: str = Query("auto", pattern="^(auto|documento|id_ciclo)$"),
    db: Session = Depends(get_db),
):
    q_doc = clean_document(query)
    q_text = clean_text(query, upper=True)

    if tipo == "documento":
        if not q_doc:
            raise HTTPException(status_code=400, detail="Documento inválido")
        stmt = select(RegistroActual).where(RegistroActual.identificacion_paciente == q_doc)
    elif tipo == "id_ciclo":
        if not q_text:
            raise HTTPException(status_code=400, detail="ID Ciclo inválido")
        stmt = select(RegistroActual).where(RegistroActual.id_ciclo_dispensacion == q_text)
    else:
        conditions = []
        if q_doc:
            conditions.append(RegistroActual.identificacion_paciente == q_doc)
        if q_text:
            conditions.append(RegistroActual.id_ciclo_dispensacion == q_text)
        stmt = select(RegistroActual).where(or_(*conditions)) if conditions else select(RegistroActual).where(False)

    stmt = stmt.order_by(RegistroActual.fecha_direccionamiento.desc().nullslast(), RegistroActual.id.desc())
    records = list(db.scalars(stmt).all())

    total_valor = sum((r.valor_direccionado or Decimal("0")) for r in records)
    total_copago = sum((r.copago or Decimal("0")) for r in records)

    return RegistrosSearchOut(
        query=query,
        tipo_busqueda=tipo,
        total=len(records),
        total_valor_direccionado=total_valor,
        total_copago=total_copago,
        paciente=build_patient_info(records),
        registros=records,
    )

@app.put("/api/registros/categoria", response_model=CategoriaUpdateOut)
def update_categoria(payload: CategoriaUpdateIn, db: Session = Depends(get_db)):
    categoria = payload.categoria.upper()
    rate = CATEGORY_RATES[categoria]

    stmt = select(RegistroActual)

    if payload.identificacion_paciente:
        documento = clean_document(payload.identificacion_paciente)
        if not documento:
            raise HTTPException(status_code=400, detail="Identificación del Paciente inválida")
        stmt = stmt.where(RegistroActual.identificacion_paciente == documento)
    elif payload.id_ciclo_dispensacion:
        id_ciclo = clean_text(payload.id_ciclo_dispensacion, upper=True)
        if not id_ciclo:
            raise HTTPException(status_code=400, detail="ID Ciclo Dispensación inválido")
        stmt = stmt.where(RegistroActual.id_ciclo_dispensacion == id_ciclo)
    else:
        raise HTTPException(
            status_code=400,
            detail="Debes enviar identificacion_paciente o id_ciclo_dispensacion",
        )

    records = list(db.scalars(stmt).all())
    if not records:
        raise HTTPException(status_code=404, detail="No se encontraron registros para actualizar")

    for record in records:
        record.categoria = categoria
        record.copago = calculate_copago(record.valor_direccionado, categoria)

    db.commit()

    return CategoriaUpdateOut(actualizados=len(records), categoria=categoria, porcentaje=rate * Decimal("100"))
