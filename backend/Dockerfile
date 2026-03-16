FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOST=0.0.0.0 \
    APP_PORT=8001 \
    APP_WORKERS=2

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.local.txt ./requirements.local.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.local.txt

COPY app ./app
COPY data ./data
COPY sql ./sql

RUN mkdir -p /app/storage/uploads

EXPOSE 8001

CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${APP_PORT:-8001} --workers ${APP_WORKERS:-2}"]
