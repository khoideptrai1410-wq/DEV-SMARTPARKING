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

Prototype trong nhánh này dùng API `from ultralytics import YOLO`, nên cài gói Ultralytics có hỗ trợ YOLO12:

```powershell
python -m pip install -U ultralytics
```

Điều này dùng implementation YOLO12 của Ultralytics; weights từ implementation khác không mặc định tương thích. Tài liệu chính thức: https://docs.ultralytics.com/models/yolo12.

Cài PaddlePaddle CPU rồi cài PaddleOCR:

```powershell
python -m pip install paddlepaddle==3.2.1 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
python -m pip install -r requirements-yolov12-paddle.txt
```

Các phiên bản Python/Windows không phải lúc nào cũng có wheel tương thích. Nếu pip báo không tìm được bản cài, chọn lệnh từ hướng dẫn chính thức phù hợp máy: https://www.paddleocr.ai/latest/en/quick_start.html. Chỉ chuyển sang bản GPU sau khi xác định GPU NVIDIA và phiên bản driver/CUDA. Nếu có xung đột dependency, chỉ xử lý trong môi trường thử nghiệm riêng.


## Chuẩn bị dataset phát hiện biển số

Đã rà soát nhánh `master`: có 41 file ảnh trong `data/`, nhưng nhiều file là crop hoặc trùng. Không có file nhãn YOLO `.txt`, không có `data.yaml`, và không có weights detector trong `models/vision/`. `data/processed/plate_scans.csv` là kết quả OCR, không có tọa độ bounding box. Lọc ứng viên theo tên và hash cho ra khoảng 7 ảnh độc lập cần kiểm tra thủ công; con số này chưa khẳng định tất cả là ảnh toàn cảnh phù hợp và chưa đủ để train detector tốt.

Đã thêm công cụ vào nhánh này:
1. Gom ảnh và loại trùng:
   ```powershell
   python scripts/prepare_plate_detection_dataset.py
   ```
2. Gán nhãn từng biển số bằng cửa sổ OpenCV:
   ```powershell
   python scripts/annotate_plate_dataset.py
   ```
   Kéo chuột quanh toàn bộ biển số. `S` lưu box, `N` đánh dấu ảnh đã xem nhưng không thấy biển số, `U` undo, `R` xóa box, `X` loại ảnh không phù hợp, `Q` thoát.
3. Kiểm tra nhãn và tạo split:
   ```powershell
   python scripts/prepare_plate_detection_dataset.py --finalize
   ```

Hướng dẫn đầy đủ nằm tại [data/datasets/plate_detection/README.md](../data/datasets/plate_detection/README.md). Ảnh và nhãn mới được giữ local, không commit lên repo công khai mặc định.

## Fine-tune YOLO12 trên dataset đã gán nhãn

Chỉ chạy sau khi `data/datasets/plate_detection/yolo/data.yaml` đã được tạo và có đủ ảnh có nhãn hợp lệ. Ví dụ khởi đầu bằng model nano pretrained của Ultralytics:

```powershell
python -c "from ultralytics import YOLO; model = YOLO('yolo12n.pt'); model.train(data='data/datasets/plate_detection/yolo/data.yaml', epochs=50, imgsz=960, batch=4, device='cpu', workers=0, project='runs/plate', name='yolo12n')"
```

Dùng CPU có thể train chậm; nếu có GPU NVIDIA đã cài đúng runtime, hãy cấu hình thiết bị theo tài liệu Ultralytics. `yolo12n.pt` pretrained trên tập tổng quát chưa được huấn luyện cho biển số; bắt buộc fine-tune bằng bounding box biển số. Với dataset hiện tại rất nhỏ, mục đích chỉ là thử quy trình, không kỳ vọng accuracy cao. Khi huấn luyện hoàn tất, file thường ở `runs/plate/yolo12n/weights/best.pt`. Copy file đó tới `models/vision/yolov12n_plate.pt` hoặc đặt biến `SMARTPARKING_YOLO_PLATE_MODEL` trỏ đến file thật.


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
