/********************************************************************************
 * Rikkei Ide — link web mở bằng trình duyệt của Rikkei LMS Connect.
 *
 * IDE không có trình duyệt riêng. Mọi link http(s) (bấm trong terminal, markdown,
 * Live Server "Go Live", vscode.env.openExternal…) được gửi sang trình duyệt của
 * Rikkei LMS Connect — nơi áp chính sách giờ học / giờ thi do SC cấu hình.
 * LMS Connect không chạy: trang localhost (Live Server, dev server) vẫn mở bằng
 * trình duyệt hệ thống để sinh viên tự học ở nhà; trang ngoài thì báo cần mở LMS Connect.
 ********************************************************************************/

import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { MessageService } from '@theia/core/lib/common/message-service';
import { ExternalAppOpenHandler } from '@theia/core/lib/electron-browser/window/external-app-open-handler';
import { RikkeiIdeAuthMain } from '../common/rikkei-ide-auth';

function isLoopbackHost(hostname: string): boolean {
    const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
    return h === 'localhost' || h === '::1' || h === '0.0.0.0' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

@injectable()
export class LmsConnectOpenHandler extends ExternalAppOpenHandler {

    @inject(MessageService)
    protected readonly messages: MessageService;

    @inject(RikkeiIdeAuthMain)
    protected readonly authMain: RikkeiIdeAuthMain;

    override async open(uri: URI): Promise<undefined> {
        if (uri.scheme !== 'http' && uri.scheme !== 'https') {
            return super.open(uri);
        }
        const url = uri.toString(true);
        if (await this.authMain.openInLmsConnect(url).catch(() => false)) {
            return undefined;
        }
        let local = false;
        try {
            local = isLoopbackHost(new URL(url).hostname);
        } catch {
            local = false;
        }
        if (local) {
            return super.open(uri);
        }
        this.messages.warn(`Hãy mở Rikkei LMS Connect để xem trang web này: ${url}`);
        return undefined;
    }
}
