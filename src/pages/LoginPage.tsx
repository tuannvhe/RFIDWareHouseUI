import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Lock, LogIn, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import LoadingOverlay from "../components/LoadingOverlay";
import logo1 from "../assets/logo1.png";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const notify = useNotify();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await login(username, password);
    if (!res.success) {
      setLoading(false);
      setError(res.errorMessage ?? t("login.failed"));
    } else {
      notify("success", t("login.success.title"), `${t("login.success.body")} ${username}`);
      // Khong tat loading o day - de nguyen man hinh khoa cho toi khi Navigate chuyen trang,
      // tranh nguoi dung thay form dang nhap "song" lai trong khoanh khac truoc khi redirect.
    }
  }

  return (
    <div className="login-page">
      <div className="login-page-grid" />
      {loading && <LoadingOverlay text={t("login.submitting")} />}
      <div className="login-card">
        <div className="login-lang">
          <LanguageSwitcher />
        </div>

        <div className="login-brand">
          <span className="brand-mark">
            <img src={logo1} alt="RFID Kho" />
          </span>
          <div className="brand-text">
            <strong>{t("sidebar.brand")}</strong>
            <span>Vinatech</span>
          </div>
        </div>

        <h1>{t("login.title")}</h1>
        <p className="login-sub">{t("login.subtitle")}</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="username">{t("login.username")}</label>
            <div className="input-wrap">
              <span className="field-icon">
                <UserIcon size={16} />
              </span>
              <input
                id="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">{t("login.password")}</label>
            <div className="input-wrap">
              <span className="field-icon">
                <Lock size={16} />
              </span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            <LogIn size={16} /> {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
