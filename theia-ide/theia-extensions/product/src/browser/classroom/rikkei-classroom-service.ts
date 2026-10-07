/********************************************************************************
 * Rikkei Ide — biết đang ngoài giờ, giờ học hay giờ thi.
 *
 * Nguồn chân lý là Rikkei LMS Connect (Client đã biết lịch học, phòng thi và cấu
 * hình lớp). IDE hỏi Client mỗi 10 giây qua electron-main (GET 127.0.0.1:34115/
 * ide/status), không tự hỏi SC — để IDE, trình duyệt và giám sát luôn cùng một chế độ.
 ********************************************************************************/

import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { LmsConnectStatus, RikkeiIdeAuthMain } from '../../common/rikkei-ide-auth';

const POLL_MS = 10000;

export type ClassroomMode = 'free' | 'learning' | 'exam' | 'offline';

export interface ClassroomState {
    mode: ClassroomMode;
    status?: LmsConnectStatus; // undefined khi LMS Connect không chạy
}

@injectable()
export class RikkeiClassroomService {

    // Chỉ có ở bản desktop; bản browser coi như không có LMS Connect.
    @inject(RikkeiIdeAuthMain) @optional()
    protected readonly authMain?: RikkeiIdeAuthMain;

    protected state: ClassroomState = { mode: 'offline' };
    protected started = false;
    protected readonly onDidChangeEmitter = new Emitter<{ prev: ClassroomState; next: ClassroomState }>();
    readonly onDidChange: Event<{ prev: ClassroomState; next: ClassroomState }> = this.onDidChangeEmitter.event;

    get current(): ClassroomState {
        return this.state;
    }

    start(): void {
        if (this.started || !this.authMain) {
            return;
        }
        this.started = true;
        void this.refresh();
        setInterval(() => void this.refresh(), POLL_MS);
    }

    async refresh(): Promise<void> {
        let status: LmsConnectStatus | undefined;
        try {
            status = await this.authMain?.getLmsConnectStatus();
        } catch {
            status = undefined;
        }
        const mode: ClassroomMode = !status ? 'offline'
            : status.mode === 'exam' || status.mode === 'learning' ? status.mode : 'free';
        const next: ClassroomState = { mode, status };
        const prev = this.state;
        this.state = next;
        if (JSON.stringify(prev) !== JSON.stringify(next)) {
            this.onDidChangeEmitter.fire({ prev, next });
        }
    }
}
