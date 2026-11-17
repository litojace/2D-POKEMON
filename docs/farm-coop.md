# Chuồng gà và thêm bò: con số và lý do

Migration: `supabase/migrations/20261117100000_farm_coop_cows.sql` (chuồng gà, gà, trứng, bò thứ 2–3), `20261117170000_farm_more_cows.sql` (tối đa 5 bò, mở sớm hơn, đồng cỏ cao hơn) và `20261117100001_bistro_farm_eggs.sql` (trứng sang Bistro). Luật dùng chung: `COOP`, `EGG`, `henLevel`, `henPrice`, `PASTURE.cowLevels`, `nextCow` trong `packages/shared/src/farm.ts`; `FARM_TO_BISTRO.egg` trong `packages/shared/src/bistro.ts`.

## Mô hình

`docs/hub-redesign/economy/animals.mts` tính leaves/ngày từ ruộng, bò và gà theo farm level, dùng đúng số liệu đang chạy (chạy: `node --experimental-strip-types docs/hub-redesign/economy/animals.mts`). Mô hình Python cũ (`farm_model.py`) giả định cây mọc hàng giờ; từ migration 062 cây chỉ mọc vài phút, nên thu nhập phụ thuộc số lần người chơi ghé farm: mỗi lần ghé, mỗi ô ruộng cho 1 lần thu, mỗi con vật cho 1 lượt (sữa, trứng hồi sau 2 giờ).

Người chơi "regular" (4 lần ghé/ngày):

| Farm Lv | Ruộng | Bò  | Sữa  | Gà  | Trứng (lãi) | Vật nuôi / ruộng |
| ------- | ----- | --- | ---- | --- | ----------- | ---------------- |
| 9       | 669   | 1   | 480  | 0   | 0           | 72%              |
| 14      | 739   | 1   | 480  | 3   | 300         | 106%             |
| 17      | 1065  | 1   | 480  | 4   | 400         | 83%              |
| 24      | 1487  | 1   | 480  | 6   | 600         | 73%              |
| 32      | 2112  | 2   | 960  | 8   | 800         | 83%              |
| 36      | 2592  | 2   | 960  | 9   | 900         | 72%              |
| 40      | 3049  | 2   | 960  | 9   | 900         | 61%              |
| 42      | 3142  | 3   | 1440 | 9   | 900         | 74%              |
| 50      | 4013  | 3   | 1440 | 9   | 900         | 58%              |
| 55      | 4224  | 4   | 1920 | 9   | 900         | 67%              |
| 68      | 4963  | 5   | 2400 | 9   | 900         | 66%              |
| 75      | 5280  | 5   | 2400 | 9   | 900         | 63%              |

Kết luận:

- **Gà phải mở theo level.** Nếu cho mua đủ 9 gà ngay ở Lv 14 (bản đầu), gà cho ~900/ngày, hơn cả ruộng (~740). Mở dần tới Lv 36 giữ vật nuôi ở khoảng 50–85% thu nhập ruộng.
- **Bò thêm theo level (bản 20261117170000).** Một con bò đã bằng 72% ruộng ở Lv 9 (thiết kế có sẵn). Bản đầu cho bò thứ 2 ở Lv 40 và thứ 3 ở Lv 55: người chơi đều đặn phải chờ khoảng 41 ngày từ con bò đầu tới con thứ 2, và vật nuôi tụt xuống 49% ruộng ở Lv 35, 46% ở Lv 50, 44% ở Lv 75 (dưới khoảng 50–85% đã chọn). Nay tối đa 5 bò: Lv 32 / 42 / 55 / 68, giữ vật nuôi ở 58–83% ruộng từ Lv 32 trở đi.
- **Không mở bò thứ 2 sớm hơn Lv 32.** Thử ở Lv 22–25: vật nuôi lên 100–105% ruộng ở Lv 25–30 (gà cũng đang tăng cùng lúc), ruộng hết là nguồn chính. Lv 32 là lúc ruộng nhảy lên (cây mới, đất mới) và chuồng gà gần đủ (gà thứ 8).
- Sữa chỉ chiếm 2–6% XP, nên thêm bò gần như không làm lên level nhanh hơn. Hoàn vốn: bò thứ 2 (4.000) khoảng 8 ngày với 4 lần ghé/ngày.
- Lv 14–16 vượt 100% trong khoảng 3 ngày (bò sẵn có + 3 gà đầu). Chấp nhận được: chuồng giá 1.500, mấy ngày này trả lại tiền chuồng. Nếu muốn mềm hơn: bắt đầu với 2 gà.
- Mô hình lạc quan cho ruộng (giả định luôn đủ hạt giống trong cửa hàng), nên tỉ lệ vật nuôi thật có thể cao hơn bảng một chút.
- Đổi leaves → coins có trần 60 coins/ngày (1.200 leaves), nên vật nuôi không làm tăng coins; leaves dư đi vào đất, đồ trang trí, mastery.

## Con số

| Thứ                 | Mở ở Lv                | Giá (leaves)                       |
| ------------------- | ---------------------- | ---------------------------------- |
| Chicken Coop (3 gà) | 14                     | 1.500                              |
| Gà thứ 4 → 9        | 17, 20, 24, 28, 32, 36 | 500, 700, 900, 1.100, 1.300, 1.500 |
| Bò thứ 2            | 32                     | 4.000                              |
| Bò thứ 3            | 42                     | 6.000                              |
| Bò thứ 4            | 55                     | 9.000                              |
| Bò thứ 5            | 68                     | 13.000                             |

- Mỗi gà: 2 Breeze Wheat thường (không đột biến) → 1 Sunny Egg sau 2 giờ, +3 XP khi nhặt. Không có Feed Mill: corn (Twin Bolt Corn) mở ở Lv 60, còn lúa mì mọc 2 phút.
- Sunny Egg: 30 leaves × hệ số trong ngày (0,85–1,35), chiếm chỗ barn. Khi có chuồng, khoảng 1/3 đơn hàng mới đòi thêm 2–4 trứng (trả 1,45 × giá gốc, 3 XP mỗi quả).
- Bistro: 3 trứng → 1 Eggs trong pantry, chung giới hạn 30/ngày như các nguyên liệu từ farm khác.
- Bò thêm: như con đầu, 2 Storm Milk mỗi 2 giờ, lần đầu 20 phút sau khi mua. Bò đã mua theo giá cũ (6.000 / 10.000) giữ nguyên, không hoàn tiền.
- Đồng cỏ (20261117170000): mép trên từ y 420 lên 330 (world px; đồ trang trí không đặt được từ y 300 xuống, trước là 390), đốn cây tròn ở (1480, 340) và cây thông ở (1700, 330). 5 bò đứng 3 hàng cách nhau khoảng 95 px: bò 2–3 hàng sau, bò 4–5 hàng giữa, bò đầu hàng trước; mỗi con đi lại trên một đoạn ngắn của mình. Đồ trang trí đang đứng trên phần đất mới được cất vào kho (đặt lại miễn phí).

## Chỗ đứng

Chuồng chiếm 960..1440 × 846..1040 (world px), dưới con đường, bên phải lối đi từ cổng (mở rộng ở `20261117160000_farm_coop_wider.sql`; trước đó 990..1350 × 846..1010). Cây tròn ở (1120, 1060), cây anh đào ở (1450, 1040) và các cây rìa ngay dưới chuồng đã bị đốn để chuồng rộng và dễ chạm; các cây khác giữ nguyên vị trí và hình dáng. Đồ trang trí đang đứng trên chỗ chuồng được migration cất vào kho (đặt lại miễn phí). `arena_farm_decor_fits` trong migration này chép từ `20261117120000_farm_decor_catalog.sql` (giữ luật lối đi được chồng nhau).

## Cách chơi trong chuồng

- Chạm một con gà đói: bên cạnh hiện nắm thóc (như hạt giống cạnh ô trống). Kéo thóc qua đàn gà: con đói nào nó đi qua đều được cho ăn, cho tới khi hết lúa mì thường. Chạm vào thóc: chỉ cho con đó ăn.
- Chạm một con gà có trứng: hiện cái giỏ. Kéo giỏ qua đàn gà để nhặt hết trứng (giống thu hoạch bằng liềm); chạm vào giỏ: chỉ nhặt quả của con đó.
- Gà tự đi lại khắp sân: mổ, bới rơm (bụi bay), ra máng uống nước, ra máng ăn, đuổi nhau, vỗ cánh. Con đói lảng vảng quanh máng ăn trống. Con đang ấp ngồi trên tổ rơm tới khi đẻ. Ở đồ hoạ Thấp hoặc khi bật giảm chuyển động, gà đứng yên (con đang ấp vẫn ngồi).
- Gà chạy ngoài đồng cỏ (chỉ để trang trí) đã bỏ: gà của farm giờ sống trong chuồng.
