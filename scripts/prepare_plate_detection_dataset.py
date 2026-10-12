"""Collect scene-image candidates and prepare YOLO detection splits.

Default action deduplicates source images by SHA-256 and copies candidates
to an annotation inbox. --finalize validates labels and creates train/val.

This script never guesses bounding boxes.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import random
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT / "data" / "datasets" / "plate_detection"
INBOX = DATA_ROOT / "inbox"
INBOX_IMAGES = INBOX / "images"
INBOX_LABELS = INBOX / "labels"
YOLO_DIR = DATA_ROOT / "yolo"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
PLATE_TEXT_RE = re.compile(r"(?i)(?:^|_)(\d{2}[A-Z]{1,3}\d{4,6})(?:_|$)")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_candidates() -> list[Path]:
    roots = [
        ROOT / "data" / "external" / "plates",
        ROOT / "data" / "processed" / "scans",
        ROOT / "data" / "processed" / "ticket_images",
    ]
    found: list[Path] = []
    for source_root in roots:
        if not source_root.exists():
            continue
        for path in sorted(source_root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTS:
                continue
            stem = path.stem.lower()
            if "crop" in stem or stem.endswith("_plate") or stem.endswith("_entry_plate"):
                continue
            if source_root.name == "plates":
                # The folder README identifies PNGs as synthetic OCR examples.
                if not stem.startswith("scene_") or path.suffix.lower() not in {".jpg", ".jpeg", ".webp"}:
                    continue
            elif source_root.name == "ticket_images":
                if not stem.endswith("_entry"):
                    continue
            found.append(path)
    return found


def collect_images() -> int:
    INBOX_IMAGES.mkdir(parents=True, exist_ok=True)
    INBOX_LABELS.mkdir(parents=True, exist_ok=True)
    candidates = source_candidates()
    if not candidates:
        print("Không tìm thấy ảnh nguồn phù hợp. Kiểm tra thư mục data/.")
        return 1

    unique: dict[str, list[Path]] = {}
    for path in candidates:
        unique.setdefault(sha256_file(path), []).append(path)

    manifest_path = INBOX / "manifest.csv"
    rows: list[dict[str, str]] = []
    copied = 0
    for digest, source_paths in sorted(unique.items()):
        source_paths = sorted(source_paths, key=lambda p: str(p).lower())
        source = source_paths[0]
        safe_stem = re.sub(r"[^A-Za-z0-9_-]+", "_", source.stem).strip("_")[:45] or "image"
        destination_name = f"img_{digest[:8]}_{safe_stem}{source.suffix.lower()}"
        destination = INBOX_IMAGES / destination_name
        if not destination.exists():
            shutil.copy2(source, destination)
            copied += 1

        match = PLATE_TEXT_RE.search(source.stem)
        rows.append({
            "image": destination_name,
            "sha256": digest,
            "source_paths": ";".join(str(p.relative_to(ROOT)) for p in source_paths),
            "filename_plate_hint_unverified": match.group(1).upper() if match else "",
            "annotation_status": "needs_manual_review_and_bbox",
        })

    with manifest_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "image", "sha256", "source_paths",
                "filename_plate_hint_unverified", "annotation_status",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Ảnh nguồn tìm được: {len(candidates)}")
    print(f"Ảnh duy nhất theo SHA-256: {len(unique)}")
    print(f"Ảnh mới copy vào inbox: {copied}")
    print(f"Ảnh cần kiểm tra/gán nhãn: {INBOX_IMAGES}")
    print(f"Manifest: {manifest_path}")
    print("Không có bbox nào được tự bịa; hãy xem từng ảnh và loại ảnh crop/không phù hợp.")
    return 0


def find_label(image: Path) -> Path | None:
    options = [INBOX_LABELS / f"{image.stem}.txt", image.with_suffix(".txt")]
    return next((path for path in options if path.is_file()), None)


def validate_label(label_path: Path, image_name: str) -> list[str]:
    problems: list[str] = []
    try:
        content = label_path.read_text(encoding="utf-8-sig")
    except OSError as exc:
        return [f"{image_name}: không đọc được nhãn: {exc}"]
    # Empty label is allowed only for an image deliberately reviewed as negative.
    for line_no, line in enumerate(content.splitlines(), start=1):
        text = line.strip()
        if not text:
            continue
        parts = text.split()
        if len(parts) != 5:
            problems.append(f"{image_name}:{line_no}: cần 5 giá trị class x_center y_center width height")
            continue
        try:
            class_id = int(parts[0])
            xc, yc, width, height = map(float, parts[1:])
        except ValueError:
            problems.append(f"{image_name}:{line_no}: có giá trị không phải số")
            continue
        if class_id != 0:
            problems.append(f"{image_name}:{line_no}: class phải là 0 (license_plate)")
        if not (0.0 <= xc <= 1.0 and 0.0 <= yc <= 1.0):
            problems.append(f"{image_name}:{line_no}: tâm bbox phải trong [0,1]")
        if not (0.0 < width <= 1.0 and 0.0 < height <= 1.0):
            problems.append(f"{image_name}:{line_no}: width/height phải trong (0,1]")
        if xc - width / 2 < -1e-6 or xc + width / 2 > 1.000001:
            problems.append(f"{image_name}:{line_no}: bbox tràn khỏi ảnh theo chiều ngang")
        if yc - height / 2 < -1e-6 or yc + height / 2 > 1.000001:
            problems.append(f"{image_name}:{line_no}: bbox tràn khỏi ảnh theo chiều dọc")
    return problems


def finalize_dataset(force: bool = False, seed: int = 42) -> int:
    images = sorted(
        p for p in INBOX_IMAGES.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    ) if INBOX_IMAGES.exists() else []
    if len(images) < 2:
        print("Cần ít nhất 2 ảnh đã rà soát trong inbox/images trước khi tạo split.")
        return 1

    missing: list[str] = []
    problems: list[str] = []
    labelled: list[tuple[Path, Path]] = []
    hashes: dict[str, str] = {}
    for image in images:
        digest = sha256_file(image)
        if digest in hashes:
            problems.append(f"Ảnh trùng nội dung: {image.name} và {hashes[digest]}")
        else:
            hashes[digest] = image.name
        label = find_label(image)
        if label is None:
            missing.append(image.name)
        else:
            problems.extend(validate_label(label, image.name))
            labelled.append((image, label))

    if missing:
        print("Chưa có file nhãn cho các ảnh sau:")
        for name in missing[:30]:
            print(f"  - {name}")
        print("Gán nhãn hoặc loại ảnh không phù hợp khỏi inbox trước khi finalize.")
        return 1
    if problems:
        print("Lỗi nhãn/dữ liệu:")
        for problem in problems[:60]:
            print(f"  - {problem}")
        return 1
    if len(labelled) < 30:
        print(f"CẢNH BÁO: chỉ có {len(labelled)} ảnh đã rà soát; phù hợp kiểm thử quy trình, chưa đủ để kỳ vọng chính xác cao.")

    if YOLO_DIR.exists() and any(YOLO_DIR.iterdir()):
        if not force:
            print(f"{YOLO_DIR} đã có dữ liệu. Dùng --finalize --force nếu muốn tạo lại split.")
            return 1
        shutil.rmtree(YOLO_DIR)

    rng = random.Random(seed)
    rng.shuffle(labelled)
    val_count = max(1, round(len(labelled) * 0.2))
    val_count = min(val_count, len(labelled) - 1)
    splits = {"train": labelled[val_count:], "val": labelled[:val_count]}

    for split, pairs in splits.items():
        image_out = YOLO_DIR / "images" / split
        label_out = YOLO_DIR / "labels" / split
        image_out.mkdir(parents=True, exist_ok=True)
        label_out.mkdir(parents=True, exist_ok=True)
        for image, label in pairs:
            shutil.copy2(image, image_out / image.name)
            shutil.copy2(label, label_out / f"{image.stem}.txt")

    yaml_root = str(YOLO_DIR.resolve()).replace("\\", "/")
    (YOLO_DIR / "data.yaml").write_text(
        f"path: '{yaml_root}'\n"
        "train: images/train\n"
        "val: images/val\n"
        "names:\n"
        "  0: license_plate\n",
        encoding="utf-8",
    )
    print(f"Đã tạo dataset YOLO: {YOLO_DIR}")
    print(f"Train: {len(splits['train'])} ảnh; val: {len(splits['val'])} ảnh")
    print(f"data.yaml: {YOLO_DIR / 'data.yaml'}")
    print("Tập đánh giá test độc lập cần được giữ riêng, không dùng để train/tinh chỉnh.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--finalize", action="store_true", help="Validate labels and generate train/val folders.")
    parser.add_argument("--force", action="store_true", help="Allow finalize to replace the generated YOLO folder.")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.force and not args.finalize:
        parser.error("--force chỉ dùng cùng --finalize")
    return finalize_dataset(force=args.force, seed=args.seed) if args.finalize else collect_images()


if __name__ == "__main__":
    raise SystemExit(main())
