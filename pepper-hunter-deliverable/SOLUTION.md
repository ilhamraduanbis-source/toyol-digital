<!-- Ban thao do Gemini lam qua Pepper Hunter Doer - CHUA NOP, can duyet truoc khi gui. -->

Chào bạn, dưới đây là file `SOLUTION.md` được phân tích và tổng hợp từ nội dung issue của kéo (PR/Issue) được cung cấp, tuân thủ đúng vai trò kỹ sư phần mềm và các giới hạn về dữ liệu.

```markdown
# SOLUTION.md

## 1. Tóm tắt yêu cầu & Tiêu chí nghiệm thu (trích từ Issue)

### Tóm tắt yêu cầu
- Xây dựng và duy trì danh sách radar theo dõi các **tugasan berbayar terbuka** (nhiệm vụ trả phí mở) mà AI agent có thể thử giải quyết, tập trung vào việc tìm kiếm, đánh giá, thử nghiệm, kiểm thử, nộp bài, nhận thanh toán và quy đổi về MYR (Ringgit Malaysia).
- **Quy tắc cốt lõi**: Không sử dụng tiền túi của chủ sở hữu, không đặt cọc (deposit), không stake, không mua nhiệm vụ. Vốn vận hành thực tế ban đầu bằng 0 cho đến khi có bằng chứng nhận thanh toán thực tế.
- Tích hợp dữ liệu từ các Source API: 
  - Jobbi (642 tasks đã kiểm tra)
  - Taskmarket open (4 tasks đã kiểm tra)
  - BasedAgents tasks (15 tasks đã kiểm tra)
- Liệt kê và theo dõi danh sách các nhiệm vụ cần điều tra/thử nghiệm (ví dụ: chia sẻ job hàng ngày lên Twitter, Dashboard tài chính đa tài khoản, Jira Service Management Connector, các tác vụ hội nghị, v.v.).

### Tiêu chí nghiệm thu (Acceptance Criteria)
- Chỉ hiển thị và đề xuất các công việc/nhiệm vụ công khai mà người tham gia (AI agent) có quyền truy cập và thử sức hợp lệ.
- Phải xác minh được trạng thái thanh toán và khả năng quy đổi tiền mặt tại Malaysia trước khi báo cáo lợi nhuận (`REAL MONEY RECEIVED: RM0` cho đến khi hoàn tất thanh toán thực tế).
- Các nguồn issue từ GitHub hoặc Taskmarket phải được kiểm tra (loại trừ các issue đóng nếu có, đánh giá assignee, mức độ cạnh tranh và khả năng thanh toán).

---

## 2. Cách tiếp cận kỹ thuật từng bước
1. **Đọc và Phân tích Nguồn Dữ liệu (Source API Integration):**
   - Kết nối và chuẩn hóa dữ liệu đầu vào từ các API nguồn: Jobbi, Taskmarket, và BasedAgents.
   - Xây dựng bộ lọc để kiểm tra trạng thái nhiệm vụ (ví dụ: `OPEN_AT_SOURCE`, `POTENTIAL_FIELD_TASK`, `ESCROW_TX_LISTED`).
2. **Xử lý Cảnh báo & Rủi ro (Warnings & Verification):**
   - Đánh giá các cảnh báo từ hệ thống như `MANY_EXISTING_DISCUSSIONS`, `NO_RECENT_ACTIVITY_90D`, hoặc `ALREADY_ASSIGNED` để tránh lãng phí tài nguyên của AI agent vào các task đã có người nhận hoặc không còn khả thi.
3. **Quản lý Trạng thái Tài chính & Tiền tệ:**
   - Đảm bảo cơ chế ghi nhận doanh thu thực tế tuân thủ nghiêm ngặt quy tắc không dùng vốn chủ sở hữu (`REAL MONEY RECEIVED: RM0` mặc định).
   - Theo dõi luồng tiền từ các hình thức thanh toán (Stripe, On-chain) và quy đổi sang MYR.
4. **Cập nhật Báo cáo Radar:**
   - Duy trì định dạng Markdown chuẩn cho file theo dõi nhiệm vụ, cập nhật các danh sách task cần điều tra (ví dụ: các task từ Jobbi/Algora, Taskmarket).

---

## 3. File / Đường dẫn dự kiến sửa
*(Lưu ý: Do cấu trúc repository đầy đủ không được cung cấp chi tiết trong issue, các đường dẫn dưới đây là dự kiến dựa trên nội dung issue)*
- `README.md` hoặc `tasks.md` (hoặc file chứa nội dung chính của issue `# Toyol Paid Tasks` hiển thị danh sách radar và trạng thái `REAL MONEY RECEIVED`).
- Các module tích hợp API nguồn (dự kiến nằm trong thư mục source code kết nối với Jobbi, Taskmarket, BasedAgents - *chưa rõ cấu trúc chi tiết trong repo*).

---

## 4. Kế hoạch tự test (Self-Test Plan)
- **Kiểm tra dữ liệu API nguồn:** Xác thực các script/module kết nối API Jobbi, Taskmarket, BasedAgents trả về đúng định dạng và số lượng task đã kiểm tra (ví dụ: 642 tasks Jobbi, 4 tasks Taskmarket, 15 tasks BasedAgents).
- **Kiểm tra quy tắc bảo mật tài chính:** Đảm bảo không có dòng code hay logic nào thực hiện việc nạp tiền, đặt cọc (deposit), hay sử dụng ví tiền cá nhân/chủ sở hữu.
- **Kiểm tra trạng thái hiển thị:** Xác nhận biến `REAL MONEY RECEIVED` luôn khởi điểm ở mức `RM0` và các cảnh báo task (warnings) được hiển thị chính xác theo dữ liệu trích xuất từ nguồn.
```
