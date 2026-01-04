# 1. Chọn Base Image
FROM python:3.10-slim

# 2. Thiết lập thư mục làm việc
WORKDIR /app

# 3. Cài đặt các gói hệ thống cần thiết (nếu dùng thư viện xử lý PDF phức tạp)
# Ở đây ta cài cơ bản, nếu sau này dùng thư viện C++ thì thêm vào
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# 4. Cài thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy mã nguồn
COPY src/ ./src/
COPY .env .

# 6. Tạo thư mục uploads (Quan trọng)
# Để tránh lỗi "Folder not found" khi lưu file
RUN mkdir -p uploads

# 7. Mở port 8000
EXPOSE 8000

# 8. Lệnh chạy server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]