# Chuồng gà và thêm bò: con số và lý do

Migration: `supabase/migrations/20261117100000_farm_coop_cows.sql` (chuồng gà, gà, trứng, bò thứ 2–3) và `20261117100001_bistro_farm_eggs.sql` (trứng sang Bistro). Luật dùng chung: `COOP`, `EGG`, `henLevel`, `henPrice`, `PASTURE.cowLevels`, `nextCow` trong `packages/shared/src/farm.ts`; `FARM_TO_BISTRO.egg` trong `packages/shared/src/bistro.ts`.

## Mô hình

`docs/hub-redesign/economy/animals.mts` tính leaves/ngày từ ruộng, bò và gà theo farm level, dùng đúng số liệu đang chạy (chạy: `node --experimental-strip-types docs/hub-redesign/economy/animals.mts`). Mô hình Python cũ (`farm_model.py`) giả định cây mọc hàng giờ; từ migration 062 cây chỉ mọc vài phút, nên thu nhập phụ thuộc số lần người chơi ghé farm: mỗi lần ghé, mỗi ô ruộng cho 1 lần thu, mỗi con vật cho 1 lượt (sữa, trứng hồi sau 2 giờ).

Người chơi "regular" (4 lần ghé/ngày):

| Farm Lv | Ruộng | Bò | Sữa | Gà | Trứng (lãi) | Vật nuôi / ruộng |
| ------- | ----- | -- | --- | -- | ----------- | ---------------- |
| 9       | 669   | 1  | 480 | 0  | 0           | 72%              |
| 14      | 739   | 1  | 480 | 3  | 300         | 106%             |
| 17      | 1065  | 1  | 480 | 4  | 400         | 83%              |
| 24      | 1487  | 1  | 480 | 6  | 600         | 73%              |
| 36      | 2592  | 1  | 480 | 9  | 900         | 53%              |
| 40      | 3049  | 2  | 960 | 9  | 900         | 61%              |
| 55      | 4224  | 3  | 1440| 9  | 900         | 55%              |
| 75      | 5280  | 3  | 1440| 9  | 900         | 44%              |

Kết luận:

- **Gà phải mở theo level.** Nếu cho mua đủ 9 gà ngay ở Lv 14 (bản đầu), gà cho ~900/ngày, hơn cả ruộng (~740). Mở dần tới Lv 36 giữ vật nuôi ở khoảng 50–85% thu nhập ruộng.
- **Bò thêm cũng theo level, nhưng muộn.** Một con bò đã bằng 72% ruộng ở Lv 9 (thiết kế có sẵn). Về sau ruộng tăng lên 3.000–5.000/ngày, một con bò thành nhỏ; bò thứ 2 ở Lv 40, thứ 3 ở Lv 55 giữ vật nuôi đáng chăm mà ruộng vẫn là chính.
- Lv 14–16 vượt 100% trong khoảng 3 ngày (bò sẵn có + 3 gà đầu). Chấp nhận được: chuồng giá 1.500, mấy ngày này trả lại tiền chuồng. Nếu muốn mềm hơn: bắt đầu với 2 gà.
- Mô hình lạc quan cho ruộng (giả định luôn đủ hạt giống trong cửa hàng), nên tỉ lệ vật nuôi thật có thể cao hơn bảng một chút.
- Đổi leaves → coins có trần 60 coins/ngày (1.200 leaves), nên vật nuôi không làm tăng coins; leaves dư đi vào đất, đồ trang trí, mastery.

## Con số

| Thứ                 | Mở ở Lv | Giá (leaves) |
| ------------------- | ------- | ------------ |
| Chicken Coop (3 gà) | 14      | 1.500        |
| Gà thứ 4 → 9        | 17, 20, 24, 28, 32, 36 | 500, 700, 900, 1.100, 1.300, 1.500 |
| Bò thứ 2            | 40      | 6.000        |
| Bò thứ 3            | 55      | 10.000       |

- Mỗi gà: 2 Breeze Wheat thường (không đột biến) → 1 Sunny Egg sau 2 giờ, +3 XP khi nhặt. Không có Feed Mill: corn (Twin Bolt Corn) mở ở Lv 60, còn lúa mì mọc 2 phút.
- Sunny Egg: 30 leaves × hệ số trong ngày (0,85–1,35), chiếm chỗ barn. Khi có chuồng, khoảng 1/3 đơn hàng mới đòi thêm 2–4 trứng (trả 1,45 × giá gốc, 3 XP mỗi quả).
- Bistro: 3 trứng → 1 Eggs trong pantry, chung giới hạn 30/ngày như các nguyên liệu từ farm khác.
- Bò thêm: như con đầu, 2 Storm Milk mỗi 2 giờ, lần đầu 20 phút sau khi mua.

## Chỗ đứng

Chuồng chiếm 990..1350 × 846..1010 (world px), dưới con đường, bên phải lối đi từ cổng. Cây tròn ở (1120, 1060) và các cây rìa ngay dưới chuồng đã bị đốn để chuồng to và dễ chạm; các cây khác giữ nguyên vị trí. Đồ trang trí đang đứng trên chỗ chuồng được migration cất vào kho (đặt lại miễn phí); chỗ cây cũ giờ là đất trống đặt được.
