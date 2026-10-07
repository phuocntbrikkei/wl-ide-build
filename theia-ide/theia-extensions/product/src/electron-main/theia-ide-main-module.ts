/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronMainApplication, ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { ElectronMainWindowService } from '@theia/core/lib/electron-common/electron-main-window-service';
import { ElectronConnectionHandler } from '@theia/core/lib/electron-main/messaging/electron-connection-handler';
import { RpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import { IconContribution } from './icon-contribution';
import { StrictSingleInstanceApplication } from './strict-single-instance-application';
import { StrictElectronMainWindowService } from './strict-electron-main-window-service';
import { RikkeiIdeAuthMain, RIKKEI_IDE_AUTH_PATH } from '../common/rikkei-ide-auth';
import { RikkeiIdeAuthMainImpl } from './rikkei-ide-auth-main';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bind(IconContribution).toSelf().inSingletonScope();
    bind(ElectronMainApplicationContribution).toService(IconContribution);

    // Dịch vụ đăng nhập LMS Portal (electron-main) — expose cho frontend qua RPC.
    bind(RikkeiIdeAuthMainImpl).toSelf().inSingletonScope();
    bind(RikkeiIdeAuthMain).toService(RikkeiIdeAuthMainImpl);
    bind(ElectronConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(RIKKEI_IDE_AUTH_PATH, () => ctx.container.get(RikkeiIdeAuthMain))
    ).inSingletonScope();

    if (isBound(ElectronMainApplication)) {
        rebind(ElectronMainApplication).to(StrictSingleInstanceApplication).inSingletonScope();
    } else {
        bind(ElectronMainApplication).to(StrictSingleInstanceApplication).inSingletonScope();
    }

    if (isBound(ElectronMainWindowService)) {
        rebind(ElectronMainWindowService).to(StrictElectronMainWindowService).inSingletonScope();
    } else {
        bind(ElectronMainWindowService).to(StrictElectronMainWindowService).inSingletonScope();
    }
});
