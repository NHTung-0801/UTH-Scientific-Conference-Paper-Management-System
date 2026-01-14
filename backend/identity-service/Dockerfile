# Sử dụng Python 3.9 hoặc 3.10
FROM python:3.10-slim

# Thiết lập thư mục làm việc bên trong container
WORKDIR /app

# Copy file requirements và cài đặt thư viện
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code nguồn vào container
COPY . .

# Mở port 8000
EXPOSE 8000

# Lệnh chạy ứng dụng
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]