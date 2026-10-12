"""Benchmark the current OCR pipeline against experimental YOLOv12 + PaddleOCR.

Optional labels CSV format:
image,plate
plate_001.jpg,59B112345
"""

from __future__ import annotations

import argparse
import csv
import statistics
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

SUPPORTED = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def load_labels(path: Path | None) -> dict[str, str]:
    labels: dict[str, str] = {}
    if path is None:
        return labels
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or "image" not in reader.fieldnames or "plate" not in reader.fieldnames:
            raise ValueError("File nhãn phải có header: image,plate")
        for row in reader:
            image_name = (row.get("image") or "").strip()
            plate = (row.get("plate") or "").strip().upper()
            if image_name and plate:
                labels[Path(image_name).name] = plate
    return labels


def percentile(values: list[float], percent: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = round((len(ordered) - 1) * percent / 100.0)
    return ordered[index]


def run_recognizer(recognize: Any, image_path: Path) -> tuple[dict[str, Any], float]:
    started = time.perf_counter()
    result = recognize(str(image_path))
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    return result, elapsed_ms


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Folder of evaluation images shared by both pipelines.")
    parser.add_argument("--labels", help="Optional CSV with columns image,plate; enables exact-plate accuracy.")
    parser.add_argument("--output", default="outputs/plate_ocr_benchmark.csv", help="Output CSV path.")
    parser.add_argument(
        "--pipelines",
        choices=("both", "legacy", "yolo-paddle"),
        default="both",
        help="Which pipeline(s) to run.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    if not input_dir.is_dir():
        parser.error(f"Input folder does not exist: {input_dir}")
    images = sorted(
        p for p in input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED
    )
    if not images:
        parser.error(f"No supported images found in {input_dir}")

    labels = load_labels(Path(args.labels).resolve() if args.labels else None)

    from src.vision.plate_ocr import normalize_plate, recognize_plate
    from src.vision.plate_ocr_yolov12_paddle import recognize_plate_yolov12_paddle

    pipelines: list[tuple[str, Any]] = []
    if args.pipelines in ("both", "legacy"):
        pipelines.append(("legacy_rapidocr_fallbacks", recognize_plate))
    if args.pipelines in ("both", "yolo-paddle"):
        pipelines.append(("yolov12_paddleocr", recognize_plate_yolov12_paddle))

    rows: list[dict[str, Any]] = []
    for pipeline_name, recognize in pipelines:
        print(f"\n=== {pipeline_name} ===")

        # Warm up separately so lazy model loading does not distort per-image latency.
        warm_start = time.perf_counter()
        try:
            recognize(str(images[0]))
        except Exception as exc:
            print(f"Pipeline không khởi động được: {type(exc).__name__}: {exc}")
            print("Pipeline này được bỏ qua; xem docs/YOLOV12_PADDLEOCR_EXPERIMENT.md.")
            continue
        warmup_ms = (time.perf_counter() - warm_start) * 1000.0
        print(f"Warm-up / khởi tạo: {warmup_ms:.1f} ms")

        pipeline_rows: list[dict[str, Any]] = []
        for image_path in images:
            try:
                result, elapsed_ms = run_recognizer(recognize, image_path)
                plate = str(result.get("plate") or "").strip().upper()
                try:
                    confidence = float(result.get("confidence") or 0.0)
                except (TypeError, ValueError):
                    confidence = 0.0
                truth = labels.get(image_path.name, "")
                exact_match = ""
                if truth:
                    exact_match = str(normalize_plate(plate) == normalize_plate(truth)).lower()

                row = {
                    "image": image_path.name,
                    "pipeline": pipeline_name,
                    "plate_predicted": plate,
                    "plate_ground_truth": truth,
                    "exact_match": exact_match,
                    "valid": str(bool(result.get("valid", False))).lower(),
                    "confidence": confidence,
                    "latency_ms": round(elapsed_ms, 3),
                    "engine": str(result.get("engine") or ""),
                    "error": "",
                }
            except Exception as exc:
                truth = labels.get(image_path.name, "")
                row = {
                    "image": image_path.name,
                    "pipeline": pipeline_name,
                    "plate_predicted": "",
                    "plate_ground_truth": truth,
                    "exact_match": "false" if truth else "",
                    "valid": "false",
                    "confidence": 0.0,
                    "latency_ms": "",
                    "engine": "",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            pipeline_rows.append(row)
            rows.append(row)

        measured = [r for r in pipeline_rows if r["latency_ms"] != ""]
        times = [float(r["latency_ms"]) for r in measured]
        valid_rate = (
            sum(r["valid"] == "true" for r in measured) / len(measured) * 100.0
            if measured else 0.0
        )
        exact_rows = [r for r in measured if r["exact_match"] != ""]
        exact_rate = (
            sum(r["exact_match"] == "true" for r in exact_rows) / len(exact_rows) * 100.0
            if exact_rows else None
        )
        print(f"Ảnh đo được: {len(measured)}/{len(images)}")
        print(f"Latency trung bình: {statistics.mean(times):.2f} ms" if times else "Latency trung bình: N/A")
        print(f"Latency median: {statistics.median(times):.2f} ms" if times else "Latency median: N/A")
        p95 = percentile(times, 95)
        print(f"Latency P95: {p95:.2f} ms" if p95 is not None else "Latency P95: N/A")
        print(f"Tỷ lệ output đúng format: {valid_rate:.1f}%")
        print(f"Exact-plate accuracy: {exact_rate:.1f}%" if exact_rate is not None else "Exact-plate accuracy: N/A (chưa có labels CSV)")

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "image", "pipeline", "plate_predicted", "plate_ground_truth",
        "exact_match", "valid", "confidence", "latency_ms", "engine", "error",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nKết quả chi tiết: {output_path}")
    if not labels:
        print("Muốn đo accuracy thực, tạo labels CSV với cột image,plate.")
    print("Latency đo xử lý ảnh có sẵn sau warm-up; chưa gồm camera, mạng, Flask, .NET, SQL Server hoặc React.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
