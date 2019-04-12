import { WorkspaceDefinition } from './definitions';
import { WorkspaceHost } from './host';
export declare enum WorkspaceFormat {
    JSON = 0
}
export declare function _test_addWorkspaceFile(name: string, format: WorkspaceFormat): void;
export declare function _test_removeWorkspaceFile(name: string): void;
export declare function readWorkspace(path: string, host: WorkspaceHost, format?: WorkspaceFormat): Promise<{
    workspace: WorkspaceDefinition;
}>;
export declare function writeWorkspace(workspace: WorkspaceDefinition, host: WorkspaceHost, path?: string, format?: WorkspaceFormat): Promise<void>;
