# Smart Parking

Hệ thống bãi đỗ xe thông minh kết hợp Camera, OCR nhận diện biển số, Backend .NET, React Frontend và SQL Server.

## 1. Kiến trúc

```
                    React Frontend
              React + TypeScript + Vite
                       │
                       │ HTTP / JSON
                       ▼
                 SmartParking API
                    .NET 10
                       │
                    Dapper
                       │
                       ▼
                  SQL Server
                Database: SmartParking


 Camera/Webcam
       │
       ▼
 Python Flask
       │
       ├── OpenCV
       ├── RapidOCR
       ├── Tesseract fallback
       └── xử lý sự kiện cổng vào/ra
               │
               └──────────► .NET API
```

React là giao diện mới. Python phụ trách camera, xử lý ảnh và OCR. .NET là Backend/API và là lớp truy cập SQL Server thông qua Dapper.

## 2. Công nghệ cần cài đặt

### Bắt buộc

- Git
- Python 3.x
- Node.js + npm
- .NET 10 SDK
- SQL Server Management Studio (SSMS)
- Lưu Ý: Thiết bị cần phải có camera để quét nhận diện biển số xe

### Công nghệ trong project

### Python
- Flask
- OpenCV
- NumPy
- Pandas
- scikit-learn
- Matplotlib
- Seaborn
- Joblib
- XGBoost
- Pillow
- RapidOCR
- ONNX Runtime
- Tesseract OCR qua `pytesseract`
=> Danh sách package Python nằm trong `requirements.txt`.

### Backend

- .NET 10
- ASP.NET Core Web API
- Dapper
- Microsoft.Data.SqlClient
- JWT Bearer Authentication
- Swagger / OpenAPI

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Oxlint

## 3. Cấu trúc project
```
DEV-SMARTPARKING/
│
├── Backend/
│   ├── SmartParking.slnx
│   └── src/
│       ├── SmartParking.Application/
│       ├── SmartParking.Domain/
│       ├── SmartParking.Infrastructure/
│       └── Smartparking.Api/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│
├── app/
│   └── app.py  # Flask API/OCR, không còn giao diện HTML
│
├── src/
│   ├── data/
│   ├── features/
│   ├── models/
│   ├── parking/
│   └── vision/
│
├── data/
├── database/
├── models/
├── notebooks/
├── outputs/
├── tests/
├── docs/
└── requirements.txt
```

## 4. Cài đặt lần đầu

Hướng dẫn dưới đây dùng Windows PowerShell.

### Bước 1: Cài Python package
Kiểm tra Python:

```powershell
python --version
```

Cài toàn bộ package:
```powershell
python -m pip install -r requirements.txt
```

### Bước 2: Cài Frontend package
```powershell
cd frontend
npm install
cd ..
```

### Bước 3: Kiểm tra .NET

```powershell
dotnet --version
```

Project Backend dùng .NET 10.

## 5. Database SQL Server

Backend hiện kết nối tới:

```text
Server=localhost
Database=SmartParking
Trusted_Connection=True
TrustServerCertificate=True
```

Trong SSMS tạo hoặc chọn database:

```sql
CREATE DATABASE SmartParking;
GO
```

Sau đó tạo bảng `dbo.Tickets`:

```sql
USE SmartParking;
GO

CREATE TABLE dbo.Tickets
(
    TicketId BIGINT IDENTITY(1,1) PRIMARY KEY,
    TicketCode NVARCHAR(50) NOT NULL UNIQUE,
    Plate NVARCHAR(30) NOT NULL,
    VehicleType NVARCHAR(30) NOT NULL DEFAULT 'Motorbike',
    EntryTime DATETIME2 NOT NULL,
    EntryImagePath NVARCHAR(500) NULL,
    PlateImagePath NVARCHAR(500) NULL,
    ExitTime DATETIME2 NULL,
    ExitImagePath NVARCHAR(500) NULL,
    Status INT NOT NULL DEFAULT 1,
    PenaltyAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO
```

Kiểm tra:

```sql
USE SmartParking;
GO

SELECT *
FROM dbo.Tickets
ORDER BY TicketId DESC;
```

> Lưu ý: thư mục `database/` vẫn có các file SQLite cũ của giai đoạn trước. Backend .NET hiện sử dụng SQL Server `SmartParking`.

## 6. Chạy chương trình

Mở các cửa sổ PowerShell riêng. Muốn dùng đầy đủ dashboard, camera/OCR và lưu vé, cần chạy SQL Server, .NET API, Python và React.

### PowerShell 1 - SQL Server

Mở SQL Server/SSMS và bảo đảm database `SmartParking` cùng bảng `dbo.Tickets` đã được tạo.

### PowerShell 2 - Backend .NET

Từ thư mục gốc dự án:

```powershell
cd Backend
dotnet restore
dotnet build
dotnet run --launch-profile http --project src\Smartparking.Api\Smartparking.Api.csproj
```

Backend dùng địa chỉ `http://localhost:5049`. Swagger ở `http://localhost:5049/swagger`.

### PowerShell 3 - Python OCR/API

Từ thư mục gốc dự án:

```powershell
python app/app.py
```

Python chạy tại `http://127.0.0.1:5000`. Flask không còn phục vụ trang HTML; các endpoint OCR/API được giữ nguyên. Truy cập các đường dẫn trang cũ sẽ chuyển về React.

### PowerShell 4 - React Frontend

```powershell
cd frontend
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong Terminal, thường là `http://localhost:5173`.

Ở màn hình đăng nhập, tài khoản demo hiện được cấu hình trong `AuthController.cs`:
- Username: `admin`
- Password: `123456`

React dùng proxy Vite để gọi .NET và Python trong môi trường phát triển. Nếu chỉ thử đăng nhập và xem danh sách vé, cần SQL Server, backend .NET và React; nếu muốn dùng camera/OCR thì chạy thêm Python.

## 7. Luồng hệ thống

### Xe vào

```
Camera
  ↓
Python Flask
  ↓
Tìm vùng biển số
  ↓
OCR
  ↓
Chuẩn hóa biển số
  ↓
Kiểm tra nhận diện ổn định
  ↓
.NET API
  ↓
Tạo vé
  ↓
SQL Server
  ↓
Trạng thái = 1 (Đang gửi)
```

Hệ thống lưu mã vé, biển số, thời gian vào, ảnh frame và ảnh crop biển số.

### Xe ra

```
Camera
  ↓
Python Flask
  ↓
OCR
  ↓
Tìm vé đang gửi theo biển số
  ↓
.NET API
  ↓
Cập nhật thời gian ra / ảnh ra
  ↓
SQL Server
  ↓
Trạng thái = 2 (Đã trả xe)
```

Nếu không tìm thấy vé đang gửi phù hợp, hệ thống có thể xử lý theo trạng thái cảnh báo.

## 8. API Backend chính

Tất cả API ticket yêu cầu JWT.

### Đăng nhập

```http
POST /api/Auth/login
```

Tài khoản test local:

```text
Username: admin
Password: 123456
```

### Ticket

```http
GET  /api/Tickets
GET  /api/Tickets/{id}
GET  /api/Tickets/open/{plate}
POST /api/Tickets/entry
POST /api/Tickets/{id}/exit
```

### Python Camera/OCR

Các endpoint chính hiện có:

```text
/api/preview-plate
/api/gate-event
/api/scans
/api/tickets
/ticket-image/<filename>
```

## 9. Camera và OCR

Trang Cổng vào / ra trong React sử dụng `getUserMedia()` để mở webcam. Sau khi bấm **Mở camera & bắt đầu tự quét**, ứng dụng tự lấy frame từ video và gọi Python OCR liên tục.

Luồng xử lý tự động:

- React gửi từng frame đến Python `/api/preview-plate` để đọc biển số.
- Chỉ khi nhận được **cùng một biển số hợp lệ trong 3 frame liên tiếp**, React mới tự gửi frame đó đến `/api/gate-event`.
- Người vận hành chọn chế độ cổng trước khi quét: **Ghi nhận xe vào** hoặc **Xử lý xe ra**. Không cần bấm nút xác nhận sau khi nhận diện.
- Với xe vào, Python kiểm tra vé đang mở để tránh tạo vé trùng, lưu ảnh rồi gọi .NET API tạo vé.
- Với xe ra, Python tìm vé đang mở, tính phí/phạt và gọi .NET API cập nhật thời gian ra, ảnh ra và trạng thái.
- React tự tải lại danh sách vé và hiển thị thẻ vé điện tử sau khi backend trả kết quả. Khi biển số vẫn nằm trong khung hình, ứng dụng khóa xử lý biển số đó để tránh gửi cùng sự kiện lặp lại; camera tiếp tục quét các xe tiếp theo.

Nếu camera không mở:
1. Cho phép Camera trong Chrome/Edge.
2. Mở giao diện React tại địa chỉ Vite, thường là `http://localhost:5173`.
3. Đóng Camera, Zoom, Teams hoặc ứng dụng khác đang chiếm webcam.
4. Tải lại trang rồi bấm **Mở camera & bắt đầu tự quét**.

Lưu ý: đây là tự động nhận diện và ghi nhận vé bằng camera trình duyệt sau khi người vận hành bật camera và chọn chiều cổng; nó chưa tự điều khiển barrier vật lý.

## 10. Frontend hiện tại

Giao diện chính nằm trong `frontend/`; giao diện HTML Flask cũ trong `app/templates/` cùng CSS/JavaScript cũ trong `app/static/` đã được gỡ khỏi nhánh hiện tại. Lịch sử Git vẫn giữ các commit trước đó để có thể khôi phục khi cần.

Các phần đã được nối trong mã nguồn:
- Đăng nhập qua `POST /api/Auth/login`, nhận JWT và giữ token trong `sessionStorage`.
- Đọc danh sách vé qua `GET /api/Tickets`; các số liệu dashboard tính từ dữ liệu backend trả về.
- Tìm kiếm biển số hoặc mã vé trong danh sách xe đang gửi và lịch sử.
- Camera React gửi ảnh qua Python OCR; Python tiếp tục gọi .NET API để tạo vé hoặc cập nhật vé ra.
- Vite proxy các đường dẫn `/backend-api` đến .NET và `/python-api` đến Flask để tránh phải cấu hình CORS cho local.

Build frontend:

```powershell
cd frontend
npm run build
```

Chưa nên xem là kiểm thử end-to-end hoàn tất cho đến khi chạy thực tế với SQL Server, .NET, Python và webcam trên máy của bạn.

## 11. Kiểm tra nhanh sau khi cài

### Python

```powershell
python -m pip install -r requirements.txt
python app/app.py
```

### Backend

```powershell
cd Backend
dotnet build
dotnet run --project src\Smartparking.Api\Smartparking.Api.csproj
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Database

```sql
USE SmartParking;
SELECT * FROM dbo.Tickets ORDER BY TicketId DESC;
```

## 12. Trạng thái project

### Đã có trong mã nguồn
- Python OCR và API xử lý sự kiện cổng vào/ra.
- .NET 10 Web API, JWT, Dapper và SQL Server.
- React đăng nhập bằng JWT.
- Dashboard, danh sách vé đang gửi và lịch sử lấy từ API.
- Tìm kiếm biển số/mã vé trên dữ liệu đã tải.
- Trang React mở webcam, tự đọc frame liên tục; khi cùng biển số hợp lệ khớp 3 frame liên tiếp, tự gửi sự kiện đến Python/.NET.
- Vé điện tử được hiển thị từ kết quả backend và lưu trong SQL Server.
- Các template HTML Flask cũ và tài nguyên CSS/JavaScript đi kèm đã được gỡ khỏi nhánh hiện tại.

### Cần kiểm tra tiếp trên máy local
- Chạy `npm run build` để kiểm tra TypeScript và build.
- Đăng nhập React khi .NET API và SQL Server đang chạy.
- Thử lấy danh sách vé hiện có trong SQL Server.
- Thử camera/OCR với ảnh biển số rõ; xác nhận xe vào và xác nhận xe ra.
- Kiểm tra trường hợp backend hoặc SQL Server tắt để bảo đảm giao diện hiển thị lỗi dễ hiểu.
- Hoàn thiện xác thực tài khoản thực tế; thông tin đăng nhập hiện tại là tài khoản demo cố định trong mã nguồn.

## 13. Lưu ý bảo mật

File `Backend/src/Smartparking.Api/appsettings.json` hiện chứa cấu hình JWT và chuỗi kết nối dùng cho môi trường local/demo.

Không dùng nguyên cấu hình này cho môi trường production. Hãy thay JWT secret và chuyển các thông tin nhạy cảm sang biến môi trường hoặc secret manager khi triển khai thực tế.
