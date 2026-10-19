# YOLOv12 + PaddleOCR cho nhận diện biển số

## Trọng số YOLOv12

Ứng dụng tìm checkpoint tại:

- **models/vision/yolo12n_plate.pt**

Hoặc đặt biến môi trường LICENSE_PLATE_MODEL_PATH trỏ đến checkpoint phù hợp.

**Checkpoint phải được huấn luyện/tinh chỉnh để phát hiện biển số**, và tên lớp nên là license_plate. Trọng số YOLOv12 COCO nguyên bản như yolo12n.pt không có lớp biển số nên không thể dùng trực tiếp cho tác vụ này.

Không commit file .pt vào Git vì file trọng số có thể lớn. Hãy đặt file trên máy chạy ứng dụng.

## Huấn luyện / tinh chỉnh mô hình

1. Chuẩn bị dữ liệu ảnh xe, gán nhãn bounding box quanh từng biển số bằng công cụ gán nhãn phù hợp.
2. Chia dữ liệu thành train và validation, tránh để ảnh gần giống nhau xuất hiện ở cả hai tập.
3. Chuẩn bị file data.yaml theo định dạng Ultralytics, với đúng một lớp tên license_plate.
4. Chạy từ thư mục gốc repository:

   python ai_service/train_yolo12.py --data D:/datasets/license-plate/data.yaml --epochs 80

5. Script sẽ sao chép checkpoint tốt nhất sang models/vision/yolo12n_plate.pt.

Sau huấn luyện, đánh giá precision, recall, mAP trên tập validation và kiểm tra ảnh xe Việt Nam chưa từng xuất hiện trong tập train.

## OCR

PaddleOCR tải các mô hình OCR cần thiết lần đầu chạy và lưu trong cache người dùng. AI service sử dụng PaddleOCR để chuyển phần ảnh biển số do YOLO cắt thành chuỗi chữ/số.
