import { describe, it, expect } from "vitest";
import { chuanHoaMeta, laBDDK, LOAI_BDDK, LOAI_CBM, PIC_BAO_TRI } from "../thietbi/lib/compute";

// Loại sự kiện + PIC (anh Sỹ 24/11/2026): BD định kỳ tách thành 2 loại theo giờ máy, thêm Bảo trì CBM và PIC "Tổ bảo trì bảo dưỡng"
const metaCu = { loai: ["Hỏng", "BD định kỳ", "BD chiến lược"], loaiDung: ["Hỏng", "BD chiến lược"], pic: ["Tổ Cơ khí", "Tổ Điện", "Tổ Thủy lực", "Thầu ngoài"] };

describe("Chuẩn hóa danh mục loại sự kiện / PIC", () => {
  it("BD định kỳ thành hai loại (2000H, 5000H), thêm Bảo trì CBM, thứ tự: Hỏng, BDĐK, CBM, BD chiến lược", () => {
    expect(chuanHoaMeta(metaCu).loai).toEqual(["Hỏng", "Bảo dưỡng định kỳ (2000H)", "Bảo dưỡng định kỳ (5000H)", "Bảo trì CBM", "BD chiến lược"]);
  });
  it("danh sách rỗng / chưa có thì dùng mặc định đã chuẩn hóa", () => {
    expect(chuanHoaMeta({}).loai).toEqual(["Hỏng", ...LOAI_BDDK, LOAI_CBM, "BD chiến lược"]);
  });
  it("chạy lại nhiều lần không thêm trùng", () => {
    const m = chuanHoaMeta(chuanHoaMeta(metaCu));
    expect(m.loai).toHaveLength(5);
    expect(m.pic.filter((x) => x === PIC_BAO_TRI)).toHaveLength(1);
  });
  it("PIC thêm Tổ bảo trì bảo dưỡng ở cuối, giữ nguyên các PIC cũ", () => {
    expect(chuanHoaMeta(metaCu).pic).toEqual([...metaCu.pic, "Tổ bảo trì bảo dưỡng"]);
  });
  it("Bảo trì CBM nằm trong loaiDung (xe không sẵn sàng); Bảo dưỡng định kỳ thì không", () => {
    const d = chuanHoaMeta(metaCu).loaiDung;
    expect(d).toContain("Bảo trì CBM");
    expect(d).not.toContain("Bảo dưỡng định kỳ (2000H)");
  });
  it("laBDDK nhận cả giá trị cũ và hai giá trị mới", () => {
    expect(["BD định kỳ", ...LOAI_BDDK].every(laBDDK)).toBe(true);
    expect(["Hỏng", "BD chiến lược", "Bảo trì CBM"].some(laBDDK)).toBe(false);
  });
});
