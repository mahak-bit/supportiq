# Backend image. NOTE: not built during development (Docker was unavailable); see README.
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "uvicorn[standard]==0.34.2" "psycopg[binary]==3.2.9"
COPY . .
# Persist /app/data (SQLite file + downloaded embedding model) on a volume, or set DATABASE_URL to Postgres.
VOLUME ["/app/data"]
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
