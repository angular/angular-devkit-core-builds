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
exports.NodeJsSyncHost = exports.NodeJsAsyncHost = void 0;
const fs_1 = __importStar(require("fs"));
const path_1 = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const src_1 = require("../src");
async function exists(path) {
    try {
        await fs_1.promises.access(path, fs_1.constants.F_OK);
        return true;
    }
    catch (_a) {
        return false;
    }
}
// This will only be initialized if the watch() method is called.
// Otherwise chokidar appears only in type positions, and shouldn't be referenced
// in the JavaScript output.
let FSWatcher;
function loadFSWatcher() {
    if (!FSWatcher) {
        try {
            // eslint-disable-next-line import/no-extraneous-dependencies
            FSWatcher = require('chokidar').FSWatcher;
        }
        catch (e) {
            if (e.code !== 'MODULE_NOT_FOUND') {
                throw new Error('As of angular-devkit version 8.0, the "chokidar" package ' +
                    'must be installed in order to use watch() features.');
            }
            throw e;
        }
    }
}
/**
 * An implementation of the Virtual FS using Node as the background. There are two versions; one
 * synchronous and one asynchronous.
 */
class NodeJsAsyncHost {
    get capabilities() {
        return { synchronous: false };
    }
    write(path, content) {
        return (0, rxjs_1.from)(fs_1.promises.mkdir((0, src_1.getSystemPath)((0, src_1.dirname)(path)), { recursive: true })).pipe((0, operators_1.mergeMap)(() => fs_1.promises.writeFile((0, src_1.getSystemPath)(path), new Uint8Array(content))));
    }
    read(path) {
        return (0, rxjs_1.from)(fs_1.promises.readFile((0, src_1.getSystemPath)(path))).pipe((0, operators_1.map)((buffer) => new Uint8Array(buffer).buffer));
    }
    delete(path) {
        return (0, rxjs_1.from)(fs_1.promises.rm((0, src_1.getSystemPath)(path), { force: true, recursive: true, maxRetries: 3 }));
    }
    rename(from, to) {
        return (0, rxjs_1.from)(fs_1.promises.rename((0, src_1.getSystemPath)(from), (0, src_1.getSystemPath)(to)));
    }
    list(path) {
        return (0, rxjs_1.from)(fs_1.promises.readdir((0, src_1.getSystemPath)(path))).pipe((0, operators_1.map)((names) => names.map((name) => (0, src_1.fragment)(name))));
    }
    exists(path) {
        return (0, rxjs_1.from)(exists((0, src_1.getSystemPath)(path)));
    }
    isDirectory(path) {
        return this.stat(path).pipe((0, operators_1.map)((stat) => stat.isDirectory()));
    }
    isFile(path) {
        return this.stat(path).pipe((0, operators_1.map)((stat) => stat.isFile()));
    }
    // Some hosts may not support stat.
    stat(path) {
        return (0, rxjs_1.from)(fs_1.promises.stat((0, src_1.getSystemPath)(path)));
    }
    // Some hosts may not support watching.
    watch(path, _options) {
        return new rxjs_1.Observable((obs) => {
            loadFSWatcher();
            const watcher = new FSWatcher({ persistent: true });
            watcher.add((0, src_1.getSystemPath)(path));
            watcher
                .on('change', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 0 /* Changed */,
                });
            })
                .on('add', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 1 /* Created */,
                });
            })
                .on('unlink', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 2 /* Deleted */,
                });
            });
            return () => watcher.close();
        }).pipe((0, operators_1.publish)(), (0, operators_1.refCount)());
    }
}
exports.NodeJsAsyncHost = NodeJsAsyncHost;
/**
 * An implementation of the Virtual FS using Node as the backend, synchronously.
 */
class NodeJsSyncHost {
    get capabilities() {
        return { synchronous: true };
    }
    write(path, content) {
        return new rxjs_1.Observable((obs) => {
            (0, fs_1.mkdirSync)((0, src_1.getSystemPath)((0, src_1.dirname)(path)), { recursive: true });
            (0, fs_1.writeFileSync)((0, src_1.getSystemPath)(path), new Uint8Array(content));
            obs.next();
            obs.complete();
        });
    }
    read(path) {
        return new rxjs_1.Observable((obs) => {
            const buffer = (0, fs_1.readFileSync)((0, src_1.getSystemPath)(path));
            obs.next(new Uint8Array(buffer).buffer);
            obs.complete();
        });
    }
    delete(path) {
        return new rxjs_1.Observable((obs) => {
            fs_1.default.rmSync((0, src_1.getSystemPath)(path), { force: true, recursive: true, maxRetries: 3 });
            obs.complete();
        });
    }
    rename(from, to) {
        return new rxjs_1.Observable((obs) => {
            const toSystemPath = (0, src_1.getSystemPath)(to);
            (0, fs_1.mkdirSync)((0, path_1.dirname)(toSystemPath), { recursive: true });
            (0, fs_1.renameSync)((0, src_1.getSystemPath)(from), toSystemPath);
            obs.next();
            obs.complete();
        });
    }
    list(path) {
        return new rxjs_1.Observable((obs) => {
            const names = (0, fs_1.readdirSync)((0, src_1.getSystemPath)(path));
            obs.next(names.map((name) => (0, src_1.fragment)(name)));
            obs.complete();
        });
    }
    exists(path) {
        return new rxjs_1.Observable((obs) => {
            obs.next((0, fs_1.existsSync)((0, src_1.getSystemPath)(path)));
            obs.complete();
        });
    }
    isDirectory(path) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.stat(path).pipe((0, operators_1.map)((stat) => stat.isDirectory()));
    }
    isFile(path) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.stat(path).pipe((0, operators_1.map)((stat) => stat.isFile()));
    }
    // Some hosts may not support stat.
    stat(path) {
        return new rxjs_1.Observable((obs) => {
            obs.next((0, fs_1.statSync)((0, src_1.getSystemPath)(path)));
            obs.complete();
        });
    }
    // Some hosts may not support watching.
    watch(path, _options) {
        return new rxjs_1.Observable((obs) => {
            loadFSWatcher();
            const watcher = new FSWatcher({ persistent: false });
            watcher.add((0, src_1.getSystemPath)(path));
            watcher
                .on('change', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 0 /* Changed */,
                });
            })
                .on('add', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 1 /* Created */,
                });
            })
                .on('unlink', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 2 /* Deleted */,
                });
            });
            return () => watcher.close();
        }).pipe((0, operators_1.publish)(), (0, operators_1.refCount)());
    }
}
exports.NodeJsSyncHost = NodeJsSyncHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvbm9kZS9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFHSCx5Q0FZWTtBQUNaLCtCQUE4QztBQUM5QywrQkFBMEQ7QUFDMUQsOENBQWtFO0FBQ2xFLGdDQUFvRztBQUVwRyxLQUFLLFVBQVUsTUFBTSxDQUFDLElBQWM7SUFDbEMsSUFBSTtRQUNGLE1BQU0sYUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsY0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRTlDLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFBQyxXQUFNO1FBQ04sT0FBTyxLQUFLLENBQUM7S0FDZDtBQUNILENBQUM7QUFFRCxpRUFBaUU7QUFDakUsaUZBQWlGO0FBQ2pGLDRCQUE0QjtBQUM1QixJQUFJLFNBQWlDLENBQUM7QUFDdEMsU0FBUyxhQUFhO0lBQ3BCLElBQUksQ0FBQyxTQUFTLEVBQUU7UUFDZCxJQUFJO1lBQ0YsNkRBQTZEO1lBQzdELFNBQVMsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFDO1NBQzNDO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssa0JBQWtCLEVBQUU7Z0JBQ2pDLE1BQU0sSUFBSSxLQUFLLENBQ2IsMkRBQTJEO29CQUN6RCxxREFBcUQsQ0FDeEQsQ0FBQzthQUNIO1lBQ0QsTUFBTSxDQUFDLENBQUM7U0FDVDtLQUNGO0FBQ0gsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQWEsZUFBZTtJQUMxQixJQUFJLFlBQVk7UUFDZCxPQUFPLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxLQUFLLENBQUMsSUFBVSxFQUFFLE9BQTZCO1FBQzdD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RSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNyQixHQUFHLENBQUMsSUFBSSxDQUFDO29CQUNQLElBQUksRUFBRSxJQUFBLGVBQVMsRUFBQyxJQUFJLENBQUM7b0JBQ3JCLElBQUksRUFBRSxJQUFJLElBQUksRUFBRTtvQkFDaEIsSUFBSSxpQkFBc0M7aUJBQzNDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQztpQkFDRCxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ2xCLEdBQUcsQ0FBQyxJQUFJLENBQUM7b0JBQ1AsSUFBSSxFQUFFLElBQUEsZUFBUyxFQUFDLElBQUksQ0FBQztvQkFDckIsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFO29CQUNoQixJQUFJLGlCQUFzQztpQkFDM0MsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDO2lCQUNELEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDckIsR0FBRyxDQUFDLElBQUksQ0FBQztvQkFDUCxJQUFJLEVBQUUsSUFBQSxlQUFTLEVBQUMsSUFBSSxDQUFDO29CQUNyQixJQUFJLEVBQUUsSUFBSSxJQUFJLEVBQUU7b0JBQ2hCLElBQUksaUJBQXNDO2lCQUMzQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztZQUVMLE9BQU8sR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFBLG1CQUFPLEdBQUUsRUFBRSxJQUFBLG9CQUFRLEdBQUUsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7Q0FDRjtBQTlHRCx3Q0E4R0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBGU1dhdGNoZXIgYXMgQ2hva2lkYXJXYXRjaGVyIH0gZnJvbSAnY2hva2lkYXInO1xuaW1wb3J0IGZzLCB7XG4gIFBhdGhMaWtlLFxuICBTdGF0cyxcbiAgY29uc3RhbnRzLFxuICBleGlzdHNTeW5jLFxuICBwcm9taXNlcyBhcyBmc1Byb21pc2VzLFxuICBta2RpclN5bmMsXG4gIHJlYWRGaWxlU3luYyxcbiAgcmVhZGRpclN5bmMsXG4gIHJlbmFtZVN5bmMsXG4gIHN0YXRTeW5jLFxuICB3cml0ZUZpbGVTeW5jLFxufSBmcm9tICdmcyc7XG5pbXBvcnQgeyBkaXJuYW1lIGFzIHBhdGhEaXJuYW1lIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIGFzIG9ic2VydmFibGVGcm9tIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBtYXAsIG1lcmdlTWFwLCBwdWJsaXNoLCByZWZDb3VudCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IFBhdGgsIFBhdGhGcmFnbWVudCwgZGlybmFtZSwgZnJhZ21lbnQsIGdldFN5c3RlbVBhdGgsIG5vcm1hbGl6ZSwgdmlydHVhbEZzIH0gZnJvbSAnLi4vc3JjJztcblxuYXN5bmMgZnVuY3Rpb24gZXhpc3RzKHBhdGg6IFBhdGhMaWtlKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZnNQcm9taXNlcy5hY2Nlc3MocGF0aCwgY29uc3RhbnRzLkZfT0spO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG4vLyBUaGlzIHdpbGwgb25seSBiZSBpbml0aWFsaXplZCBpZiB0aGUgd2F0Y2goKSBtZXRob2QgaXMgY2FsbGVkLlxuLy8gT3RoZXJ3aXNlIGNob2tpZGFyIGFwcGVhcnMgb25seSBpbiB0eXBlIHBvc2l0aW9ucywgYW5kIHNob3VsZG4ndCBiZSByZWZlcmVuY2VkXG4vLyBpbiB0aGUgSmF2YVNjcmlwdCBvdXRwdXQuXG5sZXQgRlNXYXRjaGVyOiB0eXBlb2YgQ2hva2lkYXJXYXRjaGVyO1xuZnVuY3Rpb24gbG9hZEZTV2F0Y2hlcigpIHtcbiAgaWYgKCFGU1dhdGNoZXIpIHtcbiAgICB0cnkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llc1xuICAgICAgRlNXYXRjaGVyID0gcmVxdWlyZSgnY2hva2lkYXInKS5GU1dhdGNoZXI7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUuY29kZSAhPT0gJ01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnQXMgb2YgYW5ndWxhci1kZXZraXQgdmVyc2lvbiA4LjAsIHRoZSBcImNob2tpZGFyXCIgcGFja2FnZSAnICtcbiAgICAgICAgICAgICdtdXN0IGJlIGluc3RhbGxlZCBpbiBvcmRlciB0byB1c2Ugd2F0Y2goKSBmZWF0dXJlcy4nLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgVmlydHVhbCBGUyB1c2luZyBOb2RlIGFzIHRoZSBiYWNrZ3JvdW5kLiBUaGVyZSBhcmUgdHdvIHZlcnNpb25zOyBvbmVcbiAqIHN5bmNocm9ub3VzIGFuZCBvbmUgYXN5bmNocm9ub3VzLlxuICovXG5leHBvcnQgY2xhc3MgTm9kZUpzQXN5bmNIb3N0IGltcGxlbWVudHMgdmlydHVhbEZzLkhvc3Q8U3RhdHM+IHtcbiAgZ2V0IGNhcGFiaWxpdGllcygpOiB2aXJ0dWFsRnMuSG9zdENhcGFiaWxpdGllcyB7XG4gICAgcmV0dXJuIHsgc3luY2hyb25vdXM6IGZhbHNlIH07XG4gIH1cblxuICB3cml0ZShwYXRoOiBQYXRoLCBjb250ZW50OiB2aXJ0dWFsRnMuRmlsZUJ1ZmZlcik6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlRnJvbShmc1Byb21pc2VzLm1rZGlyKGdldFN5c3RlbVBhdGgoZGlybmFtZShwYXRoKSksIHsgcmVjdXJzaXZlOiB0cnVlIH0pKS5waXBlKFxuICAgICAgbWVyZ2VNYXAoKCkgPT4gZnNQcm9taXNlcy53cml0ZUZpbGUoZ2V0U3lzdGVtUGF0aChwYXRoKSwgbmV3IFVpbnQ4QXJyYXkoY29udGVudCkpKSxcbiAgICApO1xuICB9XG5cbiAgcmVhZChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuRmlsZUJ1ZmZlcj4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlRnJvbShmc1Byb21pc2VzLnJlYWRGaWxlKGdldFN5c3RlbVBhdGgocGF0aCkpKS5waXBlKFxuICAgICAgbWFwKChidWZmZXIpID0+IG5ldyBVaW50OEFycmF5KGJ1ZmZlcikuYnVmZmVyIGFzIHZpcnR1YWxGcy5GaWxlQnVmZmVyKSxcbiAgICApO1xuICB9XG5cbiAgZGVsZXRlKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20oXG4gICAgICBmc1Byb21pc2VzLnJtKGdldFN5c3RlbVBhdGgocGF0aCksIHsgZm9yY2U6IHRydWUsIHJlY3Vyc2l2ZTogdHJ1ZSwgbWF4UmV0cmllczogMyB9KSxcbiAgICApO1xuICB9XG5cbiAgcmVuYW1lKGZyb206IFBhdGgsIHRvOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKGZzUHJvbWlzZXMucmVuYW1lKGdldFN5c3RlbVBhdGgoZnJvbSksIGdldFN5c3RlbVBhdGgodG8pKSk7XG4gIH1cblxuICBsaXN0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPFBhdGhGcmFnbWVudFtdPiB7XG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKGZzUHJvbWlzZXMucmVhZGRpcihnZXRTeXN0ZW1QYXRoKHBhdGgpKSkucGlwZShcbiAgICAgIG1hcCgobmFtZXMpID0+IG5hbWVzLm1hcCgobmFtZSkgPT4gZnJhZ21lbnQobmFtZSkpKSxcbiAgICApO1xuICB9XG5cbiAgZXhpc3RzKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20oZXhpc3RzKGdldFN5c3RlbVBhdGgocGF0aCkpKTtcbiAgfVxuXG4gIGlzRGlyZWN0b3J5KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gdGhpcy5zdGF0KHBhdGgpLnBpcGUobWFwKChzdGF0KSA9PiBzdGF0LmlzRGlyZWN0b3J5KCkpKTtcbiAgfVxuXG4gIGlzRmlsZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdChwYXRoKS5waXBlKG1hcCgoc3RhdCkgPT4gc3RhdC5pc0ZpbGUoKSkpO1xuICB9XG5cbiAgLy8gU29tZSBob3N0cyBtYXkgbm90IHN1cHBvcnQgc3RhdC5cbiAgc3RhdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuU3RhdHM8U3RhdHM+PiB7XG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKGZzUHJvbWlzZXMuc3RhdChnZXRTeXN0ZW1QYXRoKHBhdGgpKSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCB3YXRjaGluZy5cbiAgd2F0Y2goXG4gICAgcGF0aDogUGF0aCxcbiAgICBfb3B0aW9ucz86IHZpcnR1YWxGcy5Ib3N0V2F0Y2hPcHRpb25zLFxuICApOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudD4gfCBudWxsIHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8dmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50Pigob2JzKSA9PiB7XG4gICAgICBsb2FkRlNXYXRjaGVyKCk7XG4gICAgICBjb25zdCB3YXRjaGVyID0gbmV3IEZTV2F0Y2hlcih7IHBlcnNpc3RlbnQ6IHRydWUgfSk7XG4gICAgICB3YXRjaGVyLmFkZChnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcblxuICAgICAgd2F0Y2hlclxuICAgICAgICAub24oJ2NoYW5nZScsIChwYXRoKSA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuQ2hhbmdlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLm9uKCdhZGQnLCAocGF0aCkgPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkNyZWF0ZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5vbigndW5saW5rJywgKHBhdGgpID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5EZWxldGVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgcmV0dXJuICgpID0+IHdhdGNoZXIuY2xvc2UoKTtcbiAgICB9KS5waXBlKHB1Ymxpc2goKSwgcmVmQ291bnQoKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgVmlydHVhbCBGUyB1c2luZyBOb2RlIGFzIHRoZSBiYWNrZW5kLCBzeW5jaHJvbm91c2x5LlxuICovXG5leHBvcnQgY2xhc3MgTm9kZUpzU3luY0hvc3QgaW1wbGVtZW50cyB2aXJ0dWFsRnMuSG9zdDxTdGF0cz4ge1xuICBnZXQgY2FwYWJpbGl0aWVzKCk6IHZpcnR1YWxGcy5Ib3N0Q2FwYWJpbGl0aWVzIHtcbiAgICByZXR1cm4geyBzeW5jaHJvbm91czogdHJ1ZSB9O1xuICB9XG5cbiAgd3JpdGUocGF0aDogUGF0aCwgY29udGVudDogdmlydHVhbEZzLkZpbGVCdWZmZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9icykgPT4ge1xuICAgICAgbWtkaXJTeW5jKGdldFN5c3RlbVBhdGgoZGlybmFtZShwYXRoKSksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgd3JpdGVGaWxlU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpLCBuZXcgVWludDhBcnJheShjb250ZW50KSk7XG4gICAgICBvYnMubmV4dCgpO1xuICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgfSk7XG4gIH1cblxuICByZWFkKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5GaWxlQnVmZmVyPiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnMpID0+IHtcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IHJlYWRGaWxlU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcblxuICAgICAgb2JzLm5leHQobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKS5idWZmZXIgYXMgdmlydHVhbEZzLkZpbGVCdWZmZXIpO1xuICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZTx2b2lkPigob2JzKSA9PiB7XG4gICAgICBmcy5ybVN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSwgeyBmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzIH0pO1xuXG4gICAgICBvYnMuY29tcGxldGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlbmFtZShmcm9tOiBQYXRoLCB0bzogUGF0aCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzKSA9PiB7XG4gICAgICBjb25zdCB0b1N5c3RlbVBhdGggPSBnZXRTeXN0ZW1QYXRoKHRvKTtcbiAgICAgIG1rZGlyU3luYyhwYXRoRGlybmFtZSh0b1N5c3RlbVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIHJlbmFtZVN5bmMoZ2V0U3lzdGVtUGF0aChmcm9tKSwgdG9TeXN0ZW1QYXRoKTtcbiAgICAgIG9icy5uZXh0KCk7XG4gICAgICBvYnMuY29tcGxldGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGxpc3QocGF0aDogUGF0aCk6IE9ic2VydmFibGU8UGF0aEZyYWdtZW50W10+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9icykgPT4ge1xuICAgICAgY29uc3QgbmFtZXMgPSByZWFkZGlyU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcbiAgICAgIG9icy5uZXh0KG5hbWVzLm1hcCgobmFtZSkgPT4gZnJhZ21lbnQobmFtZSkpKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgZXhpc3RzKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9icykgPT4ge1xuICAgICAgb2JzLm5leHQoZXhpc3RzU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKSk7XG4gICAgICBvYnMuY29tcGxldGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGlzRGlyZWN0b3J5KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgIHJldHVybiB0aGlzLnN0YXQocGF0aCkhLnBpcGUobWFwKChzdGF0KSA9PiBzdGF0LmlzRGlyZWN0b3J5KCkpKTtcbiAgfVxuXG4gIGlzRmlsZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICByZXR1cm4gdGhpcy5zdGF0KHBhdGgpIS5waXBlKG1hcCgoc3RhdCkgPT4gc3RhdC5pc0ZpbGUoKSkpO1xuICB9XG5cbiAgLy8gU29tZSBob3N0cyBtYXkgbm90IHN1cHBvcnQgc3RhdC5cbiAgc3RhdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuU3RhdHM8U3RhdHM+PiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnMpID0+IHtcbiAgICAgIG9icy5uZXh0KHN0YXRTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gU29tZSBob3N0cyBtYXkgbm90IHN1cHBvcnQgd2F0Y2hpbmcuXG4gIHdhdGNoKFxuICAgIHBhdGg6IFBhdGgsXG4gICAgX29wdGlvbnM/OiB2aXJ0dWFsRnMuSG9zdFdhdGNoT3B0aW9ucyxcbiAgKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnQ+IHwgbnVsbCB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudD4oKG9icykgPT4ge1xuICAgICAgbG9hZEZTV2F0Y2hlcigpO1xuICAgICAgY29uc3Qgd2F0Y2hlciA9IG5ldyBGU1dhdGNoZXIoeyBwZXJzaXN0ZW50OiBmYWxzZSB9KTtcbiAgICAgIHdhdGNoZXIuYWRkKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuXG4gICAgICB3YXRjaGVyXG4gICAgICAgIC5vbignY2hhbmdlJywgKHBhdGgpID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5DaGFuZ2VkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAub24oJ2FkZCcsIChwYXRoKSA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuQ3JlYXRlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLm9uKCd1bmxpbmsnLCAocGF0aCkgPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkRlbGV0ZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gKCkgPT4gd2F0Y2hlci5jbG9zZSgpO1xuICAgIH0pLnBpcGUocHVibGlzaCgpLCByZWZDb3VudCgpKTtcbiAgfVxufVxuIl19