/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as fs from 'fs';
import * as path from 'path';

import { ElectronMainApplication, ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { injectable } from '@theia/core/shared/inversify';
import { app, BrowserWindow } from '@theia/core/electron-shared/electron';

@injectable()
export class IconContribution implements ElectronMainApplicationContribution {

    onStart(application: ElectronMainApplication): void {
        const iconPath = this.resolveIconPath(application);
        if (!iconPath) {
            console.warn('Rikkei Ide window icon not found.');
            return;
        }

        // Ensure subsequent BrowserWindows pick up the branded icon.
        const electronConfig = application.config.electron as { windowOptions?: { icon?: string } };
        if (!electronConfig.windowOptions) {
            electronConfig.windowOptions = {};
        }
        electronConfig.windowOptions.icon = iconPath;

        for (const window of BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) {
                window.setIcon(iconPath);
            }
        }
    }

    protected resolveIconPath(application: ElectronMainApplication): string | undefined {
        const root = process.env.THEIA_APP_PROJECT_PATH
            || path.resolve(__dirname, '..', '..');
        const candidates = process.platform === 'win32'
            ? [
                path.join(root, 'resources', 'icons', 'WindowsLauncherIcons', 'TheiaIDE.ico'),
                path.join(root, 'resources', 'icons', 'WindowIcon', '512-512.png'),
            ]
            : process.platform === 'darwin'
                ? [
                    path.join(root, 'resources', 'icons', 'WindowIcon', '512-512.png'),
                    path.join(root, 'resources', 'icons', 'MacLauncherIcons', 'icon.icon', 'Assets', 'icon.png'),
                ]
                : [
                    path.join(root, 'resources', 'icons', 'WindowIcon', '512-512.png'),
                    path.join(root, 'resources', 'icons', 'LinuxLauncherIcons', '512x512.png'),
                ];

        return candidates.find(candidate => fs.existsSync(candidate));
    }
}

/** Call before any BrowserWindow is created (Windows taskbar identity). */
export function applyEarlyAppIcon(appProjectPath: string): string | undefined {
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.rikkei.ide');
    }

    const ico = path.join(appProjectPath, 'resources', 'icons', 'WindowsLauncherIcons', 'TheiaIDE.ico');
    const png = path.join(appProjectPath, 'resources', 'icons', 'WindowIcon', '512-512.png');
    const iconPath = process.platform === 'win32'
        ? (fs.existsSync(ico) ? ico : (fs.existsSync(png) ? png : undefined))
        : (fs.existsSync(png) ? png : undefined);

    return iconPath;
}
