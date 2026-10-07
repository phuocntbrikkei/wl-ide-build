/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { bindTheiaIdeProductFrontend } from './theia-ide-frontend-bindings';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bindTheiaIdeProductFrontend(bind, isBound, rebind);
});
