"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const exception_1 = require("../../exception");
const json_1 = require("../../json");
const virtual_fs_1 = require("../../virtual-fs");
class WorkspaceFileNotFoundException extends exception_1.BaseException {
    constructor(path) {
        super(`Workspace could not be found from path ${path}.`);
    }
}
exports.WorkspaceFileNotFoundException = WorkspaceFileNotFoundException;
class ProjectNotFoundException extends exception_1.BaseException {
    constructor(name) {
        super(`Project '${name}' could not be found in workspace.`);
    }
}
exports.ProjectNotFoundException = ProjectNotFoundException;
class WorkspaceToolNotFoundException extends exception_1.BaseException {
    constructor(name) {
        super(`Tool ${name} could not be found in workspace.`);
    }
}
exports.WorkspaceToolNotFoundException = WorkspaceToolNotFoundException;
class ProjectToolNotFoundException extends exception_1.BaseException {
    constructor(name) {
        super(`Tool ${name} could not be found in project.`);
    }
}
exports.ProjectToolNotFoundException = ProjectToolNotFoundException;
class WorkspaceNotYetLoadedException extends exception_1.BaseException {
    constructor() { super(`Workspace needs to be loaded before it is used.`); }
}
exports.WorkspaceNotYetLoadedException = WorkspaceNotYetLoadedException;
class AmbiguousProjectPathException extends exception_1.BaseException {
    constructor(path, projects) {
        super(`Current active project is ambiguous (${projects.join(',')}) using path: '${path}'`);
        this.path = path;
        this.projects = projects;
    }
}
exports.AmbiguousProjectPathException = AmbiguousProjectPathException;
async function _findUp(host, names, from) {
    if (!Array.isArray(names)) {
        names = [names];
    }
    do {
        for (const name of names) {
            const p = virtual_fs_1.join(from, name);
            if (await host.exists(p)) {
                return p;
            }
        }
        from = virtual_fs_1.dirname(from);
    } while (from && from !== virtual_fs_1.dirname(from));
    return null;
}
class Workspace {
    constructor(_root, _host, registry) {
        this._root = _root;
        this._host = _host;
        this._workspaceSchemaPath = virtual_fs_1.normalize(require.resolve('./workspace-schema.json'));
        if (registry) {
            this._registry = registry;
        }
        else {
            this._registry = new json_1.schema.CoreSchemaRegistry();
            this._registry.addPostTransform(json_1.schema.transforms.addUndefinedDefaults);
        }
    }
    static async findWorkspaceFile(host, path) {
        return await _findUp(host, this._workspaceFileNames, path);
    }
    static async fromPath(host, path, registry) {
        const maybePath = await this.findWorkspaceFile(host, path);
        if (!maybePath) {
            throw new WorkspaceFileNotFoundException(path);
        }
        return new Workspace(virtual_fs_1.dirname(maybePath), host, registry)
            .loadWorkspaceFromHost(virtual_fs_1.basename(maybePath))
            .pipe(operators_1.first())
            .toPromise();
    }
    loadWorkspaceFromJson(json) {
        return this._loadWorkspaceSchema().pipe(operators_1.concatMap((workspaceSchema) => this.validateAgainstSchema(json, workspaceSchema)), operators_1.tap((validatedWorkspace) => this._workspace = validatedWorkspace), operators_1.map(() => this));
    }
    loadWorkspaceFromHost(workspacePath) {
        return this._loadWorkspaceSchema().pipe(operators_1.concatMap(() => this._loadJsonFile(virtual_fs_1.join(this._root, workspacePath))), operators_1.concatMap(json => this.loadWorkspaceFromJson(json)));
    }
    _loadWorkspaceSchema() {
        if (this._workspaceSchema) {
            return rxjs_1.of(this._workspaceSchema);
        }
        else {
            return this._loadJsonFile(this._workspaceSchemaPath).pipe(operators_1.tap((workspaceSchema) => this._workspaceSchema = workspaceSchema));
        }
    }
    _assertLoaded() {
        if (!this._workspace) {
            throw new WorkspaceNotYetLoadedException();
        }
    }
    get root() {
        return this._root;
    }
    get host() {
        return this._host;
    }
    get version() {
        this._assertLoaded();
        return this._workspace.version;
    }
    get newProjectRoot() {
        this._assertLoaded();
        return this._workspace.newProjectRoot;
    }
    listProjectNames() {
        return Object.keys(this._workspace.projects);
    }
    getProject(projectName) {
        this._assertLoaded();
        const workspaceProject = this._workspace.projects[projectName];
        if (!workspaceProject) {
            throw new ProjectNotFoundException(projectName);
        }
        // Return only the project properties, and remove the tools.
        const workspaceProjectClone = Object.assign({}, workspaceProject);
        delete workspaceProjectClone['cli'];
        delete workspaceProjectClone['schematics'];
        delete workspaceProjectClone['architect'];
        delete workspaceProjectClone['targets'];
        return workspaceProjectClone;
    }
    getDefaultProjectName() {
        this._assertLoaded();
        if (this._workspace.defaultProject) {
            // If there is a default project name, return it.
            return this._workspace.defaultProject;
        }
        else if (this.listProjectNames().length === 1) {
            // If there is only one project, return that one.
            return this.listProjectNames()[0];
        }
        // Otherwise return null.
        return null;
    }
    getProjectByPath(path) {
        this._assertLoaded();
        const projectNames = this.listProjectNames();
        if (projectNames.length === 1) {
            return projectNames[0];
        }
        const isInside = (base, potential) => {
            const absoluteBase = virtual_fs_1.resolve(this.root, base);
            const absolutePotential = virtual_fs_1.resolve(this.root, potential);
            const relativePotential = virtual_fs_1.relative(absoluteBase, absolutePotential);
            if (!relativePotential.startsWith('..') && !virtual_fs_1.isAbsolute(relativePotential)) {
                return true;
            }
            return false;
        };
        const projects = this.listProjectNames()
            .map(name => [this.getProject(name).root, name])
            .filter(tuple => isInside(tuple[0], path))
            // Sort tuples by depth, with the deeper ones first. Since the first member is a path and
            // we filtered all invalid paths, the longest will be the deepest (and in case of equality
            // the sort is stable and the first declared project will win).
            .sort((a, b) => b[0].length - a[0].length);
        if (projects.length === 0) {
            return null;
        }
        else if (projects.length > 1) {
            const found = new Set();
            const sameRoots = projects.filter(v => {
                if (!found.has(v[0])) {
                    found.add(v[0]);
                    return false;
                }
                return true;
            });
            if (sameRoots.length > 0) {
                throw new AmbiguousProjectPathException(path, sameRoots.map(v => v[1]));
            }
        }
        return projects[0][1];
    }
    getCli() {
        return this._getTool('cli');
    }
    getSchematics() {
        return this._getTool('schematics');
    }
    getTargets() {
        return this._getTool('targets');
    }
    getProjectCli(projectName) {
        return this._getProjectTool(projectName, 'cli');
    }
    getProjectSchematics(projectName) {
        return this._getProjectTool(projectName, 'schematics');
    }
    getProjectTargets(projectName) {
        return this._getProjectTool(projectName, 'targets');
    }
    _getTool(toolName) {
        this._assertLoaded();
        let workspaceTool = this._workspace[toolName];
        // Try falling back to 'architect' if 'targets' is not there or is empty.
        if ((!workspaceTool || Object.keys(workspaceTool).length === 0)
            && toolName === 'targets'
            && this._workspace['architect']) {
            workspaceTool = this._workspace['architect'];
        }
        if (!workspaceTool) {
            throw new WorkspaceToolNotFoundException(toolName);
        }
        return workspaceTool;
    }
    _getProjectTool(projectName, toolName) {
        this._assertLoaded();
        const workspaceProject = this._workspace.projects[projectName];
        if (!workspaceProject) {
            throw new ProjectNotFoundException(projectName);
        }
        let projectTool = workspaceProject[toolName];
        // Try falling back to 'architect' if 'targets' is not there or is empty.
        if ((!projectTool || Object.keys(projectTool).length === 0)
            && workspaceProject['architect']
            && toolName === 'targets') {
            projectTool = workspaceProject['architect'];
        }
        if (!projectTool) {
            throw new ProjectToolNotFoundException(toolName);
        }
        return projectTool;
    }
    // TODO: add transforms to resolve paths.
    validateAgainstSchema(contentJson, schemaJson) {
        // JSON validation modifies the content, so we validate a copy of it instead.
        const contentJsonCopy = JSON.parse(JSON.stringify(contentJson));
        return this._registry.compile(schemaJson).pipe(operators_1.concatMap(validator => validator(contentJsonCopy)), operators_1.concatMap(validatorResult => {
            if (validatorResult.success) {
                return rxjs_1.of(contentJsonCopy);
            }
            else {
                return rxjs_1.throwError(new json_1.schema.SchemaValidationException(validatorResult.errors));
            }
        }));
    }
    _loadJsonFile(path) {
        return this._host.read(virtual_fs_1.normalize(path)).pipe(operators_1.map(buffer => virtual_fs_1.virtualFs.fileBufferToString(buffer)), operators_1.map(str => json_1.parseJson(str, json_1.JsonParseMode.Loose)));
    }
}
Workspace._workspaceFileNames = [
    'angular.json',
    '.angular.json',
    'workspace.json',
    '.workspace.json',
];
exports.Workspace = Workspace;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9leHBlcmltZW50YWwvd29ya3NwYWNlL3dvcmtzcGFjZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUlILCtCQUFrRDtBQUNsRCw4Q0FBNEQ7QUFDNUQsK0NBQWdEO0FBQ2hELHFDQUtvQjtBQUNwQixpREFVMEI7QUFJMUIsTUFBYSw4QkFBK0IsU0FBUSx5QkFBYTtJQUMvRCxZQUFZLElBQVU7UUFDcEIsS0FBSyxDQUFDLDBDQUEwQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQzNELENBQUM7Q0FDRjtBQUpELHdFQUlDO0FBRUQsTUFBYSx3QkFBeUIsU0FBUSx5QkFBYTtJQUN6RCxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLFlBQVksSUFBSSxvQ0FBb0MsQ0FBQyxDQUFDO0lBQzlELENBQUM7Q0FDRjtBQUpELDREQUlDO0FBRUQsTUFBYSw4QkFBK0IsU0FBUSx5QkFBYTtJQUMvRCxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLFFBQVEsSUFBSSxtQ0FBbUMsQ0FBQyxDQUFDO0lBQ3pELENBQUM7Q0FDRjtBQUpELHdFQUlDO0FBRUQsTUFBYSw0QkFBNkIsU0FBUSx5QkFBYTtJQUM3RCxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLFFBQVEsSUFBSSxpQ0FBaUMsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7Q0FDRjtBQUpELG9FQUlDO0FBRUQsTUFBYSw4QkFBK0IsU0FBUSx5QkFBYTtJQUMvRCxnQkFBZ0IsS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVFO0FBRkQsd0VBRUM7QUFFRCxNQUFhLDZCQUE4QixTQUFRLHlCQUFhO0lBQzlELFlBQTRCLElBQVUsRUFBa0IsUUFBK0I7UUFDckYsS0FBSyxDQUFDLHdDQUF3QyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FB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MUMsZUFBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsc0JBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUNuRCxlQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxnQkFBUyxDQUFDLEdBQUcsRUFBRSxvQkFBYSxDQUFDLEtBQUssQ0FBcUIsQ0FBQyxDQUNwRSxDQUFDO0lBQ0osQ0FBQzs7QUFsUmdCLDZCQUFtQixHQUFHO0lBQ3JDLGNBQWM7SUFDZCxlQUFlO0lBQ2YsZ0JBQWdCO0lBQ2hCLGlCQUFpQjtDQUNsQixDQUFDO0FBTkosOEJBb1JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUsIG9mLCB0aHJvd0Vycm9yIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQgeyBjb25jYXRNYXAsIGZpcnN0LCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi8uLi9leGNlcHRpb24nO1xuaW1wb3J0IHtcbiAgSnNvbk9iamVjdCxcbiAgSnNvblBhcnNlTW9kZSxcbiAgcGFyc2VKc29uLFxuICBzY2hlbWEsXG59IGZyb20gJy4uLy4uL2pzb24nO1xuaW1wb3J0IHtcbiAgUGF0aCxcbiAgYmFzZW5hbWUsXG4gIGRpcm5hbWUsXG4gIGlzQWJzb2x1dGUsXG4gIGpvaW4sXG4gIG5vcm1hbGl6ZSxcbiAgcmVsYXRpdmUsXG4gIHJlc29sdmUsXG4gIHZpcnR1YWxGcyxcbn0gZnJvbSAnLi4vLi4vdmlydHVhbC1mcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VQcm9qZWN0LCBXb3Jrc3BhY2VTY2hlbWEsIFdvcmtzcGFjZVRvb2wgfSBmcm9tICcuL3dvcmtzcGFjZS1zY2hlbWEnO1xuXG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VGaWxlTm90Rm91bmRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IocGF0aDogUGF0aCkge1xuICAgIHN1cGVyKGBXb3Jrc3BhY2UgY291bGQgbm90IGJlIGZvdW5kIGZyb20gcGF0aCAke3BhdGh9LmApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQcm9qZWN0Tm90Rm91bmRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoYFByb2plY3QgJyR7bmFtZX0nIGNvdWxkIG5vdCBiZSBmb3VuZCBpbiB3b3Jrc3BhY2UuYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZVRvb2xOb3RGb3VuZEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgVG9vbCAke25hbWV9IGNvdWxkIG5vdCBiZSBmb3VuZCBpbiB3b3Jrc3BhY2UuYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFByb2plY3RUb29sTm90Rm91bmRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoYFRvb2wgJHtuYW1lfSBjb3VsZCBub3QgYmUgZm91bmQgaW4gcHJvamVjdC5gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlTm90WWV0TG9hZGVkRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKCkgeyBzdXBlcihgV29ya3NwYWNlIG5lZWRzIHRvIGJlIGxvYWRlZCBiZWZvcmUgaXQgaXMgdXNlZC5gKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgQW1iaWd1b3VzUHJvamVjdFBhdGhFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IHBhdGg6IFBhdGgsIHB1YmxpYyByZWFkb25seSBwcm9qZWN0czogUmVhZG9ubHlBcnJheTxzdHJpbmc+KSB7XG4gICAgc3VwZXIoYEN1cnJlbnQgYWN0aXZlIHByb2plY3QgaXMgYW1iaWd1b3VzICgke3Byb2plY3RzLmpvaW4oJywnKX0pIHVzaW5nIHBhdGg6ICcke3BhdGh9J2ApO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9maW5kVXAoaG9zdDogdmlydHVhbEZzLkhvc3QsIG5hbWVzOiBzdHJpbmdbXSwgZnJvbTogUGF0aCk6IFByb21pc2U8UGF0aCB8IG51bGw+IHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KG5hbWVzKSkge1xuICAgIG5hbWVzID0gW25hbWVzXTtcbiAgfVxuXG4gIGRvIHtcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgbmFtZXMpIHtcbiAgICAgIGNvbnN0IHAgPSBqb2luKGZyb20sIG5hbWUpO1xuICAgICAgaWYgKGF3YWl0IGhvc3QuZXhpc3RzKHApKSB7XG4gICAgICAgIHJldHVybiBwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZyb20gPSBkaXJuYW1lKGZyb20pO1xuICB9IHdoaWxlIChmcm9tICYmIGZyb20gIT09IGRpcm5hbWUoZnJvbSkpO1xuXG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlIHtcbiAgcHJvdGVjdGVkIHN0YXRpYyBfd29ya3NwYWNlRmlsZU5hbWVzID0gW1xuICAgICdhbmd1bGFyLmpzb24nLFxuICAgICcuYW5ndWxhci5qc29uJyxcbiAgICAnd29ya3NwYWNlLmpzb24nLFxuICAgICcud29ya3NwYWNlLmpzb24nLFxuICBdO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZVNjaGVtYVBhdGggPSBub3JtYWxpemUocmVxdWlyZS5yZXNvbHZlKCcuL3dvcmtzcGFjZS1zY2hlbWEuanNvbicpKTtcbiAgcHJpdmF0ZSBfd29ya3NwYWNlU2NoZW1hOiBKc29uT2JqZWN0O1xuICBwcml2YXRlIF93b3Jrc3BhY2U6IFdvcmtzcGFjZVNjaGVtYTtcbiAgcHJpdmF0ZSBfcmVnaXN0cnk6IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBfcm9vdDogUGF0aCxcbiAgICBwcml2YXRlIF9ob3N0OiB2aXJ0dWFsRnMuSG9zdDx7fT4sXG4gICAgcmVnaXN0cnk/OiBzY2hlbWEuQ29yZVNjaGVtYVJlZ2lzdHJ5LFxuICApIHtcbiAgICBpZiAocmVnaXN0cnkpIHtcbiAgICAgIHRoaXMuX3JlZ2lzdHJ5ID0gcmVnaXN0cnk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3JlZ2lzdHJ5ID0gbmV3IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnkoKTtcbiAgICAgIHRoaXMuX3JlZ2lzdHJ5LmFkZFBvc3RUcmFuc2Zvcm0oc2NoZW1hLnRyYW5zZm9ybXMuYWRkVW5kZWZpbmVkRGVmYXVsdHMpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBmaW5kV29ya3NwYWNlRmlsZShob3N0OiB2aXJ0dWFsRnMuSG9zdDx7fT4sIHBhdGg6IFBhdGgpOiBQcm9taXNlPFBhdGggfCBudWxsPiB7XG4gICAgcmV0dXJuIGF3YWl0IF9maW5kVXAoaG9zdCwgdGhpcy5fd29ya3NwYWNlRmlsZU5hbWVzLCBwYXRoKTtcbiAgfVxuICBzdGF0aWMgYXN5bmMgZnJvbVBhdGgoXG4gICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8e30+LFxuICAgIHBhdGg6IFBhdGgsXG4gICAgcmVnaXN0cnk6IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnksXG4gICk6IFByb21pc2U8V29ya3NwYWNlPiB7XG4gICAgY29uc3QgbWF5YmVQYXRoID0gYXdhaXQgdGhpcy5maW5kV29ya3NwYWNlRmlsZShob3N0LCBwYXRoKTtcblxuICAgIGlmICghbWF5YmVQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgV29ya3NwYWNlRmlsZU5vdEZvdW5kRXhjZXB0aW9uKHBhdGgpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgV29ya3NwYWNlKGRpcm5hbWUobWF5YmVQYXRoKSwgaG9zdCwgcmVnaXN0cnkpXG4gICAgICAubG9hZFdvcmtzcGFjZUZyb21Ib3N0KGJhc2VuYW1lKG1heWJlUGF0aCkpXG4gICAgICAucGlwZShmaXJzdCgpKVxuICAgICAgLnRvUHJvbWlzZSgpO1xuICB9XG5cbiAgbG9hZFdvcmtzcGFjZUZyb21Kc29uKGpzb246IHt9KSB7XG4gICAgcmV0dXJuIHRoaXMuX2xvYWRXb3Jrc3BhY2VTY2hlbWEoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCh3b3Jrc3BhY2VTY2hlbWEpID0+IHRoaXMudmFsaWRhdGVBZ2FpbnN0U2NoZW1hKGpzb24sIHdvcmtzcGFjZVNjaGVtYSkpLFxuICAgICAgdGFwKCh2YWxpZGF0ZWRXb3Jrc3BhY2U6IFdvcmtzcGFjZVNjaGVtYSkgPT4gdGhpcy5fd29ya3NwYWNlID0gdmFsaWRhdGVkV29ya3NwYWNlKSxcbiAgICAgIG1hcCgoKSA9PiB0aGlzKSxcbiAgICApO1xuICB9XG5cbiAgbG9hZFdvcmtzcGFjZUZyb21Ib3N0KHdvcmtzcGFjZVBhdGg6IFBhdGgpIHtcbiAgICByZXR1cm4gdGhpcy5fbG9hZFdvcmtzcGFjZVNjaGVtYSgpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKCkgPT4gdGhpcy5fbG9hZEpzb25GaWxlKGpvaW4odGhpcy5fcm9vdCwgd29ya3NwYWNlUGF0aCkpKSxcbiAgICAgIGNvbmNhdE1hcChqc29uID0+IHRoaXMubG9hZFdvcmtzcGFjZUZyb21Kc29uKGpzb24pKSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfbG9hZFdvcmtzcGFjZVNjaGVtYSgpIHtcbiAgICBpZiAodGhpcy5fd29ya3NwYWNlU2NoZW1hKSB7XG4gICAgICByZXR1cm4gb2YodGhpcy5fd29ya3NwYWNlU2NoZW1hKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX2xvYWRKc29uRmlsZSh0aGlzLl93b3Jrc3BhY2VTY2hlbWFQYXRoKS5waXBlKFxuICAgICAgICB0YXAoKHdvcmtzcGFjZVNjaGVtYSkgPT4gdGhpcy5fd29ya3NwYWNlU2NoZW1hID0gd29ya3NwYWNlU2NoZW1hKSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYXNzZXJ0TG9hZGVkKCkge1xuICAgIGlmICghdGhpcy5fd29ya3NwYWNlKSB7XG4gICAgICB0aHJvdyBuZXcgV29ya3NwYWNlTm90WWV0TG9hZGVkRXhjZXB0aW9uKCk7XG4gICAgfVxuICB9XG5cbiAgZ2V0IHJvb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jvb3Q7XG4gIH1cblxuICBnZXQgaG9zdCgpIHtcbiAgICByZXR1cm4gdGhpcy5faG9zdDtcbiAgfVxuXG4gIGdldCB2ZXJzaW9uKCkge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuX3dvcmtzcGFjZS52ZXJzaW9uO1xuICB9XG5cbiAgZ2V0IG5ld1Byb2plY3RSb290KCkge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuX3dvcmtzcGFjZS5uZXdQcm9qZWN0Um9vdDtcbiAgfVxuXG4gIGxpc3RQcm9qZWN0TmFtZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl93b3Jrc3BhY2UucHJvamVjdHMpO1xuICB9XG5cbiAgZ2V0UHJvamVjdChwcm9qZWN0TmFtZTogc3RyaW5nKTogV29ya3NwYWNlUHJvamVjdCB7XG4gICAgdGhpcy5fYXNzZXJ0TG9hZGVkKCk7XG5cbiAgICBjb25zdCB3b3Jrc3BhY2VQcm9qZWN0ID0gdGhpcy5fd29ya3NwYWNlLnByb2plY3RzW3Byb2plY3ROYW1lXTtcblxuICAgIGlmICghd29ya3NwYWNlUHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFByb2plY3ROb3RGb3VuZEV4Y2VwdGlvbihwcm9qZWN0TmFtZSk7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIG9ubHkgdGhlIHByb2plY3QgcHJvcGVydGllcywgYW5kIHJlbW92ZSB0aGUgdG9vbHMuXG4gICAgY29uc3Qgd29ya3NwYWNlUHJvamVjdENsb25lID0gey4uLndvcmtzcGFjZVByb2plY3R9O1xuICAgIGRlbGV0ZSB3b3Jrc3BhY2VQcm9qZWN0Q2xvbmVbJ2NsaSddO1xuICAgIGRlbGV0ZSB3b3Jrc3BhY2VQcm9qZWN0Q2xvbmVbJ3NjaGVtYXRpY3MnXTtcbiAgICBkZWxldGUgd29ya3NwYWNlUHJvamVjdENsb25lWydhcmNoaXRlY3QnXTtcbiAgICBkZWxldGUgd29ya3NwYWNlUHJvamVjdENsb25lWyd0YXJnZXRzJ107XG5cbiAgICByZXR1cm4gd29ya3NwYWNlUHJvamVjdENsb25lO1xuICB9XG5cbiAgZ2V0RGVmYXVsdFByb2plY3ROYW1lKCk6IHN0cmluZyB8IG51bGwge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgaWYgKHRoaXMuX3dvcmtzcGFjZS5kZWZhdWx0UHJvamVjdCkge1xuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBkZWZhdWx0IHByb2plY3QgbmFtZSwgcmV0dXJuIGl0LlxuICAgICAgcmV0dXJuIHRoaXMuX3dvcmtzcGFjZS5kZWZhdWx0UHJvamVjdDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubGlzdFByb2plY3ROYW1lcygpLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gSWYgdGhlcmUgaXMgb25seSBvbmUgcHJvamVjdCwgcmV0dXJuIHRoYXQgb25lLlxuICAgICAgcmV0dXJuIHRoaXMubGlzdFByb2plY3ROYW1lcygpWzBdO1xuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSByZXR1cm4gbnVsbC5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldFByb2plY3RCeVBhdGgocGF0aDogUGF0aCk6IHN0cmluZyB8IG51bGwge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgY29uc3QgcHJvamVjdE5hbWVzID0gdGhpcy5saXN0UHJvamVjdE5hbWVzKCk7XG4gICAgaWYgKHByb2plY3ROYW1lcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBwcm9qZWN0TmFtZXNbMF07XG4gICAgfVxuXG4gICAgY29uc3QgaXNJbnNpZGUgPSAoYmFzZTogUGF0aCwgcG90ZW50aWFsOiBQYXRoKTogYm9vbGVhbiA9PiB7XG4gICAgICBjb25zdCBhYnNvbHV0ZUJhc2UgPSByZXNvbHZlKHRoaXMucm9vdCwgYmFzZSk7XG4gICAgICBjb25zdCBhYnNvbHV0ZVBvdGVudGlhbCA9IHJlc29sdmUodGhpcy5yb290LCBwb3RlbnRpYWwpO1xuICAgICAgY29uc3QgcmVsYXRpdmVQb3RlbnRpYWwgPSByZWxhdGl2ZShhYnNvbHV0ZUJhc2UsIGFic29sdXRlUG90ZW50aWFsKTtcbiAgICAgIGlmICghcmVsYXRpdmVQb3RlbnRpYWwuc3RhcnRzV2l0aCgnLi4nKSAmJiAhaXNBYnNvbHV0ZShyZWxhdGl2ZVBvdGVudGlhbCkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgY29uc3QgcHJvamVjdHMgPSB0aGlzLmxpc3RQcm9qZWN0TmFtZXMoKVxuICAgICAgLm1hcChuYW1lID0+IFt0aGlzLmdldFByb2plY3QobmFtZSkucm9vdCwgbmFtZV0gYXMgW1BhdGgsIHN0cmluZ10pXG4gICAgICAuZmlsdGVyKHR1cGxlID0+IGlzSW5zaWRlKHR1cGxlWzBdLCBwYXRoKSlcbiAgICAgIC8vIFNvcnQgdHVwbGVzIGJ5IGRlcHRoLCB3aXRoIHRoZSBkZWVwZXIgb25lcyBmaXJzdC4gU2luY2UgdGhlIGZpcnN0IG1lbWJlciBpcyBhIHBhdGggYW5kXG4gICAgICAvLyB3ZSBmaWx0ZXJlZCBhbGwgaW52YWxpZCBwYXRocywgdGhlIGxvbmdlc3Qgd2lsbCBiZSB0aGUgZGVlcGVzdCAoYW5kIGluIGNhc2Ugb2YgZXF1YWxpdHlcbiAgICAgIC8vIHRoZSBzb3J0IGlzIHN0YWJsZSBhbmQgdGhlIGZpcnN0IGRlY2xhcmVkIHByb2plY3Qgd2lsbCB3aW4pLlxuICAgICAgLnNvcnQoKGEsIGIpID0+IGJbMF0ubGVuZ3RoIC0gYVswXS5sZW5ndGgpO1xuXG4gICAgaWYgKHByb2plY3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChwcm9qZWN0cy5sZW5ndGggPiAxKSB7XG4gICAgICBjb25zdCBmb3VuZCA9IG5ldyBTZXQ8UGF0aD4oKTtcbiAgICAgIGNvbnN0IHNhbWVSb290cyA9IHByb2plY3RzLmZpbHRlcih2ID0+IHtcbiAgICAgICAgaWYgKCFmb3VuZC5oYXModlswXSkpIHtcbiAgICAgICAgICBmb3VuZC5hZGQodlswXSk7XG5cbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHNhbWVSb290cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRocm93IG5ldyBBbWJpZ3VvdXNQcm9qZWN0UGF0aEV4Y2VwdGlvbihwYXRoLCBzYW1lUm9vdHMubWFwKHYgPT4gdlsxXSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBwcm9qZWN0c1swXVsxXTtcbiAgfVxuXG4gIGdldENsaSgpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0VG9vbCgnY2xpJyk7XG4gIH1cblxuICBnZXRTY2hlbWF0aWNzKCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRUb29sKCdzY2hlbWF0aWNzJyk7XG4gIH1cblxuICBnZXRUYXJnZXRzKCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRUb29sKCd0YXJnZXRzJyk7XG4gIH1cblxuICBnZXRQcm9qZWN0Q2xpKHByb2plY3ROYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0UHJvamVjdFRvb2wocHJvamVjdE5hbWUsICdjbGknKTtcbiAgfVxuXG4gIGdldFByb2plY3RTY2hlbWF0aWNzKHByb2plY3ROYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0UHJvamVjdFRvb2wocHJvamVjdE5hbWUsICdzY2hlbWF0aWNzJyk7XG4gIH1cblxuICBnZXRQcm9qZWN0VGFyZ2V0cyhwcm9qZWN0TmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldFByb2plY3RUb29sKHByb2plY3ROYW1lLCAndGFyZ2V0cycpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0VG9vbCh0b29sTmFtZTogJ2NsaScgfCAnc2NoZW1hdGljcycgfCAndGFyZ2V0cycpOiBXb3Jrc3BhY2VUb29sIHtcbiAgICB0aGlzLl9hc3NlcnRMb2FkZWQoKTtcblxuICAgIGxldCB3b3Jrc3BhY2VUb29sID0gdGhpcy5fd29ya3NwYWNlW3Rvb2xOYW1lXTtcblxuICAgIC8vIFRyeSBmYWxsaW5nIGJhY2sgdG8gJ2FyY2hpdGVjdCcgaWYgJ3RhcmdldHMnIGlzIG5vdCB0aGVyZSBvciBpcyBlbXB0eS5cbiAgICBpZiAoKCF3b3Jrc3BhY2VUb29sIHx8IE9iamVjdC5rZXlzKHdvcmtzcGFjZVRvb2wpLmxlbmd0aCA9PT0gMClcbiAgICAgICAgJiYgdG9vbE5hbWUgPT09ICd0YXJnZXRzJ1xuICAgICAgICAmJiB0aGlzLl93b3Jrc3BhY2VbJ2FyY2hpdGVjdCddKSB7XG4gICAgICB3b3Jrc3BhY2VUb29sID0gdGhpcy5fd29ya3NwYWNlWydhcmNoaXRlY3QnXTtcbiAgICB9XG5cbiAgICBpZiAoIXdvcmtzcGFjZVRvb2wpIHtcbiAgICAgIHRocm93IG5ldyBXb3Jrc3BhY2VUb29sTm90Rm91bmRFeGNlcHRpb24odG9vbE5hbWUpO1xuICAgIH1cblxuICAgIHJldHVybiB3b3Jrc3BhY2VUb29sO1xuICB9XG5cbiAgcHJpdmF0ZSBfZ2V0UHJvamVjdFRvb2woXG4gICAgcHJvamVjdE5hbWU6IHN0cmluZywgdG9vbE5hbWU6ICdjbGknIHwgJ3NjaGVtYXRpY3MnIHwgJ3RhcmdldHMnLFxuICApOiBXb3Jrc3BhY2VUb29sIHtcbiAgICB0aGlzLl9hc3NlcnRMb2FkZWQoKTtcblxuICAgIGNvbnN0IHdvcmtzcGFjZVByb2plY3QgPSB0aGlzLl93b3Jrc3BhY2UucHJvamVjdHNbcHJvamVjdE5hbWVdO1xuXG4gICAgaWYgKCF3b3Jrc3BhY2VQcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgUHJvamVjdE5vdEZvdW5kRXhjZXB0aW9uKHByb2plY3ROYW1lKTtcbiAgICB9XG5cbiAgICBsZXQgcHJvamVjdFRvb2wgPSB3b3Jrc3BhY2VQcm9qZWN0W3Rvb2xOYW1lXTtcblxuICAgIC8vIFRyeSBmYWxsaW5nIGJhY2sgdG8gJ2FyY2hpdGVjdCcgaWYgJ3RhcmdldHMnIGlzIG5vdCB0aGVyZSBvciBpcyBlbXB0eS5cbiAgICBpZiAoKCFwcm9qZWN0VG9vbCB8fCBPYmplY3Qua2V5cyhwcm9qZWN0VG9vbCkubGVuZ3RoID09PSAwKVxuICAgICAgICAmJiB3b3Jrc3BhY2VQcm9qZWN0WydhcmNoaXRlY3QnXVxuICAgICAgICAmJiB0b29sTmFtZSA9PT0gJ3RhcmdldHMnKSB7XG4gICAgICBwcm9qZWN0VG9vbCA9IHdvcmtzcGFjZVByb2plY3RbJ2FyY2hpdGVjdCddO1xuICAgIH1cblxuICAgIGlmICghcHJvamVjdFRvb2wpIHtcbiAgICAgIHRocm93IG5ldyBQcm9qZWN0VG9vbE5vdEZvdW5kRXhjZXB0aW9uKHRvb2xOYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvamVjdFRvb2w7XG4gIH1cblxuICAvLyBUT0RPOiBhZGQgdHJhbnNmb3JtcyB0byByZXNvbHZlIHBhdGhzLlxuICB2YWxpZGF0ZUFnYWluc3RTY2hlbWE8VCA9IHt9Pihjb250ZW50SnNvbjoge30sIHNjaGVtYUpzb246IEpzb25PYmplY3QpOiBPYnNlcnZhYmxlPFQ+IHtcbiAgICAvLyBKU09OIHZhbGlkYXRpb24gbW9kaWZpZXMgdGhlIGNvbnRlbnQsIHNvIHdlIHZhbGlkYXRlIGEgY29weSBvZiBpdCBpbnN0ZWFkLlxuICAgIGNvbnN0IGNvbnRlbnRKc29uQ29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoY29udGVudEpzb24pKTtcblxuICAgIHJldHVybiB0aGlzLl9yZWdpc3RyeS5jb21waWxlKHNjaGVtYUpzb24pLnBpcGUoXG4gICAgICBjb25jYXRNYXAodmFsaWRhdG9yID0+IHZhbGlkYXRvcihjb250ZW50SnNvbkNvcHkpKSxcbiAgICAgIGNvbmNhdE1hcCh2YWxpZGF0b3JSZXN1bHQgPT4ge1xuICAgICAgICBpZiAodmFsaWRhdG9yUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICByZXR1cm4gb2YoY29udGVudEpzb25Db3B5IGFzIFQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aHJvd0Vycm9yKG5ldyBzY2hlbWEuU2NoZW1hVmFsaWRhdGlvbkV4Y2VwdGlvbih2YWxpZGF0b3JSZXN1bHQuZXJyb3JzKSk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF9sb2FkSnNvbkZpbGUocGF0aDogUGF0aCk6IE9ic2VydmFibGU8SnNvbk9iamVjdD4ge1xuICAgIHJldHVybiB0aGlzLl9ob3N0LnJlYWQobm9ybWFsaXplKHBhdGgpKS5waXBlKFxuICAgICAgbWFwKGJ1ZmZlciA9PiB2aXJ0dWFsRnMuZmlsZUJ1ZmZlclRvU3RyaW5nKGJ1ZmZlcikpLFxuICAgICAgbWFwKHN0ciA9PiBwYXJzZUpzb24oc3RyLCBKc29uUGFyc2VNb2RlLkxvb3NlKSBhcyB7fSBhcyBKc29uT2JqZWN0KSxcbiAgICApO1xuICB9XG59XG4iXX0=