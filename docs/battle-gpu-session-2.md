# Trận đấu — đợt 2: VFX khi iOS Low bị chậm

Ngày 24 Nov 2026, US Pacific. Base `e4c7bde9` trên main, sau input-clock
đợt 1 (#411). Mục tiêu là **iPhone 11-class/iOS ở Low** và **Pixel 8a/Android**
vẫn bị giật. Chủ game dùng iPhone 17 Pro Max khá mượt; báo cáo cùng trận
cho phép đối chiếu máy và server.

## Báo cáo trận thật mới nhận

Đọc Render My Workspace ở chế độ chỉ đọc. Có 18 báo cáo trên build
`e4c7bde`, kết thúc 13:03–13:40 PT ngày 24 Nov; trong đó có tám cặp Android
web/iPhone cùng trận, một Android đấu bot và một iPhone raid không có
báo cáo đối ứng. [Số kỹ thuật đã bỏ match id](battle-gpu-phone-reports-2026-11-24.json).
Chủ game xác nhận Android là **Pixel 8a**; thông số 8 GB/9 core và viewport
915×412 trong log phù hợp. Telemetry chưa tự ghi model Android hay phiên
bản browser; chưa quy mọi lỗi cho một loại phần cứng hoặc gọi đây là giới
hạn tất yếu của điện thoại quá yếu.

Ba cặp raid cuối có số liệu sau (FPS của report tính từ trung vị frame):

| Trận kết thúc PT | Android Low FPS / frame p95 | iPhone High FPS / frame p95 | Android press→send p95 | Android RTT p95 |
| ---------------- | --------------------------- | --------------------------- | ---------------------: | --------------: |
| 13:36 Prismell   | 23,4 / 68,1 ms              | 58,8 / 21 ms                |                 150 ms |          161 ms |
| 13:38 Lumiwick   | 25,1 / 60,7 ms              | 58,8 / 18 ms                |                 123 ms |        1.004 ms |
| 13:40 Lumiwick   | 24,9 / 62,2 ms              | 58,8 / 19 ms                |                 135 ms |          615 ms |

- Android ở Auto đã chọn Low, density 1,25. Jank 0,826–0,861 là **tỷ lệ
  thời gian trong frame >34 ms**, không phải tỷ lệ packet mất. Chỉ 24–38
  particle trung vị và glow 0,04–0,08 màn hình, nên không có bằng chứng
  particle backlog là nguyên nhân chính của ba lượt này.
- Work trung vị Android 22,5–23,9 ms, p95 33,6–38,4 ms; iPhone 2/3 ms.
  Work đo PRE_STEP→POST_RENDER, có thể chứa JS, lệnh vẽ và chờ đồng bộ;
  **không phải** hai phép đo CPU JS/GPU riêng. Cần trace để phân biệt.
- Cùng trận, server 30 Hz, tick p95 0,9 ms, tick-lateness p95 1,1 ms.
  Metrics 13:30–13:42 PT ở độ phân giải một phút: CPU MAX cao nhất 4,78%
  của 1 core; RAM cao nhất khoảng 158 MiB trên 2 GiB. Chưa thấy quá tải
  server trong cửa sổ này; số một phút không loại trừ spike ngắn.
- Input trung bình Android gần 30 Hz, nhưng send-gap p95 96–104 ms và
  median có lúc 1 ms: gửi dồn sau lúc bị chặn, không phải cadence mượt.
  RTT p95 tăng ở hai lượt; RTT còn gồm thời gian chờ xử lý client, nên
  chưa quy toàn bộ spike cho Wi-Fi hay đường xa tới Oregon.
- iPhone render mượt vẫn có lượt press→send p95 cao (199 ms ở raid cuối;
  một duel 740 ms). Cần trace event→handler và thao tác giữ/nhả để kiểm
  tra riêng, không suy latency đầu vào chỉ từ FPS.
- Duel Low đầu có report FPS 50,5 nhưng các lát 15 giây lần lượt có đoạn
  57,7 → 29,2 rồi hồi 58,4, về cuối còn 27,8–36,9 FPS. Một số tổng hợp
  cho cả trận che mất đoạn chơi tệ. Chưa có dấu mốc round/trace nhiệt để
  quy mẫu này cho thermal, tích tụ hay một chiêu cụ thể. Các duel High
  và raid Low khác map/kit/party, không dùng chúng làm phép A/B chất lượng.

**Ưu tiên tiếp theo được cập nhật:** profile client mỗi frame trên Android
cũ, cả cảnh ít hiệu ứng và raid, tách scene/rig/DOM, WebGL và thermal trước
khi giảm thêm particle hoặc đổi server. Bản sửa VFX dưới đây giải quyết
một lỗi clock đã tái hiện; chưa thể coi là đã chữa giật của máy bạn.

## Lỗi tìm thấy, theo mức ảnh hưởng

1. **Particle/ground mark sống quá lâu khi frame clock bị làm mượt.**
   `apps/client/src/fx-engine.ts:333` ở base dùng `delta` của Phaser để tăng
   tuổi hiệu ứng. `TimeStep.smoothDelta` (Phaser 3.90) kẹp delta về mục tiêu
   16,7 ms trong warm-up/blur, và thay frame trên 200 ms bằng lịch sử cũ.
   Birth/trail và snapshot vẫn chạy theo thời gian thực. Hiệu ứng cũ vì vậy
   chưa hết tuổi khi chiêu mới tới, làm tăng việc vẽ, có thể chạm cap 700.
   Việc tăng cap bước từ 50 lên 200 ms trước đây chưa đủ: delta đầu vào
   đã mất thời gian trước khi tới engine.

   **Sửa:** tính tuổi bằng chênh timestamp PRE_UPDATE chưa làm mượt. Giữ
   một frame đầu cho burst/ground mark mới; chỉ kẹp bước tích phân chuyển
   động ở 200 ms. Expiry và nhịp hồi glow budget dùng toàn bộ thời gian đã
   trôi. Cần kiểm tra hiệu ứng mới sau hitch, hết tuổi của hiệu ứng cũ,
   tích phân khi gap dài, và các peak ở 60 Hz.
   Effect đã vẽ sẽ hết tuổi qua gap dài; effect còn `fresh` chưa từng vẽ
   có thể hiện một frame sau resume. Đây chưa phải xử lý toàn bộ lifecycle
   hoặc loại bỏ mọi event cũ nhận trong lúc ứng dụng bị ẩn.

2. **Fixture GPU có thể tạo so sánh sai.** Các vị trí kế thừa
   `(520/1040, 300/600)` nằm trong trụ cản của classic court; renderer vẫn
   làm việc nhưng trụ che fighter. Random của renderer và arena dùng chung
   `Math.random`, nên thay số particle có thể đổi cả quyết định của boss.
   Bỏ tick khi browser đứng cũng làm hai bản ở khác thời điểm trận.

   GPU mode nay đặt fighter vào chỗ trống, đợi rig đúng character tải xong
   trước khi khởi động clock trận, tách RNG
   mô phỏng khỏi trang trí, giữ HP để trận tiếp tục, giữ nợ tick với batch
   tối đa 10 tick/callback, ghi tiến độ arena, kiểm tra phase playing và
   buộc drift của cửa sổ mẫu dưới 500 ms.
   Các lượt cũ chưa có những kiểm soát này, hoặc có 15–20 s tick debt tràn
   vào cửa sổ mẫu, không dùng làm kết luận timing. Default CI scenarios
   giữ cách chạy cũ; các kiểm soát này dành cho `PERF_GPU=1`.

3. **Auto bỏ qua mọi frame trên 250 ms.**
   `apps/client/src/battle-quality.ts:282` ở base bỏ mẫu và kéo lùi warm-up;
   chuỗi frame 300 ms có thể ở High suốt 60 s. Đã tái hiện bằng governor
   thật. Chủ game đã dùng Low nên lỗi này được ghi lại để xử lý riêng.

## Kiểm chứng clock, không phụ thuộc GPU

Chạy `npx tsx scripts/perf/fx-clock-probe.ts`. Probe dùng TimeStep thật của
Phaser và engine VFX thật, Low 35%, burst 100 spark mỗi 250 ms, life 1 s,
chuỗi giả lập 12 s. Đây là clock/work replay, không phải FPS điện thoại.

| Chuỗi frame                  | Peak particle trước | Sau | Trung vị trước → sau |
| ---------------------------- | ------------------: | --: | -------------------: |
| 16,7 ms, focus ổn định       |                 175 | 175 |            140 → 140 |
| 33,3 ms, boot/resume warm-up |                 315 | 175 |            140 → 140 |
| 33,3 ms, blur                |                 315 | 175 |            280 → 140 |
| 250 ms, warm-up              |                 700 | 175 |            700 → 140 |

Sáu regression unit thất bại với engine cũ, qua với bản sửa. Browser
regression cũng tái hiện: chuỗi 12 burst ở Low cho 420 particle trên bản
cũ, vượt bound 175. Bản sửa còn kiểm tra burst mới sau hitch 1,5 s vẫn có
35 particle, rồi hết sau 1,1 s tiếp theo.

## Cách đo scene

- Chromium 154 + SwiftShader, quota hai core; không có Apple GPU hay đo
  nhiệt. UA iOS và viewport iPhone 11 `896×414 @2` chỉ chọn đúng mobile
  pipeline/canvas cap của ứng dụng.
- Low 1,25×, buffer 580.160 pixel, AA 4×, MobilePipeline. Giữ mức nét và
  vùng cảnh báo hiện có.
- FFA bốn người và Inkpurr bốn người, fully dressed, đội Pyranda/Sunbara/
  Mystowl/Coilemur, seed server `0x51a7`. Server fixture và snapshot 30 Hz.
  Driver arena chạy trong page; CDP whole-page CPU bao gồm driver này.
- Đợi art của squad xong, warm-up 20 s, sample 30 s, mỗi scenario lặp hai
  lần. Chỉ so sánh khi
  arena còn playing, không bỏ tick và tiến độ mẫu bám clock thực.
- GL counters ghi draw calls, vertex và texture bind thực; `frameStepMs`
  là work trong callback, `frameIntervalMs` là khoảng giữa frame thực.
  Thời gian WebGL/software không thể quy thành FPS trên iPhone.

```bash
VISUAL_PORT=4187 PW_CHROMIUM=/usr/bin/chromium \
PERF_GPU=1 PERF_DEVICE=iphone11 PERF_QUALITY=low PERF_SQUAD=heavy \
PERF_RAID_BOSS=gloomshade PERF_SETTLE_SECONDS=20 PERF_SECONDS=30 \
npx playwright test --config tests/visual/playwright.config.ts \
  tests/visual/battle-performance.spec.ts \
  -g 'profiles the (pvp4|raid4)' --repeat-each=2 --trace off --workers=1
```

## Kết quả scene

Tám lượt cuối đều qua guard tiến độ: drift −48,4…+14,9 ms, không bỏ tick,
đều playing, AA 4× và 580.160 pixel. Số thô nằm trong
[JSON](battle-gpu-session-2.json). Mỗi hàng là cùng scenario/repeat, trước → sau:

| Scene/lượt | Particle p50 | Vertex/frame p50 | Frame p50 / p95, ms         | Whole-page Task / Script, ms    |
| ---------- | -----------: | ---------------: | --------------------------- | ------------------------------- |
| FFA 1      |      72 → 77 |  44.769 → 42.492 | 186,6 / 263,8 → 133 / 195,9 | 16.494 / 4.567 → 13.160 / 3.547 |
| FFA 2      |      67 → 76 |  41.280 → 42.150 | 166,4 / 239,8 → 141,8 / 200 | 12.265 / 2.952 → 12.846 / 3.160 |
| Inkpurr 1  |    639 → 125 |  89.637 → 53.103 | 264,3 / 343 → 199,7 / 277,7 | 12.292 / 4.381 → 13.228 / 4.360 |
| Inkpurr 2  |    681 → 131 |  95.436 → 53.658 | 268,1 / 338,9 → 200,4 / 269 | 13.629 / 4.750 → 10.963 / 3.405 |

Inkpurr giảm khoảng 80% particle trung vị và 41–44% vertex trong hai lượt
có backlog. FFA không có bằng chứng giảm work ổn định: sau khi đợi art,
clock cũ đã gần bắt kịp nên số particle tương đương. Các lượt khảo sát cũ
đo FFA ~650 particle không đại diện cho mọi cửa sổ trận.

Timing software giảm ở cửa sổ cuối nhưng whole-page CPU không cải thiện
nhất quán (Task tăng ở Inkpurr 1, Task/Script tăng ở FFA 2). Hai nhóm chạy
trên cùng máy/cấu hình, trước khoảng 11:15–11:21 PT, sau 15:09–15:15 PT
vì session gián đoạn usage, không phải phép đo xen kẽ liên tục. Overlay
perf và driver fixture đều nằm trong page. Tất cả frame mẫu vẫn >50 ms
trên SwiftShader. Không quy mức giảm frame time này thành FPS máy thật,
thermal hoặc độ trễ server.

## Budget và kiểm tra

Baseline: typecheck/build qua; unit/integration 350 file, 3.572 pass,
1 skip. Mười một visual/performance test qua. Baseline effect-budget chạy
ở measure mode; số đo đều dưới giới hạn, chưa assert giới hạn trong lượt
đó.

Sau sửa: targeted unit 3 file/19 test qua; typecheck/build qua. Full default
effect-budget (có assert), match-flow và cả 15 Inkpurr spec: **21 test qua**.
Fixture effect-budget dùng cùng clock chưa làm mượt và snapshot 30 Hz;
kiểm tra mỗi skill/ultimate thực sự có server cast event.
Baseline budget dùng clock cũ và measure mode, nên không dùng chênh lệch
peak giữa hai lượt làm phần trăm cải thiện.

- Max một champion: glow 0,41 màn hình, soft 0,59, particle 284.
- Bốn kit nặng: glow 0,99, soft 0,84, particle 373; dưới limits hiện có.
- Match-flow: layout read 0; 539 rig texture giữ nguyên; Low glow p90/max
  0,75, input 29,99 Hz. Không nới budget.
- Entry JS 2.727,25 → 2.727,44 kB; gzip 917,01 → 917,11 kB. PWA 122 entry.

Chín regression cuối cũng qua: ba standard battle profile, soak ba vòng,
input-clock, browser clock và ba graphics-quality test. Heap sau GC
39,6 → 44,5 → 44,5 MiB; sau rời trận scene object/texture đều về 0.
PWA verifier qua, 122 precache entry. Full unit/integration sau sửa và toàn
bộ 30 visual shard là điều kiện CI trước merge; số baseline ở trên không
được coi là đã chạy lại full unit sau sửa tại local.

Đã xem 15 ảnh Low/High/Settings tại 667×375, 844×390, 852×393 có inset
Dynamic Island, iPad 1366×1024 và desktop 1440×900; HUD, nút điều khiển và
Settings giữ bố cục/safe area. Đã xem cả FFA và Inkpurr đang giao tranh ở
Low, gồm vòng cảnh báo Nightmare Pulse. Không đổi AA, density hay geometry
cảnh báo. Nameplate tại điểm spawn sát nhau vẫn có thể chồng nhau như
trước; đây chưa phải một thay đổi layout nameplate.

Lượt screenshot đầu có bốn case qua và desktop fail ở helper: Expected
0,95, Received 1,25035. Helper đã áp nhầm software pixel cap trong khi
`gpu-check-fake.ts` mặc định báo hardware GPU. Sửa kỳ vọng helper về Low
1,25× và chạy riêng desktop: qua, 58,2 s; không sửa ứng dụng để qua assertion.

## Giới hạn và bước tiếp

Full run trên main sau #419 còn gặp lỗi test Volt Boba: nút tương tác không
hiện sau teleport của fixture. Reproducer dùng PlazaWorld thật cho thấy
input neutral đến muộn có thể rewind từ 1745/520 về vị trí cũ 600/1300.
Helper teleport nay bỏ lịch sử body trước lần dịch chuyển, giữ input đang
chờ và sequence; lịch sử mới vẫn rewind bình thường. Test cũng đợi lệnh
dừng thực sự được xử lý thay cho hai tọa độ bằng nhau. Đây là sửa harness,
không đổi movement production.

Regression helper cũ: 1 fail/2 pass; sau sửa, helper và Plaza prediction
qua 14 test, case Volt Boba qua 41,5 s. Ảnh lỗi từ CI không tải được do
HTTP 403; dùng reproducer và kiểm tra hành vi. Thay đổi harness yêu cầu
chạy lại FULL lane; kết quả đầy đủ và lượt kiểm tra toàn Plaza nằm trên PR.

Chưa có trace trực tiếp iPhone 11/iOS Low hoặc thermal soak. Báo cáo Android
thật mới nhận xác nhận Low vẫn chậm; chưa có trace CPU/GPU trên máy đó.
Không dùng software profile để kết luận máy cũ đã đạt 60 FPS.
Work của VFX có thể giảm trong khi p95 còn chịu chi
phí DOM, driver hoặc phần khác của scene.
Lỗi clock đã tái hiện và có regression; việc nó đóng góp bao nhiêu vào
triệu chứng cụ thể trên máy của chủ game và bạn chơi vẫn cần trace thiết bị thật.

Nên có lượt 2B profile render client trên máy cũ theo dữ liệu mới trước
khi coi phần GPU đã xong. Đợt 3 tiếp tục trace press → gửi lệnh → server tick → hit/event → hình
hiển thị. Đợt 4 mở rộng server matrix với đúng Render **1 CPU / 2 GB,
Oregon**. Cần đối chiếu thêm build mới trên iPhone cũ ở Low trước khi chọn
thêm thay đổi GPU/chất lượng hình.

Prompt để mở session 2B riêng:

> Làm theo AGENTS.md và CLAUDE.md, fetch main mới. Đọc báo cáo session 2
> và JSON trận thật 24 Nov. Ưu tiên Pixel 8a đang Low nhưng raid 23–25 FPS,
> work 22–24 ms dù chỉ 24–38 particle; iPhone 11 Low cũng cần kiểm chứng.
> Lấy trace trên thiết bị thật để tách scene/rig/DOM, WebGL và thermal;
> aggregate work hiện tại chưa tách CPU/GPU. So sánh cảnh ít hiệu ứng với
> raid, giữ AA 4×, Low 1,25× và vùng cảnh báo. Tối ưu từng điểm có số đo
> trước/sau, có regression và screenshot; không kết luận từ SwiftShader
> rằng điện thoại đã mượt. Server hiện 1c-2g Oregon, chỉ đọc production.
