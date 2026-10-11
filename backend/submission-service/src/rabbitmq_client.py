# Đường dẫn: backend/submission-service/src/rabbitmq_client.py

import pika
import json
import os

# Cấu hình RabbitMQ & Dead Letter Queue
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
QUEUE_NAME = "notification_queue"
DLX_NAME = "dlx_notification"
DLQ_NAME = "failed_notification_queue"
DLX_ROUTING_KEY = "notification_dead_letter"

def setup_queues(channel):
    """
    Khai báo Dead Letter Exchange (DLX), Dead Letter Queue (DLQ)
    và Main Queue gắn với DLX để tự động định tuyến thông điệp lỗi.
    """
    # 1. Khai báo Dead Letter Exchange
    channel.exchange_declare(
        exchange=DLX_NAME, 
        exchange_type="direct", 
        durable=True
    )

    # 2. Khai báo Dead Letter Queue
    channel.queue_declare(
        queue=DLQ_NAME, 
        durable=True
    )
    channel.queue_bind(
        exchange=DLX_NAME, 
        queue=DLQ_NAME, 
        routing_key=DLX_ROUTING_KEY
    )

    # 3. Khai báo Main Queue gắn với Dead Letter Exchange
    channel.queue_declare(
        queue=QUEUE_NAME,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DLX_NAME,
            "x-dead-letter-routing-key": DLX_ROUTING_KEY,
        }
    )

def publish_message(message: dict):
    try:
        # 1. Tạo kết nối
        connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
        channel = connection.channel()

        # 2. Khai báo hàng đợi kèm DLQ
        setup_queues(channel)

        # 3. Gửi tin nhắn persistent
        channel.basic_publish(
            exchange='',
            routing_key=QUEUE_NAME,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent (Lưu tin nhắn vào ổ cứng)
                content_type="application/json",
            )
        )
        
        print(f" [x] Sent message to RabbitMQ: {message}")
        connection.close()
        return True
    except Exception as e:
        print(f" [!] Error connecting to RabbitMQ: {e}")
        return False