/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Observable } from 'rxjs';
import { JsonObject, Path, virtualFs } from '..';
import { BaseException } from '../exception/exception';
export declare class ProjectNotFoundException extends BaseException {
    constructor(name: string);
}
export declare class WorkspaceToolNotFoundException extends BaseException {
    constructor(name: string);
}
export declare class ProjectToolNotFoundException extends BaseException {
    constructor(name: string);
}
export declare class SchemaValidationException extends BaseException {
    constructor(errors: string[]);
}
export declare class WorkspaceNotYetLoadedException extends BaseException {
    constructor();
}
export interface WorkspaceJson {
    version: number;
    newProjectRoot: Path;
    cli: WorkspaceTool;
    schematics: WorkspaceTool;
    architect: WorkspaceTool;
    projects: {
        [k: string]: WorkspaceProject;
    };
}
export interface WorkspaceProject {
    projectType: 'application' | 'library';
    root: Path;
    cli: WorkspaceTool;
    schematics: WorkspaceTool;
    architect: WorkspaceTool;
}
export interface WorkspaceTool extends JsonObject {
}
export declare class Workspace {
    private _root;
    private _host;
    private readonly _workspaceSchemaPath;
    private _workspaceSchema;
    private _workspace;
    private _registry;
    constructor(_root: Path, _host: virtualFs.Host<{}>);
    loadWorkspaceFromJson(json: {}): Observable<this>;
    loadWorkspaceFromHost(workspacePath: Path): Observable<this>;
    private _loadWorkspaceSchema();
    private _assertLoaded();
    readonly root: Path;
    readonly host: virtualFs.Host<{}>;
    readonly version: number;
    readonly newProjectRoot: Path;
    listProjectNames(): string[];
    getProject(projectName: string): WorkspaceProject;
    getCli(): WorkspaceTool;
    getSchematics(): WorkspaceTool;
    getArchitect(): WorkspaceTool;
    getProjectCli(projectName: string): WorkspaceTool;
    getProjectSchematics(projectName: string): WorkspaceTool;
    getProjectArchitect(projectName: string): WorkspaceTool;
    private _getTool(toolName);
    private _getProjectTool(projectName, toolName);
    validateAgainstSchema<T = {}>(contentJson: {}, schemaJson: JsonObject): Observable<T>;
    private _loadJsonFile(path);
}
