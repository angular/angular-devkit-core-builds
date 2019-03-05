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
const exception_1 = require("../exception");
const json_1 = require("../json");
const virtual_fs_1 = require("../virtual-fs");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy93b3Jrc3BhY2Uvd29ya3NwYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBSUgsK0JBQWtEO0FBQ2xELDhDQUE0RDtBQUM1RCw0Q0FBNkM7QUFDN0Msa0NBS2lCO0FBQ2pCLDhDQVF1QjtBQUl2QixNQUFhLDhCQUErQixTQUFRLHlCQUFhO0lBQy9ELFlBQVksSUFBVTtRQUNwQixLQUFLLENBQUMsMENBQTBDLElBQUksR0FBRyxDQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNGO0FBSkQsd0VBSUM7QUFFRCxNQUFhLHdCQUF5QixTQUFRLHlCQUFhO0lBQ3pELFlBQVksSUFBWTtRQUN0QixLQUFLLENBQUMsWUFBWSxJQUFJLG9DQUFvQyxDQUFDLENBQUM7SUFDOUQsQ0FBQztDQUNGO0FBSkQsNERBSUM7QUFFRCxNQUFhLDhCQUErQixTQUFRLHlCQUFhO0lBQy9ELFlBQVksSUFBWTtRQUN0QixLQUFLLENBQUMsUUFBUSxJQUFJLG1DQUFtQyxDQUFDLENBQUM7SUFDekQsQ0FBQztDQUNGO0FBSkQsd0VBSUM7QUFFRCxNQUFhLDRCQUE2QixTQUFRLHlCQUFhO0lBQzdELFlBQVksSUFBWTtRQUN0QixLQUFLLENBQUMsUUFBUSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7SUFDdkQsQ0FBQztDQUNGO0FBSkQsb0VBSUM7QUFFRCxNQUFhLDhCQUErQixTQUFRLHlCQUFhO0lBQy9ELGdCQUFnQixLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDNUU7QUFGRCx3RUFFQztBQUVELE1BQWEsNkJBQThCLFNBQVEseUJBQWE7SUFDOUQsWUFBNEIsSUFBVSxFQUFrQixRQUErQjtRQUNyRixLQUFLLENBQUMsd0NBQXdDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJ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TUFBTSxDQUFDLEVBQUUsQ0FBQyxzQkFBUyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQ25ELGVBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGdCQUFTLENBQUMsR0FBRyxFQUFFLG9CQUFhLENBQUMsS0FBSyxDQUFxQixDQUFDLENBQ3BFLENBQUM7SUFDSixDQUFDOztBQWxSZ0IsNkJBQW1CLEdBQUc7SUFDckMsY0FBYztJQUNkLGVBQWU7SUFDZixnQkFBZ0I7SUFDaEIsaUJBQWlCO0NBQ2xCLENBQUM7QUFOSiw4QkFvUkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgb2YsIHRocm93RXJyb3IgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgZmlyc3QsIG1hcCwgdGFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQmFzZUV4Y2VwdGlvbiB9IGZyb20gJy4uL2V4Y2VwdGlvbic7XG5pbXBvcnQge1xuICBKc29uT2JqZWN0LFxuICBKc29uUGFyc2VNb2RlLFxuICBwYXJzZUpzb24sXG4gIHNjaGVtYSxcbn0gZnJvbSAnLi4vanNvbic7XG5pbXBvcnQge1xuICBQYXRoLFxuICBiYXNlbmFtZSxcbiAgZGlybmFtZSxcbiAgaXNBYnNvbHV0ZSxcbiAgam9pbixcbiAgbm9ybWFsaXplLFxuICByZWxhdGl2ZSwgcmVzb2x2ZSwgdmlydHVhbEZzLFxufSBmcm9tICcuLi92aXJ0dWFsLWZzJztcbmltcG9ydCB7IFdvcmtzcGFjZVByb2plY3QsIFdvcmtzcGFjZVNjaGVtYSwgV29ya3NwYWNlVG9vbCB9IGZyb20gJy4vd29ya3NwYWNlLXNjaGVtYSc7XG5cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZUZpbGVOb3RGb3VuZEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihwYXRoOiBQYXRoKSB7XG4gICAgc3VwZXIoYFdvcmtzcGFjZSBjb3VsZCBub3QgYmUgZm91bmQgZnJvbSBwYXRoICR7cGF0aH0uYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFByb2plY3ROb3RGb3VuZEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgUHJvamVjdCAnJHtuYW1lfScgY291bGQgbm90IGJlIGZvdW5kIGluIHdvcmtzcGFjZS5gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlVG9vbE5vdEZvdW5kRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKGBUb29sICR7bmFtZX0gY291bGQgbm90IGJlIGZvdW5kIGluIHdvcmtzcGFjZS5gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvamVjdFRvb2xOb3RGb3VuZEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgVG9vbCAke25hbWV9IGNvdWxkIG5vdCBiZSBmb3VuZCBpbiBwcm9qZWN0LmApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VOb3RZZXRMb2FkZWRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoKSB7IHN1cGVyKGBXb3Jrc3BhY2UgbmVlZHMgdG8gYmUgbG9hZGVkIGJlZm9yZSBpdCBpcyB1c2VkLmApOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBBbWJpZ3VvdXNQcm9qZWN0UGF0aEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgcGF0aDogUGF0aCwgcHVibGljIHJlYWRvbmx5IHByb2plY3RzOiBSZWFkb25seUFycmF5PHN0cmluZz4pIHtcbiAgICBzdXBlcihgQ3VycmVudCBhY3RpdmUgcHJvamVjdCBpcyBhbWJpZ3VvdXMgKCR7cHJvamVjdHMuam9pbignLCcpfSkgdXNpbmcgcGF0aDogJyR7cGF0aH0nYCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gX2ZpbmRVcChob3N0OiB2aXJ0dWFsRnMuSG9zdCwgbmFtZXM6IHN0cmluZ1tdLCBmcm9tOiBQYXRoKTogUHJvbWlzZTxQYXRoIHwgbnVsbD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkobmFtZXMpKSB7XG4gICAgbmFtZXMgPSBbbmFtZXNdO1xuICB9XG5cbiAgZG8ge1xuICAgIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykge1xuICAgICAgY29uc3QgcCA9IGpvaW4oZnJvbSwgbmFtZSk7XG4gICAgICBpZiAoYXdhaXQgaG9zdC5leGlzdHMocCkpIHtcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnJvbSA9IGRpcm5hbWUoZnJvbSk7XG4gIH0gd2hpbGUgKGZyb20gJiYgZnJvbSAhPT0gZGlybmFtZShmcm9tKSk7XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2Uge1xuICBwcm90ZWN0ZWQgc3RhdGljIF93b3Jrc3BhY2VGaWxlTmFtZXMgPSBbXG4gICAgJ2FuZ3VsYXIuanNvbicsXG4gICAgJy5hbmd1bGFyLmpzb24nLFxuICAgICd3b3Jrc3BhY2UuanNvbicsXG4gICAgJy53b3Jrc3BhY2UuanNvbicsXG4gIF07XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlU2NoZW1hUGF0aCA9IG5vcm1hbGl6ZShyZXF1aXJlLnJlc29sdmUoJy4vd29ya3NwYWNlLXNjaGVtYS5qc29uJykpO1xuICBwcml2YXRlIF93b3Jrc3BhY2VTY2hlbWE6IEpzb25PYmplY3Q7XG4gIHByaXZhdGUgX3dvcmtzcGFjZTogV29ya3NwYWNlU2NoZW1hO1xuICBwcml2YXRlIF9yZWdpc3RyeTogc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIF9yb290OiBQYXRoLFxuICAgIHByaXZhdGUgX2hvc3Q6IHZpcnR1YWxGcy5Ib3N0PHt9PixcbiAgICByZWdpc3RyeT86IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnksXG4gICkge1xuICAgIGlmIChyZWdpc3RyeSkge1xuICAgICAgdGhpcy5fcmVnaXN0cnkgPSByZWdpc3RyeTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVnaXN0cnkgPSBuZXcgc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeSgpO1xuICAgICAgdGhpcy5fcmVnaXN0cnkuYWRkUG9zdFRyYW5zZm9ybShzY2hlbWEudHJhbnNmb3Jtcy5hZGRVbmRlZmluZWREZWZhdWx0cyk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGFzeW5jIGZpbmRXb3Jrc3BhY2VGaWxlKGhvc3Q6IHZpcnR1YWxGcy5Ib3N0PHt9PiwgcGF0aDogUGF0aCk6IFByb21pc2U8UGF0aCB8IG51bGw+IHtcbiAgICByZXR1cm4gYXdhaXQgX2ZpbmRVcChob3N0LCB0aGlzLl93b3Jrc3BhY2VGaWxlTmFtZXMsIHBhdGgpO1xuICB9XG4gIHN0YXRpYyBhc3luYyBmcm9tUGF0aChcbiAgICBob3N0OiB2aXJ0dWFsRnMuSG9zdDx7fT4sXG4gICAgcGF0aDogUGF0aCxcbiAgICByZWdpc3RyeTogc2NoZW1hLkNvcmVTY2hlbWFSZWdpc3RyeSxcbiAgKTogUHJvbWlzZTxXb3Jrc3BhY2U+IHtcbiAgICBjb25zdCBtYXliZVBhdGggPSBhd2FpdCB0aGlzLmZpbmRXb3Jrc3BhY2VGaWxlKGhvc3QsIHBhdGgpO1xuXG4gICAgaWYgKCFtYXliZVBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBXb3Jrc3BhY2VGaWxlTm90Rm91bmRFeGNlcHRpb24ocGF0aCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBXb3Jrc3BhY2UoZGlybmFtZShtYXliZVBhdGgpLCBob3N0LCByZWdpc3RyeSlcbiAgICAgIC5sb2FkV29ya3NwYWNlRnJvbUhvc3QoYmFzZW5hbWUobWF5YmVQYXRoKSlcbiAgICAgIC5waXBlKGZpcnN0KCkpXG4gICAgICAudG9Qcm9taXNlKCk7XG4gIH1cblxuICBsb2FkV29ya3NwYWNlRnJvbUpzb24oanNvbjoge30pIHtcbiAgICByZXR1cm4gdGhpcy5fbG9hZFdvcmtzcGFjZVNjaGVtYSgpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKHdvcmtzcGFjZVNjaGVtYSkgPT4gdGhpcy52YWxpZGF0ZUFnYWluc3RTY2hlbWEoanNvbiwgd29ya3NwYWNlU2NoZW1hKSksXG4gICAgICB0YXAoKHZhbGlkYXRlZFdvcmtzcGFjZTogV29ya3NwYWNlU2NoZW1hKSA9PiB0aGlzLl93b3Jrc3BhY2UgPSB2YWxpZGF0ZWRXb3Jrc3BhY2UpLFxuICAgICAgbWFwKCgpID0+IHRoaXMpLFxuICAgICk7XG4gIH1cblxuICBsb2FkV29ya3NwYWNlRnJvbUhvc3Qod29ya3NwYWNlUGF0aDogUGF0aCkge1xuICAgIHJldHVybiB0aGlzLl9sb2FkV29ya3NwYWNlU2NoZW1hKCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiB0aGlzLl9sb2FkSnNvbkZpbGUoam9pbih0aGlzLl9yb290LCB3b3Jrc3BhY2VQYXRoKSkpLFxuICAgICAgY29uY2F0TWFwKGpzb24gPT4gdGhpcy5sb2FkV29ya3NwYWNlRnJvbUpzb24oanNvbikpLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF9sb2FkV29ya3NwYWNlU2NoZW1hKCkge1xuICAgIGlmICh0aGlzLl93b3Jrc3BhY2VTY2hlbWEpIHtcbiAgICAgIHJldHVybiBvZih0aGlzLl93b3Jrc3BhY2VTY2hlbWEpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fbG9hZEpzb25GaWxlKHRoaXMuX3dvcmtzcGFjZVNjaGVtYVBhdGgpLnBpcGUoXG4gICAgICAgIHRhcCgod29ya3NwYWNlU2NoZW1hKSA9PiB0aGlzLl93b3Jrc3BhY2VTY2hlbWEgPSB3b3Jrc3BhY2VTY2hlbWEpLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9hc3NlcnRMb2FkZWQoKSB7XG4gICAgaWYgKCF0aGlzLl93b3Jrc3BhY2UpIHtcbiAgICAgIHRocm93IG5ldyBXb3Jrc3BhY2VOb3RZZXRMb2FkZWRFeGNlcHRpb24oKTtcbiAgICB9XG4gIH1cblxuICBnZXQgcm9vdCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcm9vdDtcbiAgfVxuXG4gIGdldCBob3N0KCkge1xuICAgIHJldHVybiB0aGlzLl9ob3N0O1xuICB9XG5cbiAgZ2V0IHZlcnNpb24oKSB7XG4gICAgdGhpcy5fYXNzZXJ0TG9hZGVkKCk7XG5cbiAgICByZXR1cm4gdGhpcy5fd29ya3NwYWNlLnZlcnNpb247XG4gIH1cblxuICBnZXQgbmV3UHJvamVjdFJvb3QoKSB7XG4gICAgdGhpcy5fYXNzZXJ0TG9hZGVkKCk7XG5cbiAgICByZXR1cm4gdGhpcy5fd29ya3NwYWNlLm5ld1Byb2plY3RSb290O1xuICB9XG5cbiAgbGlzdFByb2plY3ROYW1lcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3dvcmtzcGFjZS5wcm9qZWN0cyk7XG4gIH1cblxuICBnZXRQcm9qZWN0KHByb2plY3ROYW1lOiBzdHJpbmcpOiBXb3Jrc3BhY2VQcm9qZWN0IHtcbiAgICB0aGlzLl9hc3NlcnRMb2FkZWQoKTtcblxuICAgIGNvbnN0IHdvcmtzcGFjZVByb2plY3QgPSB0aGlzLl93b3Jrc3BhY2UucHJvamVjdHNbcHJvamVjdE5hbWVdO1xuXG4gICAgaWYgKCF3b3Jrc3BhY2VQcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgUHJvamVjdE5vdEZvdW5kRXhjZXB0aW9uKHByb2plY3ROYW1lKTtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gb25seSB0aGUgcHJvamVjdCBwcm9wZXJ0aWVzLCBhbmQgcmVtb3ZlIHRoZSB0b29scy5cbiAgICBjb25zdCB3b3Jrc3BhY2VQcm9qZWN0Q2xvbmUgPSB7Li4ud29ya3NwYWNlUHJvamVjdH07XG4gICAgZGVsZXRlIHdvcmtzcGFjZVByb2plY3RDbG9uZVsnY2xpJ107XG4gICAgZGVsZXRlIHdvcmtzcGFjZVByb2plY3RDbG9uZVsnc2NoZW1hdGljcyddO1xuICAgIGRlbGV0ZSB3b3Jrc3BhY2VQcm9qZWN0Q2xvbmVbJ2FyY2hpdGVjdCddO1xuICAgIGRlbGV0ZSB3b3Jrc3BhY2VQcm9qZWN0Q2xvbmVbJ3RhcmdldHMnXTtcblxuICAgIHJldHVybiB3b3Jrc3BhY2VQcm9qZWN0Q2xvbmU7XG4gIH1cblxuICBnZXREZWZhdWx0UHJvamVjdE5hbWUoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgdGhpcy5fYXNzZXJ0TG9hZGVkKCk7XG5cbiAgICBpZiAodGhpcy5fd29ya3NwYWNlLmRlZmF1bHRQcm9qZWN0KSB7XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIGRlZmF1bHQgcHJvamVjdCBuYW1lLCByZXR1cm4gaXQuXG4gICAgICByZXR1cm4gdGhpcy5fd29ya3NwYWNlLmRlZmF1bHRQcm9qZWN0O1xuICAgIH0gZWxzZSBpZiAodGhpcy5saXN0UHJvamVjdE5hbWVzKCkubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBJZiB0aGVyZSBpcyBvbmx5IG9uZSBwcm9qZWN0LCByZXR1cm4gdGhhdCBvbmUuXG4gICAgICByZXR1cm4gdGhpcy5saXN0UHJvamVjdE5hbWVzKClbMF07XG4gICAgfVxuXG4gICAgLy8gT3RoZXJ3aXNlIHJldHVybiBudWxsLlxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0UHJvamVjdEJ5UGF0aChwYXRoOiBQYXRoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgdGhpcy5fYXNzZXJ0TG9hZGVkKCk7XG5cbiAgICBjb25zdCBwcm9qZWN0TmFtZXMgPSB0aGlzLmxpc3RQcm9qZWN0TmFtZXMoKTtcbiAgICBpZiAocHJvamVjdE5hbWVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIHByb2plY3ROYW1lc1swXTtcbiAgICB9XG5cbiAgICBjb25zdCBpc0luc2lkZSA9IChiYXNlOiBQYXRoLCBwb3RlbnRpYWw6IFBhdGgpOiBib29sZWFuID0+IHtcbiAgICAgIGNvbnN0IGFic29sdXRlQmFzZSA9IHJlc29sdmUodGhpcy5yb290LCBiYXNlKTtcbiAgICAgIGNvbnN0IGFic29sdXRlUG90ZW50aWFsID0gcmVzb2x2ZSh0aGlzLnJvb3QsIHBvdGVudGlhbCk7XG4gICAgICBjb25zdCByZWxhdGl2ZVBvdGVudGlhbCA9IHJlbGF0aXZlKGFic29sdXRlQmFzZSwgYWJzb2x1dGVQb3RlbnRpYWwpO1xuICAgICAgaWYgKCFyZWxhdGl2ZVBvdGVudGlhbC5zdGFydHNXaXRoKCcuLicpICYmICFpc0Fic29sdXRlKHJlbGF0aXZlUG90ZW50aWFsKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBjb25zdCBwcm9qZWN0cyA9IHRoaXMubGlzdFByb2plY3ROYW1lcygpXG4gICAgICAubWFwKG5hbWUgPT4gW3RoaXMuZ2V0UHJvamVjdChuYW1lKS5yb290LCBuYW1lXSBhcyBbUGF0aCwgc3RyaW5nXSlcbiAgICAgIC5maWx0ZXIodHVwbGUgPT4gaXNJbnNpZGUodHVwbGVbMF0sIHBhdGgpKVxuICAgICAgLy8gU29ydCB0dXBsZXMgYnkgZGVwdGgsIHdpdGggdGhlIGRlZXBlciBvbmVzIGZpcnN0LiBTaW5jZSB0aGUgZmlyc3QgbWVtYmVyIGlzIGEgcGF0aCBhbmRcbiAgICAgIC8vIHdlIGZpbHRlcmVkIGFsbCBpbnZhbGlkIHBhdGhzLCB0aGUgbG9uZ2VzdCB3aWxsIGJlIHRoZSBkZWVwZXN0IChhbmQgaW4gY2FzZSBvZiBlcXVhbGl0eVxuICAgICAgLy8gdGhlIHNvcnQgaXMgc3RhYmxlIGFuZCB0aGUgZmlyc3QgZGVjbGFyZWQgcHJvamVjdCB3aWxsIHdpbikuXG4gICAgICAuc29ydCgoYSwgYikgPT4gYlswXS5sZW5ndGggLSBhWzBdLmxlbmd0aCk7XG5cbiAgICBpZiAocHJvamVjdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHByb2plY3RzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGNvbnN0IGZvdW5kID0gbmV3IFNldDxQYXRoPigpO1xuICAgICAgY29uc3Qgc2FtZVJvb3RzID0gcHJvamVjdHMuZmlsdGVyKHYgPT4ge1xuICAgICAgICBpZiAoIWZvdW5kLmhhcyh2WzBdKSkge1xuICAgICAgICAgIGZvdW5kLmFkZCh2WzBdKTtcblxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgICBpZiAoc2FtZVJvb3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEFtYmlndW91c1Byb2plY3RQYXRoRXhjZXB0aW9uKHBhdGgsIHNhbWVSb290cy5tYXAodiA9PiB2WzFdKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb2plY3RzWzBdWzFdO1xuICB9XG5cbiAgZ2V0Q2xpKCkge1xuICAgIHJldHVybiB0aGlzLl9nZXRUb29sKCdjbGknKTtcbiAgfVxuXG4gIGdldFNjaGVtYXRpY3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldFRvb2woJ3NjaGVtYXRpY3MnKTtcbiAgfVxuXG4gIGdldFRhcmdldHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldFRvb2woJ3RhcmdldHMnKTtcbiAgfVxuXG4gIGdldFByb2plY3RDbGkocHJvamVjdE5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLl9nZXRQcm9qZWN0VG9vbChwcm9qZWN0TmFtZSwgJ2NsaScpO1xuICB9XG5cbiAgZ2V0UHJvamVjdFNjaGVtYXRpY3MocHJvamVjdE5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLl9nZXRQcm9qZWN0VG9vbChwcm9qZWN0TmFtZSwgJ3NjaGVtYXRpY3MnKTtcbiAgfVxuXG4gIGdldFByb2plY3RUYXJnZXRzKHByb2plY3ROYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0UHJvamVjdFRvb2wocHJvamVjdE5hbWUsICd0YXJnZXRzJyk7XG4gIH1cblxuICBwcml2YXRlIF9nZXRUb29sKHRvb2xOYW1lOiAnY2xpJyB8ICdzY2hlbWF0aWNzJyB8ICd0YXJnZXRzJyk6IFdvcmtzcGFjZVRvb2wge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgbGV0IHdvcmtzcGFjZVRvb2wgPSB0aGlzLl93b3Jrc3BhY2VbdG9vbE5hbWVdO1xuXG4gICAgLy8gVHJ5IGZhbGxpbmcgYmFjayB0byAnYXJjaGl0ZWN0JyBpZiAndGFyZ2V0cycgaXMgbm90IHRoZXJlIG9yIGlzIGVtcHR5LlxuICAgIGlmICgoIXdvcmtzcGFjZVRvb2wgfHwgT2JqZWN0LmtleXMod29ya3NwYWNlVG9vbCkubGVuZ3RoID09PSAwKVxuICAgICAgICAmJiB0b29sTmFtZSA9PT0gJ3RhcmdldHMnXG4gICAgICAgICYmIHRoaXMuX3dvcmtzcGFjZVsnYXJjaGl0ZWN0J10pIHtcbiAgICAgIHdvcmtzcGFjZVRvb2wgPSB0aGlzLl93b3Jrc3BhY2VbJ2FyY2hpdGVjdCddO1xuICAgIH1cblxuICAgIGlmICghd29ya3NwYWNlVG9vbCkge1xuICAgICAgdGhyb3cgbmV3IFdvcmtzcGFjZVRvb2xOb3RGb3VuZEV4Y2VwdGlvbih0b29sTmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdvcmtzcGFjZVRvb2w7XG4gIH1cblxuICBwcml2YXRlIF9nZXRQcm9qZWN0VG9vbChcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLCB0b29sTmFtZTogJ2NsaScgfCAnc2NoZW1hdGljcycgfCAndGFyZ2V0cycsXG4gICk6IFdvcmtzcGFjZVRvb2wge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgY29uc3Qgd29ya3NwYWNlUHJvamVjdCA9IHRoaXMuX3dvcmtzcGFjZS5wcm9qZWN0c1twcm9qZWN0TmFtZV07XG5cbiAgICBpZiAoIXdvcmtzcGFjZVByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBQcm9qZWN0Tm90Rm91bmRFeGNlcHRpb24ocHJvamVjdE5hbWUpO1xuICAgIH1cblxuICAgIGxldCBwcm9qZWN0VG9vbCA9IHdvcmtzcGFjZVByb2plY3RbdG9vbE5hbWVdO1xuXG4gICAgLy8gVHJ5IGZhbGxpbmcgYmFjayB0byAnYXJjaGl0ZWN0JyBpZiAndGFyZ2V0cycgaXMgbm90IHRoZXJlIG9yIGlzIGVtcHR5LlxuICAgIGlmICgoIXByb2plY3RUb29sIHx8IE9iamVjdC5rZXlzKHByb2plY3RUb29sKS5sZW5ndGggPT09IDApXG4gICAgICAgICYmIHdvcmtzcGFjZVByb2plY3RbJ2FyY2hpdGVjdCddXG4gICAgICAgICYmIHRvb2xOYW1lID09PSAndGFyZ2V0cycpIHtcbiAgICAgIHByb2plY3RUb29sID0gd29ya3NwYWNlUHJvamVjdFsnYXJjaGl0ZWN0J107XG4gICAgfVxuXG4gICAgaWYgKCFwcm9qZWN0VG9vbCkge1xuICAgICAgdGhyb3cgbmV3IFByb2plY3RUb29sTm90Rm91bmRFeGNlcHRpb24odG9vbE5hbWUpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9qZWN0VG9vbDtcbiAgfVxuXG4gIC8vIFRPRE86IGFkZCB0cmFuc2Zvcm1zIHRvIHJlc29sdmUgcGF0aHMuXG4gIHZhbGlkYXRlQWdhaW5zdFNjaGVtYTxUID0ge30+KGNvbnRlbnRKc29uOiB7fSwgc2NoZW1hSnNvbjogSnNvbk9iamVjdCk6IE9ic2VydmFibGU8VD4ge1xuICAgIC8vIEpTT04gdmFsaWRhdGlvbiBtb2RpZmllcyB0aGUgY29udGVudCwgc28gd2UgdmFsaWRhdGUgYSBjb3B5IG9mIGl0IGluc3RlYWQuXG4gICAgY29uc3QgY29udGVudEpzb25Db3B5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShjb250ZW50SnNvbikpO1xuXG4gICAgcmV0dXJuIHRoaXMuX3JlZ2lzdHJ5LmNvbXBpbGUoc2NoZW1hSnNvbikucGlwZShcbiAgICAgIGNvbmNhdE1hcCh2YWxpZGF0b3IgPT4gdmFsaWRhdG9yKGNvbnRlbnRKc29uQ29weSkpLFxuICAgICAgY29uY2F0TWFwKHZhbGlkYXRvclJlc3VsdCA9PiB7XG4gICAgICAgIGlmICh2YWxpZGF0b3JSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgIHJldHVybiBvZihjb250ZW50SnNvbkNvcHkgYXMgVCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRocm93RXJyb3IobmV3IHNjaGVtYS5TY2hlbWFWYWxpZGF0aW9uRXhjZXB0aW9uKHZhbGlkYXRvclJlc3VsdC5lcnJvcnMpKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgX2xvYWRKc29uRmlsZShwYXRoOiBQYXRoKTogT2JzZXJ2YWJsZTxKc29uT2JqZWN0PiB7XG4gICAgcmV0dXJuIHRoaXMuX2hvc3QucmVhZChub3JtYWxpemUocGF0aCkpLnBpcGUoXG4gICAgICBtYXAoYnVmZmVyID0+IHZpcnR1YWxGcy5maWxlQnVmZmVyVG9TdHJpbmcoYnVmZmVyKSksXG4gICAgICBtYXAoc3RyID0+IHBhcnNlSnNvbihzdHIsIEpzb25QYXJzZU1vZGUuTG9vc2UpIGFzIHt9IGFzIEpzb25PYmplY3QpLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==