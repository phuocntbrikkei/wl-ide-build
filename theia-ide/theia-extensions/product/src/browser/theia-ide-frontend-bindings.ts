/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import '../../src/browser/style/index.css';

import { interfaces } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { CommandContribution } from '@theia/core/lib/common/command';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { applyBranding } from './theia-ide-config';
import { ClipboardSecurityContribution } from './clipboard-security-contribution';
import { InAppClipboardGate } from './in-app-clipboard-gate';
import { InAppClipboardGateImpl } from './in-app-clipboard-gate-impl';
import { RestrictedClipboardService } from './restricted-clipboard-service';
import { TheiaIDEAboutDialog } from './theia-ide-about-dialog';
import { TheiaIDEContribution } from './theia-ide-contribution';
import { TheiaIDEGettingStartedWidget } from './theia-ide-getting-started-widget';
import { bindRestrictedPluginServer } from './restricted-plugin-server';
import { EmmetLockdownContribution } from './emmet-lockdown-contribution';
import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { RikkeiAuthService } from './auth/rikkei-auth-service';
import { RikkeiLoginContribution } from './auth/rikkei-login-contribution';
import { RikkeiAuthPreferenceSchema } from './auth/rikkei-auth-preferences';
import { RikkeiCodeActivityContribution } from './auth/rikkei-code-activity';
import { RikkeiClassroomService } from './classroom/rikkei-classroom-service';
import { RikkeiClassroomContribution } from './classroom/rikkei-classroom-contribution';
import { RikkeiVersionContribution } from './classroom/rikkei-version-contribution';

/**
 * All product frontend bindings (branding, custom Getting Started / About,
 * clipboard restrictions). Trình duyệt web không nằm trong IDE: link web được
 * chuyển sang trình duyệt của Rikkei LMS Connect (xem lms-connect-open-handler.ts).
 *
 * This is shared because Theia loads only the `frontendElectron` module for the
 * desktop app and the plain `frontend` module for the browser target, so both
 * entry modules must apply the same bindings.
 */
export function bindTheiaIdeProductFrontend(
    bind: interfaces.Bind,
    isBound: interfaces.IsBound,
    rebind: interfaces.Rebind
): void {
    applyBranding();

    bind(TheiaIDEGettingStartedWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: GettingStartedWidget.ID,
        createWidget: () => context.container.get<TheiaIDEGettingStartedWidget>(TheiaIDEGettingStartedWidget),
    })).inSingletonScope();
    if (isBound(AboutDialog)) {
        rebind(AboutDialog).to(TheiaIDEAboutDialog).inSingletonScope();
    } else {
        bind(AboutDialog).to(TheiaIDEAboutDialog).inSingletonScope();
    }

    bind(TheiaIDEContribution).toSelf().inSingletonScope();
    [CommandContribution, MenuContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toService(TheiaIDEContribution)
    );

    // Clipboard security: only allow pasting content copied/cut inside the app.
    if (!isBound(InAppClipboardGate)) {
        bind(InAppClipboardGate).to(InAppClipboardGateImpl).inSingletonScope();
    }
    if (!isBound(ClipboardSecurityContribution)) {
        bind(ClipboardSecurityContribution).toSelf().inSingletonScope();
        bind(FrontendApplicationContribution).toService(ClipboardSecurityContribution);
    }
    if (isBound(ClipboardService)) {
        rebind(ClipboardService).to(RestrictedClipboardService).inSingletonScope();
    } else {
        bind(ClipboardService).to(RestrictedClipboardService).inSingletonScope();
    }

    // Lock down extensions: block installing/uninstalling so only the pre-bundled
    // set (Live Server + language/run tooling) is available. Prevents students from
    // installing arbitrary extensions such as AI assistants.
    bindRestrictedPluginServer(bind, isBound, rebind);

    // Keep Emmet's built-in abbreviations working, but block adding *new* custom
    // Emmet snippets (via `emmet.extensionsPath`) to prevent smuggling in pre-written code.
    if (!isBound(EmmetLockdownContribution)) {
        bind(EmmetLockdownContribution).toSelf().inSingletonScope();
        bind(FrontendApplicationContribution).toService(EmmetLockdownContribution);
    }

    // Đăng nhập LMS Portal: bắt buộc đăng nhập mới dùng được IDE (nền cho tính năng
    // tương lai — chưa gắn phòng thi/giám sát). Cấu hình máy chủ trong Settings.
    if (!isBound(RikkeiAuthService)) {
        bind(RikkeiAuthService).toSelf().inSingletonScope();
    }
    if (!isBound(RikkeiLoginContribution)) {
        bind(RikkeiLoginContribution).toSelf().inSingletonScope();
        bind(FrontendApplicationContribution).toService(RikkeiLoginContribution);
        bind(CommandContribution).toService(RikkeiLoginContribution);
    }
    bind(PreferenceContribution).toConstantValue({ schema: RikkeiAuthPreferenceSchema });

    // Chế độ ngoài giờ / giờ học / giờ thi lấy từ Rikkei LMS Connect: thanh trạng thái
    // (đếm ngược giờ thi), báo khi đổi chế độ, gắn chế độ vào log hoạt động code.
    if (!isBound(RikkeiClassroomService)) {
        bind(RikkeiClassroomService).toSelf().inSingletonScope();
    }
    if (!isBound(RikkeiClassroomContribution)) {
        bind(RikkeiClassroomContribution).toSelf().inSingletonScope();
        bind(FrontendApplicationContribution).toService(RikkeiClassroomContribution);
    }

    // Phiên bản tối thiểu do SC quy định: dưới mức thì chặn IDE, chỉ còn nút tải bản mới.
    if (!isBound(RikkeiVersionContribution)) {
        bind(RikkeiVersionContribution).toSelf().inSingletonScope();
        bind(FrontendApplicationContribution).toService(RikkeiVersionContribution);
    }

    // Theo dõi hoạt động code (gửi JSONL về SC). An toàn với mở folder vì chỉ hook
    // sự kiện MonacoWorkspace/FileService, không chặn vòng đời khởi tạo layout.
    if (!isBound(RikkeiCodeActivityContribution)) {
        bind(RikkeiCodeActivityContribution).toSelf().inSingletonScope();
        bind(FrontendApplicationContribution).toService(RikkeiCodeActivityContribution);
    }
}
