FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY internal/ /app/internal/
COPY worker/ /app/worker/

CMD ["python", "-m", "worker.main"]
