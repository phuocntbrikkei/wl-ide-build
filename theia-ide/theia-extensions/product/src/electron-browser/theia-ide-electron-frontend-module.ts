/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { ExternalAppOpenHandler } from '@theia/core/lib/electron-browser/window/external-app-open-handler';
import { ElectronIpcConnectionProvider } from '@theia/core/lib/electron-browser/messaging/electron-ipc-connection-source';
import { LmsConnectOpenHandler } from './lms-connect-open-handler';
import { bindTheiaIdeProductFrontend } from '../browser/theia-ide-frontend-bindings';
import { RikkeiIdeAuthMain, RIKKEI_IDE_AUTH_PATH } from '../common/rikkei-ide-auth';

/**
 * Electron entry module. Theia loads only this `frontendElectron` module for the
 * desktop app (not the plain `frontend` module), so all product frontend bindings
 * are applied here plus the electron-only handler that sends web links to Rikkei LMS Connect.
 */
export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bindTheiaIdeProductFrontend(bind, isBound, rebind);

    // Proxy tới dịch vụ đăng nhập LMS Portal ở electron-main (chỉ có ở bản desktop).
    bind(RikkeiIdeAuthMain).toDynamicValue(ctx =>
        ElectronIpcConnectionProvider.createProxy(ctx.container, RIKKEI_IDE_AUTH_PATH)
    ).inSingletonScope();

    // Link web (http/https) không mở trong IDE hay trình duyệt hệ thống mà chuyển sang
    // trình duyệt của Rikkei LMS Connect — nơi áp chính sách giờ học / giờ thi.
    if (isBound(ExternalAppOpenHandler)) {
        rebind(ExternalAppOpenHandler).to(LmsConnectOpenHandler).inSingletonScope();
    }
});
