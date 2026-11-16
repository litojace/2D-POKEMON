# Bộ prompt giao việc cho AI khác

Mỗi prompt dưới đây giao **một** việc lớn. Cách dùng:

1. Mở một phiên AI mới (Claude Code hoặc AI khác có quyền vào repo `litojace/2d-pokemon`).
2. Dán **Phần A — Bối cảnh chung**, rồi dán **một** prompt ở Phần B ngay bên dưới.
3. Làm từng prompt một, theo thứ tự đề xuất. Prompt sau có thể dựa vào kết quả của prompt trước.

Thứ tự đề xuất: B1 → B2 → B3 → B4 → B5 → B6. Riêng B6 (cải tổ hình ảnh) chỉ làm bản mẫu để duyệt trước.

---

## Phần A — Bối cảnh chung (dán đầu mọi prompt)

```text
Bạn làm việc trên repo game "Element Arena" (litojace/2d-pokemon): game đấu creature 2D chạy trên web và iOS (Capacitor), sắp lên App Store. Hub có 4 tab: Lobby, Plaza, Farm, Bistro.

Cấu trúc:
- apps/client: client (Vite + TypeScript). Plaza/Farm/Bistro vẽ bằng Canvas 2D tự viết (KHÔNG dùng Phaser); trận đấu PvP/Raid dùng Phaser.
  - Farm: apps/client/src/farm/ (farm-scene.ts ~7.900 dòng, // @ts-nocheck, ported từ prototype; farm-gfx.ts = art vẽ bằng code, sprite nướng sẵn qua GFX.sprite/blit; farm-path.ts = đường đi của chó; farm.css).
  - Bistro: apps/client/src/bistro/ (bistro-scene.ts, bistro-art.ts, bistro-furniture.ts, bistro-scenery.ts = cảnh phố xung quanh, isometric).
  - Plaza: apps/client/src/plaza/.
  - Ánh sáng dùng chung: apps/client/src/world-light.ts (bóng đổ theo mặt trời ShadowLayer, bản đồ ánh sáng đêm NightLight; tắt ở mức đồ hoạ Low).
- apps/server: server Node (Express). Chỉ kiểm tra dữ liệu gửi lên (zod, apps/server/src/accounts.ts) rồi gọi hàm RPC của Supabase.
- packages/shared/src: LUẬT DÙNG CHUNG (farm.ts, bistro.ts, ...). Client chạy trước để phản hồi ngay; database chạy ĐÚNG luật đó và là nguồn sự thật.
- supabase/migrations: SQL. Migration mới đặt tên kiểu timestamp `YYYYMMDDHHMMSS_ten.sql`, sau migration mới nhất. Mỗi migration phải "Safe to run again" (chạy lại không hỏng dữ liệu). Hàm cũ muốn đổi: rename hàm cũ rồi tạo hàm mới bọc nó (xem 20261116120000_farm_free_decor.sql làm mẫu).
- docs/: tài liệu thiết kế. Đọc docs/hub-redesign/README.md (Farm, Plaza), docs/hub-redesign/NUMBERS.md (con số kinh tế), docs/bistro-gdd.md (Bistro), docs/network-performance.md (hiệu năng).

Quy tắc BẮT BUỘC:
1. Server quyết định. Mọi thứ liên quan tiền tệ, thời gian, phần thưởng: luật ở packages/shared, SQL mirror đúng luật đó, và có test tích hợp (tests/integration, chạy migration thật trên PGlite) SO SÁNH kết quả SQL với luật shared. Thời gian lấy từ server (timestamp), không lấy từ đồng hồ máy hay frame dt.
2. Chữ trong game bằng TIẾNG ANH. Tài liệu/ghi chú cho chủ game có thể tiếng Việt.
3. Hiệu năng máy cũ: không đọc layout mỗi frame; ảnh/sprite nướng sẵn rồi stamp; mọi hiệu ứng mới phải có đường tắt ở mức đồ hoạ Low. Đọc CLAUDE.md ở gốc repo.
4. Giao diện: hộp HUD cố định kích thước, số dùng tabular, nút thẳng hàng, điện thoại ngang (844×390, có Dynamic Island 852×393) không được chồng chéo. Icon theo bộ duotone sẵn có (apps/client/src/farm/farm-icons.ts).
5. Không sao chép tên, hình, nhân vật của game khác (Hay Day...). Chỉ lấy cảm hứng cơ chế.
6. Test: đọc CLAUDE.md, phần "Running tests quickly". Chạy unit/integration các file liên quan; test hình (Playwright) chỉ các spec liên quan, có fake server trong trang (tests/visual/farm-fake.ts, bistro-fake.ts): cập nhật fake khi thêm action mới. Không chạy toàn bộ bộ test hình. Không sửa source khi test hình đang chạy. Chạy `npm run -s typecheck && npm run -s build`. Prettier chỉ trên file đã sửa.
7. Một test hình không được qua nhờ may mắn: phá tính năng thử, thấy test fail, rồi trả lại.
8. Commit trên nhánh được giao (không push thẳng main), message rõ ràng. Không tạo pull request trừ khi chủ game yêu cầu.
9. Khi xong: báo cáo bằng tiếng Việt, ngắn gọn: đã làm gì, test nào qua/fail (kèm output), việc chủ game phải làm khi deploy (vd. chạy migration nào), và câu hỏi còn mở. Gửi ảnh chụp màn hình (VISUAL_SHOTS=<thư mục>).
10. Trước khi code phần lớn, nếu có quyết định thuộc về chủ game (giá, cân bằng, tên gọi) mà không suy ra được từ tài liệu: đề xuất mặc định hợp lý, ghi rõ, và hỏi trong báo cáo thay vì dừng lại.

Hiện trạng gần nhất (tháng 11/2026):
- Farm: 50 ô ruộng (10×5), 25 cây trồng, thời tiết + đột biến, chợ giá theo ngày, bảng đơn hàng, kho (barn) nâng cấp được, chó canh, quạ, bọ, bạn bè (thăm, tưới, trộm, chơi khăm), đồng cỏ bò cho Storm Milk, sổ cây trồng + mastery, cây khổng lồ, farmer perk. Đồ trang trí VỪA chuyển sang đặt TỰ DO (migration 20261116120000): bảng arena_farm_decor_pieces (x, y trên lưới 10px, flip), luật decorFits/DECOR_BLOCKS/decorCap trong packages/shared/src/farm.ts, client có chế độ chỉnh sửa (kéo thả, Mirror, Put away), 19 món.
- Bistro: nhà hàng isometric, nấu món, khách, nhân viên, ~40 món nội thất đặt tự do trên lưới, 3 sàn + 3 tường, sự kiện, giải đấu tuần, chi nhánh. Nguyên liệu có thể lấy từ Farm (fromFarm, FARM_TO_BISTRO trong packages/shared/src/bistro.ts).
- Plaza/Farm có bóng đổ theo giờ và đèn đêm (world-light.ts).
```

---

## Phần B — Các prompt

### B1. Farm: chuỗi chế biến đầu tiên (Bakery)

```text
NHIỆM VỤ: Thêm chuỗi chế biến đầu tiên cho Farm, để người chơi có việc làm lâu dài: biến nông sản thành hàng giá trị cao hơn (cảm hứng cơ chế: game nông trại có máy chế biến). Đây là thứ giữ chân người chơi lâu nhất; hiện Farm chỉ trồng rồi bán.

Phạm vi:
1. Một toà nhà mới "Bakery" trên Farm (đặt ở chỗ trống hợp lý trong cảnh; cập nhật DECOR_BLOCKS ở packages/shared/src/farm.ts và SQL arena_farm_decor_fits cho khớp để đồ trang trí không đè lên nó; viết migration chuyển đồ trang trí đang đứng chỗ đó vào kho nếu có).
2. Mở khoá ở một cấp farm (đề xuất Lv 10), mua bằng Gold Leaves.
3. 4–6 công thức, nguyên liệu lấy từ kho barn (cây trồng thường, Storm Milk). Ví dụ: Bread (wheat), Cornbread (corn + milk), Carrot Cake (carrot + wheat + milk)... Mỗi công thức: nguyên liệu, thời gian (theo đồng hồ server), XP, giá bán, cấp mở. Đề xuất con số cân bằng dựa trên docs/hub-redesign/NUMBERS.md và economy (docs/hub-redesign/economy/): sản phẩm phải đáng hơn bán nguyên liệu thô nhưng không phá giới hạn đổi leaves → coins.
4. Hàng chờ sản xuất: 2 ô lúc đầu, mua thêm ô bằng leaves (tối đa 5). Chạy cả khi offline. Thu hoạch bằng chạm. Sản phẩm vào barn (chiếm chỗ kho như cây trồng).
5. Bán ở chợ/market và được dùng trong bảng đơn hàng (orders). Tuỳ chọn: một số sản phẩm gửi được sang Bistro làm nguyên liệu (fromFarm) nếu hợp lý.
6. Giao diện: chạm toà nhà mở sheet (theo kiểu các sheet hiện có trong farm-scene.ts: market, barn), hiện công thức, hàng chờ với vòng tiến độ, nút tăng tốc nếu có (hỏi chủ game trước khi thêm tiêu tiền thật).
7. Art: vẽ toà nhà bằng code trong farm-gfx.ts theo phong cách sẵn có (đồ chơi mềm, sáng từ trên-trái, viền tối nhẹ), có khói ống khói khi đang nướng, cửa sổ sáng ban đêm (thêm vào NightLight trong farmLights), đổ bóng (thêm vào drawCastShadows). Icon sản phẩm duotone.

Kỹ thuật:
- Luật ở packages/shared/src/farm.ts (hoặc file mới farm-bakery.ts): công thức, hàm kiểm tra bắt đầu/thu hoạch, tính thời điểm xong.
- Migration mới: bảng hàng chờ (player_id, slot, recipe, started_at, ready_at), hàm action trong arena_farm_act_more (bọc hàm hiện có như migration 20261116120000 làm), trạng thái trả về trong arena_farm_state.
- Server zod (apps/server/src/accounts.ts) thêm action mới; test tests/integration/accounts.test.ts.
- Test tích hợp so SQL với shared; test unit cho luật; test hình (farm.spec.ts + farm-fake.ts) cho mở sheet, bắt đầu, thu hoạch, trên 1280×800 và 844×390.

Tiêu chí xong: người chơi mở được Bakery, nướng, thu, bán; offline vẫn chạy; không cách nào gian lận qua client; mọi test liên quan qua; ảnh chụp màn hình.
```

### B2. Farm: chuồng gà và vật nuôi cho sản phẩm

```text
NHIỆM VỤ: Vật nuôi trên Farm hiện chỉ để trang trí (gà đi lại) trừ bò cho Storm Milk. Thêm "Chicken Coop": gà đẻ trứng khi được cho ăn, trứng là nguyên liệu cho Bakery (B1 đã làm) và bán được.

Đọc trước: cách đồng cỏ bò (PASTURE, MILK trong packages/shared/src/farm.ts; migration 049_farm_pasture.sql, 064) làm, rồi làm chuồng gà theo cùng khuôn mẫu.

Phạm vi:
1. Chuồng gà mua bằng leaves ở một cấp (đề xuất Lv 14), đặt ở chỗ trống (cập nhật DECOR_BLOCKS + SQL fits như B1).
2. Thức ăn: "Chicken Feed" làm từ wheat + corn ở một máy "Feed Mill" (dùng chung khung hàng chờ của B1) hoặc mua; đề xuất cách đơn giản nhất phù hợp kinh tế.
3. 3 con gà lúc đầu, mua thêm tối đa 6. Mỗi con: cho ăn → sau X giờ (server) có 1 trứng; chạm để nhặt. Gà trong chuồng hiện trạng thái (đói/đang ấp/có trứng) bằng bong bóng nhỏ.
4. Trứng vào barn; dùng trong công thức Bakery mới (vd. Egg Bun, Pancake) và đơn hàng.
5. Art bằng code (GFX.chicken đã có), chuồng gỗ, đổ bóng, đèn đêm như B1.

Kỹ thuật và test như B1 (shared + migration + so SQL/shared + zod + farm-fake + farm.spec trên 2 kích thước).
```

### B3. Farm: thêm nhiều đồ trang trí có hình vẽ mới và bộ sưu tập

```text
NHIỆM VỤ: Hệ thống đặt trang trí tự do đã có (migration 20261116120000, FARM_DECOR trong packages/shared/src/farm.ts, drawDecor trong apps/client/src/farm/farm-scene.ts). Danh mục mới có 19 món, quá ít so với game nông trại. Thêm 30+ món có hình vẽ mới và bộ sưu tập theo chủ đề.

Phạm vi:
1. 30+ món mới, chia nhóm (thêm trường `group` vào FARM_DECOR và cột SQL): Fences & paths (hàng rào ngắn, cổng nhỏ, ô lát đá, lối sỏi — loại "đường" có thể đặt sát nhau), Flowers & plants, Trees, Furniture (bàn picnic, xích đu, ô dù), Water (đài phun nhỏ, ao mini, cầu gỗ), Lights (đèn lồng, đèn dây, đuốc), Animals statues, Seasonal (Halloween, Lunar New Year, Christmas — chỉ mua được trong mùa, theo giờ server).
2. Kích thước w/d hợp lý cho từng món; món "đường/lát" có thể cho đè lên nhau? Đề xuất luật rõ ràng (vd. lớp "ground" không va chạm với món khác cùng lớp nhưng vẫn va với vật cản); cập nhật decorFits + SQL + test so khớp.
3. Bộ sưu tập: đủ bộ (vd. 5 món "Cottage Garden") cho thưởng Charm thêm; hiện trong sheet Decorate với tiến độ.
4. Sheet Decorate: thêm tab theo nhóm hoặc bộ lọc, ô tìm kiếm không cần; hình xem trước mỗi món (render sprite thật vào ô nhỏ thay vì icon chung).
5. Món có ánh sáng (đèn) thêm vào NightLight (farmLights) và đổ bóng (drawCastShadows) qua một bảng cấu hình, không viết if từng món.
6. Art: vẽ bằng code trong farm-gfx.ts theo phong cách sẵn có, nướng sprite một lần (memo). Giữ hiệu năng: 60 món trên farm vẫn mượt ở mức Low.

Giá/Charm/cấp: đề xuất theo tỉ lệ các món hiện có (giá/charm ~300–600 leaves cho mỗi charm), ghi bảng trong báo cáo.

Kỹ thuật và test: migration seed món mới (cột w, d, group), test tích hợp danh mục khớp shared, test so decorFits với SQL (đã có trong tests/integration/farm-decor.test.ts, mở rộng), test hình cho sheet mới và đặt một món mỗi nhóm; ảnh chụp sheet + farm có nhiều món.
```

### B4. Bistro: tuỳ biến trang trí nhà hàng tới nơi tới chốn

```text
NHIỆM VỤ: Bistro đã có ~40 món nội thất đặt trên lưới (ITEMS trong packages/shared/src/bistro.ts, chế độ edit trong bistro-scene.ts), 3 sàn (FLOORS) và 3 tường (WALLS). Người chơi muốn tuỳ biến sâu hơn.

Phạm vi:
1. Đồ treo tường: tranh, kệ, đồng hồ, gương, cây treo, biển neon nhỏ — đặt trên 2 bức tường trong (tường trái và tường sau của phòng isometric) theo lưới riêng của tường; không đè cửa sổ/cửa ra vào/biển "ELEMENT BISTRO". Có luật va chạm trong shared + SQL + test so khớp.
2. Thêm sàn và tường: ít nhất 6 sàn + 6 tường mới (gỗ tối, đá cẩm thạch, gạch hoa, giấy dán tường hoạ tiết...), vẽ bằng code trong bistro-art.ts, nướng sẵn.
3. Biến thể màu cho món nội thất: mỗi món chính (bàn, ghế, sofa...) có 3–4 màu; đổi màu là thuộc tính của món đã đặt (không phải món mới), giá đổi màu nhỏ hoặc miễn phí — đề xuất.
4. Mặt tiền: đổi màu/kiểu mái hiên, kiểu biển hiệu, chậu cây cửa, bàn ghế ngoài trời trên vỉa hè (vùng đặt riêng ngoài phòng).
5. Bộ chủ đề: đủ bộ (vd. "Seaside Café": sàn + tường + 4 món) cho thưởng Charm/Popularity nhỏ — phải khớp luật Popularity trong docs/bistro-gdd.md mục 4, không phá cân bằng.
6. Giao diện Decor: tab Floors / Walls / Wall decor / Furniture / Outdoor / Sets; xem trước trước khi mua.

Đọc trước: docs/bistro-gdd.md (mục 3, 4, 9, 10), migration 068, 100, 104 và các migration bistro mới nhất; tests/visual/bistro*.spec.ts và bistro-fake.ts (fake chạy luật shared qua window.__bistroRules).

Kỹ thuật và test: luật shared + migration + test tích hợp so SQL/shared + zod server + bistro-fake + bistro.spec/bistro-layout.spec trên 1280×800 và 844×390; ảnh chụp trước/sau.
```

### B5. Bistro: khung cảnh xung quanh sống động

```text
NHIỆM VỤ: Cảnh quanh Bistro (apps/client/src/bistro/bistro-scenery.ts) hiện chỉ là cỏ, một con đường, vài căn nhà và cây: tĩnh và chán. Làm thành một góc phố sống động, chỉ là hình ảnh (không đổi luật game, không cần migration).

Phạm vi:
1. Bên kia đường: dãy cửa hàng hàng xóm có mặt tiền riêng (tiệm hoa, tiệm bánh, tiệm sách...), biển hiệu, mái hiên, cửa sổ sáng ban đêm.
2. Một công viên nhỏ hoặc quảng trường: ghế, đài phun nước, cây, chim bồ câu đi lại.
3. Người đi đường: creature của game (dùng art champion có sẵn như Plaza dùng) đi bộ trên vỉa hè, dắt chó, đạp xe; xe buýt dừng ở trạm; xe cộ đã có thì giữ.
4. Sông/kênh có cầu nếu đủ chỗ, hoặc đồi xa có cối xay gió — chọn cái hợp bố cục isometric.
5. Theo giờ thiết bị như hiện tại (bình minh, trưa, chiều tà, đêm): đèn đường, cửa sổ, biển hiệu sáng; thêm theo mùa (lá vàng mùa thu, tuyết mùa đông, hoa anh đào mùa xuân) theo ngày server.
6. Hiệu năng: phần tĩnh nướng sẵn vào canvas như sceneryCanvas đang làm (chỉ vẽ lại khi ánh sáng đổi); phần động (người, xe, chim) số lượng giảm ở mức Low; không thêm đọc layout mỗi frame.

Kỹ thuật: chỉ client. Test hình: chụp Bistro lúc trưa, chiều tà, đêm ở 1280×800 và 844×390 (bistro.spec.ts có b.setTod); không làm chậm các spec hiệu năng (đọc CLAUDE.md, chạy riêng spec hiệu năng nếu đụng tới vòng lặp vẽ). Ảnh chụp trước/sau cho chủ game.
```

### B6. Cải tổ chất lượng hình ảnh 2D (chỉ làm bản mẫu để duyệt)

```text
NHIỆM VỤ: Chủ game muốn hình ảnh Plaza, Farm, Bistro "chân thật, chất lượng cao hơn" nhưng vẫn là 2D (đã thử 2.5D bằng Three.js và quyết định giữ 2D). Bước này CHỈ làm bản mẫu để chủ game duyệt, chưa sửa game.

Làm:
1. Nghiên cứu ngắn (có nguồn) cách các game 2D/isometric mobile thành công làm hình đẹp: chất liệu bề mặt, ánh sáng, bóng góc (ambient occlusion), viền sáng (rim light), độ chi tiết, bảng màu. Ghi rõ nguồn; điều gì không xác minh được thì nói rõ.
2. Một trang HTML độc lập (Canvas 2D, không thư viện nặng) dựng lại 1 góc Farm và 1 góc Bistro theo 2 hướng hình ảnh khác nhau (vd. "painted storybook" và "crisp toy"), mỗi hướng có: vân cỏ/đất/gỗ/đá, bóng góc dưới vật, viền sáng phía mặt trời, bóng đổ theo giờ (dùng cách của apps/client/src/world-light.ts), so sánh cạnh ảnh hiện tại (chụp từ test hình).
3. Đo chi phí: thời gian vẽ mỗi frame trên máy test, số lần drawImage, kích thước sprite nướng; đề xuất cái gì nướng sẵn được.
4. Báo cáo cho chủ game: 2 hướng, ưu nhược, ước lượng công sức để áp dụng cho toàn bộ Plaza/Farm/Bistro, và rủi ro máy cũ.

Không sửa apps/ trong bước này. Lưu bản mẫu ở docs/visual-study/ (HTML + ảnh chụp). Sau khi chủ game chọn hướng, sẽ có prompt riêng để áp dụng.
```

---

## Ghi chú cho chủ game

- Mỗi khi AI báo xong một việc có **migration mới**, nhớ chạy migration đó trên Supabase **cùng lúc** deploy server mới; nếu không, người chơi sẽ gặp lỗi ở tính năng đó.
- Việc đang chờ deploy hiện tại: `supabase/migrations/20261116120000_farm_free_decor.sql` (đặt trang trí tự do cho Farm).
- Nếu AI hỏi về giá, cân bằng hay tên gọi, đó là quyết định của bạn; các con số kinh tế hiện tại ở `docs/hub-redesign/NUMBERS.md` và `docs/bistro-gdd.md`.
