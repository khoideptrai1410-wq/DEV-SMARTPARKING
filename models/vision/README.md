# Mô hình thị giác (biển số)

Đặt trọng số detector/OCR tại đây khi nhóm train xong, ví dụ:

- `yolo_plate.pt` — phát hiện vùng biển
- `ocr_weights/` — backend EasyOCR / PaddleOCR

Code đọc ảnh nằm ở `src/vision/plate_ocr.py`. Ứng dụng Flask gọi qua `/api/scan-plate`, `/api/checkin`, `/api/checkout`.


## YOLOv12 + PaddleOCR thử nghiệm

Trong nhánh thử nghiệm `experiment/yolov12-paddle-benchmark`, có thể đặt weights detector YOLOv12 đã huấn luyện nhận diện biển số tại:

`models/vision/yolov12n_plate.pt`

Hoặc đặt biến môi trường `SMARTPARKING_YOLO_PLATE_MODEL` trỏ đến file `.pt` ở vị trí khác. Không ghi đè weights đang dùng cho hệ thống cũ. Model YOLOv12 cần được train/fine-tune cho class biển số; weights COCO mặc định không đủ để phát hiện biển số.
