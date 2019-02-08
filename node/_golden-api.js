"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
// Start experimental namespace
// Start jobs namespace
__export(require("./experimental/jobs/job-registry"));
// End jobs namespace
// End experimental namespace
__export(require("./fs"));
__export(require("./cli-logger"));
__export(require("./host"));
var resolve_1 = require("./resolve");
exports.ModuleNotFoundException = resolve_1.ModuleNotFoundException;
exports.resolve = resolve_1.resolve;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX2dvbGRlbi1hcGkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvbm9kZS9fZ29sZGVuLWFwaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7OztBQUVILCtCQUErQjtBQUMvQix1QkFBdUI7QUFDdkIsc0RBQWlEO0FBQ2pELHFCQUFxQjtBQUNyQiw2QkFBNkI7QUFFN0IsMEJBQXFCO0FBQ3JCLGtDQUE2QjtBQUM3Qiw0QkFBdUI7QUFDdkIscUNBQTZFO0FBQXBFLDRDQUFBLHVCQUF1QixDQUFBO0FBQWtCLDRCQUFBLE9BQU8sQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8gU3RhcnQgZXhwZXJpbWVudGFsIG5hbWVzcGFjZVxuLy8gU3RhcnQgam9icyBuYW1lc3BhY2VcbmV4cG9ydCAqIGZyb20gJy4vZXhwZXJpbWVudGFsL2pvYnMvam9iLXJlZ2lzdHJ5Jztcbi8vIEVuZCBqb2JzIG5hbWVzcGFjZVxuLy8gRW5kIGV4cGVyaW1lbnRhbCBuYW1lc3BhY2VcblxuZXhwb3J0ICogZnJvbSAnLi9mcyc7XG5leHBvcnQgKiBmcm9tICcuL2NsaS1sb2dnZXInO1xuZXhwb3J0ICogZnJvbSAnLi9ob3N0JztcbmV4cG9ydCB7IE1vZHVsZU5vdEZvdW5kRXhjZXB0aW9uLCBSZXNvbHZlT3B0aW9ucywgcmVzb2x2ZSB9IGZyb20gJy4vcmVzb2x2ZSc7XG4iXX0=