import { useAuth } from "./AuthContext";

// "Nguoi thuc hien" gio lay thang tu username da dang nhap (AuthContext) - khong con nhap tay nua.
export function useCurrentUser() {
  const { username } = useAuth();
  return { userID: username ?? "" };
}
