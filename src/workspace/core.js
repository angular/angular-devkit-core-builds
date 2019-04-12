"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const virtual_fs_1 = require("../virtual-fs");
const reader_1 = require("./json/reader");
const writer_1 = require("./json/writer");
const formatLookup = new WeakMap();
var WorkspaceFormat;
(function (WorkspaceFormat) {
    WorkspaceFormat[WorkspaceFormat["JSON"] = 0] = "JSON";
})(WorkspaceFormat = exports.WorkspaceFormat || (exports.WorkspaceFormat = {}));
function _test_addWorkspaceFile(name, format) {
    workspaceFiles[name] = format;
}
exports._test_addWorkspaceFile = _test_addWorkspaceFile;
function _test_removeWorkspaceFile(name) {
    delete workspaceFiles[name];
}
exports._test_removeWorkspaceFile = _test_removeWorkspaceFile;
// NOTE: future additions could also perform content analysis to determine format/version
const workspaceFiles = {
    'angular.json': WorkspaceFormat.JSON,
    '.angular.json': WorkspaceFormat.JSON,
};
async function readWorkspace(path, host, format) {
    if (await host.isDirectory(path)) {
        // TODO: Warn if multiple found (requires diagnostics support)
        const directory = virtual_fs_1.normalize(path);
        let found = false;
        for (const [name, nameFormat] of Object.entries(workspaceFiles)) {
            if (format !== undefined && format !== nameFormat) {
                continue;
            }
            const potential = virtual_fs_1.getSystemPath(virtual_fs_1.join(directory, name));
            if (await host.isFile(potential)) {
                path = potential;
                format = nameFormat;
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error('Unable to locate a workspace file for workspace path.');
        }
    }
    else if (format === undefined) {
        const filename = virtual_fs_1.basename(virtual_fs_1.normalize(path));
        if (filename in workspaceFiles) {
            format = workspaceFiles[filename];
        }
    }
    if (format === undefined) {
        throw new Error('Unable to determine format for workspace path.');
    }
    let workspace;
    switch (format) {
        case WorkspaceFormat.JSON:
            workspace = await reader_1.readJsonWorkspace(path, host);
            break;
        default:
            throw new Error('Unsupported workspace format.');
    }
    formatLookup.set(workspace, WorkspaceFormat.JSON);
    return { workspace };
}
exports.readWorkspace = readWorkspace;
async function writeWorkspace(workspace, host, path, format) {
    if (format === undefined) {
        format = formatLookup.get(workspace);
        if (format === undefined) {
            throw new Error('A format is required for custom workspace objects.');
        }
    }
    switch (format) {
        case WorkspaceFormat.JSON:
            return writer_1.writeJsonWorkspace(workspace, host, path);
        default:
            throw new Error('Unsupported workspace format.');
    }
}
exports.writeWorkspace = writeWorkspace;
