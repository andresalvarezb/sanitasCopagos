from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class ImportBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    estado: str
    total_filas: int
    filas_insertadas: int
    filas_rechazadas: int
    error: str | None = None
    created_at: datetime

class PacienteInfo(BaseModel):
    identificacion_paciente: str | None = None
    tipo_doc_paciente: str | None = None
    nombre: str | None = None
    eps: str | None = None
    municipio: str | None = None
    departamento: str | None = None
    categoria_actual: str | None = None

class RegistroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_ciclo_dispensacion: str
    eps: str | None
    numero_prescripcion: str | None
    fecha_maxima_entrega: date | None
    tipo_doc_paciente: str | None
    identificacion_paciente: str
    fecha_direccionamiento: date | None
    codigo_tecnologia_direccionada: str | None
    tecnologia_direccionada: str | None
    cantidad_total_entregar: Decimal | None
    nombre: str | None
    municipio: str | None
    departamento: str | None
    domiciliario: str | None
    estado_paciente: str | None
    estado_final: str | None
    laboratorio: str | None
    valor_direccionado: Decimal | None
    categoria: str | None
    copago: Decimal | None

class RegistrosSearchOut(BaseModel):
    query: str
    tipo_busqueda: str
    total: int
    total_valor_direccionado: Decimal
    total_copago: Decimal
    paciente: PacienteInfo
    registros: list[RegistroOut]


class CategoriaUpdateIn(BaseModel):
    categoria: str = Field(pattern="^[ABCZ]$")
    identificacion_paciente: str | None = None
    id_ciclo_dispensacion: str | None = None


class CategoriaUpdateOut(BaseModel):
    actualizados: int
    categoria: str
    porcentaje: Decimal


class ImportErrorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    row_number: int
    error: str
    raw_json: str | None
    created_at: datetime