/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { JsonValue } from '../json';
export interface WorkspaceDefinition {
    readonly extensions: Record<string, JsonValue | undefined>;
    readonly projects: ProjectDefinitionCollection;
}
export interface ProjectDefinition {
    readonly extensions: Record<string, JsonValue | undefined>;
    readonly targets: TargetDefinitionCollection;
    root: string;
    prefix?: string;
    sourceRoot?: string;
}
export interface TargetDefinition {
    options?: Record<string, JsonValue | undefined>;
    configurations?: Record<string, Record<string, JsonValue | undefined> | undefined>;
    defaultConfiguration?: string;
    builder: string;
}
export type DefinitionCollectionListener<V extends object> = (name: string, newValue: V | undefined, collection: DefinitionCollection<V>) => void;
declare class DefinitionCollection<V extends object> implements ReadonlyMap<string, V> {
    private _listener?;
    private _map;
    constructor(initial?: Record<string, V>, _listener?: DefinitionCollectionListener<V> | undefined);
    delete(key: string): boolean;
    set(key: string, value: V): this;
    forEach<T>(callbackfn: (value: V, key: string, map: DefinitionCollection<V>) => void, thisArg?: T): void;
    get(key: string): V | undefined;
    has(key: string): boolean;
    get size(): number;
    [Symbol.iterator](): MapIterator<[string, V]>;
    entries(): MapIterator<[string, V]>;
    keys(): MapIterator<string>;
    values(): MapIterator<V>;
}
export declare class ProjectDefinitionCollection extends DefinitionCollection<ProjectDefinition> {
    constructor(initial?: Record<string, ProjectDefinition>, listener?: DefinitionCollectionListener<ProjectDefinition>);
    add(definition: {
        name: string;
        root: string;
        sourceRoot?: string;
        prefix?: string;
        targets?: Record<string, TargetDefinition | undefined>;
        [key: string]: unknown;
    }): ProjectDefinition;
    set(name: string, value: ProjectDefinition): this;
    private _validateName;
}
export declare class TargetDefinitionCollection extends DefinitionCollection<TargetDefinition> {
    constructor(initial?: Record<string, TargetDefinition>, listener?: DefinitionCollectionListener<TargetDefinition>);
    add(definition: {
        name: string;
    } & TargetDefinition): TargetDefinition;
    set(name: string, value: TargetDefinition): this;
    private _validateName;
}
export {};
