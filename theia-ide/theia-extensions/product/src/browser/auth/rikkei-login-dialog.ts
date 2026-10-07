/********************************************************************************
 * Rikkei Ide — hộp thoại đăng nhập. Bấm "Đăng nhập bằng Rikkei Portal" sẽ mở
 * cửa sổ đăng nhập LMS (do electron-main lo) rồi đổi danh tính qua SC.
 * Có "Bỏ qua" để không khoá người dùng khi SC/LMS lỗi.
 ********************************************************************************/

import { AbstractDialog } from '@theia/core/lib/browser/dialogs';
import { RikkeiAuthService } from './rikkei-auth-service';
import { RikkeiIdeSession } from '../../common/rikkei-ide-auth';

export class RikkeiLoginDialog extends AbstractDialog<RikkeiIdeSession> {

    protected readonly statusNode: HTMLElement;
    protected busy = false;
    protected session: RikkeiIdeSession | undefined;

    constructor(protected readonly auth: RikkeiAuthService) {
        super({ title: 'Đăng nhập Rikkei Ide' });

        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '10px';
        wrap.style.minWidth = '320px';

        const intro = document.createElement('div');
        intro.textContent = 'Đăng nhập bằng tài khoản Rikkei Portal để sử dụng Rikkei Ide.';
        intro.style.fontSize = '12.5px';
        intro.style.opacity = '0.85';
        wrap.appendChild(intro);

        this.statusNode = document.createElement('div');
        this.statusNode.style.fontSize = '12px';
        this.statusNode.style.minHeight = '16px';
        this.statusNode.style.color = 'var(--theia-descriptionForeground)';
        wrap.appendChild(this.statusNode);

        this.contentNode.appendChild(wrap);

        // Bắt buộc đăng nhập: KHÔNG có nút huỷ, ẩn nút đóng (X), chặn Esc.
        if (this.closeCrossNode) {
            this.closeCrossNode.style.display = 'none';
        }
        this.appendAcceptButton('Đăng nhập bằng Rikkei Portal');
    }

    get value(): RikkeiIdeSession {
        return this.session!;
    }

    // Chặn Esc để không đóng được hộp thoại (bắt buộc đăng nhập).
    protected override handleEscape(): boolean {
        return false;
    }

    protected override async accept(): Promise<void> {
        if (this.busy) {
            return;
        }
        this.setBusy(true);
        this.setStatus('Đang mở trang đăng nhập…');
        try {
            this.session = await this.auth.login();
        } catch (err) {
            this.setBusy(false);
            this.setStatus(err instanceof Error ? err.message : 'Đăng nhập thất bại.', true);
            return;
        }
        this.setBusy(false);
        if (this.resolve) {
            this.resolve(this.session);
        }
        this.close();
    }

    protected setBusy(busy: boolean): void {
        this.busy = busy;
        if (this.acceptButton) {
            this.acceptButton.disabled = busy;
        }
    }

    protected setStatus(text: string, error = false): void {
        this.statusNode.textContent = text;
        this.statusNode.style.color = error ? 'var(--theia-errorForeground)' : 'var(--theia-descriptionForeground)';
    }
}
