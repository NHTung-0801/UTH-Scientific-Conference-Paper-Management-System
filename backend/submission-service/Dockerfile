# Sử dụng Python 3.9 (hoặc phiên bản bạn đang dùng)
FROM python:3.9-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy file requirements.txt vào container trước
COPY requirements.txt .

# Cài đặt các thư viện
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở port 8002 (port mà service này sẽ chạy)
EXPOSE 8002

# Lệnh chạy server khi container khởi động
# Lưu ý: host 0.0.0.0 là bắt buộc để truy cập được từ bên ngoài container
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002"]