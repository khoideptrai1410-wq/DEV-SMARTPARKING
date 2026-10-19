export type RecognitionResult = {
  success: boolean
  plate: string
  is_valid_plate?: boolean
  message: string
  source?: 'Camera' | 'Upload' | string
  detected_at?: string
  detection_confidence?: number | null
  ocr_confidence?: number | null
  processing_time_ms?: number
  annotated_image_base64?: string
}

export type RecognitionRecord = {
  recognitionId: number
  plateText: string
  recognizedAt: string
  sourceType: 'Camera' | 'Upload' | string
  detectionConfidence?: number | null
  ocrConfidence?: number | null
}

export type AiHealth = {
  service: string
  model: string
  model_path: string
  model_configured: boolean
  ready: boolean
  message: string
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  let body: unknown = {}

  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = { message: raw }
    }
  }

  if (!response.ok) {
    const data = body as { message?: string; title?: string; detail?: string }
    const message = data.message || data.title || data.detail || ('Yêu cầu thất bại (HTTP ' + response.status + ').')
    throw new Error(message)
  }

  return body as T
}

export async function fetchAiHealth(): Promise<AiHealth> {
  return parseResponse<AiHealth>(
    await fetch('/ai-api/health', { headers: { Accept: 'application/json' } }),
  )
}

export async function recognizeImage(image: Blob, source: 'Camera' | 'Upload'): Promise<RecognitionResult> {
  const form = new FormData()
  form.append('image', image, 'recognition.jpg')

  return parseResponse<RecognitionResult>(
    await fetch('/ai-api/recognize?source=' + encodeURIComponent(source), {
      method: 'POST',
      body: form,
    }),
  )
}

export async function saveRecognition(
  result: RecognitionResult,
  sourceType: 'Camera' | 'Upload',
): Promise<RecognitionRecord> {
  return parseResponse<RecognitionRecord>(
    await fetch('/backend-api/recognitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        plateText: result.plate,
        sourceType,
        detectionConfidence: result.detection_confidence ?? null,
        ocrConfidence: result.ocr_confidence ?? null,
      }),
    }),
  )
}

export async function fetchRecognitionHistory(take = 50): Promise<RecognitionRecord[]> {
  const result = await parseResponse<unknown>(
    await fetch('/backend-api/recognitions?take=' + encodeURIComponent(String(take)), {
      headers: { Accept: 'application/json' },
    }),
  )
  if (!Array.isArray(result)) throw new Error('Dữ liệu lịch sử nhận diện không đúng định dạng.')
  return result as RecognitionRecord[]
}
