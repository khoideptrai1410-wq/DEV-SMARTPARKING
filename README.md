# Smart Parking — Hướng dẫn dự án

## 1. Giới thiệu dự án

Smart Parking là hệ thống quản lý bãi đỗ xe thông minh, kết hợp giao diện web, API backend, xử lý camera/OCR và cơ sở dữ liệu SQL Server. Hệ thống hướng đến quy trình ghi nhận xe vào, nhận diện biển số, tạo vé và cập nhật vé khi xe ra.

Các thành phần chính:
- **React**: giao diện đăng nhập, dashboard, danh sách vé và màn hình camera.
- **.NET Web API**: xử lý API nghiệp vụ và truy cập dữ liệu.
- **Python Flask/OCR**: nhận ảnh camera và nhận diện biển số.
- **SQL Server**: lưu thông tin vé xe.
- **Machine Learning**: có notebook và mã nguồn thử nghiệm trong repo.

Hướng dẫn này dành cho Windows, PowerShell và VS Code. Các lệnh giả sử đã mở terminal tại thư mục gốc repository, nơi có `README.md`, `app/`, `Backend/`, `frontend/` và `requirements.txt`.

## 2. Các công nghệ có trong dự án

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS | Giao diện web |
| Backend | .NET 10, ASP.NET Core Web API | Cung cấp API nghiệp vụ |
| Truy cập dữ liệu | Dapper, Microsoft.Data.SqlClient | Truy vấn SQL Server |
| Xác thực API | JWT Bearer Authentication | Xác thực người dùng và API |
| Tài liệu API | Swagger / OpenAPI | Xem và thử API |
| Camera/OCR | Python, Flask, OpenCV, RapidOCR, ONNX Runtime, pytesseract/Tesseract | Nhận ảnh và nhận diện biển số |
| Dữ liệu/ML | NumPy, Pandas, scikit-learn, Matplotlib, Seaborn, Joblib, XGBoost, Pillow | Xử lý dữ liệu và thử nghiệm mô hình |
| Database | Microsoft SQL Server | Lưu thông tin vé |
| Công cụ phát triển | Git, VS Code, SSMS | Quản lý mã nguồn, viết code và quản lý database |

Package Python được khai báo trong `requirements.txt`; package frontend nằm trong `frontend/package.json`; package .NET nằm trong các file `.csproj` của `Backend/`.

## 3. Các công nghệ cần tải trước khi chạy dự án

Cài các thành phần sau trên máy Windows:

1. **Git**: https://git-scm.com/downloads
2. **Python 3.x**: https://www.python.org/downloads/  
   Khi cài, chọn thêm Python vào PATH nếu trình cài đặt có tùy chọn này.
3. **Node.js LTS**: https://nodejs.org/ (đi kèm npm).
4. **.NET 10 SDK**: https://dotnet.microsoft.com/download/dotnet/10.0
5. **Microsoft SQL Server**: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
6. **SQL Server Management Studio (SSMS)**: https://learn.microsoft.com/en-us/ssms/install/install
7. **Chrome hoặc Edge**: dùng để mở giao diện web và cấp quyền webcam.

**Khuyến nghị:** cài thêm VS Code để mở mã nguồn và sử dụng các terminal: https://code.visualstudio.com/

**Tùy chọn:** nếu muốn chạy notebook ML thì dùng Jupyter Notebook hoặc tính năng notebook của VS Code. Nếu nhánh OCR dự phòng sử dụng `pytesseract`, cần cài chương trình Tesseract OCR riêng; cài package Python `pytesseract` không tự cài `tesseract.exe`.

Sau khi cài, mở PowerShell mới và kiểm tra:

```powershell
git --version
python --version
python -m pip --version
node --version
npm --version
dotnet --list-sdks
```

Trong danh sách SDK cần có phiên bản .NET 10.x.

## 4. Cách chạy dự án chi tiết — từng terminal và địa chỉ hoạt động

### Bước 1. Chuẩn bị mã nguồn và package

Nếu chưa tải repo:

```powershell
git clone https://github.com/khoideptrai1410-wq/DEV-SMARTPARKING.git
cd DEV-SMARTPARKING
```

Nếu đã có repo trên máy, mở terminal tại thư mục gốc dự án.

**Cài Python package** tại thư mục gốc:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

**Cài package frontend:**

```powershell
cd frontend
npm install
cd ..
```

**Khôi phục và build Backend:**

```powershell
cd Backend
dotnet restore
dotnet build
cd ..
```

### Bước 2. Chuẩn bị SQL Server

Đảm bảo dịch vụ SQL Server đã khởi động. Mở SSMS và kết nối đến đúng SQL Server instance trên máy.

Backend đọc connection string tại:

`Backend/src/Smartparking.Api/appsettings.json`

Giá trị mẫu:

```json
"DefaultConnection": "Server=localhost;Database=SmartParking;Trusted_Connection=True;TrustServerCertificate=True;"
```

Nếu SQL Server trên máy dùng instance khác, điều chỉnh phần `Server=...` cho khớp cấu hình máy.

Trong SSMS, mở và thực thi lần lượt:
1. `database/schema.sql` để tạo database/bảng theo script.
2. `database/seed.sql` để thêm vé demo.

Có thể kiểm tra dữ liệu bằng:

```sql
USE SmartParking;
GO
SELECT TOP 20 *
FROM dbo.Tickets
ORDER BY TicketId DESC;
```

SQL Server chạy như một dịch vụ nền nên không cần giữ một terminal riêng cho SQL Server. SSMS dùng để cấu hình, chạy script và kiểm tra dữ liệu.

### Terminal 1 — Chạy Backend .NET API

Mở terminal mới tại thư mục gốc repository:

```powershell
cd Backend
dotnet run --launch-profile http --project src\Smartparking.Api\Smartparking.Api.csproj
```

Giữ terminal này mở.

- API: **http://localhost:5049**
- Swagger UI: **http://localhost:5049/swagger**

### Terminal 2 — Chạy Python Flask/OCR

Mở terminal mới tại thư mục gốc repository:

```powershell
.\.venv\Scripts\Activate.ps1
python app/app.py
```

Giữ terminal này mở.

- Python Flask API: **http://127.0.0.1:5000**

### Terminal 3 — Chạy giao diện React

Mở terminal mới tại thư mục gốc repository:

```powershell
cd frontend
npm run dev
```

Mở URL Vite hiển thị trong terminal, thường là:

- Frontend React: **http://localhost:5173**

Vite proxy các request qua `/backend-api` đến .NET và `/python-api` đến Flask theo cấu hình trong `frontend/vite.config.ts`.

### Bước 3. Đăng nhập và kiểm tra luồng hoạt động

Tài khoản demo hiện được ghi trong mã nguồn:
- Username: `admin`
- Password: `123456`

Thực hiện theo thứ tự:
1. Mở **http://localhost:5173**.
2. Đăng nhập và xem dashboard/danh sách vé.
3. Mở màn hình cổng vào hoặc cổng ra và cấp quyền sử dụng webcam.
4. Thử nhận diện biển số và kiểm tra vé trong SQL Server.
5. Thử luồng xe ra, sau đó kiểm tra trạng thái vé và thời gian ra trong `dbo.Tickets`.

Luồng dự kiến: **Camera → Python OCR → .NET API → SQL Server → React cập nhật giao diện**. Tích hợp phần mềm không đồng nghĩa với việc đã điều khiển barrier vật lý.

## 5. Các phần còn thiếu cần hoàn thiện để đáp ứng yêu cầu “3 Project” của thầy

Chưa có rubric/đề bài chính thức của thầy trong repository, nên danh sách này là các việc kỹ thuật cần đối chiếu với yêu cầu môn học, không khẳng định tất cả đều là tiêu chí bắt buộc.

- [ ] **Kiểm thử toàn bộ luồng:** chạy thử camera/OCR → Flask → .NET API → SQL Server → React; xác minh tạo vé xe vào, cập nhật vé xe ra và các trường hợp không nhận diện được biển số.
- [ ] **Đối chiếu database với code:** xác nhận `database/schema.sql`, cấu trúc `dbo.Tickets` và các câu truy vấn Dapper hoàn toàn khớp nhau.
- [ ] **Kiểm tra các API:** xác minh các endpoint đăng nhập, lấy danh sách vé, tạo vé và kết thúc vé hoạt động với dữ liệu trong SQL Server.
- [ ] **Kiểm tra camera/OCR thực tế:** thử trong các điều kiện ánh sáng và góc nhìn khác nhau, ghi nhận độ chính xác và giới hạn nhận diện.
- [ ] **Hoàn thiện tài liệu theo đề bài:** bổ sung sơ đồ kiến trúc, sơ đồ cơ sở dữ liệu, mô tả API hoặc kịch bản demo nếu yêu cầu chính thức của thầy có các hạng mục này.
- [ ] **Xác định rõ phạm vi phần cứng:** nếu đề bài yêu cầu barrier tự động thật, cần có phần cứng điều khiển và kiểm thử thực tế; chỉ có nhận diện camera chưa chứng minh được phần này đã hoàn thành.

Để chốt chính xác mục 5, cần đối chiếu danh sách trên với đề bài hoặc rubric “3 Project” mà thầy đã giao.
