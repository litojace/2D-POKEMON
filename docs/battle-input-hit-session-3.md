# Trận đấu — đợt 3: trace input và thời gian hit

24 Nov 2026, US Pacific. Base `7f9157c4`. Chủ game xác nhận iPhone PWA
844×390 trong lượt 20:23 là **iPhone 16e**, không phải 17 Pro Max.

## Dữ liệu dẫn đến lượt này

- Pixel 8a, 19:17 PT, build `2b47ed5`, Cindrake đấu bot Pyranda Normal,
  Low 1,25×, 38,5 s: 59,5 FPS, frame p95 20,3 ms, work 6,6/10,3 ms.
  Bấm → gửi p95 42 ms; dự đoán chiêu → server xác nhận p95 140 ms.
  Có sáu `hitsFar`, max 69 đơn vị world. Build này đã có CSS #423 nhưng
  chưa có VFX #420.
- iPhone 16e, 20:23 PT, build `7f9157c`, Tidefin đấu bot Lumoth Hard,
  High 1,5×, 58,8 s: 58,8 FPS, frame p95 19 ms, work 2/3 ms,
  `hitsFar=0`, max gap 20. Có 27 mẫu action: bấm → gửi p50/p95
  37/170 ms, event → handler p95 159 ms, handler → gửi p95 30 ms.
- Server của hai lượt giữ 30 Hz, tick p95 lần lượt 1,4/0,9 ms. RTT p95
  132/86 ms vẫn bao gồm đường truyền và client. Không cộng các p95 riêng
  để suy ra một p95 end-to-end.

Các lượt khác đối thủ, độ dài và thiết bị. Chưa có native trace của 16e
hoặc Pixel, chưa dùng chúng như phép A/B giữ mọi điều kiện giống nhau.

## Phát hiện và thay đổi

1. **Phép đo hit bỏ mất tuổi event trong snapshot.**
   `apps/client/src/main.ts`, `measureHitGap`, dùng thời gian snapshot mới
   nhất, dù hit có thể thuộc tick trước. Snapshot trễ hoặc gom nhiều tick
   làm lệch mốc đối chiếu. Reproducer dùng `drawnGap` thật: nhân vật đi
   300 đơn vị/s, hit tại x=240 ở 800 ms, snapshot thể hiện 900 ms. Bản cũ
   báo gap 30, dù hình vẽ lúc hit khớp; tính đúng tuổi event cho gap 0.

   `GameEvent.at` nay ghi thời gian simulation của hit, làm tròn tới ms,
   trong `apps/server/src/simulation.ts`. `hitDrawTime` trong
   `apps/client/src/battle-perf.ts` trừ tuổi hit trước khi tìm frame đã vẽ.
   Server cũ thiếu trường này vẫn dùng fallback cũ; trace ghi `timed=false`.
   Event time không hợp lệ bị bỏ qua phép đo. Không đổi collision, damage,
   prediction, nhịp input, tick hay thời điểm phát hiệu ứng.

2. **Event miss cũng được tính như dính đòn.**
   Simulation phát `kind=hit, miss=true` khi đòn đánh trượt do blind.
   Phép đo cũ vẫn đưa nó vào `hitsFar`. Helper mới loại miss.
   Vì cả hai lỗi này, sáu mẫu Pixel cũ chưa chứng minh có sáu hit thật
   tính sai. Các report mới có `hitTraceVersion=1`; không diễn giải việc
   số đo giảm như một cải thiện gameplay do thay hit-test.

3. **p95 tổng hợp mất liên hệ giữa các mẫu input.**
   Một p95 event delay và một p95 send delay có thể đến từ hai thao tác
   khác nhau. `NetMeter` nay giữ tối đa tám thao tác chậm nhất từ 80 ms,
   cùng action, đường điều khiển, delivery/deadline/total ms và khoảng
   frame lớn nhất trong cửa sổ event → handler. Chỉ ghi đồng hồ mỗi frame,
   không đọc DOM/layout. Buffer giữ tối đa 240 số, bỏ 60 số mỗi lần đầy.

   `frameGapMs` không có khi lịch sử không đủ hoặc có pause trên 2 s.
   `pauseInput` xóa lịch sử frame, giữ trace đã thu trong trận. Khoảng
   frame nhỏ bên cạnh delivery lớn hướng việc điều tra sang input delivery;
   khoảng frame lớn hướng sang main-thread stall. Đây là dấu vết để đối
   chiếu, chưa xác nhận nguyên nhân native iOS.

   `farHits` giữ tối đa tám gap lớn nhất trên 24 đơn vị world, kèm tuổi
   event, lead và cờ có timestamp. Chưa ghi tên/id người chơi hoặc tọa độ.
   Các schema mới optional, có giới hạn số lượng/giá trị, nested object
   strict. Export công khai chỉ giữ các trường kỹ thuật được cho phép,
   kể cả ở trong mảng; không đưa timestamp input tuyệt đối ra report.

## Kiểm chứng

Baseline trên main: typecheck/build qua, PWA 122 entry; 352 file
unit/integration, 3.588 pass và 1 skip (472,16 s); bốn visual input-clock và
shot-timeline qua (1,3 phút). Lượt đầu dùng nhầm node_modules symlink làm
shared package trỏ checkout cũ và thất bại ở hai spire test; đã bỏ kết quả
trộn phiên bản, cài dependencies riêng và chạy lại baseline đầy đủ ở trên.

Negative control với production cũ: ba regression thất bại (hit timestamp,
trace input, export). Sau khi có helper mới, cố ý trả về mốc cũ `now-lead`:
hai bài bundled-hit/miss thất bại. Khôi phục sửa: targeted input/perf/
timeline qua 47 test. Gap thật 40 vẫn được giữ, không chỉ kiểm tra gap 0.
Có kiểm tra backward compatibility, future/NaN event time, frame stall so
với frame đều, pause/reset, giới hạn tám mẫu, export và nested field lạ.

Browser regression đi qua nút touch thật của harness, gán timestamp event
cũ hơn 150 ms rồi kiểm tra action được latch, gửi và giữ đúng cặp timing
trong `slowInputs`. Đây là delayed-event replay, không giả làm trace Safari.
Kết quả visual sau sửa, budget và CI đầy đủ ghi trên PR.

Chi phí đo riêng trong Node: 100.000 lần ghi frame clock mất khoảng
8,17 ms (~0,082 µs/lần); đây không phải timing điện thoại. `at=123.456`
thêm 13 byte JSON cho mỗi hit. Với lịch sử bệnh lý gồm 80 hit, tăng
1.040 byte/snapshot chưa nén, tương đương 31,2 kB/s ở 30 Hz. Giữ field
optional và chỉ thêm ở hit, không thêm vào mọi event. Hai mảng trace được
gửi một lần cuối trận và mỗi mảng giới hạn tám mẫu. Không nới budget.

## Giới hạn và bước tiếp

Bản này sửa độ tin cậy của phép đo và thêm trace, chưa chứng minh đã giảm
159 ms input delivery trên 16e hoặc 140 ms cast confirmation trên Pixel.
Sau deploy cần trận thật trên cả hai máy, cùng một lượt raid và lượt chơi
lâu, để đọc paired trace. Nếu frame vẫn đều nhưng delivery cao, cần trace
input/pointer của WebKit trên thiết bị; nếu có stall thì lấy CPU trace tại
đoạn đó. Nếu hit còn lệch với timestamp chính xác, đối chiếu tuổi event,
lead, hold và snapshot gaps trước khi sửa prediction hay luật hit.
