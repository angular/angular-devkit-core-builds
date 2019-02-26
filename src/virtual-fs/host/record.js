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
                return rxjs_1.EMPTY;
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
        return this._exists(path)
            ? super.stat(path)
            : ((this.willDelete(path) || this.willRename(path)) ? rxjs_1.of(null) : this._back.stat(path));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjb3JkLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy92aXJ0dWFsLWZzL2hvc3QvcmVjb3JkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7OztHQU1HO0FBQ0gsK0JBT2M7QUFDZCw4Q0FBNEU7QUFDNUUsK0NBS3lCO0FBVXpCLHFDQUE0QztBQTRCNUM7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxRQUFTLFNBQVEseUJBQWdCO0lBTzVDLFlBQXNCLEtBQW1CO1FBQUksS0FBSyxFQUFFLENBQUM7UUFBL0IsVUFBSyxHQUFMLEtBQUssQ0FBYztRQU4vQixtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFRLENBQUM7UUFDakMsbUJBQWMsR0FBRyxJQUFJLEdBQUcsRUFBYyxDQUFDO1FBQ3ZDLHlCQUFvQixHQUFHLElBQUksR0FBRyxFQUFjLENBQUM7UUFDN0MsbUJBQWMsR0FBRyxJQUFJLEdBQUcsRUFBUSxDQUFDO1FBQ2pDLHNCQUFpQixHQUFHLElBQUksR0FBRyxFQUFRLENBQUM7SUFFUSxDQUFDO0lBRXZELElBQUksT0FBTyxLQUFtQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ2xELElBQUksWUFBWTtRQUNkLG9FQUFvRTtRQUNwRSxPQUFPO1lBQ0wsV0FBVyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLFdBQVc7U0FDakQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLO1FBQ0gsTUFBTSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXZDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFD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QUNELFlBQVksQ0FBQyxJQUFVLEVBQUUsRUFBUTtRQUMvQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0NBQ0Y7QUF2VUQsNEJBdVVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtcbiAgRU1QVFksXG4gIE9ic2VydmFibGUsXG4gIGNvbmNhdCxcbiAgZnJvbSBhcyBvYnNlcnZhYmxlRnJvbSxcbiAgb2YsXG4gIHRocm93RXJyb3IsXG59IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHJlZHVjZSwgc3dpdGNoTWFwLCB0b0FycmF5IH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHtcbiAgRmlsZUFscmVhZHlFeGlzdEV4Y2VwdGlvbixcbiAgRmlsZURvZXNOb3RFeGlzdEV4Y2VwdGlvbixcbiAgUGF0aElzRGlyZWN0b3J5RXhjZXB0aW9uLFxuICBVbmtub3duRXhjZXB0aW9uLFxufSBmcm9tICcuLi8uLi9leGNlcHRpb24nO1xuaW1wb3J0IHsgUGF0aCwgUGF0aEZyYWdtZW50IH0gZnJvbSAnLi4vcGF0aCc7XG5pbXBvcnQge1xuICBGaWxlQnVmZmVyLFxuICBIb3N0LFxuICBIb3N0Q2FwYWJpbGl0aWVzLFxuICBIb3N0V2F0Y2hPcHRpb25zLFxuICBSZWFkb25seUhvc3QsXG4gIFN0YXRzLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5pbXBvcnQgeyBTaW1wbGVNZW1vcnlIb3N0IH0gZnJvbSAnLi9tZW1vcnknO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29yZEhvc3RDcmVhdGUge1xuICBraW5kOiAnY3JlYXRlJztcbiAgcGF0aDogUGF0aDtcbiAgY29udGVudDogRmlsZUJ1ZmZlcjtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgQ29yZEhvc3RPdmVyd3JpdGUge1xuICBraW5kOiAnb3ZlcndyaXRlJztcbiAgcGF0aDogUGF0aDtcbiAgY29udGVudDogRmlsZUJ1ZmZlcjtcbn1cbmV4cG9ydCBpbnRlcmZhY2UgQ29yZEhvc3RSZW5hbWUge1xuICBraW5kOiAncmVuYW1lJztcbiAgZnJvbTogUGF0aDtcbiAgdG86IFBhdGg7XG59XG5leHBvcnQgaW50ZXJmYWNlIENvcmRIb3N0RGVsZXRlIHtcbiAga2luZDogJ2RlbGV0ZSc7XG4gIHBhdGg6IFBhdGg7XG59XG5leHBvcnQgdHlwZSBDb3JkSG9zdFJlY29yZCA9IENvcmRIb3N0Q3JlYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB8IENvcmRIb3N0T3ZlcndyaXRlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB8IENvcmRIb3N0UmVuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB8IENvcmRIb3N0RGVsZXRlO1xuXG5cbi8qKlxuICogQSBIb3N0IHRoYXQgcmVjb3JkcyBjaGFuZ2VzIHRvIHRoZSB1bmRlcmx5aW5nIEhvc3QsIHdoaWxlIGtlZXBpbmcgYSByZWNvcmQgb2YgQ3JlYXRlLCBPdmVyd3JpdGUsXG4gKiBSZW5hbWUgYW5kIERlbGV0ZSBvZiBmaWxlcy5cbiAqXG4gKiBUaGlzIGlzIGZ1bGx5IGNvbXBhdGlibGUgd2l0aCBIb3N0LCBidXQgd2lsbCBrZWVwIGEgc3RhZ2luZyBvZiBldmVyeSBjaGFuZ2VzIGFza2VkLiBUaGF0IHN0YWdpbmdcbiAqIGZvbGxvd3MgdGhlIHByaW5jaXBsZSBvZiB0aGUgVHJlZSAoZS5nLiBjYW4gY3JlYXRlIGEgZmlsZSB0aGF0IGFscmVhZHkgZXhpc3RzKS5cbiAqXG4gKiBVc2luZyBgY3JlYXRlKClgIGFuZCBgb3ZlcndyaXRlKClgIHdpbGwgZm9yY2UgdGhvc2Ugb3BlcmF0aW9ucywgYnV0IHVzaW5nIGB3cml0ZWAgd2lsbCBhZGRcbiAqIHRoZSBjcmVhdGUvb3ZlcndyaXRlIHJlY29yZHMgSUlGIHRoZSBmaWxlcyBkb2VzL2RvZXNuJ3QgYWxyZWFkeSBleGlzdC5cbiAqL1xuZXhwb3J0IGNsYXNzIENvcmRIb3N0IGV4dGVuZHMgU2ltcGxlTWVtb3J5SG9zdCB7XG4gIHByb3RlY3RlZCBfZmlsZXNUb0NyZWF0ZSA9IG5ldyBTZXQ8UGF0aD4oKTtcbiAgcHJvdGVjdGVkIF9maWxlc1RvUmVuYW1lID0gbmV3IE1hcDxQYXRoLCBQYXRoPigpO1xuICBwcm90ZWN0ZWQgX2ZpbGVzVG9SZW5hbWVSZXZlcnQgPSBuZXcgTWFwPFBhdGgsIFBhdGg+KCk7XG4gIHByb3RlY3RlZCBfZmlsZXNUb0RlbGV0ZSA9IG5ldyBTZXQ8UGF0aD4oKTtcbiAgcHJvdGVjdGVkIF9maWxlc1RvT3ZlcndyaXRlID0gbmV3IFNldDxQYXRoPigpO1xuXG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBfYmFjazogUmVhZG9ubHlIb3N0KSB7IHN1cGVyKCk7IH1cblxuICBnZXQgYmFja2VuZCgpOiBSZWFkb25seUhvc3QgeyByZXR1cm4gdGhpcy5fYmFjazsgfVxuICBnZXQgY2FwYWJpbGl0aWVzKCk6IEhvc3RDYXBhYmlsaXRpZXMge1xuICAgIC8vIE91ciBvd24gaG9zdCBpcyBhbHdheXMgU3luY2hyb25vdXMsIGJ1dCB0aGUgYmFja2VuZCBtaWdodCBub3QgYmUuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN5bmNocm9ub3VzOiB0aGlzLl9iYWNrLmNhcGFiaWxpdGllcy5zeW5jaHJvbm91cyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGNvcHkgb2YgdGhpcyBob3N0LCBpbmNsdWRpbmcgYWxsIGFjdGlvbnMgbWFkZS5cbiAgICogQHJldHVybnMge0NvcmRIb3N0fSBUaGUgY2FyYm9uIGNvcHkuXG4gICAqL1xuICBjbG9uZSgpOiBDb3JkSG9zdCB7XG4gICAgY29uc3QgZG9sbHkgPSBuZXcgQ29yZEhvc3QodGhpcy5fYmFjayk7XG5cbiAgICBkb2xseS5fY2FjaGUgPSBuZXcgTWFwKHRoaXMuX2NhY2hlKTtcbiAgICBkb2xseS5fZmlsZXNUb0NyZWF0ZSA9IG5ldyBTZXQodGhpcy5fZmlsZXNUb0NyZWF0ZSk7XG4gICAgZG9sbHkuX2ZpbGVzVG9SZW5hbWUgPSBuZXcgTWFwKHRoaXMuX2ZpbGVzVG9SZW5hbWUpO1xuICAgIGRvbGx5Ll9maWxlc1RvUmVuYW1lUmV2ZXJ0ID0gbmV3IE1hcCh0aGlzLl9maWxlc1RvUmVuYW1lUmV2ZXJ0KTtcbiAgICBkb2xseS5fZmlsZXNUb0RlbGV0ZSA9IG5ldyBTZXQodGhpcy5fZmlsZXNUb0RlbGV0ZSk7XG4gICAgZG9sbHkuX2ZpbGVzVG9PdmVyd3JpdGUgPSBuZXcgU2V0KHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUpO1xuXG4gICAgcmV0dXJuIGRvbGx5O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbW1pdCB0aGUgY2hhbmdlcyByZWNvcmRlZCB0byBhIEhvc3QuIEl0IGlzIGFzc3VtZWQgdGhhdCB0aGUgaG9zdCBkb2VzIGhhdmUgdGhlIHNhbWUgc3RydWN0dXJlXG4gICAqIGFzIHRoZSBob3N0IHRoYXQgd2FzIHVzZWQgZm9yIGJhY2tlbmQgKGNvdWxkIGJlIHRoZSBzYW1lIGhvc3QpLlxuICAgKiBAcGFyYW0gaG9zdCBUaGUgaG9zdCB0byBjcmVhdGUvZGVsZXRlL3JlbmFtZS9vdmVyd3JpdGUgZmlsZXMgdG8uXG4gICAqIEBwYXJhbSBmb3JjZSBXaGV0aGVyIHRvIHNraXAgZXhpc3RlbmNlIGNoZWNrcyB3aGVuIGNyZWF0aW5nL292ZXJ3cml0aW5nLiBUaGlzIGlzXG4gICAqICAgZmFzdGVyIGJ1dCBtaWdodCBsZWFkIHRvIGluY29ycmVjdCBzdGF0ZXMuIEJlY2F1c2UgSG9zdHMgbmF0aXZlbHkgZG9uJ3Qgc3VwcG9ydCBjcmVhdGlvblxuICAgKiAgIHZlcnN1cyBvdmVyd3JpdGluZyAoaXQncyBvbmx5IHdyaXRpbmcpLCB3ZSBjaGVjayBmb3IgZXhpc3RlbmNlIGJlZm9yZSBjb21wbGV0aW5nIGEgcmVxdWVzdC5cbiAgICogQHJldHVybnMgQW4gb2JzZXJ2YWJsZSB0aGF0IGNvbXBsZXRlcyB3aGVuIGRvbmUsIG9yIGVycm9yIGlmIGFuIGVycm9yIG9jY3VyZWQuXG4gICAqL1xuICBjb21taXQoaG9zdDogSG9zdCwgZm9yY2UgPSBmYWxzZSk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIC8vIFJlYWxseSBjb21taXQgZXZlcnl0aGluZyB0byB0aGUgYWN0dWFsIGhvc3QuXG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKHRoaXMucmVjb3JkcygpKS5waXBlKFxuICAgICAgY29uY2F0TWFwKHJlY29yZCA9PiB7XG4gICAgICAgIHN3aXRjaCAocmVjb3JkLmtpbmQpIHtcbiAgICAgICAgICBjYXNlICdkZWxldGUnOiByZXR1cm4gaG9zdC5kZWxldGUocmVjb3JkLnBhdGgpO1xuICAgICAgICAgIGNhc2UgJ3JlbmFtZSc6IHJldHVybiBob3N0LnJlbmFtZShyZWNvcmQuZnJvbSwgcmVjb3JkLnRvKTtcbiAgICAgICAgICBjYXNlICdjcmVhdGUnOlxuICAgICAgICAgICAgcmV0dXJuIGhvc3QuZXhpc3RzKHJlY29yZC5wYXRoKS5waXBlKFxuICAgICAgICAgICAgICBzd2l0Y2hNYXAoZXhpc3RzID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXhpc3RzICYmICFmb3JjZSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IobmV3IEZpbGVBbHJlYWR5RXhpc3RFeGNlcHRpb24ocmVjb3JkLnBhdGgpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGhvc3Qud3JpdGUocmVjb3JkLnBhdGgsIHJlY29yZC5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICBjYXNlICdvdmVyd3JpdGUnOlxuICAgICAgICAgICAgcmV0dXJuIGhvc3QuZXhpc3RzKHJlY29yZC5wYXRoKS5waXBlKFxuICAgICAgICAgICAgICBzd2l0Y2hNYXAoZXhpc3RzID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWV4aXN0cyAmJiAhZm9yY2UpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKG5ldyBGaWxlRG9lc05vdEV4aXN0RXhjZXB0aW9uKHJlY29yZC5wYXRoKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBob3N0LndyaXRlKHJlY29yZC5wYXRoLCByZWNvcmQuY29udGVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgcmVkdWNlKCgpID0+IHt9KSxcbiAgICApO1xuICB9XG5cbiAgcmVjb3JkcygpOiBDb3JkSG9zdFJlY29yZFtdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4uWy4uLnRoaXMuX2ZpbGVzVG9EZWxldGUudmFsdWVzKCldLm1hcChwYXRoID0+ICh7XG4gICAgICAgIGtpbmQ6ICdkZWxldGUnLCBwYXRoLFxuICAgICAgfSkgYXMgQ29yZEhvc3RSZWNvcmQpLFxuICAgICAgLi4uWy4uLnRoaXMuX2ZpbGVzVG9SZW5hbWUuZW50cmllcygpXS5tYXAoKFtmcm9tLCB0b10pID0+ICh7XG4gICAgICAgIGtpbmQ6ICdyZW5hbWUnLCBmcm9tLCB0byxcbiAgICAgIH0pIGFzIENvcmRIb3N0UmVjb3JkKSxcbiAgICAgIC4uLlsuLi50aGlzLl9maWxlc1RvQ3JlYXRlLnZhbHVlcygpXS5tYXAocGF0aCA9PiAoe1xuICAgICAgICBraW5kOiAnY3JlYXRlJywgcGF0aCwgY29udGVudDogdGhpcy5fcmVhZChwYXRoKSxcbiAgICAgIH0pIGFzIENvcmRIb3N0UmVjb3JkKSxcbiAgICAgIC4uLlsuLi50aGlzLl9maWxlc1RvT3ZlcndyaXRlLnZhbHVlcygpXS5tYXAocGF0aCA9PiAoe1xuICAgICAgICBraW5kOiAnb3ZlcndyaXRlJywgcGF0aCwgY29udGVudDogdGhpcy5fcmVhZChwYXRoKSxcbiAgICAgIH0pIGFzIENvcmRIb3N0UmVjb3JkKSxcbiAgICBdO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwZWNpYWxpemVkIHZlcnNpb24gb2Yge0BsaW5rIENvcmRIb3N0I3dyaXRlfSB3aGljaCBmb3JjZXMgdGhlIGNyZWF0aW9uIG9mIGEgZmlsZSB3aGV0aGVyIGl0XG4gICAqIGV4aXN0cyBvciBub3QuXG4gICAqIEBwYXJhbSB7fSBwYXRoXG4gICAqIEBwYXJhbSB7RmlsZUJ1ZmZlcn0gY29udGVudFxuICAgKiBAcmV0dXJucyB7T2JzZXJ2YWJsZTx2b2lkPn1cbiAgICovXG4gIGNyZWF0ZShwYXRoOiBQYXRoLCBjb250ZW50OiBGaWxlQnVmZmVyKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgaWYgKHN1cGVyLl9leGlzdHMocGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBGaWxlQWxyZWFkeUV4aXN0RXhjZXB0aW9uKHBhdGgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9maWxlc1RvRGVsZXRlLmhhcyhwYXRoKSkge1xuICAgICAgdGhpcy5fZmlsZXNUb0RlbGV0ZS5kZWxldGUocGF0aCk7XG4gICAgICB0aGlzLl9maWxlc1RvT3ZlcndyaXRlLmFkZChwYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZmlsZXNUb0NyZWF0ZS5hZGQocGF0aCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyLndyaXRlKHBhdGgsIGNvbnRlbnQpO1xuICB9XG5cbiAgb3ZlcndyaXRlKHBhdGg6IFBhdGgsIGNvbnRlbnQ6IEZpbGVCdWZmZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5pc0RpcmVjdG9yeShwYXRoKS5waXBlKFxuICAgICAgc3dpdGNoTWFwKGlzRGlyID0+IHtcbiAgICAgICAgaWYgKGlzRGlyKSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IobmV3IFBhdGhJc0RpcmVjdG9yeUV4Y2VwdGlvbihwYXRoKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5leGlzdHMocGF0aCk7XG4gICAgICB9KSxcbiAgICAgIHN3aXRjaE1hcChleGlzdHMgPT4ge1xuICAgICAgICBpZiAoIWV4aXN0cykge1xuICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKG5ldyBGaWxlRG9lc05vdEV4aXN0RXhjZXB0aW9uKHBhdGgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fZmlsZXNUb0NyZWF0ZS5oYXMocGF0aCkpIHtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvT3ZlcndyaXRlLmFkZChwYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdXBlci53cml0ZShwYXRoLCBjb250ZW50KTtcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICB3cml0ZShwYXRoOiBQYXRoLCBjb250ZW50OiBGaWxlQnVmZmVyKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuZXhpc3RzKHBhdGgpLnBpcGUoXG4gICAgICBzd2l0Y2hNYXAoZXhpc3RzID0+IHtcbiAgICAgICAgaWYgKGV4aXN0cykge1xuICAgICAgICAgIC8vIEl0IGV4aXN0cywgYnV0IG1pZ2h0IGJlIGJlaW5nIHJlbmFtZWQgb3IgZGVsZXRlZC4gSW4gdGhhdCBjYXNlIHdlIHdhbnQgdG8gY3JlYXRlIGl0LlxuICAgICAgICAgIGlmICh0aGlzLndpbGxSZW5hbWUocGF0aCkgfHwgdGhpcy53aWxsRGVsZXRlKHBhdGgpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGUocGF0aCwgY29udGVudCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm92ZXJ3cml0ZShwYXRoLCBjb250ZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlKHBhdGgsIGNvbnRlbnQpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcmVhZChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxGaWxlQnVmZmVyPiB7XG4gICAgaWYgKHRoaXMuX2V4aXN0cyhwYXRoKSkge1xuICAgICAgcmV0dXJuIHN1cGVyLnJlYWQocGF0aCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuX2JhY2sucmVhZChwYXRoKTtcbiAgfVxuXG4gIGRlbGV0ZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuX2V4aXN0cyhwYXRoKSkge1xuICAgICAgaWYgKHRoaXMuX2ZpbGVzVG9DcmVhdGUuaGFzKHBhdGgpKSB7XG4gICAgICAgIHRoaXMuX2ZpbGVzVG9DcmVhdGUuZGVsZXRlKHBhdGgpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9maWxlc1RvT3ZlcndyaXRlLmhhcyhwYXRoKSkge1xuICAgICAgICB0aGlzLl9maWxlc1RvT3ZlcndyaXRlLmRlbGV0ZShwYXRoKTtcbiAgICAgICAgdGhpcy5fZmlsZXNUb0RlbGV0ZS5hZGQocGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBtYXliZU9yaWdpbiA9IHRoaXMuX2ZpbGVzVG9SZW5hbWVSZXZlcnQuZ2V0KHBhdGgpO1xuICAgICAgICBpZiAobWF5YmVPcmlnaW4pIHtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvUmVuYW1lUmV2ZXJ0LmRlbGV0ZShwYXRoKTtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvUmVuYW1lLmRlbGV0ZShtYXliZU9yaWdpbik7XG4gICAgICAgICAgdGhpcy5fZmlsZXNUb0RlbGV0ZS5hZGQobWF5YmVPcmlnaW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKFxuICAgICAgICAgICAgbmV3IFVua25vd25FeGNlcHRpb24oYFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbi4gUGF0aDogJHtKU09OLnN0cmluZ2lmeShwYXRoKX0uYCksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gc3VwZXIuZGVsZXRlKHBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fYmFjay5leGlzdHMocGF0aCkucGlwZShcbiAgICAgICAgc3dpdGNoTWFwKGV4aXN0cyA9PiB7XG4gICAgICAgICAgaWYgKGV4aXN0cykge1xuICAgICAgICAgICAgdGhpcy5fZmlsZXNUb0RlbGV0ZS5hZGQocGF0aCk7XG5cbiAgICAgICAgICAgIHJldHVybiBvZjx2b2lkPigpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihuZXcgRmlsZURvZXNOb3RFeGlzdEV4Y2VwdGlvbihwYXRoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmVuYW1lKGZyb206IFBhdGgsIHRvOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIGNvbmNhdChcbiAgICAgIHRoaXMuZXhpc3RzKHRvKSxcbiAgICAgIHRoaXMuZXhpc3RzKGZyb20pLFxuICAgICkucGlwZShcbiAgICAgIHRvQXJyYXkoKSxcbiAgICAgIHN3aXRjaE1hcCgoW2V4aXN0VG8sIGV4aXN0RnJvbV0pID0+IHtcbiAgICAgICAgaWYgKCFleGlzdEZyb20pIHtcbiAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihuZXcgRmlsZURvZXNOb3RFeGlzdEV4Y2VwdGlvbihmcm9tKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZyb20gPT09IHRvKSB7XG4gICAgICAgICAgcmV0dXJuIEVNUFRZO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV4aXN0VG8pIHtcbiAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihuZXcgRmlsZUFscmVhZHlFeGlzdEV4Y2VwdGlvbih0bykpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgd2UncmUgcmVuYW1pbmcgYSBmaWxlIHRoYXQncyBiZWVuIGNyZWF0ZWQsIHNob3J0Y2lyY3VpdCB0byBjcmVhdGluZyB0aGUgYHRvYCBwYXRoLlxuICAgICAgICBpZiAodGhpcy5fZmlsZXNUb0NyZWF0ZS5oYXMoZnJvbSkpIHtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvQ3JlYXRlLmRlbGV0ZShmcm9tKTtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvQ3JlYXRlLmFkZCh0byk7XG5cbiAgICAgICAgICByZXR1cm4gc3VwZXIucmVuYW1lKGZyb20sIHRvKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZmlsZXNUb092ZXJ3cml0ZS5oYXMoZnJvbSkpIHtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvT3ZlcndyaXRlLmRlbGV0ZShmcm9tKTtcblxuICAgICAgICAgIC8vIFJlY3Vyc2l2ZWx5IGNhbGwgdGhpcyBmdW5jdGlvbi4gVGhpcyBpcyBzbyB3ZSBkb24ndCByZXBlYXQgdGhlIGJvdHRvbSBsb2dpYy4gVGhpc1xuICAgICAgICAgIC8vIGlmIHdpbGwgYmUgYnktcGFzc2VkIGJlY2F1c2Ugd2UganVzdCBkZWxldGVkIHRoZSBgZnJvbWAgcGF0aCBmcm9tIGZpbGVzIHRvIG92ZXJ3cml0ZS5cbiAgICAgICAgICByZXR1cm4gY29uY2F0KFxuICAgICAgICAgICAgdGhpcy5yZW5hbWUoZnJvbSwgdG8pLFxuICAgICAgICAgICAgbmV3IE9ic2VydmFibGU8bmV2ZXI+KHggPT4ge1xuICAgICAgICAgICAgICB0aGlzLl9maWxlc1RvT3ZlcndyaXRlLmFkZCh0byk7XG4gICAgICAgICAgICAgIHguY29tcGxldGUoKTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2ZpbGVzVG9EZWxldGUuaGFzKHRvKSkge1xuICAgICAgICAgIHRoaXMuX2ZpbGVzVG9EZWxldGUuZGVsZXRlKHRvKTtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvRGVsZXRlLmFkZChmcm9tKTtcbiAgICAgICAgICB0aGlzLl9maWxlc1RvT3ZlcndyaXRlLmFkZCh0byk7XG5cbiAgICAgICAgICAvLyBXZSBuZWVkIHRvIGRlbGV0ZSB0aGUgb3JpZ2luYWwgYW5kIHdyaXRlIHRoZSBuZXcgb25lLlxuICAgICAgICAgIHJldHVybiB0aGlzLnJlYWQoZnJvbSkucGlwZShcbiAgICAgICAgICAgIG1hcChjb250ZW50ID0+IHRoaXMuX3dyaXRlKHRvLCBjb250ZW50KSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1heWJlVG8xID0gdGhpcy5fZmlsZXNUb1JlbmFtZVJldmVydC5nZXQoZnJvbSk7XG4gICAgICAgIGlmIChtYXliZVRvMSkge1xuICAgICAgICAgIC8vIFdlIGFscmVhZHkgcmVuYW1lZCB0byB0aGlzIGZpbGUgKEEgPT4gZnJvbSksIGxldCdzIHJlbmFtZSB0aGUgZm9ybWVyIHRvIHRoZSBuZXdcbiAgICAgICAgICAvLyBwYXRoIChBID0+IHRvKS5cbiAgICAgICAgICB0aGlzLl9maWxlc1RvUmVuYW1lLmRlbGV0ZShtYXliZVRvMSk7XG4gICAgICAgICAgdGhpcy5fZmlsZXNUb1JlbmFtZVJldmVydC5kZWxldGUoZnJvbSk7XG4gICAgICAgICAgZnJvbSA9IG1heWJlVG8xO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmlsZXNUb1JlbmFtZS5zZXQoZnJvbSwgdG8pO1xuICAgICAgICB0aGlzLl9maWxlc1RvUmVuYW1lUmV2ZXJ0LnNldCh0bywgZnJvbSk7XG5cbiAgICAgICAgLy8gSWYgdGhlIGZpbGUgaXMgcGFydCBvZiBvdXIgZGF0YSwganVzdCByZW5hbWUgaXQgaW50ZXJuYWxseS5cbiAgICAgICAgaWYgKHRoaXMuX2V4aXN0cyhmcm9tKSkge1xuICAgICAgICAgIHJldHVybiBzdXBlci5yZW5hbWUoZnJvbSwgdG8pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIENyZWF0ZSBhIGZpbGUgd2l0aCB0aGUgc2FtZSBjb250ZW50LlxuICAgICAgICAgIHJldHVybiB0aGlzLl9iYWNrLnJlYWQoZnJvbSkucGlwZShcbiAgICAgICAgICAgIHN3aXRjaE1hcChjb250ZW50ID0+IHN1cGVyLndyaXRlKHRvLCBjb250ZW50KSksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIGxpc3QocGF0aDogUGF0aCk6IE9ic2VydmFibGU8UGF0aEZyYWdtZW50W10+IHtcbiAgICByZXR1cm4gY29uY2F0KFxuICAgICAgc3VwZXIubGlzdChwYXRoKSxcbiAgICAgIHRoaXMuX2JhY2subGlzdChwYXRoKSxcbiAgICApLnBpcGUoXG4gICAgICByZWR1Y2UoKGxpc3Q6IFNldDxQYXRoRnJhZ21lbnQ+LCBjdXJyOiBQYXRoRnJhZ21lbnRbXSkgPT4ge1xuICAgICAgICBjdXJyLmZvckVhY2goZWxlbSA9PiBsaXN0LmFkZChlbGVtKSk7XG5cbiAgICAgICAgcmV0dXJuIGxpc3Q7XG4gICAgICB9LCBuZXcgU2V0PFBhdGhGcmFnbWVudD4oKSksXG4gICAgICBtYXAoc2V0ID0+IFsuLi5zZXRdKSxcbiAgICApO1xuICB9XG5cbiAgZXhpc3RzKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gdGhpcy5fZXhpc3RzKHBhdGgpXG4gICAgICA/IG9mKHRydWUpXG4gICAgICA6ICgodGhpcy53aWxsRGVsZXRlKHBhdGgpIHx8IHRoaXMud2lsbFJlbmFtZShwYXRoKSkgPyBvZihmYWxzZSkgOiB0aGlzLl9iYWNrLmV4aXN0cyhwYXRoKSk7XG4gIH1cbiAgaXNEaXJlY3RvcnkocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiB0aGlzLl9leGlzdHMocGF0aCkgPyBzdXBlci5pc0RpcmVjdG9yeShwYXRoKSA6IHRoaXMuX2JhY2suaXNEaXJlY3RvcnkocGF0aCk7XG4gIH1cbiAgaXNGaWxlKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gdGhpcy5fZXhpc3RzKHBhdGgpXG4gICAgICA/IHN1cGVyLmlzRmlsZShwYXRoKVxuICAgICAgOiAoKHRoaXMud2lsbERlbGV0ZShwYXRoKSB8fCB0aGlzLndpbGxSZW5hbWUocGF0aCkpID8gb2YoZmFsc2UpIDogdGhpcy5fYmFjay5pc0ZpbGUocGF0aCkpO1xuICB9XG5cbiAgc3RhdChwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxTdGF0cyB8IG51bGw+IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2V4aXN0cyhwYXRoKVxuICAgICAgPyBzdXBlci5zdGF0KHBhdGgpXG4gICAgICA6ICgodGhpcy53aWxsRGVsZXRlKHBhdGgpIHx8IHRoaXMud2lsbFJlbmFtZShwYXRoKSkgPyBvZihudWxsKSA6IHRoaXMuX2JhY2suc3RhdChwYXRoKSk7XG4gIH1cblxuICB3YXRjaChwYXRoOiBQYXRoLCBvcHRpb25zPzogSG9zdFdhdGNoT3B0aW9ucykge1xuICAgIC8vIFdhdGNoaW5nIG5vdCBzdXBwb3J0ZWQuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB3aWxsQ3JlYXRlKHBhdGg6IFBhdGgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlsZXNUb0NyZWF0ZS5oYXMocGF0aCk7XG4gIH1cbiAgd2lsbE92ZXJ3cml0ZShwYXRoOiBQYXRoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbGVzVG9PdmVyd3JpdGUuaGFzKHBhdGgpO1xuICB9XG4gIHdpbGxEZWxldGUocGF0aDogUGF0aCkge1xuICAgIHJldHVybiB0aGlzLl9maWxlc1RvRGVsZXRlLmhhcyhwYXRoKTtcbiAgfVxuICB3aWxsUmVuYW1lKHBhdGg6IFBhdGgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlsZXNUb1JlbmFtZS5oYXMocGF0aCk7XG4gIH1cbiAgd2lsbFJlbmFtZVRvKHBhdGg6IFBhdGgsIHRvOiBQYXRoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpbGVzVG9SZW5hbWUuZ2V0KHBhdGgpID09PSB0bztcbiAgfVxufVxuIl19