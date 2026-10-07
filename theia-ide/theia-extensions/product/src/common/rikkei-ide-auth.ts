/********************************************************************************
 * Rikkei Ide — hợp đồng đăng nhập giữa electron-main và frontend.
 *
 * IDE mở TRANG LOGIN do SC phục vụ ({sc}/login) — trang tự gọi wrap
 * /api/student/login (SC đăng nhập LMS qua kênh INTERNAL local, không reCAPTCHA,
 * rồi trả danh tính). IDE KHÔNG gọi LMS trực tiếp. Đăng nhập xong trang chuyển
 * sang {sc}/login/done?studentRkId=... để electron-main bắt danh tính.
 ********************************************************************************/

export const RIKKEI_IDE_AUTH_PATH = '/services/rikkei-ide-auth';

export interface RikkeiIdeSession {
    studentRkId: number;
    fullName: string;
    studentCode: string;
    email?: string;
    loggedInAt: number;
}

/** Trạng thái Rikkei LMS Connect báo cho IDE (GET 127.0.0.1:34115/ide/status). */
export interface LmsConnectStatus {
    loggedIn: boolean;
    studentRkId: number;
    studentCode: string;
    studentName: string;
    mode: 'free' | 'learning' | 'exam';
    label: string;
    classRkId: number;
    classCode: string;
    courseName: string;
    examRoomId?: number;
    examName?: string;
    /** RFC3339 — hết giờ thi / hết ca học (nếu biết). */
    endsAt?: string;
}

export const RikkeiIdeAuthMain = Symbol('RikkeiIdeAuthMain');
export interface RikkeiIdeAuthMain {
    /**
     * Mở cửa sổ trang đăng nhập của SC, chờ tới {sc}/login/done và lấy danh tính.
     * Trả về phiên khi thành công; undefined nếu người dùng đóng cửa sổ / huỷ.
     * Khi thành công TỰ LƯU phiên ở tiến trình chính (bền qua reload/đổi folder).
     */
    loginViaPortal(opts: { scBaseUrl: string }): Promise<RikkeiIdeSession | undefined>;

    /**
     * Đọc phiên đã lưu ở tiến trình chính. Nguồn chân lý của phiên là ĐÂY, không
     * phải localStorage của renderer: renderer bị nạp lại mỗi lần mở/đổi folder,
     * còn tiến trình chính sống suốt vòng đời app -> giữ đăng nhập ổn định.
     */
    loadSession(): Promise<RikkeiIdeSession | undefined>;

    /** Xoá phiên đã lưu (đăng xuất). */
    clearSession(): Promise<void>;

    /**
     * Mở một trang web trong trình duyệt của Rikkei LMS Connect (IDE không có trình
     * duyệt riêng). Trả false nếu LMS Connect không chạy trên máy.
     */
    openInLmsConnect(url: string): Promise<boolean>;

    /** Hỏi Rikkei LMS Connect đang ngoài giờ / giờ học / giờ thi. undefined = LMS Connect không chạy. */
    getLmsConnectStatus(): Promise<LmsConnectStatus | undefined>;

    /** Phiên bản Rikkei Ide (package.json của app) + nền tảng tải: windows | mac-arm | mac-intel | linux. */
    getAppInfo(): Promise<{ version: string; platform: string }>;

    /** Mở link tải bản mới bằng trình duyệt hệ thống (chỉ http/https). */
    openDownload(url: string): Promise<void>;
}
