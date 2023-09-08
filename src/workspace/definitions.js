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
    _listener;
    _map;
    constructor(initial, _listener) {
        this._listener = _listener;
        this._map = new Map(initial && Object.entries(initial));
    }
    delete(key) {
        const result = this._map.delete(key);
        if (result) {
            this._listener?.(key, undefined, this);
        }
        return result;
    }
    set(key, value) {
        const updatedValue = value !== this.get(key);
        if (updatedValue) {
            this._map.set(key, value);
            this._listener?.(key, value, this);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmaW5pdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy93b3Jrc3BhY2UvZGVmaW5pdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBK0JILE1BQU0sb0JBQW9CO0lBR3lCO0lBRnpDLElBQUksQ0FBaUI7SUFFN0IsWUFBWSxPQUEyQixFQUFVLFNBQTJDO1FBQTNDLGNBQVMsR0FBVCxTQUFTLENBQWtDO1FBQzFGLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQsTUFBTSxDQUFDLEdBQVc7UUFDaEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFckMsSUFBSSxNQUFNLEVBQUU7WUFDVixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUN4QztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxHQUFHLENBQUMsR0FBVyxFQUFFLEtBQVE7UUFDdkIsTUFBTSxZQUFZLEdBQUcsS0FBSyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFN0MsSUFBSSxZQUFZLEVBQUU7WUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzFCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3BDO1FBRUQsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsT0FBTyxDQUNMLFVBQXlFLEVB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dGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHsgSnNvblZhbHVlIH0gZnJvbSAnLi4vanNvbic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV29ya3NwYWNlRGVmaW5pdGlvbiB7XG4gIHJlYWRvbmx5IGV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZSB8IHVuZGVmaW5lZD47XG4gIHJlYWRvbmx5IHByb2plY3RzOiBQcm9qZWN0RGVmaW5pdGlvbkNvbGxlY3Rpb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvamVjdERlZmluaXRpb24ge1xuICByZWFkb25seSBleHRlbnNpb25zOiBSZWNvcmQ8c3RyaW5nLCBKc29uVmFsdWUgfCB1bmRlZmluZWQ+O1xuICByZWFkb25seSB0YXJnZXRzOiBUYXJnZXREZWZpbml0aW9uQ29sbGVjdGlvbjtcblxuICByb290OiBzdHJpbmc7XG4gIHByZWZpeD86IHN0cmluZztcbiAgc291cmNlUm9vdD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYXJnZXREZWZpbml0aW9uIHtcbiAgb3B0aW9ucz86IFJlY29yZDxzdHJpbmcsIEpzb25WYWx1ZSB8IHVuZGVmaW5lZD47XG4gIGNvbmZpZ3VyYXRpb25zPzogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgSnNvblZhbHVlIHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZD47XG4gIGRlZmF1bHRDb25maWd1cmF0aW9uPzogc3RyaW5nO1xuICBidWlsZGVyOiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8ViBleHRlbmRzIG9iamVjdD4gPSAoXG4gIG5hbWU6IHN0cmluZyxcbiAgbmV3VmFsdWU6IFYgfCB1bmRlZmluZWQsXG4gIGNvbGxlY3Rpb246IERlZmluaXRpb25Db2xsZWN0aW9uPFY+LFxuKSA9PiB2b2lkO1xuXG5jbGFzcyBEZWZpbml0aW9uQ29sbGVjdGlvbjxWIGV4dGVuZHMgb2JqZWN0PiBpbXBsZW1lbnRzIFJlYWRvbmx5TWFwPHN0cmluZywgVj4ge1xuICBwcml2YXRlIF9tYXA6IE1hcDxzdHJpbmcsIFY+O1xuXG4gIGNvbnN0cnVjdG9yKGluaXRpYWw/OiBSZWNvcmQ8c3RyaW5nLCBWPiwgcHJpdmF0ZSBfbGlzdGVuZXI/OiBEZWZpbml0aW9uQ29sbGVjdGlvbkxpc3RlbmVyPFY+KSB7XG4gICAgdGhpcy5fbWFwID0gbmV3IE1hcChpbml0aWFsICYmIE9iamVjdC5lbnRyaWVzKGluaXRpYWwpKTtcbiAgfVxuXG4gIGRlbGV0ZShrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX21hcC5kZWxldGUoa2V5KTtcblxuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIHRoaXMuX2xpc3RlbmVyPy4oa2V5LCB1bmRlZmluZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzZXQoa2V5OiBzdHJpbmcsIHZhbHVlOiBWKTogdGhpcyB7XG4gICAgY29uc3QgdXBkYXRlZFZhbHVlID0gdmFsdWUgIT09IHRoaXMuZ2V0KGtleSk7XG5cbiAgICBpZiAodXBkYXRlZFZhbHVlKSB7XG4gICAgICB0aGlzLl9tYXAuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgdGhpcy5fbGlzdGVuZXI/LihrZXksIHZhbHVlLCB0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGZvckVhY2g8VD4oXG4gICAgY2FsbGJhY2tmbjogKHZhbHVlOiBWLCBrZXk6IHN0cmluZywgbWFwOiBEZWZpbml0aW9uQ29sbGVjdGlvbjxWPikgPT4gdm9pZCxcbiAgICB0aGlzQXJnPzogVCxcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5fbWFwLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IGNhbGxiYWNrZm4odmFsdWUsIGtleSwgdGhpcyksIHRoaXNBcmcpO1xuICB9XG5cbiAgZ2V0KGtleTogc3RyaW5nKTogViB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuX21hcC5nZXQoa2V5KTtcbiAgfVxuXG4gIGhhcyhrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAuaGFzKGtleSk7XG4gIH1cblxuICBnZXQgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl9tYXAuc2l6ZTtcbiAgfVxuXG4gIFtTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W3N0cmluZywgVl0+IHtcbiAgICByZXR1cm4gdGhpcy5fbWFwW1N5bWJvbC5pdGVyYXRvcl0oKTtcbiAgfVxuXG4gIGVudHJpZXMoKTogSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBWXT4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAuZW50cmllcygpO1xuICB9XG5cbiAga2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAua2V5cygpO1xuICB9XG5cbiAgdmFsdWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8Vj4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAudmFsdWVzKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNKc29uVmFsdWUodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBKc29uVmFsdWUge1xuICBjb25zdCB2aXNpdGVkID0gbmV3IFNldCgpO1xuXG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHZpc2l0ZWQuYWRkKHZhbHVlKTtcbiAgICAgIGZvciAoY29uc3QgcHJvcGVydHkgb2YgT2JqZWN0LnZhbHVlcyh2YWx1ZSkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmlzaXRlZC5oYXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc0pzb25WYWx1ZShwcm9wZXJ0eSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvamVjdERlZmluaXRpb25Db2xsZWN0aW9uIGV4dGVuZHMgRGVmaW5pdGlvbkNvbGxlY3Rpb248UHJvamVjdERlZmluaXRpb24+IHtcbiAgY29uc3RydWN0b3IoXG4gICAgaW5pdGlhbD86IFJlY29yZDxzdHJpbmcsIFByb2plY3REZWZpbml0aW9uPixcbiAgICBsaXN0ZW5lcj86IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8UHJvamVjdERlZmluaXRpb24+LFxuICApIHtcbiAgICBzdXBlcihpbml0aWFsLCBsaXN0ZW5lcik7XG4gIH1cblxuICBhZGQoZGVmaW5pdGlvbjoge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICByb290OiBzdHJpbmc7XG4gICAgc291cmNlUm9vdD86IHN0cmluZztcbiAgICBwcmVmaXg/OiBzdHJpbmc7XG4gICAgdGFyZ2V0cz86IFJlY29yZDxzdHJpbmcsIFRhcmdldERlZmluaXRpb24gfCB1bmRlZmluZWQ+O1xuICAgIFtrZXk6IHN0cmluZ106IHVua25vd247XG4gIH0pOiBQcm9qZWN0RGVmaW5pdGlvbiB7XG4gICAgaWYgKHRoaXMuaGFzKGRlZmluaXRpb24ubmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdCBuYW1lIGFscmVhZHkgZXhpc3RzLicpO1xuICAgIH1cbiAgICB0aGlzLl92YWxpZGF0ZU5hbWUoZGVmaW5pdGlvbi5uYW1lKTtcblxuICAgIGNvbnN0IHByb2plY3Q6IFByb2plY3REZWZpbml0aW9uID0ge1xuICAgICAgcm9vdDogZGVmaW5pdGlvbi5yb290LFxuICAgICAgcHJlZml4OiBkZWZpbml0aW9uLnByZWZpeCxcbiAgICAgIHNvdXJjZVJvb3Q6IGRlZmluaXRpb24uc291cmNlUm9vdCxcbiAgICAgIHRhcmdldHM6IG5ldyBUYXJnZXREZWZpbml0aW9uQ29sbGVjdGlvbigpLFxuICAgICAgZXh0ZW5zaW9uczoge30sXG4gICAgfTtcblxuICAgIGlmIChkZWZpbml0aW9uLnRhcmdldHMpIHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUsIHRhcmdldF0gb2YgT2JqZWN0LmVudHJpZXMoZGVmaW5pdGlvbi50YXJnZXRzKSkge1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgcHJvamVjdC50YXJnZXRzLnNldChuYW1lLCB0YXJnZXQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRlZmluaXRpb24pKSB7XG4gICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgY2FzZSAnbmFtZSc6XG4gICAgICAgIGNhc2UgJ3Jvb3QnOlxuICAgICAgICBjYXNlICdzb3VyY2VSb290JzpcbiAgICAgICAgY2FzZSAncHJlZml4JzpcbiAgICAgICAgY2FzZSAndGFyZ2V0cyc6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgaWYgKGlzSnNvblZhbHVlKHZhbHVlKSkge1xuICAgICAgICAgICAgcHJvamVjdC5leHRlbnNpb25zW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFwiJHtuYW1lfVwiIG11c3QgYmUgYSBKU09OIHZhbHVlLmApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdXBlci5zZXQoZGVmaW5pdGlvbi5uYW1lLCBwcm9qZWN0KTtcblxuICAgIHJldHVybiBwcm9qZWN0O1xuICB9XG5cbiAgb3ZlcnJpZGUgc2V0KG5hbWU6IHN0cmluZywgdmFsdWU6IFByb2plY3REZWZpbml0aW9uKTogdGhpcyB7XG4gICAgdGhpcy5fdmFsaWRhdGVOYW1lKG5hbWUpO1xuXG4gICAgc3VwZXIuc2V0KG5hbWUsIHZhbHVlKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmFsaWRhdGVOYW1lKG5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgfHwgIS9eKD86QFxcd1tcXHcuLV0qXFwvKT9cXHdbXFx3Li1dKiQvLnRlc3QobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdCBuYW1lIG11c3QgYmUgYSB2YWxpZCBucG0gcGFja2FnZSBuYW1lLicpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVGFyZ2V0RGVmaW5pdGlvbkNvbGxlY3Rpb24gZXh0ZW5kcyBEZWZpbml0aW9uQ29sbGVjdGlvbjxUYXJnZXREZWZpbml0aW9uPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGluaXRpYWw/OiBSZWNvcmQ8c3RyaW5nLCBUYXJnZXREZWZpbml0aW9uPixcbiAgICBsaXN0ZW5lcj86IERlZmluaXRpb25Db2xsZWN0aW9uTGlzdGVuZXI8VGFyZ2V0RGVmaW5pdGlvbj4sXG4gICkge1xuICAgIHN1cGVyKGluaXRpYWwsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIGFkZChcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICBuYW1lOiBzdHJpbmc7XG4gICAgfSAmIFRhcmdldERlZmluaXRpb24sXG4gICk6IFRhcmdldERlZmluaXRpb24ge1xuICAgIGlmICh0aGlzLmhhcyhkZWZpbml0aW9uLm5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RhcmdldCBuYW1lIGFscmVhZHkgZXhpc3RzLicpO1xuICAgIH1cbiAgICB0aGlzLl92YWxpZGF0ZU5hbWUoZGVmaW5pdGlvbi5uYW1lKTtcblxuICAgIGNvbnN0IHRhcmdldCA9IHtcbiAgICAgIGJ1aWxkZXI6IGRlZmluaXRpb24uYnVpbGRlcixcbiAgICAgIG9wdGlvbnM6IGRlZmluaXRpb24ub3B0aW9ucyxcbiAgICAgIGNvbmZpZ3VyYXRpb25zOiBkZWZpbml0aW9uLmNvbmZpZ3VyYXRpb25zLFxuICAgICAgZGVmYXVsdENvbmZpZ3VyYXRpb246IGRlZmluaXRpb24uZGVmYXVsdENvbmZpZ3VyYXRpb24sXG4gICAgfTtcblxuICAgIHN1cGVyLnNldChkZWZpbml0aW9uLm5hbWUsIHRhcmdldCk7XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgb3ZlcnJpZGUgc2V0KG5hbWU6IHN0cmluZywgdmFsdWU6IFRhcmdldERlZmluaXRpb24pOiB0aGlzIHtcbiAgICB0aGlzLl92YWxpZGF0ZU5hbWUobmFtZSk7XG5cbiAgICBzdXBlci5zZXQobmFtZSwgdmFsdWUpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwcml2YXRlIF92YWxpZGF0ZU5hbWUobmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVGFyZ2V0IG5hbWUgbXVzdCBiZSBhIHN0cmluZy4nKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==