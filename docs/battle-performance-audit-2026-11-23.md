# Kiểm tra hiệu năng trận đấu — 23/11/2026, giờ Pacific

**Ưu tiên đợt tiếp theo: nhịp input của client và đo độ trễ từ thao tác.**
Mã gửi input đang chạy theo khung hình của Phaser. Vì vậy một máy đang
chơi gần 60 FPS vẫn có thể ra lệnh chậm khi một khung hình bị khựng.
Server hiện còn dư tài nguyên ở lượng người chơi quan sát được; nâng máy
server tiếp không giải quyết được đoạn chờ này.

Đây là lượt khảo sát và dựng baseline. PR này sửa bộ đo tải và tài liệu,
không sửa luật đánh, damage, tick rate, hitbox hay thiết lập production.
Các thay đổi gameplay cần tách thành những session dưới đây.

## Phạm vi và bản mã

- Baseline: `d7b44b0021c57286ccaf91fa26a10179ee3313cf` trên `main`.
  Checkout ban đầu là `2907ee29`, cũ hơn đáng kể. Các phép đo trên checkout
  cũ đã bị loại khỏi kết luận. Dùng worktree riêng để giữ nguyên workspace đó.
- Đọc đầy đủ `AGENTS.md`, `CLAUDE.md`, lịch sử tối ưu trong
  `docs/network-performance.md`, mã client/server/shared, test và công cụ
  liên quan. Khảo sát cấu trúc toàn repo; rà sâu đường đi input → queue →
  simulation → snapshot → prediction/interpolation → render/HUD/effects,
  cùng lifecycle, tài nguyên, account refresh và ghi kết quả.
- Dịch vụ thật đã kiểm tra chỉ đọc: Render `element-arena`, một instance,
  **1c-2g, 1 CPU / 2 GB, Oregon**. Frontend là Static Site riêng. Không đổi
  plan, region, biến môi trường hoặc database; không kích hoạt deploy
  thủ công qua Render.
- Game hiện là **30 tick và 30 snapshot/giây**. Các đoạn 15 snapshot/giây,
  máy nửa CPU và phần lớn bảng before/after cũ là lịch sử, không phải cấu
  hình hiện tại. TickClock, held input, projectile lead, Low 1.25×,
  camera-clear, effect pooling và cache font damage text đã tồn tại.

## Những gì số liệu thật nói được

Render CPU MAX theo mẫu 5 phút trong khoảng 22:30 ngày 22/11 đến 22:27
ngày 23/11 PT: cao nhất khoảng **0.024 CPU**, tức **2.4% một core**;
memory cao nhất khoảng **165 MiB** trên giới hạn 2 GiB. Đây là dữ liệu lấy
mẫu; nó không loại trừ một đợt khựng ngắn nằm giữa các mẫu.

Báo cáo match mới, build `d7b44b0`, lúc 22:34 ngày 23/11 PT, thiết bị
`iPhone18,2`, app iOS:

| Số đo                                |         Giá trị |
| ------------------------------------ | --------------: |
| FPS trung vị / các lát 15 giây       |   58.8 / gần 60 |
| Frame p95 / p99                      |      18 / 20 ms |
| Phần thời gian khựng trên 34 ms      | 0% sau làm tròn |
| Công việc của game p95               |      2 ms/frame |
| Server Hz / tick p95                 |     30 / 0.8 ms |
| Ping / RTT p95                       |      55 / 60 ms |
| Snapshot gap p95                     |           41 ms |
| Xác nhận chiêu p50                   |           72 ms |
| Lần chuyển sang trạng thái chờ input |       44.2/phút |

`holds` chỉ nói server có tick chờ input; **chưa đủ để quy lỗi cho Wi-Fi**.
Client có thể gửi muộn vì khung hình, đồng hồ gửi có thể lệch pha, hoặc
mạng có thể giữ gói. `confirmP50` cũng bắt đầu từ lúc dự đoán chiêu trong
vòng update, chưa tính toàn bộ chờ từ lần chạm nút.

Lịch sử ngày 21–22/11 PT có các trận Inkpurr khoảng 30–45 FPS, jank tới
51.7%, một trận inputHz 20.41 trong khi serverHz vẫn 30. Các build đó có
trước những sửa đổi về Low, camera clear và hiệu ứng mới nhất. Chúng xác
định nhóm cần đo lại, không chứng minh bản mới còn cùng một lỗi. Báo cáo
mới trên điện thoại mạnh cũng không chứng minh iPhone cũ hoặc iPad đã mượt.

## Phát hiện, theo mức ảnh hưởng

### 1. P1 — Khựng hình có thể làm chậm lệnh đánh

**Nguồn:** `apps/client/src/main.ts:7376`, `main.ts:7469`,
`main.ts:7474`; Phaser 3.90 `src/core/TimeStep.js:563` và `:717`.

Accumulator input dùng `delta` đã được Phaser làm mượt, rồi chặn thêm ở
100 ms. Việc tạo lệnh, gửi socket, dự đoán đòn và bước movement nằm trong
`ArenaScene.update`. Các frame bị bỏ hoặc chạy chậm làm lệnh gửi dồn;
frame rất chậm còn làm mất thời gian của đồng hồ input. Đặt một
`setInterval` khác trên cùng main thread vẫn phải chờ khi thread bị khóa.

Probe gọi **TimeStep thật của dependency**, dùng cùng phép cộng accumulator
và giới hạn như game, không render GPU hay giả lập mạng:

```bash
node scripts/perf/input-clock-probe.cjs
```

| Tình huống                         | Thời gian thật | Input/giây | Khoảng trống gửi lớn nhất |
| ---------------------------------- | -------------: | ---------: | ------------------------: |
| 60 FPS đều                         |           60 s |      29.98 |                     50 ms |
| Một frame 150 ms sau mỗi 120 frame |           64 s |      29.94 |                  166.7 ms |
| Một frame 250 ms sau mỗi 120 frame |           67 s |      26.85 |                  266.7 ms |
| Mỗi frame 200 ms                   |           60 s |      14.92 |                    200 ms |

Đây là tái hiện cơ chế của clock, không phải FPS đo trên điện thoại.
Trong kịch bản 250 ms, Phaser chỉ đưa khoảng 60 s vào clock game trong
67 s thật. Ở 5 FPS, giới hạn 100 ms chỉ cho gửi tối đa ba input/frame.

**Đề xuất:** đo `event.timeStamp → handler → emit → server receive →
consume → confirm`; dùng clock đơn điệu cho input, tách cadence input
khỏi thời gian animation; giữ catch-up có giới hạn, thứ tự seq, mỗi
input một bước và chống speed-up. Profile main thread trước khi cân nhắc
worker. **Rủi ro vừa/cao:** tác động prediction, held ticks, dash, giữ
Basic, tap nhanh, trạng thái ẩn/hiện và reconnect. Chưa sửa trong PR này.

### 2. P2 — Phép đo chưa phân biệt được đủ các nguồn trễ

**Nguồn:** `apps/client/src/battle-perf.ts:433`,
`apps/client/src/cast-prediction.ts:57`, `apps/client/src/main.ts:535`,
`packages/shared/src/index.ts:2594` và `:3072`.

Input không mang thời điểm thao tác; event combat không mang tick/time
riêng. Chỉ có seq/ack, vị trí và snapshot time. `holds` đếm chuyển trạng
thái chờ, không đo trực tiếp uplink. Hit gap suy thời điểm hit từ snapshot
và lead; các event được phát bù sau backpressure có thể thuộc nhiều tick.
Không nên coi mọi `hitsFar` là hitbox sai hoặc mọi hold là mạng kém.

**Đề xuất:** trước hết thêm số đo cục bộ về send gap và press-to-send,
đuôi p95/p99 của confirm; sau đó trace tick/seq của action/hit trong chế
độ chẩn đoán. Chỉ giữ trường kỹ thuật đã được kiểm soát, không thêm account
hay room vào report công khai. **Rủi ro vừa:** thêm protocol cần tương
thích client cũ; timestamp client chỉ để chẩn đoán, không được tự quyết
damage hay thời điểm trúng đòn.

### 3. P2 — Bộ load test có thể báo thành công khi giới hạn tài nguyên thất bại

**Nguồn cũ:** `scripts/perf/server-load.ts`, `startServer`.

Với `CGROUP=arena-audit-missing`, bản cũ ghi hai lỗi `ENOENT` khi chuyển
process vào cgroup, nhưng vẫn chạy và thoát 0, xuất JSON gắn tên cgroup
đó. Chạy không có `CGROUP` cũng không giới hạn server. Các kết quả như vậy
không thể được gọi là benchmark Render 1c-2g.

**Đã sửa trong PR:** default Docker giới hạn riêng server 1 CPU / 2 GiB,
không thêm swap, Node 22.16.0; child xác minh `cpu.max`, `memory.max`
trước khi driver kết nối. Sai giới hạn, Docker lỗi hoặc còn `CGROUP` cũ
thì fail. `--profile host` được gắn rõ `verified: false`. Driver dùng
TickClock 30 Hz; lỗi/thiếu IPC reply có timeout và cleanup.
**Rủi ro thấp, chỉ công cụ:** default mới cần Docker Linux/cgroup v2;
không chạy benchmark cùng job CPU nặng. Không có thay đổi server thật.

### 4. P2 — Browser profile còn stream 15 Hz trong khi production đã là 30 Hz

**Nguồn:** `tests/visual/battle-performance.spec.ts`, `startFight`
(`if (tick % 2) return`); `tests/visual/match-flow-budget.spec.ts`.

Profile browser baseline nhận khoảng 12–14 snapshot/giây ở software GPU.
Đó là regression guard hữu ích, nhưng chưa phản ánh đúng chi phí xử lý
30 snapshot/giây của production. Fake stream cũng không đi qua mạng,
input queue và reconciliation thật đầy đủ.

**Đề xuất:** trong session input, cho cadence test theo RULES, bổ sung
đo trên build production và một test hai client với server thật khi áp
latency/jitter/stall. Không suy FPS điện thoại từ SwiftShader.
**Rủi ro thấp/vừa:** test có thể lộ regression hoặc cần chỉnh fixture;
không nới budget chỉ để test xanh. Chưa sửa các visual spec trong PR này.

### 5. P2 — GPU/fill và burst hiệu ứng vẫn là vùng cần đo trên máy cũ

**Nguồn:** `apps/client/src/fx-engine.ts:84`,
`apps/client/src/battle-quality.ts:98`, `apps/client/src/render-budget.ts:69`,
`apps/client/src/main.ts:8812`, `apps/client/src/raid-gloomshade-art.ts:194`.

Game 2D vẫn có hàng trăm texture/scene object, glow phủ nhiều lần màn
hình, blend và upload text. Baseline FFA bốn kit nặng: peak glow 1.08 màn
hình, smoke 1.01, 403 particle; bài test từng kit và cả FFA đều qua budget.
Match-flow Low giữ glow p90 ở 0.75, High là 1.44 trong lượt đo này.
Đạt budget không đồng nghĩa mọi GPU đều giữ 60 FPS.

Các cải tiến atlas/static scenery, pooling, font metrics, clear colour và
Low 1.25× đã có; không bắt đầu lại bằng cách cache toàn bộ Inkpurr như
thể nó vẫn chỉ là Graphics vẽ từ đầu. Auto còn có warm-up và cửa sổ nhiều
giây; đo các frame đầu/burst riêng. iPad lớn có pixel budget khác iPhone.

**Đề xuất:** kiểm tra Inkpurr/FFA bốn người trước trên iPhone 11 hoặc máy
cũ tương đương, Android yếu, iPad cơ bản và iPad lớn; High/Auto/Low, từng
phase, ít nhất 10–15 phút. Tối ưu lớp có GPU/main-thread cost đo được;
giữ nguyên telegraph/hitbox, safe area và độ đọc chữ. **Rủi ro vừa:**
chất lượng hình, nhiệt và memory GPU, cần nhìn screenshot và máy thật.

### 6. P2 — Server có đuôi trễ trước khi CPU trung bình chạm 100%

**Nguồn:** `apps/server/src/server.ts:3631`, `:1378`, `:3737`,
`apps/server/src/tick-clock.ts`; bảng tải 1c-2g dưới đây.

Ở 160 người giả lập, average vẫn 30 Hz nhưng tick p99 đã khoảng 48 ms,
quá budget 33.3 ms. CPU trung bình 56–59% vẫn có thể có burst, GC hoặc
quota wait. Match và Plaza dùng chung một Node event loop; refresh account
được phát cho tất cả socket mỗi 30 s, có thể tạo thêm RPC/callback và
broadcast. Chưa có bằng chứng refresh là nguyên nhân lag thực tế.

**Đề xuất:** profiling từng room/mode, đuôi tick lateness, snapshot encode,
outbound backlog và refresh; bổ sung player bots, Plaza, spectators, đủ
boss/phase/Spire. Giảm phần việc lặp đã đo được trước khi tăng tick rate
hoặc tách worker/room routing. **Rủi ro vừa/cao** nếu thay kiến trúc room;
room đang ở memory của một instance, tăng instance không tự chia room.

### 7. P2 — Timeline đối thủ, projectile và damage có những đánh đổi cần trace

**Nguồn:** `apps/client/src/networking/interpolation.ts:27`,
`apps/client/src/networking/timeline-lead.ts:24`,
`apps/client/src/main.ts:7614`, `:7642`, `:7873`.

Nhân vật mình predicted, đối thủ buffered, đạn được lead và blast vào
target di chuyển vẫn đợi server. Đây là thiết kế hiện có, không phải bằng
chứng server quá tải. Net-sim hiện tại (120 s, một seed): đối thủ trễ p50
53 ms trên Wi-Fi tốt, 120 ms ở 4G, 267 ms khi nghẽn; frame di chuyển bị
đứng 0%, 1.2%, 0.4%. Một seed không đủ so sánh hai tuning.

**Đề xuất:** sau khi sửa phép đo/input, replay đòn nhanh, melee, dash,
knockback, tường, boomerang và moving target với trace từng tick. Nếu cân
nhắc lag compensation, cần quy tắc công bằng có giới hạn và server xác
thực; không áp rewind đồng loạt cho mọi skill/raid. **Rủi ro cao:** có thể
đổi cảm giác né đòn và lợi thế giữa hai phía. Không gom hai input vào một
packet để giảm CPU khi chưa đo phần latency thêm.

### 8. P3 — Memory/lifecycle chưa phải nguyên nhân đã xác nhận ở lượt này

**Nguồn:** `apps/client/src/main.ts:9104`, `graphics-bake.ts`,
`tests/visual/battle-performance.spec.ts` (memory soak).

Ba vòng battle → hub → Shop → Wardrobe: heap sau GC 40.6 → 44.2 →
44.4 MiB; renderer/texture battle đã được giải phóng. Match-flow giữ đúng
539 fighter textures trước/sau fight và không có layout read của game
trong mỗi frame. Chưa có dấu hiệu leak kiểu mỗi trận giữ thêm renderer
trong sample ngắn này.

**Đề xuất:** soak dài 20–30 vòng, background/resume app, context loss và
memory GPU trên iOS/iPad. Chỉ tối ưu thêm allocation/asset lifetime khi
profile chỉ ra nó. **Rủi ro vừa:** thả cache quá sớm gây load/texture hitch.

## Baseline server có giới hạn thật

Node 22.16.0 trong Docker Linux/cgroup v2, xác minh **1 CPU / 2 GiB**.
Driver ở ngoài container. Mã game giữ nguyên `d7b44b0`; công cụ đo có
thay đổi về profile và clock driver. Đây không phải before/after của một
fix hiệu năng gameplay. CPU máy đo là Xeon Platinum 8573C, khác CPU Render.

Mỗi mức tải hỗn hợp `pvp2,pvp4,raid4`: warm-up 5 s, đo 20 s, hai lượt,
chạy tuần tự; không chạy browser/test CPU nặng cùng lúc. Một room 1v1
riêng: CPU 3.23%, 600 tick/20 s, tick p99 0.95 ms, RSS 158 MiB.

| Room / người | CPU, % một core | Tick / 20 s |     Tick p95 |         Tick p99 | Event loop p99 |         RSS | Snapshot/giây/người |
| ------------ | --------------: | ----------: | -----------: | ---------------: | -------------: | ----------: | ------------------: |
| 24 / 80      |       23.6–30.7 |     600–601 | 10.1–11.8 ms |     13.3–20.7 ms |    7.3–10.6 ms | 174–178 MiB |                  30 |
| 48 / 160     |       56.5–59.0 |         600 | 22.5–23.3 ms | **47.6–48.3 ms** |   25.5–30.9 ms | 188–190 MiB |                  30 |
| 72 / 240     |       81.0–96.1 |     590–592 | 42.1–53.6 ms | **74.1–76.5 ms** |   75.0–84.5 ms | 203–205 MiB |           29.5–29.6 |

Downstream khoảng 144–147 KB/s/người trong workload này. Ở 80 người vẫn
có một tick cực đại 41.6 ms trong một lượt; p99 dưới budget không đồng
nghĩa hoàn toàn không có hitch. 160 người đã không phù hợp tiêu chí đuôi
trễ cho combat chính xác dù rate trung bình đẹp. RAM còn rất dư ở cả ba mức.

Lượt bổ sung 80 người, warm-up 10 s và đo 60 s, đi qua hai lần refresh
account giả: 1,800 tick, CPU 24.58%, tick p95/p99 9.94/14.31 ms, tick
cực đại 47.03 ms, event-loop max 57.83 ms, RSS 153 MiB. Vẫn có hitch
đơn lẻ dù các percentile đẹp; chưa đủ dữ liệu gán nguyên nhân cho refresh.
RPC thật và độ trễ database không được giả lập bởi provider này.

Số đo có thể đọc lại trong
[baseline JSON](battle-performance-baseline-2026-11-23.json).

Tất cả các số trên chỉ áp dụng workload này. Nó dùng default fighters,
raid mặc định và fake accounts; không phải stress đủ 18 champion, 7 boss,
Ascendant/Spire, player bots, người đứng Plaza hoặc spectators. Sample
20 s cũng chưa đi qua timer refresh account 30 s; lượt 60 s chỉ dùng
provider giả như mô tả trên. Không công bố capacity
sản phẩm bằng cách nhân đôi con số của plan 0.5 CPU.

## Chia việc cho các session Codex tiếp theo

| Session           | Phạm vi riêng                                                         | Điều kiện hoàn thành                                                                                                                     |
| ----------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — làm trước** | Input clock và đo press → emit; cadence 30 Hz trong fixture liên quan | Có regression tái hiện hitch 50/150/250 ms, đúng bước/seq/held/catch-up, không gửi lệnh khi ẩn/thoát/reconnect; có p50/p95/p99 trước/sau |
| 2                 | GPU và burst trong trận, bắt đầu bằng Inkpurr và FFA                  | Profile máy cũ sau các fix mới nhất; phân biệt GPU, JS, thermal; effect/match-flow budgets và screenshot mobile/iPad qua                 |
| 3                 | Tính nhất quán của đòn đánh và event timeline                         | Trace cùng tick từ hai phía; test moving target, dash, tường, jitter; server giữ quyền quyết định hit/damage                             |
| 4                 | Server dưới tải và công việc định kỳ                                  | Dùng đúng profile 1c-2g; thêm Plaza/bots/spectators/boss matrix; đo đuôi tick và backlog, không chỉ average Hz                           |
| 5                 | Payload và snapshot processing                                        | Giảm byte/parse/clone/DOM cost có số đo, giữ 30 Hz và event delivery/recovery; không thêm delay do batching input                        |
| 6                 | Session dài và lifecycle iPhone/iPad                                  | Soak dài, nhiệt, background/resume, context loss; memory/texture không tăng theo số trận                                                 |

Mỗi session bắt đầu đọc lại AGENTS/CLAUDE và phần tương ứng của báo cáo
này, lấy baseline trên main mới, kiểm tra PR đang mở, làm một concern và
tuân merge lane. Không chạy song song hai session sửa `main.ts`, protocol
hoặc server rooms mà chưa phối hợp.

Prompt mở session 1:

> Làm theo AGENTS.md và CLAUDE.md. Đọc
> docs/battle-performance-audit-2026-11-23.md. Chỉ xử lý mục 1 và phần đo
> cần thiết của mục 2: input clock/press-to-send trong trận; chỉnh cadence
> fixture liên quan theo RULES. Tái hiện bằng TimeStep thật trước khi sửa.
> Giữ authoritative server, seq/ack, held ticks, giới hạn catch-up và hành
> vi tap/hold/dash. Đo trước/sau ở cadence 30 Hz, có hitch và jitter; tách
> rõ press-to-send với RTT/confirm. Chưa đổi tick rate, lag compensation,
> damage/hitbox, đồ họa hoặc production settings. Báo FULL/FAST đúng script.

Ngưỡng mục tiêu để các session kiểm chứng: frame p95 gần 16.7–20 ms ở
thiết bị mục tiêu 60 FPS, jank dưới 1–2%, tick p99 dưới 33.3 ms (cần dư
địa), không có input drift khi gặp hitch, không mất action hoặc áp hai
lần. Đây là mục tiêu, chưa phải kết quả đã đạt trên mọi máy. Cần ma trận
thiết bị thật trước khi khẳng định phạm vi điện thoại/iPad được hỗ trợ.

## Kiểm chứng và giới hạn

- Typecheck và build qua trước khi thay công cụ; PWA build thành công.
- Unit/integration baseline: **345 files, 3,540 passed, 1 skipped**.
- Browser baseline: **10/10 passed** (`battle-performance`, toàn bộ
  `effect-budget`, High/Low `match-flow-budget`), Chromium 154,
  SwiftShader, một worker, trace off. Không sửa source trong lúc chạy.
- Bộ kiểm tra mới: **10/10 passed**, gồm từ chối nửa core, 512 MB,
  không giới hạn/sai giới hạn và IPC exit/timeout. Có smoke test Docker
  thực tế xác nhận profile, phiên bản Node và tự dọn container. Bỏ guard
  kiểm tra giới hạn làm 6 test fail; khôi phục guard thì 10/10 qua lại.
- Net-sim và correction-sim dùng simulation/prediction thật nhưng mạng
  được mô hình hóa. Các correction trong fight có hit/knockback/status
  không mặc nhiên là lỗi prediction.
- Không có phép đo FPS/thermal trên điện thoại hoặc iPad vật lý trong
  session này. Browser software GPU chỉ dùng tìm cost và regression.
- Chưa chạy toàn bộ hơn 100 visual spec; không có thay đổi UI/gameplay
  trong PR này. Kết quả CI và merge lane được ghi trong PR.
