"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
__export(require("./definitions"));
var host_1 = require("./host");
exports.createWorkspaceHost = host_1.createWorkspaceHost;
var core_1 = require("./core");
exports.WorkspaceFormat = core_1.WorkspaceFormat;
exports.readWorkspace = core_1.readWorkspace;
exports.writeWorkspace = core_1.writeWorkspace;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL3dvcmtzcGFjZS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBOzs7Ozs7R0FNRztBQUNILG1DQUE4QjtBQUM5QiwrQkFBNEQ7QUFBcEMscUNBQUEsbUJBQW1CLENBQUE7QUFDM0MsK0JBQXdFO0FBQS9ELGlDQUFBLGVBQWUsQ0FBQTtBQUFFLCtCQUFBLGFBQWEsQ0FBQTtBQUFFLGdDQUFBLGNBQWMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmV4cG9ydCAqIGZyb20gJy4vZGVmaW5pdGlvbnMnO1xuZXhwb3J0IHsgV29ya3NwYWNlSG9zdCwgY3JlYXRlV29ya3NwYWNlSG9zdCB9IGZyb20gJy4vaG9zdCc7XG5leHBvcnQgeyBXb3Jrc3BhY2VGb3JtYXQsIHJlYWRXb3Jrc3BhY2UsIHdyaXRlV29ya3NwYWNlIH0gZnJvbSAnLi9jb3JlJztcbiJdfQ==