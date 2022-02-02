"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeWorkspace = exports.readWorkspace = exports.WorkspaceFormat = exports.createWorkspaceHost = void 0;
__exportStar(require("./definitions"), exports);
var host_1 = require("./host");
Object.defineProperty(exports, "createWorkspaceHost", { enumerable: true, get: function () { return host_1.createWorkspaceHost; } });
var core_1 = require("./core");
Object.defineProperty(exports, "WorkspaceFormat", { enumerable: true, get: function () { return core_1.WorkspaceFormat; } });
Object.defineProperty(exports, "readWorkspace", { enumerable: true, get: function () { return core_1.readWorkspace; } });
Object.defineProperty(exports, "writeWorkspace", { enumerable: true, get: function () { return core_1.writeWorkspace; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy93b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztBQUVILGdEQUE4QjtBQUM5QiwrQkFBNEQ7QUFBcEMsMkdBQUEsbUJBQW1CLE9BQUE7QUFDM0MsK0JBQXdFO0FBQS9ELHVHQUFBLGVBQWUsT0FBQTtBQUFFLHFHQUFBLGFBQWEsT0FBQTtBQUFFLHNHQUFBLGNBQWMsT0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5leHBvcnQgKiBmcm9tICcuL2RlZmluaXRpb25zJztcbmV4cG9ydCB7IFdvcmtzcGFjZUhvc3QsIGNyZWF0ZVdvcmtzcGFjZUhvc3QgfSBmcm9tICcuL2hvc3QnO1xuZXhwb3J0IHsgV29ya3NwYWNlRm9ybWF0LCByZWFkV29ya3NwYWNlLCB3cml0ZVdvcmtzcGFjZSB9IGZyb20gJy4vY29yZSc7XG4iXX0=