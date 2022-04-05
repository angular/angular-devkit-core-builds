/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BaseException } from '../exception';
import { JsonAstNode, Position } from './parser_ast';
export declare class JsonException extends BaseException {
}
/**
 * A character was invalid in this context.
 * @deprecated
 * @private
 */
export declare class InvalidJsonCharacterException extends JsonException {
    invalidChar: string;
    line: number;
    character: number;
    offset: number;
    constructor(context: JsonParserContext);
}
/**
 * More input was expected, but we reached the end of the stream.
 * @deprecated
 * @private
 */
export declare class UnexpectedEndOfInputException extends JsonException {
    constructor(_context: JsonParserContext);
}
/**
 * Context passed around the parser with information about where we currently are in the parse.
 * @deprecated Deprecated since version 11. Use 3rd party JSON parsers such as `jsonc-parser` instead.
 */
export interface JsonParserContext {
    position: Position;
    previous: Position;
    readonly original: string;
    readonly mode: JsonParseMode;
}
/**
 * The Parse mode used for parsing the JSON string.
 */
export declare enum JsonParseMode {
    Strict = 0,
    CommentsAllowed = 1,
    SingleQuotesAllowed = 2,
    IdentifierKeyNamesAllowed = 4,
    TrailingCommasAllowed = 8,
    HexadecimalNumberAllowed = 16,
    MultiLineStringAllowed = 32,
    LaxNumberParsingAllowed = 64,
    NumberConstantsAllowed = 128,
    Default = 0,
    Loose = 255,
    Json = 0,
    Json5 = 255
}
/**
 * Parse the JSON string and return its AST. The AST may be losing data (end comments are
 * discarded for example, and space characters are not represented in the AST), but all values
 * will have a single node in the AST (a 1-to-1 mapping).
 *
 * @deprecated Deprecated since version 11. Use 3rd party JSON parsers such as `jsonc-parser` instead.
 * @param input The string to use.
 * @param mode The mode to parse the input with. {@see JsonParseMode}.
 * @returns {JsonAstNode} The root node of the value of the AST.
 */
export declare function parseJsonAst(input: string, mode?: JsonParseMode): JsonAstNode;
