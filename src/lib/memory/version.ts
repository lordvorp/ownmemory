/*
 * OwnMemory — local-first persistent memory for AI agents.
 * Copyright (C) 2026 Rob Bloodgood
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file.
 */

import packageJson from "../../../package.json";

/** SemVer from package.json — bump on major / semi-major / minor release commits. */
export const OWNMEMORY_VERSION: string = packageJson.version;
