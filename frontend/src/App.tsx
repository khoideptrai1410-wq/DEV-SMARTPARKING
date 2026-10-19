import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import {
  fetchAiHealth,
  fetchRecognitionHistory,
  recognizeImage,
  saveRecognition,
} from './api'
import type { AiHealth, RecognitionRecord, RecognitionResult } from './api'

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function percent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return Math.round(value * 100) + '%'
}

function resultImage(result: RecognitionResult | null) {
  if (!result?.annotated_image_base64) return ''
  return 'data:image/jpeg;base64,' + result.annotated_image_base64
}

function App() {
  const [aiHealth, setAiHealth] = useState<AiHealth | null>(null)
  const [healthMessage, setHealthMessage] = useState('Đang kiểm tra dịch vụ AI…')
  const [cameraRunning, setCameraRunning] = useState(false)
  const [cameraStatus, setCameraStatus] = useState('Bật camera để bắt đầu nhận diện.')
  const [cameraResult, setCameraResult] = useState<RecognitionResult | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [uploadPreview, setUploadPreview] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadResult, setUploadResult] = useState<RecognitionResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [history, setHistory] = useState<RecognitionRecord[]>([])
  const [historyError, setHistoryError] = useState('')
  const [historyBusy, setHistoryBusy] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanBusyRef = useRef(false)
  const stableRef = useRef({ plate: '', count: 0 })
  const savedPlateRef = useRef('')
  const missingPlateCountRef = useRef(0)

  async function refreshHistory() {
    setHistoryBusy(true)
    setHistoryError('')
    try {
      setHistory(await fetchRecognitionHistory(50))
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Không thể tải lịch sử từ SQL Server.')
    } finally {
      setHistoryBusy(false)
    }
  }

  async function persistResult(result: RecognitionResult, sourceType: 'Camera' | 'Upload') {
    if (!result.plate) return false
    try {
      const saved = await saveRecognition(result, sourceType)
      setHistory((current) => [saved, ...current.filter((row) => row.recognitionId !== saved.recognitionId)].slice(0, 50))
      setHistoryError('')
      return true
    } catch (error) {
      setHistoryError('Đã nhận diện được biển số nhưng chưa lưu được vào SQL Server: ' +
        (error instanceof Error ? error.message : 'Lỗi kết nối database.'))
      return false
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchAiHealth()
      .then((status) => {
        if (cancelled) return
        setAiHealth(status)
        setHealthMessage(status.message)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAiHealth(null)
          setHealthMessage(error instanceof Error ? error.message : 'Không thể kết nối dịch vụ AI.')
        }
      })
    void refreshHistory()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    if (!uploadPreview.startsWith('blob:')) return
    return () => URL.revokeObjectURL(uploadPreview)
  }, [uploadPreview])

  useEffect(() => {
    if (!cameraRunning) return

    const processFrame = async () => {
      if (scanBusyRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return

      scanBusyRef.current = true
      try {
        canvas.width = Math.min(video.videoWidth, 1280)
        canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth)
        const context = canvas.getContext('2d')
        if (!context) return
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
        if (!blob) return

        const result = await recognizeImage(blob, 'Camera')
        setCameraResult(result)
        if (!result.plate) {
          missingPlateCountRef.current += 1
          if (missingPlateCountRef.current >= 3) {
            stableRef.current = { plate: '', count: 0 }
            savedPlateRef.current = ''
          }
          setCameraStatus(result.message || 'Đang tìm biển số trong khung hình…')
          return
        }

        missingPlateCountRef.current = 0
        if (stableRef.current.plate === result.plate) {
          stableRef.current.count += 1
        } else {
          stableRef.current = { plate: result.plate, count: 1 }
        }

        if (stableRef.current.count >= 2 && savedPlateRef.current !== result.plate) {
          savedPlateRef.current = result.plate
          setCameraStatus('Đã nhận diện ổn định: ' + result.plate + '. Đang lưu lịch sử…')
          const saved = await persistResult(result, 'Camera')
          if (!saved) savedPlateRef.current = ''
          setCameraStatus('Biển số nhận diện được là: ' + result.plate)
        } else {
          setCameraStatus('Biển số nhận diện được là: ' + result.plate)
        }
      } catch (error) {
        setCameraStatus(error instanceof Error ? error.message : 'Không thể xử lý khung hình camera.')
      } finally {
        scanBusyRef.current = false
      }
    }

    const timer = window.setInterval(() => { void processFrame() }, 1200)
    return () => window.clearInterval(timer)
  }, [cameraRunning])

  async function startCamera() {
    setCameraError('')
    setCameraStatus('Đang xin quyền truy cập camera…')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ camera. Hãy mở bằng localhost hoặc HTTPS.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      stableRef.current = { plate: '', count: 0 }
      savedPlateRef.current = ''
      missingPlateCountRef.current = 0
      setCameraRunning(true)
      setCameraStatus('Camera đã bật. Đang nhận diện theo thời gian thực…')
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Không thể mở camera. Kiểm tra quyền truy cập thiết bị.')
      setCameraStatus('Camera chưa bật.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraRunning(false)
    setCameraStatus('Camera đã dừng.')
  }

  async function onSelectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn file ảnh.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Ảnh phải nhỏ hơn hoặc bằng 8 MB.')
      return
    }

    setUploadName(file.name)
    setUploadPreview(URL.createObjectURL(file))
    setUploadBusy(true)
    setUploadError('')
    setUploadResult(null)
    try {
      const result = await recognizeImage(file, 'Upload')
      setUploadResult(result)
      if (result.plate) {
        await persistResult(result, 'Upload')
      } else {
        setUploadError(result.message || 'Không đọc được biển số. Thử ảnh rõ nét hơn.')
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Không thể nhận diện ảnh.')
    } finally {
      setUploadBusy(false)
    }
  }

  const modelConfigured = Boolean(aiHealth?.model_configured)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Trang nhận diện biển số">
          <span className="brand-mark">LP</span>
          <span>
            <strong>PlateSight</strong>
            <small>Hệ thống nhận diện biển số xe</small>
          </span>
        </a>
        <div className="technology-tags">
          <span>YOLOv12</span>
          <span>PaddleOCR</span>
          <span>SQL Server</span>
        </div>
      </header>

      <main id="top" className="page-content">
        <section className="intro">
          <div className="eyebrow"><span className="status-dot" /> COMPUTER VISION · OCR</div>
          <h1>Nhận diện biển số xe</h1>
          <p>Nhận diện từ camera trực tiếp hoặc tải ảnh lên. Hai chế độ sử dụng chung pipeline YOLOv12 và PaddleOCR.</p>
        </section>

        <section className={modelConfigured ? 'system-status system-status-ready' : 'system-status system-status-warning'} aria-live="polite">
          <span className="status-indicator" />
          <div>
            <strong>{modelConfigured ? 'Dịch vụ AI đã được cấu hình' : 'Cần cấu hình mô hình AI'}</strong>
            <p>{healthMessage}</p>
          </div>
          <button className="text-button" onClick={() => {
            fetchAiHealth().then((status) => {
              setAiHealth(status)
              setHealthMessage(status.message)
            }).catch((error: unknown) => {
              setAiHealth(null)
              setHealthMessage(error instanceof Error ? error.message : 'Không kết nối được AI service.')
            })
          }}>Kiểm tra lại</button>
        </section>

        <section className="recognition-grid" aria-label="Hai cách nhận diện biển số">
          <article className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-index">01</span>
                <div><h2>Nhận diện qua camera</h2><p>Quét khung hình tự động</p></div>
              </div>
              <span className={cameraRunning ? 'live-pill live-pill-on' : 'live-pill'}><span />{cameraRunning ? 'LIVE' : 'OFFLINE'}</span>
            </div>

            <div className="video-frame">
              <video ref={videoRef} className={cameraRunning ? 'camera-video camera-video-on' : 'camera-video'} autoPlay muted playsInline />
              {!cameraRunning && (
                <div className="video-placeholder">
                  <span className="camera-glyph">CAM</span>
                  <strong>Camera chưa được bật</strong>
                  <p>Cho phép trình duyệt truy cập camera để bắt đầu.</p>
                </div>
              )}
              {cameraRunning && <div className="scan-frame" aria-hidden="true"><i /><i /><i /><i /></div>}
              <canvas ref={canvasRef} className="hidden-canvas" />
            </div>

            <div className="panel-actions">
              {!cameraRunning
                ? <button className="primary-button" onClick={() => { void startCamera() }}>Bật camera</button>
                : <button className="secondary-button" onClick={stopCamera}>Dừng camera</button>}
              <span className="helper-text">Tự xử lý một khung hình mỗi khoảng 1,2 giây.</span>
            </div>
            {cameraError && <div className="inline-error" role="alert">{cameraError}</div>}
            <div className="result-box" aria-live="polite">
              <div className="result-label">KẾT QUẢ NHẬN DIỆN</div>
              {cameraResult?.plate
                ? <><p className="result-prompt">Biển số nhận diện được là</p><div className="plate-value">{cameraResult.plate}</div><div className="result-meta">YOLO: {percent(cameraResult.detection_confidence)} <span /> OCR: {percent(cameraResult.ocr_confidence)}</div></>
                : <p className="result-empty">{cameraStatus}</p>}
            </div>
            <p className="camera-status">{cameraStatus}</p>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-index">02</span>
                <div><h2>Tải ảnh lên</h2><p>Chọn ảnh từ máy tính</p></div>
              </div>
              <span className="mode-pill">IMAGE OCR</span>
            </div>

            <label className="upload-zone">
              <input type="file" accept="image/*" onChange={(event) => { void onSelectImage(event) }} />
              <span className="upload-icon">↑</span>
              <strong>Chọn ảnh để nhận diện</strong>
              <span>Kéo ảnh vào đây hoặc bấm để chọn tệp</span>
              <small>PNG, JPG, WEBP · Tối đa 8 MB</small>
            </label>
            {uploadPreview && (
              <div className="preview-area">
                <div className="preview-heading"><span>{uploadName}</span>{uploadBusy && <span className="working-label">Đang xử lý…</span>}</div>
                <img src={resultImage(uploadResult) || uploadPreview} alt="Ảnh xem trước hoặc ảnh đã đánh dấu vùng biển số" />
              </div>
            )}
            {uploadError && <div className="inline-error" role="alert">{uploadError}</div>}
            <div className="result-box upload-result-box" aria-live="polite">
              <div className="result-label">KẾT QUẢ NHẬN DIỆN</div>
              {uploadResult?.plate
                ? <><p className="result-prompt">Biển số nhận diện được là</p><div className="plate-value">{uploadResult.plate}</div><div className="result-meta">YOLO: {percent(uploadResult.detection_confidence)} <span /> OCR: {percent(uploadResult.ocr_confidence)}</div></>
                : <p className="result-empty">{uploadBusy ? 'Đang chạy YOLOv12 và PaddleOCR…' : 'Kết quả sẽ xuất hiện tại đây sau khi chọn ảnh.'}</p>}
            </div>
          </article>
        </section>

        <section className="history-panel">
          <div className="history-header">
            <div><div className="eyebrow">SQL SERVER · RECOGNITION LOG</div><h2>Lịch sử nhận diện</h2><p>Lưu biển số và thời điểm nhận diện vào cơ sở dữ liệu.</p></div>
            <button className="secondary-button refresh-button" onClick={() => { void refreshHistory() }} disabled={historyBusy}>{historyBusy ? 'Đang tải…' : 'Làm mới'}</button>
          </div>
          {historyError && <div className="inline-error history-error" role="status">{historyError}</div>}
          <div className="table-container">
            <table className="history-table">
              <thead><tr><th>Biển số xe</th><th>Thời gian nhận diện</th><th>Nguồn đầu vào</th><th>Độ tin cậy YOLO</th><th>Độ tin cậy OCR</th></tr></thead>
              <tbody>
                {history.length === 0
                  ? <tr><td className="empty-cell" colSpan={5}>{historyBusy ? 'Đang tải lịch sử…' : 'Chưa có bản ghi. Khi AI nhận diện thành công, dữ liệu sẽ xuất hiện tại đây.'}</td></tr>
                  : history.map((record) => (
                    <tr key={record.recognitionId}>
                      <td><span className="plate-chip">{record.plateText}</span></td>
                      <td>{formatDateTime(record.recognizedAt)}</td>
                      <td><span className="source-chip">{record.sourceType === 'Camera' ? 'Camera' : 'Tải ảnh'}</span></td>
                      <td>{percent(record.detectionConfidence)}</td>
                      <td>{percent(record.ocrConfidence)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="history-footnote">Thời gian lưu theo UTC ở máy chủ và được hiển thị theo múi giờ trình duyệt.</div>
        </section>

        <footer className="page-footer">
          <span>PlateSight · YOLOv12 Object Detection + PaddleOCR Text Recognition</span>
          <span>ASP.NET Core Web API · SQL Server</span>
        </footer>
      </main>
    </div>
  )
}

export default App
