/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ElectronMainApplication } from '@theia/core/lib/electron-main/electron-main-application';
import { FrontendApplicationConfig } from '@theia/application-package/lib/application-props';
import { injectable } from '@theia/core/shared/inversify';
import { BrowserWindow, Event as ElectronEvent } from '@theia/core/electron-shared/electron';
import { applyEarlyAppIcon } from './icon-contribution';

/**
 * Second launches only focus the existing window — never open another IDE window.
 */
@injectable()
export class StrictSingleInstanceApplication extends ElectronMainApplication {

    override async start(config: FrontendApplicationConfig): Promise<void> {
        const iconPath = applyEarlyAppIcon(this.globals.THEIA_APP_PROJECT_PATH);
        if (iconPath) {
            const electronConfig = config.electron as { windowOptions?: { icon?: string } };
            if (!electronConfig.windowOptions) {
                electronConfig.windowOptions = {};
            }
            electronConfig.windowOptions.icon = iconPath;
        }
        return super.start(config);
    }

    protected override async onSecondInstance(_event: ElectronEvent, _argv: string[], _cwd: string, _originalArgv: string[]): Promise<void> {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length === 0) {
            return;
        }
        const win = windows.find(w => !w.isDestroyed()) ?? windows[0];
        if (win.isMinimized()) {
            win.restore();
        }
        win.show();
        win.focus();
    }
}
