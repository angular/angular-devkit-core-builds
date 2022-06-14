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
                    type: 0 /* virtualFs.HostWatchEventType.Changed */,
                });
            })
                .on('add', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 1 /* virtualFs.HostWatchEventType.Created */,
                });
            })
                .on('unlink', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 2 /* virtualFs.HostWatchEventType.Deleted */,
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
                    type: 0 /* virtualFs.HostWatchEventType.Changed */,
                });
            })
                .on('add', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 1 /* virtualFs.HostWatchEventType.Created */,
                });
            })
                .on('unlink', (path) => {
                obs.next({
                    path: (0, src_1.normalize)(path),
                    time: new Date(),
                    type: 2 /* virtualFs.HostWatchEventType.Deleted */,
                });
            });
            return () => watcher.close();
        }).pipe((0, operators_1.publish)(), (0, operators_1.refCount)());
    }
}
exports.NodeJsSyncHost = NodeJsSyncHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvbm9kZS9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0gseUNBWVk7QUFDWiwrQkFBOEM7QUFDOUMsK0JBQTBEO0FBQzFELDhDQUFrRTtBQUNsRSxnQ0FBb0c7QUFFcEcsS0FBSyxVQUFVLE1BQU0sQ0FBQyxJQUFjO0lBQ2xDLElBQUk7UUFDRixNQUFNLGFBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUU5QyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQUMsV0FBTTtRQUNOLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDO0FBRUQsaUVBQWlFO0FBQ2pFLGlGQUFpRjtBQUNqRiw0QkFBNEI7QUFDNUIsSUFBSSxTQUFpQyxDQUFDO0FBQ3RDLFNBQVMsYUFBYTtJQUNwQixJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2QsSUFBSTtZQUNGLDZEQUE2RDtZQUM3RCxTQUFTLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztTQUMzQztRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSyxDQUEyQixDQUFDLElBQUksS0FBSyxrQkFBa0IsRUFBRTtnQkFDNUQsTUFBTSxJQUFJLEtBQUssQ0FDYiwyREFBMkQ7b0JBQ3pELHFEQUFxRCxDQUN4RCxDQUFDO2FBQ0g7WUFDRCxNQUFNLENBQUMsQ0FBQztTQUNUO0tBQ0Y7QUFDSCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBYSxlQUFlO0lBQzFCLElBQUksWUFBWTtRQUNkLE9BQU8sRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFVLEVBQUUsT0FBNkI7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SixFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ3JCLEdBQUcsQ0FBQyxJQUFJLENBQUM7b0JBQ1AsSUFBSSxFQUFFLElBQUEsZUFBUyxFQUFDLElBQUksQ0FBQztvQkFDckIsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFO29CQUNoQixJQUFJLDhDQUFzQztpQkFDM0MsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDO2lCQUNELEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDbEIsR0FBRyxDQUFDLElBQUksQ0FBQztvQkFDUCxJQUFJLEVBQUUsSUFBQSxlQUFTLEVBQUMsSUFBSSxDQUFDO29CQUNyQixJQUFJLEVBQUUsSUFBSSxJQUFJLEVBQUU7b0JBQ2hCLElBQUksOENBQXNDO2lCQUMzQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUM7aUJBQ0QsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNyQixHQUFHLENBQUMsSUFBSSxDQUFDO29CQUNQLElBQUksRUFBRSxJQUFBLGVBQVMsRUFBQyxJQUFJLENBQUM7b0JBQ3JCLElBQUksRUFBRSxJQUFJLElBQUksRUFBRTtvQkFDaEIsSUFBSSw4Q0FBc0M7aUJBQzNDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1lBRUwsT0FBTyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDL0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUEsbUJBQU8sR0FBRSxFQUFFLElBQUEsb0JBQVEsR0FBRSxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBOUdELHdDQThHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEZTV2F0Y2hlciBhcyBDaG9raWRhcldhdGNoZXIgfSBmcm9tICdjaG9raWRhcic7XG5pbXBvcnQgZnMsIHtcbiAgUGF0aExpa2UsXG4gIFN0YXRzLFxuICBjb25zdGFudHMsXG4gIGV4aXN0c1N5bmMsXG4gIHByb21pc2VzIGFzIGZzUHJvbWlzZXMsXG4gIG1rZGlyU3luYyxcbiAgcmVhZEZpbGVTeW5jLFxuICByZWFkZGlyU3luYyxcbiAgcmVuYW1lU3luYyxcbiAgc3RhdFN5bmMsXG4gIHdyaXRlRmlsZVN5bmMsXG59IGZyb20gJ2ZzJztcbmltcG9ydCB7IGRpcm5hbWUgYXMgcGF0aERpcm5hbWUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIGZyb20gYXMgb2JzZXJ2YWJsZUZyb20gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IG1hcCwgbWVyZ2VNYXAsIHB1Ymxpc2gsIHJlZkNvdW50IH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgUGF0aCwgUGF0aEZyYWdtZW50LCBkaXJuYW1lLCBmcmFnbWVudCwgZ2V0U3lzdGVtUGF0aCwgbm9ybWFsaXplLCB2aXJ0dWFsRnMgfSBmcm9tICcuLi9zcmMnO1xuXG5hc3luYyBmdW5jdGlvbiBleGlzdHMocGF0aDogUGF0aExpa2UpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICBhd2FpdCBmc1Byb21pc2VzLmFjY2VzcyhwYXRoLCBjb25zdGFudHMuRl9PSyk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8vIFRoaXMgd2lsbCBvbmx5IGJlIGluaXRpYWxpemVkIGlmIHRoZSB3YXRjaCgpIG1ldGhvZCBpcyBjYWxsZWQuXG4vLyBPdGhlcndpc2UgY2hva2lkYXIgYXBwZWFycyBvbmx5IGluIHR5cGUgcG9zaXRpb25zLCBhbmQgc2hvdWxkbid0IGJlIHJlZmVyZW5jZWRcbi8vIGluIHRoZSBKYXZhU2NyaXB0IG91dHB1dC5cbmxldCBGU1dhdGNoZXI6IHR5cGVvZiBDaG9raWRhcldhdGNoZXI7XG5mdW5jdGlvbiBsb2FkRlNXYXRjaGVyKCkge1xuICBpZiAoIUZTV2F0Y2hlcikge1xuICAgIHRyeSB7XG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgaW1wb3J0L25vLWV4dHJhbmVvdXMtZGVwZW5kZW5jaWVzXG4gICAgICBGU1dhdGNoZXIgPSByZXF1aXJlKCdjaG9raWRhcicpLkZTV2F0Y2hlcjtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoKGUgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uKS5jb2RlICE9PSAnTU9EVUxFX05PVF9GT1VORCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdBcyBvZiBhbmd1bGFyLWRldmtpdCB2ZXJzaW9uIDguMCwgdGhlIFwiY2hva2lkYXJcIiBwYWNrYWdlICcgK1xuICAgICAgICAgICAgJ211c3QgYmUgaW5zdGFsbGVkIGluIG9yZGVyIHRvIHVzZSB3YXRjaCgpIGZlYXR1cmVzLicsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFuIGltcGxlbWVudGF0aW9uIG9mIHRoZSBWaXJ0dWFsIEZTIHVzaW5nIE5vZGUgYXMgdGhlIGJhY2tncm91bmQuIFRoZXJlIGFyZSB0d28gdmVyc2lvbnM7IG9uZVxuICogc3luY2hyb25vdXMgYW5kIG9uZSBhc3luY2hyb25vdXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBOb2RlSnNBc3luY0hvc3QgaW1wbGVtZW50cyB2aXJ0dWFsRnMuSG9zdDxTdGF0cz4ge1xuICBnZXQgY2FwYWJpbGl0aWVzKCk6IHZpcnR1YWxGcy5Ib3N0Q2FwYWJpbGl0aWVzIHtcbiAgICByZXR1cm4geyBzeW5jaHJvbm91czogZmFsc2UgfTtcbiAgfVxuXG4gIHdyaXRlKHBhdGg6IFBhdGgsIGNvbnRlbnQ6IHZpcnR1YWxGcy5GaWxlQnVmZmVyKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKGZzUHJvbWlzZXMubWtkaXIoZ2V0U3lzdGVtUGF0aChkaXJuYW1lKHBhdGgpKSwgeyByZWN1cnNpdmU6IHRydWUgfSkpLnBpcGUoXG4gICAgICBtZXJnZU1hcCgoKSA9PiBmc1Byb21pc2VzLndyaXRlRmlsZShnZXRTeXN0ZW1QYXRoKHBhdGgpLCBuZXcgVWludDhBcnJheShjb250ZW50KSkpLFxuICAgICk7XG4gIH1cblxuICByZWFkKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5GaWxlQnVmZmVyPiB7XG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKGZzUHJvbWlzZXMucmVhZEZpbGUoZ2V0U3lzdGVtUGF0aChwYXRoKSkpLnBpcGUoXG4gICAgICBtYXAoKGJ1ZmZlcikgPT4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKS5idWZmZXIgYXMgdmlydHVhbEZzLkZpbGVCdWZmZXIpLFxuICAgICk7XG4gIH1cblxuICBkZWxldGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlRnJvbShcbiAgICAgIGZzUHJvbWlzZXMucm0oZ2V0U3lzdGVtUGF0aChwYXRoKSwgeyBmb3JjZTogdHJ1ZSwgcmVjdXJzaXZlOiB0cnVlLCBtYXhSZXRyaWVzOiAzIH0pLFxuICAgICk7XG4gIH1cblxuICByZW5hbWUoZnJvbTogUGF0aCwgdG86IFBhdGgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20oZnNQcm9taXNlcy5yZW5hbWUoZ2V0U3lzdGVtUGF0aChmcm9tKSwgZ2V0U3lzdGVtUGF0aCh0bykpKTtcbiAgfVxuXG4gIGxpc3QocGF0aDogUGF0aCk6IE9ic2VydmFibGU8UGF0aEZyYWdtZW50W10+IHtcbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20oZnNQcm9taXNlcy5yZWFkZGlyKGdldFN5c3RlbVBhdGgocGF0aCkpKS5waXBlKFxuICAgICAgbWFwKChuYW1lcykgPT4gbmFtZXMubWFwKChuYW1lKSA9PiBmcmFnbWVudChuYW1lKSkpLFxuICAgICk7XG4gIH1cblxuICBleGlzdHMocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiBvYnNlcnZhYmxlRnJvbShleGlzdHMoZ2V0U3lzdGVtUGF0aChwYXRoKSkpO1xuICB9XG5cbiAgaXNEaXJlY3RvcnkocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiB0aGlzLnN0YXQocGF0aCkucGlwZShtYXAoKHN0YXQpID0+IHN0YXQuaXNEaXJlY3RvcnkoKSkpO1xuICB9XG5cbiAgaXNGaWxlKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gdGhpcy5zdGF0KHBhdGgpLnBpcGUobWFwKChzdGF0KSA9PiBzdGF0LmlzRmlsZSgpKSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCBzdGF0LlxuICBzdGF0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5TdGF0czxTdGF0cz4+IHtcbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20oZnNQcm9taXNlcy5zdGF0KGdldFN5c3RlbVBhdGgocGF0aCkpKTtcbiAgfVxuXG4gIC8vIFNvbWUgaG9zdHMgbWF5IG5vdCBzdXBwb3J0IHdhdGNoaW5nLlxuICB3YXRjaChcbiAgICBwYXRoOiBQYXRoLFxuICAgIF9vcHRpb25zPzogdmlydHVhbEZzLkhvc3RXYXRjaE9wdGlvbnMsXG4gICk6IE9ic2VydmFibGU8dmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50PiB8IG51bGwge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZTx2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnQ+KChvYnMpID0+IHtcbiAgICAgIGxvYWRGU1dhdGNoZXIoKTtcbiAgICAgIGNvbnN0IHdhdGNoZXIgPSBuZXcgRlNXYXRjaGVyKHsgcGVyc2lzdGVudDogdHJ1ZSB9KTtcbiAgICAgIHdhdGNoZXIuYWRkKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuXG4gICAgICB3YXRjaGVyXG4gICAgICAgIC5vbignY2hhbmdlJywgKHBhdGgpID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5DaGFuZ2VkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAub24oJ2FkZCcsIChwYXRoKSA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuQ3JlYXRlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLm9uKCd1bmxpbmsnLCAocGF0aCkgPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkRlbGV0ZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gKCkgPT4gd2F0Y2hlci5jbG9zZSgpO1xuICAgIH0pLnBpcGUocHVibGlzaCgpLCByZWZDb3VudCgpKTtcbiAgfVxufVxuXG4vKipcbiAqIEFuIGltcGxlbWVudGF0aW9uIG9mIHRoZSBWaXJ0dWFsIEZTIHVzaW5nIE5vZGUgYXMgdGhlIGJhY2tlbmQsIHN5bmNocm9ub3VzbHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBOb2RlSnNTeW5jSG9zdCBpbXBsZW1lbnRzIHZpcnR1YWxGcy5Ib3N0PFN0YXRzPiB7XG4gIGdldCBjYXBhYmlsaXRpZXMoKTogdmlydHVhbEZzLkhvc3RDYXBhYmlsaXRpZXMge1xuICAgIHJldHVybiB7IHN5bmNocm9ub3VzOiB0cnVlIH07XG4gIH1cblxuICB3cml0ZShwYXRoOiBQYXRoLCBjb250ZW50OiB2aXJ0dWFsRnMuRmlsZUJ1ZmZlcik6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzKSA9PiB7XG4gICAgICBta2RpclN5bmMoZ2V0U3lzdGVtUGF0aChkaXJuYW1lKHBhdGgpKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICB3cml0ZUZpbGVTeW5jKGdldFN5c3RlbVBhdGgocGF0aCksIG5ldyBVaW50OEFycmF5KGNvbnRlbnQpKTtcbiAgICAgIG9icy5uZXh0KCk7XG4gICAgICBvYnMuY29tcGxldGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlYWQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dmlydHVhbEZzLkZpbGVCdWZmZXI+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9icykgPT4ge1xuICAgICAgY29uc3QgYnVmZmVyID0gcmVhZEZpbGVTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuXG4gICAgICBvYnMubmV4dChuZXcgVWludDhBcnJheShidWZmZXIpLmJ1ZmZlciBhcyB2aXJ0dWFsRnMuRmlsZUJ1ZmZlcik7XG4gICAgICBvYnMuY29tcGxldGUoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPHZvaWQ+KChvYnMpID0+IHtcbiAgICAgIGZzLnJtU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpLCB7IGZvcmNlOiB0cnVlLCByZWN1cnNpdmU6IHRydWUsIG1heFJldHJpZXM6IDMgfSk7XG5cbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVuYW1lKGZyb206IFBhdGgsIHRvOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKChvYnMpID0+IHtcbiAgICAgIGNvbnN0IHRvU3lzdGVtUGF0aCA9IGdldFN5c3RlbVBhdGgodG8pO1xuICAgICAgbWtkaXJTeW5jKHBhdGhEaXJuYW1lKHRvU3lzdGVtUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgcmVuYW1lU3luYyhnZXRTeXN0ZW1QYXRoKGZyb20pLCB0b1N5c3RlbVBhdGgpO1xuICAgICAgb2JzLm5leHQoKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgbGlzdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxQYXRoRnJhZ21lbnRbXT4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzKSA9PiB7XG4gICAgICBjb25zdCBuYW1lcyA9IHJlYWRkaXJTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuICAgICAgb2JzLm5leHQobmFtZXMubWFwKChuYW1lKSA9PiBmcmFnbWVudChuYW1lKSkpO1xuICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgfSk7XG4gIH1cblxuICBleGlzdHMocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZSgob2JzKSA9PiB7XG4gICAgICBvYnMubmV4dChleGlzdHNTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpKTtcbiAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgaXNEaXJlY3RvcnkocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgcmV0dXJuIHRoaXMuc3RhdChwYXRoKSEucGlwZShtYXAoKHN0YXQpID0+IHN0YXQuaXNEaXJlY3RvcnkoKSkpO1xuICB9XG5cbiAgaXNGaWxlKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgIHJldHVybiB0aGlzLnN0YXQocGF0aCkhLnBpcGUobWFwKChzdGF0KSA9PiBzdGF0LmlzRmlsZSgpKSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCBzdGF0LlxuICBzdGF0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5TdGF0czxTdGF0cz4+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUoKG9icykgPT4ge1xuICAgICAgb2JzLm5leHQoc3RhdFN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSkpO1xuICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCB3YXRjaGluZy5cbiAgd2F0Y2goXG4gICAgcGF0aDogUGF0aCxcbiAgICBfb3B0aW9ucz86IHZpcnR1YWxGcy5Ib3N0V2F0Y2hPcHRpb25zLFxuICApOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudD4gfCBudWxsIHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8dmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50Pigob2JzKSA9PiB7XG4gICAgICBsb2FkRlNXYXRjaGVyKCk7XG4gICAgICBjb25zdCB3YXRjaGVyID0gbmV3IEZTV2F0Y2hlcih7IHBlcnNpc3RlbnQ6IGZhbHNlIH0pO1xuICAgICAgd2F0Y2hlci5hZGQoZ2V0U3lzdGVtUGF0aChwYXRoKSk7XG5cbiAgICAgIHdhdGNoZXJcbiAgICAgICAgLm9uKCdjaGFuZ2UnLCAocGF0aCkgPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkNoYW5nZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5vbignYWRkJywgKHBhdGgpID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5DcmVhdGVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAub24oJ3VubGluaycsIChwYXRoKSA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuRGVsZXRlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgIHJldHVybiAoKSA9PiB3YXRjaGVyLmNsb3NlKCk7XG4gICAgfSkucGlwZShwdWJsaXNoKCksIHJlZkNvdW50KCkpO1xuICB9XG59XG4iXX0=