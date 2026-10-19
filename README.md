# PlateSight — Website nhận diện biển số xe

PlateSight là website đơn giản có hai chế độ nhận diện biển số: camera trực tiếp và tải ảnh lên. Cả hai dùng chung pipeline AI: **YOLOv12 phát hiện vùng biển số** rồi **PaddleOCR đọc chuỗi ký tự**. Kết quả và thời gian nhận diện được lưu vào SQL Server.

Các chức năng quản lý bãi xe, vé vào/ra và tính phí không còn thuộc giao diện chính mới. Mã nguồn cũ vẫn được giữ lại trong repository để tham khảo.

## 1. Bài toán học máy

### YOLOv12 — Object Detection

- Đầu vào: ảnh RGB hoặc khung hình camera.
- Đầu ra: tọa độ bounding box, lớp license_plate và độ tin cậy phát hiện.
- Bài toán: **phát hiện đối tượng**, không phải phân loại loại phương tiện.

YOLOv12 cần checkpoint đã được huấn luyện/tinh chỉnh trên dữ liệu biển số. Checkpoint COCO nguyên bản yolo12n.pt không được huấn luyện để phát hiện biển số xe.

### PaddleOCR — Text Recognition

- Đầu vào: vùng ảnh biển số được cắt theo bounding box YOLO.
- Đầu ra: chuỗi ký tự cùng độ tin cậy OCR.
- Bài toán: **nhận dạng văn bản trong ảnh**.

Nói ngắn gọn khi thuyết trình: YOLOv12 trả lời “biển số nằm ở đâu?”, PaddleOCR trả lời “biển số ghi gì?”.

## 2. Kiến trúc

- **Frontend:** React, TypeScript, Vite, Tailwind CSS.
- **AI service:** Python, Flask, Ultralytics YOLOv12, PaddleOCR, OpenCV.
- **Backend:** ASP.NET Core Web API trên .NET 10, Dapper.
- **Database:** Microsoft SQL Server; sử dụng SSMS để tạo bảng và xem dữ liệu.

Camera và upload đều gọi /recognize của cùng AI service. Frontend hiển thị kết quả nhận diện và gửi biển số sang .NET API để lưu lịch sử. Camera quét khung hình định kỳ và chỉ lưu một lần khi biển số ổn định qua nhiều khung hình, nhằm hạn chế bản ghi trùng lặp.

## 3. Cấu trúc liên quan

- **frontend/** — giao diện hai chế độ camera/upload và lịch sử.
- **ai_service/app.py** — Flask API cho YOLOv12 + PaddleOCR.
- **ai_service/train_yolo12.py** — script tinh chỉnh YOLOv12 trên bộ dữ liệu đã gán nhãn.
- **Backend/src/Smartparking.Api/Controllers/RecognitionsController.cs** — API đọc/ghi lịch sử.
- **database/license_plate_recognition.sql** — tạo bảng lịch sử trong SQL Server.
- **models/vision/** — vị trí đặt checkpoint YOLOv12 cục bộ.

Mã nguồn camera/OCR và nghiệp vụ bãi xe cũ không bị xóa; giao diện mới không còn phụ thuộc vào các chức năng vé xe.

## 4. Chuẩn bị môi trường Windows

Cần cài Python 3.11 x64 (khuyến nghị), Node.js LTS, .NET 10 SDK, SQL Server và SSMS.

Kiểm tra phiên bản:

~~~powershell
python --version
node --version
npm --version
dotnet --list-sdks
~~~

### Cài Python

Tại thư mục gốc repository:

~~~powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
~~~

Cài PaddlePaddle CPU theo hướng dẫn chính thức cho hệ điều hành của máy. Với môi trường CPU tương thích, lệnh cài thường dùng là:

~~~powershell
python -m pip install paddlepaddle==3.2.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
python -m pip install -r requirements.txt
~~~

Nếu máy cần GPU, phải cài đúng bản PaddlePaddle/PyTorch tương thích phần cứng và CUDA; không dùng lệnh CPU ở trên.

### Cấu hình trọng số YOLOv12

Đặt checkpoint **đã được huấn luyện riêng cho lớp license_plate** tại:

**models/vision/yolo12n_plate.pt**

Nếu đặt ở chỗ khác, thiết lập biến môi trường PowerShell:

~~~powershell
$env:LICENSE_PLATE_MODEL_PATH = "D:\models\yolo12n_plate.pt"
~~~

Hướng dẫn cấu trúc dữ liệu và huấn luyện nằm trong models/vision/README.md. Repo không kèm checkpoint đã huấn luyện; vì vậy AI service sẽ báo chưa sẵn sàng cho đến khi có trọng số hợp lệ.

### Cài Frontend

~~~powershell
cd frontend
npm install
npm run build
cd ..
~~~

### Khôi phục và build Backend

~~~powershell
cd Backend
dotnet restore
dotnet build
cd ..
~~~

## 5. Tạo bảng trong SQL Server bằng SSMS

1. Mở SSMS và kết nối đến SQL Server instance đang chạy trên máy.
2. Mở file database/license_plate_recognition.sql.
3. Thực thi toàn bộ script.
4. Kiểm tra bảng SmartParking.dbo.RecognitionHistory.

Script chỉ tạo bảng RecognitionHistory và chỉ mục nếu chưa có; bảng vé Tickets cũ được giữ nguyên. Connection string .NET nằm trong Backend/src/Smartparking.Api/appsettings.json; hãy chỉnh Server=... nếu SQL Server dùng instance khác.

## 6. Chạy ứng dụng

Mở ba terminal độc lập tại thư mục gốc repository.

### Terminal 1 — AI service

~~~powershell
.\.venv\Scripts\Activate.ps1
python ai_service/app.py
~~~

AI service chạy tại http://127.0.0.1:5001. Kiểm tra trạng thái mô hình bằng cách mở http://127.0.0.1:5001/health. Nếu báo thiếu checkpoint, hãy đặt đúng file trọng số trước khi kiểm thử nhận diện.

### Terminal 2 — .NET Backend

~~~powershell
cd Backend
dotnet run --project src/Smartparking.Api/Smartparking.Api.csproj
~~~

API đọc/ghi lịch sử nằm tại http://localhost:5049/api/recognitions nếu profile chạy HTTP ở cổng 5049. Swagger có tại /swagger trong môi trường Development.

### Terminal 3 — Frontend

~~~powershell
cd frontend
npm run dev
~~~

Mở địa chỉ Vite hiển thị trong terminal, thường là http://localhost:5173.

Camera trình duyệt thường hoạt động trên localhost hoặc HTTPS. Nếu được hỏi, cấp quyền truy cập camera.

## 7. API lưu lịch sử

- GET /api/recognitions?take=50 — lấy lịch sử gần nhất.
- POST /api/recognitions — lưu biển số, nguồn, thời gian máy chủ và độ tin cậy.

Ví dụ JSON POST:

~~~json
{
  "plateText": "59B112345",
  "sourceType": "Camera",
  "detectionConfidence": 0.94,
  "ocrConfidence": 0.91
}
~~~

sourceType chỉ nhận Camera hoặc Upload. Thời gian được lưu bằng UTC trong RecognizedAt và hiển thị theo múi giờ trình duyệt.

## 8. Ghi chú về độ tin cậy và thời gian thực

- Camera được gửi lên AI theo khoảng thời gian định kỳ; tốc độ phụ thuộc CPU/GPU, kích thước ảnh và mô hình.
- Độ tin cậy YOLO là độ tin cậy phát hiện vùng biển số; độ tin cậy OCR là độ tin cậy nhận dạng ký tự. Hai giá trị không phải là độ chính xác tổng thể của hệ thống.
- Chỉ số hiệu năng cần được đo bằng bộ kiểm thử phù hợp; không coi mô hình là đủ chính xác chỉ vì đã trả về một chuỗi.
- Với dữ liệu thực tế, cần kiểm thử điều kiện thiếu sáng, mờ, nghiêng, biển hai dòng và ảnh có nhiều xe.

## 9. Lưu ý

Không commit file trọng số .pt, dữ liệu cá nhân hoặc ảnh nhạy cảm vào repository công khai. Hãy dùng dữ liệu được phép sử dụng và gán nhãn rõ ràng để huấn luyện, đánh giá mô hình.
