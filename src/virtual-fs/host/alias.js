"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("../path");
/**
 * A Virtual Host that allow to alias some paths to other paths.
 *
 * This does not verify, when setting an alias, that the target or source exist. Neither does it
 * check whether it's a file or a directory. Please not that directories are also renamed/replaced.
 *
 * No recursion is done on the resolution, which means the following is perfectly valid then:
 *
 * ```
 *     host.aliases.set(normalize('/file/a'), normalize('/file/b'));
 *     host.aliases.set(normalize('/file/b'), normalize('/file/a'));
 * ```
 *
 * This will result in a proper swap of two files for each others.
 *
 * @example
 *   const host = new SimpleMemoryHost();
 *   host.write(normalize('/some/file'), content).subscribe();
 *
 *   const aHost = new AliasHost(host);
 *   aHost.read(normalize('/some/file'))
 *     .subscribe(x => expect(x).toBe(content));
 *   aHost.aliases.set(normalize('/some/file'), normalize('/other/path');
 *
 *   // This file will not exist because /other/path does not exist.
 *   aHost.read(normalize('/some/file'))
 *     .subscribe(undefined, err => expect(err.message).toMatch(/does not exist/));
 *
 * @example
 *   const host = new SimpleMemoryHost();
 *   host.write(normalize('/some/folder/file'), content).subscribe();
 *
 *   const aHost = new AliasHost(host);
 *   aHost.read(normalize('/some/folder/file'))
 *     .subscribe(x => expect(x).toBe(content));
 *   aHost.aliases.set(normalize('/some'), normalize('/other');
 *
 *   // This file will not exist because /other/path does not exist.
 *   aHost.read(normalize('/some/folder/file'))
 *     .subscribe(undefined, err => expect(err.message).toMatch(/does not exist/));
 *
 *   // Create the file with new content and verify that this has the new content.
 *   aHost.write(normalize('/other/folder/file'), content2).subscribe();
 *   aHost.read(normalize('/some/folder/file'))
 *     .subscribe(x => expect(x).toBe(content2));
 */
class AliasHost {
    constructor(_delegate) {
        this._delegate = _delegate;
        this._aliases = new Map();
    }
    _resolve(path) {
        let maybeAlias = this._aliases.get(path);
        const sp = path_1.split(path);
        const remaining = [];
        // Also resolve all parents of the requested files, only picking the first one that matches.
        // This can have surprising behaviour when aliases are inside another alias. It will always
        // use the closest one to the file.
        while (!maybeAlias && sp.length > 0) {
            const p = path_1.join(path_1.NormalizedRoot, ...sp);
            maybeAlias = this._aliases.get(p);
            if (maybeAlias) {
                maybeAlias = path_1.join(maybeAlias, ...remaining);
            }
            // Allow non-null-operator because we know sp.length > 0 (condition on while).
            remaining.unshift(sp.pop()); // tslint:disable-line:non-null-operator
        }
        return maybeAlias || path;
    }
    get aliases() { return this._aliases; }
    get capabilities() { return this._delegate.capabilities; }
    write(path, content) {
        return this._delegate.write(this._resolve(path), content);
    }
    read(path) {
        return this._delegate.read(this._resolve(path));
    }
    delete(path) {
        return this._delegate.delete(this._resolve(path));
    }
    rename(from, to) {
        return this._delegate.rename(this._resolve(from), this._resolve(to));
    }
    list(path) {
        return this._delegate.list(this._resolve(path));
    }
    exists(path) {
        return this._delegate.exists(this._resolve(path));
    }
    isDirectory(path) {
        return this._delegate.isDirectory(this._resolve(path));
    }
    isFile(path) {
        return this._delegate.isFile(this._resolve(path));
    }
    // Some hosts may not support stat.
    stat(path) {
        return this._delegate.stat(this._resolve(path));
    }
    // Some hosts may not support watching.
    watch(path, options) {
        return this._delegate.watch(this._resolve(path), options);
    }
}
exports.AliasHost = AliasHost;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxpYXMuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvc3JjL3ZpcnR1YWwtZnMvaG9zdC9hbGlhcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVFBLGtDQUEwRTtBQVcxRTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNkNHO0FBQ0g7SUFHRSxZQUFzQixTQUF1QjtRQUF2QixjQUFTLEdBQVQsU0FBUyxDQUFjO1FBRm5DLGFBQVEsR0FBRyxJQUFJLEdBQUcsRUFBYyxDQUFDO0lBRUssQ0FBQztJQUV2QyxRQUFRLENBQUMsSUFBVTtRQUMzQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6QyxNQUFNLEVBQUUsR0FBRyxZQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkIsTUFBTSxTQUFTLEdBQW1CLEVBQUUsQ0FBQztRQUVyQyw0RkFBNEY7UUFDNUYsMkZBQTJGO1FBQzNGLG1DQUFtQztRQUNuQyxPQUFPLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDcEMsTUFBTSxDQUFDLEdBQUcsV0FBSSxDQUFDLHFCQUFjLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUN0QyxVQUFVLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFbEMsRUFBRSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDZixVQUFVLEdBQUcsV0FBSSxDQUFDLFVBQVUsRUFBRSxHQUFHLFNBQVMsQ0FBQyxDQUFDO1lBQzlDLENBQUM7WUFDRCw4RUFBOEU7WUFDOUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFJLENBQUMsQ0FBQyxDQUFFLHdDQUF3QztRQUMxRSxDQUFDO1FBRUQsTUFBTSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUM7SUFDNUIsQ0FBQztJQUVELElBQUksT0FBTyxLQUFzQixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDeEQsSUFBSSxZQUFZLEtBQXVCLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFFNUUsS0FBSyxDQUFDLElBQVUsRUFBRSxPQUFtQjtRQUNuQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM1RCxDQUFDO0lBQ0QsSUFBSSxDQUFDLElBQVU7UUFDYixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFDRCxNQUFNLENBQUMsSUFBVTtRQUNmLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUNELE1BQU0sQ0FBQyxJQUFVLEVBQUUsRUFBUTtRQUN6QixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUVELElBQUksQ0FBQyxJQUFVO1FBQ2IsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQsTUFBTSxDQUFDLElBQVU7UUFDZixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFDRCxXQUFXLENBQUMsSUFBVTtRQUNwQixNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pELENBQUM7SUFDRCxNQUFNLENBQUMsSUFBVTtRQUNmLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELG1DQUFtQztJQUNuQyxJQUFJLENBQUMsSUFBVTtRQUNiLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELHVDQUF1QztJQUN2QyxLQUFLLENBQUMsSUFBVSxFQUFFLE9BQTBCO1FBQzFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzVELENBQUM7Q0FDRjtBQWxFRCw4QkFrRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcy9PYnNlcnZhYmxlJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRSb290LCBQYXRoLCBQYXRoRnJhZ21lbnQsIGpvaW4sIHNwbGl0IH0gZnJvbSAnLi4vcGF0aCc7XG5pbXBvcnQge1xuICBGaWxlQnVmZmVyLFxuICBIb3N0LFxuICBIb3N0Q2FwYWJpbGl0aWVzLFxuICBIb3N0V2F0Y2hFdmVudCxcbiAgSG9zdFdhdGNoT3B0aW9ucyxcbiAgU3RhdHMsXG59IGZyb20gJy4vaW50ZXJmYWNlJztcblxuXG4vKipcbiAqIEEgVmlydHVhbCBIb3N0IHRoYXQgYWxsb3cgdG8gYWxpYXMgc29tZSBwYXRocyB0byBvdGhlciBwYXRocy5cbiAqXG4gKiBUaGlzIGRvZXMgbm90IHZlcmlmeSwgd2hlbiBzZXR0aW5nIGFuIGFsaWFzLCB0aGF0IHRoZSB0YXJnZXQgb3Igc291cmNlIGV4aXN0LiBOZWl0aGVyIGRvZXMgaXRcbiAqIGNoZWNrIHdoZXRoZXIgaXQncyBhIGZpbGUgb3IgYSBkaXJlY3RvcnkuIFBsZWFzZSBub3QgdGhhdCBkaXJlY3RvcmllcyBhcmUgYWxzbyByZW5hbWVkL3JlcGxhY2VkLlxuICpcbiAqIE5vIHJlY3Vyc2lvbiBpcyBkb25lIG9uIHRoZSByZXNvbHV0aW9uLCB3aGljaCBtZWFucyB0aGUgZm9sbG93aW5nIGlzIHBlcmZlY3RseSB2YWxpZCB0aGVuOlxuICpcbiAqIGBgYFxuICogICAgIGhvc3QuYWxpYXNlcy5zZXQobm9ybWFsaXplKCcvZmlsZS9hJyksIG5vcm1hbGl6ZSgnL2ZpbGUvYicpKTtcbiAqICAgICBob3N0LmFsaWFzZXMuc2V0KG5vcm1hbGl6ZSgnL2ZpbGUvYicpLCBub3JtYWxpemUoJy9maWxlL2EnKSk7XG4gKiBgYGBcbiAqXG4gKiBUaGlzIHdpbGwgcmVzdWx0IGluIGEgcHJvcGVyIHN3YXAgb2YgdHdvIGZpbGVzIGZvciBlYWNoIG90aGVycy5cbiAqXG4gKiBAZXhhbXBsZVxuICogICBjb25zdCBob3N0ID0gbmV3IFNpbXBsZU1lbW9yeUhvc3QoKTtcbiAqICAgaG9zdC53cml0ZShub3JtYWxpemUoJy9zb21lL2ZpbGUnKSwgY29udGVudCkuc3Vic2NyaWJlKCk7XG4gKlxuICogICBjb25zdCBhSG9zdCA9IG5ldyBBbGlhc0hvc3QoaG9zdCk7XG4gKiAgIGFIb3N0LnJlYWQobm9ybWFsaXplKCcvc29tZS9maWxlJykpXG4gKiAgICAgLnN1YnNjcmliZSh4ID0+IGV4cGVjdCh4KS50b0JlKGNvbnRlbnQpKTtcbiAqICAgYUhvc3QuYWxpYXNlcy5zZXQobm9ybWFsaXplKCcvc29tZS9maWxlJyksIG5vcm1hbGl6ZSgnL290aGVyL3BhdGgnKTtcbiAqXG4gKiAgIC8vIFRoaXMgZmlsZSB3aWxsIG5vdCBleGlzdCBiZWNhdXNlIC9vdGhlci9wYXRoIGRvZXMgbm90IGV4aXN0LlxuICogICBhSG9zdC5yZWFkKG5vcm1hbGl6ZSgnL3NvbWUvZmlsZScpKVxuICogICAgIC5zdWJzY3JpYmUodW5kZWZpbmVkLCBlcnIgPT4gZXhwZWN0KGVyci5tZXNzYWdlKS50b01hdGNoKC9kb2VzIG5vdCBleGlzdC8pKTtcbiAqXG4gKiBAZXhhbXBsZVxuICogICBjb25zdCBob3N0ID0gbmV3IFNpbXBsZU1lbW9yeUhvc3QoKTtcbiAqICAgaG9zdC53cml0ZShub3JtYWxpemUoJy9zb21lL2ZvbGRlci9maWxlJyksIGNvbnRlbnQpLnN1YnNjcmliZSgpO1xuICpcbiAqICAgY29uc3QgYUhvc3QgPSBuZXcgQWxpYXNIb3N0KGhvc3QpO1xuICogICBhSG9zdC5yZWFkKG5vcm1hbGl6ZSgnL3NvbWUvZm9sZGVyL2ZpbGUnKSlcbiAqICAgICAuc3Vic2NyaWJlKHggPT4gZXhwZWN0KHgpLnRvQmUoY29udGVudCkpO1xuICogICBhSG9zdC5hbGlhc2VzLnNldChub3JtYWxpemUoJy9zb21lJyksIG5vcm1hbGl6ZSgnL290aGVyJyk7XG4gKlxuICogICAvLyBUaGlzIGZpbGUgd2lsbCBub3QgZXhpc3QgYmVjYXVzZSAvb3RoZXIvcGF0aCBkb2VzIG5vdCBleGlzdC5cbiAqICAgYUhvc3QucmVhZChub3JtYWxpemUoJy9zb21lL2ZvbGRlci9maWxlJykpXG4gKiAgICAgLnN1YnNjcmliZSh1bmRlZmluZWQsIGVyciA9PiBleHBlY3QoZXJyLm1lc3NhZ2UpLnRvTWF0Y2goL2RvZXMgbm90IGV4aXN0LykpO1xuICpcbiAqICAgLy8gQ3JlYXRlIHRoZSBmaWxlIHdpdGggbmV3IGNvbnRlbnQgYW5kIHZlcmlmeSB0aGF0IHRoaXMgaGFzIHRoZSBuZXcgY29udGVudC5cbiAqICAgYUhvc3Qud3JpdGUobm9ybWFsaXplKCcvb3RoZXIvZm9sZGVyL2ZpbGUnKSwgY29udGVudDIpLnN1YnNjcmliZSgpO1xuICogICBhSG9zdC5yZWFkKG5vcm1hbGl6ZSgnL3NvbWUvZm9sZGVyL2ZpbGUnKSlcbiAqICAgICAuc3Vic2NyaWJlKHggPT4gZXhwZWN0KHgpLnRvQmUoY29udGVudDIpKTtcbiAqL1xuZXhwb3J0IGNsYXNzIEFsaWFzSG9zdDxTdGF0c1QgZXh0ZW5kcyBvYmplY3QgPSB7fT4gaW1wbGVtZW50cyBIb3N0PFN0YXRzVD4ge1xuICBwcm90ZWN0ZWQgX2FsaWFzZXMgPSBuZXcgTWFwPFBhdGgsIFBhdGg+KCk7XG5cbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIF9kZWxlZ2F0ZTogSG9zdDxTdGF0c1Q+KSB7fVxuXG4gIHByb3RlY3RlZCBfcmVzb2x2ZShwYXRoOiBQYXRoKSB7XG4gICAgbGV0IG1heWJlQWxpYXMgPSB0aGlzLl9hbGlhc2VzLmdldChwYXRoKTtcbiAgICBjb25zdCBzcCA9IHNwbGl0KHBhdGgpO1xuICAgIGNvbnN0IHJlbWFpbmluZzogUGF0aEZyYWdtZW50W10gPSBbXTtcblxuICAgIC8vIEFsc28gcmVzb2x2ZSBhbGwgcGFyZW50cyBvZiB0aGUgcmVxdWVzdGVkIGZpbGVzLCBvbmx5IHBpY2tpbmcgdGhlIGZpcnN0IG9uZSB0aGF0IG1hdGNoZXMuXG4gICAgLy8gVGhpcyBjYW4gaGF2ZSBzdXJwcmlzaW5nIGJlaGF2aW91ciB3aGVuIGFsaWFzZXMgYXJlIGluc2lkZSBhbm90aGVyIGFsaWFzLiBJdCB3aWxsIGFsd2F5c1xuICAgIC8vIHVzZSB0aGUgY2xvc2VzdCBvbmUgdG8gdGhlIGZpbGUuXG4gICAgd2hpbGUgKCFtYXliZUFsaWFzICYmIHNwLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHAgPSBqb2luKE5vcm1hbGl6ZWRSb290LCAuLi5zcCk7XG4gICAgICBtYXliZUFsaWFzID0gdGhpcy5fYWxpYXNlcy5nZXQocCk7XG5cbiAgICAgIGlmIChtYXliZUFsaWFzKSB7XG4gICAgICAgIG1heWJlQWxpYXMgPSBqb2luKG1heWJlQWxpYXMsIC4uLnJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICAvLyBBbGxvdyBub24tbnVsbC1vcGVyYXRvciBiZWNhdXNlIHdlIGtub3cgc3AubGVuZ3RoID4gMCAoY29uZGl0aW9uIG9uIHdoaWxlKS5cbiAgICAgIHJlbWFpbmluZy51bnNoaWZ0KHNwLnBvcCgpICEpOyAgLy8gdHNsaW50OmRpc2FibGUtbGluZTpub24tbnVsbC1vcGVyYXRvclxuICAgIH1cblxuICAgIHJldHVybiBtYXliZUFsaWFzIHx8IHBhdGg7XG4gIH1cblxuICBnZXQgYWxpYXNlcygpOiBNYXA8UGF0aCwgUGF0aD4geyByZXR1cm4gdGhpcy5fYWxpYXNlczsgfVxuICBnZXQgY2FwYWJpbGl0aWVzKCk6IEhvc3RDYXBhYmlsaXRpZXMgeyByZXR1cm4gdGhpcy5fZGVsZWdhdGUuY2FwYWJpbGl0aWVzOyB9XG5cbiAgd3JpdGUocGF0aDogUGF0aCwgY29udGVudDogRmlsZUJ1ZmZlcik6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS53cml0ZSh0aGlzLl9yZXNvbHZlKHBhdGgpLCBjb250ZW50KTtcbiAgfVxuICByZWFkKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPEZpbGVCdWZmZXI+IHtcbiAgICByZXR1cm4gdGhpcy5fZGVsZWdhdGUucmVhZCh0aGlzLl9yZXNvbHZlKHBhdGgpKTtcbiAgfVxuICBkZWxldGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5kZWxldGUodGhpcy5fcmVzb2x2ZShwYXRoKSk7XG4gIH1cbiAgcmVuYW1lKGZyb206IFBhdGgsIHRvOiBQYXRoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuX2RlbGVnYXRlLnJlbmFtZSh0aGlzLl9yZXNvbHZlKGZyb20pLCB0aGlzLl9yZXNvbHZlKHRvKSk7XG4gIH1cblxuICBsaXN0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPFBhdGhGcmFnbWVudFtdPiB7XG4gICAgcmV0dXJuIHRoaXMuX2RlbGVnYXRlLmxpc3QodGhpcy5fcmVzb2x2ZShwYXRoKSk7XG4gIH1cblxuICBleGlzdHMocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5leGlzdHModGhpcy5fcmVzb2x2ZShwYXRoKSk7XG4gIH1cbiAgaXNEaXJlY3RvcnkocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5pc0RpcmVjdG9yeSh0aGlzLl9yZXNvbHZlKHBhdGgpKTtcbiAgfVxuICBpc0ZpbGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5pc0ZpbGUodGhpcy5fcmVzb2x2ZShwYXRoKSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCBzdGF0LlxuICBzdGF0KHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPFN0YXRzPFN0YXRzVD4+IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuX2RlbGVnYXRlLnN0YXQodGhpcy5fcmVzb2x2ZShwYXRoKSk7XG4gIH1cblxuICAvLyBTb21lIGhvc3RzIG1heSBub3Qgc3VwcG9ydCB3YXRjaGluZy5cbiAgd2F0Y2gocGF0aDogUGF0aCwgb3B0aW9ucz86IEhvc3RXYXRjaE9wdGlvbnMpOiBPYnNlcnZhYmxlPEhvc3RXYXRjaEV2ZW50PiB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLl9kZWxlZ2F0ZS53YXRjaCh0aGlzLl9yZXNvbHZlKHBhdGgpLCBvcHRpb25zKTtcbiAgfVxufVxuIl19