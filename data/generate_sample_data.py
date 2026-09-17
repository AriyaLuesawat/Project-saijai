"""Generate a deterministic, privacy-safe demo dataset for SaiJai.

The records are synthetic and must not be used as evidence of real payments.
Run from the repository root with: python3 data/generate_sample_data.py
"""

from __future__ import annotations

import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path


SEED = 6730614023
RECORD_COUNT = 100
ROOT = Path(__file__).resolve().parents[1]

BANKS = [
    ("KBank", "KBank (กสิกรไทย)"),
    ("SCB", "SCB (ไทยพาณิชย์)"),
    ("KTB", "KTB (กรุงไทย)"),
    ("BBL", "BBL (ธนาคารกรุงเทพ)"),
    ("BAY", "BAY (กรุงศรีอยุธยา)"),
]

CATEGORY_DATA = {
    "ค่าอาหาร": {
        "weight": 28,
        "range": (45, 680),
        "memos": ["อาหารกลางวัน", "กาแฟและขนม", "มื้อเย็น", "ก๋วยเตี๋ยว", "ของว่าง"],
        "recipients": ["ครัวบ้านสวน", "Cafe Corner", "ร้านอิ่มอร่อย", "ตลาดสด", "ร้านเส้นดี"],
    },
    "ค่าเดินทาง": {
        "weight": 16,
        "range": (35, 1500),
        "memos": ["ค่าเดินทาง", "เติมน้ำมัน", "ค่ารถโดยสาร", "ค่าทางด่วน", "เรียกรถ"],
        "recipients": ["สถานีบริการน้ำมัน", "Transit Service", "ทางด่วน", "Ride Service", "วินชุมชน"],
    },
    "ค่าสาธารณูปโภค": {
        "weight": 13,
        "range": (280, 3200),
        "memos": ["ค่าไฟ", "ค่าน้ำ", "ค่าอินเทอร์เน็ต", "ค่าโทรศัพท์", "ค่าเช่าห้อง"],
        "recipients": ["ผู้ให้บริการไฟฟ้า", "ผู้ให้บริการประปา", "Internet Provider", "Mobile Provider", "หอพักตัวอย่าง"],
    },
    "ค่าของใช้": {
        "weight": 15,
        "range": (89, 2800),
        "memos": ["ของใช้ประจำวัน", "ของใช้ในบ้าน", "เสื้อผ้า", "สินค้าออนไลน์", "ของใช้ส่วนตัว"],
        "recipients": ["Daily Mart", "Home Store", "ร้านเสื้อผ้า", "Online Shop", "ร้านค้าชุมชน"],
    },
    "โอนเงิน": {
        "weight": 10,
        "range": (300, 5000),
        "memos": ["คืนเงินเพื่อน", "ค่าแชร์", "โอนให้ครอบครัว", "ฝากซื้อของ", "ชำระเงินยืม"],
        "recipients": ["ผู้รับตัวอย่าง A", "ผู้รับตัวอย่าง B", "สมาชิกครอบครัว", "เพื่อนตัวอย่าง", "ผู้รับตัวอย่าง C"],
    },
    "ทำบุญ/บริจาค": {
        "weight": 5,
        "range": (100, 1500),
        "memos": ["ทำบุญ", "บริจาค", "สมทบทุน", "ช่วยเหลือชุมชน", "กองทุนสาธารณะ"],
        "recipients": ["มูลนิธิตัวอย่าง", "วัดตัวอย่าง", "กองทุนชุมชน", "องค์กรสาธารณะ", "โครงการแบ่งปัน"],
    },
    "ความบันเทิง": {
        "weight": 7,
        "range": (99, 1800),
        "memos": ["ดูหนัง", "บริการสตรีมมิง", "เกม", "คอนเสิร์ต", "กิจกรรมวันหยุด"],
        "recipients": ["Cinema", "Streaming Service", "Game Store", "Event Ticket", "Activity Space"],
    },
    "สุขภาพ/ความงาม": {
        "weight": 6,
        "range": (120, 3500),
        "memos": ["ซื้อยา", "ตรวจสุขภาพ", "ทำฟัน", "ตัดผม", "ผลิตภัณฑ์ดูแลตัวเอง"],
        "recipients": ["ร้านยาตัวอย่าง", "คลินิกสุขภาพ", "คลินิกทันตกรรม", "ร้านตัดผม", "Care Shop"],
    },
}


def choose_category(rng: random.Random) -> str:
    categories = list(CATEGORY_DATA)
    weights = [CATEGORY_DATA[name]["weight"] for name in categories]
    return rng.choices(categories, weights=weights, k=1)[0]


def make_records() -> list[dict[str, object]]:
    rng = random.Random(SEED)
    start = date(2026, 6, 10)
    records: list[dict[str, object]] = []

    # Exactly 20 records per bank, then shuffle the bank order across the timeline.
    bank_pool = [bank for bank in BANKS for _ in range(RECORD_COUNT // len(BANKS))]
    rng.shuffle(bank_pool)

    for index, (bank_code, bank_name) in enumerate(bank_pool, start=1):
        category = choose_category(rng)
        details = CATEGORY_DATA[category]
        low, high = details["range"]
        amount = round(rng.uniform(low, high) / 5) * 5
        tx_date = start + timedelta(days=index - 1)
        memo_index = rng.randrange(len(details["memos"]))
        confidence = round(rng.uniform(0.82, 0.99), 2)

        records.append(
            {
                "id": 10_000 + index,
                "date": tx_date.isoformat(),
                "bank_code": bank_code,
                "bank_name": bank_name,
                "amount": f"{amount:.2f}",
                "memo": details["memos"][memo_index],
                "recipient": details["recipients"][memo_index],
                "category": category,
                "confidence": confidence,
                "reference": f"DEMO-{bank_code}-{tx_date:%y%m%d}-{index:03d}",
                "preview": "",
                "is_sample": True,
            }
        )

    return sorted(records, key=lambda row: row["date"], reverse=True)


def write_outputs(records: list[dict[str, object]]) -> None:
    csv_paths = [
        ROOT / "data" / "slip_transactions.csv",
        ROOT / "frontend" / "public" / "data" / "slip-transactions.csv",
    ]
    json_path = ROOT / "frontend" / "data" / "sample-transactions.json"
    fields = [
        "id", "date", "bank_code", "bank_name", "amount", "memo", "recipient",
        "category", "confidence", "reference", "is_sample",
    ]

    for csv_path in csv_paths:
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        with csv_path.open("w", encoding="utf-8-sig", newline="") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(records)

    json_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    generated = make_records()
    write_outputs(generated)
    print(f"Generated {len(generated)} synthetic transactions across {len(BANKS)} banks.")
