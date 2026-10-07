/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { WindowService } from '@theia/core/lib/browser/window/window-service';
import * as React from 'react';
import { getBrandingVariant } from './theia-ide-config';

export interface ExternalBrowserLinkProps {
    text: string;
    url: string;
    windowService: WindowService;
}

export function renderProductName(): React.ReactNode {
    const variant = getBrandingVariant();
    const suffix = variant !== 'stable' ? ` ${variant.charAt(0).toUpperCase() + variant.slice(1)}` : '';
    return <h1>Rikkei <span className="gs-blue-header">Ide</span>{suffix}</h1>;
}

function BrowserLink(props: ExternalBrowserLinkProps): React.JSX.Element {
    return <a
        role={'button'}
        tabIndex={0}
        href={props.url}
        target='_blank'
    >
        {props.text}
    </a>;
}

export function renderWhatIs(_windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            What is this?
        </h3>
        <div>
            <span className='gs-text-bold'>Rikkei Ide</span> is a desktop IDE based on the Eclipse Theia platform,
            customized for a secure single-instance workflow.
        </div>
    </div>;
}

export function renderExtendingCustomizing(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Extending / Customizing
        </h3>
        <div>
            You can extend Rikkei Ide at runtime by installing VS Code-compatible extensions from the <BrowserLink text="OpenVSX registry" url="https://open-vsx.org/"
                windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderSupport(_windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Support
        </h3>
        <div>
            Rikkei Ide is built on Eclipse Theia. Platform documentation is available on the <BrowserLink text="Theia website" url="https://theia-ide.org"
                windowService={_windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderTickets(_windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Reporting issues
        </h3>
        <div>
            Feature requests and bug reports can be filed against the upstream Theia IDE template repository when relevant.
        </div>
    </div>;
}

export function renderSourceCode(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Source code
        </h3>
        <div>
            This product is based on the open-source <BrowserLink text="Eclipse Theia IDE" url="https://github.com/eclipse-theia/theia-ide"
                windowService={windowService} ></BrowserLink> template.
        </div>
    </div>;
}

export function renderDocumentation(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Documentation
        </h3>
        <div>
            See the <BrowserLink text="Theia user documentation" url="https://theia-ide.org/docs/user_getting_started/"
                windowService={windowService} ></BrowserLink> for editor features shared with this IDE.
        </div>
    </div>;
}

export function renderDownloads(): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Updates &amp; downloads
        </h3>
        <div>
            Use your organization&apos;s distribution channel for Rikkei Ide installers and updates.
        </div>
    </div>;
}

export function renderCollaboration(_windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Collaboration
        </h3>
        <div>
            Rikkei Ide focuses on a controlled desktop environment. Collaboration features depend on the extensions you install.
        </div>
    </div>;
}
