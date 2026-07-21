FROM python:3.11-slim

WORKDIR /app

# System dependencies for psycopg2, grpcio, numpy, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy application code
COPY backend /app/backend
COPY data /app/data

ENV PYTHONPATH=/app
EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
