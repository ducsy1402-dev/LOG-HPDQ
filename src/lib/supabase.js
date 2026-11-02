// Một kết nối Supabase dùng chung cho cả web (phần Thiết bị cơ giới và phần Cảng / kho bãi), chung phiên đăng nhập.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config";

let sb = null;
export const supabase = () => (sb ||= createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
