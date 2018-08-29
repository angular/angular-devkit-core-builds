/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Observable, SubscribableOrPromise } from 'rxjs';
import { JsonArray, JsonObject, JsonValue } from '../interface';
export declare type JsonPointer = string & {
    __PRIVATE_DEVKIT_JSON_POINTER: void;
};
export declare type SchemaValidatorError = RefValidatorError | LimitValidatorError | AdditionalPropertiesValidatorError | FormatValidatorError | RequiredValidatorError;
export interface SchemaValidatorErrorBase {
    keyword: string;
    dataPath: string;
    message?: string;
    data?: JsonValue;
}
export interface RefValidatorError extends SchemaValidatorErrorBase {
    keyword: '$ref';
    params: {
        ref: string;
    };
}
export interface LimitValidatorError extends SchemaValidatorErrorBase {
    keyword: 'maxItems' | 'minItems' | 'maxLength' | 'minLength' | 'maxProperties' | 'minProperties';
    params: {
        limit: number;
    };
}
export interface AdditionalPropertiesValidatorError extends SchemaValidatorErrorBase {
    keyword: 'additionalProperties';
    params: {
        additionalProperty: string;
    };
}
export interface FormatValidatorError extends SchemaValidatorErrorBase {
    keyword: 'format';
    params: {
        format: string;
    };
}
export interface RequiredValidatorError extends SchemaValidatorErrorBase {
    keyword: 'required';
    params: {
        missingProperty: string;
    };
}
export interface SchemaValidatorResult {
    data: JsonValue;
    success: boolean;
    errors?: SchemaValidatorError[];
}
export interface SchemaValidatorOptions {
    withPrompts: boolean;
}
export interface SchemaValidator {
    (data: any, options?: Partial<SchemaValidatorOptions>): Observable<SchemaValidatorResult>;
}
export interface SchemaFormatter {
    readonly async: boolean;
    validate(data: any): boolean | Observable<boolean>;
}
export interface SchemaFormat {
    name: string;
    formatter: SchemaFormatter;
}
export interface SmartDefaultProvider<T> {
    (schema: JsonObject): T | Observable<T>;
}
export interface SchemaKeywordValidator {
    (data: JsonValue, schema: JsonValue, parent: JsonObject | JsonArray | undefined, parentProperty: string | number | undefined, pointer: JsonPointer, rootData: JsonValue): boolean | Observable<boolean>;
}
export interface PromptDefinition {
    id: string;
    type: string;
    message: string;
    default?: string | number | boolean | null;
    priority: number;
    validator?: (value: string) => boolean | string | Promise<boolean | string>;
    items?: Array<string | {
        value: JsonValue;
        label: string;
    }>;
    raw?: string | JsonObject;
}
export declare type PromptProvider = (definitions: Array<PromptDefinition>) => SubscribableOrPromise<{
    [id: string]: JsonValue;
}>;
export interface SchemaRegistry {
    compile(schema: Object): Observable<SchemaValidator>;
    addFormat(format: SchemaFormat): void;
    addSmartDefaultProvider<T>(source: string, provider: SmartDefaultProvider<T>): void;
    usePromptProvider(provider: PromptProvider): void;
}
