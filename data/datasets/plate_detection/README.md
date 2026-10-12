# Dataset phát hiện biển số cho SmartParking

## Kết quả rà soát nhánh `master`

Tại thời điểm kiểm tra, repo có **41 file ảnh dưới thư mục `data/`**, nhưng có ảnh crop và ảnh trùng. Không tìm thấy:
- Nhãn YOLO dạng `.txt` có bounding box.
- File cấu hình dataset `data.yaml`/`data.yml`.
- Weights detector `.pt`, `.pth` hoặc `.onnx` trong `models/vision/`.

`data/processed/plate_scans.csv` chứa kết quả OCR và confidence, không có tọa độ box. README trong `data/external/plates/` mô tả các PNG là ảnh biển số tổng hợp dùng demo OCR. Chúng không thay thế ảnh toàn cảnh xe có bounding box.

## Trạng thái

Dataset **chưa sẵn sàng để train YOLO**. Nhánh thử nghiệm bổ sung công cụ để:
1. Gom ảnh nguồn ứng viên, loại trùng theo SHA-256.
2. Gán nhãn cục bộ qua GUI OpenCV, vẽ box quanh từng biển số.
3. Kiểm tra file nhãn và tạo cấu trúc YOLO train/val.

Công cụ không tự bịa bounding box. Nếu tên file có gợi ý biển số, gợi ý đó chưa được xác minh và chỉ phục vụ đối chiếu.

## Bước 1 — Gom ảnh từ repo

Chạy ở thư mục gốc repo trong môi trường Python đã cài `opencv-python`:

```powershell
python scripts/prepare_plate_detection_dataset.py
```

Ảnh sẽ được chép vào `data/datasets/plate_detection/inbox/images/`; manifest nằm ở `inbox/manifest.csv`.

Mở xem từng ảnh. Ảnh chỉ là crop biển số, ảnh sai, ảnh quá mờ hoặc không có cảnh xe phù hợp thì nhấn `X` trong GUI ở bước kế tiếp để loại khỏi dataset. Do nguồn trong repo hiện chỉ có vài ảnh độc lập, bộ này chủ yếu giúp chuẩn bị quy trình gán nhãn.

## Bước 2 — Gán nhãn box

```powershell
python scripts/annotate_plate_dataset.py
```

Một cửa sổ ảnh sẽ bật lên. Dùng các phím:
- Kéo chuột trái quanh **toàn bộ biển số** để thêm box. Mỗi biển số nhìn thấy rõ là một box.
- `S`: lưu box và chuyển sang ảnh tiếp theo.
- `N`: xác nhận ảnh đã xem nhưng không có biển số nhìn thấy rõ; lưu nhãn rỗng.
- `U`: bỏ box vừa vẽ.
- `R`: xóa tất cả box trên ảnh hiện tại.
- `X`: loại ảnh khỏi dataset; ảnh được chuyển sang `inbox/rejected/`.
- `Q` hoặc `Esc`: thoát; thay đổi chưa lưu của ảnh hiện tại sẽ bị bỏ.

Nhãn được lưu tại `inbox/labels/` theo định dạng YOLO: `class_id x_center y_center width height`; tọa độ chuẩn hóa trong khoảng 0–1. Class `0` là `license_plate`.

Nếu ảnh chỉ là ảnh crop biển số chụp sát, **không dùng để train detector phát hiện từ toàn cảnh** — nhấn `X` để loại nó.

## Bước 3 — Tạo dataset YOLO

Khi mọi ảnh giữ lại đã được rà soát và có file `.txt` tương ứng (file rỗng hợp lệ nếu đã xác nhận ảnh không có biển số), chạy:

```powershell
python scripts/prepare_plate_detection_dataset.py --finalize
```

Kết quả dự kiến:

```text
data/datasets/plate_detection/yolo/
├── data.yaml
├── images/
│   ├── train/
│   └── val/
└── labels/
    ├── train/
    └── val/
```

Nếu muốn tạo lại split đã tồn tại, chạy `python scripts/prepare_plate_detection_dataset.py --finalize --force`. Lệnh `--force` sẽ xóa thư mục dataset được sinh ra trước đó rồi tạo lại; chỉ dùng khi muốn thay thế split cũ.

## Quy mô và chất lượng dữ liệu

- Những ảnh hiện có chỉ là vài ứng viên ban đầu; dataset nhỏ này chưa đủ để kết luận mô hình sẽ đọc biển xa hay chính xác cao.
- Thu thập thêm hàng trăm đến hàng nghìn ảnh cảnh xe đa dạng nếu muốn fine-tune nghiêm túc; quy mô phù hợp phụ thuộc sự đa dạng của ảnh và mục tiêu thực tế.
- Không chia các frame gần như giống nhau từ cùng video vào cả train và val vì có thể khiến kết quả validation lạc quan giả.
- Dành riêng một tập ảnh/video độc lập để đánh giá cuối cùng, không dùng nó trong quá trình train hay tinh chỉnh.
- Ảnh biển số có thể chứa dữ liệu nhạy cảm. Thư mục `inbox/` và `yolo/` được giữ local; đừng commit ảnh mới lên repo công khai nếu chưa kiểm tra quyền sử dụng và quyền riêng tư.
