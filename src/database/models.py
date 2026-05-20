from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Text, func
from datetime import datetime

class Base(DeclarativeBase):
    pass

class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="procesando")
    total_filas: Mapped[int] = mapped_column(default=0)
    filas_insertadas: Mapped[int] = mapped_column(default=0)
    filas_rechazadas: Mapped[int] = mapped_column(default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

