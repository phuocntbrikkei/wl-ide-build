/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { PreferenceService, PreferenceChange } from '@theia/core/lib/common/preferences/preference-service';
import { PreferenceScope } from '@theia/core/lib/common/preferences/preference-scope';
import { MessageService } from '@theia/core/lib/common/message-service';

/**
 * The only way to add *new* Emmet abbreviations (custom "shortcut -> code" snippets)
 * is by pointing `emmet.extensionsPath` at a folder containing a `snippets.json`.
 * Built-in Emmet abbreviations (e.g. `!` -> HTML skeleton, `ul>li*5`, ...) do not
 * rely on this setting and keep working.
 *
 * To stop students from smuggling in pre-written solutions via custom Emmet
 * snippets, we keep `emmet.extensionsPath` locked to empty: on startup and on any
 * attempt to change it, the override is removed and the user is warned.
 */
@injectable()
export class EmmetLockdownContribution implements FrontendApplicationContribution {

    protected static readonly PREFERENCE = 'emmet.extensionsPath';
    protected static readonly MESSAGE =
        'Thêm Emmet snippet tùy biến (emmet.extensionsPath) đã bị vô hiệu hóa trong Rikkei Ide.';

    @inject(PreferenceService)
    protected readonly preferences: PreferenceService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    async onStart(): Promise<void> {
        await this.preferences.ready;
        await this.enforce(false);
        this.preferences.onPreferenceChanged((event: PreferenceChange) => {
            if (event.preferenceName === EmmetLockdownContribution.PREFERENCE) {
                void this.enforce(true);
            }
        });
    }

    protected async enforce(notify: boolean): Promise<void> {
        const inspection = this.preferences.inspect<string[]>(EmmetLockdownContribution.PREFERENCE);
        const hasEntries = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0;
        if (!inspection || !(hasEntries(inspection.globalValue)
            || hasEntries(inspection.workspaceValue)
            || hasEntries(inspection.workspaceFolderValue))) {
            return;
        }
        const tasks: Promise<void>[] = [];
        if (hasEntries(inspection.globalValue)) {
            tasks.push(this.preferences.set(EmmetLockdownContribution.PREFERENCE, undefined, PreferenceScope.User));
        }
        if (hasEntries(inspection.workspaceValue)) {
            tasks.push(this.preferences.set(EmmetLockdownContribution.PREFERENCE, undefined, PreferenceScope.Workspace));
        }
        if (hasEntries(inspection.workspaceFolderValue)) {
            // Folder scope needs a resource uri to target precisely; fall back to
            // `updateValue`, which resolves the most specific conflicting scope itself.
            tasks.push(this.preferences.updateValue(EmmetLockdownContribution.PREFERENCE, []));
        }
        await Promise.all(tasks.map(task => task.catch(() => undefined)));
        if (notify) {
            this.messageService.warn(EmmetLockdownContribution.MESSAGE);
        }
    }
}
