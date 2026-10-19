"""Fine-tune YOLOv12 for license-plate detection."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_MODEL = ROOT_DIR / "models" / "vision" / "yolo12n_plate.pt"


def main() -> None:
    parser = argparse.ArgumentParser(description="Huấn luyện YOLOv12 phát hiện biển số xe.")
    parser.add_argument("--data", required=True, help="Đường dẫn đến file data.yaml đã gán nhãn bounding box.")
    parser.add_argument("--weights", default="yolo12n.pt", help="Checkpoint khởi tạo YOLOv12.")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    args = parser.parse_args()

    model = YOLO(args.weights)
    trained = model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=str(ROOT_DIR / "runs" / "detect"),
        name="yolo12-license-plate",
        patience=20,
    )
    best_model = Path(trained.save_dir) / "weights" / "best.pt"
    if not best_model.is_file():
        raise FileNotFoundError(f"Không tìm thấy trọng số tốt nhất tại {best_model}")

    OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_model, OUTPUT_MODEL)
    print(f"Đã sao chép mô hình tốt nhất đến: {OUTPUT_MODEL}")
    print("Hãy kiểm tra mAP, precision và recall trên tập validation trước khi dùng thực tế.")


if __name__ == "__main__":
    main()
