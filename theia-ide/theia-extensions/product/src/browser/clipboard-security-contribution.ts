/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { environment } from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';
import '@theia/core/lib/electron-common/electron-api';
import { InAppClipboardGate } from './in-app-clipboard-gate';

/**
 * Blocks external paste and OS file drag-and-drop into the IDE.
 * In-app copy/cut is remembered so matching paste is still allowed.
 */
@injectable()
export class ClipboardSecurityContribution implements FrontendApplicationContribution {

    @inject(InAppClipboardGate)
    protected readonly gate: InAppClipboardGate;

    onStart(): void {
        this.installCopyCutTracking();
        this.installClipboardApiGuard();
        this.installPasteGuard();
        this.installDragDropGuard();
    }

    protected installCopyCutTracking(): void {
        const rememberAfterClipboardWrite = (): void => {
            // Let Chromium finish writing to the OS clipboard first.
            window.setTimeout(() => {
                try {
                    this.gate.remember(this.readOsClipboard());
                } catch {
                    // Ignore permission / clipboard errors.
                }
            }, 0);
        };

        window.addEventListener('copy', rememberAfterClipboardWrite, true);
        window.addEventListener('cut', rememberAfterClipboardWrite, true);
    }

    /**
     * The Monaco editor reads/writes the clipboard directly through the async
     * `navigator.clipboard` API (its Ctrl+V command does not emit a DOM `paste`
     * event). Wrap that API so reads only ever return content copied inside the
     * IDE, and writes are remembered as in-app content.
     */
    protected installClipboardApiGuard(): void {
        const clipboard = navigator.clipboard as Clipboard | undefined;
        if (!clipboard) {
            return;
        }
        const gate = this.gate;

        const originalReadText = clipboard.readText?.bind(clipboard);
        const originalRead = clipboard.read?.bind(clipboard);
        const originalWriteText = clipboard.writeText?.bind(clipboard);
        const originalWrite = clipboard.write?.bind(clipboard);

        const define = (name: string, value: unknown): void => {
            try {
                Object.defineProperty(clipboard, name, { value, configurable: true, writable: true });
            } catch {
                // Ignore if the property cannot be redefined.
            }
        };

        if (originalReadText) {
            define('readText', async (): Promise<string> => {
                const text = await originalReadText();
                return gate.isAllowed(text) ? text : '';
            });
        }
        if (originalRead) {
            define('read', async (): Promise<ClipboardItem[]> => {
                const items = await originalRead();
                let text = '';
                try {
                    const item = items.find((i: ClipboardItem) => i.types.includes('text/plain'));
                    if (item) {
                        text = await (await item.getType('text/plain')).text();
                    }
                } catch {
                    // Ignore extraction errors and treat as blocked.
                }
                return gate.isAllowed(text) ? items : [];
            });
        }
        if (originalWriteText) {
            define('writeText', async (value: string): Promise<void> => {
                gate.remember(value);
                await originalWriteText(value);
            });
        }
        if (originalWrite) {
            define('write', async (data: ClipboardItem[]): Promise<void> => {
                try {
                    const item = data.find((i: ClipboardItem) => i.types.includes('text/plain'));
                    if (item) {
                        gate.remember(await (await item.getType('text/plain')).text());
                    }
                } catch {
                    // Ignore extraction errors.
                }
                await originalWrite(data);
            });
        }
    }

    protected installPasteGuard(): void {
        const blockIfExternal = (event: ClipboardEvent): void => {
            const text = event.clipboardData?.getData('text/plain') ?? '';
            if (!this.gate.isAllowed(text)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };

        window.addEventListener('paste', blockIfExternal, true);
    }

    protected installDragDropGuard(): void {
        const isExternalFileDrag = (event: DragEvent): boolean => {
            const transfer = event.dataTransfer;
            if (!transfer) {
                return false;
            }
            const types = Array.from(transfer.types ?? []);
            return types.includes('Files') || (transfer.files?.length ?? 0) > 0;
        };

        const blockExternalFiles = (event: DragEvent): void => {
            if (!isExternalFileDrag(event)) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        };

        window.addEventListener('dragenter', blockExternalFiles, true);
        window.addEventListener('dragover', blockExternalFiles, true);
        window.addEventListener('drop', blockExternalFiles, true);
    }

    protected readOsClipboard(): string {
        if (environment.electron.is() && typeof window.electronTheiaCore?.readClipboard === 'function') {
            return window.electronTheiaCore.readClipboard();
        }
        return '';
    }
}
