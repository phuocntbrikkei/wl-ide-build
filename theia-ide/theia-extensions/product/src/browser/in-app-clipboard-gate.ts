/********************************************************************************
 * Copyright (C) 2026 Eclipse Foundation and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

// Symbol.for is required: esbuild may evaluate this module more than once.
export const InAppClipboardGate = Symbol.for('theia-ide/InAppClipboardGate');

/**
 * Tracks clipboard content that originated inside this IDE instance.
 * Paste is only allowed when the OS clipboard still matches that content.
 */
export interface InAppClipboardGate {
    remember(text: string): void;
    clear(): void;
    isAllowed(text: string): boolean;
    getAllowedText(): string | undefined;
}
