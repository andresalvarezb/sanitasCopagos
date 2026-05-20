from datetime import datetime

from pydantic import BaseModel, ConfigDict


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