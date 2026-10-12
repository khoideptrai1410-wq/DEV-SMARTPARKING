"""Experimental YOLOv12 + PaddleOCR license-plate pipeline.

This module is separate from plate_ocr.py so the current
RapidOCR/EasyOCR/Tesseract implementation remains untouched.

Expected detector weights: a YOLOv12 model trained/fine-tuned to detect
Vietnamese license plates. Configure SMARTPARKING_YOLO_PLATE_MODEL.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from src.vision.plate_ocr import is_valid_vn_plate, normalize_plate
from src.vision.preprocess import ImageInput, load_image, resize_max


class ExperimentalPlateRecognizer:
    """YOLOv12 plate detector followed by PaddleOCR recognition."""

    def __init__(
        self,
        model_path: str | None = None,
        device: str | None = None,
        image_size: int = 960,
        confidence_threshold: float = 0.20,
    ) -> None:
        self.model_path = Path(
            model_path
            or os.getenv(
                "SMARTPARKING_YOLO_PLATE_MODEL",
                "models/plate_detection/yolov12n_plate.pt",
            )
        )
        self.device = device or os.getenv("SMARTPARKING_YOLO_DEVICE")
        self.image_size = int(image_size)
        self.confidence_threshold = float(confidence_threshold)
        self._detector = None
        self._ocr = None

    def _load_models(self) -> None:
        if self._detector is None:
            if not self.model_path.is_file():
                raise FileNotFoundError(
                    "Không tìm thấy weights YOLOv12 phát hiện biển số: "
                    f"{self.model_path}. Cần model đã train/fine-tune cho "
                    "biển số Việt Nam; weights COCO mặc định không đủ. "
                    "Đặt SMARTPARKING_YOLO_PLATE_MODEL tới file .pt."
                )
            try:
                from ultralytics import YOLO
            except ImportError as exc:
                raise RuntimeError(
                    "Chưa cài implementation YOLOv12. Xem hướng dẫn trong "
                    "docs/YOLOV12_PADDLEOCR_EXPERIMENT.md."
                ) from exc
            self._detector = YOLO(str(self.model_path))

        if self._ocr is None:
            try:
                from paddleocr import PaddleOCR
            except ImportError as exc:
                raise RuntimeError(
                    "Chưa cài PaddleOCR trong môi trường thử nghiệm. "
                    "Xem docs/YOLOV12_PADDLEOCR_EXPERIMENT.md."
                ) from exc
            self._ocr = PaddleOCR(
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )

    @staticmethod
    def _result_payload(item: Any) -> Any:
        payload = getattr(item, "json", None)
        if callable(payload):
            try:
                payload = payload()
            except TypeError:
                payload = None
        if payload is not None:
            if isinstance(payload, str):
                import json
                try:
                    return json.loads(payload)
                except json.JSONDecodeError:
                    pass
            return payload
        return item

    @classmethod
    def _extract_texts(cls, output: Any) -> list[tuple[str, float]]:
        """Extract PaddleOCR 3.x text/confidence; tolerate nested wrappers."""
        items: list[tuple[str, float]] = []

        def walk(value: Any) -> None:
            value = cls._result_payload(value)
            if isinstance(value, dict):
                if "res" in value:
                    walk(value["res"])
                    return
                texts = value.get("rec_texts")
                scores = value.get("rec_scores") or []
                if isinstance(texts, (list, tuple)):
                    for i, text in enumerate(texts):
                        score = 0.0
                        if isinstance(scores, (list, tuple)) and i < len(scores):
                            try:
                                score = float(scores[i])
                            except (TypeError, ValueError):
                                score = 0.0
                        text = str(text).strip()
                        if text:
                            items.append((text, score))
                    return
                for nested in value.values():
                    if isinstance(nested, (dict, list, tuple)):
                        walk(nested)
            elif isinstance(value, (list, tuple)):
                # PaddleOCR 2.x-style [box, (text, score)] output.
                for row in value:
                    if (
                        isinstance(row, (list, tuple))
                        and len(row) >= 2
                        and isinstance(row[1], (list, tuple))
                        and len(row[1]) >= 2
                        and isinstance(row[1][0], str)
                    ):
                        try:
                            score = float(row[1][1])
                        except (TypeError, ValueError):
                            score = 0.0
                        items.append((row[1][0].strip(), score))
                    else:
                        walk(row)

        walk(output)
        deduplicated: list[tuple[str, float]] = []
        seen: set[tuple[str, float]] = set()
        for pair in items:
            if pair not in seen:
                seen.add(pair)
                deduplicated.append(pair)
        return deduplicated

    def recognize(self, source: ImageInput) -> dict[str, Any]:
        self._load_models()
        image = resize_max(load_image(source), 1920)
        kwargs: dict[str, Any] = {
            "source": image,
            "imgsz": self.image_size,
            "conf": self.confidence_threshold,
            "verbose": False,
        }
        if self.device:
            kwargs["device"] = self.device

        predictions = self._detector.predict(**kwargs)
        if not predictions:
            return self._empty_result("YOLOv12 không trả kết quả.")

        result = predictions[0]
        boxes = getattr(result, "boxes", None)
        if boxes is None or len(boxes) == 0:
            return self._empty_result("YOLOv12 không tìm thấy vùng biển số.")

        h, w = image.shape[:2]
        candidates: list[tuple[float, list[int]]] = []
        for box in boxes:
            try:
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                score = float(box.conf[0].item())
            except (AttributeError, TypeError, ValueError, IndexError):
                continue
            x1, y1 = max(0, min(w - 1, x1)), max(0, min(h - 1, y1))
            x2, y2 = max(x1 + 1, min(w, x2)), max(y1 + 1, min(h, y2))
            if x2 > x1 and y2 > y1:
                candidates.append((score, [x1, y1, x2 - x1, y2 - y1]))

        if not candidates:
            return self._empty_result("YOLOv12 không trả bounding box hợp lệ.")

        det_conf, bbox = max(candidates, key=lambda item: item[0])
        x, y, bw, bh = bbox
        pad_x, pad_y = int(bw * 0.06), int(bh * 0.12)
        x0, y0 = max(0, x - pad_x), max(0, y - pad_y)
        x1, y1 = min(w, x + bw + pad_x), min(h, y + bh + pad_y)
        crop = image[y0:y1, x0:x1]

        # OCR runs on the detected plate crop, not the entire scene.
        ocr_output = self._ocr.predict(crop)
        text_items = self._extract_texts(ocr_output)
        raw_text = "".join(text for text, _ in text_items)
        plate = normalize_plate(raw_text)
        ocr_conf = (
            sum(score for _, score in text_items) / len(text_items)
            if text_items else 0.0
        )
        return {
            "plate": plate,
            "raw_candidates": text_items,
            "confidence": float(ocr_conf),
            "detector_confidence": float(det_conf),
            "valid": is_valid_vn_plate(plate),
            "engine": "yolov12-paddleocr",
            "bbox": [x0, y0, x1 - x0, y1 - y0],
        }

    @staticmethod
    def _empty_result(message: str) -> dict[str, Any]:
        return {
            "plate": "",
            "confidence": 0.0,
            "valid": False,
            "engine": "yolov12-paddleocr",
            "message": message,
            "bbox": None,
        }


_DEFAULT_RECOGNIZER: ExperimentalPlateRecognizer | None = None


def recognize_plate_yolov12_paddle(source: ImageInput) -> dict[str, Any]:
    """Convenience wrapper; models are initialized once per process."""
    global _DEFAULT_RECOGNIZER
    if _DEFAULT_RECOGNIZER is None:
        _DEFAULT_RECOGNIZER = ExperimentalPlateRecognizer()
    return _DEFAULT_RECOGNIZER.recognize(source)
