FROM python:3.9-slim

WORKDIR /app

# Copy file requirements (nếu chưa có file này thì bạn cần tạo nó trước bằng pip freeze > requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Identity chạy port 8000
EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]