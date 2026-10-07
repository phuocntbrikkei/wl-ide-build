/********************************************************************************
 * Rikkei Ide — đăng nhập qua TRANG LOGIN CỦA SC ở tiến trình electron-main.
 * Mở BrowserWindow tới {sc}/login (trang do SC phục vụ, tự gọi wrap /api/student/login).
 * Đăng nhập xong trang chuyển tới {sc}/login/done?studentRkId=... — ta bắt URL đó
 * để lấy danh tính. IDE không đụng LMS; SC lo hết (gọi LMS local).
 ********************************************************************************/

import { injectable } from '@theia/core/shared/inversify';
import { BrowserWindow, app } from '@theia/core/electron-shared/electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as http from 'http';
import { LmsConnectStatus, RikkeiIdeAuthMain, RikkeiIdeSession } from '../common/rikkei-ide-auth';

@injectable()
export class RikkeiIdeAuthMainImpl implements RikkeiIdeAuthMain {

    // Phiên lưu ở userData (VD Windows: %APPDATA%/<app>/rikkei-ide-session.json).
    // Không đụng workspace/localStorage nên bền qua reload và đổi folder.
    protected sessionFile(): string {
        return path.join(app.getPath('userData'), 'rikkei-ide-session.json');
    }

    async loadSession(): Promise<RikkeiIdeSession | undefined> {
        try {
            const raw = await fs.readFile(this.sessionFile(), 'utf8');
            const s = JSON.parse(raw) as RikkeiIdeSession;
            if (s && Number(s.studentRkId) > 0) {
                return s;
            }
        } catch {
            // chưa có file / hỏng -> chưa đăng nhập
        }
        return undefined;
    }

    protected async saveSession(session: RikkeiIdeSession): Promise<void> {
        try {
            await fs.writeFile(this.sessionFile(), JSON.stringify(session), 'utf8');
        } catch (err) {
            console.error('[rikkei-ide-auth] lưu phiên lỗi', err);
        }
    }

    async clearSession(): Promise<void> {
        try {
            await fs.unlink(this.sessionFile());
        } catch {
            // không có file -> coi như đã xoá
        }
    }

    /**
     * Gửi URL sang trình duyệt của Rikkei LMS Connect qua server nội bộ của Client
     * (127.0.0.1:34115). Gọi từ tiến trình chính (Node) nên không vướng CORS; Client
     * chỉ nhận POST có header X-Rikkei-Ide nên trang web lạ không lợi dụng được.
     */
    async openInLmsConnect(url: string): Promise<boolean> {
        if (!/^https?:\/\//i.test(url || '')) {
            return false;
        }
        const body = JSON.stringify({ url });
        return new Promise<boolean>(resolve => {
            const req = http.request({
                host: '127.0.0.1',
                port: 34115,
                path: '/browser/open',
                method: 'POST',
                timeout: 2000,
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Rikkei-Ide': '1' },
            }, res => {
                res.resume();
                resolve(res.statusCode === 200);
            });
            req.on('timeout', () => req.destroy());
            req.on('error', () => resolve(false));
            req.end(body);
        });
    }

    async getLmsConnectStatus(): Promise<LmsConnectStatus | undefined> {
        return new Promise<LmsConnectStatus | undefined>(resolve => {
            const req = http.request({
                host: '127.0.0.1',
                port: 34115,
                path: '/ide/status',
                method: 'GET',
                timeout: 1500,
                headers: { 'X-Rikkei-Ide': '1', Accept: 'application/json' },
            }, res => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        resolve(undefined);
                        return;
                    }
                    try {
                        resolve(JSON.parse(data) as LmsConnectStatus);
                    } catch {
                        resolve(undefined);
                    }
                });
            });
            req.on('timeout', () => req.destroy());
            req.on('error', () => resolve(undefined));
            req.end();
        });
    }

    async loginViaPortal(opts: { scBaseUrl: string }): Promise<RikkeiIdeSession | undefined> {
        const base = (opts.scBaseUrl || '').trim().replace(/\/+$/, '');
        console.log('[rikkei-ide-auth] loginViaPortal base=', base);
        if (!base) {
            return undefined;
        }
        const loginUrl = `${base}/login`;

        return new Promise<RikkeiIdeSession | undefined>(resolve => {
            const win = new BrowserWindow({
                width: 480,
                height: 660,
                title: 'Đăng nhập Rikkei Ide',
                autoHideMenuBar: true,
                webPreferences: { nodeIntegration: false, contextIsolation: true },
            });

            let done = false;
            let poll: ReturnType<typeof setInterval> | undefined;
            const finish = (result: RikkeiIdeSession | undefined) => {
                if (done) {
                    return;
                }
                done = true;
                if (poll) {
                    clearInterval(poll);
                }
                if (!win.isDestroyed()) {
                    win.removeAllListeners('closed');
                    win.close();
                }
                if (result) {
                    void this.saveSession(result);
                }
                resolve(result);
            };

            win.on('closed', () => {
                if (!done) {
                    done = true;
                    if (poll) {
                        clearInterval(poll);
                    }
                    resolve(undefined);
                }
            });

            // Bắt URL /login/done: lấy studentRkId. Trả true nếu đã xử lý xong.
            const handleUrl = (url: string): boolean => {
                if (!url || url.indexOf('/login/done') === -1) {
                    return false;
                }
                console.log('[rikkei-ide-auth] bắt /login/done url=', url);
                try {
                    const u = new URL(url);
                    const rk = Number(u.searchParams.get('studentRkId') || '0');
                    if (rk > 0) {
                        finish({
                            studentRkId: rk,
                            fullName: u.searchParams.get('fullName') || '',
                            studentCode: u.searchParams.get('studentCode') || '',
                            email: u.searchParams.get('email') || undefined,
                            loggedInAt: Date.now(),
                        });
                        return true;
                    }
                } catch {
                    // ignore
                }
                return false;
            };

            win.webContents.on('did-navigate', (_e, url) => { console.log('[rikkei-ide-auth] did-navigate', url); handleUrl(url); });
            win.webContents.on('did-navigate-in-page', (_e, url) => { console.log('[rikkei-ide-auth] did-navigate-in-page', url); handleUrl(url); });
            win.webContents.on('will-redirect', (_e, url) => { console.log('[rikkei-ide-auth] will-redirect', url); handleUrl(url); });
            win.webContents.on('did-finish-load', () => console.log('[rikkei-ide-auth] did-finish-load', win.isDestroyed() ? '(destroyed)' : win.webContents.getURL()));
            win.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
                console.error(`[rikkei-ide-auth] did-fail-load ${code} ${desc} ${failedUrl}`);
            });

            // Theia core CHẶN will-navigate trên mọi webContents (chỉ cho secondary
            // window), nên trang không điều hướng được tới /login/done. Vì vậy đọc
            // biến toàn cục window.__rikkeiLogin do trang SC đặt khi đăng nhập xong.
            poll = setInterval(() => {
                if (done || win.isDestroyed()) {
                    return;
                }
                try {
                    handleUrl(win.webContents.getURL());
                } catch {
                    // ignore
                }
                win.webContents.executeJavaScript('window.__rikkeiLogin || null', true).then(r => {
                    if (r && Number(r.studentRkId) > 0) {
                        console.log('[rikkei-ide-auth] đọc window.__rikkeiLogin rk=', r.studentRkId);
                        finish({
                            studentRkId: Number(r.studentRkId),
                            fullName: r.fullName || '',
                            studentCode: r.studentCode || '',
                            email: r.email || undefined,
                            loggedInAt: Date.now(),
                        });
                    }
                }).catch(() => { /* trang chưa sẵn / đang load */ });
            }, 400);

            win.loadURL(loginUrl).catch(err => {
                console.error('[rikkei-ide-auth] loadURL lỗi', err);
                finish(undefined);
            });
        });
    }
}
