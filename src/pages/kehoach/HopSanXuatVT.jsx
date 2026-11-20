import { FormPhanBoVT } from "../cang/HopPhanBoVT";
import { NV_SAN_XUAT } from "@/lib/sanLuongTT";
import { loaiKyCua } from "@/lib/keHoachTH";
import { PopupBenCanh } from "./PopupBenCanh";

// Hộp nhỏ khi bấm số Tổng của Kế hoạch sản xuất (anh Sỹ 20/11/2026): CHỈ còn Phân bổ vận tải (đã bỏ mục Nhập kho): chọn nghiệp vụ (Trung chuyển, Thu hồi, Cấp sản xuất, Chuyển bãi),
// chia Băng tải / Chạy xe (tick TN / HP, loại xe tùy chọn), bấm Phân bổ thì ghi vào Kế hoạch vận tải (hướng Phục vụ sản xuất) và chuyển sang mục đó.
export default function HopSanXuatVT({ neo, onDong, ky, hang, hangVT, tong, sua, onXong }) {
  return (
    <PopupBenCanh neo={neo} onDong={onDong} tieuDe={`Phân bổ vận tải · ${hang}`} phu="Chọn nghiệp vụ, chia Băng tải và Chạy xe, rồi chuyển sang Kế hoạch vận tải" rong={380}>
      <FormPhanBoVT tong={tong} hang={hang} hangVT={hangVT} nghiepVu={NV_SAN_XUAT} huongVT="phuc_vu_san_xuat" kyLoai={loaiKyCua(ky)} ky={ky} sua={sua} onXong={onXong} />
    </PopupBenCanh>
  );
}
