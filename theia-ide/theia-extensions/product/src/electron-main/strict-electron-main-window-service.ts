/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { NewWindowOptions } from '@theia/core/lib/common/window';
import { ElectronMainWindowServiceImpl } from '@theia/core/lib/electron-main/electron-main-window-service-impl';
import { injectable } from '@theia/core/shared/inversify';
import { BrowserWindow } from '@theia/core/electron-shared/electron';

function isLocalHttpUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
            return true;
        }
        return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
    } catch {
        return false;
    }
}

/**
 * Blocks creating additional IDE windows; external URLs only allowed for localhost.
 */
@injectable()
export class StrictElectronMainWindowService extends ElectronMainWindowServiceImpl {

    override openNewWindow(url: string, options?: NewWindowOptions): undefined {
        if (options?.external) {
            if (!isLocalHttpUrl(url)) {
                console.warn(`[Rikkei Ide] Blocked external URL: ${url}`);
                return undefined;
            }
            return super.openNewWindow(url, options);
        }
        this.focusExistingWindow();
        return undefined;
    }

    override async openNewDefaultWindow(_params?: import('@theia/core/lib/common/window').WindowSearchParams): Promise<number> {
        this.focusExistingWindow();
        return -1;
    }

    protected focusExistingWindow(): void {
        const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
        if (!win) {
            return;
        }
        if (win.isMinimized()) {
            win.restore();
        }
        win.show();
        win.focus();
    }
}
