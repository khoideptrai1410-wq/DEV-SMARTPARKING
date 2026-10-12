"""Local OpenCV GUI to annotate full license plates with YOLO bounding boxes.

Drag with left mouse button: box around one whole visible plate.
S: save boxes and continue.
N: mark reviewed image with no visible plate (empty label).
U: undo the last box.
R: clear all boxes for this image.
X: reject/move image out of dataset.
Q or Esc: quit without saving current changes.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "data" / "datasets" / "plate_detection" / "inbox"
IMAGE_DIR = INBOX / "images"
LABEL_DIR = INBOX / "labels"
REJECT_DIR = INBOX / "rejected"
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_WIDTH = 1280
MAX_HEIGHT = 820
WINDOW = "SmartParking - YOLO plate annotation"


def label_path(image: Path) -> Path:
    return LABEL_DIR / f"{image.stem}.txt"


def load_boxes(image: Path, width: int, height: int) -> list[tuple[int, int, int, int]]:
    path = label_path(image)
    if not path.is_file():
        return []
    boxes = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        parts = line.strip().split()
        if len(parts) != 5:
            continue
        try:
            class_id = int(parts[0])
            xc, yc, bw, bh = map(float, parts[1:])
        except ValueError:
            continue
        if class_id != 0:
            continue
        x1 = round((xc - bw / 2) * width)
        y1 = round((yc - bh / 2) * height)
        x2 = round((xc + bw / 2) * width)
        y2 = round((yc + bh / 2) * height)
        boxes.append((max(0, x1), max(0, y1), min(width - 1, x2), min(height - 1, y2)))
    return boxes


def save_boxes(image: Path, boxes: list[tuple[int, int, int, int]], width: int, height: int) -> None:
    LABEL_DIR.mkdir(parents=True, exist_ok=True)
    lines = []
    for x1, y1, x2, y2 in boxes:
        x1, x2 = sorted((max(0, min(width - 1, x1)), max(0, min(width, x2))))
        y1, y2 = sorted((max(0, min(height - 1, y1)), max(0, min(height, y2))))
        bw, bh = x2 - x1, y2 - y1
        if bw < 2 or bh < 2:
            continue
        xc = (x1 + x2) / 2 / width
        yc = (y1 + y2) / 2 / height
        nw, nh = bw / width, bh / height
        lines.append(f"0 {xc:.6f} {yc:.6f} {nw:.6f} {nh:.6f}")
    label_path(image).write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def main() -> int:
    if not IMAGE_DIR.is_dir():
        print(f"Chưa có thư mục ảnh: {IMAGE_DIR}")
        print("Chạy trước: python scripts/prepare_plate_detection_dataset.py")
        return 1

    images = sorted(
        p for p in IMAGE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED
    )
    if not images:
        print("Không có ảnh để gán nhãn.")
        return 1

    cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
    state = {"start": None, "current": None, "boxes": [], "scale": 1.0, "image": None}
    index = 0

    def mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            state["start"] = (x, y)
            state["current"] = (x, y)
        elif event == cv2.EVENT_MOUSEMOVE and state["start"] is not None:
            state["current"] = (x, y)
        elif event == cv2.EVENT_LBUTTONUP and state["start"] is not None:
            sx, sy = state["start"]
            scale = state["scale"]
            original_h, original_w = state["image"].shape[:2]
            x1, x2 = sorted((round(sx / scale), round(x / scale)))
            y1, y2 = sorted((round(sy / scale), round(y / scale)))
            x1, x2 = max(0, min(original_w - 1, x1)), max(0, min(original_w, x2))
            y1, y2 = max(0, min(original_h - 1, y1)), max(0, min(original_h, y2))
            if x2 - x1 >= 3 and y2 - y1 >= 3:
                state["boxes"].append((x1, y1, x2, y2))
            state["start"] = None
            state["current"] = None

    cv2.setMouseCallback(WINDOW, mouse)

    while index < len(images):
        image_path = images[index]
        image = cv2.imread(str(image_path))
        if image is None:
            print(f"Không đọc được ảnh, bỏ qua: {image_path}")
            index += 1
            continue

        height, width = image.shape[:2]
        scale = min(1.0, MAX_WIDTH / width, MAX_HEIGHT / height)
        display_w = max(1, round(width * scale))
        display_h = max(1, round(height * scale))
        display_image = cv2.resize(image, (display_w, display_h)) if scale < 1 else image.copy()
        state["image"] = image
        state["scale"] = scale
        state["boxes"] = load_boxes(image_path, width, height)

        print(f"[{index + 1}/{len(images)}] {image_path.name} — kéo quanh từng biển số.")
        while True:
            frame = display_image.copy()
            for box_index, (x1, y1, x2, y2) in enumerate(state["boxes"], start=1):
                cv2.rectangle(
                    frame,
                    (round(x1 * scale), round(y1 * scale)),
                    (round(x2 * scale), round(y2 * scale)),
                    (0, 220, 0), 2,
                )
                cv2.putText(
                    frame, str(box_index),
                    (round(x1 * scale), max(18, round(y1 * scale) - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 220, 0), 2,
                )
            if state["start"] is not None and state["current"] is not None:
                cv2.rectangle(frame, state["start"], state["current"], (0, 165, 255), 2)
            cv2.putText(
                frame, f"{index + 1}/{len(images)}  {image_path.name}", (12, 24),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2,
            )
            cv2.putText(
                frame, "Drag bbox | S save | N no-plate | U undo | R clear | X reject | Q quit",
                (12, display_h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 2,
            )
            cv2.imshow(WINDOW, frame)
            key = cv2.waitKey(30) & 0xFF

            if key in (ord("q"), 27):
                cv2.destroyAllWindows()
                print("Đã thoát; thay đổi chưa lưu của ảnh hiện tại bị bỏ.")
                return 0
            if key == ord("u"):
                if state["boxes"]:
                    state["boxes"].pop()
            elif key == ord("r"):
                state["boxes"].clear()
            elif key == ord("s"):
                if not state["boxes"]:
                    print("Chưa có box. Nếu không thấy biển số rõ, nhấn N để xác nhận ảnh âm.")
                    continue
                save_boxes(image_path, state["boxes"], width, height)
                index += 1
                break
            elif key == ord("n"):
                if state["boxes"]:
                    print("Ảnh đang có box: nhấn S để lưu hoặc R để xóa box trước.")
                    continue
                LABEL_DIR.mkdir(parents=True, exist_ok=True)
                label_path(image_path).write_text("", encoding="utf-8")
                index += 1
                break
            elif key == ord("x"):
                (REJECT_DIR / "images").mkdir(parents=True, exist_ok=True)
                (REJECT_DIR / "labels").mkdir(parents=True, exist_ok=True)
                target = REJECT_DIR / "images" / image_path.name
                if target.exists():
                    target = REJECT_DIR / "images" / f"{index}_{image_path.name}"
                shutil.move(str(image_path), str(target))
                old_label = label_path(image_path)
                if old_label.exists():
                    shutil.move(str(old_label), str(REJECT_DIR / "labels" / old_label.name))
                print(f"Đã loại ảnh khỏi dataset: {target}")
                images.pop(index)
                if not images:
                    break
                if index >= len(images):
                    index = len(images) - 1
                break

        if not images:
            break

    cv2.destroyAllWindows()
    print(f"Hoàn tất. Ảnh còn lại: {len(images)}")
    print(f"Labels đã lưu trong: {LABEL_DIR}")
    print("Mỗi box phải ôm trọn toàn bộ biển số, không phải cả xe hoặc từng ký tự.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
