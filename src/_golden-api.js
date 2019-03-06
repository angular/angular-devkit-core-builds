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
__export(require("./exception/exception"));
// Start experimental namespace
__export(require("./experimental/workspace/index"));
// End experimental namespace
// Start json namespace
__export(require("./json/interface"));
__export(require("./json/parser"));
__export(require("./json/schema/pointer"));
__export(require("./json/schema/registry"));
__export(require("./json/schema/visitor"));
__export(require("./json/schema/utility"));
__export(require("./json/schema/transforms"));
// End json namespace
// Start logging namespace
__export(require("./logger/indent"));
__export(require("./logger/level"));
__export(require("./logger/logger"));
__export(require("./logger/null-logger"));
__export(require("./logger/transform-logger"));
// End logging namespace
// Start terminal namespace
__export(require("./terminal/text"));
__export(require("./terminal/colors"));
// End terminal namespace
// Start utils namespace
__export(require("./utils/literals"));
__export(require("./utils/strings"));
__export(require("./utils/array"));
__export(require("./utils/object"));
__export(require("./utils/template"));
__export(require("./utils/partially-ordered-set"));
__export(require("./utils/priority-queue"));
__export(require("./utils/lang"));
// End utils namespace
// Start virtualFs namespace
__export(require("./virtual-fs/path"));
__export(require("./virtual-fs/host/index"));
// End virtualFs namespace
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX2dvbGRlbi1hcGkuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL19nb2xkZW4tYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7O0FBRUgsMkNBQXNDO0FBRXJDLCtCQUErQjtBQUNoQyxvREFBK0M7QUFDL0MsNkJBQTZCO0FBRTdCLHVCQUF1QjtBQUN2QixzQ0FBaUM7QUFDakMsbUNBQThCO0FBRTlCLDJDQUFzQztBQUN0Qyw0Q0FBdUM7QUFDdkMsMkNBQXNDO0FBQ3RDLDJDQUFzQztBQUN0Qyw4Q0FBeUM7QUFDekMscUJBQXFCO0FBRXJCLDBCQUEwQjtBQUMxQixxQ0FBZ0M7QUFDaEMsb0NBQStCO0FBQy9CLHFDQUFnQztBQUNoQywwQ0FBcUM7QUFDckMsK0NBQTBDO0FBQzFDLHdCQUF3QjtBQUV4QiwyQkFBMkI7QUFDM0IscUNBQWdDO0FBQ2hDLHVDQUFrQztBQUNsQyx5QkFBeUI7QUFFekIsd0JBQXdCO0FBQ3hCLHNDQUFpQztBQUNqQyxxQ0FBZ0M7QUFDaEMsbUNBQThCO0FBQzlCLG9DQUErQjtBQUMvQixzQ0FBaUM7QUFDakMsbURBQThDO0FBQzlDLDRDQUF1QztBQUN2QyxrQ0FBNkI7QUFDN0Isc0JBQXNCO0FBRXRCLDRCQUE0QjtBQUM1Qix1Q0FBa0M7QUFDbEMsNkNBQXdDO0FBQ3hDLDBCQUEwQiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0ICogZnJvbSAnLi9leGNlcHRpb24vZXhjZXB0aW9uJztcblxuIC8vIFN0YXJ0IGV4cGVyaW1lbnRhbCBuYW1lc3BhY2VcbmV4cG9ydCAqIGZyb20gJy4vZXhwZXJpbWVudGFsL3dvcmtzcGFjZS9pbmRleCc7XG4vLyBFbmQgZXhwZXJpbWVudGFsIG5hbWVzcGFjZVxuXG4vLyBTdGFydCBqc29uIG5hbWVzcGFjZVxuZXhwb3J0ICogZnJvbSAnLi9qc29uL2ludGVyZmFjZSc7XG5leHBvcnQgKiBmcm9tICcuL2pzb24vcGFyc2VyJztcbmV4cG9ydCAqIGZyb20gJy4vanNvbi9zY2hlbWEvaW50ZXJmYWNlJztcbmV4cG9ydCAqIGZyb20gJy4vanNvbi9zY2hlbWEvcG9pbnRlcic7XG5leHBvcnQgKiBmcm9tICcuL2pzb24vc2NoZW1hL3JlZ2lzdHJ5JztcbmV4cG9ydCAqIGZyb20gJy4vanNvbi9zY2hlbWEvdmlzaXRvcic7XG5leHBvcnQgKiBmcm9tICcuL2pzb24vc2NoZW1hL3V0aWxpdHknO1xuZXhwb3J0ICogZnJvbSAnLi9qc29uL3NjaGVtYS90cmFuc2Zvcm1zJztcbi8vIEVuZCBqc29uIG5hbWVzcGFjZVxuXG4vLyBTdGFydCBsb2dnaW5nIG5hbWVzcGFjZVxuZXhwb3J0ICogZnJvbSAnLi9sb2dnZXIvaW5kZW50JztcbmV4cG9ydCAqIGZyb20gJy4vbG9nZ2VyL2xldmVsJztcbmV4cG9ydCAqIGZyb20gJy4vbG9nZ2VyL2xvZ2dlcic7XG5leHBvcnQgKiBmcm9tICcuL2xvZ2dlci9udWxsLWxvZ2dlcic7XG5leHBvcnQgKiBmcm9tICcuL2xvZ2dlci90cmFuc2Zvcm0tbG9nZ2VyJztcbi8vIEVuZCBsb2dnaW5nIG5hbWVzcGFjZVxuXG4vLyBTdGFydCB0ZXJtaW5hbCBuYW1lc3BhY2VcbmV4cG9ydCAqIGZyb20gJy4vdGVybWluYWwvdGV4dCc7XG5leHBvcnQgKiBmcm9tICcuL3Rlcm1pbmFsL2NvbG9ycyc7XG4vLyBFbmQgdGVybWluYWwgbmFtZXNwYWNlXG5cbi8vIFN0YXJ0IHV0aWxzIG5hbWVzcGFjZVxuZXhwb3J0ICogZnJvbSAnLi91dGlscy9saXRlcmFscyc7XG5leHBvcnQgKiBmcm9tICcuL3V0aWxzL3N0cmluZ3MnO1xuZXhwb3J0ICogZnJvbSAnLi91dGlscy9hcnJheSc7XG5leHBvcnQgKiBmcm9tICcuL3V0aWxzL29iamVjdCc7XG5leHBvcnQgKiBmcm9tICcuL3V0aWxzL3RlbXBsYXRlJztcbmV4cG9ydCAqIGZyb20gJy4vdXRpbHMvcGFydGlhbGx5LW9yZGVyZWQtc2V0JztcbmV4cG9ydCAqIGZyb20gJy4vdXRpbHMvcHJpb3JpdHktcXVldWUnO1xuZXhwb3J0ICogZnJvbSAnLi91dGlscy9sYW5nJztcbi8vIEVuZCB1dGlscyBuYW1lc3BhY2VcblxuLy8gU3RhcnQgdmlydHVhbEZzIG5hbWVzcGFjZVxuZXhwb3J0ICogZnJvbSAnLi92aXJ0dWFsLWZzL3BhdGgnO1xuZXhwb3J0ICogZnJvbSAnLi92aXJ0dWFsLWZzL2hvc3QvaW5kZXgnO1xuLy8gRW5kIHZpcnR1YWxGcyBuYW1lc3BhY2VcbiJdfQ==