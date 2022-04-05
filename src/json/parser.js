"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonAst = exports.JsonParseMode = exports.UnexpectedEndOfInputException = exports.InvalidJsonCharacterException = exports.JsonException = void 0;
/* eslint-disable no-constant-condition */
const exception_1 = require("../exception");
class JsonException extends exception_1.BaseException {
}
exports.JsonException = JsonException;
/**
 * A character was invalid in this context.
 * @deprecated
 * @private
 */
class InvalidJsonCharacterException extends JsonException {
    constructor(context) {
        const pos = context.previous;
        const invalidChar = JSON.stringify(_peek(context));
        super(`Invalid JSON character: ${invalidChar} at ${pos.line}:${pos.character}.`);
        this.invalidChar = invalidChar;
        this.line = pos.line;
        this.offset = pos.offset;
        this.character = pos.character;
    }
}
exports.InvalidJsonCharacterException = InvalidJsonCharacterException;
/**
 * More input was expected, but we reached the end of the stream.
 * @deprecated
 * @private
 */
class UnexpectedEndOfInputException extends JsonException {
    constructor(_context) {
        super(`Unexpected end of file.`);
    }
}
exports.UnexpectedEndOfInputException = UnexpectedEndOfInputException;
/**
 * Peek and return the next character from the context.
 * @private
 */
function _peek(context) {
    return context.original[context.position.offset];
}
/**
 * Move the context to the next character, including incrementing the line if necessary.
 * @private
 */
function _next(context) {
    context.previous = context.position;
    let { offset, line, character } = context.position;
    const char = context.original[offset];
    offset++;
    if (char == '\n') {
        line++;
        character = 0;
    }
    else {
        character++;
    }
    context.position = { offset, line, character };
}
function _token(context, valid) {
    const char = _peek(context);
    if (valid) {
        if (!char) {
            throw new UnexpectedEndOfInputException(context);
        }
        if (valid.indexOf(char) == -1) {
            throw new InvalidJsonCharacterException(context);
        }
    }
    // Move the position of the context to the next character.
    _next(context);
    return char;
}
/**
 * Read the exponent part of a number. The exponent part is looser for JSON than the number
 * part. `str` is the string of the number itself found so far, and start the position
 * where the full number started. Returns the node found.
 * @private
 */
function _readExpNumber(context, start, str, comments) {
    let char;
    let signed = false;
    while (true) {
        char = _token(context);
        if (char == '+' || char == '-') {
            if (signed) {
                break;
            }
            signed = true;
            str += char;
        }
        else if (char == '0' ||
            char == '1' ||
            char == '2' ||
            char == '3' ||
            char == '4' ||
            char == '5' ||
            char == '6' ||
            char == '7' ||
            char == '8' ||
            char == '9') {
            signed = true;
            str += char;
        }
        else {
            break;
        }
    }
    // We're done reading this number.
    context.position = context.previous;
    return {
        kind: 'number',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value: Number.parseFloat(str),
        comments: comments,
    };
}
/**
 * Read the hexa part of a 0xBADCAFE hexadecimal number.
 * @private
 */
function _readHexaNumber(context, isNegative, start, comments) {
    // Read an hexadecimal number, until it's not hexadecimal.
    let hexa = '';
    const valid = '0123456789abcdefABCDEF';
    for (let ch = _peek(context); ch && valid.includes(ch); ch = _peek(context)) {
        // Add it to the hexa string.
        hexa += ch;
        // Move the position of the context to the next character.
        _next(context);
    }
    const value = Number.parseInt(hexa, 16);
    // We're done reading this number.
    return {
        kind: 'number',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value: isNegative ? -value : value,
        comments,
    };
}
/**
 * Read a number from the context.
 * @private
 */
function _readNumber(context, comments = _readBlanks(context)) {
    let str = '';
    let dotted = false;
    const start = context.position;
    // read until `e` or end of line.
    while (true) {
        const char = _token(context);
        // Read tokens, one by one.
        if (char == '-') {
            if (str != '') {
                throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char == 'I' &&
            (str == '-' || str == '' || str == '+') &&
            (context.mode & JsonParseMode.NumberConstantsAllowed) != 0) {
            // Infinity?
            // _token(context, 'I'); Already read.
            _token(context, 'n');
            _token(context, 'f');
            _token(context, 'i');
            _token(context, 'n');
            _token(context, 'i');
            _token(context, 't');
            _token(context, 'y');
            str += 'Infinity';
            break;
        }
        else if (char == '0') {
            if (str == '0' || str == '-0') {
                throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char == '1' ||
            char == '2' ||
            char == '3' ||
            char == '4' ||
            char == '5' ||
            char == '6' ||
            char == '7' ||
            char == '8' ||
            char == '9') {
            if (str == '0' || str == '-0') {
                throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char == '+' && str == '') {
            // Pass over.
        }
        else if (char == '.') {
            if (dotted) {
                throw new InvalidJsonCharacterException(context);
            }
            dotted = true;
        }
        else if (char == 'e' || char == 'E') {
            return _readExpNumber(context, start, str + char, comments);
        }
        else if (char == 'x' &&
            (str == '0' || str == '-0') &&
            (context.mode & JsonParseMode.HexadecimalNumberAllowed) != 0) {
            return _readHexaNumber(context, str == '-0', start, comments);
        }
        else {
            // We read one too many characters, so rollback the last character.
            context.position = context.previous;
            break;
        }
        str += char;
    }
    // We're done reading this number.
    if (str.endsWith('.') && (context.mode & JsonParseMode.HexadecimalNumberAllowed) == 0) {
        throw new InvalidJsonCharacterException(context);
    }
    return {
        kind: 'number',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value: Number.parseFloat(str),
        comments,
    };
}
/**
 * Read a string from the context. Takes the comments of the string or read the blanks before the
 * string.
 * @private
 */
function _readString(context, comments = _readBlanks(context)) {
    const start = context.position;
    // Consume the first string delimiter.
    const delim = _token(context);
    if ((context.mode & JsonParseMode.SingleQuotesAllowed) == 0) {
        if (delim == "'") {
            throw new InvalidJsonCharacterException(context);
        }
    }
    let str = '';
    while (true) {
        let char = _token(context);
        if (char == delim) {
            return {
                kind: 'string',
                start,
                end: context.position,
                text: context.original.substring(start.offset, context.position.offset),
                value: str,
                comments: comments,
            };
        }
        else if (char == '\\') {
            char = _token(context);
            switch (char) {
                case '\\':
                case '/':
                case '"':
                case delim:
                    str += char;
                    break;
                case 'b':
                    str += '\b';
                    break;
                case 'f':
                    str += '\f';
                    break;
                case 'n':
                    str += '\n';
                    break;
                case 'r':
                    str += '\r';
                    break;
                case 't':
                    str += '\t';
                    break;
                case 'u':
                    const [c0] = _token(context, '0123456789abcdefABCDEF');
                    const [c1] = _token(context, '0123456789abcdefABCDEF');
                    const [c2] = _token(context, '0123456789abcdefABCDEF');
                    const [c3] = _token(context, '0123456789abcdefABCDEF');
                    str += String.fromCharCode(parseInt(c0 + c1 + c2 + c3, 16));
                    break;
                case undefined:
                    throw new UnexpectedEndOfInputException(context);
                case '\n':
                    // Only valid when multiline strings are allowed.
                    if ((context.mode & JsonParseMode.MultiLineStringAllowed) == 0) {
                        throw new InvalidJsonCharacterException(context);
                    }
                    str += char;
                    break;
                default:
                    throw new InvalidJsonCharacterException(context);
            }
        }
        else if (char === undefined) {
            throw new UnexpectedEndOfInputException(context);
        }
        else if (char == '\b' || char == '\f' || char == '\n' || char == '\r' || char == '\t') {
            throw new InvalidJsonCharacterException(context);
        }
        else {
            str += char;
        }
    }
}
/**
 * Read the constant `true` from the context.
 * @private
 */
function _readTrue(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 't');
    _token(context, 'r');
    _token(context, 'u');
    _token(context, 'e');
    const end = context.position;
    return {
        kind: 'true',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: true,
        comments,
    };
}
/**
 * Read the constant `false` from the context.
 * @private
 */
function _readFalse(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 'f');
    _token(context, 'a');
    _token(context, 'l');
    _token(context, 's');
    _token(context, 'e');
    const end = context.position;
    return {
        kind: 'false',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: false,
        comments,
    };
}
/**
 * Read the constant `null` from the context.
 * @private
 */
function _readNull(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 'n');
    _token(context, 'u');
    _token(context, 'l');
    _token(context, 'l');
    const end = context.position;
    return {
        kind: 'null',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: null,
        comments: comments,
    };
}
/**
 * Read the constant `NaN` from the context.
 * @private
 */
function _readNaN(context, comments = _readBlanks(context)) {
    const start = context.position;
    _token(context, 'N');
    _token(context, 'a');
    _token(context, 'N');
    const end = context.position;
    return {
        kind: 'number',
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        value: NaN,
        comments: comments,
    };
}
/**
 * Read an array of JSON values from the context.
 * @private
 */
function _readArray(context, comments = _readBlanks(context)) {
    const start = context.position;
    // Consume the first delimiter.
    _token(context, '[');
    const value = [];
    const elements = [];
    _readBlanks(context);
    if (_peek(context) != ']') {
        const node = _readValue(context);
        elements.push(node);
        value.push(node.value);
    }
    while (_peek(context) != ']') {
        _token(context, ',');
        const valueComments = _readBlanks(context);
        if ((context.mode & JsonParseMode.TrailingCommasAllowed) !== 0 && _peek(context) === ']') {
            break;
        }
        const node = _readValue(context, valueComments);
        elements.push(node);
        value.push(node.value);
    }
    _token(context, ']');
    return {
        kind: 'array',
        start,
        end: context.position,
        text: context.original.substring(start.offset, context.position.offset),
        value,
        elements,
        comments,
    };
}
/**
 * Read an identifier from the context. An identifier is a valid JavaScript identifier, and this
 * function is only used in Loose mode.
 * @private
 */
function _readIdentifier(context, comments = _readBlanks(context)) {
    const start = context.position;
    let char = _peek(context);
    if (char && '0123456789'.indexOf(char) != -1) {
        const identifierNode = _readNumber(context);
        return {
            kind: 'identifier',
            start,
            end: identifierNode.end,
            text: identifierNode.text,
            value: identifierNode.value.toString(),
        };
    }
    const identValidFirstChar = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ';
    const identValidChar = '_$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789';
    let first = true;
    let value = '';
    while (true) {
        char = _token(context);
        if (char == undefined ||
            (first ? identValidFirstChar.indexOf(char) : identValidChar.indexOf(char)) == -1) {
            context.position = context.previous;
            return {
                kind: 'identifier',
                start,
                end: context.position,
                text: context.original.slice(start.offset, start.offset + context.position.offset),
                value,
                comments,
            };
        }
        value += char;
        first = false;
    }
}
/**
 * Read a property from the context. A property is a string or (in Loose mode only) a number or
 * an identifier, followed by a colon `:`.
 * @private
 */
function _readProperty(context, comments = _readBlanks(context)) {
    const start = context.position;
    let key;
    if ((context.mode & JsonParseMode.IdentifierKeyNamesAllowed) != 0) {
        const top = _peek(context);
        if (top == '"' || top == "'") {
            key = _readString(context);
        }
        else {
            key = _readIdentifier(context);
        }
    }
    else {
        key = _readString(context);
    }
    _readBlanks(context);
    _token(context, ':');
    const value = _readValue(context);
    const end = context.position;
    return {
        kind: 'keyvalue',
        key,
        value,
        start,
        end,
        text: context.original.substring(start.offset, end.offset),
        comments,
    };
}
/**
 * Read an object of properties -> JSON values from the context.
 * @private
 */
function _readObject(context, comments = _readBlanks(context)) {
    const start = context.position;
    // Consume the first delimiter.
    _token(context, '{');
    const value = {};
    const properties = [];
    _readBlanks(context);
    if (_peek(context) != '}') {
        const property = _readProperty(context);
        value[property.key.value] = property.value.value;
        properties.push(property);
        while (_peek(context) != '}') {
            _token(context, ',');
            const propertyComments = _readBlanks(context);
            if ((context.mode & JsonParseMode.TrailingCommasAllowed) !== 0 && _peek(context) === '}') {
                break;
            }
            const property = _readProperty(context, propertyComments);
            value[property.key.value] = property.value.value;
            properties.push(property);
        }
    }
    _token(context, '}');
    return {
        kind: 'object',
        properties,
        start,
        end: context.position,
        value,
        text: context.original.substring(start.offset, context.position.offset),
        comments,
    };
}
/**
 * Remove any blank character or comments (in Loose mode) from the context, returning an array
 * of comments if any are found.
 * @private
 */
function _readBlanks(context) {
    if ((context.mode & JsonParseMode.CommentsAllowed) != 0) {
        const comments = [];
        while (true) {
            const char = context.original[context.position.offset];
            if (char == '/' && context.original[context.position.offset + 1] == '*') {
                const start = context.position;
                // Multi line comment.
                _next(context);
                _next(context);
                while (context.original[context.position.offset] != '*' ||
                    context.original[context.position.offset + 1] != '/') {
                    _next(context);
                    if (context.position.offset >= context.original.length) {
                        throw new UnexpectedEndOfInputException(context);
                    }
                }
                // Remove "*/".
                _next(context);
                _next(context);
                comments.push({
                    kind: 'multicomment',
                    start,
                    end: context.position,
                    text: context.original.substring(start.offset, context.position.offset),
                    content: context.original.substring(start.offset + 2, context.position.offset - 2),
                });
            }
            else if (char == '/' && context.original[context.position.offset + 1] == '/') {
                const start = context.position;
                // Multi line comment.
                _next(context);
                _next(context);
                while (context.original[context.position.offset] != '\n') {
                    _next(context);
                    if (context.position.offset >= context.original.length) {
                        break;
                    }
                }
                // Remove "\n".
                if (context.position.offset < context.original.length) {
                    _next(context);
                }
                comments.push({
                    kind: 'comment',
                    start,
                    end: context.position,
                    text: context.original.substring(start.offset, context.position.offset),
                    content: context.original.substring(start.offset + 2, context.position.offset - 1),
                });
            }
            else if (char == ' ' || char == '\t' || char == '\n' || char == '\r' || char == '\f') {
                _next(context);
            }
            else {
                break;
            }
        }
        return comments;
    }
    else {
        let char = context.original[context.position.offset];
        while (char == ' ' || char == '\t' || char == '\n' || char == '\r' || char == '\f') {
            _next(context);
            char = context.original[context.position.offset];
        }
        return [];
    }
}
/**
 * Read a JSON value from the context, which can be any form of JSON value.
 * @private
 */
function _readValue(context, comments = _readBlanks(context)) {
    let result;
    // Clean up before.
    const char = _peek(context);
    switch (char) {
        case undefined:
            throw new UnexpectedEndOfInputException(context);
        case '-':
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            result = _readNumber(context, comments);
            break;
        case '.':
        case '+':
            if ((context.mode & JsonParseMode.LaxNumberParsingAllowed) == 0) {
                throw new InvalidJsonCharacterException(context);
            }
            result = _readNumber(context, comments);
            break;
        case "'":
        case '"':
            result = _readString(context, comments);
            break;
        case 'I':
            if ((context.mode & JsonParseMode.NumberConstantsAllowed) == 0) {
                throw new InvalidJsonCharacterException(context);
            }
            result = _readNumber(context, comments);
            break;
        case 'N':
            if ((context.mode & JsonParseMode.NumberConstantsAllowed) == 0) {
                throw new InvalidJsonCharacterException(context);
            }
            result = _readNaN(context, comments);
            break;
        case 't':
            result = _readTrue(context, comments);
            break;
        case 'f':
            result = _readFalse(context, comments);
            break;
        case 'n':
            result = _readNull(context, comments);
            break;
        case '[':
            result = _readArray(context, comments);
            break;
        case '{':
            result = _readObject(context, comments);
            break;
        default:
            throw new InvalidJsonCharacterException(context);
    }
    // Clean up after.
    _readBlanks(context);
    return result;
}
/**
 * The Parse mode used for parsing the JSON string.
 */
var JsonParseMode;
(function (JsonParseMode) {
    JsonParseMode[JsonParseMode["Strict"] = 0] = "Strict";
    JsonParseMode[JsonParseMode["CommentsAllowed"] = 1] = "CommentsAllowed";
    JsonParseMode[JsonParseMode["SingleQuotesAllowed"] = 2] = "SingleQuotesAllowed";
    JsonParseMode[JsonParseMode["IdentifierKeyNamesAllowed"] = 4] = "IdentifierKeyNamesAllowed";
    JsonParseMode[JsonParseMode["TrailingCommasAllowed"] = 8] = "TrailingCommasAllowed";
    JsonParseMode[JsonParseMode["HexadecimalNumberAllowed"] = 16] = "HexadecimalNumberAllowed";
    JsonParseMode[JsonParseMode["MultiLineStringAllowed"] = 32] = "MultiLineStringAllowed";
    JsonParseMode[JsonParseMode["LaxNumberParsingAllowed"] = 64] = "LaxNumberParsingAllowed";
    JsonParseMode[JsonParseMode["NumberConstantsAllowed"] = 128] = "NumberConstantsAllowed";
    JsonParseMode[JsonParseMode["Default"] = 0] = "Default";
    JsonParseMode[JsonParseMode["Loose"] = 255] = "Loose";
    JsonParseMode[JsonParseMode["Json"] = 0] = "Json";
    JsonParseMode[JsonParseMode["Json5"] = 255] = "Json5";
})(JsonParseMode = exports.JsonParseMode || (exports.JsonParseMode = {}));
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
function parseJsonAst(input, mode = JsonParseMode.Default) {
    if (mode == JsonParseMode.Default) {
        mode = JsonParseMode.Strict;
    }
    const context = {
        position: { offset: 0, line: 0, character: 0 },
        previous: { offset: 0, line: 0, character: 0 },
        original: input,
        comments: undefined,
        mode,
    };
    const ast = _readValue(context);
    if (context.position.offset < input.length) {
        const rest = input.slice(context.position.offset);
        const i = rest.length > 20 ? rest.slice(0, 20) + '...' : rest;
        throw new Error(`Expected end of file, got "${i}" at ` +
            `${context.position.line}:${context.position.character}.`);
    }
    return ast;
}
exports.parseJsonAst = parseJsonAst;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYW5ndWxhcl9kZXZraXQvY29yZS9zcmMvanNvbi9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBRUgsMENBQTBDO0FBQzFDLDRDQUE2QztBQWtCN0MsTUFBYSxhQUFjLFNBQVEseUJBQWE7Q0FBRztBQUFuRCxzQ0FBbUQ7QUFFbkQ7Ozs7R0FJRztBQUNILE1BQWEsNkJBQThCLFNBQVEsYUFBYTtJQU05RCxZQUFZLE9BQTBCO1FBQ3BDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7UUFDN0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNuRCxLQUFLLENBQUMsMkJBQTJCLFdBQVcsT0FBTyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBRWpGLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNyQixJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7UUFDekIsSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBQ2pDLENBQUM7Q0FDRjtBQWhCRCxzRUFnQkM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBYSw2QkFBOEIsU0FBUSxhQUFhO0lBQzlELFlBQVksUUFBMkI7UUFDckMsS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDbkMsQ0FBQztDQUNGO0FBSkQsc0VBSUM7QUFhRDs7O0dBR0c7QUFDSCxTQUFTLEtBQUssQ0FBQyxPQUEwQjtJQUN2QyxPQUFPLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFB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R29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLyogZXNsaW50LWRpc2FibGUgbm8tY29uc3RhbnQtY29uZGl0aW9uICovXG5pbXBvcnQgeyBCYXNlRXhjZXB0aW9uIH0gZnJvbSAnLi4vZXhjZXB0aW9uJztcbmltcG9ydCB7XG4gIEpzb25Bc3RBcnJheSxcbiAgSnNvbkFzdENvbW1lbnQsXG4gIEpzb25Bc3RDb25zdGFudEZhbHNlLFxuICBKc29uQXN0Q29uc3RhbnROdWxsLFxuICBKc29uQXN0Q29uc3RhbnRUcnVlLFxuICBKc29uQXN0SWRlbnRpZmllcixcbiAgSnNvbkFzdEtleVZhbHVlLFxuICBKc29uQXN0TXVsdGlsaW5lQ29tbWVudCxcbiAgSnNvbkFzdE5vZGUsXG4gIEpzb25Bc3ROdW1iZXIsXG4gIEpzb25Bc3RPYmplY3QsXG4gIEpzb25Bc3RTdHJpbmcsXG4gIFBvc2l0aW9uLFxufSBmcm9tICcuL3BhcnNlcl9hc3QnO1xuaW1wb3J0IHsgSnNvbkFycmF5LCBKc29uT2JqZWN0IH0gZnJvbSAnLi91dGlscyc7XG5cbmV4cG9ydCBjbGFzcyBKc29uRXhjZXB0aW9uIGV4dGVuZHMgQmFzZUV4Y2VwdGlvbiB7fVxuXG4vKipcbiAqIEEgY2hhcmFjdGVyIHdhcyBpbnZhbGlkIGluIHRoaXMgY29udGV4dC5cbiAqIEBkZXByZWNhdGVkXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgY2xhc3MgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24gZXh0ZW5kcyBKc29uRXhjZXB0aW9uIHtcbiAgaW52YWxpZENoYXI6IHN0cmluZztcbiAgbGluZTogbnVtYmVyO1xuICBjaGFyYWN0ZXI6IG51bWJlcjtcbiAgb2Zmc2V0OiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpIHtcbiAgICBjb25zdCBwb3MgPSBjb250ZXh0LnByZXZpb3VzO1xuICAgIGNvbnN0IGludmFsaWRDaGFyID0gSlNPTi5zdHJpbmdpZnkoX3BlZWsoY29udGV4dCkpO1xuICAgIHN1cGVyKGBJbnZhbGlkIEpTT04gY2hhcmFjdGVyOiAke2ludmFsaWRDaGFyfSBhdCAke3Bvcy5saW5lfToke3Bvcy5jaGFyYWN0ZXJ9LmApO1xuXG4gICAgdGhpcy5pbnZhbGlkQ2hhciA9IGludmFsaWRDaGFyO1xuICAgIHRoaXMubGluZSA9IHBvcy5saW5lO1xuICAgIHRoaXMub2Zmc2V0ID0gcG9zLm9mZnNldDtcbiAgICB0aGlzLmNoYXJhY3RlciA9IHBvcy5jaGFyYWN0ZXI7XG4gIH1cbn1cblxuLyoqXG4gKiBNb3JlIGlucHV0IHdhcyBleHBlY3RlZCwgYnV0IHdlIHJlYWNoZWQgdGhlIGVuZCBvZiB0aGUgc3RyZWFtLlxuICogQGRlcHJlY2F0ZWRcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBjbGFzcyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbiBleHRlbmRzIEpzb25FeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihfY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpIHtcbiAgICBzdXBlcihgVW5leHBlY3RlZCBlbmQgb2YgZmlsZS5gKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbnRleHQgcGFzc2VkIGFyb3VuZCB0aGUgcGFyc2VyIHdpdGggaW5mb3JtYXRpb24gYWJvdXQgd2hlcmUgd2UgY3VycmVudGx5IGFyZSBpbiB0aGUgcGFyc2UuXG4gKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkIHNpbmNlIHZlcnNpb24gMTEuIFVzZSAzcmQgcGFydHkgSlNPTiBwYXJzZXJzIHN1Y2ggYXMgYGpzb25jLXBhcnNlcmAgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBKc29uUGFyc2VyQ29udGV4dCB7XG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgcHJldmlvdXM6IFBvc2l0aW9uO1xuICByZWFkb25seSBvcmlnaW5hbDogc3RyaW5nO1xuICByZWFkb25seSBtb2RlOiBKc29uUGFyc2VNb2RlO1xufVxuXG4vKipcbiAqIFBlZWsgYW5kIHJldHVybiB0aGUgbmV4dCBjaGFyYWN0ZXIgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9wZWVrKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdO1xufVxuXG4vKipcbiAqIE1vdmUgdGhlIGNvbnRleHQgdG8gdGhlIG5leHQgY2hhcmFjdGVyLCBpbmNsdWRpbmcgaW5jcmVtZW50aW5nIHRoZSBsaW5lIGlmIG5lY2Vzc2FyeS5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9uZXh0KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KSB7XG4gIGNvbnRleHQucHJldmlvdXMgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIGxldCB7IG9mZnNldCwgbGluZSwgY2hhcmFjdGVyIH0gPSBjb250ZXh0LnBvc2l0aW9uO1xuICBjb25zdCBjaGFyID0gY29udGV4dC5vcmlnaW5hbFtvZmZzZXRdO1xuICBvZmZzZXQrKztcbiAgaWYgKGNoYXIgPT0gJ1xcbicpIHtcbiAgICBsaW5lKys7XG4gICAgY2hhcmFjdGVyID0gMDtcbiAgfSBlbHNlIHtcbiAgICBjaGFyYWN0ZXIrKztcbiAgfVxuICBjb250ZXh0LnBvc2l0aW9uID0geyBvZmZzZXQsIGxpbmUsIGNoYXJhY3RlciB9O1xufVxuXG4vKipcbiAqIFJlYWQgYSBzaW5nbGUgY2hhcmFjdGVyIGZyb20gdGhlIGlucHV0LiBJZiBhIGB2YWxpZGAgc3RyaW5nIGlzIHBhc3NlZCwgdmFsaWRhdGUgdGhhdCB0aGVcbiAqIGNoYXJhY3RlciBpcyBpbmNsdWRlZCBpbiB0aGUgdmFsaWQgc3RyaW5nLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3Rva2VuKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCB2YWxpZDogc3RyaW5nKTogc3RyaW5nO1xuZnVuY3Rpb24gX3Rva2VuKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0KTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuZnVuY3Rpb24gX3Rva2VuKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCB2YWxpZD86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGNoYXIgPSBfcGVlayhjb250ZXh0KTtcbiAgaWYgKHZhbGlkKSB7XG4gICAgaWYgKCFjaGFyKSB7XG4gICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfVxuICAgIGlmICh2YWxpZC5pbmRleE9mKGNoYXIpID09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgLy8gTW92ZSB0aGUgcG9zaXRpb24gb2YgdGhlIGNvbnRleHQgdG8gdGhlIG5leHQgY2hhcmFjdGVyLlxuICBfbmV4dChjb250ZXh0KTtcblxuICByZXR1cm4gY2hhcjtcbn1cblxuLyoqXG4gKiBSZWFkIHRoZSBleHBvbmVudCBwYXJ0IG9mIGEgbnVtYmVyLiBUaGUgZXhwb25lbnQgcGFydCBpcyBsb29zZXIgZm9yIEpTT04gdGhhbiB0aGUgbnVtYmVyXG4gKiBwYXJ0LiBgc3RyYCBpcyB0aGUgc3RyaW5nIG9mIHRoZSBudW1iZXIgaXRzZWxmIGZvdW5kIHNvIGZhciwgYW5kIHN0YXJ0IHRoZSBwb3NpdGlvblxuICogd2hlcmUgdGhlIGZ1bGwgbnVtYmVyIHN0YXJ0ZWQuIFJldHVybnMgdGhlIG5vZGUgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEV4cE51bWJlcihcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIHN0YXJ0OiBQb3NpdGlvbixcbiAgc3RyOiBzdHJpbmcsXG4gIGNvbW1lbnRzOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSxcbik6IEpzb25Bc3ROdW1iZXIge1xuICBsZXQgY2hhcjtcbiAgbGV0IHNpZ25lZCA9IGZhbHNlO1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICBpZiAoY2hhciA9PSAnKycgfHwgY2hhciA9PSAnLScpIHtcbiAgICAgIGlmIChzaWduZWQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBzaWduZWQgPSB0cnVlO1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGNoYXIgPT0gJzAnIHx8XG4gICAgICBjaGFyID09ICcxJyB8fFxuICAgICAgY2hhciA9PSAnMicgfHxcbiAgICAgIGNoYXIgPT0gJzMnIHx8XG4gICAgICBjaGFyID09ICc0JyB8fFxuICAgICAgY2hhciA9PSAnNScgfHxcbiAgICAgIGNoYXIgPT0gJzYnIHx8XG4gICAgICBjaGFyID09ICc3JyB8fFxuICAgICAgY2hhciA9PSAnOCcgfHxcbiAgICAgIGNoYXIgPT0gJzknXG4gICAgKSB7XG4gICAgICBzaWduZWQgPSB0cnVlO1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFdlJ3JlIGRvbmUgcmVhZGluZyB0aGlzIG51bWJlci5cbiAgY29udGV4dC5wb3NpdGlvbiA9IGNvbnRleHQucHJldmlvdXM7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVtYmVyJyxcbiAgICBzdGFydCxcbiAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgdmFsdWU6IE51bWJlci5wYXJzZUZsb2F0KHN0ciksXG4gICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIGhleGEgcGFydCBvZiBhIDB4QkFEQ0FGRSBoZXhhZGVjaW1hbCBudW1iZXIuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEhleGFOdW1iZXIoXG4gIGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICBpc05lZ2F0aXZlOiBib29sZWFuLFxuICBzdGFydDogUG9zaXRpb24sXG4gIGNvbW1lbnRzOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSxcbik6IEpzb25Bc3ROdW1iZXIge1xuICAvLyBSZWFkIGFuIGhleGFkZWNpbWFsIG51bWJlciwgdW50aWwgaXQncyBub3QgaGV4YWRlY2ltYWwuXG4gIGxldCBoZXhhID0gJyc7XG4gIGNvbnN0IHZhbGlkID0gJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnO1xuXG4gIGZvciAobGV0IGNoID0gX3BlZWsoY29udGV4dCk7IGNoICYmIHZhbGlkLmluY2x1ZGVzKGNoKTsgY2ggPSBfcGVlayhjb250ZXh0KSkge1xuICAgIC8vIEFkZCBpdCB0byB0aGUgaGV4YSBzdHJpbmcuXG4gICAgaGV4YSArPSBjaDtcbiAgICAvLyBNb3ZlIHRoZSBwb3NpdGlvbiBvZiB0aGUgY29udGV4dCB0byB0aGUgbmV4dCBjaGFyYWN0ZXIuXG4gICAgX25leHQoY29udGV4dCk7XG4gIH1cblxuICBjb25zdCB2YWx1ZSA9IE51bWJlci5wYXJzZUludChoZXhhLCAxNik7XG5cbiAgLy8gV2UncmUgZG9uZSByZWFkaW5nIHRoaXMgbnVtYmVyLlxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudW1iZXInLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZTogaXNOZWdhdGl2ZSA/IC12YWx1ZSA6IHZhbHVlLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgYSBudW1iZXIgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkTnVtYmVyKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE51bWJlciB7XG4gIGxldCBzdHIgPSAnJztcbiAgbGV0IGRvdHRlZCA9IGZhbHNlO1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgLy8gcmVhZCB1bnRpbCBgZWAgb3IgZW5kIG9mIGxpbmUuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgY2hhciA9IF90b2tlbihjb250ZXh0KTtcblxuICAgIC8vIFJlYWQgdG9rZW5zLCBvbmUgYnkgb25lLlxuICAgIGlmIChjaGFyID09ICctJykge1xuICAgICAgaWYgKHN0ciAhPSAnJykge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGNoYXIgPT0gJ0knICYmXG4gICAgICAoc3RyID09ICctJyB8fCBzdHIgPT0gJycgfHwgc3RyID09ICcrJykgJiZcbiAgICAgIChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk51bWJlckNvbnN0YW50c0FsbG93ZWQpICE9IDBcbiAgICApIHtcbiAgICAgIC8vIEluZmluaXR5P1xuICAgICAgLy8gX3Rva2VuKGNvbnRleHQsICdJJyk7IEFscmVhZHkgcmVhZC5cbiAgICAgIF90b2tlbihjb250ZXh0LCAnbicpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICdmJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ2knKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnbicpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICdpJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ3QnKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAneScpO1xuXG4gICAgICBzdHIgKz0gJ0luZmluaXR5JztcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnMCcpIHtcbiAgICAgIGlmIChzdHIgPT0gJzAnIHx8IHN0ciA9PSAnLTAnKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgY2hhciA9PSAnMScgfHxcbiAgICAgIGNoYXIgPT0gJzInIHx8XG4gICAgICBjaGFyID09ICczJyB8fFxuICAgICAgY2hhciA9PSAnNCcgfHxcbiAgICAgIGNoYXIgPT0gJzUnIHx8XG4gICAgICBjaGFyID09ICc2JyB8fFxuICAgICAgY2hhciA9PSAnNycgfHxcbiAgICAgIGNoYXIgPT0gJzgnIHx8XG4gICAgICBjaGFyID09ICc5J1xuICAgICkge1xuICAgICAgaWYgKHN0ciA9PSAnMCcgfHwgc3RyID09ICctMCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnKycgJiYgc3RyID09ICcnKSB7XG4gICAgICAvLyBQYXNzIG92ZXIuXG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcuJykge1xuICAgICAgaWYgKGRvdHRlZCkge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgICBkb3R0ZWQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnZScgfHwgY2hhciA9PSAnRScpIHtcbiAgICAgIHJldHVybiBfcmVhZEV4cE51bWJlcihjb250ZXh0LCBzdGFydCwgc3RyICsgY2hhciwgY29tbWVudHMpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBjaGFyID09ICd4JyAmJlxuICAgICAgKHN0ciA9PSAnMCcgfHwgc3RyID09ICctMCcpICYmXG4gICAgICAoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5IZXhhZGVjaW1hbE51bWJlckFsbG93ZWQpICE9IDBcbiAgICApIHtcbiAgICAgIHJldHVybiBfcmVhZEhleGFOdW1iZXIoY29udGV4dCwgc3RyID09ICctMCcsIHN0YXJ0LCBjb21tZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFdlIHJlYWQgb25lIHRvbyBtYW55IGNoYXJhY3RlcnMsIHNvIHJvbGxiYWNrIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgIGNvbnRleHQucG9zaXRpb24gPSBjb250ZXh0LnByZXZpb3VzO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgc3RyICs9IGNoYXI7XG4gIH1cblxuICAvLyBXZSdyZSBkb25lIHJlYWRpbmcgdGhpcyBudW1iZXIuXG4gIGlmIChzdHIuZW5kc1dpdGgoJy4nKSAmJiAoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5IZXhhZGVjaW1hbE51bWJlckFsbG93ZWQpID09IDApIHtcbiAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudW1iZXInLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZTogTnVtYmVyLnBhcnNlRmxvYXQoc3RyKSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIGEgc3RyaW5nIGZyb20gdGhlIGNvbnRleHQuIFRha2VzIHRoZSBjb21tZW50cyBvZiB0aGUgc3RyaW5nIG9yIHJlYWQgdGhlIGJsYW5rcyBiZWZvcmUgdGhlXG4gKiBzdHJpbmcuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZFN0cmluZyhjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RTdHJpbmcge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgLy8gQ29uc3VtZSB0aGUgZmlyc3Qgc3RyaW5nIGRlbGltaXRlci5cbiAgY29uc3QgZGVsaW0gPSBfdG9rZW4oY29udGV4dCk7XG4gIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5TaW5nbGVRdW90ZXNBbGxvd2VkKSA9PSAwKSB7XG4gICAgaWYgKGRlbGltID09IFwiJ1wiKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHN0ciA9ICcnO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGxldCBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuICAgIGlmIChjaGFyID09IGRlbGltKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiAnc3RyaW5nJyxcbiAgICAgICAgc3RhcnQsXG4gICAgICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICAgICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgICAgIHZhbHVlOiBzdHIsXG4gICAgICAgIGNvbW1lbnRzOiBjb21tZW50cyxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICdcXFxcJykge1xuICAgICAgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICAgIHN3aXRjaCAoY2hhcikge1xuICAgICAgICBjYXNlICdcXFxcJzpcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgY2FzZSBkZWxpbTpcbiAgICAgICAgICBzdHIgKz0gY2hhcjtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlICdiJzpcbiAgICAgICAgICBzdHIgKz0gJ1xcYic7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2YnOlxuICAgICAgICAgIHN0ciArPSAnXFxmJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgc3RyICs9ICdcXG4nO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyJzpcbiAgICAgICAgICBzdHIgKz0gJ1xccic7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3QnOlxuICAgICAgICAgIHN0ciArPSAnXFx0JztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndSc6XG4gICAgICAgICAgY29uc3QgW2MwXSA9IF90b2tlbihjb250ZXh0LCAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRicpO1xuICAgICAgICAgIGNvbnN0IFtjMV0gPSBfdG9rZW4oY29udGV4dCwgJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnKTtcbiAgICAgICAgICBjb25zdCBbYzJdID0gX3Rva2VuKGNvbnRleHQsICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJyk7XG4gICAgICAgICAgY29uc3QgW2MzXSA9IF90b2tlbihjb250ZXh0LCAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRicpO1xuICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnNlSW50KGMwICsgYzEgKyBjMiArIGMzLCAxNikpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcblxuICAgICAgICBjYXNlICdcXG4nOlxuICAgICAgICAgIC8vIE9ubHkgdmFsaWQgd2hlbiBtdWx0aWxpbmUgc3RyaW5ncyBhcmUgYWxsb3dlZC5cbiAgICAgICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuTXVsdGlMaW5lU3RyaW5nQWxsb3dlZCkgPT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdHIgKz0gY2hhcjtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNoYXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnXFxiJyB8fCBjaGFyID09ICdcXGYnIHx8IGNoYXIgPT0gJ1xcbicgfHwgY2hhciA9PSAnXFxyJyB8fCBjaGFyID09ICdcXHQnKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSBjaGFyO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGB0cnVlYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRUcnVlKFxuICBjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSxcbik6IEpzb25Bc3RDb25zdGFudFRydWUge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gIF90b2tlbihjb250ZXh0LCAndCcpO1xuICBfdG9rZW4oY29udGV4dCwgJ3InKTtcbiAgX3Rva2VuKGNvbnRleHQsICd1Jyk7XG4gIF90b2tlbihjb250ZXh0LCAnZScpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAndHJ1ZScsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IHRydWUsXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCB0aGUgY29uc3RhbnQgYGZhbHNlYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRGYWxzZShcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCksXG4pOiBKc29uQXN0Q29uc3RhbnRGYWxzZSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgX3Rva2VuKGNvbnRleHQsICdmJyk7XG4gIF90b2tlbihjb250ZXh0LCAnYScpO1xuICBfdG9rZW4oY29udGV4dCwgJ2wnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdzJyk7XG4gIF90b2tlbihjb250ZXh0LCAnZScpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnZmFsc2UnLFxuICAgIHN0YXJ0LFxuICAgIGVuZCxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpLFxuICAgIHZhbHVlOiBmYWxzZSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuLyoqXG4gKiBSZWFkIHRoZSBjb25zdGFudCBgbnVsbGAgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkTnVsbChcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCksXG4pOiBKc29uQXN0Q29uc3RhbnROdWxsIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIF90b2tlbihjb250ZXh0LCAnbicpO1xuICBfdG9rZW4oY29udGV4dCwgJ3UnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdsJyk7XG4gIF90b2tlbihjb250ZXh0LCAnbCcpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVsbCcsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IG51bGwsXG4gICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGBOYU5gIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZE5hTihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3ROdW1iZXIge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgX3Rva2VuKGNvbnRleHQsICdOJyk7XG4gIF90b2tlbihjb250ZXh0LCAnYScpO1xuICBfdG9rZW4oY29udGV4dCwgJ04nKTtcblxuICBjb25zdCBlbmQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IE5hTixcbiAgICBjb21tZW50czogY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCBhbiBhcnJheSBvZiBKU09OIHZhbHVlcyBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRBcnJheShjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RBcnJheSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICAvLyBDb25zdW1lIHRoZSBmaXJzdCBkZWxpbWl0ZXIuXG4gIF90b2tlbihjb250ZXh0LCAnWycpO1xuICBjb25zdCB2YWx1ZTogSnNvbkFycmF5ID0gW107XG4gIGNvbnN0IGVsZW1lbnRzOiBKc29uQXN0Tm9kZVtdID0gW107XG5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG4gIGlmIChfcGVlayhjb250ZXh0KSAhPSAnXScpIHtcbiAgICBjb25zdCBub2RlID0gX3JlYWRWYWx1ZShjb250ZXh0KTtcbiAgICBlbGVtZW50cy5wdXNoKG5vZGUpO1xuICAgIHZhbHVlLnB1c2gobm9kZS52YWx1ZSk7XG4gIH1cblxuICB3aGlsZSAoX3BlZWsoY29udGV4dCkgIT0gJ10nKSB7XG4gICAgX3Rva2VuKGNvbnRleHQsICcsJyk7XG5cbiAgICBjb25zdCB2YWx1ZUNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCk7XG4gICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLlRyYWlsaW5nQ29tbWFzQWxsb3dlZCkgIT09IDAgJiYgX3BlZWsoY29udGV4dCkgPT09ICddJykge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IG5vZGUgPSBfcmVhZFZhbHVlKGNvbnRleHQsIHZhbHVlQ29tbWVudHMpO1xuICAgIGVsZW1lbnRzLnB1c2gobm9kZSk7XG4gICAgdmFsdWUucHVzaChub2RlLnZhbHVlKTtcbiAgfVxuXG4gIF90b2tlbihjb250ZXh0LCAnXScpO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ2FycmF5JyxcbiAgICBzdGFydCxcbiAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCksXG4gICAgdmFsdWUsXG4gICAgZWxlbWVudHMsXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCBhbiBpZGVudGlmaWVyIGZyb20gdGhlIGNvbnRleHQuIEFuIGlkZW50aWZpZXIgaXMgYSB2YWxpZCBKYXZhU2NyaXB0IGlkZW50aWZpZXIsIGFuZCB0aGlzXG4gKiBmdW5jdGlvbiBpcyBvbmx5IHVzZWQgaW4gTG9vc2UgbW9kZS5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkSWRlbnRpZmllcihcbiAgY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCksXG4pOiBKc29uQXN0SWRlbnRpZmllciB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICBsZXQgY2hhciA9IF9wZWVrKGNvbnRleHQpO1xuICBpZiAoY2hhciAmJiAnMDEyMzQ1Njc4OScuaW5kZXhPZihjaGFyKSAhPSAtMSkge1xuICAgIGNvbnN0IGlkZW50aWZpZXJOb2RlID0gX3JlYWROdW1iZXIoY29udGV4dCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2lkZW50aWZpZXInLFxuICAgICAgc3RhcnQsXG4gICAgICBlbmQ6IGlkZW50aWZpZXJOb2RlLmVuZCxcbiAgICAgIHRleHQ6IGlkZW50aWZpZXJOb2RlLnRleHQsXG4gICAgICB2YWx1ZTogaWRlbnRpZmllck5vZGUudmFsdWUudG9TdHJpbmcoKSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgaWRlbnRWYWxpZEZpcnN0Q2hhciA9ICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1PUFFSU1RVVldYWVonO1xuICBjb25zdCBpZGVudFZhbGlkQ2hhciA9ICdfJGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU9QUVJTVFVWV1hZWjAxMjM0NTY3ODknO1xuICBsZXQgZmlyc3QgPSB0cnVlO1xuICBsZXQgdmFsdWUgPSAnJztcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNoYXIgPSBfdG9rZW4oY29udGV4dCk7XG4gICAgaWYgKFxuICAgICAgY2hhciA9PSB1bmRlZmluZWQgfHxcbiAgICAgIChmaXJzdCA/IGlkZW50VmFsaWRGaXJzdENoYXIuaW5kZXhPZihjaGFyKSA6IGlkZW50VmFsaWRDaGFyLmluZGV4T2YoY2hhcikpID09IC0xXG4gICAgKSB7XG4gICAgICBjb250ZXh0LnBvc2l0aW9uID0gY29udGV4dC5wcmV2aW91cztcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogJ2lkZW50aWZpZXInLFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnNsaWNlKHN0YXJ0Lm9mZnNldCwgc3RhcnQub2Zmc2V0ICsgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgICAgICB2YWx1ZSxcbiAgICAgICAgY29tbWVudHMsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHZhbHVlICs9IGNoYXI7XG4gICAgZmlyc3QgPSBmYWxzZTtcbiAgfVxufVxuXG4vKipcbiAqIFJlYWQgYSBwcm9wZXJ0eSBmcm9tIHRoZSBjb250ZXh0LiBBIHByb3BlcnR5IGlzIGEgc3RyaW5nIG9yIChpbiBMb29zZSBtb2RlIG9ubHkpIGEgbnVtYmVyIG9yXG4gKiBhbiBpZGVudGlmaWVyLCBmb2xsb3dlZCBieSBhIGNvbG9uIGA6YC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkUHJvcGVydHkoXG4gIGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpLFxuKTogSnNvbkFzdEtleVZhbHVlIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIGxldCBrZXk7XG4gIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5JZGVudGlmaWVyS2V5TmFtZXNBbGxvd2VkKSAhPSAwKSB7XG4gICAgY29uc3QgdG9wID0gX3BlZWsoY29udGV4dCk7XG4gICAgaWYgKHRvcCA9PSAnXCInIHx8IHRvcCA9PSBcIidcIikge1xuICAgICAga2V5ID0gX3JlYWRTdHJpbmcoY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtleSA9IF9yZWFkSWRlbnRpZmllcihjb250ZXh0KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAga2V5ID0gX3JlYWRTdHJpbmcoY29udGV4dCk7XG4gIH1cblxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgX3Rva2VuKGNvbnRleHQsICc6Jyk7XG4gIGNvbnN0IHZhbHVlID0gX3JlYWRWYWx1ZShjb250ZXh0KTtcbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdrZXl2YWx1ZScsXG4gICAga2V5LFxuICAgIHZhbHVlLFxuICAgIHN0YXJ0LFxuICAgIGVuZCxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlYWQgYW4gb2JqZWN0IG9mIHByb3BlcnRpZXMgLT4gSlNPTiB2YWx1ZXMgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkT2JqZWN0KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdE9iamVjdCB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgLy8gQ29uc3VtZSB0aGUgZmlyc3QgZGVsaW1pdGVyLlxuICBfdG9rZW4oY29udGV4dCwgJ3snKTtcbiAgY29uc3QgdmFsdWU6IEpzb25PYmplY3QgPSB7fTtcbiAgY29uc3QgcHJvcGVydGllczogSnNvbkFzdEtleVZhbHVlW10gPSBbXTtcblxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgaWYgKF9wZWVrKGNvbnRleHQpICE9ICd9Jykge1xuICAgIGNvbnN0IHByb3BlcnR5ID0gX3JlYWRQcm9wZXJ0eShjb250ZXh0KTtcbiAgICB2YWx1ZVtwcm9wZXJ0eS5rZXkudmFsdWVdID0gcHJvcGVydHkudmFsdWUudmFsdWU7XG4gICAgcHJvcGVydGllcy5wdXNoKHByb3BlcnR5KTtcblxuICAgIHdoaWxlIChfcGVlayhjb250ZXh0KSAhPSAnfScpIHtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnLCcpO1xuXG4gICAgICBjb25zdCBwcm9wZXJ0eUNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCk7XG4gICAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuVHJhaWxpbmdDb21tYXNBbGxvd2VkKSAhPT0gMCAmJiBfcGVlayhjb250ZXh0KSA9PT0gJ30nKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY29uc3QgcHJvcGVydHkgPSBfcmVhZFByb3BlcnR5KGNvbnRleHQsIHByb3BlcnR5Q29tbWVudHMpO1xuICAgICAgdmFsdWVbcHJvcGVydHkua2V5LnZhbHVlXSA9IHByb3BlcnR5LnZhbHVlLnZhbHVlO1xuICAgICAgcHJvcGVydGllcy5wdXNoKHByb3BlcnR5KTtcbiAgICB9XG4gIH1cblxuICBfdG9rZW4oY29udGV4dCwgJ30nKTtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdvYmplY3QnLFxuICAgIHByb3BlcnRpZXMsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHZhbHVlLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIGNvbW1lbnRzLFxuICB9O1xufVxuXG4vKipcbiAqIFJlbW92ZSBhbnkgYmxhbmsgY2hhcmFjdGVyIG9yIGNvbW1lbnRzIChpbiBMb29zZSBtb2RlKSBmcm9tIHRoZSBjb250ZXh0LCByZXR1cm5pbmcgYW4gYXJyYXlcbiAqIG9mIGNvbW1lbnRzIGlmIGFueSBhcmUgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEJsYW5rcyhjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCk6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdIHtcbiAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkNvbW1lbnRzQWxsb3dlZCkgIT0gMCkge1xuICAgIGNvbnN0IGNvbW1lbnRzOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSA9IFtdO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBjaGFyID0gY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF07XG4gICAgICBpZiAoY2hhciA9PSAnLycgJiYgY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldCArIDFdID09ICcqJykge1xuICAgICAgICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gICAgICAgIC8vIE11bHRpIGxpbmUgY29tbWVudC5cbiAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuXG4gICAgICAgIHdoaWxlIChcbiAgICAgICAgICBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XSAhPSAnKicgfHxcbiAgICAgICAgICBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0ICsgMV0gIT0gJy8nXG4gICAgICAgICkge1xuICAgICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICAgIGlmIChjb250ZXh0LnBvc2l0aW9uLm9mZnNldCA+PSBjb250ZXh0Lm9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBSZW1vdmUgXCIqL1wiLlxuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgX25leHQoY29udGV4dCk7XG5cbiAgICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgICAga2luZDogJ211bHRpY29tbWVudCcsXG4gICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgICAgICAgIGNvbnRlbnQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCArIDIsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IC0gMiksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChjaGFyID09ICcvJyAmJiBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0ICsgMV0gPT0gJy8nKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgICAgICAgLy8gTXVsdGkgbGluZSBjb21tZW50LlxuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgX25leHQoY29udGV4dCk7XG5cbiAgICAgICAgd2hpbGUgKGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdICE9ICdcXG4nKSB7XG4gICAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgICAgaWYgKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0ID49IGNvbnRleHQub3JpZ2luYWwubGVuZ3RoKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1vdmUgXCJcXG5cIi5cbiAgICAgICAgaWYgKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IDwgY29udGV4dC5vcmlnaW5hbC5sZW5ndGgpIHtcbiAgICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgICBjb21tZW50cy5wdXNoKHtcbiAgICAgICAgICBraW5kOiAnY29tbWVudCcsXG4gICAgICAgICAgc3RhcnQsXG4gICAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgICAgICAgIGNvbnRlbnQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCArIDIsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IC0gMSksXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChjaGFyID09ICcgJyB8fCBjaGFyID09ICdcXHQnIHx8IGNoYXIgPT0gJ1xcbicgfHwgY2hhciA9PSAnXFxyJyB8fCBjaGFyID09ICdcXGYnKSB7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbW1lbnRzO1xuICB9IGVsc2Uge1xuICAgIGxldCBjaGFyID0gY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF07XG4gICAgd2hpbGUgKGNoYXIgPT0gJyAnIHx8IGNoYXIgPT0gJ1xcdCcgfHwgY2hhciA9PSAnXFxuJyB8fCBjaGFyID09ICdcXHInIHx8IGNoYXIgPT0gJ1xcZicpIHtcbiAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgY2hhciA9IGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdO1xuICAgIH1cblxuICAgIHJldHVybiBbXTtcbiAgfVxufVxuXG4vKipcbiAqIFJlYWQgYSBKU09OIHZhbHVlIGZyb20gdGhlIGNvbnRleHQsIHdoaWNoIGNhbiBiZSBhbnkgZm9ybSBvZiBKU09OIHZhbHVlLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRWYWx1ZShjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3ROb2RlIHtcbiAgbGV0IHJlc3VsdDogSnNvbkFzdE5vZGU7XG5cbiAgLy8gQ2xlYW4gdXAgYmVmb3JlLlxuICBjb25zdCBjaGFyID0gX3BlZWsoY29udGV4dCk7XG4gIHN3aXRjaCAoY2hhcikge1xuICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuXG4gICAgY2FzZSAnLSc6XG4gICAgY2FzZSAnMCc6XG4gICAgY2FzZSAnMSc6XG4gICAgY2FzZSAnMic6XG4gICAgY2FzZSAnMyc6XG4gICAgY2FzZSAnNCc6XG4gICAgY2FzZSAnNSc6XG4gICAgY2FzZSAnNic6XG4gICAgY2FzZSAnNyc6XG4gICAgY2FzZSAnOCc6XG4gICAgY2FzZSAnOSc6XG4gICAgICByZXN1bHQgPSBfcmVhZE51bWJlcihjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJy4nOlxuICAgIGNhc2UgJysnOlxuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkxheE51bWJlclBhcnNpbmdBbGxvd2VkKSA9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IF9yZWFkTnVtYmVyKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSBcIidcIjpcbiAgICBjYXNlICdcIic6XG4gICAgICByZXN1bHQgPSBfcmVhZFN0cmluZyhjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ0knOlxuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk51bWJlckNvbnN0YW50c0FsbG93ZWQpID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gX3JlYWROdW1iZXIoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdOJzpcbiAgICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5OdW1iZXJDb25zdGFudHNBbGxvd2VkKSA9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IF9yZWFkTmFOKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAndCc6XG4gICAgICByZXN1bHQgPSBfcmVhZFRydWUoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZic6XG4gICAgICByZXN1bHQgPSBfcmVhZEZhbHNlKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ24nOlxuICAgICAgcmVzdWx0ID0gX3JlYWROdWxsKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnWyc6XG4gICAgICByZXN1bHQgPSBfcmVhZEFycmF5KGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAneyc6XG4gICAgICByZXN1bHQgPSBfcmVhZE9iamVjdChjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gIH1cblxuICAvLyBDbGVhbiB1cCBhZnRlci5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBUaGUgUGFyc2UgbW9kZSB1c2VkIGZvciBwYXJzaW5nIHRoZSBKU09OIHN0cmluZy5cbiAqL1xuZXhwb3J0IGVudW0gSnNvblBhcnNlTW9kZSB7XG4gIFN0cmljdCA9IDAsIC8vIFN0YW5kYXJkIEpTT04uXG4gIENvbW1lbnRzQWxsb3dlZCA9IDEgPDwgMCwgLy8gQWxsb3dzIGNvbW1lbnRzLCBib3RoIHNpbmdsZSBvciBtdWx0aSBsaW5lcy5cbiAgU2luZ2xlUXVvdGVzQWxsb3dlZCA9IDEgPDwgMSwgLy8gQWxsb3cgc2luZ2xlIHF1b3RlZCBzdHJpbmdzLlxuICBJZGVudGlmaWVyS2V5TmFtZXNBbGxvd2VkID0gMSA8PCAyLCAvLyBBbGxvdyBpZGVudGlmaWVycyBhcyBvYmplY3RwIHByb3BlcnRpZXMuXG4gIFRyYWlsaW5nQ29tbWFzQWxsb3dlZCA9IDEgPDwgMyxcbiAgSGV4YWRlY2ltYWxOdW1iZXJBbGxvd2VkID0gMSA8PCA0LFxuICBNdWx0aUxpbmVTdHJpbmdBbGxvd2VkID0gMSA8PCA1LFxuICBMYXhOdW1iZXJQYXJzaW5nQWxsb3dlZCA9IDEgPDwgNiwgLy8gQWxsb3cgYC5gIG9yIGArYCBhcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIGEgbnVtYmVyLlxuICBOdW1iZXJDb25zdGFudHNBbGxvd2VkID0gMSA8PCA3LCAvLyBBbGxvdyAtSW5maW5pdHksIEluZmluaXR5IGFuZCBOYU4uXG5cbiAgRGVmYXVsdCA9IFN0cmljdCxcbiAgTG9vc2UgPSBDb21tZW50c0FsbG93ZWQgfFxuICAgIFNpbmdsZVF1b3Rlc0FsbG93ZWQgfFxuICAgIElkZW50aWZpZXJLZXlOYW1lc0FsbG93ZWQgfFxuICAgIFRyYWlsaW5nQ29tbWFzQWxsb3dlZCB8XG4gICAgSGV4YWRlY2ltYWxOdW1iZXJBbGxvd2VkIHxcbiAgICBNdWx0aUxpbmVTdHJpbmdBbGxvd2VkIHxcbiAgICBMYXhOdW1iZXJQYXJzaW5nQWxsb3dlZCB8XG4gICAgTnVtYmVyQ29uc3RhbnRzQWxsb3dlZCxcblxuICBKc29uID0gU3RyaWN0LFxuICBKc29uNSA9IExvb3NlLFxufVxuXG4vKipcbiAqIFBhcnNlIHRoZSBKU09OIHN0cmluZyBhbmQgcmV0dXJuIGl0cyBBU1QuIFRoZSBBU1QgbWF5IGJlIGxvc2luZyBkYXRhIChlbmQgY29tbWVudHMgYXJlXG4gKiBkaXNjYXJkZWQgZm9yIGV4YW1wbGUsIGFuZCBzcGFjZSBjaGFyYWN0ZXJzIGFyZSBub3QgcmVwcmVzZW50ZWQgaW4gdGhlIEFTVCksIGJ1dCBhbGwgdmFsdWVzXG4gKiB3aWxsIGhhdmUgYSBzaW5nbGUgbm9kZSBpbiB0aGUgQVNUIChhIDEtdG8tMSBtYXBwaW5nKS5cbiAqXG4gKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkIHNpbmNlIHZlcnNpb24gMTEuIFVzZSAzcmQgcGFydHkgSlNPTiBwYXJzZXJzIHN1Y2ggYXMgYGpzb25jLXBhcnNlcmAgaW5zdGVhZC5cbiAqIEBwYXJhbSBpbnB1dCBUaGUgc3RyaW5nIHRvIHVzZS5cbiAqIEBwYXJhbSBtb2RlIFRoZSBtb2RlIHRvIHBhcnNlIHRoZSBpbnB1dCB3aXRoLiB7QHNlZSBKc29uUGFyc2VNb2RlfS5cbiAqIEByZXR1cm5zIHtKc29uQXN0Tm9kZX0gVGhlIHJvb3Qgbm9kZSBvZiB0aGUgdmFsdWUgb2YgdGhlIEFTVC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSnNvbkFzdChpbnB1dDogc3RyaW5nLCBtb2RlID0gSnNvblBhcnNlTW9kZS5EZWZhdWx0KTogSnNvbkFzdE5vZGUge1xuICBpZiAobW9kZSA9PSBKc29uUGFyc2VNb2RlLkRlZmF1bHQpIHtcbiAgICBtb2RlID0gSnNvblBhcnNlTW9kZS5TdHJpY3Q7XG4gIH1cblxuICBjb25zdCBjb250ZXh0ID0ge1xuICAgIHBvc2l0aW9uOiB7IG9mZnNldDogMCwgbGluZTogMCwgY2hhcmFjdGVyOiAwIH0sXG4gICAgcHJldmlvdXM6IHsgb2Zmc2V0OiAwLCBsaW5lOiAwLCBjaGFyYWN0ZXI6IDAgfSxcbiAgICBvcmlnaW5hbDogaW5wdXQsXG4gICAgY29tbWVudHM6IHVuZGVmaW5lZCxcbiAgICBtb2RlLFxuICB9O1xuXG4gIGNvbnN0IGFzdCA9IF9yZWFkVmFsdWUoY29udGV4dCk7XG4gIGlmIChjb250ZXh0LnBvc2l0aW9uLm9mZnNldCA8IGlucHV0Lmxlbmd0aCkge1xuICAgIGNvbnN0IHJlc3QgPSBpbnB1dC5zbGljZShjb250ZXh0LnBvc2l0aW9uLm9mZnNldCk7XG4gICAgY29uc3QgaSA9IHJlc3QubGVuZ3RoID4gMjAgPyByZXN0LnNsaWNlKDAsIDIwKSArICcuLi4nIDogcmVzdDtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRXhwZWN0ZWQgZW5kIG9mIGZpbGUsIGdvdCBcIiR7aX1cIiBhdCBgICtcbiAgICAgICAgYCR7Y29udGV4dC5wb3NpdGlvbi5saW5lfToke2NvbnRleHQucG9zaXRpb24uY2hhcmFjdGVyfS5gLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gYXN0O1xufVxuIl19