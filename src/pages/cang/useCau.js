import { useMemo } from "react";
import { useThietBi } from "@/thietbi/Host";

// Các cẩu trong danh mục thiết bị cơ giới (đội "Cẩu") dạng dùng cho tính phương án (năng suất tấn/giờ)
export function useCau() {
  const tbD = useThietBi()?.D;
  return useMemo(() => (tbD?.vehicles || []).filter((x) => x.doi === "Cẩu").map((x) => ({ ...x, loai: x.model, nang_suat_th: x.nang_suat })), [tbD]);
}
