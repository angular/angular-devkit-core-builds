"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Empty = void 0;
const rxjs_1 = require("rxjs");
const exception_1 = require("../../exception");
class Empty {
    capabilities = {
        synchronous: true,
    };
    read(path) {
        return (0, rxjs_1.throwError)(new exception_1.FileDoesNotExistException(path));
    }
    list(path) {
        return (0, rxjs_1.of)([]);
    }
    exists(path) {
        return (0, rxjs_1.of)(false);
    }
    isDirectory(path) {
        return (0, rxjs_1.of)(false);
    }
    isFile(path) {
        return (0, rxjs_1.of)(false);
    }
    stat(path) {
        // We support stat() but have no file.
        return (0, rxjs_1.of)(null);
    }
}
exports.Empty = Empty;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1wdHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy92aXJ0dWFsLWZzL2hvc3QvZW1wdHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsK0JBQWtEO0FBQ2xELCtDQUE0RDtBQUk1RCxNQUFhLEtBQUs7SUFDUCxZQUFZLEdBQXFCO1FBQ3hDLFdBQVcsRUFBRSxJQUFJO0tBQ2xCLENBQUM7SUFFRixJQUFJLENBQUMsSUFBVTtRQUNiLE9BQU8sSUFBQSxpQkFBVSxFQUFDLElBQUkscUNBQXlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVU7UUFDYixPQUFPLElBQUEsU0FBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2hCLENBQUM7SUFFRCxNQUFNLENBQUMsSUFBVTtRQUNmLE9BQU8sSUFBQSxTQUFFLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUFVO1FBQ3BCLE9BQU8sSUFBQSxTQUFFLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQUVELE1BQU0sQ0FBQyxJQUFVO1FBQ2YsT0FBTyxJQUFBLFNBQUUsRUFBQyxLQUFLLENBQUMsQ0FBQztJQUNuQixDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVU7UUFDYixzQ0FBc0M7UUFDdEMsT0FBTyxJQUFBLFNBQUUsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUNsQixDQUFDO0NBQ0Y7QUE3QkQsc0JBNkJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IE9ic2VydmFibGUsIG9mLCB0aHJvd0Vycm9yIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBGaWxlRG9lc05vdEV4aXN0RXhjZXB0aW9uIH0gZnJvbSAnLi4vLi4vZXhjZXB0aW9uJztcbmltcG9ydCB7IFBhdGgsIFBhdGhGcmFnbWVudCB9IGZyb20gJy4uL3BhdGgnO1xuaW1wb3J0IHsgRmlsZUJ1ZmZlciwgSG9zdENhcGFiaWxpdGllcywgUmVhZG9ubHlIb3N0LCBTdGF0cyB9IGZyb20gJy4vaW50ZXJmYWNlJztcblxuZXhwb3J0IGNsYXNzIEVtcHR5IGltcGxlbWVudHMgUmVhZG9ubHlIb3N0IHtcbiAgcmVhZG9ubHkgY2FwYWJpbGl0aWVzOiBIb3N0Q2FwYWJpbGl0aWVzID0ge1xuICAgIHN5bmNocm9ub3VzOiB0cnVlLFxuICB9O1xuXG4gIHJlYWQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8RmlsZUJ1ZmZlcj4ge1xuICAgIHJldHVybiB0aHJvd0Vycm9yKG5ldyBGaWxlRG9lc05vdEV4aXN0RXhjZXB0aW9uKHBhdGgpKTtcbiAgfVxuXG4gIGxpc3QocGF0aDogUGF0aCk6IE9ic2VydmFibGU8UGF0aEZyYWdtZW50W10+IHtcbiAgICByZXR1cm4gb2YoW10pO1xuICB9XG5cbiAgZXhpc3RzKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gb2YoZmFsc2UpO1xuICB9XG5cbiAgaXNEaXJlY3RvcnkocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiBvZihmYWxzZSk7XG4gIH1cblxuICBpc0ZpbGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiBvZihmYWxzZSk7XG4gIH1cblxuICBzdGF0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPFN0YXRzPHt9PiB8IG51bGw+IHtcbiAgICAvLyBXZSBzdXBwb3J0IHN0YXQoKSBidXQgaGF2ZSBubyBmaWxlLlxuICAgIHJldHVybiBvZihudWxsKTtcbiAgfVxufVxuIl19