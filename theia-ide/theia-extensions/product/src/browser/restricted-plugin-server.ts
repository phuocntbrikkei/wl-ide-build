/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { interfaces } from '@theia/core/shared/inversify';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging';
import { MessageService } from '@theia/core/lib/common/message-service';
import { PluginServer, pluginServerJsonRpcPath } from '@theia/plugin-ext/lib/common/plugin-protocol';

/**
 * Methods on the {@link PluginServer} that mutate the set of installed plugins.
 * Blocking them here disables *every* runtime install/uninstall path at once
 * (marketplace "Install" button, "Install from VSIX", and VSIX drag & drop),
 * because they all funnel through this single backend service.
 *
 * Pre-bundled plugins are deployed by the backend plugin deployer at startup and
 * do not go through these methods, so they keep working.
 */
const BLOCKED_METHODS: ReadonlySet<PropertyKey> = new Set(['install', 'uninstall']);

const DISABLED_MESSAGE = 'Cài/gỡ extension đã bị vô hiệu hóa trong Rikkei Ide. Chỉ dùng được các extension cài sẵn.';

/**
 * Rebinds {@link PluginServer} to a guarded proxy that rejects install/uninstall
 * requests. This locks the extension set to what ships with the product and
 * prevents students from installing arbitrary (e.g. AI) extensions.
 */
export function bindRestrictedPluginServer(
    bind: interfaces.Bind,
    isBound: interfaces.IsBound,
    rebind: interfaces.Rebind
): void {
    const create = (ctx: interfaces.Context): PluginServer => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        const delegate = provider.createProxy<PluginServer>(pluginServerJsonRpcPath);
        const messageService = ctx.container.get(MessageService);
        return new Proxy(delegate, {
            get(target, property, receiver): unknown {
                if (BLOCKED_METHODS.has(property)) {
                    return async (): Promise<never> => {
                        messageService.warn(DISABLED_MESSAGE);
                        throw new Error(DISABLED_MESSAGE);
                    };
                }
                return Reflect.get(target, property, receiver);
            }
        });
    };
    if (isBound(PluginServer)) {
        rebind(PluginServer).toDynamicValue(create).inSingletonScope();
    } else {
        bind(PluginServer).toDynamicValue(create).inSingletonScope();
    }
}
