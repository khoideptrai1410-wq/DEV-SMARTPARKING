import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchTickets, login, previewPlate, submitGateEvent } from './api'
import type { GateEventResult, PlatePreview, TicketDto } from './api'

type MenuId = 'dashboard' | 'gate' | 'parking' | 'history' | 'settings'
type GateMode = 'entry' | 'exit'

const menuItems: { id: MenuId; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '▦', label: 'Tổng quan' },
  { id: 'gate', icon: '↔', label: 'Cổng vào / ra' },
  { id: 'parking', icon: '▤', label: 'Xe đang gửi' },
  { id: 'history', icon: '◷', label: 'Lịch sử' },
  { id: 'settings', icon: '⚙', label: 'Cài đặt' },
]

const pageDetails: Record<MenuId, { title: string; description: string }> = {
  dashboard: { title: 'Tổng quan', description: 'Theo dõi tình hình xe vào, xe ra từ dữ liệu trên hệ thống.' },
  gate: { title: 'Cổng vào / ra', description: 'Mở camera, kiểm tra biển số rồi xác nhận sự kiện gửi xe.' },
  parking: { title: 'Xe đang gửi', description: 'Các vé đang mở trong cơ sở dữ liệu SmartParking.' },
  history: { title: 'Lịch sử gửi xe', description: 'Tra cứu các vé đã tạo, đã đóng hoặc đang cần kiểm tra.' },
  settings: { title: 'Kết nối hệ thống', description: 'Thông tin các dịch vụ dùng trong môi trường phát triển local.' },
}

function isOpenStatus(status: number | string) {
  const value = String(status).toLowerCase()
  return value === '1' || value === 'open' || value === 'đang gửi'
}

function statusText(status: number | string) {
  const value = String(status).toLowerCase()
  if (value === '1' || value === 'open' || value === 'đang gửi') return 'Đang gửi'
  if (value === '2' || value === 'closed' || value === 'đã trả xe') return 'Đã trả xe'
  if (value === '3' || value === 'alert') return 'Cần kiểm tra'
  return 'Trạng thái ' + String(status)
}

function statusClass(status: number | string) {
  const value = String(status).toLowerCase()
  if (value === '1' || value === 'open' || value === 'đang gửi') return 'status-pill status-open'
  if (value === '2' || value === 'closed' || value === 'đã trả xe') return 'status-pill status-closed'
  return 'status-pill status-pending'
}

function vehicleText(vehicleType: string) {
  const value = vehicleType.toLowerCase()
  if (value === 'motorbike' || value === 'motorcycle' || value === 'xe máy') return 'Xe máy'
  if (value === 'car' || value === 'ô tô' || value === 'oto') return 'Ô tô'
  return vehicleType || 'Chưa rõ'
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function sameLocalDay(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  const today = new Date()
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
}

function money(value: number | undefined) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0)
}

function TicketTable({ rows, history = false }: { rows: TicketDto[]; history?: boolean }) {
  if (rows.length === 0) {
    return <div className="empty-state">Không có dữ liệu vé phù hợp trong cơ sở dữ liệu.</div>
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Mã vé</th><th>Biển số</th><th>Loại xe</th><th>Giờ vào</th>
            {history && <th>Giờ ra</th>}
            {history && <th>Phí / phạt</th>}
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ticket) => (
            <tr key={ticket.ticketId}>
              <td className="ticket-code">{ticket.ticketCode || ('#' + ticket.ticketId)}</td>
              <td><strong className="plate-number">{ticket.plate}</strong></td>
              <td>{vehicleText(ticket.vehicleType)}</td>
              <td>{formatDateTime(ticket.entryTime)}</td>
              {history && <td>{formatDateTime(ticket.exitTime)}</td>}
              {history && <td>{money(ticket.penaltyAmount)}</td>}
              <td><span className={statusClass(ticket.status)}>{statusText(ticket.status)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onLogin(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="brand-logo">SP</div>
          <div><div className="brand-name">Smart Parking</div><div className="brand-subtitle">Quản lý bãi xe</div></div>
        </div>
        <h1>Đăng nhập hệ thống</h1>
        <p className="login-description">Đăng nhập bằng tài khoản của SmartParking API để xem dữ liệu vé trong SQL Server.</p>
        <label className="field-label" htmlFor="username">Tên đăng nhập</label>
        <input id="username" className="form-input" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <label className="field-label" htmlFor="password">Mật khẩu</label>
        <input id="password" className="form-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <div className="feedback feedback-error" role="alert">{error}</div>}
        <button className="primary-button login-button" type="submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <p className="login-help">Môi trường demo hiện dùng tài khoản cấu hình trong backend. Không dùng mật khẩu demo cho môi trường thực tế.</p>
      </form>
    </main>
  )
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('smartparking_token') ?? '')
  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboard')
  const [tickets, setTickets] = useState<TicketDto[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [connected, setConnected] = useState(false)
  const [apiError, setApiError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [cameraOn, setCameraOn] = useState(false)
  const [gateMode, setGateMode] = useState<GateMode>('entry')
  const [cameraBusy, setCameraBusy] = useState(false)
  const [gateMessage, setGateMessage] = useState('')
  const [gateError, setGateError] = useState('')
  const [preview, setPreview] = useState<PlatePreview | null>(null)
  const [snapshot, setSnapshot] = useState<Blob | null>(null)
  const [snapshotUrl, setSnapshotUrl] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const snapshotUrlRef = useRef('')

  const currentPage = pageDetails[activeMenu]
  const activeTickets = tickets.filter((ticket) => isOpenStatus(ticket.status))
  const entriesToday = tickets.filter((ticket) => sameLocalDay(ticket.entryTime)).length
  const exitsToday = tickets.filter((ticket) => sameLocalDay(ticket.exitTime)).length
  const alerts = tickets.filter((ticket) => String(ticket.status) === '3' || String(ticket.status).toLowerCase() === 'alert').length
  const displayTickets = (activeMenu === 'history' ? tickets : activeTickets).filter((ticket) => {
    const search = searchTerm.trim().toLowerCase()
    return !search || ticket.plate.toLowerCase().includes(search) || (ticket.ticketCode || '').toLowerCase().includes(search)
  })

  useEffect(() => {
    if (!token) {
      setTickets([])
      setConnected(false)
      setLoadingTickets(false)
      return
    }

    let cancelled = false
    setLoadingTickets(true)
    setApiError('')
    fetchTickets(token)
      .then((data) => {
        if (cancelled) return
        setTickets(data)
        setConnected(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setConnected(false)
        setApiError(err instanceof Error ? err.message : 'Không thể đọc dữ liệu từ backend.')
        const message = err instanceof Error ? err.message.toLowerCase() : ''
        if (message.includes('401') || message.includes('unauthorized')) {
          sessionStorage.removeItem('smartparking_token')
          setToken('')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTickets(false)
      })

    return () => { cancelled = true }
  }, [token, refreshKey])

  useEffect(() => {
    if (activeMenu === 'gate') return
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [activeMenu])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current)
  }, [])

  async function handleLogin(username: string, password: string) {
    const result = await login(username, password)
    sessionStorage.setItem('smartparking_token', result.token)
    setApiError('')
    setToken(result.token)
  }

  function handleLogout() {
    sessionStorage.removeItem('smartparking_token')
    setToken('')
    setTickets([])
    setActiveMenu('dashboard')
  }

  function goTo(page: MenuId) {
    setActiveMenu(page)
    setSearchTerm('')
    setGateMessage('')
    setGateError('')
  }

  async function startCamera() {
    setGateError('')
    setGateMessage('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setGateError('Trình duyệt không hỗ trợ camera hoặc trang chưa chạy trên localhost.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (err) {
      setGateError(err instanceof Error ? 'Không mở được camera: ' + err.message : 'Không mở được camera. Hãy kiểm tra quyền truy cập camera của trình duyệt.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  function takeSnapshot(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
        reject(new Error('Camera chưa sẵn sàng. Hãy mở camera và đợi hình ảnh xuất hiện.'))
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Không thể chụp ảnh từ camera.'))
        return
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Không tạo được ảnh từ camera.'))
      }, 'image/jpeg', 0.88)
    })
  }

  async function handlePreview() {
    setCameraBusy(true)
    setGateMessage('')
    setGateError('')
    setPreview(null)
    try {
      const image = await takeSnapshot()
      const nextUrl = URL.createObjectURL(image)
      if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current)
      snapshotUrlRef.current = nextUrl
      setSnapshotUrl(nextUrl)
      setSnapshot(image)
      const result = await previewPlate(image)
      setPreview(result)
      if (result.valid && result.plate) {
        setGateMessage('Đã nhận diện sơ bộ biển số ' + result.plate + '. Hãy kiểm tra trước khi ghi nhận.')
      } else {
        setGateError(result.message || 'Chưa nhận diện được biển số hợp lệ. Hãy thử chụp lại rõ hơn.')
      }
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Không thể nhận diện ảnh.')
    } finally {
      setCameraBusy(false)
    }
  }

  async function handleGateEvent() {
    if (!snapshot) {
      setGateError('Hãy chụp ảnh và kiểm tra biển số trước.')
      return
    }

    setCameraBusy(true)
    setGateMessage('')
    setGateError('')
    try {
      const result: GateEventResult = await submitGateEvent(gateMode, snapshot, preview)
      setGateMessage(result.message || 'Đã gửi sự kiện đến dịch vụ Python.')
      if (result.event !== 'not_found' && result.event !== 'ignored') {
        setSnapshot(null)
        setPreview(null)
        if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current)
        snapshotUrlRef.current = ''
        setSnapshotUrl('')
      }
      setRefreshKey((key) => key + 1)
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Không thể xử lý sự kiện xe.')
    } finally {
      setCameraBusy(false)
    }
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">SP</div>
          <div className="brand-copy"><div className="brand-name">Smart Parking</div><div className="brand-subtitle">Quản lý bãi xe</div></div>
        </div>
        <div className="sidebar-section-title">MENU CHÍNH</div>
        <nav className="sidebar-menu" aria-label="Menu chính">
          {menuItems.map((item) => (
            <button key={item.id} className={'menu-item ' + (activeMenu === item.id ? 'active' : '')} onClick={() => goTo(item.id)} aria-current={activeMenu === item.id ? 'page' : undefined}>
              <span className="menu-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="data-note"><span className="note-mark">{connected ? '✓' : '!'}</span><p>{connected ? 'Đã đọc dữ liệu từ SmartParking API.' : 'Chưa xác nhận kết nối cơ sở dữ liệu.'}</p></div>
          <div className="sidebar-version">Smart Parking · Phiên bản 1.0</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><div className="breadcrumb">Smart Parking <span>/</span> {currentPage.title}</div><h1>{currentPage.title}</h1><p className="page-description">{currentPage.description}</p></div>
          <div className="topbar-actions">
            <span className={'sample-label ' + (connected ? 'connected-label' : '')}><span />{connected ? 'Đã kết nối API' : loadingTickets ? 'Đang tải dữ liệu' : 'Chưa kết nối API'}</span>
            <button className="refresh-button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loadingTickets}>Làm mới</button>
            <div className="profile"><div className="profile-avatar">A</div><div className="profile-info"><strong>Admin</strong><span>Quản trị viên</span></div><button className="logout-button" onClick={handleLogout}>Đăng xuất</button></div>
          </div>
        </header>

        {apiError && <div className="feedback feedback-error" role="alert">Không tải được dữ liệu vé: {apiError}. Hãy kiểm tra SQL Server, backend .NET và đăng nhập.</div>}

        {activeMenu === 'dashboard' && (
          <>
            <section className="welcome-row">
              <div><h2>Tình hình bãi xe</h2><p>Các số liệu dưới đây được tính từ danh sách vé do backend trả về.</p></div>
              <button className="primary-button" onClick={() => goTo('gate')}>Mở cổng vào / ra <span>→</span></button>
            </section>
            <section className="stats-grid" aria-label="Thống kê">
              <article className="stat-card"><div className="stat-heading"><span className="stat-icon">▣</span><span>Hiện tại</span></div><div className="stat-number">{activeTickets.length}</div><div className="stat-label">Xe đang gửi</div></article>
              <article className="stat-card"><div className="stat-heading"><span className="stat-icon">↓</span><span>Hôm nay</span></div><div className="stat-number">{entriesToday}</div><div className="stat-label">Lượt xe vào</div></article>
              <article className="stat-card"><div className="stat-heading"><span className="stat-icon">↑</span><span>Hôm nay</span></div><div className="stat-number">{exitsToday}</div><div className="stat-label">Lượt xe ra</div></article>
              <article className="stat-card"><div className="stat-heading"><span className="stat-icon">!</span><span>Toàn bộ vé</span></div><div className="stat-number">{alerts}</div><div className="stat-label">Vé cần kiểm tra</div></article>
            </section>
            <section className="dashboard-grid">
              <section className="panel parking-panel">
                <div className="panel-header"><div><h3>Xe đang gửi</h3><p>Danh sách vé đang mở trong cơ sở dữ liệu</p></div><button className="text-button" onClick={() => goTo('parking')}>Xem tất cả <span>→</span></button></div>
                {loadingTickets ? <div className="empty-state">Đang tải danh sách vé…</div> : <TicketTable rows={activeTickets.slice(0, 6)} />}
              </section>
              <div className="right-column">
                <section className="panel camera-panel">
                  <div className="panel-header"><div><h3>Camera cổng</h3><p>Nhận diện qua trang Cổng vào / ra</p></div><span className="status-pill status-pending">Mở khi cần</span></div>
                  <div className="camera-placeholder"><div className="camera-symbol">▣</div><strong>Camera không tự bật</strong><span>Chủ động mở camera khi cần ghi nhận xe.</span></div>
                  <button className="secondary-button" onClick={() => goTo('gate')}>Mở chức năng camera</button>
                </section>
                <section className="panel activity-panel">
                  <div className="panel-header"><div><h3>Vé mới nhất</h3><p>Lấy từ backend</p></div><button className="text-button" onClick={() => goTo('history')}>Xem lịch sử <span>→</span></button></div>
                  <div className="activity-list">
                    {tickets.slice(0, 4).map((ticket) => (
                      <div className="activity-item" key={ticket.ticketId}>
                        <div className={'activity-icon ' + (isOpenStatus(ticket.status) ? 'entry' : 'exit')}>{isOpenStatus(ticket.status) ? '↓' : '↑'}</div>
                        <div className="activity-content"><strong>{ticket.plate} · {vehicleText(ticket.vehicleType)}</strong><span>{ticket.ticketCode} · {statusText(ticket.status)}</span></div><time>{formatTime(ticket.entryTime)}</time>
                      </div>
                    ))}
                    {!loadingTickets && tickets.length === 0 && <div className="empty-state">Chưa có vé trong cơ sở dữ liệu.</div>}
                  </div>
                </section>
              </div>
            </section>
          </>
        )}

        {activeMenu === 'parking' && (
          <section className="panel full-panel">
            <div className="panel-header panel-header-stackable"><div><h3>Danh sách xe đang gửi</h3><p>{activeTickets.length} vé đang mở từ backend</p></div><label className="search-box"><span aria-hidden="true">⌕</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm biển số hoặc mã vé" /></label></div>
            {loadingTickets ? <div className="empty-state">Đang tải dữ liệu…</div> : <TicketTable rows={displayTickets} />}
          </section>
        )}

        {activeMenu === 'history' && (
          <section className="panel full-panel">
            <div className="panel-header panel-header-stackable"><div><h3>Lịch sử lượt gửi xe</h3><p>{tickets.length} vé nhận được từ backend</p></div><label className="search-box"><span aria-hidden="true">⌕</span><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nhập biển số hoặc mã vé" /></label></div>
            {loadingTickets ? <div className="empty-state">Đang tải dữ liệu…</div> : <TicketTable rows={displayTickets} history />}
          </section>
        )}

        {activeMenu === 'gate' && (
          <section className="gate-layout">
            <section className="panel gate-panel">
              <div className="panel-header"><div><h3>Camera cổng vào / ra</h3><p>Ảnh được gửi tới Python OCR khi bạn yêu cầu nhận diện.</p></div><span className={cameraOn ? 'status-pill status-open' : 'status-pill status-pending'}>{cameraOn ? 'Camera đang mở' : 'Camera chưa mở'}</span></div>
              <div className="camera-live">
                <video ref={videoRef} className={cameraOn ? 'camera-video' : 'hidden-video'} autoPlay playsInline muted />
                {!cameraOn && <div className="camera-offline"><div className="camera-symbol">▣</div><strong>Camera chưa bật</strong><span>Nhấn “Mở camera” và cho phép trình duyệt truy cập webcam.</span></div>}
              </div>
              <canvas ref={canvasRef} className="hidden-video" />
              <div className="camera-controls">
                {!cameraOn ? <button className="primary-button" onClick={startCamera}>Mở camera</button> : <button className="secondary-button inline-button" onClick={stopCamera}>Tắt camera</button>}
                <button className="secondary-button inline-button" disabled={!cameraOn || cameraBusy} onClick={handlePreview}>{cameraBusy ? 'Đang xử lý…' : 'Chụp ảnh & nhận diện'}</button>
              </div>
              {snapshotUrl && <div className="captured-image"><img src={snapshotUrl} alt="Ảnh chụp từ camera" /></div>}
              {preview && <div className="recognition-result"><div><span className="result-caption">Biển số nhận diện</span><strong>{preview.plate || 'Chưa nhận diện'}</strong></div><div><span className="result-caption">Độ tin cậy</span><strong>{typeof preview.confidence === 'number' ? (preview.confidence * 100).toFixed(1) + '%' : 'Chưa có'}</strong></div><div><span className="result-caption">Loại xe</span><strong>{preview.vehicle_type ? vehicleText(preview.vehicle_type) : 'Chưa rõ'}</strong></div></div>}
              {gateMessage && <div className="feedback feedback-success" role="status">{gateMessage}</div>}
              {gateError && <div className="feedback feedback-error" role="alert">{gateError}</div>}
              <div className="gate-submit">
                <label className="field-label" htmlFor="gate-mode">Thao tác</label>
                <select id="gate-mode" className="form-input" value={gateMode} onChange={(event) => setGateMode(event.target.value as GateMode)}>
                  <option value="entry">Ghi nhận xe vào</option><option value="exit">Xử lý xe ra</option>
                </select>
                <p className="gate-note">Hãy kiểm tra biển số sau khi nhận diện. Khi xác nhận, Python sẽ xử lý sự kiện và gọi .NET API để cập nhật SQL Server.</p>
                <button className="primary-button" disabled={!snapshot || !preview?.valid || cameraBusy} onClick={handleGateEvent}>{cameraBusy ? 'Đang gửi sự kiện…' : gateMode === 'entry' ? 'Xác nhận xe vào' : 'Xác nhận xe ra'}</button>
              </div>
            </section>
            <section className="panel gate-info-panel">
              <div className="panel-header"><div><h3>Luồng xử lý</h3><p>Các dịch vụ cần chạy trên máy local</p></div></div>
              <dl className="settings-list">
                <div><dt>React</dt><dd>localhost:5173</dd></div>
                <div><dt>Python OCR</dt><dd>127.0.0.1:5000</dd></div>
                <div><dt>.NET API</dt><dd>localhost:5049</dd></div>
                <div><dt>Cơ sở dữ liệu</dt><dd>SQL Server · SmartParking</dd></div>
              </dl>
              <div className="connection-note">Nếu nhận diện báo lỗi kết nối, kiểm tra dịch vụ Python trước. Nếu Python báo lỗi backend, kiểm tra .NET API và SQL Server.</div>
            </section>
          </section>
        )}

        {activeMenu === 'settings' && (
          <section className="panel full-panel">
            <div className="panel-header"><div><h3>Các thành phần của hệ thống</h3><p>React gọi API qua proxy của Vite trong môi trường phát triển.</p></div><span className={connected ? 'status-pill status-open' : 'status-pill status-pending'}>{connected ? 'Đã tải được dữ liệu' : 'Chưa xác nhận'}</span></div>
            <dl className="settings-list">
              <div><dt>Giao diện</dt><dd>React + TypeScript</dd></div>
              <div><dt>Đăng nhập / danh sách vé</dt><dd>http://localhost:5049/api</dd></div>
              <div><dt>Camera và OCR</dt><dd>http://127.0.0.1:5000/api</dd></div>
              <div><dt>Cơ sở dữ liệu</dt><dd>SQL Server · SmartParking (truy cập qua backend)</dd></div>
              <div><dt>Trạng thái backend</dt><dd>{connected ? 'Đã lấy danh sách vé thành công' : 'Chưa xác minh được qua React'}</dd></div>
            </dl>
          </section>
        )}

        <footer className="footer"><span>Smart Parking System</span><span>React · Python OCR · .NET API · SQL Server</span></footer>
      </main>
    </div>
  )
}

export default App
