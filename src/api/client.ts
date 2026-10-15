import axios from "axios";
import { clearSession, getAccessToken, getRefreshToken, setTokens } from "../auth/tokenStorage";

// Doi lai URL nay khi deploy backend that (mac dinh khop voi Properties/launchSettings.json cua backend)
//export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://192.168.112.254:4998";
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5216";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Gan access token vao moi request (tru cac request khong can, van gan cung khong sao vi backend tu bo qua tren [AllowAnonymous]).
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
    if (data?.success && data?.accessToken && data?.refreshToken) {
      // Backend xoay vong refresh token - phai luu ca 2 token moi, khong chi accessToken,
      // neu khong lan refresh ke tiep se dung phai refresh token da bi vo hieu va bi dang xuat.
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    }
    return null;
  } catch {
    return null;
  }
}

// Khi access token het han (401), tu dong goi /api/auth/refresh 1 lan roi thu lai request cu.
// Neu refresh cung that bai -> xoa session va bao App biet de dieu huong ve /login.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes("/api/auth/");

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;

      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      clearSession();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }

    return Promise.reject(error);
  },
);

export interface InboundRequest {
  companyCode: string;
  workCenterCode: string;
  processUserID: string;
  rawMaterialBarcode: string;
  // true = da xac nhan van phat hanh them tem cho Lot da co tem.
  confirmDuplicate?: boolean;
}

export interface InboundResult {
  success: boolean;
  rfidSerialNo?: string;
  errorMessage?: string;
  errorCode?: "LotNotFound" | "LotAlreadyHasLabels";
  existingLabelCount?: number;
}

export interface OutboundRequest {
  gateCode: string;
  rfidSerialNo: string;
  processUserID: string;
}

export interface OutboundResult {
  success: boolean;
  resultCode?: string;
  resultMessage?: string;
  errorMessage?: string;
  canOverride: boolean;
}

export interface OverrideRequest {
  rfidSerialNo: string;
  overrideUserID: string;
  overrideReason: string;
}

export interface ReaderGate {
  gateCode: string;
  gateName?: string;
  gateType: string;
}

export async function createInboundLabel(request: InboundRequest): Promise<InboundResult> {
  try {
    const { data } = await apiClient.post<InboundResult>("/api/inbound", request);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      return err.response.data as InboundResult;
    }
    return { success: false, errorMessage: "Khong ket noi duoc toi server." };
  }
}

export async function checkOutboundShipment(request: OutboundRequest): Promise<OutboundResult> {
  try {
    const { data } = await apiClient.post<OutboundResult>("/api/outbound/check", request);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      return err.response.data as OutboundResult;
    }
    return { success: false, errorMessage: "Khong ket noi duoc toi server.", canOverride: false };
  }
}

export async function overrideShipment(request: OverrideRequest): Promise<{ message: string }> {
  const { data } = await apiClient.post("/api/outbound/override", request);
  return data;
}

export async function getActiveGates(): Promise<ReaderGate[]> {
  const { data } = await apiClient.get<ReaderGate[]>("/api/outbound/gates");
  return data;
}

// Kiem tra nhanh 1 ma tem RFID co ton tai trong he thong khong (khong lam thay doi trang thai gi ca) -
// dung khi quet them tem vao danh sach cho xuat, tranh cho nguoi dung mot tem sai/chua duoc phat hanh.
export async function labelExists(rfidSerialNo: string): Promise<boolean> {
  try {
    await apiClient.get(`/api/inbound/${encodeURIComponent(rfidSerialNo)}`);
    return true;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return false;
    }
    throw err;
  }
}

export interface StaleGateDetectionItem {
  gateCode: string;
  rfidSerialNo: string;
  lotID?: string;
  materialCode?: string;
  materialName?: string;
  labelStatus: string;
  lastReadDateTime: string;
}

export async function getStaleGateDetections(minutes = 30): Promise<StaleGateDetectionItem[]> {
  const { data } = await apiClient.get<StaleGateDetectionItem[]>("/api/outbound/stale-detections", {
    params: { minutes },
  });
  return data;
}

export interface ShipmentCheckItem {
  shipmentCheckSequence: number;
  gateCode: string;
  rfidSerialNo?: string;
  lotID?: string;
  materialCode?: string;
  materialName?: string;
  resultCode: string;
  expectedLotID?: string;
  resultMessage?: string;
  overrideYN: string;
  overrideUserID?: string;
  overrideReason?: string;
  overrideDateTime?: string;
  checkDateTime: string;
}

export async function getShipmentChecks(filter: {
  page: number;
  pageSize: number;
  gateCode?: string;
  search?: string;
  resultCode?: string;
  from?: string;
  to?: string;
  overrideOnly?: boolean;
}): Promise<PagedResult<ShipmentCheckItem>> {
  const { data } = await apiClient.get<PagedResult<ShipmentCheckItem>>("/api/outbound/checks", {
    params: {
      page: filter.page,
      pageSize: filter.pageSize,
      gateCode: filter.gateCode || undefined,
      search: filter.search || undefined,
      resultCode: filter.resultCode || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
      overrideOnly: filter.overrideOnly || undefined,
    },
  });
  return data;
}

export interface WorkCenterOption {
  workCenterCode: string;
  workCenterName?: string;
}

export async function getWorkCenters(): Promise<WorkCenterOption[]> {
  const { data } = await apiClient.get<WorkCenterOption[]>("/api/inbound/workcenters");
  return data;
}

export interface ParsedSerial {
  factoryCode?: string;
  materialWarehouseUniqueNumber?: string;
  yearNumber?: string;
  monthNumber?: number;
  dayNumber?: number;
  labelSerialNumber?: number;
}

export async function parseSerial(rfidSerialNo: string): Promise<ParsedSerial> {
  const { data } = await apiClient.get<ParsedSerial>(`/api/labels/${rfidSerialNo}/parse`);
  return data;
}

export async function getEpc(rfidSerialNo: string): Promise<{ rfidSerialNo: string; epc: string }> {
  const { data } = await apiClient.get(`/api/labels/${rfidSerialNo}/epc`);
  return data;
}

export interface VerifyLabelsRequest {
  requestID: string;
  processUserID: string;
  verifiedSerials: string[];
}

export async function verifyLabels(request: VerifyLabelsRequest): Promise<{ message: string }> {
  const { data } = await apiClient.post("/api/labels/verify", request);
  return data;
}

export interface PrintLogItem {
  printLogSequence: number;
  requestID: string;
  rfidSerialNo?: string;
  printerIP?: string;
  labelCount?: number;
  zplText?: string;
  httpStatus?: number;
  responseText?: string;
  errorMessage?: string;
  createUserID?: string;
  createDateTime: string;
  lotID?: string;
  materialName?: string;
}

export interface PrintLogFilter {
  page: number;
  pageSize: number;
  search?: string;
  status?: "success" | "error" | "";
  from?: string;
  to?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getPrintLogs(filter: PrintLogFilter): Promise<PagedResult<PrintLogItem>> {
  const { data } = await apiClient.get<PagedResult<PrintLogItem>>("/api/printlog", {
    params: {
      page: filter.page,
      pageSize: filter.pageSize,
      search: filter.search || undefined,
      status: filter.status || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
    },
  });
  return data;
}

export interface EnqueuePrintRequest {
  rfidSerialNo: string;
  printerIP: string;
  printerPort?: number;
  zplText: string;
}

export async function enqueuePrintRetry(request: EnqueuePrintRequest): Promise<{ message: string }> {
  const { data } = await apiClient.post("/api/printlog/retry", request);
  return data;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface DashboardSummary {
  totalIssued: number;
  totalShipped: number;
  totalFifoViolations: number;
  totalPrintErrors: number;
  totalOverrides: number;
  totalOutboundChecks: number;
  issuedByDay: DailyCount[];
  shippedByDay: DailyCount[];
  issuedByWorkCenter: NamedCount[];
  outboundResultBreakdown: NamedCount[];
  fifoViolationsByMonth: NamedCount[];
  overridesByMonth: NamedCount[];
  topFifoViolationMaterials: NamedCount[];
  topOverrideUsers: NamedCount[];
  labelStatusBreakdown: NamedCount[];
}

export async function getDashboardSummary(params: {
  from?: string;
  to?: string;
  workCenterCode?: string;
  year?: number;
}): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/api/dashboard/summary", { params });
  return data;
}

export interface AuthResult {
  success: boolean;
  errorMessage?: string;
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  roles: string[];
}

export async function login(username: string, password: string): Promise<AuthResult> {
  try {
    const { data } = await apiClient.post<AuthResult>("/api/auth/login", { username, password });
    return data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response) {
        // Co phan hoi tu server nhung khong dung dang AuthResult (vd 404 rong, 500...) - bao ro status.
        const data = err.response.data;
        if (data && typeof data === "object" && "errorMessage" in data) {
          return data as AuthResult;
        }
        return {
          success: false,
          errorMessage: `Server phản hồi lỗi ${err.response.status} - có thể backend chưa cập nhật endpoint đăng nhập (cần restart).`,
          roles: [],
        };
      }
      return { success: false, errorMessage: "Không kết nối được tới server (backend có đang chạy không?).", roles: [] };
    }
    return { success: false, errorMessage: "Không kết nối được tới server.", roles: [] };
  }
}

export async function logoutApi(): Promise<void> {
  try {
    // Gui kem refresh token cua chinh phien nay de backend chi xoa dung phien nay,
    // khong lam dang xuat cac tab/thiet bi khac dang dang nhap cung tai khoan.
    await apiClient.post("/api/auth/logout", { refreshToken: getRefreshToken() });
  } catch {
    // Bo qua loi khi logout - session se bi xoa o client du sao di nua.
  }
}

export interface UserListItem {
  id: string;
  userName?: string;
  email?: string;
  isLockedOut: boolean;
  roles: string[];
}

export async function getUsers(): Promise<UserListItem[]> {
  const { data } = await apiClient.get<UserListItem[]>("/api/usermanagement/users");
  return data;
}

export async function createUser(request: { username: string; email?: string; password: string; isAdmin?: boolean }): Promise<{ id?: string; message?: string; errors?: string[] }> {
  try {
    const { data } = await apiClient.post("/api/usermanagement/users", request);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      return err.response.data;
    }
    return { errors: ["Không kết nối được tới server."] };
  }
}

export async function lockUser(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/api/usermanagement/users/${id}/lock`);
  return data;
}

export async function unlockUser(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/api/usermanagement/users/${id}/unlock`);
  return data;
}

export async function resetUserPassword(id: string, newPassword: string): Promise<{ message?: string; errors?: string[] }> {
  try {
    const { data } = await apiClient.post(`/api/usermanagement/users/${id}/reset-password`, { newPassword });
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      return err.response.data;
    }
    return { errors: ["Không kết nối được tới server."] };
  }
}

export async function deleteUser(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.delete(`/api/usermanagement/users/${id}`);
  return data;
}

export async function getReaderStatus(): Promise<{ connected: boolean }> {
  const { data } = await apiClient.get<{ connected: boolean }>("/api/reader/status");
  return data;
}

export async function setGpo(port: number, on: boolean): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    await apiClient.post("/api/reader/gpo", { port, on });
    return { success: true };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      return { success: false, errorMessage: err.response.data.errorMessage };
    }
    return { success: false, errorMessage: "Không kết nối được tới server." };
  }
}

export async function pulseGpo(port: number, seconds: number): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    await apiClient.post("/api/reader/gpo/pulse", { port, seconds });
    return { success: true };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      return { success: false, errorMessage: err.response.data.errorMessage };
    }
    return { success: false, errorMessage: "Không kết nối được tới server." };
  }
}

// ---- Tra cuu truy vet theo tem / Lot ----
export interface TraceLotInfo {
  lotID: string;
  materialCode?: string;
  materialName?: string;
  warehouseCode?: string;
  locationCode?: string;
  grDate?: string;
  currentQty?: number;
}

export interface TraceLabelItem {
  rfidSerialNo: string;
  labelStatus: string;
  lotID?: string;
  createDateTime: string;
  createUserID?: string;
  updateDateTime?: string;
  updateUserID?: string;
  voidReason?: string;
}

export interface TraceEventItem {
  eventType: "Created" | "Print" | "Read" | "Check" | "Override" | "Void";
  rfidSerialNo: string;
  eventDateTime: string;
  gateCode?: string;
  resultCode?: string;
  detail?: string;
  userID?: string;
}

export interface TraceResult {
  type: "label" | "lot" | "multiple" | "none";
  lot?: TraceLotInfo;
  labels: TraceLabelItem[];
  events: TraceEventItem[];
  candidates: string[];
}

export async function traceLookup(query: string): Promise<TraceResult> {
  const { data } = await apiClient.get<TraceResult>("/api/trace", { params: { query } });
  return data;
}

// ---- Lot can xuat tiep theo (hang doi FIFO) ----
export interface NextLotItem {
  lotID: string;
  grDate?: string;
  labelCount: number;
  currentQty?: number;
  locationCode?: string;
  isOldest: boolean;
  withinTolerance: boolean;
}

export interface NextLotGroup {
  materialCode: string;
  materialName?: string;
  warehouseCode: string;
  lots: NextLotItem[];
}

export interface NextLotsResult {
  toleranceDays: number;
  groups: NextLotGroup[];
}

export async function getNextLots(search?: string): Promise<NextLotsResult> {
  const { data } = await apiClient.get<NextLotsResult>("/api/trace/next-lots", { params: { search } });
  return data;
}
