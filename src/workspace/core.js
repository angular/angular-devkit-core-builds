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
const definitions_1 = require("./definitions");
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
                // TEMP - remove disable when actual reader is used
                // tslint:disable-next-line:no-dead-store
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
            // TEMP: remove the following two statements when JSON support is introduced
            await host.readFile(path);
            workspace = {
                extensions: {},
                projects: new definitions_1.ProjectDefinitionCollection(),
            };
            break;
        default:
            throw new Error('Unsupported workspace format.');
    }
    formatLookup.set(workspace, WorkspaceFormat.JSON);
    return workspace;
}
exports.readWorkspace = readWorkspace;
async function writeWorkspace(workspace, _host, _path, format) {
    if (format === undefined) {
        format = formatLookup.get(workspace);
        if (format === undefined) {
            throw new Error('A format is required for custom workspace objects.');
        }
    }
    switch (format) {
        case WorkspaceFormat.JSON:
            throw new Error('Not Implemented.');
        default:
            throw new Error('Unsupported workspace format.');
    }
}
exports.writeWorkspace = writeWorkspace;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvd29ya3NwYWNlL2NvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCw4Q0FBeUU7QUFDekUsK0NBQWlGO0FBR2pGLE1BQU0sWUFBWSxHQUFHLElBQUksT0FBTyxFQUF3QyxDQUFDO0FBRXpFLElBQVksZUFFWDtBQUZELFdBQVksZUFBZTtJQUN6QixxREFBSSxDQUFBO0FBQ04sQ0FBQyxFQUZXLGVBQWUsR0FBZix1QkFBZSxLQUFmLHVCQUFlLFFBRTFCO0FBRUQsU0FBZ0Isc0JBQXNCLENBQUMsSUFBWSxFQUFFLE1BQXVCO0lBQzFFLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDaEMsQ0FBQztBQUZELHdEQUVDO0FBRUQsU0FBZ0IseUJBQXlCLENBQUMsSUFBWTtJQUNwRCxPQUFPLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixDQUFDO0FBRkQsOERBRUM7QUFFRCx5RkFBeUY7QUFDekYsTUFBTSxjQUFjLEdBQW9DO0lBQ3RELGNBQWMsRUFBRSxlQUFlLENBQUMsSUFBSTtJQUNwQyxlQUFlLEVBQUUsZUFBZSxDQUFDLElBQUk7Q0FDdEMsQ0FBQztBQUVLLEtBQUssVUFBVSxhQUFhLENBQ2pDLElBQVksRUFDWixJQUFtQixFQUNuQixNQUF3QjtJQUV4QixJQUFJLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNoQyw4REFBOEQ7UUFDOUQsTUFBTSxTQUFTLEdBQUcsc0JBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbEIsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDL0QsSUFBSSxNQUFNLEtBQUssU0FBUyxJQUFJLE1BQU0sS0FBSyxVQUFVLEVBQUU7Z0JBQ2pELFNBQVM7YUFDVjtZQUVELE1BQU0sU0FBUyxHQUFHLDBCQUFhLENBQUMsaUJBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN2RCxJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDaEMsbURBQW1EO2dCQUNuRCx5Q0FBeUM7Z0JBQ3pDLElBQUksR0FBRyxTQUFTLENBQUM7Z0JBQ2pCLE1BQU0sR0FBRyxVQUFVLENBQUM7Z0JBQ3BCLEtBQUssR0FBRyxJQUFJLENBQUM7Z0JBQ2IsTUFBTTthQUNQO1NBQ0Y7UUFDRCxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1YsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO1NBQzFFO0tBQ0Y7U0FBTSxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7UUFDL0IsTUFBTSxRQUFRLEdBQUcscUJBQVEsQ0FBQyxzQkFBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDM0MsSUFBSSxRQUFRLElBQUksY0FBYyxFQUFFO1lBQzlCLE1BQU0sR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDbkM7S0FDRjtJQUVELElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtRQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLGdEQUFnRCxDQUFDLENBQUM7S0FDbkU7SUFFRCxJQUFJLFNBQVMsQ0FBQztJQUNkLFFBQVEsTUFBTSxFQUFFO1FBQ2QsS0FBSyxlQUFlLENBQUMsSUFBSTtZQUN2Qiw0RUFBNEU7WUFDNUUsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFCLFNBQVMsR0FBRztnQkFDVixVQUFVLEVBQUUsRUFBRTtnQkFDZCxRQUFRLEVBQUUsSUFBSSx5Q0FBMkIsRUFBRTthQUM1QyxDQUFDO1lBQ0YsTUFBTTtRQUNSO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0tBQ3BEO0lBRUQsWUFBWSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWxELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUF2REQsc0NBdURDO0FBRU0sS0FBSyxVQUFVLGNBQWMsQ0FDbEMsU0FBOEIsRUFDOUIsS0FBb0IsRUFDcEIsS0FBYyxFQUNkLE1BQXdCO0lBRXhCLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtRQUN4QixNQUFNLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyQyxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7WUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO1NBQ3ZFO0tBQ0Y7SUFFRCxRQUFRLE1BQU0sRUFBRTtRQUNkLEtBQUssZUFBZSxDQUFDLElBQUk7WUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3RDO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0tBQ3BEO0FBQ0gsQ0FBQztBQW5CRCx3Q0FtQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBiYXNlbmFtZSwgZ2V0U3lzdGVtUGF0aCwgam9pbiwgbm9ybWFsaXplIH0gZnJvbSAnLi4vdmlydHVhbC1mcyc7XG5pbXBvcnQgeyBQcm9qZWN0RGVmaW5pdGlvbkNvbGxlY3Rpb24sIFdvcmtzcGFjZURlZmluaXRpb24gfSBmcm9tICcuL2RlZmluaXRpb25zJztcbmltcG9ydCB7IFdvcmtzcGFjZUhvc3QgfSBmcm9tICcuL2hvc3QnO1xuXG5jb25zdCBmb3JtYXRMb29rdXAgPSBuZXcgV2Vha01hcDxXb3Jrc3BhY2VEZWZpbml0aW9uLCBXb3Jrc3BhY2VGb3JtYXQ+KCk7XG5cbmV4cG9ydCBlbnVtIFdvcmtzcGFjZUZvcm1hdCB7XG4gIEpTT04sXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfdGVzdF9hZGRXb3Jrc3BhY2VGaWxlKG5hbWU6IHN0cmluZywgZm9ybWF0OiBXb3Jrc3BhY2VGb3JtYXQpOiB2b2lkIHtcbiAgd29ya3NwYWNlRmlsZXNbbmFtZV0gPSBmb3JtYXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfdGVzdF9yZW1vdmVXb3Jrc3BhY2VGaWxlKG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICBkZWxldGUgd29ya3NwYWNlRmlsZXNbbmFtZV07XG59XG5cbi8vIE5PVEU6IGZ1dHVyZSBhZGRpdGlvbnMgY291bGQgYWxzbyBwZXJmb3JtIGNvbnRlbnQgYW5hbHlzaXMgdG8gZGV0ZXJtaW5lIGZvcm1hdC92ZXJzaW9uXG5jb25zdCB3b3Jrc3BhY2VGaWxlczogUmVjb3JkPHN0cmluZywgV29ya3NwYWNlRm9ybWF0PiA9IHtcbiAgJ2FuZ3VsYXIuanNvbic6IFdvcmtzcGFjZUZvcm1hdC5KU09OLFxuICAnLmFuZ3VsYXIuanNvbic6IFdvcmtzcGFjZUZvcm1hdC5KU09OLFxufTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRXb3Jrc3BhY2UoXG4gIHBhdGg6IHN0cmluZyxcbiAgaG9zdDogV29ya3NwYWNlSG9zdCxcbiAgZm9ybWF0PzogV29ya3NwYWNlRm9ybWF0LFxuKTogUHJvbWlzZTxXb3Jrc3BhY2VEZWZpbml0aW9uPiB7XG4gIGlmIChhd2FpdCBob3N0LmlzRGlyZWN0b3J5KHBhdGgpKSB7XG4gICAgLy8gVE9ETzogV2FybiBpZiBtdWx0aXBsZSBmb3VuZCAocmVxdWlyZXMgZGlhZ25vc3RpY3Mgc3VwcG9ydClcbiAgICBjb25zdCBkaXJlY3RvcnkgPSBub3JtYWxpemUocGF0aCk7XG4gICAgbGV0IGZvdW5kID0gZmFsc2U7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgbmFtZUZvcm1hdF0gb2YgT2JqZWN0LmVudHJpZXMod29ya3NwYWNlRmlsZXMpKSB7XG4gICAgICBpZiAoZm9ybWF0ICE9PSB1bmRlZmluZWQgJiYgZm9ybWF0ICE9PSBuYW1lRm9ybWF0KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwb3RlbnRpYWwgPSBnZXRTeXN0ZW1QYXRoKGpvaW4oZGlyZWN0b3J5LCBuYW1lKSk7XG4gICAgICBpZiAoYXdhaXQgaG9zdC5pc0ZpbGUocG90ZW50aWFsKSkge1xuICAgICAgICAvLyBURU1QIC0gcmVtb3ZlIGRpc2FibGUgd2hlbiBhY3R1YWwgcmVhZGVyIGlzIHVzZWRcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWRlYWQtc3RvcmVcbiAgICAgICAgcGF0aCA9IHBvdGVudGlhbDtcbiAgICAgICAgZm9ybWF0ID0gbmFtZUZvcm1hdDtcbiAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFmb3VuZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gbG9jYXRlIGEgd29ya3NwYWNlIGZpbGUgZm9yIHdvcmtzcGFjZSBwYXRoLicpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGZpbGVuYW1lID0gYmFzZW5hbWUobm9ybWFsaXplKHBhdGgpKTtcbiAgICBpZiAoZmlsZW5hbWUgaW4gd29ya3NwYWNlRmlsZXMpIHtcbiAgICAgIGZvcm1hdCA9IHdvcmtzcGFjZUZpbGVzW2ZpbGVuYW1lXTtcbiAgICB9XG4gIH1cblxuICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBkZXRlcm1pbmUgZm9ybWF0IGZvciB3b3Jrc3BhY2UgcGF0aC4nKTtcbiAgfVxuXG4gIGxldCB3b3Jrc3BhY2U7XG4gIHN3aXRjaCAoZm9ybWF0KSB7XG4gICAgY2FzZSBXb3Jrc3BhY2VGb3JtYXQuSlNPTjpcbiAgICAgIC8vIFRFTVA6IHJlbW92ZSB0aGUgZm9sbG93aW5nIHR3byBzdGF0ZW1lbnRzIHdoZW4gSlNPTiBzdXBwb3J0IGlzIGludHJvZHVjZWRcbiAgICAgIGF3YWl0IGhvc3QucmVhZEZpbGUocGF0aCk7XG4gICAgICB3b3Jrc3BhY2UgPSB7XG4gICAgICAgIGV4dGVuc2lvbnM6IHt9LFxuICAgICAgICBwcm9qZWN0czogbmV3IFByb2plY3REZWZpbml0aW9uQ29sbGVjdGlvbigpLFxuICAgICAgfTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIHdvcmtzcGFjZSBmb3JtYXQuJyk7XG4gIH1cblxuICBmb3JtYXRMb29rdXAuc2V0KHdvcmtzcGFjZSwgV29ya3NwYWNlRm9ybWF0LkpTT04pO1xuXG4gIHJldHVybiB3b3Jrc3BhY2U7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3cml0ZVdvcmtzcGFjZShcbiAgd29ya3NwYWNlOiBXb3Jrc3BhY2VEZWZpbml0aW9uLFxuICBfaG9zdDogV29ya3NwYWNlSG9zdCxcbiAgX3BhdGg/OiBzdHJpbmcsXG4gIGZvcm1hdD86IFdvcmtzcGFjZUZvcm1hdCxcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICBmb3JtYXQgPSBmb3JtYXRMb29rdXAuZ2V0KHdvcmtzcGFjZSk7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgZm9ybWF0IGlzIHJlcXVpcmVkIGZvciBjdXN0b20gd29ya3NwYWNlIG9iamVjdHMuJyk7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoIChmb3JtYXQpIHtcbiAgICBjYXNlIFdvcmtzcGFjZUZvcm1hdC5KU09OOlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgSW1wbGVtZW50ZWQuJyk7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgd29ya3NwYWNlIGZvcm1hdC4nKTtcbiAgfVxufVxuIl19