import { useState } from 'react'

type MenuId = 'dashboard' | 'gate' | 'parking' | 'history' | 'settings'

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

const menuItems: { id: MenuId; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '▦', label: 'Tổng quan' },
  { id: 'gate', icon: '↔', label: 'Cổng vào / ra' },
  { id: 'parking', icon: '▤', label: 'Xe đang gửi' },
  { id: 'history', icon: '◷', label: 'Lịch sử' },
  { id: 'settings', icon: '⚙', label: 'Cài đặt' },
]

const pageDetails: Record<MenuId, { title: string; description: string }> = {
  dashboard: {
    title: 'Tổng quan',
    description: 'Theo dõi tình hình xe vào, xe ra và các lượt gửi xe.',
  },
  gate: {
    title: 'Cổng vào / ra',
    description: 'Khu vực thao tác camera và nhận diện biển số.',
  },
  parking: {
    title: 'Xe đang gửi',
    description: 'Danh sách phương tiện chưa hoàn tất lượt gửi.',
  },
  history: {
    title: 'Lịch sử gửi xe',
    description: 'Tra cứu các lượt xe vào và đã rời bãi.',
  },
  settings: {
    title: 'Cài đặt',
    description: 'Thông tin cấu hình các thành phần của hệ thống.',
  },
}

const recentActivities = [
  { type: 'entry', title: 'Xe vào bãi', description: 'Biển số 89E118896', time: '01:51' },
  { type: 'entry', title: 'Xe vào bãi', description: 'Biển số 59B88888', time: '01:45' },
  { type: 'exit', title: 'Xe rời bãi', description: 'Biển số 59A99999', time: '01:29' },
]

function TicketTable({ rows }: { rows: Ticket[] }) {
  if (rows.length === 0) {
    return <div className="empty-state">Không tìm thấy lượt gửi xe phù hợp.</div>
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Mã vé</th>
            <th>Biển số</th>
            <th>Loại xe</th>
            <th>Giờ vào</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ticket) => (
            <tr key={ticket.code}>
              <td className="ticket-code">{ticket.code}</td>
              <td><strong className="plate-number">{ticket.plate}</strong></td>
              <td>{ticket.type}</td>
              <td>{ticket.entry}</td>
              <td>
                <span className={ticket.status === 'Đang gửi' ? 'status-pill status-open' : 'status-pill status-closed'}>
                  {ticket.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboard')
  const [searchTerm, setSearchTerm] = useState('')

  const currentPage = pageDetails[activeMenu]
  const activeTickets = tickets.filter((ticket) => ticket.status === 'Đang gửi')
  const listForCurrentPage = activeMenu === 'history' ? tickets : activeTickets
  const filteredTickets = listForCurrentPage.filter((ticket) => {
    const search = searchTerm.trim().toLowerCase()
    return !search || ticket.plate.toLowerCase().includes(search) || ticket.code.toLowerCase().includes(search)
  })

  const goTo = (page: MenuId) => {
    setActiveMenu(page)
    setSearchTerm('')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">SP</div>
          <div className="brand-copy">
            <div className="brand-name">Smart Parking</div>
            <div className="brand-subtitle">Quản lý bãi xe</div>
          </div>
        </div>

        <div className="sidebar-section-title">MENU CHÍNH</div>
        <nav className="sidebar-menu" aria-label="Menu chính">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`menu-item ${activeMenu === item.id ? 'active' : ''}`}
              onClick={() => goTo(item.id)}
              aria-current={activeMenu === item.id ? 'page' : undefined}
            >
              <span className="menu-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="data-note">
            <span className="note-mark">i</span>
            <p>Dữ liệu trên giao diện hiện là dữ liệu minh họa.</p>
          </div>
          <div className="sidebar-version">Smart Parking · Phiên bản 1.0</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="breadcrumb">Smart Parking <span>/</span> {currentPage.title}</div>
            <h1>{currentPage.title}</h1>
            <p className="page-description">{currentPage.description}</p>
          </div>
          <div className="topbar-actions">
            <span className="sample-label"><span /> Dữ liệu minh họa</span>
            <div className="profile">
              <div className="profile-avatar">A</div>
              <div className="profile-info">
                <strong>Admin</strong>
                <span>Quản trị viên</span>
              </div>
            </div>
          </div>
        </header>

        {activeMenu === 'dashboard' && (
          <>
            <section className="welcome-row">
              <div>
                <h2>Tình hình bãi xe</h2>
                <p>Số liệu dưới đây dùng để minh họa bố cục, chưa lấy trực tiếp từ cơ sở dữ liệu.</p>
              </div>
              <button className="primary-button" onClick={() => goTo('parking')}>Xem xe đang gửi <span>→</span></button>
            </section>

            <section className="stats-grid" aria-label="Thống kê">
              <article className="stat-card">
                <div className="stat-heading"><span className="stat-icon">▣</span><span>Hiện tại</span></div>
                <div className="stat-number">24</div>
                <div className="stat-label">Xe đang gửi</div>
              </article>
              <article className="stat-card">
                <div className="stat-heading"><span className="stat-icon">↓</span><span>Trong ngày</span></div>
                <div className="stat-number">38</div>
                <div className="stat-label">Lượt xe vào</div>
              </article>
              <article className="stat-card">
                <div className="stat-heading"><span className="stat-icon">↑</span><span>Trong ngày</span></div>
                <div className="stat-number">14</div>
                <div className="stat-label">Lượt xe ra</div>
              </article>
              <article className="stat-card">
                <div className="stat-heading"><span className="stat-icon">≡</span><span>Trong ngày</span></div>
                <div className="stat-number">52</div>
                <div className="stat-label">Tổng lượt vào / ra</div>
              </article>
            </section>

            <section className="dashboard-grid">
              <section className="panel parking-panel">
                <div className="panel-header">
                  <div>
                    <h3>Xe đang gửi gần đây</h3>
                    <p>Danh sách xe hiện chưa trả</p>
                  </div>
                  <button className="text-button" onClick={() => goTo('parking')}>Xem tất cả <span>→</span></button>
                </div>
                <TicketTable rows={activeTickets.slice(0, 3)} />
              </section>

              <div className="right-column">
                <section className="panel camera-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Camera cổng</h3>
                      <p>Hình ảnh camera vào / ra</p>
                    </div>
                    <span className="status-pill status-pending">Chưa kết nối</span>
                  </div>
                  <div className="camera-placeholder">
                    <div className="camera-symbol">▣</div>
                    <strong>Chưa có hình ảnh trực tiếp</strong>
                    <span>Giao diện React chưa tích hợp luồng camera.</span>
                  </div>
                  <div className="camera-help">
                    <span className="info-icon">i</span>
                    Camera/OCR hiện có thể kiểm tra ở giao diện Python.
                  </div>
                  <button className="secondary-button" onClick={() => goTo('gate')}>Thông tin cổng vào / ra</button>
                </section>

                <section className="panel activity-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Hoạt động gần đây</h3>
                      <p>Một vài lượt xe mẫu</p>
                    </div>
                    <button className="text-button" onClick={() => goTo('history')}>Xem lịch sử <span>→</span></button>
                  </div>
                  <div className="activity-list">
                    {recentActivities.map((activity, index) => (
                      <div className="activity-item" key={`${activity.time}-${index}`}>
                        <div className={`activity-icon ${activity.type}`}>{activity.type === 'entry' ? '↓' : '↑'}</div>
                        <div className="activity-content">
                          <strong>{activity.title}</strong>
                          <span>{activity.description}</span>
                        </div>
                        <time>{activity.time}</time>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </section>
          </>
        )}

        {activeMenu === 'parking' && (
          <section className="panel full-panel">
            <div className="panel-header panel-header-stackable">
              <div>
                <h3>Danh sách xe đang gửi</h3>
                <p>{activeTickets.length} lượt xe trong dữ liệu minh họa</p>
              </div>
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm biển số hoặc mã vé" />
              </label>
            </div>
            <TicketTable rows={filteredTickets} />
          </section>
        )}

        {activeMenu === 'history' && (
          <section className="panel full-panel">
            <div className="panel-header panel-header-stackable">
              <div>
                <h3>Lịch sử lượt gửi xe</h3>
                <p>Tra cứu theo biển số hoặc mã vé</p>
              </div>
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nhập biển số hoặc mã vé" />
              </label>
            </div>
            <TicketTable rows={filteredTickets} />
          </section>
        )}

        {activeMenu === 'gate' && (
          <section className="gate-layout">
            <section className="panel gate-panel">
              <div className="panel-header">
                <div>
                  <h3>Khu vực camera cổng</h3>
                  <p>Trạng thái giao diện React</p>
                </div>
                <span className="status-pill status-pending">Chưa tích hợp</span>
              </div>
              <div className="gate-placeholder">
                <div className="camera-symbol">▣</div>
                <h2>Camera chưa hiển thị trên React</h2>
                <p>Giao diện này chưa lấy hình ảnh trực tiếp hoặc kết quả nhận diện từ Python API. Không có thao tác mở cổng nào được thực hiện tại đây.</p>
              </div>
            </section>
            <section className="panel gate-info-panel">
              <div className="panel-header">
                <div>
                  <h3>Thông tin tích hợp</h3>
                  <p>Tham khảo khi phát triển tiếp</p>
                </div>
              </div>
              <dl className="settings-list">
                <div><dt>Dịch vụ Python</dt><dd>http://127.0.0.1:5000</dd></div>
                <div><dt>API .NET</dt><dd>http://localhost:5049</dd></div>
                <div><dt>Hình ảnh camera</dt><dd>Chưa nối vào React</dd></div>
                <div><dt>Nhận diện biển số</dt><dd>Chưa nối vào trang này</dd></div>
              </dl>
            </section>
          </section>
        )}

        {activeMenu === 'settings' && (
          <section className="panel full-panel">
            <div className="panel-header">
              <div>
                <h3>Thông tin hệ thống</h3>
                <p>Các thành phần của dự án Smart Parking</p>
              </div>
            </div>
            <dl className="settings-list">
              <div><dt>Giao diện</dt><dd>React + TypeScript</dd></div>
              <div><dt>Dịch vụ Python</dt><dd>http://127.0.0.1:5000</dd></div>
              <div><dt>API nghiệp vụ</dt><dd>http://localhost:5049</dd></div>
              <div><dt>Dữ liệu hiển thị</dt><dd>Minh họa, chưa đồng bộ API</dd></div>
              <div><dt>Trạng thái kết nối</dt><dd>Chưa tự động kiểm tra trên giao diện này</dd></div>
            </dl>
          </section>
        )}

        <footer className="footer">
          <span>Smart Parking System</span>
          <span>Giao diện đang phát triển · React</span>
        </footer>
      </main>
    </div>
  )
}

export default App
