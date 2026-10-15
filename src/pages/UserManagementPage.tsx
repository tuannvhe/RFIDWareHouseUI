import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock, Plus, RotateCw, Trash2, Unlock } from "lucide-react";
import {
  createUser,
  deleteUser,
  getUsers,
  lockUser,
  resetUserPassword,
  unlockUser,
  type UserListItem,
} from "../api/client";
import Modal from "../components/Modal";
import LoadingOverlay from "../components/LoadingOverlay";
import { useNotify } from "../context/NotificationContext";
import { useLanguage } from "../context/LanguageContext";

export default function UserManagementPage() {
  const notify = useNotify();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState<UserListItem | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      notify("error", t("common.loadError.title"), err instanceof Error ? err.message : t("common.loadError.body"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await createUser({
      username: newUsername,
      email: newEmail || undefined,
      password: newPassword,
      isAdmin: newIsAdmin,
    });
    setCreating(false);
    if (res.errors?.length) {
      notify("error", t("users.create.fail.default"), res.errors.join(", "));
      return;
    }
    notify("success", t("users.create.success.title"), newUsername);
    setNewIsAdmin(false);
    setNewUsername("");
    setNewEmail("");
    setNewPassword("");
    setShowCreate(false);
    load();
  }

  async function handleToggleLock(user: UserListItem) {
    setBusyId(user.id);
    try {
      if (user.isLockedOut) {
        await unlockUser(user.id);
        notify("success", t("users.unlock.success.title"), user.userName);
      } else {
        await lockUser(user.id);
        notify("success", t("users.lock.success.title"), user.userName);
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget || !resetPassword.trim()) return;
    const user = resetTarget;
    setResetting(true);
    try {
      const res = await resetUserPassword(user.id, resetPassword);
      if (res.errors?.length) {
        notify("error", t("users.resetPw.fail.default"), res.errors.join(", "));
      } else {
        notify("success", t("users.resetPw.success.title"), user.userName);
        setResetTarget(null);
        setResetPassword("");
      }
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete(user: UserListItem) {
    if (!window.confirm(`${t("users.delete.confirm")} "${user.userName}"? ${t("users.delete.confirmSuffix")}`)) return;
    setBusyId(user.id);
    try {
      await deleteUser(user.id);
      notify("success", t("users.delete.success.title"), user.userName);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page page-wide">
      <div className="table-toolbar">
        <button type="button" className="ghost-btn" onClick={load} disabled={loading}>
          <RotateCw size={15} className={loading ? "spin-icon" : ""} /> {t("users.refresh")}
        </button>
        <button type="button" className="submit-btn" style={{ marginLeft: "auto", width: "auto" }} onClick={() => setShowCreate(true)}>
          <Plus size={16} /> {t("users.createBtn")}
        </button>
      </div>

      <Modal
        open={showCreate}
        onClose={() => {
          if (!creating) setShowCreate(false);
        }}
        title={t("users.create.title")}
        size="md"
        footer={
          <>
            <button type="button" className="modal-btn" onClick={() => setShowCreate(false)} disabled={creating}>
              {t("common.cancel")}
            </button>
            <button type="submit" form="create-user-form" className="modal-btn modal-btn-primary" disabled={creating}>
              {creating ? t("users.creating") : t("users.create.submit")}
            </button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreate} className="modal-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="newUsername">{t("users.create.username")}</label>
              <div className="input-wrap">
                <input id="newUsername" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="newEmail">{t("users.create.email")}</label>
              <div className="input-wrap">
                <input id="newEmail" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="newPassword">{t("users.create.password")}</label>
            <div className="input-wrap">
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <label className="checkbox-field">
            <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
            {t("users.create.adminCheckbox")}
          </label>
        </form>
      </Modal>

      <Modal
        open={resetTarget !== null}
        onClose={() => {
          if (resetting) return;
          setResetTarget(null);
          setResetPassword("");
        }}
        title={t("users.resetPw.title")}
        footer={
          <>
            <button
              type="button"
              className="modal-btn"
              onClick={() => {
                setResetTarget(null);
                setResetPassword("");
              }}
              disabled={resetting}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              form="reset-password-form"
              className="modal-btn modal-btn-primary"
              disabled={resetting || !resetPassword.trim()}
            >
              {resetting ? t("users.resettingShort") : t("users.resetPw.submit")}
            </button>
          </>
        }
      >
        <form id="reset-password-form" onSubmit={confirmResetPassword} className="modal-form">
          <p className="modal-note-plain">
            {t("users.resetPw.note")} <strong>{resetTarget?.userName}</strong>.
          </p>
          <div className="field">
            <label htmlFor="resetPassword">{t("users.resetPw.newPassword")}</label>
            <div className="input-wrap">
              <input
                id="resetPassword"
                type="password"
                autoFocus
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
              />
            </div>
          </div>
        </form>
      </Modal>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>{t("users.col.account")}</th>
              <th>{t("users.col.email")}</th>
              <th>{t("users.col.roles")}</th>
              <th>{t("users.col.status")}</th>
              <th className="actions-col">{t("users.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.userName}</td>
                <td>{u.email ?? "—"}</td>
                <td>{u.roles.join(", ") || "—"}</td>
                <td>
                  <span className={`status-pill ${u.isLockedOut ? "fail" : "ok"}`}>
                    {u.isLockedOut ? t("users.status.locked") : t("users.status.active")}
                  </span>
                </td>
                <td className="row-actions">
                  <div className="row-actions-inner">
                    <button type="button" onClick={() => handleToggleLock(u)} disabled={busyId === u.id}>
                      {busyId === u.id ? (
                        <Loader2 size={13} className="spin-icon" />
                      ) : u.isLockedOut ? (
                        <Unlock size={13} />
                      ) : (
                        <Lock size={13} />
                      )}
                      {u.isLockedOut ? t("users.action.unlock") : t("users.action.lock")}
                    </button>
                    <button type="button" onClick={() => setResetTarget(u)} disabled={busyId === u.id}>
                      {t("users.action.resetPassword")}
                    </button>
                    <button type="button" onClick={() => handleDelete(u)} disabled={busyId === u.id}>
                      {busyId === u.id ? <Loader2 size={13} className="spin-icon" /> : <Trash2 size={13} />} {t("users.action.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  {t("users.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && <LoadingOverlay text={t("users.create.submitting")} />}
      {resetting && <LoadingOverlay text={t("users.resetPw.submitting")} />}
      {busyId !== null && <LoadingOverlay text={t("common.processing")} />}
    </div>
  );
}
