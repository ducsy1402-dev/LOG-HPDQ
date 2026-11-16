import { describe, it, expect } from "vitest";
import { tachBang } from "./paste";

// Excel bao ô có xuống dòng (Alt+Enter) hoặc có dấu " trong ngoặc kép khi chép: không được tách ô đó thành dòng mới
describe("tachBang: ô Excel có xuống dòng", () => {
  it("ô nhiều dòng trong ngoặc kép vẫn là một ô, nối bằng ;", () => {
    const b = tachBang('11\tSTAR VESTA\t"Kho 2 - DQ2\nKho 3"\tMáy rải liệu\t17/11/2026\n11\tGREAT TANG\tA\tB\t24/11/2026');
    expect(b.length).toBe(2);
    expect(b[0]).toEqual(["11", "STAR VESTA", "Kho 2 - DQ2; Kho 3", "Máy rải liệu", "17/11/2026"]);
    expect(b[1].length).toBe(5);
  });
  it("ô xuống dòng ở cuối (dòng cuối trống) không sinh dòng thừa", () => {
    const b = tachBang('11\tNEW\t"Kho 2 - DQ2\n"\tXúc đào\n11\tOLD\tA\tB');
    expect(b).toEqual([["11", "NEW", "Kho 2 - DQ2", "Xúc đào"], ["11", "OLD", "A", "B"]]);
  });
  it('dấu "" trong ô là một dấu "', () => { expect(tachBang('a\t"ống 6"" thép"\tb')).toEqual([["a", 'ống 6" thép', "b"]]); });
  it("ngoặc kép không khép kín thì đọc nguyên văn, không nuốt cả bảng", () => {
    const b = tachBang('a\t"abc\tb\nc\td\te');
    expect(b.length).toBe(2);
    expect(b[1]).toEqual(["c", "d", "e"]);
  });
  it("bảng thường, ô trống, dòng trống vẫn như cũ", () => {
    expect(tachBang("a\t\tc\n\n\t\t\nd\te\tf\r\n")).toEqual([["a", "", "c"], ["d", "e", "f"]]);
    expect(tachBang("a  b  c")).toEqual([["a", "b", "c"]]);
    expect(tachBang("a | b | c")).toEqual([["a", "b", "c"]]);
  });
});
