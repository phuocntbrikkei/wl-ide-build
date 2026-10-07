/********************************************************************************
 * Rikkei Ide — hiển thị chế độ học/thi trên thanh trạng thái + báo khi đổi chế độ.
 *
 *   Giờ thi · Thi giữa kỳ IT108 · còn 42:10   (đếm ngược từng giây)
 *   Giờ học · Nhập môn Python · còn 35 phút
 *   Ngoài giờ học
 *   Chưa kết nối Rikkei LMS Connect
 *
 * Tài khoản đăng nhập IDE khác tài khoản đang mở LMS Connect -> cảnh báo (máy dùng
 * chung / người khác làm hộ).
 ********************************************************************************/

import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { StatusBar, StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar';
import { MessageService } from '@theia/core/lib/common/message-service';
import { RikkeiAuthService } from '../auth/rikkei-auth-service';
import { ClassroomState, RikkeiClassroomService } from './rikkei-classroom-service';

const STATUS_ID = 'rikkei-classroom-mode';

function pad(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

/** "còn 42:10" cho giờ thi (đếm từng giây), "còn 35 phút" cho giờ học. */
export function remainingText(endsAt: string | undefined, exact: boolean, now = Date.now()): string {
    if (!endsAt) {
        return '';
    }
    const end = Date.parse(endsAt);
    if (Number.isNaN(end)) {
        return '';
    }
    const ms = end - now;
    if (ms <= 0) {
        return 'đã hết giờ';
    }
    const s = Math.floor(ms / 1000);
    if (exact) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h > 0 ? `còn ${h}:${pad(m)}:${pad(s % 60)}` : `còn ${pad(m)}:${pad(s % 60)}`;
    }
    const min = Math.ceil(s / 60);
    return min >= 60 ? `còn ${Math.floor(min / 60)} giờ ${min % 60} phút` : `còn ${min} phút`;
}

@injectable()
export class RikkeiClassroomContribution implements FrontendApplicationContribution {

    @inject(RikkeiClassroomService)
    protected readonly classroom: RikkeiClassroomService;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    @inject(MessageService)
    protected readonly messages: MessageService;

    @inject(RikkeiAuthService)
    protected readonly auth: RikkeiAuthService;

    protected mismatchWarnedFor = 0;

    onStart(): void {
        this.classroom.onDidChange(({ prev, next }) => {
            this.render();
            this.announce(prev, next);
            this.checkIdentity(next);
        });
        this.classroom.start();
        this.render();
        // Đếm ngược giờ thi từng giây (chỉ vẽ lại nhãn, không gọi Client).
        setInterval(() => {
            if (this.classroom.current.mode === 'exam' && this.classroom.current.status?.endsAt) {
                this.render();
            }
        }, 1000);
    }

    protected render(): void {
        const { mode, status } = this.classroom.current;
        const parts: string[] = [];
        let tooltip = '';
        let color: string | undefined;
        switch (mode) {
            case 'exam':
                parts.push(status?.label || 'Giờ thi');
                parts.push(remainingText(status?.endsAt, true));
                tooltip = 'Đang trong giờ thi. Trang web chỉ mở được theo danh sách của phòng thi (trong trình duyệt của Rikkei LMS Connect).';
                color = 'var(--theia-editorWarning-foreground)';
                break;
            case 'learning':
                parts.push(status?.label || 'Giờ học');
                parts.push(remainingText(status?.endsAt, false));
                tooltip = 'Đang trong giờ học theo thời khóa biểu. Trang web chỉ mở được theo danh sách của lớp.';
                break;
            case 'free':
                parts.push('Ngoài giờ học');
                tooltip = 'Ngoài giờ học: mở được mọi trang web trong trình duyệt của Rikkei LMS Connect.';
                break;
            default:
                parts.push('Chưa kết nối Rikkei LMS Connect');
                tooltip = 'Mở Rikkei LMS Connect để IDE biết lịch học, giờ thi và để mở được trang web.';
                color = 'var(--theia-descriptionForeground)';
        }
        if (this.identityMismatch(status?.studentRkId)) {
            parts.push('Tài khoản IDE khác LMS Connect');
            color = 'var(--theia-errorForeground)';
        }
        void this.statusBar.setElement(STATUS_ID, {
            text: parts.filter(Boolean).join(' · '),
            alignment: StatusBarAlignment.LEFT,
            priority: 200,
            tooltip,
            color,
        });
    }

    protected announce(prev: ClassroomState, next: ClassroomState): void {
        if (prev.mode === next.mode && prev.status?.examRoomId === next.status?.examRoomId) {
            return;
        }
        if (prev.mode === 'offline' && next.mode === 'free') {
            return; // vừa mở LMS Connect, ngoài giờ: không cần báo
        }
        switch (next.mode) {
            case 'exam':
                this.messages.warn(`Đã vào ${next.status?.label || 'giờ thi'}. Trang web chỉ mở được theo danh sách của phòng thi; mọi thao tác code được ghi lại.`);
                break;
            case 'learning':
                this.messages.info(`Đã vào ${next.status?.label || 'giờ học'}. Trang web chỉ mở được theo danh sách của lớp.`);
                break;
            case 'free':
                this.messages.info(prev.mode === 'exam' ? 'Đã hết giờ thi.' : 'Đã hết giờ học.');
                break;
        }
    }

    protected identityMismatch(clientRk: number | undefined): boolean {
        const ideRk = this.auth.getStudentRkId();
        return !!ideRk && !!clientRk && ideRk !== clientRk;
    }

    protected checkIdentity(next: ClassroomState): void {
        const clientRk = next.status?.studentRkId;
        if (!this.identityMismatch(clientRk) || this.mismatchWarnedFor === clientRk) {
            return;
        }
        this.mismatchWarnedFor = clientRk || 0;
        const ide = this.auth.getSession();
        this.messages.warn(
            `Rikkei Ide đang đăng nhập ${ide?.fullName || ''} (${ide?.studentCode || ide?.studentRkId}) nhưng Rikkei LMS Connect là ${next.status?.studentName || ''} (${next.status?.studentCode || clientRk}). Hãy đăng nhập IDE bằng đúng tài khoản của bạn.`
        );
    }
}
