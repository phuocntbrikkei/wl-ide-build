/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable } from '@theia/core/shared/inversify';
import { InAppClipboardGate } from './in-app-clipboard-gate';

@injectable()
export class InAppClipboardGateImpl implements InAppClipboardGate {

    protected allowedText: string | undefined = undefined;

    remember(text: string): void {
        this.allowedText = text;
    }

    clear(): void {
        this.allowedText = undefined;
    }

    isAllowed(text: string): boolean {
        return this.allowedText !== undefined && this.allowedText === text;
    }

    getAllowedText(): string | undefined {
        return this.allowedText;
    }
}
