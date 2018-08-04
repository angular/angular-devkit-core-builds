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
class Workspace {
    constructor(_root, _host) {
        this._root = _root;
        this._host = _host;
        this._workspaceSchemaPath = virtual_fs_1.join(virtual_fs_1.normalize(__dirname), 'workspace-schema.json');
        this._registry = new json_1.schema.CoreSchemaRegistry();
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
        if ((!workspaceTool || Object.keys(workspaceTool).length === 0) && toolName === 'targets') {
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
        if ((!projectTool || Object.keys(projectTool).length === 0) && toolName === 'targets') {
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
exports.Workspace = Workspace;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy93b3Jrc3BhY2Uvd29ya3NwYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7O0dBTUc7O0FBRUgsK0JBQWtEO0FBQ2xELDhDQUFxRDtBQUNyRCw0Q0FBNkM7QUFDN0Msa0NBS2lCO0FBQ2pCLDhDQVF1QjtBQUl2Qiw4QkFBc0MsU0FBUSx5QkFBYTtJQUN6RCxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLFlBQVksSUFBSSxvQ0FBb0MsQ0FBQyxDQUFDO0lBQzlELENBQUM7Q0FDRjtBQUpELDREQUlDO0FBRUQsb0NBQTRDLFNBQVEseUJBQWE7SUFDL0QsWUFBWSxJQUFZO1FBQ3RCLEtBQUssQ0FBQyxRQUFRLElBQUksbUNBQW1DLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0Y7QUFKRCx3RUFJQztBQUVELGtDQUEwQyxTQUFRLHlCQUFhO0lBQzdELFlBQVksSUFBWTtRQUN0QixLQUFLLENBQUMsUUFBUSxJQUFJLGlDQUFpQyxDQUFDLENBQUM7SUFDdkQsQ0FBQztDQUNGO0FBSkQsb0VBSUM7QUFFRCxvQ0FBNEMsU0FBUSx5QkFBYTtJQUMvRCxnQkFBZ0IsS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzVFO0FBRkQsd0VBRUM7QUFFRCxtQ0FBMkMsU0FBUSx5QkFBYTtJQUM5RCxZQUE0QixJQUFVLEVBQWtCLFFBQStCO1FBQ3JGLEtBQUssQ0FBQyx3Q0FBd0MsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksR0FBRyxDQUFDLENBQUM7UUFEakUsU0FBSSxHQUFKLElBQUksQ0FBTTtRQUFrQixhQUFRLEdBQVIsUUFBUSxDQUF1QjtJQUV2RixDQUFDO0NBQ0Y7QUFKRCxzRUFJQztBQUVEO0lBTUUsWUFBb0IsS0FBVyxFQUFVLEtBQXlCO1FBQTlDLFVBQUss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LENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FDNUMscUJBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUNsRCxxQkFBUyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1lBQzFCLElBQUksZUFBZSxDQUFDLE9BQU8sRUFBRTtnQkFDM0IsT0FBTyxTQUFFLENBQUMsZUFBb0IsQ0FBQyxDQUFDO2FBQ2pDO2lCQUFNO2dCQUNMLE9BQU8saUJBQVUsQ0FBQyxJQUFJLGFBQU0sQ0FBQyx5QkFBeUIsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzthQUNqRjtRQUNILENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRU8sYUFBYSxDQUFDLElBQVU7UUFDOUIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxzQkFBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUMxQyxlQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxzQkFBUyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQ25ELGVBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGdCQUFTLENBQUMsR0FBRyxFQUFFLG9CQUFhLENBQUMsS0FBSyxDQUFxQixDQUFDLENBQ3BFLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUE3T0QsOEJBNk9DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBvZiwgdGhyb3dFcnJvciB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBtYXAsIHRhcCB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi9leGNlcHRpb24nO1xuaW1wb3J0IHtcbiAgSnNvbk9iamVjdCxcbiAgSnNvblBhcnNlTW9kZSxcbiAgcGFyc2VKc29uLFxuICBzY2hlbWEsXG59IGZyb20gJy4uL2pzb24nO1xuaW1wb3J0IHtcbiAgUGF0aCxcbiAgaXNBYnNvbHV0ZSxcbiAgam9pbixcbiAgbm9ybWFsaXplLFxuICByZWxhdGl2ZSxcbiAgcmVzb2x2ZSxcbiAgdmlydHVhbEZzLFxufSBmcm9tICcuLi92aXJ0dWFsLWZzJztcbmltcG9ydCB7IFdvcmtzcGFjZVByb2plY3QsIFdvcmtzcGFjZVNjaGVtYSwgV29ya3NwYWNlVG9vbCB9IGZyb20gJy4vd29ya3NwYWNlLXNjaGVtYSc7XG5cblxuZXhwb3J0IGNsYXNzIFByb2plY3ROb3RGb3VuZEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgUHJvamVjdCAnJHtuYW1lfScgY291bGQgbm90IGJlIGZvdW5kIGluIHdvcmtzcGFjZS5gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlVG9vbE5vdEZvdW5kRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKGBUb29sICR7bmFtZX0gY291bGQgbm90IGJlIGZvdW5kIGluIHdvcmtzcGFjZS5gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUHJvamVjdFRvb2xOb3RGb3VuZEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcihgVG9vbCAke25hbWV9IGNvdWxkIG5vdCBiZSBmb3VuZCBpbiBwcm9qZWN0LmApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VOb3RZZXRMb2FkZWRFeGNlcHRpb24gZXh0ZW5kcyBCYXNlRXhjZXB0aW9uIHtcbiAgY29uc3RydWN0b3IoKSB7IHN1cGVyKGBXb3Jrc3BhY2UgbmVlZHMgdG8gYmUgbG9hZGVkIGJlZm9yZSBpdCBpcyB1c2VkLmApOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBBbWJpZ3VvdXNQcm9qZWN0UGF0aEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgcGF0aDogUGF0aCwgcHVibGljIHJlYWRvbmx5IHByb2plY3RzOiBSZWFkb25seUFycmF5PHN0cmluZz4pIHtcbiAgICBzdXBlcihgQ3VycmVudCBhY3RpdmUgcHJvamVjdCBpcyBhbWJpZ3VvdXMgKCR7cHJvamVjdHMuam9pbignLCcpfSkgdXNpbmcgcGF0aDogJyR7cGF0aH0nYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZSB7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZVNjaGVtYVBhdGggPSBqb2luKG5vcm1hbGl6ZShfX2Rpcm5hbWUpLCAnd29ya3NwYWNlLXNjaGVtYS5qc29uJyk7XG4gIHByaXZhdGUgX3dvcmtzcGFjZVNjaGVtYTogSnNvbk9iamVjdDtcbiAgcHJpdmF0ZSBfd29ya3NwYWNlOiBXb3Jrc3BhY2VTY2hlbWE7XG4gIHByaXZhdGUgX3JlZ2lzdHJ5OiBzY2hlbWEuQ29yZVNjaGVtYVJlZ2lzdHJ5O1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX3Jvb3Q6IFBhdGgsIHByaXZhdGUgX2hvc3Q6IHZpcnR1YWxGcy5Ib3N0PHt9Pikge1xuICAgIHRoaXMuX3JlZ2lzdHJ5ID0gbmV3IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnkoKTtcbiAgfVxuXG4gIGxvYWRXb3Jrc3BhY2VGcm9tSnNvbihqc29uOiB7fSkge1xuICAgIHJldHVybiB0aGlzLl9sb2FkV29ya3NwYWNlU2NoZW1hKCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgod29ya3NwYWNlU2NoZW1hKSA9PiB0aGlzLnZhbGlkYXRlQWdhaW5zdFNjaGVtYShqc29uLCB3b3Jrc3BhY2VTY2hlbWEpKSxcbiAgICAgIHRhcCgodmFsaWRhdGVkV29ya3NwYWNlOiBXb3Jrc3BhY2VTY2hlbWEpID0+IHRoaXMuX3dvcmtzcGFjZSA9IHZhbGlkYXRlZFdvcmtzcGFjZSksXG4gICAgICBtYXAoKCkgPT4gdGhpcyksXG4gICAgKTtcbiAgfVxuXG4gIGxvYWRXb3Jrc3BhY2VGcm9tSG9zdCh3b3Jrc3BhY2VQYXRoOiBQYXRoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xvYWRXb3Jrc3BhY2VTY2hlbWEoKS5waXBlKFxuICAgICAgY29uY2F0TWFwKCgpID0+IHRoaXMuX2xvYWRKc29uRmlsZShqb2luKHRoaXMuX3Jvb3QsIHdvcmtzcGFjZVBhdGgpKSksXG4gICAgICBjb25jYXRNYXAoanNvbiA9PiB0aGlzLmxvYWRXb3Jrc3BhY2VGcm9tSnNvbihqc29uKSksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgX2xvYWRXb3Jrc3BhY2VTY2hlbWEoKSB7XG4gICAgaWYgKHRoaXMuX3dvcmtzcGFjZVNjaGVtYSkge1xuICAgICAgcmV0dXJuIG9mKHRoaXMuX3dvcmtzcGFjZVNjaGVtYSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9sb2FkSnNvbkZpbGUodGhpcy5fd29ya3NwYWNlU2NoZW1hUGF0aCkucGlwZShcbiAgICAgICAgdGFwKCh3b3Jrc3BhY2VTY2hlbWEpID0+IHRoaXMuX3dvcmtzcGFjZVNjaGVtYSA9IHdvcmtzcGFjZVNjaGVtYSksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX2Fzc2VydExvYWRlZCgpIHtcbiAgICBpZiAoIXRoaXMuX3dvcmtzcGFjZSkge1xuICAgICAgdGhyb3cgbmV3IFdvcmtzcGFjZU5vdFlldExvYWRlZEV4Y2VwdGlvbigpO1xuICAgIH1cbiAgfVxuXG4gIGdldCByb290KCkge1xuICAgIHJldHVybiB0aGlzLl9yb290O1xuICB9XG5cbiAgZ2V0IGhvc3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hvc3Q7XG4gIH1cblxuICBnZXQgdmVyc2lvbigpIHtcbiAgICB0aGlzLl9hc3NlcnRMb2FkZWQoKTtcblxuICAgIHJldHVybiB0aGlzLl93b3Jrc3BhY2UudmVyc2lvbjtcbiAgfVxuXG4gIGdldCBuZXdQcm9qZWN0Um9vdCgpIHtcbiAgICB0aGlzLl9hc3NlcnRMb2FkZWQoKTtcblxuICAgIHJldHVybiB0aGlzLl93b3Jrc3BhY2UubmV3UHJvamVjdFJvb3Q7XG4gIH1cblxuICBsaXN0UHJvamVjdE5hbWVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fd29ya3NwYWNlLnByb2plY3RzKTtcbiAgfVxuXG4gIGdldFByb2plY3QocHJvamVjdE5hbWU6IHN0cmluZyk6IFdvcmtzcGFjZVByb2plY3Qge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgY29uc3Qgd29ya3NwYWNlUHJvamVjdCA9IHRoaXMuX3dvcmtzcGFjZS5wcm9qZWN0c1twcm9qZWN0TmFtZV07XG5cbiAgICBpZiAoIXdvcmtzcGFjZVByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBQcm9qZWN0Tm90Rm91bmRFeGNlcHRpb24ocHJvamVjdE5hbWUpO1xuICAgIH1cblxuICAgIC8vIFJldHVybiBvbmx5IHRoZSBwcm9qZWN0IHByb3BlcnRpZXMsIGFuZCByZW1vdmUgdGhlIHRvb2xzLlxuICAgIGNvbnN0IHdvcmtzcGFjZVByb2plY3RDbG9uZSA9IHsuLi53b3Jrc3BhY2VQcm9qZWN0fTtcbiAgICBkZWxldGUgd29ya3NwYWNlUHJvamVjdENsb25lWydjbGknXTtcbiAgICBkZWxldGUgd29ya3NwYWNlUHJvamVjdENsb25lWydzY2hlbWF0aWNzJ107XG4gICAgZGVsZXRlIHdvcmtzcGFjZVByb2plY3RDbG9uZVsnYXJjaGl0ZWN0J107XG4gICAgZGVsZXRlIHdvcmtzcGFjZVByb2plY3RDbG9uZVsndGFyZ2V0cyddO1xuXG4gICAgcmV0dXJuIHdvcmtzcGFjZVByb2plY3RDbG9uZTtcbiAgfVxuXG4gIGdldERlZmF1bHRQcm9qZWN0TmFtZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICB0aGlzLl9hc3NlcnRMb2FkZWQoKTtcblxuICAgIGlmICh0aGlzLl93b3Jrc3BhY2UuZGVmYXVsdFByb2plY3QpIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgZGVmYXVsdCBwcm9qZWN0IG5hbWUsIHJldHVybiBpdC5cbiAgICAgIHJldHVybiB0aGlzLl93b3Jrc3BhY2UuZGVmYXVsdFByb2plY3Q7XG4gICAgfSBlbHNlIGlmICh0aGlzLmxpc3RQcm9qZWN0TmFtZXMoKS5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIElmIHRoZXJlIGlzIG9ubHkgb25lIHByb2plY3QsIHJldHVybiB0aGF0IG9uZS5cbiAgICAgIHJldHVybiB0aGlzLmxpc3RQcm9qZWN0TmFtZXMoKVswXTtcbiAgICB9XG5cbiAgICAvLyBPdGhlcndpc2UgcmV0dXJuIG51bGwuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXRQcm9qZWN0QnlQYXRoKHBhdGg6IFBhdGgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICB0aGlzLl9hc3NlcnRMb2FkZWQoKTtcblxuICAgIGNvbnN0IHByb2plY3ROYW1lcyA9IHRoaXMubGlzdFByb2plY3ROYW1lcygpO1xuICAgIGlmIChwcm9qZWN0TmFtZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICByZXR1cm4gcHJvamVjdE5hbWVzWzBdO1xuICAgIH1cblxuICAgIGNvbnN0IGlzSW5zaWRlID0gKGJhc2U6IFBhdGgsIHBvdGVudGlhbDogUGF0aCk6IGJvb2xlYW4gPT4ge1xuICAgICAgY29uc3QgYWJzb2x1dGVCYXNlID0gcmVzb2x2ZSh0aGlzLnJvb3QsIGJhc2UpO1xuICAgICAgY29uc3QgYWJzb2x1dGVQb3RlbnRpYWwgPSByZXNvbHZlKHRoaXMucm9vdCwgcG90ZW50aWFsKTtcbiAgICAgIGNvbnN0IHJlbGF0aXZlUG90ZW50aWFsID0gcmVsYXRpdmUoYWJzb2x1dGVCYXNlLCBhYnNvbHV0ZVBvdGVudGlhbCk7XG4gICAgICBpZiAoIXJlbGF0aXZlUG90ZW50aWFsLnN0YXJ0c1dpdGgoJy4uJykgJiYgIWlzQWJzb2x1dGUocmVsYXRpdmVQb3RlbnRpYWwpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcblxuICAgIGNvbnN0IHByb2plY3RzID0gdGhpcy5saXN0UHJvamVjdE5hbWVzKClcbiAgICAgIC5tYXAobmFtZSA9PiBbdGhpcy5nZXRQcm9qZWN0KG5hbWUpLnJvb3QsIG5hbWVdIGFzIFtQYXRoLCBzdHJpbmddKVxuICAgICAgLmZpbHRlcih0dXBsZSA9PiBpc0luc2lkZSh0dXBsZVswXSwgcGF0aCkpXG4gICAgICAvLyBTb3J0IHR1cGxlcyBieSBkZXB0aCwgd2l0aCB0aGUgZGVlcGVyIG9uZXMgZmlyc3QuIFNpbmNlIHRoZSBmaXJzdCBtZW1iZXIgaXMgYSBwYXRoIGFuZFxuICAgICAgLy8gd2UgZmlsdGVyZWQgYWxsIGludmFsaWQgcGF0aHMsIHRoZSBsb25nZXN0IHdpbGwgYmUgdGhlIGRlZXBlc3QgKGFuZCBpbiBjYXNlIG9mIGVxdWFsaXR5XG4gICAgICAvLyB0aGUgc29ydCBpcyBzdGFibGUgYW5kIHRoZSBmaXJzdCBkZWNsYXJlZCBwcm9qZWN0IHdpbGwgd2luKS5cbiAgICAgIC5zb3J0KChhLCBiKSA9PiBiWzBdLmxlbmd0aCAtIGFbMF0ubGVuZ3RoKTtcblxuICAgIGlmIChwcm9qZWN0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAocHJvamVjdHMubGVuZ3RoID4gMSkge1xuICAgICAgY29uc3QgZm91bmQgPSBuZXcgU2V0PFBhdGg+KCk7XG4gICAgICBjb25zdCBzYW1lUm9vdHMgPSBwcm9qZWN0cy5maWx0ZXIodiA9PiB7XG4gICAgICAgIGlmICghZm91bmQuaGFzKHZbMF0pKSB7XG4gICAgICAgICAgZm91bmQuYWRkKHZbMF0pO1xuXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgICAgIGlmIChzYW1lUm9vdHMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aHJvdyBuZXcgQW1iaWd1b3VzUHJvamVjdFBhdGhFeGNlcHRpb24ocGF0aCwgc2FtZVJvb3RzLm1hcCh2ID0+IHZbMV0pKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcHJvamVjdHNbMF1bMV07XG4gIH1cblxuICBnZXRDbGkoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldFRvb2woJ2NsaScpO1xuICB9XG5cbiAgZ2V0U2NoZW1hdGljcygpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0VG9vbCgnc2NoZW1hdGljcycpO1xuICB9XG5cbiAgZ2V0VGFyZ2V0cygpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0VG9vbCgndGFyZ2V0cycpO1xuICB9XG5cbiAgZ2V0UHJvamVjdENsaShwcm9qZWN0TmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldFByb2plY3RUb29sKHByb2plY3ROYW1lLCAnY2xpJyk7XG4gIH1cblxuICBnZXRQcm9qZWN0U2NoZW1hdGljcyhwcm9qZWN0TmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldFByb2plY3RUb29sKHByb2plY3ROYW1lLCAnc2NoZW1hdGljcycpO1xuICB9XG5cbiAgZ2V0UHJvamVjdFRhcmdldHMocHJvamVjdE5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLl9nZXRQcm9qZWN0VG9vbChwcm9qZWN0TmFtZSwgJ3RhcmdldHMnKTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldFRvb2wodG9vbE5hbWU6ICdjbGknIHwgJ3NjaGVtYXRpY3MnIHwgJ3RhcmdldHMnKTogV29ya3NwYWNlVG9vbCB7XG4gICAgdGhpcy5fYXNzZXJ0TG9hZGVkKCk7XG5cbiAgICBsZXQgd29ya3NwYWNlVG9vbCA9IHRoaXMuX3dvcmtzcGFjZVt0b29sTmFtZV07XG5cbiAgICAvLyBUcnkgZmFsbGluZyBiYWNrIHRvICdhcmNoaXRlY3QnIGlmICd0YXJnZXRzJyBpcyBub3QgdGhlcmUgb3IgaXMgZW1wdHkuXG4gICAgaWYgKCghd29ya3NwYWNlVG9vbCB8fCBPYmplY3Qua2V5cyh3b3Jrc3BhY2VUb29sKS5sZW5ndGggPT09IDApICYmIHRvb2xOYW1lID09PSAndGFyZ2V0cycpIHtcbiAgICAgIHdvcmtzcGFjZVRvb2wgPSB0aGlzLl93b3Jrc3BhY2VbJ2FyY2hpdGVjdCddO1xuICAgIH1cblxuICAgIGlmICghd29ya3NwYWNlVG9vbCkge1xuICAgICAgdGhyb3cgbmV3IFdvcmtzcGFjZVRvb2xOb3RGb3VuZEV4Y2VwdGlvbih0b29sTmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdvcmtzcGFjZVRvb2w7XG4gIH1cblxuICBwcml2YXRlIF9nZXRQcm9qZWN0VG9vbChcbiAgICBwcm9qZWN0TmFtZTogc3RyaW5nLCB0b29sTmFtZTogJ2NsaScgfCAnc2NoZW1hdGljcycgfCAndGFyZ2V0cycsXG4gICk6IFdvcmtzcGFjZVRvb2wge1xuICAgIHRoaXMuX2Fzc2VydExvYWRlZCgpO1xuXG4gICAgY29uc3Qgd29ya3NwYWNlUHJvamVjdCA9IHRoaXMuX3dvcmtzcGFjZS5wcm9qZWN0c1twcm9qZWN0TmFtZV07XG5cbiAgICBpZiAoIXdvcmtzcGFjZVByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBQcm9qZWN0Tm90Rm91bmRFeGNlcHRpb24ocHJvamVjdE5hbWUpO1xuICAgIH1cblxuICAgIGxldCBwcm9qZWN0VG9vbCA9IHdvcmtzcGFjZVByb2plY3RbdG9vbE5hbWVdO1xuXG4gICAgLy8gVHJ5IGZhbGxpbmcgYmFjayB0byAnYXJjaGl0ZWN0JyBpZiAndGFyZ2V0cycgaXMgbm90IHRoZXJlIG9yIGlzIGVtcHR5LlxuICAgIGlmICgoIXByb2plY3RUb29sIHx8IE9iamVjdC5rZXlzKHByb2plY3RUb29sKS5sZW5ndGggPT09IDApICYmIHRvb2xOYW1lID09PSAndGFyZ2V0cycpIHtcbiAgICAgIHByb2plY3RUb29sID0gd29ya3NwYWNlUHJvamVjdFsnYXJjaGl0ZWN0J107XG4gICAgfVxuXG5cbiAgICBpZiAoIXByb2plY3RUb29sKSB7XG4gICAgICB0aHJvdyBuZXcgUHJvamVjdFRvb2xOb3RGb3VuZEV4Y2VwdGlvbih0b29sTmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb2plY3RUb29sO1xuICB9XG5cbiAgLy8gVE9ETzogYWRkIHRyYW5zZm9ybXMgdG8gcmVzb2x2ZSBwYXRocy5cbiAgdmFsaWRhdGVBZ2FpbnN0U2NoZW1hPFQgPSB7fT4oY29udGVudEpzb246IHt9LCBzY2hlbWFKc29uOiBKc29uT2JqZWN0KTogT2JzZXJ2YWJsZTxUPiB7XG4gICAgLy8gSlNPTiB2YWxpZGF0aW9uIG1vZGlmaWVzIHRoZSBjb250ZW50LCBzbyB3ZSB2YWxpZGF0ZSBhIGNvcHkgb2YgaXQgaW5zdGVhZC5cbiAgICBjb25zdCBjb250ZW50SnNvbkNvcHkgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGNvbnRlbnRKc29uKSk7XG5cbiAgICByZXR1cm4gdGhpcy5fcmVnaXN0cnkuY29tcGlsZShzY2hlbWFKc29uKS5waXBlKFxuICAgICAgY29uY2F0TWFwKHZhbGlkYXRvciA9PiB2YWxpZGF0b3IoY29udGVudEpzb25Db3B5KSksXG4gICAgICBjb25jYXRNYXAodmFsaWRhdG9yUmVzdWx0ID0+IHtcbiAgICAgICAgaWYgKHZhbGlkYXRvclJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgcmV0dXJuIG9mKGNvbnRlbnRKc29uQ29weSBhcyBUKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihuZXcgc2NoZW1hLlNjaGVtYVZhbGlkYXRpb25FeGNlcHRpb24odmFsaWRhdG9yUmVzdWx0LmVycm9ycykpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfbG9hZEpzb25GaWxlKHBhdGg6IFBhdGgpOiBPYnNlcnZhYmxlPEpzb25PYmplY3Q+IHtcbiAgICByZXR1cm4gdGhpcy5faG9zdC5yZWFkKG5vcm1hbGl6ZShwYXRoKSkucGlwZShcbiAgICAgIG1hcChidWZmZXIgPT4gdmlydHVhbEZzLmZpbGVCdWZmZXJUb1N0cmluZyhidWZmZXIpKSxcbiAgICAgIG1hcChzdHIgPT4gcGFyc2VKc29uKHN0ciwgSnNvblBhcnNlTW9kZS5Mb29zZSkgYXMge30gYXMgSnNvbk9iamVjdCksXG4gICAgKTtcbiAgfVxufVxuIl19