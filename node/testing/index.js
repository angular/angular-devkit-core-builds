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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TempScopedNodeJsSyncHost = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const src_1 = require("../../src");
const host_1 = require("../host");
/**
 * A Sync Scoped Host that creates a temporary directory and scope to it.
 */
class TempScopedNodeJsSyncHost extends src_1.virtualFs.ScopedHost {
    constructor() {
        const root = (0, src_1.normalize)(path.join(os.tmpdir(), `devkit-host-${+Date.now()}-${process.pid}`));
        fs.mkdirSync((0, src_1.getSystemPath)(root));
        super(new host_1.NodeJsSyncHost(), root);
        this._root = root;
    }
    get files() {
        const sync = this.sync;
        function _visit(p) {
            return sync
                .list(p)
                .map((fragment) => (0, src_1.join)(p, fragment))
                .reduce((files, path) => {
                if (sync.isDirectory(path)) {
                    return files.concat(_visit(path));
                }
                else {
                    return files.concat(path);
                }
            }, []);
        }
        return _visit((0, src_1.normalize)('/'));
    }
    get root() {
        return this._root;
    }
    get sync() {
        if (!this._sync) {
            this._sync = new src_1.virtualFs.SyncDelegateHost(this);
        }
        return this._sync;
    }
}
exports.TempScopedNodeJsSyncHost = TempScopedNodeJsSyncHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL25vZGUvdGVzdGluZy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHVDQUF5QjtBQUN6Qix1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLG1DQUEwRjtBQUMxRixrQ0FBeUM7QUFFekM7O0dBRUc7QUFDSCxNQUFhLHdCQUF5QixTQUFRLGVBQVMsQ0FBQyxVQUFvQjtJQUkxRTtRQUNFLE1BQU0sSUFBSSxHQUFHLElBQUEsZUFBUyxFQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RixFQUFFLENBQUMsU0FBUyxDQUFDLElBQUEsbUJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRWxDLEtBQUssQ0FBQyxJQUFJLHFCQUFjLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztJQUNwQixDQUFDO0lBRUQsSUFBSSxLQUFLO1FBQ1AsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUN2QixTQUFTLE1BQU0sQ0FBQyxDQUFPO1lBQ3JCLE9BQU8sSUFBSTtpQkFDUixJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUNQLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsSUFBQSxVQUFJLEVBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUNwQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ3RCLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDMUIsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUNuQztxQkFBTTtvQkFDTCxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQzNCO1lBQ0gsQ0FBQyxFQUFFLEVBQVksQ0FBQyxDQUFDO1FBQ3JCLENBQUM7UUFFRCxPQUFPLE1BQU0sQ0FBQyxJQUFBLGVBQVMsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUFJLElBQUk7UUFDTixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDcEIsQ0FBQztJQUNELElBQUksSUFBSTtRQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2YsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLGVBQVMsQ0FBQyxnQkFBZ0IsQ0FBVyxJQUFJLENBQUMsQ0FBQztTQUM3RDtRQUVELE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0NBQ0Y7QUF4Q0QsNERBd0NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBQYXRoLCBQYXRoRnJhZ21lbnQsIGdldFN5c3RlbVBhdGgsIGpvaW4sIG5vcm1hbGl6ZSwgdmlydHVhbEZzIH0gZnJvbSAnLi4vLi4vc3JjJztcbmltcG9ydCB7IE5vZGVKc1N5bmNIb3N0IH0gZnJvbSAnLi4vaG9zdCc7XG5cbi8qKlxuICogQSBTeW5jIFNjb3BlZCBIb3N0IHRoYXQgY3JlYXRlcyBhIHRlbXBvcmFyeSBkaXJlY3RvcnkgYW5kIHNjb3BlIHRvIGl0LlxuICovXG5leHBvcnQgY2xhc3MgVGVtcFNjb3BlZE5vZGVKc1N5bmNIb3N0IGV4dGVuZHMgdmlydHVhbEZzLlNjb3BlZEhvc3Q8ZnMuU3RhdHM+IHtcbiAgcHJvdGVjdGVkIF9zeW5jPzogdmlydHVhbEZzLlN5bmNEZWxlZ2F0ZUhvc3Q8ZnMuU3RhdHM+O1xuICBwcm90ZWN0ZWQgb3ZlcnJpZGUgX3Jvb3Q6IFBhdGg7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgY29uc3Qgcm9vdCA9IG5vcm1hbGl6ZShwYXRoLmpvaW4ob3MudG1wZGlyKCksIGBkZXZraXQtaG9zdC0keytEYXRlLm5vdygpfS0ke3Byb2Nlc3MucGlkfWApKTtcbiAgICBmcy5ta2RpclN5bmMoZ2V0U3lzdGVtUGF0aChyb290KSk7XG5cbiAgICBzdXBlcihuZXcgTm9kZUpzU3luY0hvc3QoKSwgcm9vdCk7XG4gICAgdGhpcy5fcm9vdCA9IHJvb3Q7XG4gIH1cblxuICBnZXQgZmlsZXMoKTogUGF0aFtdIHtcbiAgICBjb25zdCBzeW5jID0gdGhpcy5zeW5jO1xuICAgIGZ1bmN0aW9uIF92aXNpdChwOiBQYXRoKTogUGF0aFtdIHtcbiAgICAgIHJldHVybiBzeW5jXG4gICAgICAgIC5saXN0KHApXG4gICAgICAgIC5tYXAoKGZyYWdtZW50KSA9PiBqb2luKHAsIGZyYWdtZW50KSlcbiAgICAgICAgLnJlZHVjZSgoZmlsZXMsIHBhdGgpID0+IHtcbiAgICAgICAgICBpZiAoc3luYy5pc0RpcmVjdG9yeShwYXRoKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZpbGVzLmNvbmNhdChfdmlzaXQocGF0aCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsZXMuY29uY2F0KHBhdGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgW10gYXMgUGF0aFtdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gX3Zpc2l0KG5vcm1hbGl6ZSgnLycpKTtcbiAgfVxuXG4gIGdldCByb290KCkge1xuICAgIHJldHVybiB0aGlzLl9yb290O1xuICB9XG4gIGdldCBzeW5jKCkge1xuICAgIGlmICghdGhpcy5fc3luYykge1xuICAgICAgdGhpcy5fc3luYyA9IG5ldyB2aXJ0dWFsRnMuU3luY0RlbGVnYXRlSG9zdDxmcy5TdGF0cz4odGhpcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX3N5bmM7XG4gIH1cbn1cbiJdfQ==