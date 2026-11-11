import { useEffect, useState } from "react";
import { ShieldCheck, Info } from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHead, Empty } from "@/components/common";
import { VAI_TRO } from "@/config";
import { matchQ } from "@/lib/format";

const PH = [["cang", "Khai thác Cảng"], ["kho", "Khai thác kho bãi"]];
const CHON = [["xem", "Xem"], ["nhap", "Nhập liệu"], ["quan_ly", "Quản lý (thấy tiền)"], ["quan_tri", "Quản trị"]];

// Cấp vai trò theo từng phân hệ (bảng user_module_roles). Vai trò web Thiết bị cơ giới vẫn quản lý ở web cũ (user_roles).
export default function PhanQuyen() {
  const { api, fail, run } = useApp();
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [q, setQ] = useState("");
  const tai = () => Promise.all([api.listUsers(), api.listModuleRoles()]).then(([u, r]) => { setUsers(u); setRoles(r); }).catch(fail);
  useEffect(() => { tai(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const vaiTro = (uid, ph) => roles.find((r) => r.user_id === uid && r.phan_he === ph)?.vai_tro || "";
  const doi = async (u, ph, vt) => { if (await run(() => api.setModuleRole(u.user_id, ph, vt || null), `Đã cấp quyền ${PH.find((p) => p[0] === ph)[1]} cho ${u.email}`)) tai(); };

  return (
    <>
      <PageHead title="Phân quyền theo phân hệ" desc="Mỗi tài khoản có vai trò riêng ở từng phân hệ. Quản trị web Thiết bị cơ giới là quản trị mọi phân hệ." />
      <div className="mb-3 grid gap-1 rounded-md border border-info/40 bg-info/5 px-3 py-2 text-sm">
        <div className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-info" /><span><b>Xem</b>: chỉ đọc. <b>Nhập liệu</b>: thêm, sửa chuyến tàu, mốc giờ, nhật ký, khoảng dừng (nhân viên hiện trường / kế hoạch). <b>Quản lý</b>: thêm quyền xóa chuyến, khoảng dừng, giao dịch kho. <b>Quản trị</b>: thêm danh mục bến / cẩu và phân quyền.</span></div>
        <div className="pl-6 text-xs text-muted-foreground">Để trống = mặc định: ai có tài khoản web Thiết bị cơ giới được Xem (không thấy tiền). Tài khoản mới tạo trong Supabase › Authentication như web cũ.</div>
      </div>
      <Card>
        <CardContent className="pt-4">
          <Input className="mb-3 w-64" placeholder="Tìm email, họ tên…" value={q} onChange={(e) => setQ(e.target.value)} />
          {users == null ? <div className="text-sm text-muted-foreground">Đang tải…</div> : users.length ? (
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>Tài khoản</th><th>Web Thiết bị cơ giới</th>{PH.map(([k, t]) => <th key={k}>{t}</th>)}</tr></thead>
                <tbody>{users.filter((u) => matchQ(q, u.email, u.ho_ten)).map((u) => (
                  <tr key={u.user_id}>
                    <td><div className="font-medium">{u.ho_ten || "—"}</div><div className="text-[0.6875rem] text-muted-foreground">{u.email}</div></td>
                    <td>{u.vai_tro_cu ? <Badge tone={u.vai_tro_cu === "quan_tri" ? "primary" : "default"}>{VAI_TRO[u.vai_tro_cu] || u.vai_tro_cu}</Badge> : <span className="text-xs text-muted-foreground">Chưa cấp</span>}</td>
                    {PH.map(([k]) => (
                      <td key={k}>
                        {u.vai_tro_cu === "quan_tri" ? <Badge tone="primary"><ShieldCheck className="h-3 w-3" />Quản trị (tự động)</Badge>
                          : <NativeSelect className="h-8 w-48" value={vaiTro(u.user_id, k)} onChange={(e) => doi(u, k, e.target.value)}
                              placeholder={u.vai_tro_cu ? "Mặc định: Xem" : "Không có quyền"} options={CHON} />}
                      </td>))}
                  </tr>))}</tbody>
              </table>
            </div>
          ) : <Empty>Chưa có tài khoản.</Empty>}
        </CardContent>
      </Card>
    </>
  );
}
