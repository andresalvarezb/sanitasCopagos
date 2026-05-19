from fastapi import FastAPI

app = FastAPI(
    title="Sanitas Copagos API",
    version="1.0.0",
    description="API para gestionar los copagos de Sanitas",
)

@app.get("/")
def index():
    return {"message": "Bienvenido a la API de Sanitas Copagos"}