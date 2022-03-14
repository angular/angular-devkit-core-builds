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
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.strings = exports.tags = void 0;
const tags = __importStar(require("./literals"));
exports.tags = tags;
const strings = __importStar(require("./strings"));
exports.strings = strings;
__exportStar(require("./array"), exports);
__exportStar(require("./object"), exports);
__exportStar(require("./template"), exports);
__exportStar(require("./partially-ordered-set"), exports);
__exportStar(require("./priority-queue"), exports);
__exportStar(require("./lang"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy91dGlscy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQVUxQixvQkFBSTtBQVRiLG1EQUFxQztBQVN0QiwwQkFBTztBQVB0QiwwQ0FBd0I7QUFDeEIsMkNBQXlCO0FBQ3pCLDZDQUEyQjtBQUMzQiwwREFBd0M7QUFDeEMsbURBQWlDO0FBQ2pDLHlDQUF1QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0YWdzIGZyb20gJy4vbGl0ZXJhbHMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuL3N0cmluZ3MnO1xuXG5leHBvcnQgKiBmcm9tICcuL2FycmF5JztcbmV4cG9ydCAqIGZyb20gJy4vb2JqZWN0JztcbmV4cG9ydCAqIGZyb20gJy4vdGVtcGxhdGUnO1xuZXhwb3J0ICogZnJvbSAnLi9wYXJ0aWFsbHktb3JkZXJlZC1zZXQnO1xuZXhwb3J0ICogZnJvbSAnLi9wcmlvcml0eS1xdWV1ZSc7XG5leHBvcnQgKiBmcm9tICcuL2xhbmcnO1xuXG5leHBvcnQgeyB0YWdzLCBzdHJpbmdzIH07XG5cbmV4cG9ydCB0eXBlIERlZXBSZWFkb25seTxUPiA9IFQgZXh0ZW5kcyAoaW5mZXIgUilbXVxuICA/IERlZXBSZWFkb25seUFycmF5PFI+XG4gIDogVCBleHRlbmRzIEZ1bmN0aW9uXG4gID8gVFxuICA6IFQgZXh0ZW5kcyBvYmplY3RcbiAgPyBEZWVwUmVhZG9ubHlPYmplY3Q8VD5cbiAgOiBUO1xuXG4vLyBUaGlzIHNob3VsZCBiZSBSZWFkb25seUFycmF5IGJ1dCBpdCBoYXMgaW1wbGljYXRpb25zLlxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1lbXB0eS1pbnRlcmZhY2VcbmV4cG9ydCBpbnRlcmZhY2UgRGVlcFJlYWRvbmx5QXJyYXk8VD4gZXh0ZW5kcyBBcnJheTxEZWVwUmVhZG9ubHk8VD4+IHt9XG5cbmV4cG9ydCB0eXBlIERlZXBSZWFkb25seU9iamVjdDxUPiA9IHtcbiAgcmVhZG9ubHkgW1AgaW4ga2V5b2YgVF06IERlZXBSZWFkb25seTxUW1BdPjtcbn07XG5cbmV4cG9ydCB0eXBlIFJlYWR3cml0ZTxUPiA9IHtcbiAgLXJlYWRvbmx5IFtQIGluIGtleW9mIFRdOiBUW1BdO1xufTtcbiJdfQ==