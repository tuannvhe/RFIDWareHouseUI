import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Printer,
  PackagePlus,
  PackageMinus,
  ScanSearch,
  ShieldAlert,
  Users,
} from "lucide-react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useNotify } from "./context/NotificationContext";
import { useLanguage } from "./context/LanguageContext";
import type { TranslationKey } from "./i18n/translations";
import AlarmSoundBanner from "./components/AlarmSoundBanner";
import LanguageSwitcher from "./components/LanguageSwitcher";
import LoadingOverlay from "./components/LoadingOverlay";
import Modal from "./components/Modal";
import ToastStack from "./components/ToastStack";
import DashboardPage from "./pages/DashboardPage";
import GpoTestPage from "./pages/GpoTestPage";
import InboundPage from "./pages/InboundPage";
import LoginPage from "./pages/LoginPage";
import OutboundPage from "./pages/OutboundPage";
import NextLotPage from "./pages/NextLotPage";
import OverrideLogPage from "./pages/OverrideLogPage";
import PrintLogPage from "./pages/PrintLogPage";
import TracePage from "./pages/TracePage";
import UserManagementPage from "./pages/UserManagementPage";
import logo1 from "./assets/logo1.png";
import "./App.css";

const SIDEBAR_COLLAPSED_KEY = "rfid.sidebarCollapsed";

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/inbound", labelKey: "nav.inbound", icon: PackagePlus },
  { to: "/outbound", labelKey: "nav.outbound", icon: PackageMinus },
  { to: "/next-lot", labelKey: "nav.nextLot", icon: ListOrdered },
  { to: "/trace", labelKey: "nav.trace", icon: ScanSearch },
  { to: "/printlog", labelKey: "nav.printlog", icon: Printer },
  { to: "/override-log", labelKey: "nav.overrideLog", icon: ShieldAlert },
];

const ADMIN_NAV_ITEM: { to: string; labelKey: TranslationKey; icon: typeof Users } = {
  to: "/users",
  labelKey: "nav.users",
  icon: Users,
};

const LOCALE_MAP: Record<string, string> = { vi: "vi-VN", en: "en-US", ko: "ko-KR" };

function PageTitle() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const current = [...NAV_ITEMS, ADMIN_NAV_ITEM].find((item) => pathname.startsWith(item.to));
  const Icon = current?.icon;
  return (
    <div className="topbar-title">
      {Icon && (
        <span className="topbar-icon">
          <Icon size={20} strokeWidth={2.2} />
        </span>
      )}
      <div>
        <span className="topbar-eyebrow">{t("topbar.eyebrow")}</span>
        <h1>{current ? t(current.labelKey) : t("nav.dashboard")}</h1>
      </div>
    </div>
  );
}

// Dong ho song nho trong topbar - chi de trang tri, giup thanh topbar bot don dieu,
// khong gan voi bat ky logic nghiep vu nao.
function TopbarClock() {
  const { language } = useLanguage();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const locale = LOCALE_MAP[language];

  return (
    <div className="topbar-clock">
      <span className="topbar-clock-time">{now.toLocaleTimeString(locale)}</span>
      <span className="topbar-clock-date">{now.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
    </div>
  );
}

// Thanh loading mong, mo phong hieu ung NProgress - chi mang tinh cam giac chuyen trang,
// khong gan voi trang thai fetch that cua tung trang (moi trang da tu quan ly loading rieng).
function RouteProgressBar() {
  const { pathname } = useLocation();
  const [active, setActive] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 450);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <div className={`route-progress ${active ? "active" : ""}`} />;
}

function CurrentUserBox({ collapsed }: { collapsed: boolean }) {
  const { username, logout } = useAuth();
  const notify = useNotify();
  const { t } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleConfirmLogout() {
    const name = username;
    setLoggingOut(true);
    await logout();
    notify("success", t("sidebar.loggedOut.title"), name ? `${t("sidebar.loggedOut.body")}, ${name}` : undefined);
    // Khong can setLoggingOut(false)/dong modal - isAuthenticated=false se lam AppShell
    // (va ca modal nay) unmount ngay, dieu huong sang /login.
  }

  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <div className={`user-box ${collapsed ? "collapsed" : ""}`}>
      <div className="user-box-icon" title={collapsed ? username ?? undefined : undefined}>
        {initial}
      </div>
      {!collapsed && (
        <div className="user-box-fields">
          <label>{t("sidebar.currentUser")}</label>
          <strong className="user-box-name">{username}</strong>
        </div>
      )}
      <button
        type="button"
        className="user-box-logout"
        onClick={() => setConfirmOpen(true)}
        title={collapsed ? `${t("sidebar.logout")} (${username})` : t("sidebar.logout")}
      >
        <LogOut size={15} />
      </button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("sidebar.logout")}
        footer={
          <>
            <button type="button" className="modal-btn" onClick={() => setConfirmOpen(false)} disabled={loggingOut}>
              {t("common.cancel")}
            </button>
            <button type="button" className="modal-btn modal-btn-danger" onClick={handleConfirmLogout} disabled={loggingOut}>
              <LogOut size={14} /> {loggingOut ? t("sidebar.loggingOut") : t("sidebar.logout")}
            </button>
          </>
        }
      >
        {t("sidebar.logoutConfirm")} <strong>{username}</strong>?
      </Modal>

      {loggingOut && <LoadingOverlay text={t("sidebar.loggingOut")} />}
    </div>
  );
}

function AppShell() {
  const { roles } = useAuth();
  const { t } = useLanguage();
  const isAdmin = roles.includes("Admin");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <img src={logo1} alt="RFID Kho" />
          </span>
          {!collapsed && (
            <div className="brand-text">
              <strong>{t("sidebar.brand")}</strong>
              <span>Vinatech</span>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")} title={collapsed ? t(labelKey) : undefined}>
              <Icon size={18} strokeWidth={2.2} />
              {!collapsed && <span>{t(labelKey)}</span>}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to={ADMIN_NAV_ITEM.to}
              className={({ isActive }) => (isActive ? "active" : "")}
              title={collapsed ? t(ADMIN_NAV_ITEM.labelKey) : undefined}
            >
              <ADMIN_NAV_ITEM.icon size={18} strokeWidth={2.2} />
              {!collapsed && <span>{t(ADMIN_NAV_ITEM.labelKey)}</span>}
            </NavLink>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>{t("sidebar.collapse")}</span>}
          </button>

          {!collapsed && (
            <div className="sidebar-lang">
              <LanguageSwitcher compact />
            </div>
          )}

          <CurrentUserBox collapsed={collapsed} />
          {!collapsed && (
            <div className="sidebar-footer">
              <span className="status-dot" />
              {t("sidebar.connected")}
            </div>
          )}
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <PageTitle />
          <TopbarClock />
        </header>
        <RouteProgressBar />

        <main>
          <AlarmSoundBanner />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/inbound" element={<InboundPage />} />
            <Route path="/outbound" element={<OutboundPage />} />
            <Route path="/next-lot" element={<NextLotPage />} />
            <Route path="/trace" element={<TracePage />} />
            <Route path="/printlog" element={<PrintLogPage />} />
            <Route path="/override-log" element={<OverrideLogPage />} />
            <Route
              path="/gpo-test"
              element={isAdmin ? <GpoTestPage /> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="/users"
              element={isAdmin ? <UserManagementPage /> : <Navigate to="/dashboard" replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {/* Dat o day (khong phai trong AppShell) de ToastStack khong bi unmount khi logout dieu huong sang /login,
          nham dam bao toast "Da dang xuat" van kip hien thi. */}
      <ToastStack />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;
