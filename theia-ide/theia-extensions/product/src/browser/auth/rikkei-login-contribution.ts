/********************************************************************************
 * Rikkei Ide — chặn dùng IDE khi chưa đăng nhập + hiển thị SV đã đăng nhập +
 * lệnh/nút đăng xuất. Login là nền cho tính năng tương lai (chưa gắn thi/giám sát).
 ********************************************************************************/

import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { StatusBar, StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar';
import { ConfirmDialog } from '@theia/core/lib/browser/dialogs';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { RikkeiAuthService } from './rikkei-auth-service';
import { RikkeiLoginDialog } from './rikkei-login-dialog';

export const RIKKEI_LOGOUT_COMMAND: Command = {
    id: 'rikkei.auth.logout',
    label: 'Rikkei Ide: Đăng xuất',
};

const STATUS_BAR_ID = 'rikkei-account';

@injectable()
export class RikkeiLoginContribution implements FrontendApplicationContribution, CommandContribution {

    @inject(RikkeiAuthService)
    protected readonly auth: RikkeiAuthService;

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    // Nạp phiên đã lưu ở onStart — KHÔNG mở hộp thoại ở đây (Theia chờ onStart xong
    // mới hiện cửa sổ, block onStart -> kẹt ở splash).
    async onStart(): Promise<void> {
        await this.preferences.ready;
        await this.auth.init();
    }

    // Mở login SAU khi layout dựng xong. QUAN TRỌNG: KHÔNG await ở đây — Theia CHỜ
    // onDidInitializeLayout xong mới sang 'ready'; nếu await dialog thì kẹt mãi ở
    // 'initialized_layout' (shell chưa hiện). Fire-and-forget + cập nhật status bar sau.
    onDidInitializeLayout(): void {
        this.updateStatusBar();
        // Chỉ bắt buộc đăng nhập khi SC cấu hình requireLogin (tab IDE). Có thể tắt
        // cho máy dùng chung. Vẫn cho đăng nhập thủ công qua lệnh khi tắt gate.
        if (this.auth.isConfigured() && this.auth.isLoginRequired() && !this.auth.isAuthenticated()) {
            void new RikkeiLoginDialog(this.auth).open().then(() => this.updateStatusBar());
        }
    }

    // Mục ở góc phải status bar: hiện tên SV, bấm để đăng xuất.
    protected updateStatusBar(): void {
        const s = this.auth.getSession();
        if (s && s.studentRkId) {
            const label = s.fullName || s.studentCode || 'Đã đăng nhập';
            this.statusBar.setElement(STATUS_BAR_ID, {
                text: `$(account) ${label}`,
                alignment: StatusBarAlignment.RIGHT,
                priority: 1000,
                tooltip: `Đăng nhập: ${s.fullName || ''} (${s.studentCode || ''})\nBấm để đăng xuất`,
                command: RIKKEI_LOGOUT_COMMAND.id,
            });
        } else {
            this.statusBar.removeElement(STATUS_BAR_ID);
        }
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(RIKKEI_LOGOUT_COMMAND, {
            execute: async () => {
                const s = this.auth.getSession();
                const who = s ? (s.fullName || s.studentCode || '') : '';
                const ok = await new ConfirmDialog({
                    title: 'Đăng xuất',
                    msg: who ? `Đăng xuất khỏi Rikkei Ide (${who})?` : 'Đăng xuất khỏi Rikkei Ide?',
                    ok: 'Đăng xuất',
                    cancel: 'Huỷ',
                }).open();
                if (!ok) {
                    return;
                }
                await this.auth.logout();
                this.updateStatusBar();
                // Tải lại để quay về màn đăng nhập bắt buộc.
                window.location.reload();
            },
        });
    }
}
