"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const fs = require("fs");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const src_1 = require("../src");
// This will only be initialized if the watch() method is called.
// Otherwise chokidar appears only in type positions, and shouldn't be referenced
// in the JavaScript output.
let FSWatcher;
function loadFSWatcher() {
    if (!FSWatcher) {
        try {
            // tslint:disable-next-line:no-implicit-dependencies
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
function _callFs(fn, ...args) {
    return new rxjs_1.Observable(obs => {
        fn(...args, (err, result) => {
            if (err) {
                obs.error(err);
            }
            else {
                obs.next(result);
                obs.complete();
            }
        });
    });
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
        return new rxjs_1.Observable(obs => {
            // Create folders if necessary.
            const _createDir = (path) => {
                if (fs.existsSync(src_1.getSystemPath(path))) {
                    return;
                }
                if (src_1.dirname(path) === path) {
                    throw new Error();
                }
                _createDir(src_1.dirname(path));
                fs.mkdirSync(src_1.getSystemPath(path));
            };
            _createDir(src_1.dirname(path));
            _callFs(fs.writeFile, src_1.getSystemPath(path), new Uint8Array(content)).subscribe(obs);
        });
    }
    read(path) {
        return _callFs(fs.readFile, src_1.getSystemPath(path)).pipe(operators_1.map(buffer => new Uint8Array(buffer).buffer));
    }
    delete(path) {
        return this.isDirectory(path).pipe(operators_1.mergeMap(isDirectory => {
            if (isDirectory) {
                const allFiles = [];
                const allDirs = [];
                const _recurseList = (path) => {
                    for (const fragment of fs.readdirSync(src_1.getSystemPath(path))) {
                        if (fs.statSync(src_1.getSystemPath(src_1.join(path, fragment))).isDirectory()) {
                            _recurseList(src_1.join(path, fragment));
                            allDirs.push(src_1.join(path, fragment));
                        }
                        else {
                            allFiles.push(src_1.join(path, fragment));
                        }
                    }
                };
                _recurseList(path);
                return rxjs_1.concat(rxjs_1.from(allFiles).pipe(operators_1.mergeMap(p => _callFs(fs.unlink, src_1.getSystemPath(p))), operators_1.ignoreElements()), rxjs_1.from(allDirs).pipe(operators_1.concatMap(p => _callFs(fs.rmdir, src_1.getSystemPath(p)))));
            }
            else {
                return _callFs(fs.unlink, src_1.getSystemPath(path));
            }
        }), operators_1.map(() => undefined));
    }
    rename(from, to) {
        return _callFs(fs.rename, src_1.getSystemPath(from), src_1.getSystemPath(to));
    }
    list(path) {
        return _callFs(fs.readdir, src_1.getSystemPath(path)).pipe(operators_1.map(names => names.map(name => src_1.fragment(name))));
    }
    exists(path) {
        // Exists is a special case because it cannot error.
        return new rxjs_1.Observable(obs => {
            fs.exists(path, exists => {
                obs.next(exists);
                obs.complete();
            });
        });
    }
    isDirectory(path) {
        return _callFs(fs.stat, src_1.getSystemPath(path)).pipe(operators_1.map(stat => stat.isDirectory()));
    }
    isFile(path) {
        return _callFs(fs.stat, src_1.getSystemPath(path)).pipe(operators_1.map(stat => stat.isDirectory()));
    }
    // Some hosts may not support stat.
    stat(path) {
        return _callFs(fs.stat, src_1.getSystemPath(path));
    }
    // Some hosts may not support watching.
    watch(path, _options) {
        return new rxjs_1.Observable(obs => {
            loadFSWatcher();
            const watcher = new FSWatcher({ persistent: true }).add(src_1.getSystemPath(path));
            watcher
                .on('change', path => {
                obs.next({
                    path: src_1.normalize(path),
                    time: new Date(),
                    type: 0 /* Changed */,
                });
            })
                .on('add', path => {
                obs.next({
                    path: src_1.normalize(path),
                    time: new Date(),
                    type: 1 /* Created */,
                });
            })
                .on('unlink', path => {
                obs.next({
                    path: src_1.normalize(path),
                    time: new Date(),
                    type: 2 /* Deleted */,
                });
            });
            return () => watcher.close();
        }).pipe(operators_1.publish(), operators_1.refCount());
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
        return new rxjs_1.Observable(obs => {
            // TODO: remove this try+catch when issue https://github.com/ReactiveX/rxjs/issues/3740 is
            // fixed.
            try {
                // Create folders if necessary.
                const _createDir = (path) => {
                    if (fs.existsSync(src_1.getSystemPath(path))) {
                        return;
                    }
                    _createDir(src_1.dirname(path));
                    fs.mkdirSync(src_1.getSystemPath(path));
                };
                _createDir(src_1.dirname(path));
                fs.writeFileSync(src_1.getSystemPath(path), new Uint8Array(content));
                obs.next();
                obs.complete();
            }
            catch (err) {
                obs.error(err);
            }
        });
    }
    read(path) {
        return new rxjs_1.Observable(obs => {
            // TODO: remove this try+catch when issue https://github.com/ReactiveX/rxjs/issues/3740 is
            // fixed.
            try {
                const buffer = fs.readFileSync(src_1.getSystemPath(path));
                obs.next(new Uint8Array(buffer).buffer);
                obs.complete();
            }
            catch (err) {
                obs.error(err);
            }
        });
    }
    delete(path) {
        return this.isDirectory(path).pipe(operators_1.concatMap(isDir => {
            // TODO: remove this try+catch when issue https://github.com/ReactiveX/rxjs/issues/3740 is
            // fixed.
            if (isDir) {
                const dirPaths = fs.readdirSync(src_1.getSystemPath(path));
                const rmDirComplete = new rxjs_1.Observable((obs) => {
                    try {
                        fs.rmdirSync(src_1.getSystemPath(path));
                        obs.complete();
                    }
                    catch (e) {
                        obs.error(e);
                    }
                });
                return rxjs_1.concat(...dirPaths.map(name => this.delete(src_1.join(path, name))), rmDirComplete);
            }
            else {
                try {
                    fs.unlinkSync(src_1.getSystemPath(path));
                }
                catch (err) {
                    return rxjs_1.throwError(err);
                }
                return rxjs_1.EMPTY;
            }
        }));
    }
    rename(from, to) {
        return new rxjs_1.Observable(obs => {
            // TODO: remove this try+catch when issue https://github.com/ReactiveX/rxjs/issues/3740 is
            // fixed.
            try {
                fs.renameSync(src_1.getSystemPath(from), src_1.getSystemPath(to));
                obs.next();
                obs.complete();
            }
            catch (err) {
                obs.error(err);
            }
        });
    }
    list(path) {
        return new rxjs_1.Observable(obs => {
            // TODO: remove this try+catch when issue https://github.com/ReactiveX/rxjs/issues/3740 is
            // fixed.
            try {
                const names = fs.readdirSync(src_1.getSystemPath(path));
                obs.next(names.map(name => src_1.fragment(name)));
                obs.complete();
            }
            catch (err) {
                obs.error(err);
            }
        });
    }
    exists(path) {
        return new rxjs_1.Observable(obs => {
            // TODO: remove this try+catch when issue https://github.com/ReactiveX/rxjs/issues/3740 is
            // fixed.
            try {
                obs.next(fs.existsSync(src_1.getSystemPath(path)));
                obs.complete();
            }
            catch (err) {
                obs.error(err);
            }
        });
    }
    isDirectory(path) {
        // tslint:disable-next-line:no-non-null-assertion
        return this.stat(path).pipe(operators_1.map(stat => stat.isDirectory()));
    }
    isFile(path) {
        // tslint:disable-next-line:no-non-null-assertion
        return this.stat(path).pipe(operators_1.map(stat => stat.isFile()));
    }
    // Some hosts may not support stat.
    stat(path) {
        return new rxjs_1.Observable(obs => {
            // TODO: remove this try+catch when issue https://github.com/ReactiveX/rxjs/issues/3740 is
            // fixed.
            try {
                obs.next(fs.statSync(src_1.getSystemPath(path)));
                obs.complete();
            }
            catch (err) {
                obs.error(err);
            }
        });
    }
    // Some hosts may not support watching.
    watch(path, _options) {
        return new rxjs_1.Observable(obs => {
            const opts = { persistent: false };
            loadFSWatcher();
            const watcher = new FSWatcher(opts).add(src_1.getSystemPath(path));
            watcher
                .on('change', path => {
                obs.next({
                    path: src_1.normalize(path),
                    time: new Date(),
                    type: 0 /* Changed */,
                });
            })
                .on('add', path => {
                obs.next({
                    path: src_1.normalize(path),
                    time: new Date(),
                    type: 1 /* Created */,
                });
            })
                .on('unlink', path => {
                obs.next({
                    path: src_1.normalize(path),
                    time: new Date(),
                    type: 2 /* Deleted */,
                });
            });
            return () => watcher.close();
        }).pipe(operators_1.publish(), operators_1.refCount());
    }
}
exports.NodeJsSyncHost = NodeJsSyncHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9ub2RlL2hvc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCx5QkFBeUI7QUFDekIsK0JBQXFGO0FBQ3JGLDhDQU93QjtBQUN4QixnQ0FTZ0I7QUFjaEIsaUVBQWlFO0FBQ2pFLGlGQUFpRjtBQUNqRiw0QkFBNEI7QUFDNUIsSUFBSSxTQUEwQixDQUFDO0FBQy9CLFNBQVMsYUFBYTtJQUNwQixJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2QsSUFBSTtZQUNGLG9EQUFvRDtZQUNwRCxTQUFTLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQztTQUMzQztRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGtCQUFrQixFQUFFO2dCQUNqQyxNQUFNLElBQUksS0FBSyxDQUFDLDJEQUEyRDtvQkFDdkUscURBQXFELENBQUMsQ0FBQzthQUM1RDtZQUNELE1BQU0sQ0FBQyxDQUFDO1NBQ1Q7S0FDRjtBQUNILENBQUM7QUFZRCxTQUFTLE9BQU8sQ0FBVSxFQUFZLEVBQUUsR0FBRyxJQUFVO0lBQ25ELE9BQU8sSUFBSSxpQkFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQzFCLEVBQUUsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEdBQVcsRUFBRSxNQUFnQixFQUFFLEVBQUU7WUFDNUMsSUFBSSxHQUFHLEVBQUU7Z0JBQ1AsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNoQjtpQkFBTTtnQkFDTCxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNqQixHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7YUFDaEI7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUdEOzs7R0FH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UCxJQUFJLEVBQUUsZUFBUyxDQUFDLElBQUksQ0FBQztvQkFDckIsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFO29CQUNoQixJQUFJLGlCQUFzQztpQkFDM0MsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDO2lCQUNELEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUU7Z0JBQ2hCLEdBQUcsQ0FBQyxJQUFJLENBQUM7b0JBQ1AsSUFBSSxFQUFFLGVBQVMsQ0FBQyxJQUFJLENBQUM7b0JBQ3JCLElBQUksRUFBRSxJQUFJLElBQUksRUFBRTtvQkFDaEIsSUFBSSxpQkFBc0M7aUJBQzNDLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQztpQkFDRCxFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxFQUFFO2dCQUNuQixHQUFHLENBQUMsSUFBSSxDQUFDO29CQUNQLElBQUksRUFBRSxlQUFTLENBQUMsSUFBSSxDQUFDO29CQUNyQixJQUFJLEVBQUUsSUFBSSxJQUFJLEVBQUU7b0JBQ2hCLElBQUksaUJBQXNDO2lCQUMzQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztZQUVMLE9BQU8sR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDTCxtQkFBTyxFQUFFLEVBQ1Qsb0JBQVEsRUFBRSxDQUNYLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFwTEQsd0NBb0xDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgRU1QVFksIE9ic2VydmFibGUsIGNvbmNhdCwgZnJvbSBhcyBvYnNlcnZhYmxlRnJvbSwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHtcbiAgY29uY2F0TWFwLFxuICBpZ25vcmVFbGVtZW50cyxcbiAgbWFwLFxuICBtZXJnZU1hcCxcbiAgcHVibGlzaCxcbiAgcmVmQ291bnQsXG59IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7XG4gIFBhdGgsXG4gIFBhdGhGcmFnbWVudCxcbiAgZGlybmFtZSxcbiAgZnJhZ21lbnQsXG4gIGdldFN5c3RlbVBhdGgsXG4gIGpvaW4sXG4gIG5vcm1hbGl6ZSxcbiAgdmlydHVhbEZzLFxufSBmcm9tICcuLi9zcmMnO1xuXG5cbmludGVyZmFjZSBDaG9raWRhcldhdGNoZXIge1xuICBuZXcgKG9wdGlvbnM6IHt9KTogQ2hva2lkYXJXYXRjaGVyO1xuXG4gIGFkZChwYXRoOiBzdHJpbmcpOiBDaG9raWRhcldhdGNoZXI7XG4gIG9uKHR5cGU6ICdjaGFuZ2UnLCBjYjogKHBhdGg6IHN0cmluZykgPT4gdm9pZCk6IENob2tpZGFyV2F0Y2hlcjtcbiAgb24odHlwZTogJ2FkZCcsIGNiOiAocGF0aDogc3RyaW5nKSA9PiB2b2lkKTogQ2hva2lkYXJXYXRjaGVyO1xuICBvbih0eXBlOiAndW5saW5rJywgY2I6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQpOiBDaG9raWRhcldhdGNoZXI7XG5cbiAgY2xvc2UoKTogdm9pZDtcbn1cblxuLy8gVGhpcyB3aWxsIG9ubHkgYmUgaW5pdGlhbGl6ZWQgaWYgdGhlIHdhdGNoKCkgbWV0aG9kIGlzIGNhbGxlZC5cbi8vIE90aGVyd2lzZSBjaG9raWRhciBhcHBlYXJzIG9ubHkgaW4gdHlwZSBwb3NpdGlvbnMsIGFuZCBzaG91bGRuJ3QgYmUgcmVmZXJlbmNlZFxuLy8gaW4gdGhlIEphdmFTY3JpcHQgb3V0cHV0LlxubGV0IEZTV2F0Y2hlcjogQ2hva2lkYXJXYXRjaGVyO1xuZnVuY3Rpb24gbG9hZEZTV2F0Y2hlcigpIHtcbiAgaWYgKCFGU1dhdGNoZXIpIHtcbiAgICB0cnkge1xuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWltcGxpY2l0LWRlcGVuZGVuY2llc1xuICAgICAgRlNXYXRjaGVyID0gcmVxdWlyZSgnY2hva2lkYXInKS5GU1dhdGNoZXI7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUuY29kZSAhPT0gJ01PRFVMRV9OT1RfRk9VTkQnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQXMgb2YgYW5ndWxhci1kZXZraXQgdmVyc2lvbiA4LjAsIHRoZSBcImNob2tpZGFyXCIgcGFja2FnZSAnICtcbiAgICAgICAgICAgICdtdXN0IGJlIGluc3RhbGxlZCBpbiBvcmRlciB0byB1c2Ugd2F0Y2goKSBmZWF0dXJlcy4nKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG5cbnR5cGUgRnNGdW5jdGlvbjA8Uj4gPSAoY2I6IChlcnI/OiBFcnJvciwgcmVzdWx0PzogUikgPT4gdm9pZCkgPT4gdm9pZDtcbnR5cGUgRnNGdW5jdGlvbjE8UiwgVDE+ID0gKHAxOiBUMSwgY2I6IChlcnI/OiBFcnJvciwgcmVzdWx0PzogUikgPT4gdm9pZCkgPT4gdm9pZDtcbnR5cGUgRnNGdW5jdGlvbjI8UiwgVDEsIFQyPlxuICA9IChwMTogVDEsIHAyOiBUMiwgY2I6IChlcnI/OiBFcnJvciwgcmVzdWx0PzogUikgPT4gdm9pZCkgPT4gdm9pZDtcblxuXG5mdW5jdGlvbiBfY2FsbEZzPFI+KGZuOiBGc0Z1bmN0aW9uMDxSPik6IE9ic2VydmFibGU8Uj47XG5mdW5jdGlvbiBfY2FsbEZzPFIsIFQxPihmbjogRnNGdW5jdGlvbjE8UiwgVDE+LCBwMTogVDEpOiBPYnNlcnZhYmxlPFI+O1xuZnVuY3Rpb24gX2NhbGxGczxSLCBUMSwgVDI+KGZuOiBGc0Z1bmN0aW9uMjxSLCBUMSwgVDI+LCBwMTogVDEsIHAyOiBUMik6IE9ic2VydmFibGU8Uj47XG5cbmZ1bmN0aW9uIF9jYWxsRnM8UmVzdWx0VD4oZm46IEZ1bmN0aW9uLCAuLi5hcmdzOiB7fVtdKTogT2JzZXJ2YWJsZTxSZXN1bHRUPiB7XG4gIHJldHVybiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgIGZuKC4uLmFyZ3MsIChlcnI/OiBFcnJvciwgcmVzdWx0PzogUmVzdWx0VCkgPT4ge1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBvYnMuZXJyb3IoZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9icy5uZXh0KHJlc3VsdCk7XG4gICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cblxuXG4vKipcbiAqIEFuIGltcGxlbWVudGF0aW9uIG9mIHRoZSBWaXJ0dWFsIEZTIHVzaW5nIE5vZGUgYXMgdGhlIGJhY2tncm91bmQuIFRoZXJlIGFyZSB0d28gdmVyc2lvbnM7IG9uZVxuICogc3luY2hyb25vdXMgYW5kIG9uZSBhc3luY2hyb25vdXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBOb2RlSnNBc3luY0hvc3QgaW1wbGVtZW50cyB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4ge1xuICBnZXQgY2FwYWJpbGl0aWVzKCk6IHZpcnR1YWxGcy5Ib3N0Q2FwYWJpbGl0aWVzIHtcbiAgICByZXR1cm4geyBzeW5jaHJvbm91czogZmFsc2UgfTtcbiAgfVxuXG4gIHdyaXRlKHBhdGg6IFBhdGgsIGNvbnRlbnQ6IHZpcnR1YWxGcy5GaWxlQnVmZmVyKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlPHZvaWQ+KG9icyA9PiB7XG4gICAgICAvLyBDcmVhdGUgZm9sZGVycyBpZiBuZWNlc3NhcnkuXG4gICAgICBjb25zdCBfY3JlYXRlRGlyID0gKHBhdGg6IFBhdGgpID0+IHtcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRpcm5hbWUocGF0aCkgPT09IHBhdGgpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICBfY3JlYXRlRGlyKGRpcm5hbWUocGF0aCkpO1xuICAgICAgICBmcy5ta2RpclN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSk7XG4gICAgICB9O1xuICAgICAgX2NyZWF0ZURpcihkaXJuYW1lKHBhdGgpKTtcblxuICAgICAgX2NhbGxGczx2b2lkLCBzdHJpbmcsIFVpbnQ4QXJyYXk+KFxuICAgICAgICBmcy53cml0ZUZpbGUsXG4gICAgICAgIGdldFN5c3RlbVBhdGgocGF0aCksXG4gICAgICAgIG5ldyBVaW50OEFycmF5KGNvbnRlbnQpLFxuICAgICAgKS5zdWJzY3JpYmUob2JzKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlYWQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dmlydHVhbEZzLkZpbGVCdWZmZXI+IHtcbiAgICByZXR1cm4gX2NhbGxGcyhmcy5yZWFkRmlsZSwgZ2V0U3lzdGVtUGF0aChwYXRoKSkucGlwZShcbiAgICAgIG1hcChidWZmZXIgPT4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKS5idWZmZXIgYXMgdmlydHVhbEZzLkZpbGVCdWZmZXIpLFxuICAgICk7XG4gIH1cblxuICBkZWxldGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLmlzRGlyZWN0b3J5KHBhdGgpLnBpcGUoXG4gICAgICBtZXJnZU1hcChpc0RpcmVjdG9yeSA9PiB7XG4gICAgICAgIGlmIChpc0RpcmVjdG9yeSkge1xuICAgICAgICAgIGNvbnN0IGFsbEZpbGVzOiBQYXRoW10gPSBbXTtcbiAgICAgICAgICBjb25zdCBhbGxEaXJzOiBQYXRoW10gPSBbXTtcbiAgICAgICAgICBjb25zdCBfcmVjdXJzZUxpc3QgPSAocGF0aDogUGF0aCkgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBmcmFnbWVudCBvZiBmcy5yZWFkZGlyU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKSkge1xuICAgICAgICAgICAgICBpZiAoZnMuc3RhdFN5bmMoZ2V0U3lzdGVtUGF0aChqb2luKHBhdGgsIGZyYWdtZW50KSkpLmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICBfcmVjdXJzZUxpc3Qoam9pbihwYXRoLCBmcmFnbWVudCkpO1xuICAgICAgICAgICAgICAgIGFsbERpcnMucHVzaChqb2luKHBhdGgsIGZyYWdtZW50KSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxsRmlsZXMucHVzaChqb2luKHBhdGgsIGZyYWdtZW50KSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIF9yZWN1cnNlTGlzdChwYXRoKTtcblxuICAgICAgICAgIHJldHVybiBjb25jYXQoXG4gICAgICAgICAgICBvYnNlcnZhYmxlRnJvbShhbGxGaWxlcykucGlwZShcbiAgICAgICAgICAgICAgbWVyZ2VNYXAocCA9PiBfY2FsbEZzKGZzLnVubGluaywgZ2V0U3lzdGVtUGF0aChwKSkpLFxuICAgICAgICAgICAgICBpZ25vcmVFbGVtZW50cygpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIG9ic2VydmFibGVGcm9tKGFsbERpcnMpLnBpcGUoXG4gICAgICAgICAgICAgIGNvbmNhdE1hcChwID0+IF9jYWxsRnMoZnMucm1kaXIsIGdldFN5c3RlbVBhdGgocCkpKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gX2NhbGxGcyhmcy51bmxpbmssIGdldFN5c3RlbVBhdGgocGF0aCkpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIG1hcCgoKSA9PiB1bmRlZmluZWQpLFxuICAgICk7XG4gIH1cblxuICByZW5hbWUoZnJvbTogUGF0aCwgdG86IFBhdGgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gX2NhbGxGcyhmcy5yZW5hbWUsIGdldFN5c3RlbVBhdGgoZnJvbSksIGdldFN5c3RlbVBhdGgodG8pKTtcbiAgfVxuXG4gIGxpc3QocGF0aDogUGF0aCk6IE9ic2VydmFibGU8UGF0aEZyYWdtZW50W10+IHtcbiAgICByZXR1cm4gX2NhbGxGcyhmcy5yZWFkZGlyLCBnZXRTeXN0ZW1QYXRoKHBhdGgpKS5waXBlKFxuICAgICAgbWFwKG5hbWVzID0+IG5hbWVzLm1hcChuYW1lID0+IGZyYWdtZW50KG5hbWUpKSksXG4gICAgKTtcbiAgfVxuXG4gIGV4aXN0cyhwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgLy8gRXhpc3RzIGlzIGEgc3BlY2lhbCBjYXNlIGJlY2F1c2UgaXQgY2Fubm90IGVycm9yLlxuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgZnMuZXhpc3RzKHBhdGgsIGV4aXN0cyA9PiB7XG4gICAgICAgIG9icy5uZXh0KGV4aXN0cyk7XG4gICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBpc0RpcmVjdG9yeShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIF9jYWxsRnMoZnMuc3RhdCwgZ2V0U3lzdGVtUGF0aChwYXRoKSkucGlwZShcbiAgICAgIG1hcChzdGF0ID0+IHN0YXQuaXNEaXJlY3RvcnkoKSksXG4gICAgKTtcbiAgfVxuICBpc0ZpbGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiBfY2FsbEZzKGZzLnN0YXQsIGdldFN5c3RlbVBhdGgocGF0aCkpLnBpcGUoXG4gICAgICBtYXAoc3RhdCA9PiBzdGF0LmlzRGlyZWN0b3J5KCkpLFxuICAgICk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCBzdGF0LlxuICBzdGF0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5TdGF0czxmcy5TdGF0cz4+IHwgbnVsbCB7XG4gICAgcmV0dXJuIF9jYWxsRnMoZnMuc3RhdCwgZ2V0U3lzdGVtUGF0aChwYXRoKSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCB3YXRjaGluZy5cbiAgd2F0Y2goXG4gICAgcGF0aDogUGF0aCxcbiAgICBfb3B0aW9ucz86IHZpcnR1YWxGcy5Ib3N0V2F0Y2hPcHRpb25zLFxuICApOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudD4gfCBudWxsIHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8dmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50PihvYnMgPT4ge1xuICAgICAgbG9hZEZTV2F0Y2hlcigpO1xuICAgICAgY29uc3Qgd2F0Y2hlciA9IG5ldyBGU1dhdGNoZXIoeyBwZXJzaXN0ZW50OiB0cnVlIH0pLmFkZChnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcblxuICAgICAgd2F0Y2hlclxuICAgICAgICAub24oJ2NoYW5nZScsIHBhdGggPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkNoYW5nZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5vbignYWRkJywgcGF0aCA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuQ3JlYXRlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLm9uKCd1bmxpbmsnLCBwYXRoID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5EZWxldGVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgcmV0dXJuICgpID0+IHdhdGNoZXIuY2xvc2UoKTtcbiAgICB9KS5waXBlKFxuICAgICAgcHVibGlzaCgpLFxuICAgICAgcmVmQ291bnQoKSxcbiAgICApO1xuICB9XG59XG5cblxuLyoqXG4gKiBBbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgVmlydHVhbCBGUyB1c2luZyBOb2RlIGFzIHRoZSBiYWNrZW5kLCBzeW5jaHJvbm91c2x5LlxuICovXG5leHBvcnQgY2xhc3MgTm9kZUpzU3luY0hvc3QgaW1wbGVtZW50cyB2aXJ0dWFsRnMuSG9zdDxmcy5TdGF0cz4ge1xuICBnZXQgY2FwYWJpbGl0aWVzKCk6IHZpcnR1YWxGcy5Ib3N0Q2FwYWJpbGl0aWVzIHtcbiAgICByZXR1cm4geyBzeW5jaHJvbm91czogdHJ1ZSB9O1xuICB9XG5cbiAgd3JpdGUocGF0aDogUGF0aCwgY29udGVudDogdmlydHVhbEZzLkZpbGVCdWZmZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRyeStjYXRjaCB3aGVuIGlzc3VlIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzc0MCBpc1xuICAgICAgLy8gZml4ZWQuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBDcmVhdGUgZm9sZGVycyBpZiBuZWNlc3NhcnkuXG4gICAgICAgIGNvbnN0IF9jcmVhdGVEaXIgPSAocGF0aDogUGF0aCkgPT4ge1xuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIF9jcmVhdGVEaXIoZGlybmFtZShwYXRoKSk7XG4gICAgICAgICAgZnMubWtkaXJTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuICAgICAgICB9O1xuICAgICAgICBfY3JlYXRlRGlyKGRpcm5hbWUocGF0aCkpO1xuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGdldFN5c3RlbVBhdGgocGF0aCksIG5ldyBVaW50OEFycmF5KGNvbnRlbnQpKTtcblxuICAgICAgICBvYnMubmV4dCgpO1xuICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBvYnMuZXJyb3IoZXJyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHJlYWQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dmlydHVhbEZzLkZpbGVCdWZmZXI+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRyeStjYXRjaCB3aGVuIGlzc3VlIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzc0MCBpc1xuICAgICAgLy8gZml4ZWQuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSk7XG5cbiAgICAgICAgb2JzLm5leHQobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKS5idWZmZXIgYXMgdmlydHVhbEZzLkZpbGVCdWZmZXIpO1xuICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBvYnMuZXJyb3IoZXJyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuaXNEaXJlY3RvcnkocGF0aCkucGlwZShcbiAgICAgIGNvbmNhdE1hcChpc0RpciA9PiB7XG4gICAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRyeStjYXRjaCB3aGVuIGlzc3VlIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzc0MCBpc1xuICAgICAgICAvLyBmaXhlZC5cbiAgICAgICAgaWYgKGlzRGlyKSB7XG4gICAgICAgICAgY29uc3QgZGlyUGF0aHMgPSBmcy5yZWFkZGlyU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcbiAgICAgICAgICBjb25zdCBybURpckNvbXBsZXRlID0gbmV3IE9ic2VydmFibGU8dm9pZD4oKG9icykgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZnMucm1kaXJTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpO1xuICAgICAgICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgb2JzLmVycm9yKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIGNvbmNhdChcbiAgICAgICAgICAgIC4uLmRpclBhdGhzLm1hcChuYW1lID0+IHRoaXMuZGVsZXRlKGpvaW4ocGF0aCwgbmFtZSkpKSxcbiAgICAgICAgICAgIHJtRGlyQ29tcGxldGUsXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgZnMudW5saW5rU3luYyhnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKGVycik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIEVNUFRZO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmVuYW1lKGZyb206IFBhdGgsIHRvOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBPYnNlcnZhYmxlKG9icyA9PiB7XG4gICAgICAvLyBUT0RPOiByZW1vdmUgdGhpcyB0cnkrY2F0Y2ggd2hlbiBpc3N1ZSBodHRwczovL2dpdGh1Yi5jb20vUmVhY3RpdmVYL3J4anMvaXNzdWVzLzM3NDAgaXNcbiAgICAgIC8vIGZpeGVkLlxuICAgICAgdHJ5IHtcbiAgICAgICAgZnMucmVuYW1lU3luYyhnZXRTeXN0ZW1QYXRoKGZyb20pLCBnZXRTeXN0ZW1QYXRoKHRvKSk7XG4gICAgICAgIG9icy5uZXh0KCk7XG4gICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgbGlzdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxQYXRoRnJhZ21lbnRbXT4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgdHJ5K2NhdGNoIHdoZW4gaXNzdWUgaHR0cHM6Ly9naXRodWIuY29tL1JlYWN0aXZlWC9yeGpzL2lzc3Vlcy8zNzQwIGlzXG4gICAgICAvLyBmaXhlZC5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG5hbWVzID0gZnMucmVhZGRpclN5bmMoZ2V0U3lzdGVtUGF0aChwYXRoKSk7XG4gICAgICAgIG9icy5uZXh0KG5hbWVzLm1hcChuYW1lID0+IGZyYWdtZW50KG5hbWUpKSk7XG4gICAgICAgIG9icy5jb21wbGV0ZSgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZXhpc3RzKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGUob2JzID0+IHtcbiAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRyeStjYXRjaCB3aGVuIGlzc3VlIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdGl2ZVgvcnhqcy9pc3N1ZXMvMzc0MCBpc1xuICAgICAgLy8gZml4ZWQuXG4gICAgICB0cnkge1xuICAgICAgICBvYnMubmV4dChmcy5leGlzdHNTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpKTtcbiAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgb2JzLmVycm9yKGVycik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpc0RpcmVjdG9yeShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLW5vbi1udWxsLWFzc2VydGlvblxuICAgIHJldHVybiB0aGlzLnN0YXQocGF0aCkgIS5waXBlKG1hcChzdGF0ID0+IHN0YXQuaXNEaXJlY3RvcnkoKSkpO1xuICB9XG4gIGlzRmlsZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLW5vbi1udWxsLWFzc2VydGlvblxuICAgIHJldHVybiB0aGlzLnN0YXQocGF0aCkgIS5waXBlKG1hcChzdGF0ID0+IHN0YXQuaXNGaWxlKCkpKTtcbiAgfVxuXG4gIC8vIFNvbWUgaG9zdHMgbWF5IG5vdCBzdXBwb3J0IHN0YXQuXG4gIHN0YXQocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dmlydHVhbEZzLlN0YXRzPGZzLlN0YXRzPj4ge1xuICAgIHJldHVybiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgdHJ5K2NhdGNoIHdoZW4gaXNzdWUgaHR0cHM6Ly9naXRodWIuY29tL1JlYWN0aXZlWC9yeGpzL2lzc3Vlcy8zNzQwIGlzXG4gICAgICAvLyBmaXhlZC5cbiAgICAgIHRyeSB7XG4gICAgICAgIG9icy5uZXh0KGZzLnN0YXRTeW5jKGdldFN5c3RlbVBhdGgocGF0aCkpKTtcbiAgICAgICAgb2JzLmNvbXBsZXRlKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgb2JzLmVycm9yKGVycik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCB3YXRjaGluZy5cbiAgd2F0Y2goXG4gICAgcGF0aDogUGF0aCxcbiAgICBfb3B0aW9ucz86IHZpcnR1YWxGcy5Ib3N0V2F0Y2hPcHRpb25zLFxuICApOiBPYnNlcnZhYmxlPHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudD4gfCBudWxsIHtcbiAgICByZXR1cm4gbmV3IE9ic2VydmFibGU8dmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50PihvYnMgPT4ge1xuICAgICAgY29uc3Qgb3B0cyA9IHsgcGVyc2lzdGVudDogZmFsc2UgfTtcbiAgICAgIGxvYWRGU1dhdGNoZXIoKTtcbiAgICAgIGNvbnN0IHdhdGNoZXIgPSBuZXcgRlNXYXRjaGVyKG9wdHMpLmFkZChnZXRTeXN0ZW1QYXRoKHBhdGgpKTtcblxuICAgICAgd2F0Y2hlclxuICAgICAgICAub24oJ2NoYW5nZScsIHBhdGggPT4ge1xuICAgICAgICAgIG9icy5uZXh0KHtcbiAgICAgICAgICAgIHBhdGg6IG5vcm1hbGl6ZShwYXRoKSxcbiAgICAgICAgICAgIHRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB0eXBlOiB2aXJ0dWFsRnMuSG9zdFdhdGNoRXZlbnRUeXBlLkNoYW5nZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5vbignYWRkJywgcGF0aCA9PiB7XG4gICAgICAgICAgb2JzLm5leHQoe1xuICAgICAgICAgICAgcGF0aDogbm9ybWFsaXplKHBhdGgpLFxuICAgICAgICAgICAgdGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgIHR5cGU6IHZpcnR1YWxGcy5Ib3N0V2F0Y2hFdmVudFR5cGUuQ3JlYXRlZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLm9uKCd1bmxpbmsnLCBwYXRoID0+IHtcbiAgICAgICAgICBvYnMubmV4dCh7XG4gICAgICAgICAgICBwYXRoOiBub3JtYWxpemUocGF0aCksXG4gICAgICAgICAgICB0aW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgdHlwZTogdmlydHVhbEZzLkhvc3RXYXRjaEV2ZW50VHlwZS5EZWxldGVkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgcmV0dXJuICgpID0+IHdhdGNoZXIuY2xvc2UoKTtcbiAgICB9KS5waXBlKFxuICAgICAgcHVibGlzaCgpLFxuICAgICAgcmVmQ291bnQoKSxcbiAgICApO1xuICB9XG59XG4iXX0=