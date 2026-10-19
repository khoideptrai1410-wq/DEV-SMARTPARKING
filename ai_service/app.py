"""YOLOv12 + PaddleOCR local service for vehicle license plates."""
from __future__ import annotations

import base64
import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from flask import Flask, jsonify, request
from paddleocr import PaddleOCR
from ultralytics import YOLO

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = ROOT_DIR / "models" / "vision" / "yolo12n_plate.pt"
MODEL_PATH = Path(os.getenv("LICENSE_PLATE_MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser()
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_SIDE = 1600
YOLO_CONFIDENCE = float(os.getenv("YOLO_PLATE_CONFIDENCE", "0.20"))

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES
_yolo: YOLO | None = None
_ocr: Any = None
_model_lock = threading.Lock()
_ocr_lock = threading.Lock()


class ModelNotReadyError(RuntimeError):
    """The trained license-plate detector is missing or incompatible."""


def _get_yolo() -> YOLO:
    global _yolo
    if _yolo is not None:
        return _yolo
    with _model_lock:
        if _yolo is not None:
            return _yolo
        if not MODEL_PATH.is_file():
            raise ModelNotReadyError(
                "Chưa tìm thấy trọng số YOLOv12 đã huấn luyện phát hiện biển số. "
                f"Hãy đặt file tại {MODEL_PATH} hoặc cấu hình LICENSE_PLATE_MODEL_PATH. "
                "Không dùng yolo12n.pt COCO nguyên bản làm bộ phát hiện biển số."
            )
        model = YOLO(str(MODEL_PATH))
        names = model.names
        name_values = list(names.values()) if isinstance(names, dict) else list(names)
        if not any(("plate" in str(name).lower()) or ("bien" in str(name).lower()) for name in name_values):
            raise ModelNotReadyError(
                "Checkpoint YOLOv12 không có lớp tên chứa 'plate' hoặc 'bien'. "
                "Hãy huấn luyện/tinh chỉnh mô hình với lớp license_plate rồi cấu hình lại trọng số."
            )
        _yolo = model
        return _yolo


def _get_ocr() -> Any:
    global _ocr
    if _ocr is not None:
        return _ocr
    with _ocr_lock:
        if _ocr is not None:
            return _ocr
        try:
            _ocr = PaddleOCR(
                lang="en",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        except TypeError:
            _ocr = PaddleOCR(lang="en", use_angle_cls=False, show_log=False)
        return _ocr


def _normalize_plate(raw: str | None) -> str:
    if not raw:
        return ""
    text = re.sub(r"[^A-Z0-9]", "", str(raw).upper())
    if len(text) < 6:
        return ""
    chars = list(text)
    digit_fix = {"O": "0", "D": "0", "Q": "0", "I": "1", "L": "1"}
    for index in range(min(2, len(chars))):
        chars[index] = digit_fix.get(chars[index], chars[index])
    tail = 0
    for char in reversed(chars):
        if char.isdigit():
            tail += 1
        else:
            break
    tail = min(tail, 6)
    serial_end = len(chars) - tail
    letter_fix = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B"}
    if serial_end > 2:
        for index in range(2, serial_end):
            chars[index] = letter_fix.get(chars[index], chars[index])
    for index in range(max(2, serial_end), len(chars)):
        chars[index] = digit_fix.get(chars[index], chars[index])
    return "".join(chars)


def _is_vietnamese_plate(plate: str) -> bool:
    return bool(re.fullmatch(r"\d{2}[A-Z]{1,3}\d{4,6}", plate))


def _parse_ocr_output(raw: Any) -> list[tuple[str, float]]:
    """Extract recognized text and confidence from PaddleOCR 2.x/3.x results."""
    found: list[tuple[str, float]] = []

    def walk(value: Any) -> None:
        if value is None:
            return
        if hasattr(value, "json"):
            payload = getattr(value, "json")
            if callable(payload):
                payload = payload()
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except json.JSONDecodeError:
                    payload = None
            if payload is not None and payload is not value:
                walk(payload)
                return
        if isinstance(value, dict):
            if isinstance(value.get("res"), dict):
                walk(value["res"])
                return
            texts = value.get("rec_texts")
            if isinstance(texts, (list, tuple)):
                scores = value.get("rec_scores") or []
                for index, text in enumerate(texts):
                    score = scores[index] if index < len(scores) else 0.0
                    try:
                        score = float(score)
                    except (TypeError, ValueError):
                        score = 0.0
                    if str(text).strip():
                        found.append((str(text).strip(), score))
                return
            text = value.get("text") or value.get("txt")
            if text:
                try:
                    score = float(value.get("score") or 0.0)
                except (TypeError, ValueError):
                    score = 0.0
                found.append((str(text).strip(), score))
            return
        if isinstance(value, (list, tuple)):
            # PaddleOCR 2.x row: [box, (recognized_text, score)].
            if len(value) >= 2 and isinstance(value[1], (list, tuple)) and value[1]:
                second = value[1]
                if isinstance(second[0], str):
                    try:
                        score = float(second[1]) if len(second) > 1 else 0.0
                    except (TypeError, ValueError):
                        score = 0.0
                    found.append((second[0].strip(), score))
                    return
            for child in value:
                walk(child)

    walk(raw)
    return found


def _recognize_text(crop: np.ndarray) -> list[tuple[str, float]]:
    engine = _get_ocr()
    try:
        raw = engine.predict(input=crop)
    except (AttributeError, TypeError):
        raw = engine.ocr(crop, cls=False)
    return _parse_ocr_output(raw)


def _jpeg_base64(image: np.ndarray) -> str:
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
    return base64.b64encode(encoded.tobytes()).decode("ascii") if ok else ""


def _resize_image(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= MAX_IMAGE_SIDE:
        return image
    ratio = MAX_IMAGE_SIDE / float(longest)
    return cv2.resize(
        image,
        (max(1, int(width * ratio)), max(1, int(height * ratio))),
        interpolation=cv2.INTER_AREA,
    )


def _run_recognition(image: np.ndarray, source: str) -> dict[str, Any]:
    image = _resize_image(image)
    detector = _get_yolo()
    started = datetime.now(timezone.utc)
    predictions = detector.predict(
        source=image, imgsz=960, conf=YOLO_CONFIDENCE, iou=0.45, verbose=False
    )
    prediction = predictions[0]
    boxes = getattr(prediction, "boxes", None)
    annotated = image.copy()
    candidates: list[dict[str, Any]] = []

    if boxes is not None and len(boxes) > 0:
        coordinates = boxes.xyxy.cpu().numpy().astype(int)
        detection_scores = boxes.conf.cpu().numpy().tolist()
        height, width = image.shape[:2]
        for index, (x1, y1, x2, y2) in enumerate(coordinates):
            x1 = max(0, min(width - 1, int(x1)))
            y1 = max(0, min(height - 1, int(y1)))
            x2 = max(x1 + 1, min(width, int(x2)))
            y2 = max(y1 + 1, min(height, int(y2)))
            pad_x = max(2, int((x2 - x1) * 0.025))
            pad_y = max(2, int((y2 - y1) * 0.08))
            cx1, cy1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
            cx2, cy2 = min(width, x2 + pad_x), min(height, y2 + pad_y)
            crop = image[cy1:cy2, cx1:cx2]
            if crop.size == 0:
                continue
            for raw_text, ocr_score in _recognize_text(crop):
                plate = _normalize_plate(raw_text)
                if len(plate) < 6:
                    continue
                candidates.append({
                    "plate": plate,
                    "detection_confidence": float(detection_scores[index]),
                    "ocr_confidence": max(0.0, min(1.0, float(ocr_score))),
                    "is_valid_plate": _is_vietnamese_plate(plate),
                    "rank": (1 if _is_vietnamese_plate(plate) else 0, float(ocr_score), float(detection_scores[index])),
                    "box": [x1, y1, x2 - x1, y2 - y1],
                })
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (22, 163, 126), 2)

    best = max(candidates, key=lambda item: item["rank"]) if candidates else None
    if best:
        x, y, box_width, box_height = best["box"]
        cv2.rectangle(annotated, (x, y), (x + box_width, y + box_height), (22, 163, 126), 3)
        cv2.putText(
            annotated, best["plate"], (x, max(22, y - 8)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (22, 163, 126), 2, cv2.LINE_AA,
        )

    plate = best["plate"] if best else ""
    return {
        "success": bool(plate),
        "plate": plate,
        "is_valid_plate": bool(best and best["is_valid_plate"]),
        "message": ("Biển số nhận diện được là: " + plate) if plate else "Chưa phát hiện hoặc chưa đọc rõ biển số trong ảnh.",
        "source": source,
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "detection_confidence": best["detection_confidence"] if best else None,
        "ocr_confidence": best["ocr_confidence"] if best else None,
        "processing_time_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
        "annotated_image_base64": _jpeg_base64(annotated),
    }


@app.get("/health")
def health():
    try:
        _get_yolo()
        ready = True
        message = "Đã tải được checkpoint YOLOv12 có lớp phát hiện biển số."
    except Exception as exc:
        ready = False
        message = str(exc) or "Không thể tải checkpoint YOLOv12."
    return jsonify({
        "service": "license-plate-ai",
        "model": "YOLOv12 + PaddleOCR",
        "model_path": str(MODEL_PATH),
        "model_configured": ready,
        "ready": ready,
        "message": message,
    }), (200 if ready else 503)


@app.post("/recognize")
def recognize():
    uploaded = request.files.get("image")
    if uploaded is None or not uploaded.filename:
        return jsonify({"success": False, "message": "Vui lòng chọn ảnh hoặc gửi một khung hình camera."}), 400
    raw_bytes = uploaded.read()
    if not raw_bytes:
        return jsonify({"success": False, "message": "Tệp ảnh trống."}), 400
    if len(raw_bytes) > MAX_IMAGE_BYTES:
        return jsonify({"success": False, "message": "Ảnh vượt quá giới hạn 8 MB."}), 413

    image = cv2.imdecode(np.frombuffer(raw_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return jsonify({"success": False, "message": "Tệp gửi lên không phải ảnh được hỗ trợ."}), 400
    source = request.args.get("source", "Upload").strip().title()
    if source not in {"Camera", "Upload"}:
        source = "Upload"

    try:
        return jsonify(_run_recognition(image, source))
    except ModelNotReadyError as exc:
        return jsonify({"success": False, "message": str(exc)}), 503
    except Exception as exc:
        app.logger.exception("License-plate recognition failed")
        return jsonify({
            "success": False,
            "message": "Dịch vụ nhận diện gặp lỗi. Kiểm tra trọng số YOLOv12 và cài đặt PaddleOCR.",
            "detail": str(exc),
        }), 500


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"success": False, "message": "Ảnh vượt quá giới hạn 8 MB."}), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("AI_PORT", "5001")), debug=False, threaded=True)
