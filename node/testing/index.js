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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL25vZGUvdGVzdGluZy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXlCO0FBQ3pCLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsbUNBQTBGO0FBQzFGLGtDQUF5QztBQUV6Qzs7R0FFRztBQUNILE1BQWEsd0JBQXlCLFNBQVEsZUFBUyxDQUFDLFVBQW9CO0lBSTFFO1FBQ0UsTUFBTSxJQUFJLEdBQUcsSUFBQSxlQUFTLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVGLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBQSxtQkFBYSxFQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFbEMsS0FBSyxDQUFDLElBQUkscUJBQWMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxJQUFJLEtBQUs7UUFDUCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3ZCLFNBQVMsTUFBTSxDQUFDLENBQU87WUFDckIsT0FBTyxJQUFJO2lCQUNSLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQ1AsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxJQUFBLFVBQUksRUFBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7aUJBQ3BDLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtnQkFDdEIsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUMxQixPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQ25DO3FCQUFNO29CQUNMLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDM0I7WUFDSCxDQUFDLEVBQUUsRUFBWSxDQUFDLENBQUM7UUFDckIsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDLElBQUEsZUFBUyxFQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVELElBQUksSUFBSTtRQUNOLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBQ0QsSUFBSSxJQUFJO1FBQ04sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksZUFBUyxDQUFDLGdCQUFnQixDQUFXLElBQUksQ0FBQyxDQUFDO1NBQzdEO1FBRUQsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3BCLENBQUM7Q0FDRjtBQXhDRCw0REF3Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgb3MgZnJvbSAnb3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFBhdGgsIFBhdGhGcmFnbWVudCwgZ2V0U3lzdGVtUGF0aCwgam9pbiwgbm9ybWFsaXplLCB2aXJ0dWFsRnMgfSBmcm9tICcuLi8uLi9zcmMnO1xuaW1wb3J0IHsgTm9kZUpzU3luY0hvc3QgfSBmcm9tICcuLi9ob3N0JztcblxuLyoqXG4gKiBBIFN5bmMgU2NvcGVkIEhvc3QgdGhhdCBjcmVhdGVzIGEgdGVtcG9yYXJ5IGRpcmVjdG9yeSBhbmQgc2NvcGUgdG8gaXQuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZW1wU2NvcGVkTm9kZUpzU3luY0hvc3QgZXh0ZW5kcyB2aXJ0dWFsRnMuU2NvcGVkSG9zdDxmcy5TdGF0cz4ge1xuICBwcm90ZWN0ZWQgX3N5bmM/OiB2aXJ0dWFsRnMuU3luY0RlbGVnYXRlSG9zdDxmcy5TdGF0cz47XG4gIHByb3RlY3RlZCBvdmVycmlkZSBfcm9vdDogUGF0aDtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBjb25zdCByb290ID0gbm9ybWFsaXplKHBhdGguam9pbihvcy50bXBkaXIoKSwgYGRldmtpdC1ob3N0LSR7K0RhdGUubm93KCl9LSR7cHJvY2Vzcy5waWR9YCkpO1xuICAgIGZzLm1rZGlyU3luYyhnZXRTeXN0ZW1QYXRoKHJvb3QpKTtcblxuICAgIHN1cGVyKG5ldyBOb2RlSnNTeW5jSG9zdCgpLCByb290KTtcbiAgICB0aGlzLl9yb290ID0gcm9vdDtcbiAgfVxuXG4gIGdldCBmaWxlcygpOiBQYXRoW10ge1xuICAgIGNvbnN0IHN5bmMgPSB0aGlzLnN5bmM7XG4gICAgZnVuY3Rpb24gX3Zpc2l0KHA6IFBhdGgpOiBQYXRoW10ge1xuICAgICAgcmV0dXJuIHN5bmNcbiAgICAgICAgLmxpc3QocClcbiAgICAgICAgLm1hcCgoZnJhZ21lbnQpID0+IGpvaW4ocCwgZnJhZ21lbnQpKVxuICAgICAgICAucmVkdWNlKChmaWxlcywgcGF0aCkgPT4ge1xuICAgICAgICAgIGlmIChzeW5jLmlzRGlyZWN0b3J5KHBhdGgpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsZXMuY29uY2F0KF92aXNpdChwYXRoKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmaWxlcy5jb25jYXQocGF0aCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCBbXSBhcyBQYXRoW10pO1xuICAgIH1cblxuICAgIHJldHVybiBfdmlzaXQobm9ybWFsaXplKCcvJykpO1xuICB9XG5cbiAgZ2V0IHJvb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jvb3Q7XG4gIH1cbiAgZ2V0IHN5bmMoKSB7XG4gICAgaWYgKCF0aGlzLl9zeW5jKSB7XG4gICAgICB0aGlzLl9zeW5jID0gbmV3IHZpcnR1YWxGcy5TeW5jRGVsZWdhdGVIb3N0PGZzLlN0YXRzPih0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fc3luYztcbiAgfVxufVxuIl19