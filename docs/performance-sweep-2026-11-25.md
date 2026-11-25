# Rà quét hiệu năng diện rộng và kế hoạch tối ưu — 25/11/2026 (PT)

Base `0909e29` trên main. Tài liệu này ghi **những gì đã đo**, **những gì đã
sửa trong đợt A** (cùng nhánh với tài liệu), và **phần còn lại theo thứ tự ưu
tiên**. Mỗi mục ghi rõ mức kiểm chứng:

- **[đo]** đã đo hoặc tái hiện bằng test trong session này;
- **[đọc]** rút ra từ đọc code (năm lượt rà song song), chưa đo: kiểm chứng
  lại trước khi sửa.

## 1. Kết luận ngắn

- **Server không phải nút cổ chai.** Render `element-arena` chạy `1c-2g`
  (1 CPU / 2 GB, Oregon) từ 23/11. Số thật 22–25/11: CPU đỉnh ~2,3% một core,
  RAM 80–172 MB / 2 GB, tick p95 0,6–0,9 ms trên ngân sách 33 ms, `serverHz`
  30 ở mọi trận. [đo, Render chỉ đọc]
- **Giật nằm ở máy người chơi, nặng nhất trên Android Chrome.** 40 báo cáo
  `arena-perf` 23–25/11: iPhone giữ 58,8 FPS, `work` 1–3 ms/frame. Pixel 8a:
  23–32 FPS, `work` 22 ms trước #423; sau #423 một duel Low đạt 59,5 FPS
  nhưng `work` vẫn 6,6 ms (p95 10,3). Chưa có raid nào của Pixel sau #423.
- **Nguyên nhân chính còn lại là cách code ghi vào HUD (DOM) trong trận**,
  không phải số particle: xem mục 2. Sửa xong, thời gian tính style trong
  duel giảm ~68%.
- **Hai lỗi server làm game "lỗi" chứ không chỉ chậm** (mục 3): rate limit
  dùng chung làm rớt lệnh nhảy/dash ở Plaza và chat/token trong trận; lỗi
  database tạm thời đá người chơi khỏi trận.

## 2. Đợt A — client trong trận (đã sửa, có test)

Cách đo: harness visual, duel Cindrake vs Voltkit, Low, 915×412@2, seed cố
định, 12 s, Chromium tracing + `Performance.getMetrics` + CPU profiler. Trước
= checkout `origin/main` (cổng riêng), sau = nhánh này, chạy xen kẽ.

| Cảnh (12 s)            | Style recalc trước → sau     | Phần tử / lần tính (trung vị, p90) | Phần tử / giây |
| ---------------------- | ---------------------------- | ---------------------------------- | -------------- |
| Duel                   | 1,34 → 0,41 s; 1,35 → 0,43 s | 55 / 109 → 4 / 16                  | 2.923 → 316    |
| Duel, CPU chậm 4×      | 2,55 → 0,88 s                | 55 / 109 → 4 / 20                  | 1.128 → 186    |
| Raid 4 người (Inkpurr) | 0,21 → 0,16 s                | 5 / 85 → 7 / 23                    | 419 → 203      |
| FFA 4 người            | 0,32 → 0,16 s                | 5 / 90 → 6 / 16                    | 771 → 177      |

(Renderer phần mềm chỉ 6–30 FPS nên số mỗi giây thấp hơn điện thoại 60 FPS;
không suy ra FPS máy thật từ đây. Lượt raid/FFA chỉ một cặp, lượt raid "sau"
có một lần sửa CSS giữa chừng: đo lại trước khi trích.)

Nguyên nhân, đều **[đo]** bằng trace có stack:

1. **Đọc `innerWidth > innerHeight` mỗi frame trong `ArenaScene.update`.**
   Trên Chrome mobile nó ép tính lại style + layout ngay giữa frame: 340 /
   406 ms self time của `update` trong 12 s, và gần 2 lần recalc mỗi frame.
   `match-flow-budget` không đếm loại đọc này. Sửa: `viewport-size.ts` giữ
   kích thước, đọc lại khi `resize` và tối đa mỗi 250 ms.
2. **`textContent =` tạo text node mới.** Chromium trả lời mọi node vào/ra
   bằng cách restyle mọi thứ một rule `:has()` có thể chạm tới (~55 phần
   tử). Ba nguồn: số hồi chiêu (10 lần/giây mỗi nút), tên trên mũi tên chỉ
   địch (mỗi frame, cùng một chữ), badge chat (mỗi snapshot qua `syncHub`).
   Sửa: `setHudText` đổi `data` của text node tại chỗ, không ghi khi trùng.
   Gỡ thử toàn bộ 111 rule `:has()` cho kết quả tương đương (0,64 s) — tức
   sửa cách ghi là đủ, không cần viết lại CSS.
3. **`--skill-sweep` (bản sao kế thừa của `--cooldown`)** làm mỗi lần vành
   hồi chiêu nhích là restyle toàn bộ hình SVG của icon (p90 109 phần tử).
   Sửa: vành tự lấy `--cooldown: inherit`; bỏ transition 70 ms chạy trên
   main thread; vành nhích theo bước 0,5%.
4. **`syncHub()` chạy 30 lần/giây trong trận** (đóng Lobby/Plaza, đặt nút
   chat, `clearTimeout`, `requestAnimationFrame`…). Sửa: `syncHubInBattle`
   chỉ chạy khi thứ nó đọc đổi, và 1 lần/giây.
5. Ghi `hidden` trùng giá trị (banner spectate, nút chat, nameplate, mũi
   tên): mỗi lần restyle 1 phần tử. Sửa: `setHudHidden`.
6. `dialog::backdrop` blur 5 px phủ lên trận đang vẽ: bỏ blur khi
   `body.battle-active`.

Test: `tests/unit/hud-dom.test.ts`, `tests/unit/viewport-size.test.ts`.
**Phần nợ của đợt A, đã làm xong trong cùng PR:**

- `tests/visual/battle-style-budget.spec.ts` siết còn trung vị ≤ 20, p90 ≤ 60
  (trước 120 / 220). [đo] Nhánh này 4 / 16 ở cả bốn lượt; `origin/main`
  (`4846edb`) đỏ ở 55 / 109.
- Mục 20 của `docs/network-performance.md` đã viết.
- Auto quên một lần mức đã học trước bản này (`LEARNED_GENERATION` trong
  `battle-quality.ts`, khoá `ea-battle-learned`), có unit test.
- **Lỗi khi gục trong raid** [đo bằng `tests/visual/raid-downed-writes.spec.ts`]:
  trên main, 30 snapshot = 60 lần ghi vào thẻ hồi sinh (dựng lại cả thẻ) và
  450 lần ghi `disabled` lên nút touch; nay là 0. Sửa bằng `setHudMarkup` và
  `TouchControls.downed`.
- Chưa sửa, vì chưa đo thấy tốn [đọc]: `touch-controls.ts` `aria-label` (đã
  qua `setHudAttribute`), `classList.toggle/remove` cùng giá trị trong
  `renderBattle`, `prismatail-controls.ts:79,87`. Số đo duel (4 / 16) cho
  thấy chúng không còn là nguồn restyle đáng kể; raid Prismell chưa đo riêng.

## 3. Đợt A — server (đã sửa, có test)

- **Rate limit dùng chung một bộ đếm mỗi socket** [đo bằng test]:
  `input` (30/giây) và `plaza-input` (tới 20/giây) ăn hết hạn mức 10/giây
  của lệnh khác. Trong trận: `chat-send` và `token` chỉ lọt trong 1/3 đầu
  mỗi giây (token rớt 5 lần liên tiếp → bị đăng xuất giữa trận). Ở Plaza:
  `plaza-jump`/`plaza-dash`/`plaza-trip` bấm khi đang lái cần bị rớt, server
  để nhân vật dưới đất và kéo ngược lại — khớp với các báo cáo "nhảy bị
  khựng" ở đường chạy. Sửa: `allowedStream` cho hai luồng này.
  Test: `network.test.ts` "keeps a battle's input stream…",
  `plaza-network.test.ts` "jumps and dashes while the stick is being
  steered" (cả hai đỏ khi bỏ sửa).
- **Lỗi kiểm tra tài khoản định kỳ đá người chơi** [đo bằng test]:
  `refreshSocket` coi mọi lỗi khác 401 (503 từ Supabase, lỗi mạng, reply
  hỏng) là thu hồi quyền → `detach(session, true)` = xử thua. Sửa: chỉ 401
  (sau 4 lần) và 403 mới đăng xuất; lỗi khác ghi log
  `arena-account-check-failed` và giữ ghế. Test: "keeps a player's seat…".

## 4. Còn lại — server [đọc]

| #   | Việc                                                                                                                                                                                                                                                       | Ghi chú                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **BẢO MẬT, cần chủ game quyết:** rate limit HTTP theo `req.ip` nhưng không có `trust proxy` (`apps/server/src/accounts.ts:562-586`) → sau proxy của Render mọi người chung một xô 120/phút; ~12 người online có thể tự chạm trần, ai cũng có thể làm nghẽn | Chưa kiểm trên Render: log `req.ip` và `x-forwarded-for` một lần                                                                                                                                                                                     |
| S2  | Phòng không đánh (lobby, kết quả, tạm dừng) vẫn nhận 30 snapshot/giây (`server.ts` `step`), client chạy cả `renderMenu` mỗi lần                                                                                                                            | Gửi khi đổi + 1–2 Hz; đếm ngược 5–10 Hz. −95% byte phòng chờ                                                                                                                                                                                         |
| S3  | Bão refresh tài khoản mỗi 30 s: ~20–25 round trip Supabase mỗi người, tất cả cùng một giây, rồi `account-changed` vô điều kiện làm client tải lại 5 API                                                                                                    | Rải theo socket, chỉ emit khi đổi, cache `authenticate` 30–60 s                                                                                                                                                                                      |
| S4  | Raid Snoozaku encode N+1 lần mỗi tick (`server.ts:1427-1479`)                                                                                                                                                                                              | Chỉ đi đường riêng khi `dreamFor()` có giá trị                                                                                                                                                                                                       |
| S5  | Một exception trong tick/handler dừng mọi trận (không try/catch quanh từng phòng, không `unhandledRejection`)                                                                                                                                              | Bọc từng phòng, đóng riêng phòng lỗi                                                                                                                                                                                                                 |
| S6  | `/api/friends` quét mọi socket cho từng bạn (O(bạn × socket))                                                                                                                                                                                              | Dựng map online một lần                                                                                                                                                                                                                              |
| S7  | 75–80% mỗi snapshot là dữ liệu không đổi (~147 KB/s/người ở FFA, ~530 MB/giờ)                                                                                                                                                                              | Giao thức delta có cờ năng lực; bản cũ vẫn nhận bản đầy đủ. **[đo, 25/11]** 47–62% byte lặp lại theo từng trường, delta bớt 68–78% byte (FFA 139 → 44 KB/s); không có nén WebSocket; bật nén thì CPU server gấp đôi: `network-performance.md` mục 21 |
| S8  | Thiếu timeout/retry cho ghi thưởng; push thông báo chặn 10–30 ms mỗi lô; tick bù vẫn broadcast                                                                                                                                                             | Nhỏ                                                                                                                                                                                                                                                  |
| S9  | BẢO MẬT (cứng hoá): practice gọi `authorize` dưới hạn 90/giây; socket token giả gọi Supabase không giới hạn                                                                                                                                                | Cùng S1                                                                                                                                                                                                                                              |

## 5. Còn lại — tải về, khởi động, bộ nhớ [đọc; kích thước đã đo từ build]

Build `0909e29`: entry JS 2.731 kB (914 kB gzip), Phaser 1.482 kB, CSS
939 kB (175 kB gzip), precache 12,0 MB / 122 mục.

| #   | Việc                                                                                                                                                 | Lợi ích ước tính                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| L1  | ~39% entry là code chỉ dùng trong trận (7 boss ~1,6 MB nguồn, skill fx, Spire) → một chunk "battle kit" tải cùng Phaser, rồi chunk theo boss         | entry −1,07 MB (−357 kB gzip)              |
| L2  | Mã commit (`__BUILD__`) nằm trong entry → mỗi deploy đổi tên mọi chunk, điện thoại tải lại ~1 MB gzip dù 28% deploy không đụng client                | Đưa build id vào `<meta>` của `index.html` |
| L3  | Precache: 54 file fighter không bao giờ được tải lúc chạy, 2 icon 512, 13 tranh loading (3 MB) cài trước Phaser; file không hash có `revision: null` | precache −4 MB, Lobby đầu tiên nhanh hơn   |
| L4  | Entry ở 87% trần 3 MiB của precache: thêm ~414 kB là **build deploy vỡ**                                                                             | Làm L1 trước khi thêm nhiều skin           |
| L5  | CSS khung avatar: 325 KB SVG inline (39% CSS gzip) chặn first paint                                                                                  | Xuất thành file `url()`                    |
| L6  | `rigAssets` dựng lại 64 SVG mỗi look trên main thread, mỗi trận; fighter có skin giữ 2 bộ texture (~7,6 MB dư mỗi fighter)                           | Memo + bỏ bộ gốc                           |
| L7  | Plaza giữ ~75 MB canvas trên Android 4 GB, không thu nhỏ khi đóng                                                                                    | `width = height = 0`                       |
| L8  | Admin + 5 màn hub + supabase-js đầy đủ nằm trong entry                                                                                               | −250 kB                                    |

## 6. Còn lại — trong trận, GPU/JS [đọc]

- Vật thể tạo theo từng đòn ngoài fx engine: `court-surface-fx.ts`
  `surfaceBurst` (11–18 Image + 19–26 tween mỗi hit, Low không giảm),
  `skill-effects.ts` `shot` (106 chỗ gọi), vòng `this.add.circle`.
  `effect-rules.test.ts` không phủ các file này.
- Tessellation: `graphics-render.ts` `convexPath` gọi `hypot`/`atan2` mỗi
  điểm; `battle-curves.ts` sàn 16 đoạn cho cả tia lửa 2 px; ellipse cố định
  32 đoạn; vẫn tessellate khi alpha 0. Profile 4 người: ~45k vertex/frame.
- Decal tĩnh (tối đa 25, 2–5 s) vẽ lại mỗi frame; lớp ADD rỗng vẫn ép flush.
- Mỗi frame: `fighterPack()` chạy zod parse; `rigKey` + `assets.find`;
  `graphicsSetting()` đọc localStorage 3–5 lần.
- Nameplate: `filter: drop-shadow` mỗi plate; danh hiệu Master/Grandmaster/
  Legendary animate `text-shadow`/`background-position` vô hạn trong trận
  (paint mỗi vsync, ngoài frame cap).
- Thanh máu boss dùng `width` (layout mỗi snapshot); mù Glare dùng
  `backdrop-filter: blur(6px)` toàn màn hình.
- Mỗi phần rig là một texture → 13–14 draw call mỗi fighter trên mobile
  pipeline (56/78 draw ở 4 người). Đo thời gian GPU process trước khi gộp
  atlas.
- Ghi chú "raid vẽ lại cảnh mỗi frame" trong `network-performance.md` đã
  lỗi thời: cảnh và thân boss đều đã bake; còn lại là vòng cảnh báo.

## 7. Còn lại — màn hình chờ [đọc; Lobby idle đã đo: JS ~3,5%]

- Rig sống (Lobby, ghế party, Shop, Roster) không có trần 60 FPS trên màn
  120 Hz (`shop-preview.ts` `postBoot`). **Hỏi chủ game trước**: ngày 17/11
  chủ game phản ánh aura giật trên iPhone 17 Pro Max, nên đổi nhịp vẽ ở đây
  là việc cảm nhận.
- Plaza vẫn vẽ dưới thẻ người chơi; canvas Colors ẩn trong Shop vẫn chạy
  30 FPS; Shop dựng lại toàn bộ markup mỗi lần chạm (18 SVG fighter inline).
- Vòng poll gamepad mỗi frame ở mọi menu; `audio.ts` interval 25 ms không
  bao giờ dừng, AudioContext không suspend; kiểm tra update PWA mỗi 60 s kể
  cả giữa trận.
- Plaza ghi `hidden` mỗi frame làm hỏng cache che phủ của chính nó.

## 8. Thứ tự đề xuất

1. **Đợt A** (nhánh này): hoàn tất phần nợ ở mục 2, PR, FULL lane.
2. **Đo lại trên Pixel 8a** sau khi A lên production: duel + raid, Auto.
   `work` kỳ vọng giảm rõ; nếu raid vẫn < 50 FPS thì làm mục 6 theo trace.
3. **Đợt B — server:** S2, S3, S4, S5 (S1/S9 chờ chủ game).
4. **Đợt C — tải về:** L2, L3 (rủi ro thấp), rồi L1 (trước khi entry chạm
   trần L4).
5. **Đợt D — trong trận:** lỗi gục raid, `surfaceBurst`/`shot` qua fx
   engine, tessellation, danh hiệu tĩnh trong trận.
6. **Đợt E:** giao thức delta (S7) — lớn nhất, làm sau cùng.

## 9. Ghi chú cho phần Shop (cùng yêu cầu của chủ game)

Bản đồ đầy đủ của Shop/cosmetics do lượt rà thứ năm lập; các điểm đổi kế
hoạch [đọc]:

- `packages/shared/src/shop.ts` là nguồn; database quyết giá và mua. Mọi
  thay đổi catalog cần migration (FULL lane), chạy lại được.
- **Bản client cũ sẽ lỗi ở tab Today khi Today's Pick là id nó không biết**
  (`fitting-room-view.ts` `shopTile` dùng `purchase(id)!`): pick lấy đều từ
  mọi món active, nên thêm 72 món → ~52% ngày có pick lạ. Cần chặn (lọc pick
  ở client và/hoặc loại món mới khỏi pick) trước khi thêm món.
- Test khoá số lượng hiện tại (`shop-catalog.test.ts` 18 skin/tướng
  `[18,3,5,5,4,1]`, 30 look item, 11 skin set…) và id mới có thể trùng id
  phần thưởng (`astral-aura`, `nova-entrance`, `ember-aura`…) mà không test
  nào bắt.
- Giá hiện tại: skin 500 / 1.500 / 3.500 / 5.500 / 8.000; thu nhập trung vị
  ~310–440 xu/ngày chơi; mới có 5 lượt mua, 324 skin + 30 look item đang bán
  (`docs/economy-review.md`). Điểm yếu trình bày: độ hiếm gần như không
  hiện trên tile, hai màu Mythical khác nhau, lưới Skins không sắp xếp,
  thumbnail nhỏ cùng một dáng, tile hiệu ứng/khung trống, không có nhãn
  "New". Có sẵn một bộ chưa bán: theme `idol` ("Starlight Idol") trong
  `skins/modern-fashion.ts` + `modern-designs.ts`.
