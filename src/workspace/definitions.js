"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TargetDefinitionCollection = exports.ProjectDefinitionCollection = void 0;
class DefinitionCollection {
    constructor(initial, _listener) {
        this._listener = _listener;
        this._map = new Map(initial && Object.entries(initial));
    }
    delete(key) {
        const value = this._map.get(key);
        const result = this._map.delete(key);
        if (result && value !== undefined && this._listener) {
            this._listener(key, 'remove', undefined, value, this);
        }
        return result;
    }
    set(key, value) {
        const existing = this.get(key);
        this._map.set(key, value);
        if (this._listener) {
            this._listener(key, existing !== undefined ? 'replace' : 'add', value, existing, this);
        }
        return this;
    }
    forEach(callbackfn, thisArg) {
        this._map.forEach((value, key) => callbackfn(value, key, this), thisArg);
    }
    get(key) {
        return this._map.get(key);
    }
    has(key) {
        return this._map.has(key);
    }
    get size() {
        return this._map.size;
    }
    [Symbol.iterator]() {
        return this._map[Symbol.iterator]();
    }
    entries() {
        return this._map.entries();
    }
    keys() {
        return this._map.keys();
    }
    values() {
        return this._map.values();
    }
}
function isJsonValue(value) {
    const visited = new Set();
    switch (typeof value) {
        case 'boolean':
        case 'number':
        case 'string':
            return true;
        case 'object':
            if (value === null) {
                return true;
            }
            visited.add(value);
            for (const property of Object.values(value)) {
                if (typeof value === 'object' && visited.has(property)) {
                    continue;
                }
                if (!isJsonValue(property)) {
                    return false;
                }
            }
            return true;
        default:
            return false;
    }
}
class ProjectDefinitionCollection extends DefinitionCollection {
    constructor(initial, listener) {
        super(initial, listener);
    }
    add(definition) {
        if (this.has(definition.name)) {
            throw new Error('Project name already exists.');
        }
        this._validateName(definition.name);
        const project = {
            root: definition.root,
            prefix: definition.prefix,
            sourceRoot: definition.sourceRoot,
            targets: new TargetDefinitionCollection(),
            extensions: {},
        };
        if (definition.targets) {
            for (const [name, target] of Object.entries(definition.targets)) {
                if (target) {
                    project.targets.set(name, target);
                }
            }
        }
        for (const [name, value] of Object.entries(definition)) {
            switch (name) {
                case 'name':
                case 'root':
                case 'sourceRoot':
                case 'prefix':
                case 'targets':
                    break;
                default:
                    if (isJsonValue(value)) {
                        project.extensions[name] = value;
                    }
                    else {
                        throw new TypeError(`"${name}" must be a JSON value.`);
                    }
                    break;
            }
        }
        super.set(definition.name, project);
        return project;
    }
    set(name, value) {
        this._validateName(name);
        super.set(name, value);
        return this;
    }
    _validateName(name) {
        if (typeof name !== 'string' || !/^(?:@\w[\w.-]*\/)?\w[\w.-]*$/.test(name)) {
            throw new Error('Project name must be a valid npm package name.');
        }
    }
}
exports.ProjectDefinitionCollection = ProjectDefinitionCollection;
class TargetDefinitionCollection extends DefinitionCollection {
    constructor(initial, listener) {
        super(initial, listener);
    }
    add(definition) {
        if (this.has(definition.name)) {
            throw new Error('Target name already exists.');
        }
        this._validateName(definition.name);
        const target = {
            builder: definition.builder,
            options: definition.options,
            configurations: definition.configurations,
            defaultConfiguration: definition.defaultConfiguration,
        };
        super.set(definition.name, target);
        return target;
    }
    set(name, value) {
        this._validateName(name);
        super.set(name, value);
        return this;
    }
    _validateName(name) {
        if (typeof name !== 'string') {
            throw new TypeError('Target name must be a string.');
        }
    }
}
exports.TargetDefinitionCollection = TargetDefinitionCollection;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmaW5pdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy93b3Jrc3BhY2UvZGVmaW5pdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBa0NILE1BQU0sb0JBQW9CO0lBR3hCLFlBQVksT0FBMkIsRUFBVSxTQUEyQztRQUEzQyxjQUFTLEdBQVQsU0FBUyxDQUFrQztRQUMxRixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVELE1BQU0sQ0FBQyxHQUFXO1FBQ2hCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2pDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3JDLElBQUksTUFBTSxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNuRCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztTQUN2RDtRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxHQUFHLENBQUMsR0FBVyxFQUFFLEtBQVE7UUFDdkIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFMUIsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ2xCLElBQUksQ0FBQyxTQUFTLENBQUMs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QUFJLENBQUM7SUFDZCxDQUFDO0lBRU8sYUFBYSxDQUFDLElBQVk7UUFDaEMsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7WUFDNUIsTUFBTSxJQUFJLFNBQVMsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1NBQ3REO0lBQ0gsQ0FBQztDQUNGO0FBM0NELGdFQTJDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBKc29uVmFsdWUgfSBmcm9tICcuLi9qc29uJztcblxuZXhwb3J0IGludGVyZmFjZSBXb3Jrc3BhY2VEZWZpbml0aW9uIHtcbiAgcmVhZG9ubHkgZXh0ZW5zaW9uczogUmVjb3JkPHN0cmluZywgSnNvblZhbHVlIHwgdW5kZWZpbmVkPjtcblxuICByZWFkb25seSBwcm9qZWN0czogUHJvamVjdERlZmluaXRpb25Db2xsZWN0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByb2plY3REZWZpbml0aW9uIHtcbiAgcmVhZG9ubHkgZXh0ZW5zaW9uczogUmVjb3JkPHN0cmluZywgSnNvblZhbHVlIHwgdW5kZWZpbmVkPjtcbiAgcmVhZG9ubHkgdGFyZ2V0czogVGFyZ2V0RGVmaW5pdGlvbkNvbGxlY3Rpb247XG5cbiAgcm9vdDogc3RyaW5nO1xuICBwcmVmaXg/OiBzdHJpbmc7XG4gIHNvdXJjZVJvb3Q/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFyZ2V0RGVmaW5pdGlvbiB7XG4gIG9wdGlvbnM/OiBSZWNvcmQ8c3RyaW5nLCBKc29uVmFsdWUgfCB1bmRlZmluZWQ+O1xuICBjb25maWd1cmF0aW9ucz86IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZSB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQ+O1xuICBkZWZhdWx0Q29uZmlndXJhdGlvbj86IHN0cmluZztcbiAgYnVpbGRlcjogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFYgZXh0ZW5kcyBvYmplY3Q+ID0gKFxuICBuYW1lOiBzdHJpbmcsXG4gIGFjdGlvbjogJ2FkZCcgfCAncmVtb3ZlJyB8ICdyZXBsYWNlJyxcbiAgbmV3VmFsdWU6IFYgfCB1bmRlZmluZWQsXG4gIG9sZFZhbHVlOiBWIHwgdW5kZWZpbmVkLFxuICBjb2xsZWN0aW9uOiBEZWZpbml0aW9uQ29sbGVjdGlvbjxWPixcbikgPT4gdm9pZDtcblxuY2xhc3MgRGVmaW5pdGlvbkNvbGxlY3Rpb248ViBleHRlbmRzIG9iamVjdD4gaW1wbGVtZW50cyBSZWFkb25seU1hcDxzdHJpbmcsIFY+IHtcbiAgcHJpdmF0ZSBfbWFwOiBNYXA8c3RyaW5nLCBWPjtcblxuICBjb25zdHJ1Y3Rvcihpbml0aWFsPzogUmVjb3JkPHN0cmluZywgVj4sIHByaXZhdGUgX2xpc3RlbmVyPzogRGVmaW5pdGlvbkNvbGxlY3Rpb25MaXN0ZW5lcjxWPikge1xuICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoaW5pdGlhbCAmJiBPYmplY3QuZW50cmllcyhpbml0aWFsKSk7XG4gIH1cblxuICBkZWxldGUoa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuX21hcC5nZXQoa2V5KTtcbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9tYXAuZGVsZXRlKGtleSk7XG4gICAgaWYgKHJlc3VsdCAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHRoaXMuX2xpc3RlbmVyKSB7XG4gICAgICB0aGlzLl9saXN0ZW5lcihrZXksICdyZW1vdmUnLCB1bmRlZmluZWQsIHZhbHVlLCB0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgc2V0KGtleTogc3RyaW5nLCB2YWx1ZTogVik6IHRoaXMge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5nZXQoa2V5KTtcbiAgICB0aGlzLl9tYXAuc2V0KGtleSwgdmFsdWUpO1xuXG4gICAgaWYgKHRoaXMuX2xpc3RlbmVyKSB7XG4gICAgICB0aGlzLl9saXN0ZW5lcihrZXksIGV4aXN0aW5nICE9PSB1bmRlZmluZWQgPyAncmVwbGFjZScgOiAnYWRkJywgdmFsdWUsIGV4aXN0aW5nLCB0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGZvckVhY2g8VD4oXG4gICAgY2FsbGJhY2tmbjogKHZhbHVlOiBWLCBrZXk6IHN0cmluZywgbWFwOiBEZWZpbml0aW9uQ29sbGVjdGlvbjxWPikgPT4gdm9pZCxcbiAgICB0aGlzQXJnPzogVCxcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5fbWFwLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IGNhbGxiYWNrZm4odmFsdWUsIGtleSwgdGhpcyksIHRoaXNBcmcpO1xuICB9XG5cbiAgZ2V0KGtleTogc3RyaW5nKTogViB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuX21hcC5nZXQoa2V5KTtcbiAgfVxuXG4gIGhhcyhrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAuaGFzKGtleSk7XG4gIH1cblxuICBnZXQgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl9tYXAuc2l6ZTtcbiAgfVxuXG4gIFtTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W3N0cmluZywgVl0+IHtcbiAgICByZXR1cm4gdGhpcy5fbWFwW1N5bWJvbC5pdGVyYXRvcl0oKTtcbiAgfVxuXG4gIGVudHJpZXMoKTogSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBWXT4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAuZW50cmllcygpO1xuICB9XG5cbiAga2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAua2V5cygpO1xuICB9XG5cbiAgdmFsdWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8Vj4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAudmFsdWVzKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNKc29uVmFsdWUodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBKc29uVmFsdWUge1xuICBjb25zdCB2aXNpdGVkID0gbmV3IFNldCgpO1xuXG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHZpc2l0ZWQuYWRkKHZhbHVlKTtcbiAgICAgIGZvciAoY29uc3QgcHJvcGVydHkgb2YgT2JqZWN0LnZhbHVlcyh2YWx1ZSkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmlzaXRlZC5oYXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc0pzb25WYWx1ZShwcm9wZXJ0eSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvamVjdERlZmluaXRpb25Db2xsZWN0aW9uIGV4dGVuZHMgRGVmaW5pdGlvbkNvbGxlY3Rpb248UHJvamVjdERlZmluaXRpb24+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgaW5pdGlhbD86IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPixcbiAgICBsaXN0ZW5lcj86IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8UHJvamVjdERlZmluaXRpb24+LFxuICApIHtcbiAgICBzdXBlcihpbml0aWFsLCBsaXN0ZW5lcik7XG4gIH1cblxuICBhZGQoZGVmaW5pdGlvbjoge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICByb290OiBzdHJpbmc7XG4gICAgc291cmNlUm9vdD86IHN0cmluZztcbiAgICBwcmVmaXg/OiBzdHJpbmc7XG4gICAgdGFyZ2V0cz86IFJlY29yZDxzdHJpbmcsIFRhcmdldERlZmluaXRpb24gfCB1bmRlZmluZWQ+O1xuICAgIFtrZXk6IHN0cmluZ106IHVua25vd247XG4gIH0pOiBQcm9qZWN0RGVmaW5pdGlvbiB7XG4gICAgaWYgKHRoaXMuaGFzKGRlZmluaXRpb24ubmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdCBuYW1lIGFscmVhZHkgZXhpc3RzLicpO1xuICAgIH1cbiAgICB0aGlzLl92YWxpZGF0ZU5hbWUoZGVmaW5pdGlvbi5uYW1lKTtcblxuICAgIGNvbnN0IHByb2plY3Q6IFByb2plY3REZWZpbml0aW9uID0ge1xuICAgICAgcm9vdDogZGVmaW5pdGlvbi5yb290LFxuICAgICAgcHJlZml4OiBkZWZpbml0aW9uLnByZWZpeCxcbiAgICAgIHNvdXJjZVJvb3Q6IGRlZmluaXRpb24uc291cmNlUm9vdCxcbiAgICAgIHRhcmdldHM6IG5ldyBUYXJnZXREZWZpbml0aW9uQ29sbGVjdGlvbigpLFxuICAgICAgZXh0ZW5zaW9uczoge30sXG4gICAgfTtcblxuICAgIGlmIChkZWZpbml0aW9uLnRhcmdldHMpIHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUsIHRhcmdldF0gb2YgT2JqZWN0LmVudHJpZXMoZGVmaW5pdGlvbi50YXJnZXRzKSkge1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgcHJvamVjdC50YXJnZXRzLnNldChuYW1lLCB0YXJnZXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRlZmluaXRpb24pKSB7XG4gICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgY2FzZSAnbmFtZSc6XG4gICAgICAgIGNhc2UgJ3Jvb3QnOlxuICAgICAgICBjYXNlICdzb3VyY2VSb290JzpcbiAgICAgICAgY2FzZSAncHJlZml4JzpcbiAgICAgICAgY2FzZSAndGFyZ2V0cyc6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKGlzSnNvblZhbHVlKHZhbHVlKSkge1xuICAgICAgICAgICAgcHJvamVjdC5leHRlbnNpb25zW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFwiJHtuYW1lfVwiIG11c3QgYmUgYSBKU09OIHZhbHVlLmApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdXBlci5zZXQoZGVmaW5pdGlvbi5uYW1lLCBwcm9qZWN0KTtcblxuICAgIHJldHVybiBwcm9qZWN0O1xuICB9XG5cbiAgb3ZlcnJpZGUgc2V0KG5hbWU6IHN0cmluZywgdmFsdWU6IFByb2plY3REZWZpbml0aW9uKTogdGhpcyB7XG4gICAgdGhpcy5fdmFsaWRhdGVOYW1lKG5hbWUpO1xuXG4gICAgc3VwZXIuc2V0KG5hbWUsIHZhbHVlKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmFsaWRhdGVOYW1lKG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgfHwgIS9eKD86QFxcd1tcXHcuLV0qXFwvKT9cXHdbXFx3Li1dKiQvLnRlc3QobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdCBuYW1lIG11c3QgYmUgYSB2YWxpZCBucG0gcGFja2FnZSBuYW1lLicpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGFyZ2V0RGVmaW5pdGlvbkNvbGxlY3Rpb24gZXh0ZW5kcyBEZWZpbml0aW9uQ29sbGVjdGlvbjxUYXJnZXREZWZpbml0aW9uPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGluaXRpYWw/OiBSZWNvcmQ8c3RyaW5nLCBUYXJnZXREZWZpbml0aW9uPixcbiAgICBsaXN0ZW5lcj86IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8VGFyZ2V0RGVmaW5pdGlvbj4sXG4gICkge1xuICAgIHN1cGVyKGluaXRpYWwsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIGFkZChcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgfSAmIFRhcmdldERlZmluaXRpb24sXG4gICk6IFRhcmdldERlZmluaXRpb24ge1xuICAgIGlmICh0aGlzLmhhcyhkZWZpbml0aW9uLm5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RhcmdldCBuYW1lIGFscmVhZHkgZXhpc3RzLicpO1xuICAgIH1cbiAgICB0aGlzLl92YWxpZGF0ZU5hbWUoZGVmaW5pdGlvbi5uYW1lKTtcblxuICAgIGNvbnN0IHRhcmdldCA9IHtcbiAgICAgIGJ1aWxkZXI6IGRlZmluaXRpb24uYnVpbGRlcixcbiAgICAgIG9wdGlvbnM6IGRlZmluaXRpb24ub3B0aW9ucyxcbiAgICAgIGNvbmZpZ3VyYXRpb25zOiBkZWZpbml0aW9uLmNvbmZpZ3VyYXRpb25zLFxuICAgICAgZGVmYXVsdENvbmZpZ3VyYXRpb246IGRlZmluaXRpb24uZGVmYXVsdENvbmZpZ3VyYXRpb24sXG4gICAgfTtcblxuICAgIHN1cGVyLnNldChkZWZpbml0aW9uLm5hbWUsIHRhcmdldCk7XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgb3ZlcnJpZGUgc2V0KG5hbWU6IHN0cmluZywgdmFsdWU6IFRhcmdldERlZmluaXRpb24pOiB0aGlzIHtcbiAgICB0aGlzLl92YWxpZGF0ZU5hbWUobmFtZSk7XG5cbiAgICBzdXBlci5zZXQobmFtZSwgdmFsdWUpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwcml2YXRlIF92YWxpZGF0ZU5hbWUobmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGFyZ2V0IG5hbWUgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==