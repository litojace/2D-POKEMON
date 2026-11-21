# Kinh tế xu của Shop: đo đạc và đề xuất (21/11/2026)

> **Kết luận ngắn:** chưa nên đổi giá Shop. Giá hiện tại nằm trong khoảng hợp lý
> so với số xu người chơi kiếm được, không ai đang "ngồi" trên đống xu, và dữ
> liệu còn quá ít (12 người có thu nhập, 65 ngày-người) để chỉnh giá cho chắc.
> Hai việc nên làm thay vào đó: (1) để ý **mùa tháng 12**, vì nó cắt mạnh xu từ
> Season của người chơi ít; (2) đặt sẵn các ngưỡng đo dưới đây và xem lại khi có
> khoảng 50 người chơi mỗi tuần trong 4 tuần.

Tài liệu này chỉ đọc số. Không đổi giá, không ghi gì vào database. Các truy vấn
đều là `SELECT` trên production (project `zrmbdtvuriiikvwcvqfj`), chỉ lấy số
tổng hợp: không có tên, email hay id người chơi.

## 1. Kiểm tra số liệu trước

| Kiểm tra                                     | Kết quả                    |
| -------------------------------------------- | -------------------------- |
| Tổng `arena_wallets.balance` (15 ví)         | **16.188**                 |
| Tổng `arena_coin_ledger.amount`              | **16.188**                 |
| Ví lệch với tổng ledger của chính nó         | **0**                      |
| Dòng ledger không có ví / ví không có ledger | 0 / 0                      |
| Xu vào (mọi dòng dương) − xu ra (`buy`)      | 28.888 − 12.700 = 16.188 ✓ |

Sổ cái khớp từng ví, nên mọi số dưới đây lấy từ ledger là đáng tin **về mặt kế
toán**. Điều không đáng tin là **cỡ mẫu**:

- 28 hồ sơ (13 khách), 15 ví, **12 người từng kiếm xu** (bỏ khoản `leaf-retire`
  đổi lá một lần), **65 ngày-người** có thu nhập từ 17/10 đến 21/11.
- 15 ngày gần nhất: 10 người có thu nhập, số ngày chơi của họ là
  1, 1, 1, 1, 2, 2, 2, 3, 5, 10 (trung vị **2 ngày**).
- Một người chiếm **46 %** toàn bộ xu kiếm được (12.998 trên 28.501, 29 ngày chơi).
- Một tài khoản thử nghiệm được cấp 118 skin ngoài ledger (đủ 18 Mythical, 72
  Legendary...) qua công cụ admin; không tính là "bán".

Vì vậy mọi phân vị dưới đây là **dấu hiệu, không phải kết luận**. Mô hình ở mục
4 dựa vào luật trong code/DB nhiều hơn là vào phân vị.

## 2. Nguồn vào

### 2.1 Theo nguồn (toàn bộ, 17/10 – 21/11)

| Nguồn (`reason`)      |         Xu |  Tỷ lệ | Luật hiện tại (DB)                                                   |
| --------------------- | ---------: | -----: | -------------------------------------------------------------------- |
| `mission`             |      9.410 | 32,6 % | 6 nhiệm vụ/ngày: 2×40, 2×70, 2×120 = 460                             |
| `season`              |      6.800 | 23,5 % | 50 xu mỗi bậc Season; tháng 11: 20 bậc × 400 XP (tối đa 1.000/tháng) |
| `level`               |      4.440 | 15,4 % | 30 xu mỗi cấp dưới 50, 100 xu từ cấp 50                              |
| `raid`                |      4.290 | 14,9 % | 60 xu/clear (Peril 3), tối đa 5 clear có xu/ngày                     |
| `pvp`                 |      1.857 |  6,4 % | thắng 15, thua 6 (Quick Match thắng bot 5), tối đa 10 trận/ngày      |
| `spire`               |        720 |  2,5 % | thưởng một lần mỗi tầng; 70 tầng, tổng 7.530 xu                      |
| `daily-first`         |        400 |  1,4 % | **đã bỏ** (raid hằng ngày ngừng sau 28/10)                           |
| `leaf-retire`         |        387 |  1,3 % | một lần, 19/11, đổi Lá vàng khi bỏ Farm/Bistro                       |
| `missions-bonus`      |        250 |  0,9 % | +50 khi xong cả 6                                                    |
| `plaza-quest`         |        159 |  0,6 % | từ 19/11; 105/ngày, PR #317 đổi thành 100                            |
| `leaf-trade`          |        145 |  0,5 % | **đã dừng** sau 18/11                                                |
| `plaza-wish`          |         30 |  0,1 % | từ 20/11; 15 × tối đa 2/ngày                                         |
| `streak` (300/7 ngày) |          0 |    0 % | chưa ai đạt 7 ngày liền xong cả 6 nhiệm vụ                           |
| `plaza-fish-first`    |          0 |    0 % | 5/10/25/50 mỗi loại cá, tổng 220 một lần (mới thêm 20/11)            |
| **Tổng**              | **28.888** |        |                                                                      |

Không có dòng quà/admin nào trong ledger (admin cấp đồ, không cấp xu).

### 2.2 Mỗi ngày chơi

Bỏ tài khoản thử nghiệm và `leaf-retire`:

| Giai đoạn                   | Ngày-người | Người | Trung vị |     p75 |     p90 |  TB |
| --------------------------- | ---------: | ----: | -------: | ------: | ------: | --: |
| 17/10 – 6/11                |         37 |     8 |      440 |     621 |     867 | 481 |
| **7/11 – 21/11** (gần nhất) |     **25** | **9** |  **310** | **527** | **736** | 358 |
| Toàn bộ                     |         62 |    11 |      371 |     608 |     830 | 432 |

15 ngày gần nhất, trung bình mỗi ngày chơi: nhiệm vụ 125, Season 96, cấp 54,
raid 34, PvP 28, Spire 11, Plaza (nhiệm vụ + điều ước) 3. Hầu hết người chơi
làm **2–3 nhiệm vụ** một ngày (36 trên 56 ngày có nhiệm vụ); chỉ 2 ngày-người
xong cả 6.

Theo số ngày chơi (tổng thu nhập mỗi người, toàn bộ): người chơi 1 ngày kiếm
30–305; 3–7 ngày kiếm 490–3.365; người chơi 29 ngày kiếm 12.998 (≈ 450/ngày).

**Season và cấp độ đang "phồng" số đầu game:** cấp 2–10 chỉ cần 100–300 XP mỗi
cấp, và tháng 11 một bậc Season chỉ cần 400 XP, nên người mới nhận nhiều xu
trong vài ngày đầu rồi giảm dần. Thu nhập lâu dài thấp hơn các phân vị trên.

### 2.3 Tháng 12 Season đổi luật

`arena_season_rules` có sẵn luật từ `2026-12`: **30 bậc × 1.200 XP** (trước là
20 × 400). Mỗi bậc vẫn 50 xu. Xu trên mỗi XP giảm từ 0,125 xuống 0,042.

XP Season không phải XP cấp độ: nó còn nhận 250 XP cho mỗi mục tiêu tuần, nên
đo trực tiếp từ `arena_season_xp` tháng 11 chia cho số ngày chơi trong tháng
(13 người). Người chơi nhiều bị trần 8.000 XP của tháng 11 nên số p90 là mức
thấp nhất.

| Người chơi (XP Season mỗi ngày chơi) | XP/tháng nếu chơi mỗi ngày | Season tháng 11 | Season tháng 12 (30 × 1.200) |
| ------------------------------------ | -------------------------: | --------------: | ---------------------------: |
| p25 ≈ 470                            |                    ~14.000 |  20 bậc = 1.000 |             11 bậc = **550** |
| trung vị ≈ 700                       |                    ~21.000 |  20 bậc = 1.000 |             17 bậc = **850** |
| p90 ≥ 1.770                          |                   ≥ 53.000 |  20 bậc = 1.000 |               30 bậc = 1.500 |
| chơi thưa (≈ 4 ngày/tháng × 700)     |                     ~2.800 |     7 bậc = 350 |              2 bậc = **100** |

Người chơi nhiều được thêm 500 xu/tháng; **người chơi đều đặn ở mức trung vị
mất ~150, p25 mất ~450, người chơi thưa mất ~250 mỗi tháng.** Tức là luật mới
dồn xu Season về phía người chơi nhiều nhất. Nếu đó là chủ ý thì ổn; nếu không,
giữ 30 bậc nhưng **~800 XP/bậc**: p25 ≈ 17 bậc = 850, trung vị ≈ 26 bậc =
1.300, người chơi nhiều vẫn đủ 30 bậc = 1.500, người chơi thưa 3 bậc = 150.
Đây là thay đổi lớn nhất sắp tới với nguồn vào, lớn hơn nhiều so với 5 xu chênh
của PR #317.

## 3. Nguồn ra

### 3.1 Đã tiêu gì

Chỉ **5 lần mua**, của **3 người**, tổng **12.700 xu** (44 % số xu từng kiếm):

| Món                             | Loại                    |                               Giá trả |
| ------------------------------- | ----------------------- | ------------------------------------: |
| Galaxy set                      | bộ thời trang tier 2    |                                 9.600 |
| Candy entrance (2 lần, 2 người) | thời trang tier 0, Rare | 1.000 và 800 (giảm 20 % Today's Pick) |
| Candy aura                      | thời trang tier 0, Rare |                                   900 |
| Một skin Common (Shadopus)      | skin Common             |                       400 (giảm 20 %) |

- **Skin Rare, Epic, Legendary, Mythical: 0 lần mua bằng xu.** Không có người
  chơi thường nào từng có đủ 5.500 xu.
- Bán chạy nhất: bộ Candy (rẻ nhất, 300–1.800). Món "Today's Pick" giảm giá
  chiếm 2/5 lần mua: giảm giá đang có tác dụng.
- 30 món thời trang đang bán, 324 skin; 99 % danh mục chưa ai mua. Với 5 lần
  mua thì "món không ai mua" chưa nói lên gì về món đó.

### 3.2 Số dư hiện tại

| Số dư 15 ví (xếp tăng)                                                          |
| ------------------------------------------------------------------------------- |
| 5, 5, 5, 35, 39, 225, 305, 498, 1.250, 1.368, 1.542, 1.752, 2.170, 3.289, 3.700 |

Trung vị 498, p75 1.647, p90 2.841. Đủ tiền mua: Common 7 ví, Rare 5, Epic 1,
Legendary 0.

**Không có ai "ngồi trên đống xu":** mọi ví đều còn món chưa có giá 300 xu, và
không ví nào vượt giá một Legendary. Các ví lớn nhất đang để dành cho món kế tiếp.

### 3.3 Cán cân

Xu vào 28.888, xu ra 12.700: **44 % đã tiêu**, 56 % còn trong ví. Với một game
mới mở Shop thời trang, phần lớn người chơi còn đang để dành cho món đầu tiên,
nên tỷ lệ này là bình thường. Toàn bộ danh mục (324 skin + 30 món thời trang,
giá niêm yết) là **1.058.760 xu**, khoảng 890 ngày của người chơi chăm nhất:
"chỗ tiêu xu" chưa thể cạn.

## 4. Mô hình: bao nhiêu ngày cho một món?

Ba kiểu người chơi, **mỗi ngày có chơi**, không tính thưởng một lần (Spire,
cá lần đầu, cấp thấp đầu game). Plaza theo PR #317 (100 + 30 điều ước). Season
theo luật tháng 12.

| Nguồn / ngày           | Ít (~15 phút)                 | Vừa (~45 phút)     | Nhiều (~2 giờ)                |
| ---------------------- | ----------------------------- | ------------------ | ----------------------------- |
| Nhiệm vụ Lobby         | 2 dễ = 80                     | 2 dễ + 2 vừa = 220 | cả 6 + 50 + chuỗi 300/7 ≈ 553 |
| Raid                   | 0                             | 2 clear = 120      | 5 clear = 300                 |
| PvP                    | 1 thắng 1 thua = 21           | 4 trận = 42        | 10 trận (6 thắng) = 114       |
| Plaza                  | 3 nhiệm vụ nhanh + 1 ước = 45 | 70                 | 130                           |
| Cấp độ                 | 15                            | 30                 | 40                            |
| Season (luật tháng 12) | 18                            | 28                 | 50                            |
| **Tổng**               | **≈ 180**                     | **≈ 510**          | **≈ 1.190**                   |

So với thực tế 15 ngày qua: trung vị 310, p75 527. Kiểu "vừa" của mô hình gần
p75 thực tế; người chơi điển hình hiện nằm giữa "ít" và "vừa".

**Số ngày chơi để mua một món** (giá / xu mỗi ngày):

| Món                                   |   Giá |   Ít | Trung vị thực tế (310) |  Vừa | Nhiều |
| ------------------------------------- | ----: | ---: | ---------------------: | ---: | ----: |
| Skin Common                           |   500 |  2,8 |                    1,6 |  1,0 |   0,4 |
| Skin Rare                             | 1.500 |  8,4 |                    4,8 |  2,9 |   1,3 |
| Skin Epic                             | 3.500 | 19,6 |                   11,3 |  6,9 |   2,9 |
| Skin Legendary                        | 5.500 | 30,7 |                   17,7 | 10,8 |   4,6 |
| Skin Mythical (+30 trận thắng)        | 8.000 | 44,7 |                   25,8 | 15,7 |   6,7 |
| Victory lẻ (bộ thường)                | 1.800 | 10,1 |                    5,8 |  3,5 |   1,5 |
| Bộ thường (Candy/Garden/Retro, −20 %) | 3.840 | 21,5 |                   12,4 |  7,5 |   3,2 |
| Bộ cao cấp (Winter/Festival)          | 6.140 | 34,3 |                   19,8 | 12,0 |   5,2 |
| Bộ Galaxy                             | 9.600 | 53,6 |                   31,0 | 18,8 |   8,1 |

Đây là **ngày có chơi**, không phải ngày lịch. Người chơi hiện nay trung vị
chỉ 2 ngày trong 15 ngày, nên theo lịch còn chậm hơn nhiều.

## 5. So với các game F2P tương tự

Số liệu công khai về tốc độ kiếm tiền tệ của các game khác ít và cũ; chỉ nên
dùng làm hướng.

| Game                        | Tiền kiếm được                                         | Món tham chiếu              | Quy ra thời gian                                                           |
| --------------------------- | ------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------- |
| Pokémon UNITE (đến 12/2025) | Aeos coins, trần 2.100/tuần                            | License 6.000–15.000 coins  | ~3–7 tuần mỗi nhân vật; Holowear chủ yếu bán bằng gem/vé, không bằng coins |
| League of Legends (IP cũ)   | ~83,5 IP/trận ở 50 % thắng                             | Tướng 6.300 IP              | ~76 trận cho tướng đắt nhất; skin chủ yếu bằng tiền thật                   |
| Brawl Stars                 | ~2.500 coins/tháng chỉ từ đăng nhập (nguồn bên thứ ba) | Skin chủ yếu bằng gem/Bling | Bling bị giới hạn chỗ tiêu                                                 |

Điểm chung: game cùng thể loại thường để **đồ chơi (nhân vật) mua được bằng
tiền kiếm**, còn **skin cao cấp thì chủ yếu bán bằng tiền thật**. Game này hiện
cho mua **mọi** skin bằng xu kiếm được: Epic ≈ 1–2 tuần, Legendary ≈ 2–3 tuần
cho người chơi đều đặn. Như vậy là **hào phóng hơn** các game trên, nhưng hợp
với quyết định không bán xu ở bản 1.0: không có IAP thì không có lý do bắt
người chơi cày lâu hơn.

Khung lý thuyết (Unity, "sinks and faucets"): lạm phát khi nguồn vào vượt chỗ
tiêu; dấu hiệu là số dư phình ra mà không ai mua. Hiện tại ngược lại: số dư
nhỏ, danh mục lớn.

## 6. Kết luận và đề xuất

### Giá: giữ nguyên

- **Không có dấu hiệu lạm phát:** không ví nào vượt 3.700, danh mục cần ~1,06
  triệu xu, người chơi để dành rồi mua.
- **Không có dấu hiệu quá keo:** món đầu tiên (Common/Candy) đến trong 1–3
  ngày chơi; người chơi đều đặn mua được Epic trong 1–2 tuần. 3/12 người có
  thu nhập đã mua ít nhất một món.
- **Dữ liệu quá ít:** 5 lần mua không đủ để nói món nào "đắt quá". Đổi giá bây
  giờ là đoán.
- Đổi giá sau khi người chơi đã mua cũng khó: hạ giá làm người mua trước thiệt,
  tăng giá làm mọi người khó chịu. Đợi số liệu thì rẻ hơn.

### Việc nên làm

1. **Season tháng 12 (quan trọng nhất, trước 1/12):** quyết định có chấp nhận việc người chơi đều đặn ở mức trung vị trở xuống mất 150–450 xu Season mỗi tháng không (mục 2.3). Nếu không, đổi luật `2026-12` thành 30 bậc × ~800 XP. Đổi
   bằng migration mới, không sửa migration cũ.
2. **Ngưỡng để xem lại giá** (khi có ≥ 50 người chơi mỗi tuần trong 4 tuần):
   - Tỷ lệ tiêu/kiếm 28 ngày < 30 % **và** ≥ 20 % ví có ≥ 5.500 xu mà 14 ngày
     không mua → thiếu chỗ tiêu hoặc đồ chưa hấp dẫn: thêm bộ mới trước, rồi
     mới nghĩ đến giá.
   - Trung vị số ngày chơi để mua Epic đầu tiên > 21 ngày → giảm Epic
     (3.500 → 3.000) hoặc tăng nhiệm vụ vừa/khó.
   - Rare bán chạy hơn Epic nhiều lần mà Legendary gần như không ai mua → khoảng
     cách 3.500 → 5.500 quá lớn; thử 5.000.
3. **Chưa cần thêm chỗ tiêu xu.** Khi cần, ưu tiên món cosmetic mới (bộ thời
   trang theo mùa, khung) hơn là món tiêu hao, vì người chơi ít đang thiếu xu
   chứ không thừa.
4. **Theo dõi bằng truy vấn này** (chỉ đọc, tổng hợp):

   ```sql
   -- Xu kiếm theo nguồn, 28 ngày gần nhất
   select reason, sum(amount) xu, count(distinct player_id) nguoi
   from arena_coin_ledger where amount > 0 and day >= current_date - 28
   group by 1 order by 2 desc;
   -- Đối chiếu ví với ledger (phải ra 0)
   select count(*) from arena_wallets w
   left join (select player_id, sum(amount) s from arena_coin_ledger group by 1) l using (player_id)
   where w.balance <> coalesce(l.s, 0);
   ```

### PR #317 (Plaza 100 xu/ngày)

Không ảnh hưởng đến cán cân: Plaza tối đa 130/ngày, khoảng 10–25 % thu nhập của
một người chơi đều đặn, ít xu trên mỗi phút hơn Lobby đúng như thiết kế. Xu cá
lần đầu (220 một lần) quá nhỏ để tính.

### IAP

`docs/iap-research.md` đã quyết định không bán xu ở bản 1.0. Khi mở bán:

- Giá xu hiện tại là mốc cho giá gói: nếu Epic là 3.500 xu, gói giá nào cũng
  sẽ bị người chơi quy ra "bao nhiêu skin Epic". Nên **chốt giá Shop trước khi
  có IAP**; đổi giá sau khi người chơi đã trả tiền thật khó hơn nhiều.
- Khi có người trả tiền, thói quen thường gặp ở thể loại này là giữ đồ thường
  mua được bằng xu kiếm, và để món mới nhất/cao cấp nhất bán bằng tiền thật
  hoặc đắt hơn bằng xu. Không cần làm gì lúc này.
- Ledger đã có sẵn cách đếm theo `reason`; thêm `iap-apple` sẽ cần tách riêng
  khỏi các thống kê "xu kiếm được" như bảng ở mục 2.

## Nguồn

- Luật trong repo: `packages/shared/src/shop.ts`, migrations `010_shop.sql`,
  `035_level_100_daily_spark.sql`, `20261119170000_quick_match_bot_coins.sql`;
  định nghĩa hàm đang chạy (`arena_mission_bump`, `arena_record_activity*`,
  `arena_level_steps`, `arena_season_rule`) đọc trực tiếp từ DB.
- Plaza: `docs/plaza-economy.md` trên nhánh `claude/focused-tesla-wuwpol` (PR #317).
- Pokémon UNITE: [Bulbapedia, Currency (UNITE)](<https://bulbapedia.bulbagarden.net/wiki/Currency_(UNITE)>),
  [Gfinity, license costs](https://www.gfinityesports.com/article/pokmon-unite-how-to-unlock-all-characters-and-license-costs),
  [Nintendo Life, Aeos coins bị bỏ 12/2025](https://www.nintendolife.com/news/2025/11/pokemon-unite-is-discontinuing-aeos-coins-in-its-december-game-update).
- League of Legends: [ComicBook, Blue Essence earn rate](https://comicbook.com/gaming/amp/news/league-of-legends-blue-essence-earn-rate/),
  [Riot support, rewards breakdown](https://support.riotgames.com/en-us/league-of-legends/rewards/reward-bexp-system-breakdown).
- Brawl Stars: [timesaver.gg, daily freebie](https://timesaver.gg/blog/brawl-stars-daily-freebie),
  [Supercell, Bling shop changes](https://supercell.com/en/games/brawlstars/blog/news/changes-to-bling-shop-and-cosmetics).
- Khung kinh tế: [Unity, game economy design guide](https://unity.com/resources/game-economy-design-guide).
