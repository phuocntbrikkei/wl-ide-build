/********************************************************************************
 * Rikkei Ide — dịch vụ đăng nhập (frontend), theo cơ chế client SC.
 *
 * Đăng nhập: mở trang LMS Portal (do electron-main lo) -> bắt token -> đổi danh
 * tính qua SERVER SC (/api/student/resolve). IDE CHỈ nói chuyện với SC, không gọi
 * LMS trực tiếp. Sau khi đăng nhập, mở socket SC kênh RIÊNG cho IDE (role=ide) —
 * là NỀN cho tính năng tương lai, không đụng phòng thi/giám sát lớp.
 ********************************************************************************/

import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { RikkeiIdeAuthMain, RikkeiIdeSession } from '../../common/rikkei-ide-auth';

export const RIKKEI_SC_BASE_URL_PREF = 'rikkeiIde.sc.baseUrl';
const SESSION_STORAGE_KEY = 'rikkei-ide.auth.session';

@injectable()
export class RikkeiAuthService {

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(StorageService)
    protected readonly storage: StorageService;

    // Chỉ có ở bản desktop (electron). Bản browser sẽ không có -> tắt bắt buộc login.
    @inject(RikkeiIdeAuthMain) @optional()
    protected readonly authMain?: RikkeiIdeAuthMain;

    protected session: RikkeiIdeSession | undefined;
    protected initialized = false;
    protected socket: WebSocket | undefined;
    // Mặc định AN TOÀN: bắt buộc đăng nhập cho tới khi SC nói khác. Nếu không lấy
    // được cấu hình -> giữ nguyên = không nới lỏng.
    protected loginRequired = true;

    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }
        await this.loadIdeConfig();
        // Bản desktop: nguồn chân lý là tiến trình chính (bền qua reload/đổi folder).
        // Bản browser (không có authMain): rơi về StorageService.
        if (this.authMain) {
            try {
                this.session = await this.authMain.loadSession();
            } catch {
                this.session = undefined;
            }
        } else {
            this.session = await this.storage.getData<RikkeiIdeSession>(SESSION_STORAGE_KEY);
        }
        this.initialized = true;
        if (this.session?.studentRkId) {
            this.connectSocket();
        }
    }

    isAuthenticated(): boolean {
        return !!this.session?.studentRkId;
    }

    /** Bật gate khi CÓ máy chủ SC + chạy được đăng nhập (bản desktop). */
    isConfigured(): boolean {
        return this.scBaseUrl().length > 0 && !!this.authMain;
    }

    /** SC có yêu cầu bắt buộc đăng nhập không (tab IDE trong cấu hình giám sát). */
    isLoginRequired(): boolean {
        return this.loginRequired;
    }

    /**
     * Kéo cấu hình IDE TOÀN CỤC từ SC: có bắt buộc đăng nhập hay không. (Trang web
     * được mở thế nào do trình duyệt của Rikkei LMS Connect quyết định, không còn ở IDE.)
     * Endpoint công khai (không cần token) nên gọi được cả trước khi đăng nhập.
     * Lỗi/không cấu hình SC -> giữ mặc định an toàn (khóa + bắt buộc đăng nhập).
     */
    protected async loadIdeConfig(): Promise<void> {
        const base = this.scBaseUrl();
        if (!base) {
            return;
        }
        try {
            const res = await fetch(`${base}/api/ide/config`, { headers: { Accept: 'application/json' } });
            if (!res.ok) {
                return;
            }
            const body = await res.json() as { config?: { requireLogin?: boolean } };
            const cfg = body.config || {};
            if (typeof cfg.requireLogin === 'boolean') {
                this.loginRequired = cfg.requireLogin;
            }
        } catch {
            // giữ mặc định an toàn
        }
    }

    getSession(): RikkeiIdeSession | undefined {
        return this.session;
    }

    getStudentRkId(): number | undefined {
        return this.session?.studentRkId;
    }

    /** URL server SC (dùng cho theo dõi hoạt động code, socket…). */
    getScBaseUrl(): string {
        return this.scBaseUrl();
    }

    protected scBaseUrl(): string {
        return (this.preferences.get<string>(RIKKEI_SC_BASE_URL_PREF) ?? '').trim().replace(/\/+$/, '');
    }

    /** Mở trang login của SC -> SC đăng nhập LMS local -> danh tính. Ném lỗi nếu huỷ. */
    async login(): Promise<RikkeiIdeSession> {
        if (!this.authMain) {
            throw new Error('Đăng nhập chỉ hỗ trợ trên bản desktop.');
        }
        const scBaseUrl = this.scBaseUrl();
        if (!scBaseUrl) {
            throw new Error('Chưa cấu hình máy chủ SC (rikkeiIde.sc.baseUrl).');
        }
        const session = await this.authMain.loginViaPortal({ scBaseUrl });
        if (!session) {
            throw new Error('Đăng nhập bị huỷ hoặc không lấy được danh tính.');
        }
        // electron-main đã tự lưu phiên trong loginViaPortal; vẫn ghi StorageService
        // để bản browser dùng lại được.
        this.session = session;
        await this.storage.setData(SESSION_STORAGE_KEY, session);
        this.connectSocket();
        return session;
    }

    async logout(): Promise<void> {
        this.session = undefined;
        if (this.authMain) {
            try { await this.authMain.clearSession(); } catch { /* ignore */ }
        }
        await this.storage.setData(SESSION_STORAGE_KEY, undefined);
        this.disconnectSocket();
    }

    // Kênh socket SC RIÊNG cho IDE (role=ide). Hiện chỉ giữ kết nối làm nền; chưa
    // gửi/nhận nghiệp vụ gì và KHÔNG liên quan phòng thi/giám sát lớp.
    protected connectSocket(): void {
        const base = this.scBaseUrl();
        const rk = this.session?.studentRkId;
        if (!base || !rk) {
            return;
        }
        this.disconnectSocket();
        try {
            const wsBase = base.replace(/^http/i, 'ws');
            const ws = new WebSocket(`${wsBase}/ws?role=ide&studentId=${rk}`);
            ws.onclose = () => { if (this.socket === ws) { this.socket = undefined; } };
            ws.onerror = () => { /* nền: bỏ qua, sẽ kết nối lại lần mở app sau */ };
            this.socket = ws;
        } catch {
            // bỏ qua — không chặn IDE nếu socket lỗi
        }
    }

    protected disconnectSocket(): void {
        if (this.socket) {
            try { this.socket.close(); } catch { /* ignore */ }
            this.socket = undefined;
        }
    }
}
