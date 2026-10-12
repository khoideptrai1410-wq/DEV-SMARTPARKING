# Thử nghiệm YOLOv12 + PaddleOCR (giữ nguyên pipeline cũ)

## Mục tiêu

Thử pipeline riêng:
1. YOLOv12 đã train/fine-tune phát hiện biển số Việt Nam.
2. PaddleOCR đọc vùng biển đã crop.
3. Script benchmark chạy cùng một tập ảnh qua pipeline cũ và pipeline mới.

**Không thay thế** `src/vision/plate_ocr.py` và không tự chuyển Flask sang pipeline mới. Nếu thử nghiệm không tốt hơn, hệ thống chính vẫn dùng pipeline hiện tại.

## Điều kiện quan trọng

- Cần weights YOLOv12 đã train/fine-tune để phát hiện biển số. Weights YOLO chung huấn luyện trên COCO không phải model phát hiện biển số chuyên dụng.
- Cần tập ảnh kiểm thử độc lập, giống camera bãi xe thật nhất có thể: biển xe máy 2 dòng, ô tô, ảnh xa, nghiêng, sáng/tối.
- Để đo chính xác, tạo CSV gán nhãn thủ công, ví dụ:

```csv
image,plate
scene_001.jpg,59B112345
scene_002.jpg,51A12345
```

## Cài đặt gợi ý trên Windows

Nên làm trong môi trường Python riêng để không ảnh hưởng môi trường đang chạy SmartParking. Chạy từ thư mục gốc repo:

```powershell
py -3.11 -m venv .venv-yolo-paddle
.\.venv-yolo-paddle\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Cài implementation YOLOv12 từ repository upstream theo hướng dẫn của tác giả. Thực hiện trong thư mục phụ bên ngoài repo SmartParking, không trộn source YOLOv12 vào mã ứng dụng:

```powershell
git clone https://github.com/sunsmarterjie/yolov12.git ..\yolov12-upstream
python -m pip install -e ..\yolov12-upstream
```

Sau đó cài PaddleOCR:

```powershell
python -m pip install -r requirements-yolov12-paddle.txt
```

PaddleOCR có phụ thuộc framework/runtime riêng. Cách cài CPU/GPU phụ thuộc hệ điều hành và phiên bản CUDA; hãy dùng hướng dẫn chính thức phù hợp máy. Nếu pip báo xung đột dependency, không sửa môi trường chính — chỉ xử lý trong môi trường thử nghiệm riêng.

## Chuẩn bị model YOLOv12

1. Huấn luyện/fine-tune model YOLOv12 với class biển số, ví dụ `license_plate`, bằng ảnh được gán nhãn bounding box.
2. Lưu weights, ví dụ `yolov12n_plate.pt`.
3. Đặt biến môi trường trỏ đến file weights:

```powershell
$env:SMARTPARKING_YOLO_PLATE_MODEL="C:\duong-dan\den\yolov12n_plate.pt"
```

Tuỳ chọn chọn thiết bị:

```powershell
$env:SMARTPARKING_YOLO_DEVICE="cpu"
# Hoặc GPU nếu môi trường hỗ trợ:
# $env:SMARTPARKING_YOLO_DEVICE="0"
```

Nếu chưa có weights đã huấn luyện, pipeline thử nghiệm sẽ báo thiếu model; kết quả khi đó **chưa thể kết luận** YOLOv12 nhanh/chính xác hơn.

## Chạy benchmark

Đưa cùng tập ảnh vào một thư mục, ví dụ `data/benchmark_plates/`. Chạy từ thư mục gốc:

```powershell
python scripts/benchmark_plate_ocr.py --input data/benchmark_plates --labels data/benchmark_plates/labels.csv
```

Nếu chưa có nhãn đúng:

```powershell
python scripts/benchmark_plate_ocr.py --input data/benchmark_plates
```

File chi tiết mặc định: `outputs/plate_ocr_benchmark.csv`.

Có thể chạy riêng một pipeline:

```powershell
python scripts/benchmark_plate_ocr.py --input data/benchmark_plates --pipelines legacy
python scripts/benchmark_plate_ocr.py --input data/benchmark_plates --pipelines yolo-paddle
```

## Đọc kết quả

So sánh:
- **Exact-plate accuracy**: toàn bộ biển số phải đúng 100%, không chỉ đúng định dạng.
- **Latency median và P95**: thời gian xử lý một ảnh sau khi model đã khởi tạo.
- **Valid rate**: tỷ lệ chuỗi khớp định dạng biển số Việt Nam; đây là chỉ số phụ, không chứng minh biển số đúng.
- Kiểm tra cả ảnh xa và khó; đừng chỉ tính trung bình trên ảnh rõ.

Benchmark này đo thời gian xử lý ảnh có sẵn cho mỗi recognizer; chưa đo camera capture, mạng, Flask, .NET, SQL Server hoặc cập nhật React. Muốn đánh giá FPS end-to-end cần đo toàn luồng. Chạy trên cùng máy/cùng ảnh và ghi lại CPU/GPU, model, kích thước ảnh và phiên bản thư viện.

## Quyết định sau thử nghiệm

Chỉ cân nhắc chuyển pipeline nếu model mới cải thiện accuracy và độ trễ trên dữ liệu thực tế, không chỉ trên vài ảnh demo. Nếu chưa có weights, PaddleOCR không cài tương thích, hoặc accuracy giảm thì giữ pipeline cũ nguyên vẹn. Khi kết quả tốt, bước sau mới là thêm lựa chọn engine có thể bật/tắt trong Flask.
