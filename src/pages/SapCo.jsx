import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MO_TA = {
  "kho/thanh-pham": ["Quản lý kho thành phẩm", "Sơ đồ bãi và tỷ lệ lấp đầy, tồn theo quy cách và lô, nhập từ sản xuất, xuất theo đơn hàng hoặc chuyến tàu. Tồn luôn tính từ sổ nhập – xuất."],
  "kho/nguyen-lieu": ["Quản lý kho nguyên liệu", "Nhập từ chuyến tàu (biết bãi nhận từ phương án làm hàng), xuất cấp sản xuất, số ngày cấp còn lại, kiểm kê định kỳ, cảnh báo bãi đầy / tồn thấp."],
};

export default function SapCo({ muc }) {
  const [ten, mt] = MO_TA[muc.id] || [muc.ten, ""];
  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <CardContent className="grid justify-items-center gap-3 py-10 text-center">
        <Construction className="h-10 w-10 text-warn" />
        <h1 className="text-lg font-semibold">{ten}</h1>
        <p className="text-sm text-muted-foreground">{mt}</p>
        <p className="text-xs text-muted-foreground">Làm ở <b>{muc.sau}</b>, sau khi anh duyệt Đợt 1 (Khai thác Cảng).</p>
      </CardContent>
    </Card>
  );
}
