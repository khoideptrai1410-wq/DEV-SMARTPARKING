import { useState } from 'react'

type Ticket = {
  code: string
  plate: string
  type: string
  entry: string
  status: 'Đang gửi' | 'Đã trả xe'
}

const tickets: Ticket[] = [
  {
    code: 'SP-20261005-015101000',
    plate: '89E118896',
    type: 'Xe máy',
    entry: '01:51:01',
    status: 'Đang gửi',
  },
  {
    code: 'SP-20261005-014522000',
    plate: '59B88888',
    type: 'Xe máy',
    entry: '01:45:22',
    status: 'Đang gửi',
  },
  {
    code: 'SP-20261005-013815000',
    plate: '51A12345',
    type: 'Ô tô',
    entry: '01:38:15',
    status: 'Đang gửi',
  },
  {
    code: 'SP-20261005-012930000',
    plate: '59A99999',
    type: 'Xe máy',
    entry: '01:29:30',
    status: 'Đã trả xe',
  },
]

function App() {
  const [activeMenu, setActiveMenu] = useState('dashboard')

  const menuItems = [
    { id: 'dashboard', icon: '▦', label: 'Tổng quan' },
    { id: 'gate', icon: '◉', label: 'Cổng vào / ra' },
    { id: 'parking', icon: '▤', label: 'Xe đang gửi' },
    { id: 'history', icon: '◷', label: 'Lịch sử' },
    { id: 'settings', icon: '⚙', label: 'Cài đặt' },
  ]

  const activeTickets = tickets.filter(
    (ticket) => ticket.status === 'Đang gửi',
  )

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            SP
          </div>

          <div>
            <div className="brand-name">Smart Parking</div>
            <div className="brand-subtitle">Management System</div>
          </div>
        </div>

        <div className="sidebar-section-title">
          MENU CHÍNH
        </div>

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`menu-item ${
                activeMenu === item.id ? 'active' : ''
              }`}
              onClick={() => setActiveMenu(item.id)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot"></span>

            <div>
              <strong>Hệ thống hoạt động</strong>
              <span>Camera & API Online</span>
            </div>
          </div>

          <div className="sidebar-version">
            Smart Parking v1.0
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        {/* HEADER */}
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              Smart Parking / <strong>Tổng quan</strong>
            </div>

            <h1>Xin chào, Admin</h1>

            <p className="page-description">
              Theo dõi và quản lý bãi đỗ xe của bạn.
            </p>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" title="Thông báo">
              🔔
              <span className="notification-dot"></span>
            </button>

            <div className="profile">
              <div className="profile-avatar">A</div>

              <div className="profile-info">
                <strong>Administrator</strong>
                <span>Quản trị viên</span>
              </div>

              <span className="profile-arrow">⌄</span>
            </div>
          </div>
        </header>

        {/* QUICK ACTION */}
        <section className="hero-card">
          <div className="hero-content">
            <div className="hero-badge">
              ● HỆ THỐNG ĐANG HOẠT ĐỘNG
            </div>

            <h2>Quản lý bãi xe thông minh</h2>

            <p>
              Giám sát xe vào, xe ra và nhận diện biển số
              theo thời gian thực.
            </p>

            <button
              className="hero-button"
              onClick={() => setActiveMenu('gate')}
            >
              <span>◉</span>
              Mở cổng camera
              <span>→</span>
            </button>
          </div>

          <div className="hero-visual">
            <div className="parking-orbit orbit-one"></div>
            <div className="parking-orbit orbit-two"></div>
            <div className="parking-center">
              <span>🅿</span>
            </div>
          </div>
        </section>

        {/* STATISTICS */}
        <section className="stats-grid">
          <div className="stat-card green">
            <div className="stat-top">
              <div className="stat-icon">🚗</div>
              <span className="stat-change positive">+12%</span>
            </div>

            <div className="stat-number">24</div>
            <div className="stat-label">Xe đang gửi</div>

            <div className="stat-footer">
              Đang có trong bãi
            </div>
          </div>

          <div className="stat-card blue">
            <div className="stat-top">
              <div className="stat-icon">↗</div>
              <span className="stat-change positive">+8%</span>
            </div>

            <div className="stat-number">38</div>
            <div className="stat-label">Xe vào hôm nay</div>

            <div className="stat-footer">
              So với ngày hôm qua
            </div>
          </div>

          <div className="stat-card purple">
            <div className="stat-top">
              <div className="stat-icon">✓</div>
              <span className="stat-change positive">+5%</span>
            </div>

            <div className="stat-number">14</div>
            <div className="stat-label">Xe đã trả</div>

            <div className="stat-footer">
              Hoàn tất hôm nay
            </div>
          </div>

          <div className="stat-card orange">
            <div className="stat-top">
              <div className="stat-icon">🎫</div>
              <span className="stat-change neutral">Hôm nay</span>
            </div>

            <div className="stat-number">52</div>
            <div className="stat-label">Tổng lượt xe</div>

            <div className="stat-footer">
              Tổng số lượt vào / ra
            </div>
          </div>
        </section>

        {/* CONTENT GRID */}
        <section className="dashboard-grid">
          {/* PARKING TABLE */}
          <div className="panel parking-panel">
            <div className="panel-header">
              <div>
                <h3>Xe đang trong bãi</h3>
                <p>
                  Danh sách phương tiện hiện tại
                </p>
              </div>

              <button
                className="view-all"
                onClick={() => setActiveMenu('parking')}
              >
                Xem tất cả →
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>MÃ VÉ</th>
                    <th>BIỂN SỐ</th>
                    <th>LOẠI XE</th>
                    <th>THỜI GIAN VÀO</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>

                <tbody>
                  {activeTickets.map((ticket) => (
                    <tr key={ticket.code}>
                      <td>
                        <span className="ticket-code">
                          {ticket.code}
                        </span>
                      </td>

                      <td>
                        <strong className="plate-number">
                          {ticket.plate}
                        </strong>
                      </td>

                      <td>{ticket.type}</td>

                      <td>{ticket.entry}</td>

                      <td>
                        <span className="badge-open">
                          <span></span>
                          Đang gửi
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="right-column">
            {/* CAMERA */}
            <div className="panel camera-panel">
              <div className="panel-header">
                <div>
                  <h3>Camera cổng</h3>
                  <p>Trạng thái nhận diện</p>
                </div>

                <span className="live-badge">
                  ● LIVE
                </span>
              </div>

              <div className="camera-preview">
                <div className="camera-grid"></div>

                <div className="camera-crosshair">
                  <span></span>
                </div>

                <div className="camera-info">
                  <span>CAM-01</span>
                  <span>1080p</span>
                </div>

                <div className="camera-overlay">
                  <div className="scan-line"></div>
                </div>

                <div className="camera-placeholder">
                  <div className="camera-icon">📹</div>
                  <strong>Camera đang hoạt động</strong>
                  <span>Chờ nhận diện biển số...</span>
                </div>
              </div>

              <button
                className="camera-button"
                onClick={() => setActiveMenu('gate')}
              >
                Mở giao diện cổng
                <span>→</span>
              </button>
            </div>

            {/* SYSTEM STATUS */}
            <div className="panel system-panel">
              <div className="panel-header">
                <div>
                  <h3>Trạng thái hệ thống</h3>
                  <p>Các dịch vụ đang chạy</p>
                </div>
              </div>

              <div className="service-list">
                <div className="service-item">
                  <div className="service-icon python">
                    PY
                  </div>

                  <div className="service-info">
                    <strong>Camera / OCR</strong>
                    <span>Python Service</span>
                  </div>

                  <span className="online">
                    Online
                  </span>
                </div>

                <div className="service-item">
                  <div className="service-icon api">
                    API
                  </div>

                  <div className="service-info">
                    <strong>SmartParking API</strong>
                    <span>.NET Backend</span>
                  </div>

                  <span className="online">
                    Online
                  </span>
                </div>

                <div className="service-item">
                  <div className="service-icon db">
                    DB
                  </div>

                  <div className="service-info">
                    <strong>SQL Server</strong>
                    <span>Database</span>
                  </div>

                  <span className="online">
                    Online
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RECENT ACTIVITY */}
        <section className="panel activity-panel">
          <div className="panel-header">
            <div>
              <h3>Hoạt động gần đây</h3>
              <p>Lịch sử thao tác mới nhất</p>
            </div>

            <button
              className="view-all"
              onClick={() => setActiveMenu('history')}
            >
              Xem lịch sử →
            </button>
          </div>

          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon entry">
                ↓
              </div>

              <div className="activity-content">
                <strong>Xe vào bãi</strong>
                <span>
                  Biển số <b>89E118896</b> đã được nhận diện
                </span>
              </div>

              <time>01:51</time>
            </div>

            <div className="activity-item">
              <div className="activity-icon entry">
                ↓
              </div>

              <div className="activity-content">
                <strong>Xe vào bãi</strong>
                <span>
                  Biển số <b>59B88888</b> đã được nhận diện
                </span>
              </div>

              <time>01:45</time>
            </div>

            <div className="activity-item">
              <div className="activity-icon exit">
                ↑
              </div>

              <div className="activity-content">
                <strong>Xe rời bãi</strong>
                <span>
                  Vé <b>SP-20261005-012930000</b> đã đóng
                </span>
              </div>

              <time>01:29</time>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>© 2026 Smart Parking System</span>
          <span>React + TypeScript + Tailwind CSS</span>
        </footer>
      </main>
    </div>
  )
}

export default App