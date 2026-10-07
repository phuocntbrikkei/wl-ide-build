/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { environment } from '@theia/core/lib/common';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { MessageService } from '@theia/core/lib/common/message-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import '@theia/core/lib/electron-common/electron-api';
import { InAppClipboardGate } from './in-app-clipboard-gate';

// Không cho phép dán nội dung sao chép từ NGOÀI ứng dụng. Báo cho SV biết vì sao
// paste "không ăn" thay vì im lặng gây khó hiểu; chống spam khi paste liên tục.
const BLOCK_MESSAGE = 'Không dán được: nội dung này sao chép từ ngoài Rikkei Ide. Chỉ dán được thứ bạn đã copy/cut BÊN TRONG IDE.';
const NOTIFY_THROTTLE_MS = 1500;

/**
 * Clipboard that only returns text previously copied/cut inside this app.
 */
@injectable()
export class RestrictedClipboardService implements ClipboardService {

    @inject(InAppClipboardGate)
    protected readonly gate: InAppClipboardGate;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    protected lastNotifyAt = 0;

    async readText(): Promise<string> {
        const text = await this.readRaw();
        if (this.gate.isAllowed(text)) {
            return text;
        }
        // Chỉ báo khi thực sự CÓ nội dung ngoài bị chặn (bỏ qua clipboard rỗng).
        if (text.length > 0) {
            this.notifyBlocked();
        }
        return '';
    }

    protected notifyBlocked(): void {
        const now = Date.now();
        if (now - this.lastNotifyAt < NOTIFY_THROTTLE_MS) {
            return;
        }
        this.lastNotifyAt = now;
        this.messageService.warn(BLOCK_MESSAGE);
    }

    async writeText(value: string): Promise<void> {
        this.gate.remember(value);
        await this.writeRaw(value);
    }

    protected async readRaw(): Promise<string> {
        if (environment.electron.is() && typeof window.electronTheiaCore?.readClipboard === 'function') {
            return window.electronTheiaCore.readClipboard();
        }
        if (navigator.clipboard?.readText) {
            return navigator.clipboard.readText();
        }
        return '';
    }

    protected async writeRaw(value: string): Promise<void> {
        if (environment.electron.is() && typeof window.electronTheiaCore?.writeClipboard === 'function') {
            window.electronTheiaCore.writeClipboard(value);
            return;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
        }
    }
}
