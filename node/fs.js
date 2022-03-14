"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDirectory = exports.isFile = void 0;
const fs_1 = require("fs");
/** @deprecated Since v11.0, unused by the Angular tooling */
function isFile(filePath) {
    let stat;
    try {
        stat = (0, fs_1.statSync)(filePath);
    }
    catch (e) {
        if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
            return false;
        }
        throw e;
    }
    return stat.isFile() || stat.isFIFO();
}
exports.isFile = isFile;
/** @deprecated Since v11.0, unused by the Angular tooling */
function isDirectory(filePath) {
    let stat;
    try {
        stat = (0, fs_1.statSync)(filePath);
    }
    catch (e) {
        if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
            return false;
        }
        throw e;
    }
    return stat.isDirectory();
}
exports.isDirectory = isDirectory;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL25vZGUvZnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsMkJBQThCO0FBRTlCLDZEQUE2RDtBQUM3RCxTQUFnQixNQUFNLENBQUMsUUFBZ0I7SUFDckMsSUFBSSxJQUFJLENBQUM7SUFDVCxJQUFJO1FBQ0YsSUFBSSxHQUFHLElBQUEsYUFBUSxFQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQzNCO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLEVBQUU7WUFDdEQsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUNELE1BQU0sQ0FBQyxDQUFDO0tBQ1Q7SUFFRCxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDeEMsQ0FBQztBQVpELHdCQVlDO0FBRUQsNkRBQTZEO0FBQzdELFNBQWdCLFdBQVcsQ0FBQyxRQUFnQjtJQUMxQyxJQUFJLElBQUksQ0FBQztJQUNULElBQUk7UUFDRixJQUFJLEdBQUcsSUFBQSxhQUFRLEVBQUMsUUFBUSxDQUFDLENBQUM7S0FDM0I7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsRUFBRTtZQUN0RCxPQUFPLEtBQUssQ0FBQztTQUNkO1FBQ0QsTUFBTSxDQUFDLENBQUM7S0FDVDtJQUVELE9BQU8sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQzVCLENBQUM7QUFaRCxrQ0FZQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBzdGF0U3luYyB9IGZyb20gJ2ZzJztcblxuLyoqIEBkZXByZWNhdGVkIFNpbmNlIHYxMS4wLCB1bnVzZWQgYnkgdGhlIEFuZ3VsYXIgdG9vbGluZyAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRmlsZShmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGxldCBzdGF0O1xuICB0cnkge1xuICAgIHN0YXQgPSBzdGF0U3luYyhmaWxlUGF0aCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSAmJiAoZS5jb2RlID09PSAnRU5PRU5UJyB8fCBlLmNvZGUgPT09ICdFTk9URElSJykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIHJldHVybiBzdGF0LmlzRmlsZSgpIHx8IHN0YXQuaXNGSUZPKCk7XG59XG5cbi8qKiBAZGVwcmVjYXRlZCBTaW5jZSB2MTEuMCwgdW51c2VkIGJ5IHRoZSBBbmd1bGFyIHRvb2xpbmcgKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0RpcmVjdG9yeShmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGxldCBzdGF0O1xuICB0cnkge1xuICAgIHN0YXQgPSBzdGF0U3luYyhmaWxlUGF0aCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSAmJiAoZS5jb2RlID09PSAnRU5PRU5UJyB8fCBlLmNvZGUgPT09ICdFTk9URElSJykpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIHJldHVybiBzdGF0LmlzRGlyZWN0b3J5KCk7XG59XG4iXX0=