# Nhật Ký Calo — hướng dẫn cho người cài đặt

App chụp ảnh bữa ăn để tính calo, cộng dồn theo ngày so với mục tiêu giảm cân, kèm cây hoa, chuỗi ngày,
huy hiệu, lời nhắn và quà theo mốc để giữ động lực. App là một trang web cài được lên màn hình chính điện
thoại (PWA): mở bằng một chạm, chạy toàn màn hình, mở được cả khi mất mạng. Dữ liệu nằm ngay trên điện thoại
của người dùng.

Việc cần làm một lần: **(1)** đưa app lên mạng, **(2)** lấy khoá Claude, **(3)** cài lên máy vợ,
**(4)** thiết lập và viết lời nhắn.

---

## 1. Đưa app lên mạng

**Bước này đã làm xong (21/11/2026).** App đang chạy ở **https://daydreamer13.github.io/nhat-ky-calo/**, mã nguồn
nằm ở kho GitHub `Daydreamer13/nhat-ky-calo`. Phần dưới đây chỉ để tham khảo khi cần dựng lại ở nơi khác.

App chỉ gồm các file tĩnh trong thư mục này. Điện thoại cần một địa chỉ **https** mới cài được.
Cách đơn giản nhất là GitHub Pages:

- Tạo một kho trên GitHub (ví dụ `nhat-ky-calo`) và đẩy toàn bộ thư mục này lên nhánh `main`.
- Vào **Settings → Pages**, chọn *Deploy from a branch*, nhánh `main`, thư mục `/ (root)`.
- Sau khoảng một phút, app có ở `https://<tên-tài-khoản>.github.io/nhat-ky-calo/`.

Trong các file này không có gì bí mật: khoá Claude và dữ liệu của vợ không nằm trong kho. Chỉ đưa lên đúng các
file của app; file nháp hay dữ liệu mẫu tự tạo khi chạy thử (xem cuối trang) thì để ngoài.

**Một điều nên biết.** Mọi trang GitHub Pages của cùng một tài khoản dùng chung một "địa chỉ gốc"
(`<tên-tài-khoản>.github.io`), và trình duyệt cho các trang cùng địa chỉ gốc đọc dữ liệu của nhau. Nghĩa là
một trang khác trong cùng tài khoản về lý thuyết đọc được nhật ký và khoá Claude lưu trên máy. Với các trang
do chính mình viết thì không sao; chỉ cần đừng đặt vào tài khoản đó trang nào chạy mã của người lạ.

## 2. Lấy khoá Claude (để app tự tính calo từ ảnh)

App gọi thẳng Claude của Anthropic từ điện thoại bằng một **khoá API** tạo ở Claude Console
(platform.claude.com). Khoá này khác với việc đăng nhập để chat: không thể dùng đăng nhập của gói Claude
thay cho khoá.

### Cách A — đang dùng gói Claude Max, Ultra hoặc Team: không tốn thêm tiền

Các gói này kèm tín dụng API mỗi tháng (Max 100 USD, Ultra 200 USD). App thường dùng khoảng 3–5 USD mỗi
tháng, nhiều thì tới khoảng 8 USD.

1. Mở **claude.ai** trên trình duyệt web, vào **Settings → Billing**.
2. Ở mục **API credits**, chọn **Link organization**.
3. Chọn tổ chức Claude Console sẽ nhận tín dụng, hoặc tạo mới ngay trong bước này.
4. Đọc **Supplemental Credit Terms** rồi bấm **Link organization**.
5. Đăng nhập **platform.claude.com** bằng đúng email của claude.ai, tạo một API key trong tổ chức vừa liên
   kết. Chép chuỗi bắt đầu bằng `sk-ant-…` (chỉ hiện một lần).

Cần biết:

- Không tự đổi được tổ chức đã liên kết (muốn đổi phải nhờ bộ phận hỗ trợ), nên chọn cho đúng từ đầu.
- Tài khoản mới phải ở gói đủ điều kiện 7 ngày mới nhận được tín dụng.
- Tín dụng về theo kỳ thanh toán và không cộng dồn. Hết tín dụng thì app tạm không tính được calo cho tới kỳ
  sau; không bị trừ vào gói. Không cần thêm thẻ thanh toán, và đừng bật tự động nạp tiền nếu không định trả thêm.
- Mọi khoá trong tổ chức dùng chung số dư. Vì khoá sẽ nằm trên điện thoại của vợ, nên tạo một **workspace
  riêng** cho app, đặt giới hạn chi tiêu thấp cho workspace đó (ví dụ 10 USD mỗi tháng) rồi tạo khoá ở đấy.

### Cách B — gói Pro hoặc không dùng gói nào: trả theo lượt dùng

1. Vào **platform.claude.com**, đăng ký hoặc đăng nhập.
2. Mục **Billing**: nạp tiền trước.
3. Mục **API keys** → **Create key**. Chép chuỗi bắt đầu bằng `sk-ant-…`.
4. Đặt **giới hạn chi tiêu hằng tháng**. Mức 10 USD đủ cho mọi mức nhận diện; nếu chỉ đặt 5 USD thì nên chọn
   mức "Cân bằng" hoặc "Tiết kiệm" trong app.

Chi phí (ước tính từ bảng giá tháng 11/2026 với khoảng 4 ảnh mỗi ngày; chưa đo bằng ảnh thật):

| Mức nhận diện trong app | Mô hình | Mỗi ảnh | Mỗi tháng |
|---|---|---|---|
| Chính xác nhất (mặc định) | Claude Opus 5.5 | khoảng 1.000 đ | khoảng 120.000 đ |
| Cân bằng | Claude Sonnet 5.5 | khoảng 500 đ | khoảng 60.000 đ |
| Tiết kiệm | Claude Haiku 5.5 | khoảng 30 đ | khoảng 3.600 đ |

Đổi mức bất cứ lúc nào trong **Cài đặt → Kết nối Claude**. Chưa có khoá thì app vẫn dùng được: chụp ảnh để
lưu, nhập calo bằng tay, theo dõi đầy đủ.

## 3. Cài lên điện thoại

- **Android (Chrome):** mở địa chỉ app → nút **⋮** → **Thêm vào màn hình chính** (hoặc **Cài đặt ứng dụng**).
  Trong app cũng có nút cài ở **Cài đặt → Cài lên màn hình chính**.
- **iPhone (Safari):** mở địa chỉ app bằng **Safari** → chạm nút **Chia sẻ** (ô vuông có mũi tên lên; nếu không
  thấy thì chạm nút **•••** cạnh ô địa chỉ rồi chọn **Chia sẻ**) → kéo xuống, chọn **Thêm vào Màn hình chính**
  (không thấy thì vào **Sửa tác vụ** để thêm). Nếu có công tắc mở dưới dạng ứng dụng web thì giữ bật, rồi
  chạm **Thêm**.

Từ đó luôn mở app bằng biểu tượng trên màn hình chính. Trên Android, tab Chrome vừa dùng để cài có thể đóng
đi: nó và app trên màn hình chính dùng chung một kho dữ liệu (app tự đọc lại số liệu mới khi chuyển qua lại),
dùng một nơi cho gọn.

**Riêng iPhone:** app trên Màn hình chính có kho dữ liệu riêng, tách khỏi Safari. Vì vậy hãy **cài trước, rồi mới
thiết lập** trong app mở từ biểu tượng. Nếu đã lỡ nhập trong Safari, vào **Cài đặt → Cài lên màn hình chính**:
ở đó có nút sao lưu để mang dữ liệu sang app vừa cài.

App chạy trên iPhone từ iOS 15.4 và Android có Chrome 100 trở lên.

## 4. Thiết lập lần đầu

**Cách A — làm thẳng trên máy vợ** (sau khi đã cài). Mở app từ biểu tượng, đi qua bốn bước: tên gọi, cơ thể,
mục tiêu, dán khoá Claude. Sau đó vào **Cài đặt (bánh răng) → Lời nhắn và quà**.

**Cách B — chuẩn bị trên máy tính rồi chuyển sang** (gõ lời nhắn bằng bàn phím cho tiện):

1. Mở app trên máy tính, làm bốn bước làm quen. Cân nặng nhập tạm cũng được.
2. Vào **Cài đặt**: dán khoá, chọn xưng hô, viết lời nhắn, đặt quà theo mốc.
3. **Cài đặt → Sao lưu và khôi phục**: tích **Kèm khoá Claude**, bấm **Sao lưu ra file**.
4. Gửi file `.json` đó sang máy vợ (Zalo, AirDrop, Drive…). Trên máy vợ, mở app **từ biểu tượng trên màn hình
   chính**, ở màn chào bấm **Đã có file sao lưu hoặc file thiết lập** và chọn file. Xong thì **xoá file và tin
   nhắn chứa file**, vì trong đó có khoá.

   *Trên iPhone*, app chỉ chọn được file nằm trong ứng dụng **Tệp**. Nhận file qua Zalo hay ứng dụng nhắn tin
   khác thì mở file, chạm **Chia sẻ** rồi chọn **Lưu vào Tệp**; nhận qua AirDrop thì chọn **Tệp** khi máy hỏi
   mở bằng gì. Lúc app hỏi chọn file, tìm trong **Tệp** (mục Gần đây hoặc Trên iPhone).

File chưa có bữa ăn nào được app hiểu là file thiết lập: hành trình tính từ ngày vợ nhận app. Hôm đó vợ vào
**Hành trình → Ghi cân nặng** nhập số cân thật; số ấy trở thành mốc bắt đầu. Về sau muốn sửa mốc bắt đầu thì
vào **Cài đặt → Hồ sơ và mục tiêu → Cân lúc bắt đầu**.

Các mục đáng thiết lập trong **Lời nhắn và quà**:

- **App gọi người dùng là**: `bạn`, `em`, `chị` hoặc `mình`. Chọn `em` thì app nói “Chuỗi 5 ngày đang chờ em”.
- **Lời nhắn ký tên là**: ví dụ `anh` → thẻ “Lời nhắn từ anh” ở màn Hôm nay.
- **Lời nhắn yêu thương**: viết sẵn tới 20 lời; mỗi ngày app hiện một lời, xoay vòng. Lời nhắn cũng hiện
  trong các màn chúc mừng.
- **Quà theo mốc giảm cân**: ví dụ giảm 2 kg → “Một buổi spa”. Khi cân nặng chạm mốc, app báo tin vui và
  “mở quà”. Quà đã mở thì không bị khoá lại khi cân nhích lên. Nhớ giữ lời.

## 5. Dùng hằng ngày (để chỉ cho vợ)

- **Nút máy ảnh lớn ở giữa**: chụp bữa ăn. Không cần chờ: đóng lại được ngay, app tự nhận diện rồi ghi vào
  nhật ký. Chạm vào bữa đã ghi để chỉnh khẩu phần (¾, 1, 1¼…), sửa số calo, bỏ món không ăn, hoặc mô tả
  thêm để tính lại.
- **Món hay ăn**: những món lặp lại (cà phê sữa, chuối…) ghi bằng một chạm.
- **Gõ tên món**: khi không tiện chụp.
- **Ly nước**: chạm để đếm ly.
- **Hành trình**: ghi cân nặng (mỗi tuần một lần là đủ), xem cây hoa, chuỗi ngày, huy hiệu, quà. Gõ nhầm số
  cân thì xoá được ngay trong danh sách "Các lần cân gần đây".
- Chạm một ngày trên dải tuần, hoặc trên lịch ở màn Hành trình, để xem hoặc ghi bù ngày cũ.

## 6. Sao lưu

Dữ liệu chỉ nằm trên điện thoại. Thỉnh thoảng vào **Cài đặt → Sao lưu và khôi phục → Sao lưu ra file** và cất
file vào Drive/iCloud (tích **Kèm ảnh bữa ăn** nếu muốn giữ cả ảnh). Đổi máy: cài app trên máy mới rồi
**Khôi phục từ file**.

## 7. Khi app báo lỗi

| App báo | Nghĩa là | Việc cần làm |
|---|---|---|
| “App chưa tự tính calo được…” kèm nút mở Cài đặt | Chưa có khoá, khoá sai, hoặc tài khoản của khoá có vấn đề | Mở dòng “Thông tin cho người cài đặt” ngay trong thông báo để xem lý do, rồi sửa trong **Cài đặt → Kết nối Claude** |
| “Khoá Claude không đúng hoặc đã bị thu hồi” | Dán thiếu ký tự, hoặc khoá đã bị xoá trên Console | Tạo khoá mới và dán lại |
| “…đã chạm giới hạn chi tiêu tháng” | Chạm mức giới hạn đã đặt ở mục 2 | Nâng giới hạn trên Console hoặc đợi sang tháng |
| “…đã hết tiền nạp hoặc hết tín dụng của kỳ này” | Số dư của khoá đã về 0 | Gói Max/Ultra: đợi kỳ tín dụng sau (hoặc nạp thêm). Trả theo lượt: nạp thêm |
| “Chưa lưu được…” hoặc “App cần tải lại để lưu tiếp…” | Trình duyệt tạm mất kết nối với kho dữ liệu (hay gặp trên iPhone khi app nằm nền lâu) | Bấm **Tải lại**, hoặc đóng hẳn app rồi mở lại; nhiều khi app tự tải lại. Dữ liệu đã lưu vẫn còn |
| “Chưa mở được máy ảnh…” (Android) | Trình duyệt chưa được cấp quyền Máy ảnh | Cài đặt điện thoại → Ứng dụng → Chrome (hoặc trình duyệt đang dùng) → Quyền → Máy ảnh. Trong lúc chờ, dùng **Chọn ảnh có sẵn** |
| “App vừa có bản mới” | Đã có bản cập nhật | Bấm **Tải lại** khi tiện |

Mất mạng lúc đang tính thì app tự thử lại; bữa ăn vẫn nằm trong nhật ký.

## 8. Cập nhật app

Sửa file xong, tăng số `VERSION` ở đầu `sw.js` (và `APP_VERSION` trong `js/views/settings.js`), rồi trong thư mục
này chạy `git add -A`, `git commit -m "…"` và `git push`. Khoảng một phút sau GitHub Pages có bản mới; lần mở app
kế tiếp, máy tự tải về. Quên tăng `VERSION` thì máy đã cài vẫn giữ bản cũ. Muốn lên bản mới của thư viện Claude
thì xem `vendor/README.md`.

## Chạy thử và kiểm thử trên máy tính

```
node tests/serve.mjs             # mở app ở http://localhost:8790
node tests/serve.mjs --lan       # cho điện thoại cùng Wi-Fi xem thử (chỉ xem giao diện, chưa cài được)
node --test                      # kiểm thử phần tính toán
node tests/check-shell.mjs       # kiểm tra danh sách file lưu sẵn để chạy offline
node tests/make-seed.mjs > _preview/seed.json   # tạo dữ liệu mẫu 6 tuần để nhập thử (tạo thư mục _preview trước)
```

Thư mục `_preview/` chỉ để chứa file thử như trên. File `.gitignore` đã loại nó khỏi kho; nếu đưa app lên mạng
bằng cách chép tay cả thư mục thì xoá `_preview/` trước.

## Cần biết

- Số calo từ ảnh là **ước tính**, có thể lệch 20–30%. Chụp từ trên xuống, đủ sáng, thấy cả chén dĩa sẽ chính
  xác hơn.
- Ảnh bữa ăn (và lời mô tả món) được gửi tới Anthropic để phân tích. Ngoài việc đó app không gọi tới máy chủ
  nào khác: phông chữ, hình vẽ và mọi dữ liệu còn lại đều nằm trong app và trên máy.
- App dành cho người từ 18 tuổi. App không đặt mức ăn dưới 1.200 kcal (nữ) hay 1.500 kcal (nam), không nhận
  cân mong muốn có BMI dưới 18,5, và không khen những ngày ăn quá ít. Nếu đang mang thai, cho con bú hoặc có
  bệnh cần ăn theo chỉ dẫn, hãy hỏi bác sĩ trước. App không thay cho lời khuyên của bác sĩ.
- `vendor/anthropic-sdk.js` là bộ SDK chính thức `@anthropic-ai/sdk` 1.6.0 đóng gói bằng esbuild; phông chữ
  Nunito, Quicksand và Patrick Hand theo giấy phép SIL OFL 1.1. Giấy phép kèm trong `vendor/` và `fonts/`.
