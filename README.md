# Smart Parking — Hướng dẫn cài đặt và chạy

Hệ thống quản lý bãi đỗ xe gồm giao diện React, Backend .NET, dịch vụ Python cho camera/OCR và cơ sở dữ liệu SQL Server. Repo cũng có các notebook và mã nguồn thử nghiệm Machine Learning.

> Hướng dẫn dùng **Windows + PowerShell + VS Code**. Các lệnh bên dưới giả sử bạn đang ở thư mục gốc repo, nơi có `README.md`, `requirements.txt`, `Backend/` và `frontend/`.

## 1. Công nghệ sử dụng trong dự án

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS | Giao diện đăng nhập, dashboard, danh sách vé và camera |
| Backend | .NET 10, ASP.NET Core Web API | Cung cấp API cho đăng nhập và vé xe |
| Truy cập dữ liệu | Dapper, Microsoft.Data.SqlClient | Backend truy vấn SQL Server |
| Xác thực | JWT Bearer Authentication | Xác thực API |
| Tài liệu API | Swagger / OpenAPI | Xem và thử API |
| Camera/OCR | Python, Flask, OpenCV, RapidOCR, ONNX Runtime, pytesseract/Tesseract | Nhận ảnh, đọc biển số và xử lý sự kiện cổng |
| Xử lý dữ liệu/ML | NumPy, Pandas, scikit-learn, Matplotlib, Seaborn, Joblib, XGBoost, Pillow | Xử lý dữ liệu, thử nghiệm và đánh giá mô hình |
| Cơ sở dữ liệu | Microsoft SQL Server | Lưu thông tin vé xe |
| Công cụ mã nguồn | Git, VS Code (khuyến nghị) | Lấy mã nguồn và phát triển |

Danh sách package Python cụ thể nằm trong `requirements.txt`; package JavaScript nằm trong `frontend/package.json`; package .NET được khai báo trong các file project của `Backend/`.

## 2. Những công nghệ cần tải

### Bắt buộc để chạy toàn hệ thống

1. **Git** — tải mã nguồn và đồng bộ thay đổi: https://git-scm.com/downloads
2. **Python 3.x** — chạy Flask/OCR và notebook: https://www.python.org/downloads/  
   Khi cài trên Windows, chọn **Add Python to PATH** nếu trình cài đặt có tùy chọn này.
3. **Node.js LTS** — cung cấp cả Node.js và npm để chạy React/Vite: https://nodejs.org/
4. **.NET 10 SDK** — build và chạy Backend: https://dotnet.microsoft.com/download/dotnet/10.0
5. **SQL Server** — máy chủ database: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
6. **SQL Server Management Studio (SSMS)** — giao diện quản lý SQL Server, không thay thế SQL Server: https://learn.microsoft.com/en-us/ssms/install/install
7. **Trình duyệt Chrome hoặc Edge** — nên dùng để cấp quyền webcam cho giao diện React.

**Khuyến nghị:** Visual Studio Code để mở project và chạy các terminal: https://code.visualstudio.com/

### Tùy chọn

- **Tesseract OCR**: nếu muốn dùng nhánh OCR dự phòng qua `pytesseract`, cần cài ứng dụng Tesseract OCR riêng và bảo đảm chương trình truy cập được `tesseract.exe`. Python package `pytesseract` không tự cài Tesseract.
- **Jupyter Notebook**: chỉ cần nếu muốn mở/chạy các notebook ML. Có thể cài bằng `python -m pip install notebook` hoặc dùng hỗ trợ notebook trong VS Code.
- **Camera/webcam**: cần có thiết bị camera và cho phép trình duyệt truy cập camera để thử chức năng quét.

### Kiểm tra đã cài

Mở PowerShell mới và chạy:

```powershell
git --version
python --version
python -m pip --version
node --version
npm --version
dotnet --list-sdks
```

Cần thấy .NET SDK 10.x trong danh sách. Nếu lệnh nào báo không nhận diện, hãy cài công nghệ tương ứng rồi mở lại terminal.

## 3. Lấy mã nguồn

Nếu chưa có project trên máy:

```powershell
git clone https://github.com/khoideptrai1410-wq/DEV-SMARTPARKING.git
cd DEV-SMARTPARKING
```

Nếu đã có repo trên máy, mở terminal tại thư mục gốc và kiểm tra thay đổi trước khi cập nhật:

```powershell
git status
git pull --ff-only
```

Nếu `git status` có các file đã sửa hoặc file chưa được theo dõi, hãy sao lưu/commit những thay đổi cần giữ trước khi pull. Không dùng `git reset --hard` hoặc `git clean -fd` nếu chưa chắc chắn vì có thể làm mất công việc local.

## 4. Cài package cho từng thành phần

Thực hiện tại thư mục gốc repo.

### 4.1. Python

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Nếu PowerShell chặn kích hoạt môi trường ảo, không cần đổi chính sách hệ thống ngay; gửi thông báo lỗi để xử lý phù hợp. Mỗi lần mở terminal mới, kích hoạt lại bằng `.\.venv\Scripts\Activate.ps1`.

### 4.2. React

```powershell
cd frontend
npm install
cd ..
```

### 4.3. .NET

```powershell
cd Backend
dotnet --list-sdks
dotnet restore
dotnet build
cd ..
```

Nếu build báo lỗi, đọc lỗi đầu tiên trong terminal và xử lý trước khi chạy tiếp.

## 5. Cấu hình SQL Server và khởi tạo database

Backend dùng SQL Server với database tên `SmartParking`. Trước khi chạy, hãy bảo đảm dịch vụ SQL Server đang hoạt động và connection string trỏ đúng instance trên máy của bạn.

Cấu hình nằm tại:

`Backend/src/Smartparking.Api/appsettings.json`

Kiểm tra `ConnectionStrings:DefaultConnection`. Giá trị mẫu trong repo dùng Windows Authentication và server `localhost`:

```json
"DefaultConnection": "Server=localhost;Database=SmartParking;Trusted_Connection=True;TrustServerCertificate=True;"
```

Nếu SQL Server của bạn dùng instance khác, hãy đổi `Server=...` cho phù hợp. Không commit mật khẩu hoặc secret thật lên GitHub.

### Tạo database bằng script trong thư mục database

1. Mở SSMS và kết nối đúng SQL Server instance.
2. Mở `database/schema.sql`, bấm **Execute** để tạo database/bảng và các ràng buộc còn thiếu theo script.
3. Mở `database/seed.sql`, bấm **Execute** để thêm dữ liệu demo ban đầu.
4. Kiểm tra kết quả:

```sql
USE SmartParking;
GO
SELECT TOP 20 *
FROM dbo.Tickets
ORDER BY TicketId DESC;
```

`seed.sql` chỉ thêm dữ liệu mẫu; nó không nhập các vé thực tế từ máy khác. Nếu database/bảng đã tồn tại từ phiên bản trước, hãy sao lưu trước khi thay đổi cấu trúc. Script khởi tạo không thay thế việc migration và kiểm tra tương thích với database đang sử dụng.

> File SQLite cũ trong repo không phải database SQL Server mà Backend .NET hiện kết nối. Chạy script trên máy riêng sẽ tạo database riêng; muốn nhiều máy xem chung vé thực tế, cần triển khai một SQL Server/database dùng chung và cấu hình Backend của các máy kết nối đến đó.

## 6. Chạy hệ thống — mỗi thành phần một terminal

Đảm bảo SQL Server đang chạy và database/bảng đã sẵn sàng. Mở **4 terminal riêng** tại thư mục gốc repo.

### Terminal 1 — SQL Server

Khởi động dịch vụ SQL Server bằng Services/SQL Server Configuration Manager nếu dịch vụ chưa chạy. SSMS là công cụ để kết nối và kiểm tra database.

### Terminal 2 — Backend .NET API

```powershell
cd Backend
dotnet run --launch-profile http --project src\Smartparking.Api\Smartparking.Api.csproj
```

Theo cấu hình phát triển hiện tại, API dự kiến ở `http://localhost:5049`; Swagger ở `http://localhost:5049/swagger`.

### Terminal 3 — Python Flask/OCR API

Tại thư mục gốc repo:

```powershell
.\.venv\Scripts\Activate.ps1
python app/app.py
```

Dịch vụ Python dự kiến ở `http://127.0.0.1:5000`. Giữ terminal mở để dịch vụ tiếp tục chạy.

### Terminal 4 — React/Vite

```powershell
cd frontend
npm run dev
```

Mở URL Vite hiển thị trong terminal; thường là `http://localhost:5173`.

Trong môi trường phát triển, Vite proxy các đường dẫn `/backend-api` tới .NET và `/python-api` tới Flask. Không đóng các terminal của dịch vụ đang sử dụng.

## 7. Đăng nhập và thử chức năng

Tài khoản demo được cấu hình trong mã nguồn hiện tại:

- Username: `admin`
- Password: `123456`

Đây là tài khoản demo/local, không dùng cho triển khai thực tế.

Kiểm tra theo thứ tự:

1. Mở React tại URL Vite.
2. Đăng nhập.
3. Kiểm tra dashboard và danh sách vé có tải dữ liệu từ .NET API/SQL Server hay không.
4. Mở trang cổng vào/ra và cấp quyền camera cho trình duyệt.
5. Thử nhận diện biển số trong điều kiện đủ sáng, sau đó kiểm tra sự kiện và vé được ghi nhận trong database.
6. Thử chức năng xe ra và kiểm tra `ExitTime`, `Status` cùng dữ liệu liên quan trong bảng `dbo.Tickets`.

Nếu chỉ kiểm tra giao diện đăng nhập/danh sách vé, cần SQL Server, .NET API và React. Nếu kiểm tra camera/OCR, phải chạy thêm Python.

## 8. Luồng hoạt động tổng quát

### Xe vào

Camera/webcam → React → Python Flask/OCR → .NET API → SQL Server → giao diện cập nhật danh sách vé.

### Xe ra

Camera/webcam → Python OCR nhận diện biển số → .NET API cập nhật vé → SQL Server → giao diện cập nhật trạng thái.

Giao diện React hiện nằm trong `frontend/`; Flask cung cấp API/OCR, không còn dùng các trang HTML cũ làm giao diện chính. Chức năng camera phụ thuộc vào quyền webcam, chất lượng ảnh, mô hình OCR và cấu hình các dịch vụ. Hệ thống phần mềm không đồng nghĩa với việc đã tích hợp điều khiển barrier vật lý.

## 9. API tham khảo

### .NET API

```http
POST /api/Auth/login
GET  /api/Tickets
GET  /api/Tickets/{id}
GET  /api/Tickets/open/{plate}
POST /api/Tickets/entry
POST /api/Tickets/{id}/exit
```

Các API ticket cần JWT theo cấu hình hiện tại.

### Python API

```text
/api/preview-plate
/api/gate-event
/api/scans
/api/tickets
/ticket-image/<filename>
```

Địa chỉ đầy đủ phụ thuộc host/port của dịch vụ Python, thường là `http://127.0.0.1:5000`.

## 10. Chạy notebook Machine Learning (tùy chọn)

Các notebook nằm trong `notebooks/`. Nếu muốn chạy thử nghiệm ML, hãy kích hoạt môi trường Python và mở notebook bằng VS Code/Jupyter. Nên chạy theo thứ tự số trong tên file vì notebook sau có thể dùng dữ liệu hoặc mô hình được tạo từ notebook trước.

Các notebook có thể tạo hoặc cập nhật file CSV, mô hình và kết quả trong `data/`, `models/` hoặc `outputs/`. Trước khi commit, kiểm tra `git status` để tránh vô tình đưa dữ liệu sinh ra hoặc file mô hình lớn lên GitHub. Kết quả notebook chưa tự động chứng minh mô hình hoạt động tốt trên dữ liệu bãi xe thực tế.

## 11. Lệnh kiểm tra/build

Frontend:

```powershell
cd frontend
npm run build
```

Backend, chạy từ thư mục gốc:

```powershell
cd Backend
dotnet build
```

Python, chạy từ thư mục gốc trong môi trường ảo:

```powershell
python -m pip install -r requirements.txt
python app/app.py
```

Các lệnh build chỉ xác minh từng phần ở mức tương ứng; cần chạy cùng SQL Server, .NET, Python, React và camera để kiểm thử end-to-end.

## 12. Lỗi thường gặp

- **`node` hoặc `npm` không được nhận diện:** cài Node.js LTS rồi mở terminal mới.
- **`python` không được nhận diện:** cài Python và kiểm tra PATH; có thể thử `py --version` trên Windows.
- **Không thấy .NET SDK 10:** cài .NET 10 SDK, không chỉ cài runtime.
- **Không kết nối được SQL Server:** kiểm tra dịch vụ SQL Server, tên instance, authentication và connection string trong `appsettings.json`.
- **Frontend không gọi được API:** kiểm tra cả terminal .NET/Python, port và cấu hình proxy trong `frontend/vite.config.ts`.
- **Không mở được webcam:** dùng localhost, cấp quyền camera cho Chrome/Edge và đóng ứng dụng khác đang chiếm camera.
- **OCR nhận sai biển số:** thử ảnh rõ nét, đủ sáng và kiểm tra log của Python; OCR có thể sai và cần kiểm chứng thực tế.

## 13. Bảo mật và giới hạn

- Không sử dụng tài khoản demo, JWT secret hoặc cấu hình database mẫu trong môi trường production.
- Không commit mật khẩu, khóa bí mật, dữ liệu cá nhân hoặc ảnh biển số thật lên repository công khai.
- Thay JWT secret và dùng biến môi trường/secret manager khi triển khai thực tế.
- Chưa coi hệ thống là đã kiểm thử end-to-end cho đến khi bạn tự chạy và kiểm tra toàn bộ dịch vụ trên máy có SQL Server và webcam.


## 14. Các phần còn thiếu / cần hoàn thiện để đáp ứng yêu cầu đồ án

> **Lưu ý về phạm vi:** Repository này không kèm đề bài hoặc rubric chính thức có tên “3 Project”. Vì vậy, danh sách dưới đây là checklist kỹ thuật dựa trên cấu trúc hiện tại, không phải kết luận rằng giảng viên bắt buộc từng mục. Hãy đối chiếu với yêu cầu chính thức của thầy trước khi chốt.

### 14.1. Kiểm thử end-to-end và bằng chứng

- [ ] Chạy toàn bộ luồng **camera/OCR → Python Flask → .NET API → SQL Server → React** trên một máy sạch hoặc môi trường demo.
- [ ] Kiểm tra tạo vé vào, xe ra, cập nhật trạng thái, trường hợp biển số không đọc được, biển số trùng hoặc không tìm thấy vé đang mở.
- [ ] Bổ sung test tự động cho các API quan trọng, xác thực JWT và thao tác repository/database.
- [ ] Ghi lại kết quả test, ảnh chụp màn hình và các bước tái hiện lỗi để dùng khi nghiệm thu.

### 14.2. Database và triển khai

- [ ] Xác nhận `schema.sql` khớp hoàn toàn với model, câu truy vấn trong Dapper và database thực tế; nếu schema thay đổi, cập nhật script có kiểm soát.
- [ ] Có hướng dẫn backup/restore và cách chuyển dữ liệu vé thực tế. `seed.sql` chỉ là dữ liệu demo, không phải bản sao database.
- [ ] Nếu yêu cầu dùng nhiều máy chung dữ liệu, triển khai SQL Server trên máy chủ/cloud và cấu hình Backend truy cập an toàn; database cục bộ của mỗi máy không tự đồng bộ.
- [ ] Cấu hình môi trường riêng cho development/demo; không để JWT secret, mật khẩu hoặc thông tin nhạy cảm trong repo công khai.

### 14.3. Hoàn thiện ứng dụng

- [ ] Kiểm tra phân quyền và xác thực ở mọi endpoint cần bảo vệ; không chỉ dựa vào việc ẩn nút trên giao diện.
- [ ] Chuẩn hóa phản hồi lỗi, logging, kiểm tra dữ liệu đầu vào và thông báo lỗi ở frontend.
- [ ] Kiểm tra việc lưu trữ đường dẫn ảnh vé: file ảnh phải tồn tại và có thể truy cập trên môi trường triển khai, không chỉ trên máy tạo vé.
- [ ] Xác nhận chức năng camera/OCR chạy ổn định với dữ liệu thực tế và ghi rõ giới hạn nhận diện. Chỉ tuyên bố tích hợp barrier vật lý nếu đã có phần cứng và kiểm thử thực tế.

### 14.4. Tài liệu và bàn giao

- [ ] Bảo đảm README, script SQL và cấu hình mẫu khớp với code đang commit.
- [ ] Thêm file cấu hình mẫu không chứa secret thật (ví dụ `.env.example` nếu có dùng biến môi trường) và hướng dẫn các biến cần thiết.
- [ ] Ghi rõ chức năng đã hoàn thành, chức năng còn là demo/prototype, yêu cầu phần cứng và các giới hạn đã biết.
- [ ] Chuẩn bị sơ đồ kiến trúc, sơ đồ database, mô tả API và kịch bản demo nếu rubric của môn học yêu cầu.

**Ưu tiên trước buổi bảo vệ:** (1) chạy được trên máy mới theo README, (2) xác minh tạo/đóng vé thực sự lưu trong SQL Server, (3) chuẩn bị kịch bản test có thể lặp lại, (4) kiểm tra bảo mật cấu hình, (5) đối chiếu từng tiêu chí trong rubric chính thức của thầy. Không coi checklist này là xác nhận đã hoàn thành; chỉ đánh dấu sau khi kiểm thử được.
