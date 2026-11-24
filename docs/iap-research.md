# Bán gói xu (consumable) qua Apple In-App Purchase: nghiên cứu

> **Decision (19 Nov 2026):** no coin purchases in version 1.0. The app launches free; use this research when adding them later, once there are more players.

> Ngày nghiên cứu: 2026-11-19. Chỉ là nghiên cứu: chưa sửa code, chưa có
> migration. Mỗi nhận định có ghi nguồn. Mục nào **chưa xác minh** được
> đánh dấu ⚠️.
>
> Cách kiểm chứng:
>
> - **Plugin:** đọc trực tiếp mã nguồn các gói npm (tải về bằng `npm pack`)
>   và ngày phát hành trên npm registry.
> - **Apple:** tải các trang developer.apple.com bằng curl rồi đọc văn bản.
> - **Vụ Epic:** dựa vào kết quả tìm kiếm và báo chí. Trang supremecourt.gov
>   và ca9.uscourts.gov bị chặn mạng trong phiên này.

## Tóm tắt

| Câu hỏi                      | Trả lời ngắn                                                                                                                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin                       | **`@capgo/native-purchases` 8.9.16**: hỗ trợ Capacitor 8, có SPM, trả `jwsRepresentation`, `autoFinishTransactions: false` rồi `finishTransaction()` sau khi server xác nhận. Miễn phí (MPL-2.0). Phương án dự phòng: tự viết plugin Swift nhỏ như `AppleSignIn.swift`. |
| Xác minh                     | `@apple/app-store-server-library` 3.1.0: dùng `SignedDataVerifier.verifyAndDecodeTransaction()`. Cộng xu theo `transactionId`, và chỉ cộng một lần.                                                                                                                     |
| Gắn giao dịch với người chơi | `appAccountToken` là một UUID riêng cho mỗi người chơi. Server cộng xu cho **chủ của token**, không cộng cho người gửi request.                                                                                                                                         |
| Hoàn tiền                    | Server Notifications V2 gửi `REFUND`: trừ lại xu (không để số dư âm), ghi phần còn thiếu.                                                                                                                                                                               |
| Hoa hồng                     | 15% nếu đăng ký **Small Business Program** trước khi ra mắt.                                                                                                                                                                                                            |
| Restore                      | Không bắt buộc với consumable. Bắt buộc: xu **không được hết hạn**.                                                                                                                                                                                                     |
| Link mua ngoài (Mỹ)          | Hiện được phép, không cần entitlement, chưa có hoa hồng. Toà Tối cao (25-1311) xử ngày 11/1/2027, nên tình hình có thể đổi. Khuyên giai đoạn đầu chỉ dùng IAP.                                                                                                          |

Ba điểm dễ sai, riêng cho repo này:

1. **`express.json({ limit: "4kb" })` toàn cục** (`apps/server/src/server.ts:247`)
   sẽ trả 413 cho JWS giao dịch và `signedPayload` của Apple. Hai thứ này mang
   chuỗi 3 chứng chỉ x5c, nên thường lớn hơn 4 KB (⚠️ nên đo thực tế). Phải
   đăng ký route IAP **trước** dòng đó, với parser riêng khoảng 64 KB.
2. **Bản App Review và TestFlight mua bằng sandbox nhưng gọi server
   production.** Server production phải nhận cả giao dịch Sandbox, nếu không
   reviewer mua xong mà không thấy xu và app bị từ chối.
3. **Người chơi khách** (Supabase `signInAnonymously`, `apps/client/src/accounts.ts:838`)
   không khôi phục được tài khoản. Nên yêu cầu tài khoản thật trước khi mua,
   hoặc ít nhất cảnh báo rõ.

---

## 1. Chọn plugin Capacitor (StoreKit 2, consumable)

Repo dùng Capacitor **8.6.2** và iOS qua **Swift Package Manager**
(`apps/client/ios/App/CapApp-SPM/Package.swift`). Vì vậy plugin cần có
`Package.swift`.

| Tiêu chí                       | `@capgo/native-purchases`                                                                                | CdvPurchase (`capacitor-plugin-cdv-purchase` / `cordova-plugin-purchase`)                                                        | `@revenuecat/purchases-capacitor`                                                                      | Plugin Swift tự viết                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Bản mới nhất                   | 8.9.16 (13/11/2026). 256 bản, phát hành gần như hằng ngày                                                | 13.20.0 (27/10/2026)                                                                                                             | 14.1.2 (18/11/2026)                                                                                    | n/a                                                             |
| Capacitor 8                    | peer `@capacitor/core >=8.0.0`, có `Package.swift` (iOS 15)                                              | Bản Capacitor: peer `^6 \|\| ^7 \|\| ^8`, có `Package.swift`                                                                     | peer `>=8.0.0`, có `Package.swift`                                                                     | Có (giống `AppleSignIn.swift`)                                  |
| StoreKit 2                     | Có                                                                                                       | Bản Capacitor dùng SK2 native (`Transaction.updates`). Bản Cordova cần thêm `cordova-plugin-purchase-storekit2`; mặc định là SK1 | Có (SDK RevenueCat)                                                                                    | Có                                                              |
| Trả JWS / transactionId cho JS | Có cả hai: `jwsRepresentation`, `transactionId`, `appAccountToken`                                       | Có (`jwsRepresentation` trong bridge)                                                                                            | Chỉ có `transactionIdentifier`, **không có JWS** (đã xem type `PurchasesStoreTransaction`)             | Tuỳ mình                                                        |
| Finish sau khi server xác nhận | `autoFinishTransactions: false`, rồi `finishTransaction({transactionId})`, `getUnfinishedTransactions()` | Có: `transaction.finish()` sau khi `verify()` hoặc validator riêng                                                               | Mặc định RevenueCat tự finish sau khi backend **của họ** xác thực. Chế độ `MY_APP` thì phải tự làm hết | Tuỳ mình                                                        |
| Chi phí                        | Miễn phí, MPL-2.0                                                                                        | Miễn phí, MIT. Dịch vụ validator Iaptic tuỳ chọn, có phí                                                                         | Miễn phí đến $2.5K MTR mỗi tháng, sau đó 1%                                                            | Thời gian làm và bảo trì                                        |
| Nhận xét                       | API gọn, đúng nhu cầu                                                                                    | Trừu tượng nặng hơn, thiết kế quanh validator                                                                                    | Thêm một bên xử lý dữ liệu (privacy label). Trùng với ví xu đã có trên server                          | Khoảng 150–250 dòng Swift, không phụ thuộc ai, không có Android |

Nguồn:

- npm registry: `npm view <pkg> time`, ngày 19/11/2026.
- Mã nguồn đã đọc:
  - `@capgo/native-purchases`: `dist/esm/definitions.d.ts` và `ios/Sources/NativePurchasesPlugin/*.swift`. Ví dụ: `purchaseProduct` chỉ gọi `transaction.finish()` khi `autoFinishTransactions && autoAcknowledgePurchases`.
  - `capacitor-plugin-cdv-purchase`: `ios/Sources/PurchasePlugin/PurchasePlugin.swift`.
  - `@revenuecat/purchases-typescript-internal-esm`: `dist/customerInfo.d.ts`.
- Repo: https://github.com/Cap-go/capacitor-native-purchases · https://github.com/j3k0/cordova-plugin-purchase · https://github.com/RevenueCat/purchases-capacitor
- Giá RevenueCat: https://www.revenuecat.com/blog/company/jacob-on-pricing-23/.
  ⚠️ Các nguồn phụ chưa thống nhất 1% tính trên toàn bộ doanh thu hay chỉ
  phần vượt $2.5K.
- Capacitor 8 với SPM, theo `ionic-team/capacitor-docs` (`docs/main/ios/spm.md`):
  "Projects with Cordova plugins should work, but some plugins may not work
  correctly". Đây là lý do nên chọn plugin Capacitor native thay vì plugin
  Cordova. ⚠️ Đọc từ GitHub vì capacitorjs.com bị chặn.

**Khuyến nghị: `@capgo/native-purchases`, ghim phiên bản cố định** (repo đã
ghim `@capacitor/*`).

- Vì plugin phát hành rất dày, chỉ nâng phiên bản có chủ đích và đọc changelog.
- MPL-2.0 chỉ buộc công bố **file của plugin** nếu mình sửa file đó. Dùng
  nguyên bản thì không có nghĩa vụ gì.
- Nếu muốn không phụ thuộc bên ngoài, plugin Swift tự viết là phương án hợp
  lý. Repo đã có mẫu `ArenaViewController.registerPluginInstance`. Nó chỉ cần
  `Product.products(for:)`, `purchase(options: [.appAccountToken(uuid)])`,
  `Transaction.updates`, `Transaction.unfinished` và `finish()`.

Cấu hình cần thiết, đặt trong `capacitor.config.ts` để có hiệu lực trước khi
listener native chạy:

```ts
// trong object config của capacitor.config.ts
plugins: { NativePurchases: { autoFinishTransactions: false } },
```

---

## 2. Xác minh phía server (`@apple/app-store-server-library` 3.1.0, ngày 6/5/2026)

### Thông tin cần có

Lưu dưới dạng biến môi trường trên Render, giống cách `apple.ts` đang làm.

| Biến                                                                     | Lấy ở đâu                                                                                                                        | Dùng cho                                                                                                                                |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_APP_BUNDLE_ID`                                                    | đã có (`com.litojace.elementarena`)                                                                                              | verifier kiểm tra `bundleId`                                                                                                            |
| `APPLE_APP_APPLE_ID` (số)                                                | App Store Connect › App Information › Apple ID                                                                                   | **Bắt buộc** cho verifier Production. Thư viện throw `appAppleId is required when the environment is Production`                        |
| Apple Root CA (G3)                                                       | https://www.apple.com/certificateauthority/ ("Apple Root Certificates"). ⚠️ Tên file `AppleRootCA-G3.cer` chưa mở trực tiếp được | `SignedDataVerifier(rootCAs, …)`. Có thể commit vào repo vì đây là chứng chỉ công khai                                                  |
| `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY` (.p8) | Users and Access › Integrations › In-App Purchase › Generate In-App Purchase Key. File .p8 **chỉ tải được một lần**              | Chỉ cần cho `AppStoreServerAPIClient` (tra giao dịch, lịch sử hoàn tiền, test notification, consumption). **Không cần để xác minh JWS** |

Thư viện có `Environment`: `SANDBOX`, `PRODUCTION`, `XCODE`, `LOCAL_TESTING`.
Với `XCODE` và `LOCAL_TESTING`, chữ ký **không được kiểm tra** vì không phải
App Store ký, nên production không bao giờ được chấp nhận hai giá trị này.
`enableOnlineChecks = true` sẽ kiểm tra OCSP; server Render cần ra được mạng
Apple.

Nguồn:

- README và `dist/` của gói npm.
- https://github.com/apple/app-store-server-library-node
- https://developer.apple.com/documentation/appstoreserverapi/creating-api-keys-to-authorize-api-requests

### Luồng xác minh

1. Client gửi `jwsRepresentation`.
2. Server đọc `environment` trong payload, chưa tin, chỉ để chọn verifier
   Production hoặc Sandbox. Sau đó gọi `verifier.verifyAndDecodeTransaction(jws)`.
3. Kiểm tra các điều kiện sau:
   - `bundleId` khớp (thư viện đã kiểm).
   - `productId` có trong danh mục gói xu của server.
   - `type === "Consumable"`.
   - `revocationDate` trống.
   - `appAccountToken` có và trỏ về một người chơi.
   - Môi trường hợp lệ với server này.
4. Gọi RPC Postgres với quyền service role để cộng
   `coins × quantity` cho **chủ token**. Thao tác này idempotent theo
   `transaction_id`.
5. Trả số dư mới. Client lúc đó mới gọi `finishTransaction`.

Nếu server trả lỗi tạm thời, **không finish**. StoreKit sẽ giao lại giao dịch
qua `Transaction.updates` hoặc `getUnfinishedTransactions()` ở lần mở app sau.

Trích Apple, `Transaction.finish()`: "Call finish() to complete a transaction
after you deliver the purchased content"
(https://developer.apple.com/documentation/storekit/transaction/finish()).

### `appAccountToken`

Đây là UUID gắn giao dịch với tài khoản. Apple trả lại đúng UUID đó trong
thông tin giao dịch:

- https://developer.apple.com/documentation/storekit/product/purchaseoption/appaccounttoken(_:)
- https://developer.apple.com/documentation/appstoreserverapi/appaccounttoken

Khuyến nghị:

- Tạo một UUID ngẫu nhiên cho mỗi người chơi, lưu ở bảng `arena_iap_accounts`.
- Client lấy token đó từ server trước khi mua.
- `arena_profiles.id` vốn đã là UUID nên cũng dùng được, nhưng token riêng thì
  không lộ ID đăng nhập ra phía Apple.
- Server cộng xu theo token. Nhờ vậy một giao dịch chưa finish của tài khoản A
  bị gửi lên khi đang đăng nhập tài khoản B vẫn vào đúng tài khoản A.

### App Store Server Notifications V2

- Cấu hình URL production và sandbox tại App Information › App Store Server
  Notifications, chọn Version 2.
  (https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/enter-server-urls-for-app-store-server-notifications)
- Yêu cầu: TLS 1.2 trở lên, cổng 443 hoặc từ 1024 trở lên. Render dùng 443
  nên đạt.
- Xác minh bằng `verifier.verifyAndDecodeNotification(signedPayload)`, sau đó
  `verifyAndDecodeTransaction(data.signedTransactionInfo)`.

Cách xử lý từng loại notification:

- **`ONE_TIME_CHARGE`** (consumable mới mua): cộng xu idempotent, giống
  endpoint của client. Đây là đường dự phòng khi app bị tắt trước lúc gửi JWS.
- **`REFUND`**: trừ `min(số dư, xu đã cộng)` (bảng `arena_wallets` có
  `check (balance >= 0)`), ghi phần còn thiếu vào `clawback_due`. Tuỳ chính
  sách, có thể chặn mua tiếp đến khi trả đủ.
- **`REFUND_REVERSED`**: cộng lại.
- **`CONSUMPTION_REQUEST`**: không bắt buộc trả lời.
  `sendConsumptionInformation()` cần `customerConsented: true`, nghĩa là phải
  có sự đồng ý của người chơi. ⚠️ Cách lấy đồng ý chưa nghiên cứu sâu. Giai
  đoạn đầu có thể bỏ qua.
- **`TEST`**: ghi log.
- Luôn trả **HTTP 200** khi đã lưu notification, kể cả loại không dùng. Nếu
  không, Apple sẽ gửi lại.
- Chống trùng bằng `notificationUUID`.

Sandbox hoàn tiền: `beginRefundRequest` hoặc `refundRequestSheet` trên máy
test, sandbox tự duyệt rồi gửi `REFUND`. Với `CONSUMPTION_REQUEST` ở sandbox,
"you need to respond … within five minutes"
(https://developer.apple.com/documentation/storekit/testing-refund-requests).

### Phác thảo endpoint (`apps/server/src/iap-apple.ts`)

```ts
// Đăng ký TRƯỚC app.use(express.json({ limit: "4kb" })) trong server.ts.
const big = express.json({ limit: "64kb" });

app.get(
  "/api/iap/apple/token",
  route(false, async (_q, res, _t, account) => {
    if (isGuest(account)) throw new AccountError(403, "Sign in to buy coins."); // ⚠️ repo chưa có cờ guest phía server: cần thêm (Supabase is_anonymous)
    res.json({ appAccountToken: await iap.tokenFor(account.id) }); // tạo nếu chưa có
  }),
);

app.post(
  "/api/iap/apple/transaction",
  big,
  route(false, async (req, res) => {
    const { jws } = jwsSchema.parse(req.body); // string, ≤ 64 KB
    const tx = await verifyTransaction(jws); // chọn verifier theo env, throw nếu sai
    const pack = COIN_PACKS[tx.productId];
    if (!pack || tx.type !== "Consumable" || tx.revocationDate)
      throw new AccountError(400, "Not a coin pack.");
    const r = await iap.grant({
      // rpc arena_iap_grant (service role)
      transactionId: tx.transactionId,
      token: tx.appAccountToken,
      productId: tx.productId,
      coins: pack.coins * (tx.quantity ?? 1),
      environment: tx.environment,
      purchasedAt: tx.purchaseDate,
      jws,
    });
    res.json({ ok: true, balance: r.balance, alreadyGranted: r.duplicate });
  }),
);

app.post("/api/iap/apple/notifications", big, async (req, res) => {
  const n = await verifyNotification(req.body.signedPayload); // không cần login
  await iap.recordNotification(n); // idempotent theo notificationUUID; REFUND → arena_iap_refund
  res.sendStatus(200);
});
```

Lưu ý thêm:

- `apiCors` đã cho phép origin của app iPhone.
- Webhook của Apple không gửi Origin, nên route notifications không bị ảnh
  hưởng.
- Kiểm tra xem `apiClock` có làm gì với request không có token không. ⚠️
  Chưa đọc kỹ.

### Bảng Supabase (migration chạy lại được)

```sql
-- supabase/migrations/2026MMDDhhmmss_apple_iap_coins.sql
begin;
create table if not exists public.arena_iap_accounts (
  player_id uuid primary key references public.arena_profiles(id) on delete cascade,
  app_account_token uuid not null unique default gen_random_uuid()
);
create table if not exists public.arena_iap_transactions (
  transaction_id text primary key,                 -- idempotency
  original_transaction_id text,
  player_id uuid references public.arena_profiles(id) on delete set null,
  product_id text not null,
  coins integer not null check (coins > 0),
  environment text not null check (environment in ('Production', 'Sandbox')),
  purchased_at timestamptz not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  clawback_due integer not null default 0 check (clawback_due >= 0),
  signed_transaction text not null
);
create index if not exists arena_iap_transactions_player on public.arena_iap_transactions(player_id);
create table if not exists public.arena_iap_notifications (
  notification_uuid text primary key,
  notification_type text not null,
  subtype text,
  transaction_id text,
  received_at timestamptz not null default now()
);
revoke all on public.arena_iap_accounts, public.arena_iap_transactions,
  public.arena_iap_notifications from public, anon, authenticated;

create or replace function public.arena_iap_grant(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid; n integer; c integer = (p->>'coins')::integer; bal integer;
begin
  select player_id into pid from arena_iap_accounts
   where app_account_token = (p->>'token')::uuid;
  if pid is null or c is null or c <= 0 then raise exception 'Unknown account or pack'; end if;
  perform 1 from arena_profiles where id = pid for update;      -- khoá theo người chơi
  insert into arena_iap_transactions(transaction_id, original_transaction_id, player_id,
      product_id, coins, environment, purchased_at, signed_transaction)
    values (p->>'transactionId', p->>'originalTransactionId', pid, p->>'productId', c,
      p->>'environment', (p->>'purchasedAt')::timestamptz, p->>'jws')
    on conflict (transaction_id) do nothing;
  get diagnostics n = row_count;
  if n = 1 then
    insert into arena_wallets(player_id, balance) values (pid, c)
      on conflict (player_id) do update set balance = arena_wallets.balance + c;
    insert into arena_coin_ledger(player_id, amount, reason, ref, day)
      values (pid, c, 'iap-apple', p->>'transactionId', public.arena_today())
      on conflict do nothing;
  end if;
  select balance into bal from arena_wallets where player_id = pid;
  return jsonb_build_object('balance', bal, 'duplicate', n = 0);
end $$;
revoke all on function public.arena_iap_grant(jsonb) from public, anon, authenticated;
commit;
```

Ghi chú về migration:

- Mọi lệnh đều là `if not exists`, `create or replace`, `on conflict` hoặc
  `revoke`, nên chạy hai lần không sao. Kiểm tra bằng
  `node scripts/check-migrations.mjs <file>`.
- Migration phải đi cùng lần push với code server, theo `CLAUDE.md`.
- Thêm `arena_iap_refund(transaction_id)`, cũng idempotent: đặt
  `revoked_at`, trừ xu, ghi ledger `reason='iap-apple-refund'`.
- **Xoá tài khoản** (`arena_delete_my_account`, 5.1.1(v)):
  `on delete set null` giữ lại dòng giao dịch cho kế toán và đối chiếu hoàn
  tiền, nhưng mất liên kết tới người chơi. ⚠️ Nên cân nhắc thời gian lưu và
  ghi vào chính sách bảo mật.
- ⚠️ `gen_random_uuid()` cần pgcrypto hoặc PG13 trở lên. Supabase có sẵn,
  nhưng cần thử trên PGlite của `check-migrations`.
- ⚠️ Cột `day` của ledger: kiểm tra xem `arena_today()` và các giới hạn
  "coins per day" hiện có có tính cả lý do mới `iap-apple` không. Nếu có thì
  phải loại ra.

---

## 3. Các bước trong App Store Connect

1. **Paid Apps Agreement** (Business › Agreements), do Account Holder ký.
   - "You won't be able to create a new app or In-App Purchase until you've agreed to the most recent version of the Paid Apps Agreement."
   - Đây cũng là điều kiện để test sandbox.
   - Nguồn: https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements
2. **Thuế** (Business › Agreements › Tax Forms).
   - Người ở Mỹ khai W-9. Người ngoài Mỹ khai W-8BEN, W-8BEN-E hoặc W-8ECI, theo bảng câu hỏi của Apple.
   - Đã nộp thì không tự sửa được.
   - ⚠️ Nếu chủ app là cá nhân ở Việt Nam: theo hiểu biết của tôi, hiệp định thuế Mỹ–Việt (ký năm 2015) **chưa có hiệu lực**, nên có thể bị khấu trừ thuế Mỹ mức cao. Chưa xác minh, nên hỏi tư vấn thuế.
   - Nguồn: https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information
3. **Ngân hàng** (Business › Bank Accounts). Phải ký agreement và nộp thuế trước. Tài khoản phải đứng tên đúng cá nhân hoặc pháp nhân đã đăng ký Developer Program.
   - Nguồn: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information
4. **Small Business Program**: hoa hồng 15% cho developer mới hoặc có ≤ 1 triệu USD proceeds năm trước. Đăng ký qua form, cần đã chấp nhận Paid Apps Agreement.
   - Hiệu lực: "Your proceeds will be adjusted fifteen (15) days after the end of the fiscal calendar month in which your enrollment is approved." Vì vậy **nên đăng ký trước khi ra mắt**.
   - Nguồn: https://developer.apple.com/app-store/small-business-program/
5. **Tạo consumable** (App › Monetization › In-App Purchases › (+) › Consumable).
   - Product ID: chữ, số, `-`, `.`, `_`, tối đa 100 ký tự. **Không sửa được, không dùng lại được**, kể cả sau khi xoá. Gợi ý: `com.litojace.elementarena.coins.500`.
   - Reference Name: tối đa 64 ký tự.
   - Display Name: 2–30 ký tự.
   - Description: tối đa 45 ký tự.
   - Giá (price tier) và quốc gia (Mỹ trước).
   - **Ảnh chụp cho Review**: kích thước giống ảnh màn hình app. Ảnh ngang iPhone ví dụ 2868×1320 hoặc 2796×1290. Ảnh 1024×1024 là ảnh quảng bá tuỳ chọn, không phải ảnh review.
   - Review Notes: tối đa 4000 ký tự.
   - Metadata có thể mất đến khoảng 1 giờ mới hiện ở sandbox.
   - Trạng thái trong tài liệu hiện tại là "Prepare for Submission", rồi "Ready for Review", "Waiting for Review", "Approved". ⚠️ Giao diện có thể vẫn ghi "Missing Metadata" hoặc "Ready to Submit".
   - Nguồn: https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information
6. **Sandbox tester** (Users and Access › Sandbox › (+)).
   - Dùng email chưa từng là Apple Account. Có thể dùng `ten+us1@…`.
   - Trên máy: bật Developer Mode, mua thử một lần, sau đó Settings › Developer › Sandbox Apple Account. Từ đó có thể Clear Purchase History.
   - Nguồn: https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account
7. **StoreKit Configuration File** để test trong Xcode.
   - File › New › StoreKit Configuration File. Có thể đồng bộ với App Store Connect (bản đồng bộ chỉ đọc).
   - Bật trong Scheme › Run › Options.
   - JWS tạo ra do **Xcode ký**, không phải App Store. Server phải bỏ qua bước này: chỉ verify với `Environment.XCODE` trong dev, hoặc test client thuần.
   - Nguồn: https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode
8. **Nộp IAP đầu tiên cùng bản build**: "The first consumable … In-App Purchase of each type must be submitted with a new app version."
   - Thêm IAP vào phần In-App Purchases của version rồi Submit.
   - Ghi trong Review Notes: cách tới cửa hàng xu và tài khoản demo.
   - Nguồn: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase
9. Đặt URL Server Notifications (production và sandbox).
10. Tạo In-App Purchase key nếu dùng Server API. Bấm "Request a Test Notification" để thử.

---

## 4. Những điểm dễ bị từ chối khi bán tiền ảo

Nguồn chính: https://developer.apple.com/app-store/review/guidelines/
(Last Updated: 16/10/2026; đã đối chiếu trích dẫn với bản tải về).

- **3.1.1, bắt buộc dùng IAP:** "in-game currencies … you must use in-app purchase."
- **3.1.1, không hết hạn:** "Any credits or in-game currencies purchased via in-app purchase may not expire, and you should make sure you have a restore mechanism for any restorable in-app purchases."
  - Xu mua bằng tiền thật không được có ngày hết hạn, không bị reset theo mùa và không mất khi tài khoản không hoạt động.
  - Hiện `arena_wallets` không có hạn: tốt.
- **Restore:** guideline chỉ yêu cầu với hàng "restorable". Tài liệu StoreKit ghi consumable là "not restorable", và "Consumable Apple In-App Purchases also don't appear in the current entitlements".
  - Nút "Restore Purchases" là **không bắt buộc** cho app chỉ có consumable.
  - Xu nằm trên server nên đăng nhập máy khác vẫn còn. Đây là lý do thêm để yêu cầu tài khoản thật.
  - ⚠️ Guideline không viết thẳng "consumable không cần restore"; đây là suy ra từ tài liệu StoreKit.
- **Loot box:** "must disclose the odds of receiving each type of item to customers prior to purchase."
  - Gói xu cố định thì không phải loot box.
  - Tôi không thấy vật phẩm ngẫu nhiên nào bán bằng xu trong `packages/shared`. Nếu sau này thêm rương hay quay ngẫu nhiên, phải hiện tỷ lệ, và câu hỏi tuổi "Loot Boxes" sẽ thành Có.
- **Hiển thị giá:**
  - Luôn dùng `displayPrice` hoặc `priceString` từ StoreKit (`getProducts`), không ghi cứng "$4.99".
  - 2.3.1(a) cấm "promoting a false price".
  - 2.3.2 yêu cầu mô tả và ảnh chụp nói rõ món nào cần mua thêm.
  - 5.6 cấm lừa người dùng mua.
  - Hiện rõ số xu nhận được trước khi bấm mua.
- **Privacy label:** khai "Purchases › Purchase History", **Linked to user**, mục đích App Functionality.
  - Lý do: server lưu giao dịch gắn tài khoản, và "collect" là đưa dữ liệu ra khỏi máy để lưu lâu hơn thời gian xử lý.
  - "Payment Info" không phải khai vì Apple xử lý thanh toán.
  - ⚠️ Kết luận này suy ra từ định nghĩa, Apple không nói rõ cho trường hợp này.
  - Nguồn: https://developer.apple.com/app-store/app-privacy-details/
- **Age rating:** hệ thống mới có 4+, 9+, 13+, 16+, 18+ (tin ngày 24/7/2025).
  - Bảng câu hỏi có "Loot Boxes" (xếp 9+), "Parental Controls … making purchases", và từ 16/11/2026 có thêm "Shared Location" và "Dating" (hạn 12/1/2027).
  - ⚠️ Không thấy câu hỏi riêng về IAP thông thường.
  - ⚠️ Không xác nhận được điều kiện để nhãn "In-App Purchases" hiện trên trang sản phẩm.
  - App có chat: kiểm tra lại câu trả lời về chat và nội dung người dùng tạo.
  - Nguồn: https://developer.apple.com/news/?id=ks775ehf · https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- **5.1.1(v):** đã có xoá tài khoản trong app (`/api/account/delete`). Cần quyết định xu đã mua sẽ thế nào khi xoá; nên cảnh báo người chơi rằng xu sẽ mất.
- **Ask to Buy / giao dịch pending:** `purchase` có thể trả `pending`, và giao dịch tới sau qua `transactionUpdated`. UI không được báo lỗi trong trường hợp này. ⚠️ Chưa kiểm tra plugin Capgo xử lý `pending` thế nào; cần test với sandbox "Ask to Buy".

### Link mua ngoài ở Mỹ sau vụ Epic v. Apple (đến 19/11/2026)

- **Guideline hiện tại**, 3.1.1(a): entitlement "are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps". 3.1.3 có ngoại lệ tương tự cho storefront Mỹ.
- **Ninth Circuit**, ngày 11/12/2025, số 25-2935, 161 F.4th 1162:
  - Giữ nguyên phán quyết coi thường toà (contempt) ngày 30/4/2025.
  - Bác lệnh cấm mọi hoa hồng.
  - Trả hồ sơ về toà quận để định mức hoa hồng dựa trên chi phí "genuinely and reasonably necessary".
  - Nguồn: https://cdn.ca9.uscourts.gov/datastore/opinions/2025/12/11/25-2935.pdf
- **Toà quận** (4:20-cv-05640-YGR): Apple đề xuất ngày 13/8/2026 mức 15%, 10% cho một số chương trình, và 5% cho Small Business. Ba mức này các nguồn tả hơi khác nhau. **Chưa có mức nào được duyệt.** Tranh chấp về tài liệu vẫn đang diễn ra (17/11/2026).
  - Nguồn: https://9to5mac.com/2026/08/13/apple-proposes-commissions-of-up-to-15-for-off-app-store-purchases-in-the-us/ · https://9to5mac.com/2026/11/17/epic-accuses-apple-of-withholding-122000-documents-seeks-daily-fines/
- **Toà Tối cao, số 25-1311:**
  - Đơn xin xét xử nộp ngày 26/5/2026, được chấp nhận ngày 30/6/2026, chỉ cho câu hỏi về tiêu chuẩn contempt.
  - Đơn xin hoãn bị bác (5/2026 và 8/2026).
  - **Tranh luận miệng ngày 11/1/2027.** Phán quyết dự kiến trước khoảng tháng 6/2027.
  - Nguồn: https://www.supremecourt.gov/qp/25-01311qp.pdf · https://www.scotusblog.com/cases/apple-inc-v-epic-games-inc-3/
  - ⚠️ Không mở được trang docket chính thức. Ngày tranh luận lấy từ báo chí (mactech.com).
- **Ý nghĩa thực tế:** hiện không có hoa hồng cho mua qua link ở Mỹ, nhưng mức phí có thể được định bất cứ lúc nào, và phán quyết năm 2027 có thể thay đổi toàn bộ. **Khuyên giai đoạn đầu chỉ dùng IAP.** Nếu muốn link ra web shop sau này, làm thành tính năng riêng: chỉ storefront Mỹ, bật tắt từ server.

---

## 5. Kế hoạch triển khai cho repo

### Thứ tự công việc

1. **Danh mục gói xu dùng chung:** `packages/shared/src/coin-packs.ts` (productId, số xu, nhãn). Client và server đọc cùng một nguồn, theo `CLAUDE.md` về nội dung dùng chung. Kèm unit test kiểm tra productId duy nhất và số xu dương.
2. **Migration** `supabase/migrations/<timestamp>_apple_iap_coins.sql` như mục 2. Thêm `arena_iap_refund`. Chạy `scripts/check-migrations.mjs`. Thêm integration test ở `tests/integration/iap.test.ts`: cộng một lần, gửi lại không cộng thêm, hoàn tiền, hoàn tiền khi số dư không đủ, token lạ.
3. **Server:**
   - `npm i -w @arena/server @apple/app-store-server-library@3.1.0`, ghim bản.
   - `apps/server/src/iap-apple.ts`: config lấy từ biến môi trường giống `appleConfig()`; hai verifier Production và Sandbox; verifier Xcode chỉ bật khi `NODE_ENV !== "production"`; ba route.
   - Đăng ký route trong `server.ts` **trước** `express.json({ limit: "4kb" })`.
   - Thêm hàm vào account provider (`grant`, `tokenFor`, `recordNotification`) để test dùng bản giả được, giống `provider.apple`.
   - Thêm `setVerifier` cho test, giống `setAppleFetch`.
   - Root CA: `apps/server/certs/AppleRootCA-G3.cer`.
   - Thêm biến mới vào `scripts/check-native-env.mjs` hoặc tài liệu Render. Giữ nguyên tắc hiện có: thiếu cấu hình thì route trả 503 với thông báo rõ ràng.
4. **Client:**
   - `npm i -w @arena/client @capgo/native-purchases@8.9.16`, sau đó `npx cap sync ios`. Kiểm tra `CapApp-SPM/Package.swift` có thêm gói.
   - `capacitor.config.ts`: `plugins.NativePurchases.autoFinishTransactions = false`.
   - `apps/client/src/native.ts` (nơi duy nhất biết đang chạy trong app) hoặc file mới `apps/client/src/iap.ts`, với các việc sau:
     - `initPurchases()` khi app chạy: đăng ký `transactionUpdated`, gọi `getUnfinishedTransactions()`, và gửi từng giao dịch lên server.
     - `loadPacks()`: `getProducts`.
     - `buyPack(id)`: lấy token, gọi `purchaseProduct({ productIdentifier, appAccountToken, autoAcknowledgePurchases: false })`, POST JWS, rồi `finishTransaction`.
     - Chỉ finish khi server trả 200, kể cả trường hợp `alreadyGranted`. Không finish khi gặp lỗi mạng hoặc 5xx. Với 4xx vĩnh viễn (giao dịch không hợp lệ) thì finish và ghi log.
   - UI cửa hàng: chỉ hiện trong app iPhone (`isNativeApp()`). Website và PWA không bán, vì Apple không liên quan ở đó. Giá lấy từ `displayPrice`. Người chơi khách thấy lời mời đăng ký. Có trạng thái chờ và trạng thái `pending`.
   - Cập nhật số xu sau khi mua bằng cơ chế ví hiện có.
5. **Visual test:**
   - Thêm fake plugin trong harness, kiểu `tests/visual/*-fake.ts`.
   - Spec cửa hàng xu ở màn hình điện thoại ngang nhỏ và safe-area (ưu tiên trong `CLAUDE.md`).
   - Chạy `panel-scroll` nếu panel cửa hàng thay đổi layout.
6. **Tài liệu:**
   - Thêm mục "In-App Purchase" vào `docs/ios-app.md`: biến môi trường, ASC, sandbox.
   - Thêm trang hỗ trợ và chính sách bảo mật: dữ liệu mua hàng, hoàn tiền.
7. **Ra mắt:** ký agreement, thuế, ngân hàng, Small Business; tạo IAP kèm ảnh review; đặt URL notification; submit IAP cùng bản build.

### Checklist test sandbox từ đầu đến cuối

- [ ] Xcode với StoreKit config: `getProducts` trả đúng giá và tên; mua thành công; UI cập nhật. Trường hợp này server không verify được với Production hoặc Sandbox, như dự kiến.
- [ ] Bản dev trên máy thật với sandbox tester US: mua gói nhỏ; server log `environment=Sandbox`; xu tăng đúng; ledger có `iap-apple`; giao dịch đã finish (`getUnfinishedTransactions` rỗng).
- [ ] Gửi lại cùng JWS bằng curl: `alreadyGranted: true`, xu không tăng.
- [ ] Tắt mạng sau khi Apple báo mua xong, hoặc kill app trước lúc POST: mở lại thì `transactionUpdated` hoặc unfinished gửi lại, xu vào đúng một lần.
- [ ] Notification `ONE_TIME_CHARGE` tới URL sandbox; cùng giao dịch đó không bị cộng hai lần.
- [ ] Đăng nhập tài khoản B khi còn giao dịch chưa finish của A: xu vào A, không vào B.
- [ ] Người chơi khách: không mua được, thấy lời mời đăng ký.
- [ ] Huỷ ở sheet của Apple: không lỗi, không gọi server.
- [ ] Ask to Buy hoặc pending (bật trong sandbox tester): UI báo "đang chờ duyệt"; sau khi duyệt thì xu vào.
- [ ] Hoàn tiền bằng `beginRefundRequest`: nhận `REFUND`, xu bị trừ; nếu đã tiêu hết thì `clawback_due` > 0. Thử `REFUND_DECLINED` và `REFUND_REVERSED`.
- [ ] "Request a Test Notification" qua Server API: endpoint trả 200, có log `TEST`.
- [ ] Gửi JWS giả hoặc bị sửa, productId lạ, bundle khác: 400, không cộng xu.
- [ ] Payload lớn hơn 4 KB đi qua được (xác nhận route nằm trước parser 4kb).
- [ ] TestFlight (sandbox) gọi **server production**: mua được, xu vào. Đây chính là đường của App Review.
- [ ] Chạy migration hai lần (`check-migrations`) và các integration test IAP.
- [ ] Clear Purchase History của tester, rồi mua lại cùng gói nhiều lần: mỗi lần là một transactionId mới.

---

## Chưa xác minh được (⚠️ tổng hợp)

- Kích thước thực tế của JWS so với giới hạn 4 KB: cần đo.
- Tên file root CA trên apple.com (trang bị chặn trong phiên này).
- Plugin Capgo xử lý giao dịch `pending` thế nào.
- Trạng thái hiện tại của hiệp định thuế Mỹ–Việt và mức khấu trừ.
- Điều kiện hiện nhãn "In-App Purchases" trên trang sản phẩm.
- Trang docket Toà Tối cao 25-1311 và các lệnh mới nhất của toà quận: chỉ có qua báo chí.
- Cách RevenueCat tính 1% (toàn bộ hay phần vượt $2.5K).
- Các tên trạng thái IAP trên giao diện App Store Connect.
