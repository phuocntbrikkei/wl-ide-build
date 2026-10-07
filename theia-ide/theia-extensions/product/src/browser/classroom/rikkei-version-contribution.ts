/********************************************************************************
 * Rikkei Ide — kiểm tra phiên bản tối thiểu với SC.
 *
 * Hỏi GET {sc}/api/public/app-version?app=ide lúc mở IDE và mỗi 30 phút. Dưới bản
 * tối thiểu quản trị đặt (lms-admin -> Ứng dụng học tập) thì phủ một lớp chặn lên
 * toàn IDE, chỉ còn nút tải bản mới và kiểm tra lại. Có bản mới hơn (không bắt buộc)
 * thì nhắc một lần. Mất mạng / chưa cấu hình SC thì không chặn.
 ********************************************************************************/

import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { MessageService } from '@theia/core/lib/common/message-service';
import { RikkeiIdeAuthMain } from '../../common/rikkei-ide-auth';
import { RikkeiAuthService } from '../auth/rikkei-auth-service';

const CHECK_MS = 30 * 60 * 1000;
const OVERLAY_ID = 'rikkei-version-gate';

interface VersionCheck {
    current: string;
    min: string;
    latest: string;
    required: boolean;
    outdated: boolean;
    downloadUrl: string;
    message: string;
}

@injectable()
export class RikkeiVersionContribution implements FrontendApplicationContribution {

    @inject(RikkeiAuthService)
    protected readonly auth: RikkeiAuthService;

    @inject(MessageService)
    protected readonly messages: MessageService;

    @inject(RikkeiIdeAuthMain) @optional()
    protected readonly authMain?: RikkeiIdeAuthMain;

    protected info: { version: string; platform: string } | undefined;
    protected notifiedLatest = '';

    onStart(): void {
        if (!this.authMain) {
            return;
        }
        void this.firstCheck();
        setInterval(() => void this.check(), CHECK_MS);
    }

    /** Lần đầu: chờ dịch vụ đăng nhập nạp cấu hình SC; chưa có địa chỉ SC thì thử lại mỗi phút. */
    protected async firstCheck(attempt = 0): Promise<void> {
        await this.auth.init().catch(() => undefined);
        if (!this.auth.getScBaseUrl() && attempt < 30) {
            setTimeout(() => void this.firstCheck(attempt + 1), 60 * 1000);
            return;
        }
        await this.check();
    }

    protected absolute(url: string): string {
        if (url.startsWith('/')) {
            return this.auth.getScBaseUrl().replace(/\/+$/, '') + url;
        }
        return url;
    }

    protected async check(): Promise<void> {
        const base = this.auth.getScBaseUrl().replace(/\/+$/, '');
        if (!base || !this.authMain) {
            return;
        }
        try {
            this.info = this.info || await this.authMain.getAppInfo();
            const q = new URLSearchParams({ app: 'ide', version: this.info.version, platform: this.info.platform });
            const res = await fetch(`${base}/api/public/app-version?${q.toString()}`, { headers: { Accept: 'application/json' } });
            if (!res.ok) {
                return;
            }
            const chk = await res.json() as VersionCheck;
            chk.downloadUrl = chk.downloadUrl ? this.absolute(chk.downloadUrl) : '';
            if (chk.required) {
                this.showGate(chk);
                return;
            }
            this.hideGate();
            if (chk.outdated && chk.latest && this.notifiedLatest !== chk.latest) {
                this.notifiedLatest = chk.latest;
                const action = chk.downloadUrl ? 'Tải bản mới' : undefined;
                const pick = action
                    ? await this.messages.info(`Đã có Rikkei Ide bản ${chk.latest} (đang dùng ${this.info.version}).`, action)
                    : await this.messages.info(`Đã có Rikkei Ide bản ${chk.latest} (đang dùng ${this.info.version}). Tải ở mục "Ứng dụng học tập" trên LMS.`);
                if (pick === action && chk.downloadUrl) {
                    void this.authMain.openDownload(chk.downloadUrl);
                }
            }
        } catch {
            // mất mạng: không chặn oan
        }
    }

    protected hideGate(): void {
        document.getElementById(OVERLAY_ID)?.remove();
    }

    /** Lớp phủ chặn toàn IDE (không đóng được), chỉ còn tải bản mới / kiểm tra lại. */
    protected showGate(chk: VersionCheck): void {
        this.hideGate();
        const el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.setAttribute('role', 'alertdialog');
        el.setAttribute('aria-modal', 'true');
        el.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;'
            + 'background:rgba(15,23,42,.72);font-family:var(--theia-ui-font-family);';
        const card = document.createElement('div');
        card.style.cssText = 'max-width:460px;margin:16px;padding:24px 26px;border-radius:12px;'
            + 'background:var(--theia-editor-background);color:var(--theia-foreground);box-shadow:0 20px 60px rgba(0,0,0,.4);';
        const h = document.createElement('h2');
        h.textContent = 'Cần cập nhật Rikkei Ide';
        h.style.cssText = 'margin:0 0 10px;font-size:18px;';
        const p1 = document.createElement('p');
        p1.textContent = `Bản đang dùng (${chk.current || this.info?.version || '?'}) đã cũ. Nhà trường yêu cầu bản ${chk.min} trở lên để tiếp tục học và thi.`;
        const p2 = document.createElement('p');
        p2.textContent = chk.downloadUrl
            ? 'Tải bản mới, cài đè lên bản cũ rồi mở lại Rikkei Ide. Bài đang làm vẫn nằm nguyên trong thư mục của bạn.'
            : 'Vào mục "Ứng dụng học tập" trên LMS để tải bản mới. Bài đang làm vẫn nằm nguyên trong thư mục của bạn.';
        for (const p of [p1, p2]) {
            p.style.cssText = 'margin:0 0 10px;font-size:13px;line-height:1.55;opacity:.9;';
        }
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;margin-top:16px;';
        const mkBtn = (label: string, primary: boolean, onClick: () => void) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.className = primary ? 'theia-button main' : 'theia-button secondary';
            b.onclick = onClick;
            row.appendChild(b);
        };
        if (chk.downloadUrl) {
            mkBtn('Tải bản mới', true, () => void this.authMain?.openDownload(chk.downloadUrl));
        }
        mkBtn('Kiểm tra lại', !chk.downloadUrl, () => void this.check());
        card.append(h, p1, p2, row);
        el.appendChild(card);
        document.body.appendChild(el);
    }
}
