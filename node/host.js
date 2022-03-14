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
        return this.isDirectory(path).pipe((0, operators_1.mergeMap)(async (isDirectory) => {
            if (isDirectory) {
                // The below should be removed and replaced with just `rm` when support for Node.Js 12 is removed.
                const { rm, rmdir } = fs_1.promises;
                if (rm) {
                    await rm((0, src_1.getSystemPath)(path), { force: true, recursive: true, maxRetries: 3 });
                }
                else {
                    await rmdir((0, src_1.getSystemPath)(path), { recursive: true, maxRetries: 3 });
                }
            }
            else {
                await fs_1.promises.unlink((0, src_1.getSystemPath)(path));
            }
        }));
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
        return this.isDirectory(path).pipe((0, operators_1.concatMap)((isDir) => {
            if (isDir) {
                const dirPaths = (0, fs_1.readdirSync)((0, src_1.getSystemPath)(path));
                const rmDirComplete = new rxjs_1.Observable((obs) => {
                    // The below should be removed and replaced with just `rmSync` when support for Node.Js 12 is removed.
                    const { rmSync, rmdirSync } = fs_1.default;
                    if (rmSync) {
                        rmSync((0, src_1.getSystemPath)(path), { force: true, recursive: true, maxRetries: 3 });
                    }
                    else {
                        rmdirSync((0, src_1.getSystemPath)(path), { recursive: true, maxRetries: 3 });
                    }
                    obs.complete();
                });
                return (0, rxjs_1.concat)(...dirPaths.map((name) => this.delete((0, src_1.join)(path, name))), rmDirComplete);
            }
            else {
                try {
                    (0, fs_1.unlinkSync)((0, src_1.getSystemPath)(path));
                }
                catch (err) {
                    return (0, rxjs_1.throwError)(err);
                }
                return (0, rxjs_1.of)(undefined);
            }
        }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvbm9kZS9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gseUNBYVk7QUFDWiwrQkFBOEM7QUFDOUMsK0JBQWtGO0FBQ2xGLDhDQUE2RTtBQUM3RSxnQ0FTZ0I7QUFFaEIsS0FBSyxVQUFVLE1BQU0sQ0FBQyxJQUFjO0lBQ2xDLElBQUk7UUFDRixNQUFNLGFBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUU5QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQUMsV0FBTTtRQUNOLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDO0FBRUQsaUVBQWlFO0FBQ2pFLGlGQUFpRjtBQUNqRiw0QkFBNEI7QUFDNUIsSUFBSSxTQUFpQyxDQUFDO0FBQ3RDLFNBQVMsYUFBYTtJQUNwQixJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2QsSUFBSTtZQUNGLDZEQUE2RDtZQUM3RCxTQUFTLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztTQUMzQztRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGtCQUFrQixFQUFFO2dCQUNqQyxNQUFNLElBQUksS0FBSyxDQUNiLDJEQUEyRDtvQkFDekQscURBQXFELENBQ3hELENBQUM7YUFDSDtZQUNELE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7S0FDRjtBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFhLGVBQWU7SUFDMUIsSUFBSSxZQUFZO1FBQ2QsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUNoQyxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQVUsRUFBRSxPQUE2QjtR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R0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFBLG1CQUFPLEdBQUUsRUFBRSxJQUFBLG9CQUFRLEdBQUUsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7Q0FDRjtBQWhKRCx3Q0FnSkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBGU1dhdGNoZXIgYXMgQ2hva2lkYXJXYXRjaGVyIH0gZnJvbSAnY2hva2lkYXInO1xuaW1wb3J0IGZzLCB7XG4gIFBhdGhMaWtlLFxuICBTdGF0cyxcbiAgY29uc3RhbnRzLFxuICBleGlzdHNTeW5jLFxuICBwcm9taXNlcyBhcyBmc1Byb21pc2VzLFxuICBta2RpclN5bmMsXG4gIHJlYWRGaWxlU3luYyxcbiAgcmVhZGRpclN5bmMsXG4gIHJlbmFtZVN5bmMsXG4gIHN0YXRTeW5jLFxuICB1bmxpbmtTeW5jLFxuICB3cml0ZUZpbGVTeW5jLFxufSBmcm9tICdmcyc7XG5pbXBvcnQgeyBkaXJuYW1lIGFzIHBhdGhEaXJuYW1lIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBjb25jYXQsIGZyb20gYXMgb2JzZXJ2YWJsZUZyb20sIG9mLCB0aHJvd0Vycm9yIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIG1hcCwgbWVyZ2VNYXAsIHB1Ymxpc2gsIHJlZkNvdW50IH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgUGF0aCxcbiAgUGF0aEZyYWdtZW50LFxuICBkaXJuYW1lLFxuICBmcmFnbWVudCxcbiAgZ2V0U3lzdGVtUGF0aCxcbiAgam9pbixcbiAgbm9ybWFsaXplLFxuICB2aXJ0dWFsRnMsXG59IGZyb20gJy4uL3NyYyc7XG5cbmFzeW5jIGZ1bmN0aW9uIGV4aXN0cyhwYXRoOiBQYXRoTGlrZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGF3YWl0IGZzUHJvbWlzZXMuYWNjZXNzKHBhdGgsIGNvbnN0YW50cy5GX09LKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLy8gVGhpcyB3aWxsIG9ubHkgYmUgaW5pdGlhbGl6ZWQgaWYgdGhlIHdhdGNoKCkgbWV0aG9kIGlzIGNhbGxlZC5cbi8vIE90aGVyd2lzZSBjaG9raWRhciBhcHBlYXJzIG9ubHkgaW4gdHlwZSBwb3NpdGlvbnMsIGFuZCBzaG91bGRuJ3QgYmUgcmVmZXJlbmNlZFxuLy8gaW4gdGhlIEphdmFTY3JpcHQgb3V0cHV0LlxubGV0IEZTV2F0Y2hlcjogdHlwZW9mIENob2tpZGFyV2F0Y2hlcjtcbmZ1bmN0aW9uIGxvYWRGU1dhdGNoZXIoKSB7XG4gIGlmICghRlNXYXRjaGVyKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXNcbiAgICAgIEZTV2F0Y2hlciA9IHJlcXVpcmUoJ2Nob2tpZGFyJykuRlNXYXRjaGVyO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLmNvZGUgIT09ICdNT0RVTEVfTk9UX0ZPVU5EJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ0FzIG9mIGFuZ3VsYXItZGV2a2l0IHZlcnNpb24gOC4wLCB0aGUgXCJjaG9raWRhclwiIHBhY2thZ2UgJyArXG4gICAgICAgICAgICAnbXVzdCBiZSBpbnN0YWxsZWQgaW4gb3JkZXIgdG8gdXNlIHdhdGNoKCkgZmVhdHVyZXMuJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQW4gaW1wbGVtZW50YXRpb24gb2YgdGhlIFZpcnR1YWwgRlMgdXNpbmcgTm9kZSBhcyB0aGUgYmFja2dyb3VuZC4gVGhlcmUgYXJlIHR3byB2ZXJzaW9uczsgb25lXG4gKiBzeW5jaHJvbm91cyBhbmQgb25lIGFzeW5jaHJvbm91cy5cbiAqL1xuZXhwb3J0IGNsYXNzIE5vZGVKc0FzeW5jSG9zdCBpbXBsZW1lbnRzIHZpcnR1YWxGcy5Ib3N0PFN0YXRzPiB7XG4gIGdldCBjYXBhYmlsaXRpZXMoKTogdmlydHVhbEZzLkhvc3RDYXBhYmlsaXRpZXMge1xuICAgIHJldHVybiB7IHN5bmNocm9ub3VzOiBmYWxzZSB9O1xuICB9XG5cbiAgd3JpdGUocGF0aDogUGF0aCwgY29udGVudDogdmlydHVhbEZzLkZpbGVCdWZmZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20oZnNQcm9taXNlcy5ta2RpcihnZXRTeXN0ZW1QYXRoKGRpcm5hbWUocGF0aCkpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSkucGlwZShcbiAgICAgIG1lcmdlTWFwKCgpID0+IGZzUHJvbWlzZXMud3JpdGVGaWxlKGdldFN5c3RlbVBhdGgocGF0aCksIG5ldyBVaW50OEFycmF5KGNvbnRlbnQpKSksXG4gICAgKTtcbiAgfVxuXG4gIHJlYWQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dmlydHVhbEZzLkZpbGVCdWZmZXI+IHtcbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20oZnNQcm9taXNlcy5yZWFkRmlsZShnZXRTeXN0ZW1QYXRoKHBhdGgpKSkucGlwZShcbiAgICAgIG1hcCgoYnVmZmVyKSA9PiBuZXcgVWludDhBcnJheShidWZmZXIpLmJ1ZmZlciBhcyB2aXJ0dWFsRnMuRmlsZUJ1ZmZlciksXG4gICAgKTtcbiAgfVxuXG4gIGRlbGV0ZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuaXNEaXJlY3RvcnkocGF0aCkucGlwZShcbiAgICAgIG1lcmdlTWFwKGFzeW5jIChpc0RpcmVjdG9yeSkgPT4ge1xuICAgICAgICBpZiAoaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICAvLyBUaGUgYmVsb3cgc2hvdWxkIGJlIHJlbW92ZWQgYW5kIHJlcGxhY2VkIHdpdGgganVzdCBgcm1gIHdoZW4gc3VwcG9ydCBmb3IgTm9kZS5KcyAxMiBpcyByZW1vdmVkLlxuICAgICAgICAgIGNvbnN0IHsgcm0sIHJtZGlyIH0gPSBmc1Byb21pc2VzIGFzIHR5cGVvZiBmc1Byb21pc2VzICYge1xuICAgICAgICAgICAgcm0/OiAoXG4gICAgICAgICAgICAgIHBhdGg6IGZzLlBhdGhMaWtlLFxuICAgICAgICAgICAgICBvcHRpb25zPzoge1xuICAgICAgICAgICAgICAgIGZvcmNlPzogYm9vbGVhbjtcbiAgICAgICAgICAgICAgICBtYXhSZXRyaWVzPzogbnVtYmVyO1xuICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZT86IGJvb2xlYW47XG4gICAgICAgICAgICAgICAgcmV0cnlEZWxheT86IG51bWJlcjtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICkgPT4gUHJvbWlzZTx2b2lkPjtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgaWYgKHJtKSB7XG4gICAgICAgICAgICBhd2FpdCBybShnZXRTeXN0ZW1QYXRoKHBhdGgpLCB7IGZvcmNlOiB0cnVlLCByZWN1cnNpdmU6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IHJtZGlyKGdldFN5c3RlbVBhdGgocGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCBmc1Byb21pc2VzLnVubGluayhnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmFtZShmcm9tOiBQYXRoLCB0bzogUGF0aCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlRnJvbShmc1Byb21pc2VzLnJlbmFtZShnZXRTeXN0ZW1QYXRoKGZyb20pLCBnZXRTeXN0ZW1QYXRoKHRvKSkpO1xuICB9XG5cbiAgbGlzdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxQYXRoRnJhZ21lbnRbXT4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlRnJvbShmc1Byb21pc2VzLnJlYWRkaXIoZ2V0U3lzdGVtUGF0aChwYXRoKSkpLnBpcGUoXG4gICAgICBtYXAoKG5hbWVzKSA9PiBuYW1lcy5tYXAoKG5hbWUpID0+IGZyYWdtZW50KG5hbWUpKSksXG4gICAgKTtcbiAgfVxuXG4gIGV4aXN0cyhwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKGV4aXN0cyhnZXRTeXN0ZW1QYXRoKHBhdGgpKSk7XG4gIH1cblxuICBpc0RpcmVjdG9yeShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdChwYXRoKS5waXBlKG1hcCgoc3RhdCkgPT4gc3RhdC5pc0RpcmVjdG9yeSgpKSk7XG4gIH1cblxuICBpc0ZpbGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiB0aGlzLnN0YXQocGF0aCkucGlwZShtYXAoKHN0YXQpID0+IHN0YXQuaXNGaWxlKCkpKTtcbiAgfVxuXG4gIC8vIFNvbWUgaG9zdHMgbWF5IG5vdCBzdXBwb3J0IHN0YXQuXG4gIHN0YXQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dmlydHVhbEZzLlN0YXRzPFN0YXRzPj4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlRnJvbShmc1Byb21pc2VzLnN0YXQoZ2V0U3lzdGVtUGF0aChwYXRoKSkpO1xuICB9XG5cbiAgLy8gU29tZSBob3N0cyBtYXkgbm90IHN1cHBvcnQgd2F0Y2hpbmcuXG4gIHdhdGNoKFxuICAgIHBhdGg6IFBhdGgsXG4gICAgX29wdGlvbnM/OiB2aXJ0dWFsRnMuSG9zdFdhdGNoT3B0aW9ucyxcbiAgKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnQ+IHwgbnVsbCB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudD4oKG9icykgPT4ge1xuICAgICAgbG9hZEZTV2F0Y2hlcigpO1xuICAgICAgY29uc3Qgd2F0Y2hlciA9IG5ldyBGU1dhdGNoZXIoeyBwZXJzaXN0ZW50OiB0cnVlIH0pO1xuICAgICAgd2F0Y2hlci5hZGQoZ2V0U3lzdGVtUGF0aChwYXRoKSk7XG5cbiAgICAgIHdhdGNoZXJcbiAgICAgICAgLm9uKCdjaGFuZ2UnLCAocGF0aCkgPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkNoYW5nZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5vbignYWRkJywgKHBhdGgpID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5DcmVhdGVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAub24oJ3VubGluaycsIChwYXRoKSA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuRGVsZXRlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgIHJldHVybiAoKSA9PiB3YXRjaGVyLmNsb3NlKCk7XG4gICAgfSkucGlwZShwdWJsaXNoKCksIHJlZkNvdW50KCkpO1xuICB9XG59XG5cbi8qKlxuICogQW4gaW1wbGVtZW50YXRpb24gb2YgdGhlIFZpcnR1YWwgRlMgdXNpbmcgTm9kZSBhcyB0aGUgYmFja2VuZCwgc3luY2hyb25vdXNseS5cbiAqL1xuZXhwb3J0IGNsYXNzIE5vZGVKc1N5bmNIb3N0IGltcGxlbWVudHMgdmlydHVhbEZzLkhvc3Q8U3RhdHM+IHtcbiAgZ2V0IGNhcGFiaWxpdGllcygpOiB2aXJ0dWFsRnMuSG9zdENhcGFiaWxpdGllcyB7XG4gICAgcmV0dXJuIHsgc3luY2hyb25vdXM6IHRydWUgfTtcbiAgfVxuXG4gIHdyaXRlKHBhdGg6IFBhdGgsIGNvbnRlbnQ6IHZpcnR1YWxGcy5GaWxlQnVmZmVyKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnMpID0+IHtcbiAgICAgIG1rZGlyU3luYyhnZXRTeXN0ZW1QYXRoKGRpcm5hbWUocGF0aCkpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIHdyaXRlRmlsZVN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSwgbmV3IFVpbnQ4QXJyYXkoY29udGVudCkpO1xuICAgICAgb2JzLm5leHQoKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVhZChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuRmlsZUJ1ZmZlcj4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzKSA9PiB7XG4gICAgICBjb25zdCBidWZmZXIgPSByZWFkRmlsZVN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSk7XG5cbiAgICAgIG9icy5uZXh0KG5ldyBVaW50OEFycmF5KGJ1ZmZlcikuYnVmZmVyIGFzIHZpcnR1YWxGcy5GaWxlQnVmZmVyKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5pc0RpcmVjdG9yeShwYXRoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKChpc0RpcikgPT4ge1xuICAgICAgICBpZiAoaXNEaXIpIHtcbiAgICAgICAgICBjb25zdCBkaXJQYXRocyA9IHJlYWRkaXJTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuICAgICAgICAgIGNvbnN0IHJtRGlyQ29tcGxldGUgPSBuZXcgT2JzZXJ2YWJsZTx2b2lkPigob2JzKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgYmVsb3cgc2hvdWxkIGJlIHJlbW92ZWQgYW5kIHJlcGxhY2VkIHdpdGgganVzdCBgcm1TeW5jYCB3aGVuIHN1cHBvcnQgZm9yIE5vZGUuSnMgMTIgaXMgcmVtb3ZlZC5cbiAgICAgICAgICAgIGNvbnN0IHsgcm1TeW5jLCBybWRpclN5bmMgfSA9IGZzIGFzIHR5cGVvZiBmcyAmIHtcbiAgICAgICAgICAgICAgcm1TeW5jPzogKFxuICAgICAgICAgICAgICAgIHBhdGg6IGZzLlBhdGhMaWtlLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM/OiB7XG4gICAgICAgICAgICAgICAgICBmb3JjZT86IGJvb2xlYW47XG4gICAgICAgICAgICAgICAgICBtYXhSZXRyaWVzPzogbnVtYmVyO1xuICAgICAgICAgICAgICAgICAgcmVjdXJzaXZlPzogYm9vbGVhbjtcbiAgICAgICAgICAgICAgICAgIHJldHJ5RGVsYXk/OiBudW1iZXI7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKSA9PiB2b2lkO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHJtU3luYykge1xuICAgICAgICAgICAgICBybVN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSwgeyBmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcm1kaXJTeW5jKGdldFN5c3RlbVBhdGgocGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHJldHVybiBjb25jYXQoLi4uZGlyUGF0aHMubWFwKChuYW1lKSA9PiB0aGlzLmRlbGV0ZShqb2luKHBhdGgsIG5hbWUpKSksIHJtRGlyQ29tcGxldGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB1bmxpbmtTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZXJyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gb2YodW5kZWZpbmVkKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHJlbmFtZShmcm9tOiBQYXRoLCB0bzogUGF0aCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzKSA9PiB7XG4gICAgICBjb25zdCB0b1N5c3RlbVBhdGggPSBnZXRTeXN0ZW1QYXRoKHRvKTtcbiAgICAgIG1rZGlyU3luYyhwYXRoRGlybmFtZSh0b1N5c3RlbVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIHJlbmFtZVN5bmMoZ2V0U3lzdGVtUGF0aChmcm9tKSwgdG9TeXN0ZW1QYXRoKTtcbiAgICAgIG9icy5uZXh0KCk7XG4gICAgICBvYnMuY29tcGxldGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGxpc3QocGF0aDogUGF0aCk6IE9ic2VydmFibGU8UGF0aEZyYWdtZW50W10+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9icykgPT4ge1xuICAgICAgY29uc3QgbmFtZXMgPSByZWFkZGlyU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcbiAgICAgIG9icy5uZXh0KG5hbWVzLm1hcCgobmFtZSkgPT4gZnJhZ21lbnQobmFtZSkpKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgZXhpc3RzKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9icykgPT4ge1xuICAgICAgb2JzLm5leHQoZXhpc3RzU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKSk7XG4gICAgICBvYnMuY29tcGxldGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGlzRGlyZWN0b3J5KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgIHJldHVybiB0aGlzLnN0YXQocGF0aCkhLnBpcGUobWFwKChzdGF0KSA9PiBzdGF0LmlzRGlyZWN0b3J5KCkpKTtcbiAgfVxuXG4gIGlzRmlsZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICByZXR1cm4gdGhpcy5zdGF0KHBhdGgpIS5waXBlKG1hcCgoc3RhdCkgPT4gc3RhdC5pc0ZpbGUoKSkpO1xuICB9XG5cbiAgLy8gU29tZSBob3N0cyBtYXkgbm90IHN1cHBvcnQgc3RhdC5cbiAgc3RhdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuU3RhdHM8U3RhdHM+PiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnMpID0+IHtcbiAgICAgIG9icy5uZXh0KHN0YXRTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gU29tZSBob3N0cyBtYXkgbm90IHN1cHBvcnQgd2F0Y2hpbmcuXG4gIHdhdGNoKFxuICAgIHBhdGg6IFBhdGgsXG4gICAgX29wdGlvbnM/OiB2aXJ0dWFsRnMuSG9zdFdhdGNoT3B0aW9ucyxcbiAgKTogT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnQ+IHwgbnVsbCB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudD4oKG9icykgPT4ge1xuICAgICAgbG9hZEZTV2F0Y2hlcigpO1xuICAgICAgY29uc3Qgd2F0Y2hlciA9IG5ldyBGU1dhdGNoZXIoeyBwZXJzaXN0ZW50OiBmYWxzZSB9KTtcbiAgICAgIHdhdGNoZXIuYWRkKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuXG4gICAgICB3YXRjaGVyXG4gICAgICAgIC5vbignY2hhbmdlJywgKHBhdGgpID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5DaGFuZ2VkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAub24oJ2FkZCcsIChwYXRoKSA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuQ3JlYXRlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLm9uKCd1bmxpbmsnLCAocGF0aCkgPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkRlbGV0ZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gKCkgPT4gd2F0Y2hlci5jbG9zZSgpO1xuICAgIH0pLnBpcGUocHVibGlzaCgpLCByZWZDb3VudCgpKTtcbiAgfVxufVxuIl19