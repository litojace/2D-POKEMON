# Session 1 — input clock và press-to-send

Baseline lấy từ `main` mới, `4a32d43ecae6271a7a38d838405b751098741e4a`.
Phạm vi là mục 1 và phần đo cục bộ của mục 2 trong
[audit](battle-performance-audit-2026-11-23.md). Tick và snapshot vẫn 30 Hz.
Không đổi simulation server, damage, hitbox, lag compensation, đồ họa hay
thiết lập production.

## Thay đổi

`BattleInputClock` dùng deadline từ `performance.now()`, chạy bằng timeout
một lần cho deadline kế tiếp. `ArenaScene.update` chỉ còn lo khung hình;
TimeStep smoothing, frame cap và việc không render một frame không làm mất
thời gian của input clock. Timer vẫn phải chờ nếu main thread bị khóa.

Mỗi lần thức gửi tối đa ba input, rồi nhường event loop trước khi trả debt
còn lại. Giữ nguyên deadline sau hitch ngắn, gồm 50/150/250 ms. Trễ quá mười
period (~333 ms) thì bắt đầu lại, không phát lại cả một khoảng suspend.
Không có input sớm thêm vì bấm nút hoặc vì render gọi `sync()` nhiều lần.
Server vẫn kiểm tra credit, held ticks và catch-up như trước.

Mỗi input vẫn có đúng một seq, một entry pending và một bước prediction.
Đường chọn skill/EX, giữ Basic, dash, jump, aim và `newestStep` được chuyển
nguyên sang callback input. Cấu hình tường/speed cho prediction được áp dụng
cả khi gửi lẫn khi replay snapshot, kể cả chưa có frame mới.

Ẩn trang, pagehide, thoát trận và disconnect dừng clock, bỏ action chưa gửi
và hủy callback thuộc lifecycle trước. Reconnect chờ identity của resume
và snapshot mới trước khi chạy tiếp; snapshot cũ tới trước identity không
mở lại input. Blur xóa controls; input neutral kế tiếp dùng chính cadence
30 Hz, không phát thêm một seq ngoài clock.
Yêu cầu `leave` khóa input ngay trước RPC, kể cả khi đang tải raid hall;
nếu bị từ chối thì chỉ mở lại cùng connection/identity đó. Pageshow xóa
controls thêm lần nữa trước khi mở clock.

## Số đo tách riêng

- `pressToSendP50/P95/P99`: timestamp của DOM action → lời gọi `emit` mang
  action đó. `pressSamples` là số mẫu được giữ. Không tính thêm mẫu cho các
  lần lặp Basic trong cùng một lần giữ.
- `eventToHandlerP95`: event → đầu handler nhận action. `handlerToSendP95`:
  từ đó đến emit; gồm cả main-thread stall xảy ra sau handler. Các percentile
  này không cộng với nhau để suy ra percentile của tổng.
- `sendGapP50/P95/P99/Max`: khoảng cách thực giữa hai emit trong live play;
  không nối khoảng ẩn/thoát/reconnect/đổi round vào gap.
- `confirmP50/P95/P99`: prediction → cast được server xác nhận, giữ điểm
  bắt đầu cũ của `confirmP50`. Đây không phải toàn bộ press → confirm.
  `rttP50/P95` tiếp tục là phép đo round trip riêng.

Keyboard/mouse và touch lấy timestamp từ event; timestamp epoch trên Safari
được đổi về time origin đơn điệu. Preview skill đo từ lúc release để commit,
không tính thời gian người chơi chủ động giữ để ngắm. Gamepad không có DOM
timestamp nên không giả polling time thành physical press. Action bị hủy
không để lại timestamp gắn nhầm cho lần sau.

Chỉ aggregate số kỹ thuật có giới hạn đi vào `battle-perf` và public export.
Các field mới là optional; client cũ vẫn hợp lệ. Không thêm timestamp hoặc
quyền quyết định hit vào protocol `Input`.

## Trước/sau có thể chạy lại

Đã chạy probe cũ với **TimeStep thật của Phaser** trước khi sửa:

```bash
node scripts/perf/input-clock-probe.cjs
npx tsx scripts/perf/input-clock-comparison.ts
```

Probe cũ tái hiện 26.85 Hz với hitch 250 ms mỗi 120 frame và 14.92 Hz
khi mỗi frame 200 ms. Replay mới so sánh hai clock trên **cùng 60 giây wall
time**, dùng TimeStep thật cho bản cũ, DOM event mỗi 317 ms và timer jitter
0–2 ms có seed 7. Vì mẫu thời gian khác probe cũ, con số 250 ms là 26.52 Hz.
Số thô, send gaps và phân rã handler nằm trong
[JSON](battle-input-clock-session-1.json).

| Render / main-thread stall mỗi 2 s | Input Hz, trước → sau | Press-to-send p50, ms | p95, ms         | p99, ms         |
| ---------------------------------- | --------------------- | --------------------- | --------------- | --------------- |
| 60 Hz / không stall                | 29.983 → 29.983       | 17.00 → 16.87         | 32.00 → 31.67   | 33.33 → 33.18   |
| 60 Hz / 50 ms                      | 29.983 → 29.983       | 16.33 → 17.66         | 32.67 → 32.77   | 62.00 → 62.58   |
| 60 Hz / 150 ms                     | 29.983 → 29.983       | 16.33 → 17.67         | 80.67 → 71.28   | 155.67 → 162.00 |
| 60 Hz / 250 ms                     | 26.517 → 29.983       | 20.00 → 18.97         | 186.67 → 171.80 | 261.67 → 262.00 |
| 20 Hz / thread rảnh giữa frame     | 29.917 → 29.983       | 25.00 → 16.87         | 47.00 → 31.67   | 49.00 → 33.18   |
| 5 Hz / thread rảnh giữa frame      | 14.917 → 29.983       | 101.00 → 16.87        | 190.00 → 31.67  | 198.00 → 33.18  |

Mỗi run có 189 action nhận và 189 action gửi, không mất action. Các run mới
đều gửi 1,799 input trong 60 s (sai số phase đầu/cuối dưới một tick).
Hitch trên main thread vẫn hiện nguyên trong đuôi press-to-send; p99 không
cải thiện ở các run 150/250 ms. Không suy RTT, confirm hay FPS điện thoại từ
replay này. Lợi ích đo được là bỏ clock drift và bỏ chờ render khi thread
còn có thể chạy input.

Fixture `battle-performance`, `match-flow-budget`, `pvp-performance` lấy
cadence từ `RULES.tick/snapshot`, dùng deadline wall time với catch-up tối
đa mười tick cho simulation fixture. Lượt browser trước/sau dùng cùng
fixture 30 Hz, Chromium 154/SwiftShader, một worker, trace off. Nguồn input
trong các fixture profile này vẫn là workload giả; số RTT/confirm của
harness không phải RTT/confirm production. Việc chuyển input work ra khỏi
scene update cũng có nghĩa không thể coi riêng scene-update time giảm là
toàn bộ CPU đã giảm. `workP50/workP95` vẫn chỉ đo phần Phaser, cũng không
bao gồm callback input chạy ngoài frame.

Match-flow thực trong browser, cùng fixture 30 Hz:

| Số đo                                      | Trước     | Sau       |
| ------------------------------------------ | --------- | --------- |
| Input Hz, High                             | 1.21      | 30.01     |
| Input Hz, Low                              | 2.35      | 29.97     |
| Layout read mỗi frame của game, High/Low   | 0 / 0     | 0 / 0     |
| Fighter textures trước/sau fight, High/Low | 539 / 539 | 539 / 539 |
| Low glow cover p90, màn hình               | 0.75      | 0.75      |

Đây là SwiftShader chỉ render khoảng 2–4 FPS, không phải FPS điện thoại.
Clock mới vẫn chạy gần 30 Hz trong lượt này. Heap ba vòng battle/hub/Shop/
Wardrobe sau fix là 39.9 → 44.7 → 44.7 MiB; scene/texture battle đã thả.
Đã nhìn screenshot High/Low ở 844×390, 2×.

Một cặp raid bổ sung đổi riêng `main.ts` giữa baseline và fix, giữ schema/
NetMeter mới ở cả hai, để đo công việc input đã tách khỏi Phaser. Callback
input có p50/p95/max **0.1/1.4/2.1 ms**, 116 mẫu, tổng xấp xỉ 22 ms. Lượt
này cũng có frame gap 1.312 s: clock bỏ debt quá giới hạn thay vì flood.
CPU toàn trang dao động mạnh (ScriptDuration các lượt raid trước 699/933 ms,
sau 1050/1787 ms, cửa sổ danh nghĩa 6 s); **chưa xác minh giảm tổng CPU**.
Không suy mức tăng/giảm CPU đó chỉ từ callback input, hoặc từ scene-update.

Build entry JS: 2,722.42 → 2,725.90 kB (**+3.48 kB**); gzip 915.43 →
916.45 kB (**+1.02 kB**), theo Vite. Typecheck, build và kiểm tra PWA
(`node scripts/verify-pwa.mjs`, 122 precache entries) qua.

## Regression và kiểm tra

- Baseline: typecheck/build/PWA qua; 346 file unit/integration, 3,550 passed,
  1 skipped; sáu bài battle/match-flow gốc qua.
- Sau fix clock: 349 file unit/integration, **3,564 passed, 1 skipped**;
  tám bài browser input/battle/match-flow/PvP qua. Sau guard cho RPC leave,
  chạy lại typecheck/build/PWA và 116 test tập trung đều qua.
- 14 test mới: TimeStep thật với hitch và jitter; render chậm; một bước mỗi
  deadline; catch-up có giới hạn; suspend dài; callback cũ; DOM/epoch
  timestamp, tap/hold, report optional và public allowlist. Test hai socket
  thật dùng latency/jitter có thứ tự và stall client 150/250 ms; tất cả seq
  được ack, không có folded input, skill/dash/jump một lần, Basic tiếp tục.
- Browser tích hợp kiểm tra tap nhanh, một prediction cho mỗi input, ẩn/hiện,
  pagehide/pageshow, disconnect, snapshot cũ trước resume identity, chờ
  snapshot mới, leave chậm/thất bại, thoát trận và mở trận tiếp theo. Không
  cần một frame mới để gửi input.
- Regression fail trên mã cũ: 0 input trong 400 ms render bị dừng. Sau đó cố
  tình thêm lại điều kiện `game.loop.running` vào clock: test cuối cũng fail
  tại cùng guard (0 input); đã khôi phục fix. Các bài touch-recovery và
  regression input qua 8/8.
- Cố tình bỏ khóa input lúc bắt đầu `leave`: regression fail tại guard
  chờ reply, vì còn input trong 200 ms chờ. Đã khôi phục guard.

Merge lane phải là **FULL**: có battle, `main.ts` và schema report dùng chung.
Chờ verify và đủ 30 visual shards, đồng thời tôn trọng issue Main is red.
Không chạy toàn bộ visual suite tại máy local. Không có phép đo trên iPhone,
iPad hoặc Android vật lý; chưa xác nhận thermal và RTT/confirm production.
