# vendor/ — bộ SDK chính thức của Anthropic, đóng thành một file

`anthropic-sdk.js` là thư viện `@anthropic-ai/sdk` bản **1.6.0**, đóng gói bằng esbuild 0.28.2 để chạy thẳng trong
trình duyệt (app không có bước build). App chỉ nạp file này khi cần nhờ Claude phân tích một bữa ăn (`js/ai.js`).
Giấy phép của SDK và các thư viện con nằm ở `anthropic-sdk.LICENSES.txt`.

## Đóng gói lại (khi muốn lên bản SDK mới)

Làm trong một thư mục tạm bất kỳ, không phải trong thư mục app:

```
npm init -y
npm install @anthropic-ai/sdk@<bản mới> esbuild
```

Tạo file `entry.mjs`:

```js
import Anthropic from "@anthropic-ai/sdk";
export default Anthropic;
```

Rồi chạy:

```
npx esbuild entry.mjs --bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=none --outfile=anthropic-sdk.js
```

Chép `anthropic-sdk.js` vừa tạo đè lên file trong thư mục này (nên thêm lại dòng chú thích đầu file ghi tên và phiên bản SDK,
như file hiện tại), sau đó **bắt buộc** chạy hai lệnh sau trong thư mục app:

```
node tests/patch-sdk.mjs vendor/anthropic-sdk.js
node tests/check-shell.mjs
```

- Lệnh đầu sửa một biểu thức chính quy mà iPhone Safari trước 16.4 không đọc được. Thiếu bước này, iPhone đời cũ
  sẽ không tính được calo.
- Lệnh sau kiểm tra lại (nó báo lỗi nếu trong gói còn cú pháp đó) và đối chiếu danh sách file lưu sẵn của app.

Cuối cùng tăng `VERSION` trong `sw.js` (và `APP_VERSION` trong `js/views/settings.js`) để máy đã cài nhận bản mới,
và cập nhật lại `anthropic-sdk.LICENSES.txt` nếu danh sách thư viện con thay đổi.
