# Element Bistro — Game Design Document (GDD)

> Phiên bản 1.0 · tab **Bistro** trong hub của Element Arena (cạnh Lobby, Plaza, Farm).
> Tài liệu này mô tả 4 hệ thống lõi theo phong cách game quản lý nhà hàng mạng xã hội
> kiểu "Nhà Hàng Vui Vẻ" (Zing Me), áp dụng lên **game đang chạy**: phần nào đã có trong
> code thì ghi rõ con số thật và hướng cải thiện, phần nào chưa có thì thiết kế mới.

---

## 0. Nguyên tắc chung

| Nguyên tắc                              | Ý nghĩa với thiết kế                                                                                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lấy cảm hứng cơ chế, không sao chép** | Giữ cơ chế (thuê bạn bè, món ăn có cấp, xếp bàn ghế, độ nổi tiếng). Tên, nhân vật, hình ảnh đều là của Element Arena. Chữ trong game bằng **tiếng Anh** (quy định của repo).                                                                   |
| **Server quyết định**                   | Luật nằm ở `packages/shared/src/bistro.ts`, database Supabase chạy **đúng luật đó** (migration 068). Client chạy trước để phản hồi ngay, server trả lời thì client lấy theo. Mọi tính năng mới đều phải có cả hai nửa và test so sánh hai nửa. |
| **Tự động khi offline là "linh hồn"**   | Nhân viên vẫn làm khi người chơi vắng mặt (đến hết ca 2–8 giờ). Không cơ chế mới nào được làm nhà hàng **dừng hẳn** khi vắng mặt; chỉ được làm **chậm lại** để người chơi muốn quay về chăm sóc.                                               |
| **Chơi trên điện thoại**                | Một thao tác = một lần chạm. Không bắt người chơi chăm từng chỉ số nhỏ: gộp, hiển thị bằng bong bóng trên đầu nhân vật.                                                                                                                        |
| **Kinh tế hai đồng tiền**               | Bistro coins (xu nhà hàng) dùng trong Bistro; đổi sang Gold Leaves có giới hạn (100 xu → 20 lá, tối đa 300 lá/ngày). Nguyên liệu mới **không** được trở thành đường lách giới hạn này.                                                         |

### Vòng lặp chính

```
 Nấu món ──► Quầy (servings) ──► Khách đến (theo Popularity) ──► Phục vụ ──► Trả tiền + đánh giá
    ▲                                                                         │
    │        Nguyên liệu ◄── Chợ / Farm / Thăm bạn                            ▼
    └──── Nâng cấp món (Lv 1–10) ◄── xu + nguyên liệu      Xu ──► Bàn ghế, trang trí, mở rộng, thuê người
```

### Bảng đối chiếu: cái đã có và cái cần làm

| Hệ thống       | Đã có trong game                                                                                                 | Cải thiện                                                                                      | Làm mới                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Nhân viên   | Đầu bếp (2 người), Phục vụ (3 người), cấp 1–5 (+12% tốc độ/cấp), ca offline 2–8 h, bếp trưởng là fighter của bạn | Phục vụ chọn việc theo khoảng cách; báo cáo offline theo từng người                            | **Lao công**, **Thể lực (Energy)**, **Thuê bạn bè**                          |
| 2. Món ăn      | 8 món mở theo cấp nhà hàng 1–7, giá 4–30 xu, "Perfect" +2 phần, món đặc biệt ×1.5, VIP ×2.5                      | Cấp món ảnh hưởng giá/số phần                                                                  | **Cấp món Lv 1–10**, **Nguyên liệu** (Chợ, Farm, thăm bạn), **điểm Gourmet** |
| 3. Bố cục & AI | Lưới 11×9 → 17×12 (3 lần mở rộng), tìm đường BFS, ghế phải chạm bàn, kiểm tra mọi ghế đều đi tới được            | Khách chọn ghế, phục vụ chọn việc theo **bản đồ khoảng cách**; tốc độ offline tính theo bố cục | **Bản đồ nhiệt** khi trang trí, **chỉ số Layout**, **Quầy tính tiền**        |
| 4. Uy tín      | Sao 0–5 (trung bình trượt), Charm từ đồ trang trí, khách đến nhanh hơn theo sao + charm, giờ cao điểm            | Gộp thành một con số dễ hiểu                                                                   | **Popularity 0–50**, **hàng chờ ở cửa**, rác làm giảm điểm                   |

---

## 1. Hệ thống Nhân viên

### 1.1 Hiện trạng (code hiện tại)

| Vai trò   | Lượt thuê (cấp nhà hàng · giá)                       | Việc làm                                                                                                |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Waiter    | #1 cấp 1 · miễn phí, #2 cấp 3 · 400, #3 cấp 6 · 1000 | Mang món từ quầy đến khách (ưu tiên khách chờ lâu nhất), dọn chồng xu/đĩa sau 9 s                       |
| Cook      | #1 cấp 2 · 250, #2 cấp 5 · 900                       | Mỗi người giữ một bếp, tự nấu món được giao (hoặc món tốt nhất còn đủ tiền), dừng khi quầy có ≥ 24 phần |
| Head chef | fighter Lobby của bạn                                | Bạn chạm bếp để nấu thủ công                                                                            |

- Cấp nhân viên 1–5: tốc độ `1 + 0.12 × (cấp − 1)`, giá nâng `150 × cấp²`.
- Ca offline: 2 / 4 / 6 / 8 giờ (giá 300 / 800 / 1600).

### 1.2 Ba vị trí

| Vị trí              | Mở ở cấp      | Giá thuê       | Việc làm                                    | Thứ tự ưu tiên công việc                           |
| ------------------- | ------------- | -------------- | ------------------------------------------- | -------------------------------------------------- |
| **Cook**            | 2, 5, (mới) 9 | 250, 900, 2000 | Nấu món được giao trên bếp của mình         | Bày món đã chín → nấu mẻ mới nếu quầy < 24 phần    |
| **Waiter**          | 1, 3, 6       | 0, 400, 1000   | Mang món, nhận order                        | Mang món > dọn bàn (khi chưa có lao công) > về chỗ |
| **Janitor** _(mới)_ | 4, 8          | 300, 900       | Dọn bàn (chồng xu + đĩa), quét rác trên sàn | Bàn khách đang chờ > rác gần nhất > về góc         |

Khi có Janitor, Waiter **không dọn bàn nữa** → mang món nhanh hơn. Chưa có Janitor thì giữ như hiện nay.

### 1.3 Thuê bạn bè _(mới)_

- Mỗi lượt thuê có 2 lựa chọn: **Creature** (như bây giờ) hoặc **Friend** (chọn trong danh sách bạn bè; hiện nhân vật Lobby và tên của bạn đó).
- Quyền lợi của nhân viên là bạn bè:
  - **+10% tốc độ** ("Friend bonus").
  - Khi bạn đó **ghé ăn** ở nhà hàng của bạn (cơ chế Dine đã có), nhân viên đó hồi **đầy Energy**. Đây là lý do để hai người thăm nhau mỗi ngày.
  - Người được thuê nhận **+3 Bistro XP mỗi ngày** họ đang làm cho ít nhất 1 người (tối đa +15/ngày), để được thuê là chuyện vui.
- Mỗi người thuê được một bạn cho **một vị trí** (không thuê cùng một bạn hai lần).
- Nếu hai người hủy kết bạn: nhân viên đó tự đổi thành creature cùng vai trò, cùng cấp. Không mất gì.
- Server: cột `friend_id uuid null` trong `arena_bistro_staff`. Hàm thuê kiểm tra `arena_farm_are_friends`.

### 1.4 Thể lực — Energy _(mới)_

Gộp "đói" và "mệt" thành **một thanh Energy 0–100**, hiện bằng 2 trạng thái để dễ nhìn:

| Energy | Trạng thái    | Bong bóng | Tốc độ làm việc |
| ------ | ------------- | --------- | --------------- |
| 50–100 | Fresh         | không     | ×1.00           |
| 20–49  | **Hungry**    | 🍜        | ×0.85           |
| 0–19   | **Exhausted** | 💤        | ×0.60           |

> Vì sao không dừng hẳn ở 0? Người chơi yêu thích việc nhà hàng tự chạy khi offline. Mệt chỉ làm **chậm** (×0.6), đủ để người chơi muốn quay lại chăm, nhưng không phạt nặng khi họ đi ngủ.

**Tiêu hao** (tính theo thời gian _đang làm việc_, không tính lúc đứng chờ):

| Vai trò | Mất Energy / giờ làm việc |
| ------- | ------------------------- |
| Cook    | 14                        |
| Waiter  | 12                        |
| Janitor | 10                        |

Ví dụ: một đầu bếp đầy Energy làm liên tục khoảng **3.6 giờ** thì vào Hungry, khoảng **5.7 giờ** thì Exhausted. Ca 8 giờ vẫn chạy hết, nhưng 2 giờ cuối chậm hơn.

**Hồi phục** (người chơi phải tương tác):

| Cách                                                       | Hồi                                              | Chi phí / điều kiện                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Staff meal**: chạm nhân viên → "Feed"                    | +50                                              | Lấy **1 phần ăn** từ quầy (mất doanh thu phần đó); mỗi người 1 lần/10 phút              |
| **Staff Corner** (đồ nội thất mới, 1 ô, giá 600, mở cấp 5) | giảm 25% hao Energy mỗi cái (tối đa 2 cái = 50%) | Tính cả khi online lẫn offline; server tự kiểm chứng được vì chỉ cần đếm đồ trong phòng |
| Bạn bè ghé ăn (§1.3)                                       | đầy                                              | Chỉ áp dụng cho nhân viên là chính người bạn đó                                         |
| Nghỉ sau ca                                                | +15 / giờ                                        | Sau khi ca offline hết giờ (qua đêm), tự hồi                                            |

- Cấp nhân viên tăng Energy tối đa: `100 + 10 × (cấp − 1)` (cấp 5 = 140). Việc nâng cấp nhân viên vì thế có thêm giá trị.
- Báo cáo khi quay lại có thêm dòng: _"Mochi worked 5 h and is Exhausted — feed them!"_

**Công thức** (dùng chung client/server):

```
energyMax(lv)        = 100 + 10·(lv − 1)
speed(staff)         = (1 + 0.12·(lv − 1)) · (friend ? 1.10 : 1) · mood(E)
mood(E)              = E ≥ 50 ? 1 : E ≥ 20 ? 0.85 : 0.60
E(t)                 = clamp(0, energyMax, E(t₀) − drain_role · (1 − 0.25 · số_Staff_Corner) · giờ_làm_việc)
```

Server lưu `energy` tính tại mốc `last_seen` của nhà hàng (không cần cột thời gian riêng): khi người chơi đang mở nhà hàng, Energy giảm theo thời gian thực; khi vắng mặt, giảm trong ca rồi hồi +15/giờ sau ca. Mô phỏng offline tính Energy ở từng bước 15 s (cùng công thức với client, có test so khớp).

---

## 2. Hệ thống Món ăn & Nguyên liệu

### 2.1 Hiện trạng

| Món               | Mở ở cấp | Thời gian | Chi phí nấu | Số phần | Giá/phần |
| ----------------- | -------- | --------- | ----------- | ------- | -------- |
| Spring Rolls      | 1        | 15 s      | 10          | 6       | 4        |
| Banh Mi           | 1        | 30 s      | 18          | 8       | 5        |
| Pho               | 2        | 60 s      | 40          | 10      | 8        |
| Bun Cha           | 3        | 120 s     | 70          | 12      | 11       |
| Broken Rice       | 4        | 180 s     | 100         | 14      | 13       |
| Rainbow Sweet Cup | 5        | 300 s     | 150         | 16      | 17       |
| Iced Milk Coffee  | 6        | 420 s     | 160         | 18      | 16       |
| Elemental Hotpot  | 7        | 600 s     | 300         | 20      | 30       |

Ngoài ra: chạm đúng "golden moment" (78–96% thanh nấu) được **Perfect** (+2 phần), món đặc biệt trong ngày ×1.5, VIP ×2.5, tip theo combo/tim/nhanh, giờ cao điểm ×2 tip.

### 2.2 Cấp món — Dish Level 1 → 10 _(mới)_

Mỗi món có **cấp riêng** (khác với cấp nhà hàng). Lên cấp cần 2 thứ:

1. **Mastery**: nấu món đó. Mỗi mẻ bày lên quầy +1 điểm (Perfect +2). Cần `5 × L` điểm để mở nâng cấp từ L lên L+1.
2. **Nguyên liệu + xu**: trả khi bấm nâng cấp.

| Từ L → L+1 | Mastery cần | Nguyên liệu (mỗi loại của món) | Xu          |
| ---------- | ----------- | ------------------------------ | ----------- |
| 1 → 2      | 5           | 1                              | `cost × 2`  |
| 2 → 3      | 10          | 2                              | `cost × 5`  |
| 3 → 4      | 15          | 3                              | `cost × 10` |
| 4 → 5      | 20          | 4                              | `cost × 16` |
| 5 → 6      | 25          | 5 + 1 Spice                    | `cost × 22` |
| 6 → 7      | 30          | 6 + 1 Spice                    | `cost × 30` |
| 7 → 8      | 35          | 7 + 2 Spice                    | `cost × 40` |
| 8 → 9      | 40          | 8 + 2 Spice                    | `cost × 50` |
| 9 → 10     | 45          | 9 + 3 Spice                    | `cost × 60` |

(`cost` = chi phí nấu một mẻ của món, ví dụ Pho = 40.)

**Hiệu quả theo cấp L**:

```
giá/phần(L)   = round(price × (1 + 0.12·(L − 1)))       // L10 = ×2.08
số phần(L)    = servings + floor((L − 1) / 3)          // L10 = +3 phần
```

Ví dụ Pho: Lv1 = 8 xu × 10 phần = 80 xu/mẻ → Lv10 = 17 xu × 13 phần = 221 xu/mẻ (×2.8 doanh thu một mẻ, chi phí nấu giữ nguyên 40).

### 2.3 Nguyên liệu

10 nguyên liệu, mỗi món dùng 2 loại; **Spice** là nguyên liệu hiếm dùng cho cấp cao.

| Món               | Nguyên liệu     |
| ----------------- | --------------- |
| Spring Rolls      | Rice + Herbs    |
| Banh Mi           | Flour + Pork    |
| Pho               | Flour + Herbs   |
| Bun Cha           | Flour + Pork    |
| Broken Rice       | Rice + Egg      |
| Rainbow Sweet Cup | Beans + Coconut |
| Iced Milk Coffee  | Coffee + Milk   |
| Elemental Hotpot  | Chili + Beans   |

**Nguồn**:

| Nguồn                      | Cơ chế                                                                                                                                                                                                                                             | Giới hạn                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Market** (Chợ)           | Mỗi 4 giờ đổi 4 mặt hàng (giống nhau cho mọi người, theo giờ như Rush Hour). Giá 20–60 xu.                                                                                                                                                         | 5 món/loại/ngày                                                                         |
| **Farm** (tab Farm có sẵn) | Trong Bistro → Recipes → **Pantry & Market**, mục "From your Farm": 3 nông sản thường (không đột biến) trong kho Farm → 1 nguyên liệu. Breeze Wheat → Flour, Spirit Mint → Herbs, Ember Pepper → Chili, Tide Lotus → Beans, Storm Milk (bò) → Milk | 30 nguyên liệu/ngày; **một chiều** (Bistro không bán ngược nguyên liệu lấy Gold Leaves) |
| **Thăm bạn**               | Mỗi lần **Dine** ở nhà bạn: +1 nguyên liệu (một trong 2 nguyên liệu của món bạn vừa ăn). Thêm 10% cơ hội ra **Spice**.                                                                                                                             | Theo giới hạn Dine hiện có (10 lần/ngày)                                                |
| **Lên cấp nhà hàng**       | Mỗi cấp mới: 2 của một loại và 1 của loại kế tiếp (theo thứ tự cố định, nên client và server tính giống nhau)                                                                                                                                      | —                                                                                       |

Kho nguyên liệu (**Pantry**) chứa tối đa 99 mỗi loại.

### 2.4 Điểm Gourmet _(mới)_

```
Gourmet = Σ_món (L_món − 1) × cấp_mở_khóa_món
```

Tối đa: (1+1+2+3+4+5+6+7) × 9 = **261**.

| Gourmet | Danh hiệu (trong game) | Thưởng                                                               |
| ------- | ---------------------- | -------------------------------------------------------------------- |
| 0       | Street Cook            | —                                                                    |
| 20      | Home Chef              | Danh hiệu (thưởng thêm: giai đoạn 4)                                 |
| 60      | Bistro Chef            | Danh hiệu; dự kiến: khách VIP có "món yêu cầu" (trả ×3 nếu đúng món) |
| 120     | Master Chef            | Danh hiệu; dự kiến: đồ trang trí đặc biệt trong Shop                 |
| 200     | Grand Gourmet          | Danh hiệu; dự kiến: biển hiệu trên mái đổi màu vàng                  |

Gourmet cũng là một phần của Popularity (§4).

---

## 3. Thiết kế bố cục & AI di chuyển

### 3.1 Hiện trạng

- Lưới isometric 11×9, mở rộng 3 lần (+2 cột, +1 hàng mỗi lần) đến 17×12.
- Cửa ở (0,7); bếp hàng 0; quầy hàng 2 (x 0..5); chỗ lấy món ở (1..4, 3); phục vụ đứng chờ ở (6,3).
- Một ghế = một chỗ ngồi nếu **chạm cạnh** một bàn; hướng ghế phân xử khi chạm 2 bàn.
- Đặt đồ phải để **mọi ghế còn đi tới được** (`planWorks`); không chặn cửa, quầy, bếp.
- Tìm đường BFS 4 hướng (`findPath`).
- Khách chọn **ghế trống ngẫu nhiên**; phục vụ lấy order **chờ lâu nhất** dù xa hay gần.
- Offline: mỗi ghế phục vụ 1 khách / 28 s; mỗi phục vụ 0.1 khách/s × tốc độ. **Bố cục không ảnh hưởng gì** khi offline.

### 3.2 Bản đồ khoảng cách (Distance Field)

Mỗi lần bố cục thay đổi, tính lại 2 bản đồ BFS trên lưới (≤ 17×12 = 204 ô, rất rẻ):

- `Dd[x][y]`: số bước từ **cửa** tới ô.
- `Dk[x][y]`: số bước từ **khu lấy món** (ô gần nhất trong 1..4, 3) tới ô.

Với mỗi ghế `s` (ô đứng phục vụ là ô trống cạnh bàn gần quầy nhất):

```
walkGuest(s)  = Dd[ghế s]
walkWaiter(s) = 2 × Dk[ô phục vụ của s]        // đi và về
```

### 3.3 AI khách hàng

1. Đến cửa. Nếu còn ghế trống: chọn ghế có **chi phí thấp nhất**:
   `cost(s) = walkWaiter(s) + 0.5 × walkGuest(s) + random(0, 2)`
   (ngẫu nhiên nhỏ để khách không dồn một chỗ, nhưng vẫn ưu tiên ghế "đắc địa").
2. Hết ghế: **xếp hàng ở cửa** (§4.4).
3. Ngồi → gọi món (giữ 1 phần trên quầy) → chờ (patience) → ăn 12 s → trả tiền → về.
4. Có **Register** (quầy tính tiền, _mới_): khách đi qua quầy tính tiền trước khi ra cửa. Xu vào ví ngay (không cần chạm chồng xu) và **+5% tip** nếu quầy cách cửa ≤ 3 bước. Bàn chỉ còn đĩa bẩn cho lao công/phục vụ dọn. Không có Register thì giữ như cũ (chồng xu trên bàn).

### 3.4 AI nhân viên — chọn việc

Mỗi nhân viên rảnh chọn việc có **điểm cao nhất** (tham lam, mỗi việc chỉ một người nhận):

```
điểm(việc) = ưu_tiên(loại) + 0.6 × giây_đã_chờ − bước_đi_tới
```

| Loại việc                          | ưu_tiên | Ai làm                            |
| ---------------------------------- | ------- | --------------------------------- |
| Mang món cho khách đã gọi          | 30      | Waiter                            |
| Dọn bàn có khách đang xếp hàng chờ | 25      | Janitor (hoặc Waiter nếu chưa có) |
| Dọn bàn thường                     | 10      | Janitor (hoặc Waiter)             |
| Quét rác                           | 8       | Janitor                           |

Nhờ hệ số `giây_đã_chờ`, khách ở xa không bị bỏ đói; nhờ `bước_đi_tới`, phục vụ không chạy chéo phòng khi có khách ngay cạnh.

### 3.5 Chỉ số Layout và bản đồ nhiệt _(mới)_

Trong chế độ **Decorate**:

- Mỗi ghế tô màu theo `walkWaiter`: xanh ≤ 8 bước, vàng 9–14, đỏ ≥ 15.
- Thanh **Layout** (A–E) tính từ thời gian phục vụ trung bình một bữa:

```
tMeal = trung_bình_s(walkWaiter(s)) / vWaiter + 5 s      // vWaiter = 2.8 ô/s (tốc độ đi của phục vụ trong game), 5 s lấy món + đặt món
Layout: A < 7 s · B < 8 s · C < 9 s · D < 10.5 s · E ≥ 10.5 s
(Bố cục mặc định: trung bình 7.3 bước → tMeal 7.6 s → B.)
```

- Đặt thử một món đồ thì thấy chỉ số đổi **trước khi** thả, để người chơi tối ưu bằng mắt.

### 3.6 Tốc độ phục vụ offline theo bố cục _(cải thiện)_

Thay hằng số "28 s/ghế" và "0.1 khách/s/phục vụ" bằng công thức theo bố cục:

```
seatRate    = Σ_ghế 1 / (20 + 2 × walkGuest(s) / 2)                  // gọi món, chờ, ăn, dọn + đi vào và ra (2 ô/s)
waiterRate  = Σ_waiter speed / (tMeal + (có Janitor ? 0 : 1.2))       // phải tự dọn thì chậm hơn
serviceRate = min(arrivalRate(Popularity), seatRate, waiterRate) × 0.5 (AWAY_RATE)
```

Như vậy một bố cục tốt kiếm nhiều hơn cả khi offline. Con số được server tính lại từ `items` (không tin client).
Hằng số được chọn để bố cục mặc định cho kết quả gần như cũ (phục vụ 1 bữa ~8.8 s so với 10 s trước đây); bàn để sát quầy thì nhanh hơn, để xa thì chậm hơn tới ~30%.

---

## 4. Hệ thống Uy tín — Popularity (0 → 50)

### 4.1 Hiện trạng

- **Rating** 0–5 sao, trung bình trượt: mỗi khách kéo rating 8% về phía đánh giá của họ (3 tim → 5, 2 tim → 4, 1 tim → 2.5, bỏ về → 0.5).
- **Charm**: tổng điểm trang trí của đồ đặt trên sàn.
- Khoảng cách giữa 2 khách: `max(2.2, 9 − 0.9·rating − 0.08·min(30, charm))` giây, giờ cao điểm × 0.45.

### 4.2 Công thức Popularity _(mới, thay cho việc đọc sao + charm riêng)_

```
Popularity = Service + Decor + Gourmet + Social − Mess        (làm tròn, kẹp 0..50)

Service  = rating × 6                        0..30   (rating 0–5 như hiện tại)
Decor    = min(10, charm / 3)                0..10
Gourmet  = min(6, Gourmet / 40)              0..6
Social   = min(4, likes 7 ngày × 0.5
                + lượt bạn ăn hôm nay × 0.5) 0..4
Mess     = min(8, rác trên sàn × 1
                + bàn bẩn chờ > 30 s × 0.5)  0..8
```

Ví dụ nhà hàng mới (rating 3, 3 chậu cây + 1 thảm = charm 8): 18 + 2.7 ≈ **21**.

### 4.3 Các yếu tố tăng/giảm

| Tăng                              | Giảm                                         |
| --------------------------------- | -------------------------------------------- |
| Khách 3 tim (kéo rating lên)      | Khách 1 tim, khách bỏ về (rating xuống)      |
| Đặt thêm đồ trang trí (Charm)     | Rác trên sàn, bàn bẩn lâu không dọn (Mess)   |
| Nâng cấp món (Gourmet)            | Khách xếp hàng quá lâu rồi bỏ đi (mất khách) |
| Bạn bè Like (tuần) và Dine (ngày) | Nhân viên Exhausted (phục vụ chậm → ít tim)  |

**Rác** _(mới)_: mỗi khách có 8% cơ hội làm rơi rác trên một ô họ đi qua. Người chơi chạm để quét, hoặc Janitor quét. Offline: rác sinh ra theo số khách × 8%, Janitor quét `30 × speed` mỗi giờ; phần còn lại nằm chờ khi bạn quay về (tối đa 10).

### 4.4 Tác động đến dòng khách và hàng chờ

| Popularity | Danh hiệu  | Khách đến mỗi | Hàng chờ tối đa | Tỉ lệ VIP |
| ---------- | ---------- | ------------- | --------------- | --------- |
| 0–9        | Quiet      | 9.0–7.8 s     | 1               | 6–7%      |
| 10–19      | Local Pick | 7.6–6.4 s     | 2               | 8–9%      |
| 20–29      | Busy       | 6.3–5.1 s     | 3               | 9–11%     |
| 30–39      | Hot Spot   | 4.9–3.7 s     | 4               | 11–12%    |
| 40–50      | Legendary  | 3.6–2.2 s     | 5–6             | 12–14%    |

```
arrival(P)    = max(2.2, 9 − 0.136 × P) giây     (giờ cao điểm × 0.45, như cũ)
queueMax(P)   = 1 + floor(P / 10)
queuePatience = 15 + 0.5 × P giây
vipShare(P)   = 0.06 + 0.0016 × P   (giờ cao điểm × 1.3)
```

`arrival` được chọn để P = 50 cho đúng tốc độ tối đa hiện nay (2.2 s). Nhà hàng mới (P ≈ 21) có khách mỗi 6.1 s, chậm hơn một chút so với hiện nay (5.7 s), bù lại bằng hàng chờ: hiện nay khách đến lúc hết ghế là mất luôn, sau thay đổi họ đứng chờ.

**Hàng chờ**: khi hết ghế, khách đứng chờ ở những ô trống gần cửa nhất (bong bóng ⌛ cho biết còn chờ được bao lâu). Có ghế trống thì người đầu hàng vào ngồi. Chờ quá `queuePatience` thì bỏ đi; họ chưa ngồi nên không trừ rating, chỉ mất một khách. Hàng chờ dài là dấu hiệu trực quan: "cần thêm bàn ghế hoặc phục vụ".

### 4.5 Hiển thị

- Ô "★ 3.0" trên HUD đổi thành **"Popularity 23 · Busy"** kèm thanh 0–50; chạm vào mở bảng phân tích 5 thành phần (Service / Decor / Gourmet / Social / Mess) để người chơi biết nên cải thiện gì.
- Danh sách bạn bè (Friends) hiển thị Popularity thay cho sao.

---

## 5. Dữ liệu & server

| Bảng / cột                             | Thay đổi                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `arena_bistro_staff`                   | `role` thêm `'janitor'`; thêm `energy real`, `energy_at bigint`, `friend_id uuid null` |
| `arena_bistro_dishes_lv` _(mới)_       | `(player_id, dish, level 1..10, mastery)`                                              |
| `arena_bistro_pantry` _(mới)_          | `(player_id, ingredient, qty 0..99)`                                                   |
| `arena_bistro_market_buys` _(mới)_     | `(player_id, day, ingredient, qty)` cho giới hạn ngày                                  |
| `arena_bistros`                        | `trash smallint`, `farm_sent_today`                                                    |
| Hành động mới trong `arena_bistro_act` | `feed`, `sweep`, `dishup` (nâng cấp món), `market`, `hire` có `friend`                 |
| Hàm mới                                | `arena_farm_send_bistro(crop, qty)` (Farm → Pantry, một chiều)                         |

Mọi công thức ở trên nằm trong `packages/shared/src/bistro.ts` và có bản SQL giống hệt. Test tích hợp (pglite) so sánh mô phỏng offline của hai bên như hiện nay.

---

## 6. Lộ trình triển khai đề xuất

| Giai đoạn                  | Nội dung                                                                                                                            | Lý do thứ tự                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **1. Cải thiện cái đã có** | Popularity 0–50 + hàng chờ; AI chọn ghế/chọn việc theo bản đồ khoảng cách; chỉ số Layout + bản đồ nhiệt; tốc độ offline theo bố cục | Không cần kinh tế mới, làm game "thông minh" hơn ngay; đặt nền cho các giai đoạn sau |
| **2. Nhân viên**           | Energy (Feed, Staff Corner, hồi sau ca); Janitor + rác; thuê bạn bè                                                                 | Thêm tương tác chăm sóc, cần Popularity (Mess) đã có                                 |
| **3. Món ăn**              | Cấp món 1–10, Pantry, Market, Farm → Bistro, nguyên liệu khi Dine, Gourmet                                                          | Lớn nhất, đụng cả Farm; cần cân bằng kinh tế cẩn thận                                |
| **4. Đánh bóng**           | Register, món yêu cầu của VIP, thưởng Gourmet, âm thanh/hiệu ứng                                                                    | Phụ thuộc 1–3                                                                        |

Mỗi giai đoạn: một migration riêng (số tiếp theo còn trống), test đơn vị cho công thức, test tích hợp server = client, test giao diện ở 5 kích thước màn hình như bộ `bistro-layout`.

## 7. Chỉ số cân bằng cần theo dõi

| Chỉ số                                     | Mục tiêu                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Thu nhập/giờ online ở cấp 6                | Đo trước khi làm giai đoạn 1, sau mỗi giai đoạn không lệch quá ±20% (trừ phần tăng từ cấp món) |
| Thu nhập ca offline 8 h, bố cục trung bình | 30–40% thu nhập online cùng thời gian                                                          |
| Thời gian từ món Lv1 → Lv10 (một món)      | 2–3 tuần chơi đều                                                                              |
| Popularity trung vị sau 1 tuần             | 25–30                                                                                          |
| Số lần "Feed" mỗi ngày                     | 2–6 (chăm sóc vừa phải, không phiền)                                                           |

## 8. Trạng thái triển khai

| Giai đoạn                                                                                                                              | Migration                                                                     | Trạng thái |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| 1. Popularity, hàng chờ, AI theo bản đồ khoảng cách, chỉ số Layout                                                                     | [070_bistro_popularity.sql](../supabase/migrations/070_bistro_popularity.sql) | Đã làm     |
| 2. Energy, Lao công + rác, Staff Corner, thuê bạn bè                                                                                   | [073_bistro_staff.sql](../supabase/migrations/073_bistro_staff.sql)           | Đã làm     |
| 3. Cấp món, kho nguyên liệu, Chợ, Farm → Bistro, nguyên liệu khi ăn ở nhà bạn, Gourmet                                                 | [074_bistro_dishes.sql](../supabase/migrations/074_bistro_dishes.sql)         | Đã làm     |
| 4. Register, món yêu cầu của VIP, thưởng theo hạng Gourmet                                                                             | —                                                                             | Chưa làm   |
| 5. Chơi lâu dài: cân bằng offline, 6 món mới, phòng 21×14, nhân viên Lv10, đơn đặt tiệc, khách quen, giải đấu tuần, sự kiện, chi nhánh | [100_bistro_long_term.sql](../supabase/migrations/100_bistro_long_term.sql)   | Đã làm     |

Khác với bản thiết kế ban đầu: Staff Corner giảm hao Energy thay vì hồi khi nhân viên rảnh (để server tính được cả khi offline); XP khi bày món không tăng theo cấp món; nút chuyển nông sản nằm trong Bistro (Pantry & Market) thay vì trong kho Farm.

## 9. Chơi lâu dài (migration 100)

Đo kinh tế cho thấy: thu nhập offline tăng nhanh (≈1.1k xu/giờ ở cấp 2 → ≈13.7k/giờ ở cấp 12 khi một món đã max), còn nội dung hết ở cấp 12. Migration 100 kéo dài game đến cấp 30 và thêm mục tiêu hằng ngày / hằng tuần / theo mùa.

| Hệ thống                   | Luật                                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cân bằng offline**       | Khách lúc vắng mặt: ×0.5 trong 2 giờ đầu, ×0.4 đến giờ thứ 4, ×0.3 sau đó (`awayRate`).                                                                                                                                                      |
| **6 món mới**              | Sizzling Crepe (L10), Turmeric Noodles (L13), Dill Fish Grill (L16), Caramel Flan (L19), Crab Noodle Soup (L22), Phoenix Feast (L26), mỗi món hai nguyên liệu.                                                                               |
| **Phòng & nhân viên**      | Mở rộng thêm ở cấp 16 (12,000 xu) và 20 (20,000 xu), tối đa 21 × 14. Nhân viên huấn luyện đến Lv 10.                                                                                                                                         |
| **Đơn đặt tiệc (Orders)**  | 2 ô, 3 từ cấp 10, 4 từ cấp 20. Mỗi đơn cần một hai món với số lượng lớn, trả **1.6 ×** giá, hết hạn sau 6 giờ. Giao xong thì 15 phút sau có đơn mới, bỏ qua thì 30 phút.                                                                     |
| **Khách quen (Regulars)**  | Mira (L3), Tobi (L6), Juno (L10), Rook (L15), Sage (L20); mỗi người 3 lần ghé có lời thoại, mỗi lần cần một món theo số lượng. Thưởng: xu (số lượng × giá × 3), XP, 3 token khi có sự kiện; lần cuối +1,000 xu và **Golden Plate** (trophy). |
| **Sự kiện**                | Harvest Moon (15/9–30/11: Pumpkin Lantern, Hay Bale) và Lantern Festival (15/12–28/2: Red Lantern Stand, Plum Blossom). Đơn đặt tiệc và khách quen cho token; token mua đồ của sự kiện; đủ bộ +6 charm. Token về 0 khi sự kiện mới bắt đầu.  |
| **Giải đấu tuần (League)** | Điểm: khách 1, đơn 10, khách quen 15, ăn ở nhà bạn 3. Xếp hạng với bạn bè; tuần sau nhận thưởng nếu ≥ 50 điểm: hạng 1 2,000 xu + 5 Spice, hạng 2 1,200 + 3, hạng 3 800 + 2, còn lại 300 + 1.                                                 |
| **Chi nhánh (Branch)**     | Từ cấp 30 (chạm hai lần): bắt đầu lại ở cấp 1 với 500 xu và **+1 sao** (+10% mọi giá, tối đa 5 sao). Bàn ghế trong phòng vào kho; giữ cấp món, kho nguyên liệu, sàn/tường, khách quen.                                                       |

Giá một phần: `round(price × (100 + 12 × (lv − 1)) × (10 + stars) / 1000)`.
