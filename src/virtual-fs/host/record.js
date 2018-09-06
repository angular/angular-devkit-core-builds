"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const exception_1 = require("../../exception");
const memory_1 = require("./memory");
/**
 * A Host that records changes to the underlying Host, while keeping a record of Create, Overwrite,
 * Rename and Delete of files.
 *
 * This is fully compatible with Host, but will keep a staging of every changes asked. That staging
 * follows the principle of the Tree (e.g. can create a file that already exists).
 *
 * Using `create()` and `overwrite()` will force those operations, but using `write` will add
 * the create/overwrite records IIF the files does/doesn't already exist.
 */
class CordHost extends memory_1.SimpleMemoryHost {
    constructor(_back) {
        super();
        this._back = _back;
        this._filesToCreate = new Set();
        this._filesToRename = new Map();
        this._filesToRenameRevert = new Map();
        this._filesToDelete = new Set();
        this._filesToOverwrite = new Set();
    }
    get backend() { return this._back; }
    get capabilities() {
        // Our own host is always Synchronous, but the backend might not be.
        return {
            synchronous: this._back.capabilities.synchronous,
        };
    }
    /**
     * Create a copy of this host, including all actions made.
     * @returns {CordHost} The carbon copy.
     */
    clone() {
        const dolly = new CordHost(this._back);
        dolly._cache = new Map(this._cache);
        dolly._filesToCreate = new Set(this._filesToCreate);
        dolly._filesToRename = new Map(this._filesToRename);
        dolly._filesToRenameRevert = new Map(this._filesToRenameRevert);
        dolly._filesToDelete = new Set(this._filesToDelete);
        dolly._filesToOverwrite = new Set(this._filesToOverwrite);
        return dolly;
    }
    /**
     * Commit the changes recorded to a Host. It is assumed that the host does have the same structure
     * as the host that was used for backend (could be the same host).
     * @param host The host to create/delete/rename/overwrite files to.
     * @param force Whether to skip existence checks when creating/overwriting. This is
     *   faster but might lead to incorrect states. Because Hosts natively don't support creation
     *   versus overwriting (it's only writing), we check for existence before completing a request.
     * @returns An observable that completes when done, or error if an error occured.
     */
    commit(host, force = false) {
        // Really commit everything to the actual host.
        return rxjs_1.from(this.records()).pipe(operators_1.concatMap(record => {
            switch (record.kind) {
                case 'delete': return host.delete(record.path);
                case 'rename': return host.rename(record.from, record.to);
                case 'create':
                    return host.exists(record.path).pipe(operators_1.switchMap(exists => {
                        if (exists && !force) {
                            return rxjs_1.throwError(new exception_1.FileAlreadyExistException(record.path));
                        }
                        else {
                            return host.write(record.path, record.content);
                        }
                    }));
                case 'overwrite':
                    return host.exists(record.path).pipe(operators_1.switchMap(exists => {
                        if (!exists && !force) {
                            return rxjs_1.throwError(new exception_1.FileDoesNotExistException(record.path));
                        }
                        else {
                            return host.write(record.path, record.content);
                        }
                    }));
            }
        }), operators_1.reduce(() => { }));
    }
    records() {
        return [
            ...[...this._filesToDelete.values()].map(path => ({
                kind: 'delete', path,
            })),
            ...[...this._filesToRename.entries()].map(([from, to]) => ({
                kind: 'rename', from, to,
            })),
            ...[...this._filesToCreate.values()].map(path => ({
                kind: 'create', path, content: this._read(path),
            })),
            ...[...this._filesToOverwrite.values()].map(path => ({
                kind: 'overwrite', path, content: this._read(path),
            })),
        ];
    }
    /**
     * Specialized version of {@link CordHost#write} which forces the creation of a file whether it
     * exists or not.
     * @param {} path
     * @param {FileBuffer} content
     * @returns {Observable<void>}
     */
    create(path, content) {
        if (super._exists(path)) {
            throw new exception_1.FileAlreadyExistException(path);
        }
        if (this._filesToDelete.has(path)) {
            this._filesToDelete.delete(path);
            this._filesToOverwrite.add(path);
        }
        else {
            this._filesToCreate.add(path);
        }
        return super.write(path, content);
    }
    overwrite(path, content) {
        return this.isDirectory(path).pipe(operators_1.switchMap(isDir => {
            if (isDir) {
                return rxjs_1.throwError(new exception_1.PathIsDirectoryException(path));
            }
            return this.exists(path);
        }), operators_1.switchMap(exists => {
            if (!exists) {
                return rxjs_1.throwError(new exception_1.FileDoesNotExistException(path));
            }
            if (!this._filesToCreate.has(path)) {
                this._filesToOverwrite.add(path);
            }
            return super.write(path, content);
        }));
    }
    write(path, content) {
        return this.exists(path).pipe(operators_1.switchMap(exists => {
            if (exists) {
                // It exists, but might be being renamed or deleted. In that case we want to create it.
                if (this.willRename(path) || this.willDelete(path)) {
                    return this.create(path, content);
                }
                else {
                    return this.overwrite(path, content);
                }
            }
            else {
                return this.create(path, content);
            }
        }));
    }
    read(path) {
        if (this._exists(path)) {
            return super.read(path);
        }
        return this._back.read(path);
    }
    delete(path) {
        if (this._exists(path)) {
            if (this._filesToCreate.has(path)) {
                this._filesToCreate.delete(path);
            }
            else if (this._filesToOverwrite.has(path)) {
                this._filesToOverwrite.delete(path);
                this._filesToDelete.add(path);
            }
            else {
                const maybeOrigin = this._filesToRenameRevert.get(path);
                if (maybeOrigin) {
                    this._filesToRenameRevert.delete(path);
                    this._filesToRename.delete(maybeOrigin);
                    this._filesToDelete.add(maybeOrigin);
                }
                else {
                    return rxjs_1.throwError(new exception_1.UnknownException(`This should never happen. Path: ${JSON.stringify(path)}.`));
                }
            }
            return super.delete(path);
        }
        else {
            return this._back.exists(path).pipe(operators_1.switchMap(exists => {
                if (exists) {
                    this._filesToDelete.add(path);
                    return rxjs_1.of();
                }
                else {
                    return rxjs_1.throwError(new exception_1.FileDoesNotExistException(path));
                }
            }));
        }
    }
    rename(from, to) {
        return rxjs_1.concat(this.exists(to), this.exists(from)).pipe(operators_1.toArray(), operators_1.switchMap(([existTo, existFrom]) => {
            if (!existFrom) {
                return rxjs_1.throwError(new exception_1.FileDoesNotExistException(from));
            }
            if (from === to) {
                return rxjs_1.of();
            }
            if (existTo) {
                return rxjs_1.throwError(new exception_1.FileAlreadyExistException(to));
            }
            // If we're renaming a file that's been created, shortcircuit to creating the `to` path.
            if (this._filesToCreate.has(from)) {
                this._filesToCreate.delete(from);
                this._filesToCreate.add(to);
                return super.rename(from, to);
            }
            if (this._filesToOverwrite.has(from)) {
                this._filesToOverwrite.delete(from);
                // Recursively call this function. This is so we don't repeat the bottom logic. This
                // if will be by-passed because we just deleted the `from` path from files to overwrite.
                return rxjs_1.concat(this.rename(from, to), new rxjs_1.Observable(x => {
                    this._filesToOverwrite.add(to);
                    x.complete();
                }));
            }
            if (this._filesToDelete.has(to)) {
                this._filesToDelete.delete(to);
                this._filesToDelete.add(from);
                this._filesToOverwrite.add(to);
                // We need to delete the original and write the new one.
                return this.read(from).pipe(operators_1.map(content => this._write(to, content)));
            }
            const maybeTo1 = this._filesToRenameRevert.get(from);
            if (maybeTo1) {
                // We already renamed to this file (A => from), let's rename the former to the new
                // path (A => to).
                this._filesToRename.delete(maybeTo1);
                this._filesToRenameRevert.delete(from);
                from = maybeTo1;
            }
            this._filesToRename.set(from, to);
            this._filesToRenameRevert.set(to, from);
            // If the file is part of our data, just rename it internally.
            if (this._exists(from)) {
                return super.rename(from, to);
            }
            else {
                // Create a file with the same content.
                return this._back.read(from).pipe(operators_1.switchMap(content => super.write(to, content)));
            }
        }));
    }
    list(path) {
        return rxjs_1.concat(super.list(path), this._back.list(path)).pipe(operators_1.reduce((list, curr) => {
            curr.forEach(elem => list.add(elem));
            return list;
        }, new Set()), operators_1.map(set => [...set]));
    }
    exists(path) {
        return this._exists(path)
            ? rxjs_1.of(true)
            : ((this.willDelete(path) || this.willRename(path)) ? rxjs_1.of(false) : this._back.exists(path));
    }
    isDirectory(path) {
        return this._exists(path) ? super.isDirectory(path) : this._back.isDirectory(path);
    }
    isFile(path) {
        return this._exists(path)
            ? super.isFile(path)
            : ((this.willDelete(path) || this.willRename(path)) ? rxjs_1.of(false) : this._back.isFile(path));
    }
    stat(path) {
        // TODO: stat should be possible to implement, at least from memory.
        return null;
    }
    watch(path, options) {
        // Watching not supported.
        return null;
    }
    willCreate(path) {
        return this._filesToCreate.has(path);
    }
    willOverwrite(path) {
        return this._filesToOverwrite.has(path);
    }
    willDelete(path) {
        return this._filesToDelete.has(path);
    }
    willRename(path) {
        return this._filesToRename.has(path);
    }
    willRenameTo(path, to) {
        return this._filesToRename.get(path) === to;
    }
}
exports.CordHost = CordHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjb3JkLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy92aXJ0dWFsLWZzL2hvc3QvcmVjb3JkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsK0JBTWM7QUFDZCw4Q0FBNEU7QUFDNUUsK0NBS3lCO0FBU3pCLHFDQUE0QztBQTRCNUM7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxRQUFTLFNBQVEseUJBQWdCO0lBTzVDLFlBQXNCLEtBQW1CO1FBQUksS0FBSyxFQUFFLENBQUM7UUFBL0IsVUFBSyxHQUFMLEtBQUssQ0FBYztRQU4vQixtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFRLENBQUM7UUFDakMsbUJBQWMsR0FBRyxJQUFJLEdBQUcsRUFBYyxDQUFDO1FBQ3ZDLHlCQUFvQixHQUFHLElBQUksR0FBRyxFQUFjLENBQUM7UUFDN0MsbUJBQWMsR0FBRyxJQUFJLEdBQUcsRUFBUSxDQUFDO1FBQ2pDLHNCQUFpQixHQUFHLElBQUksR0FBRyxFQUFRLENBQUM7SUFFUSxDQUFDO0lBRXZELElBQUksT0FBTyxLQUFtQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ2xELElBQUksWUFBWTtRQUNkLG9FQUFvRTtRQUNwRSxPQUFPO1lBQ0wsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLFdBQVc7U0FDakQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLO1FBQ0gsTUFBTSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXZDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFD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Q0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMvRixDQUFDO0lBRUQsSUFBSSxDQUFDLElBQVU7UUFDYixvRUFBb0U7UUFDcEUsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQVUsRUFBRSxPQUEwQjtRQUMxQywwQkFBMEI7UUFDMUIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsVUFBVSxDQUFDLElBQVU7UUFDbkIsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBQ0QsYUFBYSxDQUFDLElBQVU7UUFDdEIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFDRCxVQUFVLENBQUMsSUFBVTtRQUNuQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFDRCxVQUFVLENBQUMsSUFBVTtRQUNuQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFDRCxZQUFZLENBQUMsSUFBVSxFQUFFLEVBQVE7UUFDL0IsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDOUMsQ0FBQztDQUNGO0FBdFVELDRCQXNVQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7XG4gIE9ic2VydmFibGUsXG4gIGNvbmNhdCxcbiAgZnJvbSBhcyBvYnNlcnZhYmxlRnJvbSxcbiAgb2YsXG4gIHRocm93RXJyb3IsXG59IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHJlZHVjZSwgc3dpdGNoTWFwLCB0b0FycmF5IH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgRmlsZUFscmVhZHlFeGlzdEV4Y2VwdGlvbixcbiAgRmlsZURvZXNOb3RFeGlzdEV4Y2VwdGlvbixcbiAgUGF0aElzRGlyZWN0b3J5RXhjZXB0aW9uLFxuICBVbmtub3duRXhjZXB0aW9uLFxufSBmcm9tICcuLi8uLi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGF0aCwgUGF0aEZyYWdtZW50IH0gZnJvbSAnLi4vcGF0aCc7XG5pbXBvcnQge1xuICBGaWxlQnVmZmVyLFxuICBIb3N0LFxuICBIb3N0Q2FwYWJpbGl0aWVzLFxuICBIb3N0V2F0Y2hPcHRpb25zLFxuICBSZWFkb25seUhvc3QsXG59IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7IFNpbXBsZU1lbW9yeUhvc3QgfSBmcm9tICcuL21lbW9yeSc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBDb3JkSG9zdENyZWF0ZSB7XG4gIGtpbmQ6ICdjcmVhdGUnO1xuICBwYXRoOiBQYXRoO1xuICBjb250ZW50OiBGaWxlQnVmZmVyO1xufVxuZXhwb3J0IGludGVyZmFjZSBDb3JkSG9zdE92ZXJ3cml0ZSB7XG4gIGtpbmQ6ICdvdmVyd3JpdGUnO1xuICBwYXRoOiBQYXRoO1xuICBjb250ZW50OiBGaWxlQnVmZmVyO1xufVxuZXhwb3J0IGludGVyZmFjZSBDb3JkSG9zdFJlbmFtZSB7XG4gIGtpbmQ6ICdyZW5hbWUnO1xuICBmcm9tOiBQYXRoO1xuICB0bzogUGF0aDtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgQ29yZEhvc3REZWxldGUge1xuICBraW5kOiAnZGVsZXRlJztcbiAgcGF0aDogUGF0aDtcbn1cbmV4cG9ydCB0eXBlIENvcmRIb3N0UmVjb3JkID0gQ29yZEhvc3RDcmVhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgQ29yZEhvc3RPdmVyd3JpdGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgQ29yZEhvc3RSZW5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHwgQ29yZEhvc3REZWxldGU7XG5cblxuLyoqXG4gKiBBIEhvc3QgdGhhdCByZWNvcmRzIGNoYW5nZXMgdG8gdGhlIHVuZGVybHlpbmcgSG9zdCwgd2hpbGUga2VlcGluZyBhIHJlY29yZCBvZiBDcmVhdGUsIE92ZXJ3cml0ZSxcbiAqIFJlbmFtZSBhbmQgRGVsZXRlIG9mIGZpbGVzLlxuICpcbiAqIFRoaXMgaXMgZnVsbHkgY29tcGF0aWJsZSB3aXRoIEhvc3QsIGJ1dCB3aWxsIGtlZXAgYSBzdGFnaW5nIG9mIGV2ZXJ5IGNoYW5nZXMgYXNrZWQuIFRoYXQgc3RhZ2luZ1xuICogZm9sbG93cyB0aGUgcHJpbmNpcGxlIG9mIHRoZSBUcmVlIChlLmcuIGNhbiBjcmVhdGUgYSBmaWxlIHRoYXQgYWxyZWFkeSBleGlzdHMpLlxuICpcbiAqIFVzaW5nIGBjcmVhdGUoKWAgYW5kIGBvdmVyd3JpdGUoKWAgd2lsbCBmb3JjZSB0aG9zZSBvcGVyYXRpb25zLCBidXQgdXNpbmcgYHdyaXRlYCB3aWxsIGFkZFxuICogdGhlIGNyZWF0ZS9vdmVyd3JpdGUgcmVjb3JkcyBJSUYgdGhlIGZpbGVzIGRvZXMvZG9lc24ndCBhbHJlYWR5IGV4aXN0LlxuICovXG5leHBvcnQgY2xhc3MgQ29yZEhvc3QgZXh0ZW5kcyBTaW1wbGVNZW1vcnlIb3N0IHtcbiAgcHJvdGVjdGVkIF9maWxlc1RvQ3JlYXRlID0gbmV3IFNldDxQYXRoPigpO1xuICBwcm90ZWN0ZWQgX2ZpbGVzVG9SZW5hbWUgPSBuZXcgTWFwPFBhdGgsIFBhdGg+KCk7XG4gIHByb3RlY3RlZCBfZmlsZXNUb1JlbmFtZVJldmVydCA9IG5ldyBNYXA8UGF0aCwgUGF0aD4oKTtcbiAgcHJvdGVjdGVkIF9maWxlc1RvRGVsZXRlID0gbmV3IFNldDxQYXRoPigpO1xuICBwcm90ZWN0ZWQgX2ZpbGVzVG9PdmVyd3JpdGUgPSBuZXcgU2V0PFBhdGg+KCk7XG5cbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIF9iYWNrOiBSZWFkb25seUhvc3QpIHsgc3VwZXIoKTsgfVxuXG4gIGdldCBiYWNrZW5kKCk6IFJlYWRvbmx5SG9zdCB7IHJldHVybiB0aGlzLl9iYWNrOyB9XG4gIGdldCBjYXBhYmlsaXRpZXMoKTogSG9zdENhcGFiaWxpdGllcyB7XG4gICAgLy8gT3VyIG93biBob3N0IGlzIGFsd2F5cyBTeW5jaHJvbm91cywgYnV0IHRoZSBiYWNrZW5kIG1pZ2h0IG5vdCBiZS5cbiAgICByZXR1cm4ge1xuICAgICAgc3luY2hyb25vdXM6IHRoaXMuX2JhY2suY2FwYWJpbGl0aWVzLnN5bmNocm9ub3VzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29weSBvZiB0aGlzIGhvc3QsIGluY2x1ZGluZyBhbGwgYWN0aW9ucyBtYWRlLlxuICAgKiBAcmV0dXJucyB7Q29yZEhvc3R9IFRoZSBjYXJib24gY29weS5cbiAgICovXG4gIGNsb25lKCk6IENvcmRIb3N0IHtcbiAgICBjb25zdCBkb2xseSA9IG5ldyBDb3JkSG9zdCh0aGlzLl9iYWNrKTtcblxuICAgIGRvbGx5Ll9jYWNoZSA9IG5ldyBNYXAodGhpcy5fY2FjaGUpO1xuICAgIGRvbGx5Ll9maWxlc1RvQ3JlYXRlID0gbmV3IFNldCh0aGlzLl9maWxlc1RvQ3JlYXRlKTtcbiAgICBkb2xseS5fZmlsZXNUb1JlbmFtZSA9IG5ldyBNYXAodGhpcy5fZmlsZXNUb1JlbmFtZSk7XG4gICAgZG9sbHkuX2ZpbGVzVG9SZW5hbWVSZXZlcnQgPSBuZXcgTWFwKHRoaXMuX2ZpbGVzVG9SZW5hbWVSZXZlcnQpO1xuICAgIGRvbGx5Ll9maWxlc1RvRGVsZXRlID0gbmV3IFNldCh0aGlzLl9maWxlc1RvRGVsZXRlKTtcbiAgICBkb2xseS5fZmlsZXNUb092ZXJ3cml0ZSA9IG5ldyBTZXQodGhpcy5fZmlsZXNUb092ZXJ3cml0ZSk7XG5cbiAgICByZXR1cm4gZG9sbHk7XG4gIH1cblxuICAvKipcbiAgICogQ29tbWl0IHRoZSBjaGFuZ2VzIHJlY29yZGVkIHRvIGEgSG9zdC4gSXQgaXMgYXNzdW1lZCB0aGF0IHRoZSBob3N0IGRvZXMgaGF2ZSB0aGUgc2FtZSBzdHJ1Y3R1cmVcbiAgICogYXMgdGhlIGhvc3QgdGhhdCB3YXMgdXNlZCBmb3IgYmFja2VuZCAoY291bGQgYmUgdGhlIHNhbWUgaG9zdCkuXG4gICAqIEBwYXJhbSBob3N0IFRoZSBob3N0IHRvIGNyZWF0ZS9kZWxldGUvcmVuYW1lL292ZXJ3cml0ZSBmaWxlcyB0by5cbiAgICogQHBhcmFtIGZvcmNlIFdoZXRoZXIgdG8gc2tpcCBleGlzdGVuY2UgY2hlY2tzIHdoZW4gY3JlYXRpbmcvb3ZlcndyaXRpbmcuIFRoaXMgaXNcbiAgICogICBmYXN0ZXIgYnV0IG1pZ2h0IGxlYWQgdG8gaW5jb3JyZWN0IHN0YXRlcy4gQmVjYXVzZSBIb3N0cyBuYXRpdmVseSBkb24ndCBzdXBwb3J0IGNyZWF0aW9uXG4gICAqICAgdmVyc3VzIG92ZXJ3cml0aW5nIChpdCdzIG9ubHkgd3JpdGluZyksIHdlIGNoZWNrIGZvciBleGlzdGVuY2UgYmVmb3JlIGNvbXBsZXRpbmcgYSByZXF1ZXN0LlxuICAgKiBAcmV0dXJucyBBbiBvYnNlcnZhYmxlIHRoYXQgY29tcGxldGVzIHdoZW4gZG9uZSwgb3IgZXJyb3IgaWYgYW4gZXJyb3Igb2NjdXJlZC5cbiAgICovXG4gIGNvbW1pdChob3N0OiBIb3N0LCBmb3JjZSA9IGZhbHNlKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgLy8gUmVhbGx5IGNvbW1pdCBldmVyeXRoaW5nIHRvIHRoZSBhY3R1YWwgaG9zdC5cbiAgICByZXR1cm4gb2JzZXJ2YWJsZUZyb20odGhpcy5yZWNvcmRzKCkpLnBpcGUoXG4gICAgICBjb25jYXRNYXAocmVjb3JkID0+IHtcbiAgICAgICAgc3dpdGNoIChyZWNvcmQua2luZCkge1xuICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6IHJldHVybiBob3N0LmRlbGV0ZShyZWNvcmQucGF0aCk7XG4gICAgICAgICAgY2FzZSAncmVuYW1lJzogcmV0dXJuIGhvc3QucmVuYW1lKHJlY29yZC5mcm9tLCByZWNvcmQudG8pO1xuICAgICAgICAgIGNhc2UgJ2NyZWF0ZSc6XG4gICAgICAgICAgICByZXR1cm4gaG9zdC5leGlzdHMocmVjb3JkLnBhdGgpLnBpcGUoXG4gICAgICAgICAgICAgIHN3aXRjaE1hcChleGlzdHMgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChleGlzdHMgJiYgIWZvcmNlKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihuZXcgRmlsZUFscmVhZHlFeGlzdEV4Y2VwdGlvbihyZWNvcmQucGF0aCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gaG9zdC53cml0ZShyZWNvcmQucGF0aCwgcmVjb3JkLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIGNhc2UgJ292ZXJ3cml0ZSc6XG4gICAgICAgICAgICByZXR1cm4gaG9zdC5leGlzdHMocmVjb3JkLnBhdGgpLnBpcGUoXG4gICAgICAgICAgICAgIHN3aXRjaE1hcChleGlzdHMgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghZXhpc3RzICYmICFmb3JjZSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IobmV3IEZpbGVEb2VzTm90RXhpc3RFeGNlcHRpb24ocmVjb3JkLnBhdGgpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGhvc3Qud3JpdGUocmVjb3JkLnBhdGgsIHJlY29yZC5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICByZWR1Y2UoKCkgPT4ge30pLFxuICAgICk7XG4gIH1cblxuICByZWNvcmRzKCk6IENvcmRIb3N0UmVjb3JkW10ge1xuICAgIHJldHVybiBbXG4gICAgICAuLi5bLi4udGhpcy5fZmlsZXNUb0RlbGV0ZS52YWx1ZXMoKV0ubWFwKHBhdGggPT4gKHtcbiAgICAgICAga2luZDogJ2RlbGV0ZScsIHBhdGgsXG4gICAgICB9KSBhcyBDb3JkSG9zdFJlY29yZCksXG4gICAgICAuLi5bLi4udGhpcy5fZmlsZXNUb1JlbmFtZS5lbnRyaWVzKCldLm1hcCgoW2Zyb20sIHRvXSkgPT4gKHtcbiAgICAgICAga2luZDogJ3JlbmFtZScsIGZyb20sIHRvLFxuICAgICAgfSkgYXMgQ29yZEhvc3RSZWNvcmQpLFxuICAgICAgLi4uWy4uLnRoaXMuX2ZpbGVzVG9DcmVhdGUudmFsdWVzKCldLm1hcChwYXRoID0+ICh7XG4gICAgICAgIGtpbmQ6ICdjcmVhdGUnLCBwYXRoLCBjb250ZW50OiB0aGlzLl9yZWFkKHBhdGgpLFxuICAgICAgfSkgYXMgQ29yZEhvc3RSZWNvcmQpLFxuICAgICAgLi4uWy4uLnRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUudmFsdWVzKCldLm1hcChwYXRoID0+ICh7XG4gICAgICAgIGtpbmQ6ICdvdmVyd3JpdGUnLCBwYXRoLCBjb250ZW50OiB0aGlzLl9yZWFkKHBhdGgpLFxuICAgICAgfSkgYXMgQ29yZEhvc3RSZWNvcmQpLFxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICogU3BlY2lhbGl6ZWQgdmVyc2lvbiBvZiB7QGxpbmsgQ29yZEhvc3Qjd3JpdGV9IHdoaWNoIGZvcmNlcyB0aGUgY3JlYXRpb24gb2YgYSBmaWxlIHdoZXRoZXIgaXRcbiAgICogZXhpc3RzIG9yIG5vdC5cbiAgICogQHBhcmFtIHt9IHBhdGhcbiAgICogQHBhcmFtIHtGaWxlQnVmZmVyfSBjb250ZW50XG4gICAqIEByZXR1cm5zIHtPYnNlcnZhYmxlPHZvaWQ+fVxuICAgKi9cbiAgY3JlYXRlKHBhdGg6IFBhdGgsIGNvbnRlbnQ6IEZpbGVCdWZmZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICBpZiAoc3VwZXIuX2V4aXN0cyhwYXRoKSkge1xuICAgICAgdGhyb3cgbmV3IEZpbGVBbHJlYWR5RXhpc3RFeGNlcHRpb24ocGF0aCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2ZpbGVzVG9EZWxldGUuaGFzKHBhdGgpKSB7XG4gICAgICB0aGlzLl9maWxlc1RvRGVsZXRlLmRlbGV0ZShwYXRoKTtcbiAgICAgIHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUuYWRkKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9maWxlc1RvQ3JlYXRlLmFkZChwYXRoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VwZXIud3JpdGUocGF0aCwgY29udGVudCk7XG4gIH1cblxuICBvdmVyd3JpdGUocGF0aDogUGF0aCwgY29udGVudDogRmlsZUJ1ZmZlcik6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLmlzRGlyZWN0b3J5KHBhdGgpLnBpcGUoXG4gICAgICBzd2l0Y2hNYXAoaXNEaXIgPT4ge1xuICAgICAgICBpZiAoaXNEaXIpIHtcbiAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihuZXcgUGF0aElzRGlyZWN0b3J5RXhjZXB0aW9uKHBhdGgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmV4aXN0cyhwYXRoKTtcbiAgICAgIH0pLFxuICAgICAgc3dpdGNoTWFwKGV4aXN0cyA9PiB7XG4gICAgICAgIGlmICghZXhpc3RzKSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IobmV3IEZpbGVEb2VzTm90RXhpc3RFeGNlcHRpb24ocGF0aCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9maWxlc1RvQ3JlYXRlLmhhcyhwYXRoKSkge1xuICAgICAgICAgIHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUuYWRkKHBhdGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN1cGVyLndyaXRlKHBhdGgsIGNvbnRlbnQpO1xuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHdyaXRlKHBhdGg6IFBhdGgsIGNvbnRlbnQ6IEZpbGVCdWZmZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5leGlzdHMocGF0aCkucGlwZShcbiAgICAgIHN3aXRjaE1hcChleGlzdHMgPT4ge1xuICAgICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgICAgLy8gSXQgZXhpc3RzLCBidXQgbWlnaHQgYmUgYmVpbmcgcmVuYW1lZCBvciBkZWxldGVkLiBJbiB0aGF0IGNhc2Ugd2Ugd2FudCB0byBjcmVhdGUgaXQuXG4gICAgICAgICAgaWYgKHRoaXMud2lsbFJlbmFtZShwYXRoKSB8fCB0aGlzLndpbGxEZWxldGUocGF0aCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZShwYXRoLCBjb250ZW50KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3ZlcndyaXRlKHBhdGgsIGNvbnRlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGUocGF0aCwgY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICByZWFkKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPEZpbGVCdWZmZXI+IHtcbiAgICBpZiAodGhpcy5fZXhpc3RzKHBhdGgpKSB7XG4gICAgICByZXR1cm4gc3VwZXIucmVhZChwYXRoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5fYmFjay5yZWFkKHBhdGgpO1xuICB9XG5cbiAgZGVsZXRlKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5fZXhpc3RzKHBhdGgpKSB7XG4gICAgICBpZiAodGhpcy5fZmlsZXNUb0NyZWF0ZS5oYXMocGF0aCkpIHtcbiAgICAgICAgdGhpcy5fZmlsZXNUb0NyZWF0ZS5kZWxldGUocGF0aCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUuaGFzKHBhdGgpKSB7XG4gICAgICAgIHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUuZGVsZXRlKHBhdGgpO1xuICAgICAgICB0aGlzLl9maWxlc1RvRGVsZXRlLmFkZChwYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG1heWJlT3JpZ2luID0gdGhpcy5fZmlsZXNUb1JlbmFtZVJldmVydC5nZXQocGF0aCk7XG4gICAgICAgIGlmIChtYXliZU9yaWdpbikge1xuICAgICAgICAgIHRoaXMuX2ZpbGVzVG9SZW5hbWVSZXZlcnQuZGVsZXRlKHBhdGgpO1xuICAgICAgICAgIHRoaXMuX2ZpbGVzVG9SZW5hbWUuZGVsZXRlKG1heWJlT3JpZ2luKTtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvRGVsZXRlLmFkZChtYXliZU9yaWdpbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoXG4gICAgICAgICAgICBuZXcgVW5rbm93bkV4Y2VwdGlvbihgVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuLiBQYXRoOiAke0pTT04uc3RyaW5naWZ5KHBhdGgpfS5gKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzdXBlci5kZWxldGUocGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9iYWNrLmV4aXN0cyhwYXRoKS5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoZXhpc3RzID0+IHtcbiAgICAgICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgICAgICB0aGlzLl9maWxlc1RvRGVsZXRlLmFkZChwYXRoKTtcblxuICAgICAgICAgICAgcmV0dXJuIG9mPHZvaWQ+KCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKG5ldyBGaWxlRG9lc05vdEV4aXN0RXhjZXB0aW9uKHBhdGgpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICByZW5hbWUoZnJvbTogUGF0aCwgdG86IFBhdGgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gY29uY2F0KFxuICAgICAgdGhpcy5leGlzdHModG8pLFxuICAgICAgdGhpcy5leGlzdHMoZnJvbSksXG4gICAgKS5waXBlKFxuICAgICAgdG9BcnJheSgpLFxuICAgICAgc3dpdGNoTWFwKChbZXhpc3RUbywgZXhpc3RGcm9tXSkgPT4ge1xuICAgICAgICBpZiAoIWV4aXN0RnJvbSkge1xuICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKG5ldyBGaWxlRG9lc05vdEV4aXN0RXhjZXB0aW9uKGZyb20pKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZnJvbSA9PT0gdG8pIHtcbiAgICAgICAgICByZXR1cm4gb2YoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChleGlzdFRvKSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IobmV3IEZpbGVBbHJlYWR5RXhpc3RFeGNlcHRpb24odG8pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHdlJ3JlIHJlbmFtaW5nIGEgZmlsZSB0aGF0J3MgYmVlbiBjcmVhdGVkLCBzaG9ydGNpcmN1aXQgdG8gY3JlYXRpbmcgdGhlIGB0b2AgcGF0aC5cbiAgICAgICAgaWYgKHRoaXMuX2ZpbGVzVG9DcmVhdGUuaGFzKGZyb20pKSB7XG4gICAgICAgICAgdGhpcy5fZmlsZXNUb0NyZWF0ZS5kZWxldGUoZnJvbSk7XG4gICAgICAgICAgdGhpcy5fZmlsZXNUb0NyZWF0ZS5hZGQodG8pO1xuXG4gICAgICAgICAgcmV0dXJuIHN1cGVyLnJlbmFtZShmcm9tLCB0byk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUuaGFzKGZyb20pKSB7XG4gICAgICAgICAgdGhpcy5fZmlsZXNUb092ZXJ3cml0ZS5kZWxldGUoZnJvbSk7XG5cbiAgICAgICAgICAvLyBSZWN1cnNpdmVseSBjYWxsIHRoaXMgZnVuY3Rpb24uIFRoaXMgaXMgc28gd2UgZG9uJ3QgcmVwZWF0IHRoZSBib3R0b20gbG9naWMuIFRoaXNcbiAgICAgICAgICAvLyBpZiB3aWxsIGJlIGJ5LXBhc3NlZCBiZWNhdXNlIHdlIGp1c3QgZGVsZXRlZCB0aGUgYGZyb21gIHBhdGggZnJvbSBmaWxlcyB0byBvdmVyd3JpdGUuXG4gICAgICAgICAgcmV0dXJuIGNvbmNhdChcbiAgICAgICAgICAgIHRoaXMucmVuYW1lKGZyb20sIHRvKSxcbiAgICAgICAgICAgIG5ldyBPYnNlcnZhYmxlPG5ldmVyPih4ID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5fZmlsZXNUb092ZXJ3cml0ZS5hZGQodG8pO1xuICAgICAgICAgICAgICB4LmNvbXBsZXRlKCk7XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9maWxlc1RvRGVsZXRlLmhhcyh0bykpIHtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvRGVsZXRlLmRlbGV0ZSh0byk7XG4gICAgICAgICAgdGhpcy5fZmlsZXNUb0RlbGV0ZS5hZGQoZnJvbSk7XG4gICAgICAgICAgdGhpcy5fZmlsZXNUb092ZXJ3cml0ZS5hZGQodG8pO1xuXG4gICAgICAgICAgLy8gV2UgbmVlZCB0byBkZWxldGUgdGhlIG9yaWdpbmFsIGFuZCB3cml0ZSB0aGUgbmV3IG9uZS5cbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkKGZyb20pLnBpcGUoXG4gICAgICAgICAgICBtYXAoY29udGVudCA9PiB0aGlzLl93cml0ZSh0bywgY29udGVudCkpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYXliZVRvMSA9IHRoaXMuX2ZpbGVzVG9SZW5hbWVSZXZlcnQuZ2V0KGZyb20pO1xuICAgICAgICBpZiAobWF5YmVUbzEpIHtcbiAgICAgICAgICAvLyBXZSBhbHJlYWR5IHJlbmFtZWQgdG8gdGhpcyBmaWxlIChBID0+IGZyb20pLCBsZXQncyByZW5hbWUgdGhlIGZvcm1lciB0byB0aGUgbmV3XG4gICAgICAgICAgLy8gcGF0aCAoQSA9PiB0bykuXG4gICAgICAgICAgdGhpcy5fZmlsZXNUb1JlbmFtZS5kZWxldGUobWF5YmVUbzEpO1xuICAgICAgICAgIHRoaXMuX2ZpbGVzVG9SZW5hbWVSZXZlcnQuZGVsZXRlKGZyb20pO1xuICAgICAgICAgIGZyb20gPSBtYXliZVRvMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZpbGVzVG9SZW5hbWUuc2V0KGZyb20sIHRvKTtcbiAgICAgICAgdGhpcy5fZmlsZXNUb1JlbmFtZVJldmVydC5zZXQodG8sIGZyb20pO1xuXG4gICAgICAgIC8vIElmIHRoZSBmaWxlIGlzIHBhcnQgb2Ygb3VyIGRhdGEsIGp1c3QgcmVuYW1lIGl0IGludGVybmFsbHkuXG4gICAgICAgIGlmICh0aGlzLl9leGlzdHMoZnJvbSkpIHtcbiAgICAgICAgICByZXR1cm4gc3VwZXIucmVuYW1lKGZyb20sIHRvKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBDcmVhdGUgYSBmaWxlIHdpdGggdGhlIHNhbWUgY29udGVudC5cbiAgICAgICAgICByZXR1cm4gdGhpcy5fYmFjay5yZWFkKGZyb20pLnBpcGUoXG4gICAgICAgICAgICBzd2l0Y2hNYXAoY29udGVudCA9PiBzdXBlci53cml0ZSh0bywgY29udGVudCkpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBsaXN0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPFBhdGhGcmFnbWVudFtdPiB7XG4gICAgcmV0dXJuIGNvbmNhdChcbiAgICAgIHN1cGVyLmxpc3QocGF0aCksXG4gICAgICB0aGlzLl9iYWNrLmxpc3QocGF0aCksXG4gICAgKS5waXBlKFxuICAgICAgcmVkdWNlKChsaXN0OiBTZXQ8UGF0aEZyYWdtZW50PiwgY3VycjogUGF0aEZyYWdtZW50W10pID0+IHtcbiAgICAgICAgY3Vyci5mb3JFYWNoKGVsZW0gPT4gbGlzdC5hZGQoZWxlbSkpO1xuXG4gICAgICAgIHJldHVybiBsaXN0O1xuICAgICAgfSwgbmV3IFNldDxQYXRoRnJhZ21lbnQ+KCkpLFxuICAgICAgbWFwKHNldCA9PiBbLi4uc2V0XSksXG4gICAgKTtcbiAgfVxuXG4gIGV4aXN0cyhwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuX2V4aXN0cyhwYXRoKVxuICAgICAgPyBvZih0cnVlKVxuICAgICAgOiAoKHRoaXMud2lsbERlbGV0ZShwYXRoKSB8fCB0aGlzLndpbGxSZW5hbWUocGF0aCkpID8gb2YoZmFsc2UpIDogdGhpcy5fYmFjay5leGlzdHMocGF0aCkpO1xuICB9XG4gIGlzRGlyZWN0b3J5KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gdGhpcy5fZXhpc3RzKHBhdGgpID8gc3VwZXIuaXNEaXJlY3RvcnkocGF0aCkgOiB0aGlzLl9iYWNrLmlzRGlyZWN0b3J5KHBhdGgpO1xuICB9XG4gIGlzRmlsZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuX2V4aXN0cyhwYXRoKVxuICAgICAgPyBzdXBlci5pc0ZpbGUocGF0aClcbiAgICAgIDogKCh0aGlzLndpbGxEZWxldGUocGF0aCkgfHwgdGhpcy53aWxsUmVuYW1lKHBhdGgpKSA/IG9mKGZhbHNlKSA6IHRoaXMuX2JhY2suaXNGaWxlKHBhdGgpKTtcbiAgfVxuXG4gIHN0YXQocGF0aDogUGF0aCkge1xuICAgIC8vIFRPRE86IHN0YXQgc2hvdWxkIGJlIHBvc3NpYmxlIHRvIGltcGxlbWVudCwgYXQgbGVhc3QgZnJvbSBtZW1vcnkuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB3YXRjaChwYXRoOiBQYXRoLCBvcHRpb25zPzogSG9zdFdhdGNoT3B0aW9ucykge1xuICAgIC8vIFdhdGNoaW5nIG5vdCBzdXBwb3J0ZWQuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB3aWxsQ3JlYXRlKHBhdGg6IFBhdGgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlsZXNUb0NyZWF0ZS5oYXMocGF0aCk7XG4gIH1cbiAgd2lsbE92ZXJ3cml0ZShwYXRoOiBQYXRoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUuaGFzKHBhdGgpO1xuICB9XG4gIHdpbGxEZWxldGUocGF0aDogUGF0aCkge1xuICAgIHJldHVybiB0aGlzLl9maWxlc1RvRGVsZXRlLmhhcyhwYXRoKTtcbiAgfVxuICB3aWxsUmVuYW1lKHBhdGg6IFBhdGgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlsZXNUb1JlbmFtZS5oYXMocGF0aCk7XG4gIH1cbiAgd2lsbFJlbmFtZVRvKHBhdGg6IFBhdGgsIHRvOiBQYXRoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbGVzVG9SZW5hbWUuZ2V0KHBhdGgpID09PSB0bztcbiAgfVxufVxuIl19