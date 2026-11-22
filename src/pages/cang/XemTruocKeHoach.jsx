import { useMemo } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import XemTruocPdf from "@/components/XemTruocPdf";
import { CANG, blobPdfKeHoachCang, tenFilePdfKeHoachCang, xuatExcelKeHoachCang } from "@/lib/keHoachCang";

// Xem trước PDF Kế hoạch điều động tàu cập / rời cảng (Linetime › Kế hoạch ngày tới, anh Sỹ 22/11/2026): thay cho việc bấm là tải thẳng file về.
// Đổi cảng thì dựng lại; Tải PDF / In / Mở tab mới / Excel ở cùng hộp (khung xem trước dùng chung ở components/XemTruocPdf.jsx).
const TAT_CA = (du) => [...CANG.map((c) => [c.ma, `${c.ten} (${du.theoCang[c.ma].roi.length + du.theoCang[c.ma].cap.length + du.theoCang[c.ma].shifting.length})`]), ["tat_ca", "Cả 3 cảng"]];
export default function XemTruocKeHoach({ du, cang, setCang, logo, tuDen, onClose, fail }) {
  const chon = cang === "tat_ca" ? CANG : CANG.filter((c) => c.ma === cang);
  const soDong = chon.reduce((s, c) => s + du.theoCang[c.ma].roi.length + du.theoCang[c.ma].cap.length + du.theoCang[c.ma].shifting.length, 0);
  const dau = useMemo(() => JSON.stringify([du.tu, du.theoCang]), [du]); // du được tính lại mỗi lần trang vẽ nên so theo nội dung
  return (
    <XemTruocPdf tieuDe="Xem trước kế hoạch điều động tàu cập / rời cảng" moTa={`Khổ A4 dọc · ${tuDen} · ${soDong} dòng`}
      tabs={TAT_CA(du)} tab={cang} setTab={setCang} dau={dau} lay={(t) => blobPdfKeHoachCang(du, t, logo)} tenFile={(t) => tenFilePdfKeHoachCang(du, t)}
      ghiChu={du.chuaXep > 0 ? `${du.chuaXep} tàu chưa xếp bến nên chưa vào phiếu` : null} onClose={onClose}
      them={<Button variant="outline" onClick={() => xuatExcelKeHoachCang(du, cang, logo).catch(fail)}><FileSpreadsheet />Tải Excel</Button>} />
  );
}
