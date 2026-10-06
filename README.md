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
│   ├── app.py
│   ├── templates/
│   └── static/
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

### Bước 1: Clone project

```powershell
git clone https://github.com/khoideptrai1410-wq/DEV-SMARTPARKING.git
cd DEV-SMARTPARKING
```

### Bước 2: Cài Python package
Kiểm tra Python:

```powershell
python --version
```

Cài toàn bộ package:
```powershell
python -m pip install -r requirements.txt
```

### Bước 3: Cài Frontend package
```powershell
cd frontend
npm install
cd ..
```

### Bước 4: Kiểm tra .NET

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

Nên mở 4 cửa sổ PowerShell.

### PowerShell 1 - SQL Server

Mở SQL Server/SSMS và bảo đảm database `SmartParking` đang hoạt động.

### PowerShell 2 - Backend .NET

```powershell
cd Backend
dotnet restore
dotnet build
dotnet run --project src\Smartparking.Api\Smartparking.Api.csproj
```

Backend mặc định chạy tại:

```text
http://localhost:5049
```

Swagger:

```text
http://localhost:5049/swagger
```

### PowerShell 3 - Python Camera/OCR

Mở từ thư mục gốc project:

```powershell
python app/app.py
```

Flask:

```text
http://127.0.0.1:5000
```

Chrome/Edge cần được cấp quyền Camera.

### PowerShell 4 - React Frontend

```powershell
cd frontend
npm run dev
```

Vite sẽ hiển thị địa chỉ local, thông thường:

```text
http://localhost:5173
```

Mở địa chỉ đó để xem giao diện React.

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

Camera web dùng `getUserMedia()` của trình duyệt.

Hệ thống:

- tự lấy frame định kỳ
- tìm vùng nghi là biển số
- crop biển số
- OCR bằng RapidOCR
- có Tesseract làm fallback
- chuẩn hóa một số lỗi nhận dạng ký tự
- yêu cầu biển số ổn định qua nhiều frame trước khi chốt sự kiện
- chống tạo vé trùng khi xe đã có vé đang gửi

Nếu camera không mở:

1. Cho phép Camera trong Chrome/Edge.
2. Dùng `http://localhost:5000` hoặc `http://127.0.0.1:5000`.
3. Đóng Camera, Zoom, Teams hoặc ứng dụng khác đang chiếm webcam.
4. Tải lại trang.

## 10. Frontend hiện tại

Frontend nằm trong:

```text
frontend/
```

Chạy:

```powershell
cd frontend
npm run dev
```

Build production:

```powershell
npm run build
```

Kiểm tra lint:

```powershell
npm run lint
```

Frontend React hiện là giao diện mới của hệ thống. Việc kết nối đầy đủ React với camera/OCR và toàn bộ API Backend là phần tích hợp tiếp theo của project.

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
### Đã có

- Nhận diện biển số
- OCR
- Tạo vé điện tử
- Đóng vé khi xe ra
- Lưu dữ liệu ticket
- Lưu ảnh vào/ra
- Backend .NET 10
- JWT authentication
- Dapper
- SQL Server
- Swagger
- React + TypeScript + Tailwind
- Dashboard React

### Đang tiếp tục hoàn thiện

- Kết nối React với API Backend
- Kết nối giao diện React với camera/OCR Python
- Hoàn thiện các màn hình quản lý trên React
- Đồng bộ dữ liệu thật giữa Dashboard React và SQL Server

## 13. Lưu ý bảo mật

File `Backend/src/Smartparking.Api/appsettings.json` hiện chứa cấu hình JWT và chuỗi kết nối dùng cho môi trường local/demo.

Không dùng nguyên cấu hình này cho môi trường production. Hãy thay JWT secret và chuyển các thông tin nhạy cảm sang biến môi trường hoặc secret manager khi triển khai thực tế.
