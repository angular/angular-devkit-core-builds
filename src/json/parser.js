"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const exception_1 = require("../exception");
/**
 * A character was invalid in this context.
 */
class InvalidJsonCharacterException extends exception_1.BaseException {
    constructor(context) {
        const pos = context.previous;
        super(`Invalid JSON character: ${JSON.stringify(_peek(context))} `
            + `at ${pos.line}:${pos.character}.`);
    }
}
exports.InvalidJsonCharacterException = InvalidJsonCharacterException;
/**
 * More input was expected, but we reached the end of the stream.
 */
class UnexpectedEndOfInputException extends exception_1.BaseException {
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
        else if (char == '0' || char == '1' || char == '2' || char == '3' || char == '4'
            || char == '5' || char == '6' || char == '7' || char == '8' || char == '9') {
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
        else if (char == 'I'
            && (str == '-' || str == '' || str == '+')
            && (context.mode & JsonParseMode.NumberConstantsAllowed) != 0) {
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
        else if (char == '1' || char == '2' || char == '3' || char == '4' || char == '5'
            || char == '6' || char == '7' || char == '8' || char == '9') {
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
        else if (char == 'x' && (str == '0' || str == '-0')
            && (context.mode & JsonParseMode.HexadecimalNumberAllowed) != 0) {
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
        if (delim == '\'') {
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
                case '\/':
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
        if (char == undefined
            || (first ? identValidFirstChar.indexOf(char) : identValidChar.indexOf(char)) == -1) {
            context.position = context.previous;
            return {
                kind: 'identifier',
                start,
                end: context.position,
                text: context.original.substr(start.offset, context.position.offset),
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
        if (top == '"' || top == '\'') {
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
                while (context.original[context.position.offset] != '*'
                    || context.original[context.position.offset + 1] != '/') {
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
        case '\'':
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
        const rest = input.substr(context.position.offset);
        const i = rest.length > 20 ? rest.substr(0, 20) + '...' : rest;
        throw new Error(`Expected end of file, got "${i}" at `
            + `${context.position.line}:${context.position.character}.`);
    }
    return ast;
}
exports.parseJsonAst = parseJsonAst;
/**
 * Parse a JSON string into its value.  This discards the AST and only returns the value itself.
 * @param input The string to parse.
 * @param mode The mode to parse the input with. {@see JsonParseMode}.
 * @returns {JsonValue} The value represented by the JSON string.
 */
function parseJson(input, mode = JsonParseMode.Default) {
    // Try parsing for the fastest path available, if error, uses our own parser for better errors.
    if (mode == JsonParseMode.Strict) {
        try {
            return JSON.parse(input);
        }
        catch (err) {
            return parseJsonAst(input, mode).value;
        }
    }
    return parseJsonAst(input, mode).value;
}
exports.parseJson = parseJson;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9jb3JlL3NyYy9qc29uL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILDRDQUE2QztBQXFCN0M7O0dBRUc7QUFDSCxtQ0FBMkMsU0FBUSx5QkFBYTtJQUM5RCxZQUFZLE9BQTBCO1FBQ3BDLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7UUFDN0IsS0FBSyxDQUFDLDJCQUEyQixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHO2NBQzVELE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztJQUM1QyxDQUFDO0NBQ0Y7QUFORCxzRUFNQztBQUdEOztHQUVHO0FBQ0gsbUNBQTJDLFNBQVEseUJBQWE7SUFDOUQsWUFBWSxRQUEyQjtRQUNyQyxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUNuQyxDQUFDO0NBQ0Y7QUFKRCxzRUFJQztBQWNEOzs7R0FHRztBQUNILGVBQWUsT0FBMEI7SUFDdkMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBR0Q7OztHQUdHO0FBQ0gsZUFBZSxPQUEwQjtJQUN2QyxPQUFPLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFFcEMsSUFBSSxFQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUNqRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RDLE1BQU0sRUFBRSxDQUFDO0lBQ1QsRUFBRSxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksQ0FB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IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IEJhc2VFeGNlcHRpb24gfSBmcm9tICcuLi9leGNlcHRpb24nO1xuaW1wb3J0IHtcbiAgSnNvbkFycmF5LFxuICBKc29uQXN0QXJyYXksXG4gIEpzb25Bc3RDb21tZW50LFxuICBKc29uQXN0Q29uc3RhbnRGYWxzZSxcbiAgSnNvbkFzdENvbnN0YW50TnVsbCxcbiAgSnNvbkFzdENvbnN0YW50VHJ1ZSxcbiAgSnNvbkFzdElkZW50aWZpZXIsXG4gIEpzb25Bc3RLZXlWYWx1ZSxcbiAgSnNvbkFzdE11bHRpbGluZUNvbW1lbnQsXG4gIEpzb25Bc3ROb2RlLFxuICBKc29uQXN0TnVtYmVyLFxuICBKc29uQXN0T2JqZWN0LFxuICBKc29uQXN0U3RyaW5nLFxuICBKc29uT2JqZWN0LFxuICBKc29uVmFsdWUsXG4gIFBvc2l0aW9uLFxufSBmcm9tICcuL2ludGVyZmFjZSc7XG5cblxuLyoqXG4gKiBBIGNoYXJhY3RlciB3YXMgaW52YWxpZCBpbiB0aGlzIGNvbnRleHQuXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3Rvcihjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCkge1xuICAgIGNvbnN0IHBvcyA9IGNvbnRleHQucHJldmlvdXM7XG4gICAgc3VwZXIoYEludmFsaWQgSlNPTiBjaGFyYWN0ZXI6ICR7SlNPTi5zdHJpbmdpZnkoX3BlZWsoY29udGV4dCkpfSBgXG4gICAgICAgICsgYGF0ICR7cG9zLmxpbmV9OiR7cG9zLmNoYXJhY3Rlcn0uYCk7XG4gIH1cbn1cblxuXG4vKipcbiAqIE1vcmUgaW5wdXQgd2FzIGV4cGVjdGVkLCBidXQgd2UgcmVhY2hlZCB0aGUgZW5kIG9mIHRoZSBzdHJlYW0uXG4gKi9cbmV4cG9ydCBjbGFzcyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbiBleHRlbmRzIEJhc2VFeGNlcHRpb24ge1xuICBjb25zdHJ1Y3RvcihfY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpIHtcbiAgICBzdXBlcihgVW5leHBlY3RlZCBlbmQgb2YgZmlsZS5gKTtcbiAgfVxufVxuXG5cbi8qKlxuICogQ29udGV4dCBwYXNzZWQgYXJvdW5kIHRoZSBwYXJzZXIgd2l0aCBpbmZvcm1hdGlvbiBhYm91dCB3aGVyZSB3ZSBjdXJyZW50bHkgYXJlIGluIHRoZSBwYXJzZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBKc29uUGFyc2VyQ29udGV4dCB7XG4gIHBvc2l0aW9uOiBQb3NpdGlvbjtcbiAgcHJldmlvdXM6IFBvc2l0aW9uO1xuICByZWFkb25seSBvcmlnaW5hbDogc3RyaW5nO1xuICByZWFkb25seSBtb2RlOiBKc29uUGFyc2VNb2RlO1xufVxuXG5cbi8qKlxuICogUGVlayBhbmQgcmV0dXJuIHRoZSBuZXh0IGNoYXJhY3RlciBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3BlZWsoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF07XG59XG5cblxuLyoqXG4gKiBNb3ZlIHRoZSBjb250ZXh0IHRvIHRoZSBuZXh0IGNoYXJhY3RlciwgaW5jbHVkaW5nIGluY3JlbWVudGluZyB0aGUgbGluZSBpZiBuZWNlc3NhcnkuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfbmV4dChjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCkge1xuICBjb250ZXh0LnByZXZpb3VzID0gY29udGV4dC5wb3NpdGlvbjtcblxuICBsZXQge29mZnNldCwgbGluZSwgY2hhcmFjdGVyfSA9IGNvbnRleHQucG9zaXRpb247XG4gIGNvbnN0IGNoYXIgPSBjb250ZXh0Lm9yaWdpbmFsW29mZnNldF07XG4gIG9mZnNldCsrO1xuICBpZiAoY2hhciA9PSAnXFxuJykge1xuICAgIGxpbmUrKztcbiAgICBjaGFyYWN0ZXIgPSAwO1xuICB9IGVsc2Uge1xuICAgIGNoYXJhY3RlcisrO1xuICB9XG4gIGNvbnRleHQucG9zaXRpb24gPSB7b2Zmc2V0LCBsaW5lLCBjaGFyYWN0ZXJ9O1xufVxuXG5cbi8qKlxuICogUmVhZCBhIHNpbmdsZSBjaGFyYWN0ZXIgZnJvbSB0aGUgaW5wdXQuIElmIGEgYHZhbGlkYCBzdHJpbmcgaXMgcGFzc2VkLCB2YWxpZGF0ZSB0aGF0IHRoZVxuICogY2hhcmFjdGVyIGlzIGluY2x1ZGVkIGluIHRoZSB2YWxpZCBzdHJpbmcuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfdG9rZW4oY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIHZhbGlkOiBzdHJpbmcpOiBzdHJpbmc7XG5mdW5jdGlvbiBfdG9rZW4oY29udGV4dDogSnNvblBhcnNlckNvbnRleHQpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5mdW5jdGlvbiBfdG9rZW4oY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIHZhbGlkPzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgY2hhciA9IF9wZWVrKGNvbnRleHQpO1xuICBpZiAodmFsaWQpIHtcbiAgICBpZiAoIWNoYXIpIHtcbiAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHZhbGlkLmluZGV4T2YoY2hhcikgPT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICAvLyBNb3ZlIHRoZSBwb3NpdGlvbiBvZiB0aGUgY29udGV4dCB0byB0aGUgbmV4dCBjaGFyYWN0ZXIuXG4gIF9uZXh0KGNvbnRleHQpO1xuXG4gIHJldHVybiBjaGFyO1xufVxuXG5cbi8qKlxuICogUmVhZCB0aGUgZXhwb25lbnQgcGFydCBvZiBhIG51bWJlci4gVGhlIGV4cG9uZW50IHBhcnQgaXMgbG9vc2VyIGZvciBKU09OIHRoYW4gdGhlIG51bWJlclxuICogcGFydC4gYHN0cmAgaXMgdGhlIHN0cmluZyBvZiB0aGUgbnVtYmVyIGl0c2VsZiBmb3VuZCBzbyBmYXIsIGFuZCBzdGFydCB0aGUgcG9zaXRpb25cbiAqIHdoZXJlIHRoZSBmdWxsIG51bWJlciBzdGFydGVkLiBSZXR1cm5zIHRoZSBub2RlIGZvdW5kLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRFeHBOdW1iZXIoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydDogUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHI6IHN0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbW1lbnRzOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSk6IEpzb25Bc3ROdW1iZXIge1xuICBsZXQgY2hhcjtcbiAgbGV0IHNpZ25lZCA9IGZhbHNlO1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICBpZiAoY2hhciA9PSAnKycgfHwgY2hhciA9PSAnLScpIHtcbiAgICAgIGlmIChzaWduZWQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBzaWduZWQgPSB0cnVlO1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcwJyB8fCBjaGFyID09ICcxJyB8fCBjaGFyID09ICcyJyB8fCBjaGFyID09ICczJyB8fCBjaGFyID09ICc0J1xuICAgICAgICB8fCBjaGFyID09ICc1JyB8fCBjaGFyID09ICc2JyB8fCBjaGFyID09ICc3JyB8fCBjaGFyID09ICc4JyB8fCBjaGFyID09ICc5Jykge1xuICAgICAgc2lnbmVkID0gdHJ1ZTtcbiAgICAgIHN0ciArPSBjaGFyO1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBXZSdyZSBkb25lIHJlYWRpbmcgdGhpcyBudW1iZXIuXG4gIGNvbnRleHQucG9zaXRpb24gPSBjb250ZXh0LnByZXZpb3VzO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIHZhbHVlOiBOdW1iZXIucGFyc2VGbG9hdChzdHIpLFxuICAgIGNvbW1lbnRzOiBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlYWQgdGhlIGhleGEgcGFydCBvZiBhIDB4QkFEQ0FGRSBoZXhhZGVjaW1hbCBudW1iZXIuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEhleGFOdW1iZXIoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgaXNOZWdhdGl2ZTogYm9vbGVhbixcbiAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydDogUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudHM6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdKTogSnNvbkFzdE51bWJlciB7XG4gIC8vIFJlYWQgYW4gaGV4YWRlY2ltYWwgbnVtYmVyLCB1bnRpbCBpdCdzIG5vdCBoZXhhZGVjaW1hbC5cbiAgbGV0IGhleGEgPSAnJztcbiAgY29uc3QgdmFsaWQgPSAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRic7XG5cbiAgZm9yIChsZXQgY2ggPSBfcGVlayhjb250ZXh0KTsgY2ggJiYgdmFsaWQuaW5jbHVkZXMoY2gpOyBjaCA9IF9wZWVrKGNvbnRleHQpKSB7XG4gICAgLy8gQWRkIGl0IHRvIHRoZSBoZXhhIHN0cmluZy5cbiAgICBoZXhhICs9IGNoO1xuICAgIC8vIE1vdmUgdGhlIHBvc2l0aW9uIG9mIHRoZSBjb250ZXh0IHRvIHRoZSBuZXh0IGNoYXJhY3Rlci5cbiAgICBfbmV4dChjb250ZXh0KTtcbiAgfVxuXG4gIGNvbnN0IHZhbHVlID0gTnVtYmVyLnBhcnNlSW50KGhleGEsIDE2KTtcblxuICAvLyBXZSdyZSBkb25lIHJlYWRpbmcgdGhpcyBudW1iZXIuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgIHZhbHVlOiBpc05lZ2F0aXZlID8gLXZhbHVlIDogdmFsdWUsXG4gICAgY29tbWVudHMsXG4gIH07XG59XG5cbi8qKlxuICogUmVhZCBhIG51bWJlciBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWROdW1iZXIoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0TnVtYmVyIHtcbiAgbGV0IHN0ciA9ICcnO1xuICBsZXQgZG90dGVkID0gZmFsc2U7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICAvLyByZWFkIHVudGlsIGBlYCBvciBlbmQgb2YgbGluZS5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuXG4gICAgLy8gUmVhZCB0b2tlbnMsIG9uZSBieSBvbmUuXG4gICAgaWYgKGNoYXIgPT0gJy0nKSB7XG4gICAgICBpZiAoc3RyICE9ICcnKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJ0knXG4gICAgICAgICYmIChzdHIgPT0gJy0nIHx8IHN0ciA9PSAnJyB8fCBzdHIgPT0gJysnKVxuICAgICAgICAmJiAoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5OdW1iZXJDb25zdGFudHNBbGxvd2VkKSAhPSAwKSB7XG4gICAgICAvLyBJbmZpbml0eT9cbiAgICAgIC8vIF90b2tlbihjb250ZXh0LCAnSScpOyBBbHJlYWR5IHJlYWQuXG4gICAgICBfdG9rZW4oY29udGV4dCwgJ24nKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnZicpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICdpJyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ24nKTtcbiAgICAgIF90b2tlbihjb250ZXh0LCAnaScpO1xuICAgICAgX3Rva2VuKGNvbnRleHQsICd0Jyk7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJ3knKTtcblxuICAgICAgc3RyICs9ICdJbmZpbml0eSc7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJzAnKSB7XG4gICAgICBpZiAoc3RyID09ICcwJyB8fCBzdHIgPT0gJy0wJykge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcxJyB8fCBjaGFyID09ICcyJyB8fCBjaGFyID09ICczJyB8fCBjaGFyID09ICc0JyB8fCBjaGFyID09ICc1J1xuICAgICAgICB8fCBjaGFyID09ICc2JyB8fCBjaGFyID09ICc3JyB8fCBjaGFyID09ICc4JyB8fCBjaGFyID09ICc5Jykge1xuICAgICAgaWYgKHN0ciA9PSAnMCcgfHwgc3RyID09ICctMCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnKycgJiYgc3RyID09ICcnKSB7XG4gICAgICAvLyBQYXNzIG92ZXIuXG4gICAgfSBlbHNlIGlmIChjaGFyID09ICcuJykge1xuICAgICAgaWYgKGRvdHRlZCkge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICB9XG4gICAgICBkb3R0ZWQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnZScgfHwgY2hhciA9PSAnRScpIHtcbiAgICAgIHJldHVybiBfcmVhZEV4cE51bWJlcihjb250ZXh0LCBzdGFydCwgc3RyICsgY2hhciwgY29tbWVudHMpO1xuICAgIH0gZWxzZSBpZiAoY2hhciA9PSAneCcgJiYgKHN0ciA9PSAnMCcgfHwgc3RyID09ICctMCcpXG4gICAgICAgICAgICAgICAmJiAoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5IZXhhZGVjaW1hbE51bWJlckFsbG93ZWQpICE9IDApIHtcbiAgICAgIHJldHVybiBfcmVhZEhleGFOdW1iZXIoY29udGV4dCwgc3RyID09ICctMCcsIHN0YXJ0LCBjb21tZW50cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFdlIHJlYWQgb25lIHRvbyBtYW55IGNoYXJhY3RlcnMsIHNvIHJvbGxiYWNrIHRoZSBsYXN0IGNoYXJhY3Rlci5cbiAgICAgIGNvbnRleHQucG9zaXRpb24gPSBjb250ZXh0LnByZXZpb3VzO1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgc3RyICs9IGNoYXI7XG4gIH1cblxuICAvLyBXZSdyZSBkb25lIHJlYWRpbmcgdGhpcyBudW1iZXIuXG4gIGlmIChzdHIuZW5kc1dpdGgoJy4nKSAmJiAoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5IZXhhZGVjaW1hbE51bWJlckFsbG93ZWQpID09IDApIHtcbiAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICdudW1iZXInLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZTogTnVtYmVyLnBhcnNlRmxvYXQoc3RyKSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlYWQgYSBzdHJpbmcgZnJvbSB0aGUgY29udGV4dC4gVGFrZXMgdGhlIGNvbW1lbnRzIG9mIHRoZSBzdHJpbmcgb3IgcmVhZCB0aGUgYmxhbmtzIGJlZm9yZSB0aGVcbiAqIHN0cmluZy5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkU3RyaW5nKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdFN0cmluZyB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICAvLyBDb25zdW1lIHRoZSBmaXJzdCBzdHJpbmcgZGVsaW1pdGVyLlxuICBjb25zdCBkZWxpbSA9IF90b2tlbihjb250ZXh0KTtcbiAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLlNpbmdsZVF1b3Rlc0FsbG93ZWQpID09IDApIHtcbiAgICBpZiAoZGVsaW0gPT0gJ1xcJycpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9XG4gIH1cblxuICBsZXQgc3RyID0gJyc7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgbGV0IGNoYXIgPSBfdG9rZW4oY29udGV4dCk7XG4gICAgaWYgKGNoYXIgPT0gZGVsaW0pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtpbmQ6ICdzdHJpbmcnLFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kOiBjb250ZXh0LnBvc2l0aW9uLFxuICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICAgICAgdmFsdWU6IHN0cixcbiAgICAgICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKGNoYXIgPT0gJ1xcXFwnKSB7XG4gICAgICBjaGFyID0gX3Rva2VuKGNvbnRleHQpO1xuICAgICAgc3dpdGNoIChjaGFyKSB7XG4gICAgICAgIGNhc2UgJ1xcXFwnOlxuICAgICAgICBjYXNlICdcXC8nOlxuICAgICAgICBjYXNlICdcIic6XG4gICAgICAgIGNhc2UgZGVsaW06XG4gICAgICAgICAgc3RyICs9IGNoYXI7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnYic6IHN0ciArPSAnXFxiJzsgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2YnOiBzdHIgKz0gJ1xcZic7IGJyZWFrO1xuICAgICAgICBjYXNlICduJzogc3RyICs9ICdcXG4nOyBicmVhaztcbiAgICAgICAgY2FzZSAncic6IHN0ciArPSAnXFxyJzsgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3QnOiBzdHIgKz0gJ1xcdCc7IGJyZWFrO1xuICAgICAgICBjYXNlICd1JzpcbiAgICAgICAgICBjb25zdCBbYzBdID0gX3Rva2VuKGNvbnRleHQsICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJyk7XG4gICAgICAgICAgY29uc3QgW2MxXSA9IF90b2tlbihjb250ZXh0LCAnMDEyMzQ1Njc4OWFiY2RlZkFCQ0RFRicpO1xuICAgICAgICAgIGNvbnN0IFtjMl0gPSBfdG9rZW4oY29udGV4dCwgJzAxMjM0NTY3ODlhYmNkZWZBQkNERUYnKTtcbiAgICAgICAgICBjb25zdCBbYzNdID0gX3Rva2VuKGNvbnRleHQsICcwMTIzNDU2Nzg5YWJjZGVmQUJDREVGJyk7XG4gICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoYzAgKyBjMSArIGMyICsgYzMsIDE2KSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuXG4gICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAgLy8gT25seSB2YWxpZCB3aGVuIG11bHRpbGluZSBzdHJpbmdzIGFyZSBhbGxvd2VkLlxuICAgICAgICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5NdWx0aUxpbmVTdHJpbmdBbGxvd2VkKSA9PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0ciArPSBjaGFyO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2hhciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgVW5leHBlY3RlZEVuZE9mSW5wdXRFeGNlcHRpb24oY29udGV4dCk7XG4gICAgfSBlbHNlIGlmIChjaGFyID09ICdcXGInIHx8IGNoYXIgPT0gJ1xcZicgfHwgY2hhciA9PSAnXFxuJyB8fCBjaGFyID09ICdcXHInIHx8IGNoYXIgPT0gJ1xcdCcpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9IGNoYXI7XG4gICAgfVxuICB9XG59XG5cblxuLyoqXG4gKiBSZWFkIHRoZSBjb25zdGFudCBgdHJ1ZWAgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkVHJ1ZShjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdENvbnN0YW50VHJ1ZSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgX3Rva2VuKGNvbnRleHQsICd0Jyk7XG4gIF90b2tlbihjb250ZXh0LCAncicpO1xuICBfdG9rZW4oY29udGV4dCwgJ3UnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdlJyk7XG5cbiAgY29uc3QgZW5kID0gY29udGV4dC5wb3NpdGlvbjtcblxuICByZXR1cm4ge1xuICAgIGtpbmQ6ICd0cnVlJyxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICB2YWx1ZTogdHJ1ZSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGBmYWxzZWAgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkRmFsc2UoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0Q29uc3RhbnRGYWxzZSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcbiAgX3Rva2VuKGNvbnRleHQsICdmJyk7XG4gIF90b2tlbihjb250ZXh0LCAnYScpO1xuICBfdG9rZW4oY29udGV4dCwgJ2wnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdzJyk7XG4gIF90b2tlbihjb250ZXh0LCAnZScpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnZmFsc2UnLFxuICAgIHN0YXJ0LFxuICAgIGVuZCxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpLFxuICAgIHZhbHVlOiBmYWxzZSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlYWQgdGhlIGNvbnN0YW50IGBudWxsYCBmcm9tIHRoZSBjb250ZXh0LlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWROdWxsKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICAgICAgICAgICAgICAgICAgIGNvbW1lbnRzID0gX3JlYWRCbGFua3MoY29udGV4dCkpOiBKc29uQXN0Q29uc3RhbnROdWxsIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIF90b2tlbihjb250ZXh0LCAnbicpO1xuICBfdG9rZW4oY29udGV4dCwgJ3UnKTtcbiAgX3Rva2VuKGNvbnRleHQsICdsJyk7XG4gIF90b2tlbihjb250ZXh0LCAnbCcpO1xuXG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnbnVsbCcsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IG51bGwsXG4gICAgY29tbWVudHM6IGNvbW1lbnRzLFxuICB9O1xufVxuXG5cbi8qKlxuICogUmVhZCB0aGUgY29uc3RhbnQgYE5hTmAgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkTmFOKGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICAgICAgICAgICAgICAgICAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3ROdW1iZXIge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgX3Rva2VuKGNvbnRleHQsICdOJyk7XG4gIF90b2tlbihjb250ZXh0LCAnYScpO1xuICBfdG9rZW4oY29udGV4dCwgJ04nKTtcblxuICBjb25zdCBlbmQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIHJldHVybiB7XG4gICAga2luZDogJ251bWJlcicsXG4gICAgc3RhcnQsXG4gICAgZW5kLFxuICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyaW5nKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCksXG4gICAgdmFsdWU6IE5hTixcbiAgICBjb21tZW50czogY29tbWVudHMsXG4gIH07XG59XG5cblxuLyoqXG4gKiBSZWFkIGFuIGFycmF5IG9mIEpTT04gdmFsdWVzIGZyb20gdGhlIGNvbnRleHQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEFycmF5KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LCBjb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpKTogSnNvbkFzdEFycmF5IHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIC8vIENvbnN1bWUgdGhlIGZpcnN0IGRlbGltaXRlci5cbiAgX3Rva2VuKGNvbnRleHQsICdbJyk7XG4gIGNvbnN0IHZhbHVlOiBKc29uQXJyYXkgPSBbXTtcbiAgY29uc3QgZWxlbWVudHM6IEpzb25Bc3ROb2RlW10gPSBbXTtcblxuICBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgaWYgKF9wZWVrKGNvbnRleHQpICE9ICddJykge1xuICAgIGNvbnN0IG5vZGUgPSBfcmVhZFZhbHVlKGNvbnRleHQpO1xuICAgIGVsZW1lbnRzLnB1c2gobm9kZSk7XG4gICAgdmFsdWUucHVzaChub2RlLnZhbHVlKTtcbiAgfVxuXG4gIHdoaWxlIChfcGVlayhjb250ZXh0KSAhPSAnXScpIHtcbiAgICBfdG9rZW4oY29udGV4dCwgJywnKTtcblxuICAgIGNvbnN0IHZhbHVlQ29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KTtcbiAgICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuVHJhaWxpbmdDb21tYXNBbGxvd2VkKSAhPT0gMCAmJiBfcGVlayhjb250ZXh0KSA9PT0gJ10nKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3Qgbm9kZSA9IF9yZWFkVmFsdWUoY29udGV4dCwgdmFsdWVDb21tZW50cyk7XG4gICAgZWxlbWVudHMucHVzaChub2RlKTtcbiAgICB2YWx1ZS5wdXNoKG5vZGUudmFsdWUpO1xuICB9XG5cbiAgX3Rva2VuKGNvbnRleHQsICddJyk7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnYXJyYXknLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICB2YWx1ZSxcbiAgICBlbGVtZW50cyxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlYWQgYW4gaWRlbnRpZmllciBmcm9tIHRoZSBjb250ZXh0LiBBbiBpZGVudGlmaWVyIGlzIGEgdmFsaWQgSmF2YVNjcmlwdCBpZGVudGlmaWVyLCBhbmQgdGhpc1xuICogZnVuY3Rpb24gaXMgb25seSB1c2VkIGluIExvb3NlIG1vZGUuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZElkZW50aWZpZXIoY29udGV4dDogSnNvblBhcnNlckNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RJZGVudGlmaWVyIHtcbiAgY29uc3Qgc3RhcnQgPSBjb250ZXh0LnBvc2l0aW9uO1xuXG4gIGxldCBjaGFyID0gX3BlZWsoY29udGV4dCk7XG4gIGlmIChjaGFyICYmICcwMTIzNDU2Nzg5Jy5pbmRleE9mKGNoYXIpICE9IC0xKSB7XG4gICAgY29uc3QgaWRlbnRpZmllck5vZGUgPSBfcmVhZE51bWJlcihjb250ZXh0KTtcblxuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnaWRlbnRpZmllcicsXG4gICAgICBzdGFydCxcbiAgICAgIGVuZDogaWRlbnRpZmllck5vZGUuZW5kLFxuICAgICAgdGV4dDogaWRlbnRpZmllck5vZGUudGV4dCxcbiAgICAgIHZhbHVlOiBpZGVudGlmaWVyTm9kZS52YWx1ZS50b1N0cmluZygpLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBpZGVudFZhbGlkRmlyc3RDaGFyID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU9QUVJTVFVWV1hZWic7XG4gIGNvbnN0IGlkZW50VmFsaWRDaGFyID0gJ18kYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNT1BRUlNUVVZXWFlaMDEyMzQ1Njc4OSc7XG4gIGxldCBmaXJzdCA9IHRydWU7XG4gIGxldCB2YWx1ZSA9ICcnO1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY2hhciA9IF90b2tlbihjb250ZXh0KTtcbiAgICBpZiAoY2hhciA9PSB1bmRlZmluZWRcbiAgICAgICAgfHwgKGZpcnN0ID8gaWRlbnRWYWxpZEZpcnN0Q2hhci5pbmRleE9mKGNoYXIpIDogaWRlbnRWYWxpZENoYXIuaW5kZXhPZihjaGFyKSkgPT0gLTEpIHtcbiAgICAgIGNvbnRleHQucG9zaXRpb24gPSBjb250ZXh0LnByZXZpb3VzO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiAnaWRlbnRpZmllcicsXG4gICAgICAgIHN0YXJ0LFxuICAgICAgICBlbmQ6IGNvbnRleHQucG9zaXRpb24sXG4gICAgICAgIHRleHQ6IGNvbnRleHQub3JpZ2luYWwuc3Vic3RyKHN0YXJ0Lm9mZnNldCwgY29udGV4dC5wb3NpdGlvbi5vZmZzZXQpLFxuICAgICAgICB2YWx1ZSxcbiAgICAgICAgY29tbWVudHMsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHZhbHVlICs9IGNoYXI7XG4gICAgZmlyc3QgPSBmYWxzZTtcbiAgfVxufVxuXG5cbi8qKlxuICogUmVhZCBhIHByb3BlcnR5IGZyb20gdGhlIGNvbnRleHQuIEEgcHJvcGVydHkgaXMgYSBzdHJpbmcgb3IgKGluIExvb3NlIG1vZGUgb25seSkgYSBudW1iZXIgb3JcbiAqIGFuIGlkZW50aWZpZXIsIGZvbGxvd2VkIGJ5IGEgY29sb24gYDpgLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRQcm9wZXJ0eShjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RLZXlWYWx1ZSB7XG4gIGNvbnN0IHN0YXJ0ID0gY29udGV4dC5wb3NpdGlvbjtcblxuICBsZXQga2V5O1xuICBpZiAoKGNvbnRleHQubW9kZSAmIEpzb25QYXJzZU1vZGUuSWRlbnRpZmllcktleU5hbWVzQWxsb3dlZCkgIT0gMCkge1xuICAgIGNvbnN0IHRvcCA9IF9wZWVrKGNvbnRleHQpO1xuICAgIGlmICh0b3AgPT0gJ1wiJyB8fCB0b3AgPT0gJ1xcJycpIHtcbiAgICAgIGtleSA9IF9yZWFkU3RyaW5nKGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBrZXkgPSBfcmVhZElkZW50aWZpZXIoY29udGV4dCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGtleSA9IF9yZWFkU3RyaW5nKGNvbnRleHQpO1xuICB9XG5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG4gIF90b2tlbihjb250ZXh0LCAnOicpO1xuICBjb25zdCB2YWx1ZSA9IF9yZWFkVmFsdWUoY29udGV4dCk7XG4gIGNvbnN0IGVuZCA9IGNvbnRleHQucG9zaXRpb247XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAna2V5dmFsdWUnLFxuICAgIGtleSxcbiAgICB2YWx1ZSxcbiAgICBzdGFydCxcbiAgICBlbmQsXG4gICAgdGV4dDogY29udGV4dC5vcmlnaW5hbC5zdWJzdHJpbmcoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlYWQgYW4gb2JqZWN0IG9mIHByb3BlcnRpZXMgLT4gSlNPTiB2YWx1ZXMgZnJvbSB0aGUgY29udGV4dC5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIF9yZWFkT2JqZWN0KGNvbnRleHQ6IEpzb25QYXJzZXJDb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3RPYmplY3Qge1xuICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gIC8vIENvbnN1bWUgdGhlIGZpcnN0IGRlbGltaXRlci5cbiAgX3Rva2VuKGNvbnRleHQsICd7Jyk7XG4gIGNvbnN0IHZhbHVlOiBKc29uT2JqZWN0ID0ge307XG4gIGNvbnN0IHByb3BlcnRpZXM6IEpzb25Bc3RLZXlWYWx1ZVtdID0gW107XG5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG4gIGlmIChfcGVlayhjb250ZXh0KSAhPSAnfScpIHtcbiAgICBjb25zdCBwcm9wZXJ0eSA9IF9yZWFkUHJvcGVydHkoY29udGV4dCk7XG4gICAgdmFsdWVbcHJvcGVydHkua2V5LnZhbHVlXSA9IHByb3BlcnR5LnZhbHVlLnZhbHVlO1xuICAgIHByb3BlcnRpZXMucHVzaChwcm9wZXJ0eSk7XG5cbiAgICB3aGlsZSAoX3BlZWsoY29udGV4dCkgIT0gJ30nKSB7XG4gICAgICBfdG9rZW4oY29udGV4dCwgJywnKTtcblxuICAgICAgY29uc3QgcHJvcGVydHlDb21tZW50cyA9IF9yZWFkQmxhbmtzKGNvbnRleHQpO1xuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLlRyYWlsaW5nQ29tbWFzQWxsb3dlZCkgIT09IDAgJiYgX3BlZWsoY29udGV4dCkgPT09ICd9Jykge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNvbnN0IHByb3BlcnR5ID0gX3JlYWRQcm9wZXJ0eShjb250ZXh0LCBwcm9wZXJ0eUNvbW1lbnRzKTtcbiAgICAgIHZhbHVlW3Byb3BlcnR5LmtleS52YWx1ZV0gPSBwcm9wZXJ0eS52YWx1ZS52YWx1ZTtcbiAgICAgIHByb3BlcnRpZXMucHVzaChwcm9wZXJ0eSk7XG4gICAgfVxuICB9XG5cbiAgX3Rva2VuKGNvbnRleHQsICd9Jyk7XG5cbiAgcmV0dXJuIHtcbiAgICBraW5kOiAnb2JqZWN0JyxcbiAgICBwcm9wZXJ0aWVzLFxuICAgIHN0YXJ0LFxuICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICB2YWx1ZSxcbiAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICBjb21tZW50cyxcbiAgfTtcbn1cblxuXG4vKipcbiAqIFJlbW92ZSBhbnkgYmxhbmsgY2hhcmFjdGVyIG9yIGNvbW1lbnRzIChpbiBMb29zZSBtb2RlKSBmcm9tIHRoZSBjb250ZXh0LCByZXR1cm5pbmcgYW4gYXJyYXlcbiAqIG9mIGNvbW1lbnRzIGlmIGFueSBhcmUgZm91bmQuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfcmVhZEJsYW5rcyhjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCk6IChKc29uQXN0Q29tbWVudCB8IEpzb25Bc3RNdWx0aWxpbmVDb21tZW50KVtdIHtcbiAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkNvbW1lbnRzQWxsb3dlZCkgIT0gMCkge1xuICAgIGNvbnN0IGNvbW1lbnRzOiAoSnNvbkFzdENvbW1lbnQgfCBKc29uQXN0TXVsdGlsaW5lQ29tbWVudClbXSA9IFtdO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBjaGFyID0gY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldF07XG4gICAgICBpZiAoY2hhciA9PSAnLycgJiYgY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldCArIDFdID09ICcqJykge1xuICAgICAgICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gICAgICAgIC8vIE11bHRpIGxpbmUgY29tbWVudC5cbiAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuXG4gICAgICAgIHdoaWxlIChjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XSAhPSAnKidcbiAgICAgICAgICAgIHx8IGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgKyAxXSAhPSAnLycpIHtcbiAgICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgICAgICBpZiAoY29udGV4dC5wb3NpdGlvbi5vZmZzZXQgPj0gY29udGV4dC5vcmlnaW5hbC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBVbmV4cGVjdGVkRW5kT2ZJbnB1dEV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVtb3ZlIFwiKi9cIi5cbiAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuXG4gICAgICAgIGNvbW1lbnRzLnB1c2goe1xuICAgICAgICAgIGtpbmQ6ICdtdWx0aWNvbW1lbnQnLFxuICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICAgICAgICBjb250ZW50OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQgKyAyLCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCAtIDIpLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnLycgJiYgY29udGV4dC5vcmlnaW5hbFtjb250ZXh0LnBvc2l0aW9uLm9mZnNldCArIDFdID09ICcvJykge1xuICAgICAgICBjb25zdCBzdGFydCA9IGNvbnRleHQucG9zaXRpb247XG4gICAgICAgIC8vIE11bHRpIGxpbmUgY29tbWVudC5cbiAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIF9uZXh0KGNvbnRleHQpO1xuXG4gICAgICAgIHdoaWxlIChjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XSAhPSAnXFxuJykge1xuICAgICAgICAgIF9uZXh0KGNvbnRleHQpO1xuICAgICAgICAgIGlmIChjb250ZXh0LnBvc2l0aW9uLm9mZnNldCA+PSBjb250ZXh0Lm9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIFwiXFxuXCIuXG4gICAgICAgIGlmIChjb250ZXh0LnBvc2l0aW9uLm9mZnNldCA8IGNvbnRleHQub3JpZ2luYWwubGVuZ3RoKSB7XG4gICAgICAgICAgX25leHQoY29udGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgY29tbWVudHMucHVzaCh7XG4gICAgICAgICAga2luZDogJ2NvbW1lbnQnLFxuICAgICAgICAgIHN0YXJ0LFxuICAgICAgICAgIGVuZDogY29udGV4dC5wb3NpdGlvbixcbiAgICAgICAgICB0ZXh0OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQsIGNvbnRleHQucG9zaXRpb24ub2Zmc2V0KSxcbiAgICAgICAgICBjb250ZW50OiBjb250ZXh0Lm9yaWdpbmFsLnN1YnN0cmluZyhzdGFydC5vZmZzZXQgKyAyLCBjb250ZXh0LnBvc2l0aW9uLm9mZnNldCAtIDEpLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoY2hhciA9PSAnICcgfHwgY2hhciA9PSAnXFx0JyB8fCBjaGFyID09ICdcXG4nIHx8IGNoYXIgPT0gJ1xccicgfHwgY2hhciA9PSAnXFxmJykge1xuICAgICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjb21tZW50cztcbiAgfSBlbHNlIHtcbiAgICBsZXQgY2hhciA9IGNvbnRleHQub3JpZ2luYWxbY29udGV4dC5wb3NpdGlvbi5vZmZzZXRdO1xuICAgIHdoaWxlIChjaGFyID09ICcgJyB8fCBjaGFyID09ICdcXHQnIHx8IGNoYXIgPT0gJ1xcbicgfHwgY2hhciA9PSAnXFxyJyB8fCBjaGFyID09ICdcXGYnKSB7XG4gICAgICBfbmV4dChjb250ZXh0KTtcbiAgICAgIGNoYXIgPSBjb250ZXh0Lm9yaWdpbmFsW2NvbnRleHQucG9zaXRpb24ub2Zmc2V0XTtcbiAgICB9XG5cbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuXG4vKipcbiAqIFJlYWQgYSBKU09OIHZhbHVlIGZyb20gdGhlIGNvbnRleHQsIHdoaWNoIGNhbiBiZSBhbnkgZm9ybSBvZiBKU09OIHZhbHVlLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gX3JlYWRWYWx1ZShjb250ZXh0OiBKc29uUGFyc2VyQ29udGV4dCwgY29tbWVudHMgPSBfcmVhZEJsYW5rcyhjb250ZXh0KSk6IEpzb25Bc3ROb2RlIHtcbiAgbGV0IHJlc3VsdDogSnNvbkFzdE5vZGU7XG5cbiAgLy8gQ2xlYW4gdXAgYmVmb3JlLlxuICBjb25zdCBjaGFyID0gX3BlZWsoY29udGV4dCk7XG4gIHN3aXRjaCAoY2hhcikge1xuICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRFbmRPZklucHV0RXhjZXB0aW9uKGNvbnRleHQpO1xuXG4gICAgY2FzZSAnLSc6XG4gICAgY2FzZSAnMCc6XG4gICAgY2FzZSAnMSc6XG4gICAgY2FzZSAnMic6XG4gICAgY2FzZSAnMyc6XG4gICAgY2FzZSAnNCc6XG4gICAgY2FzZSAnNSc6XG4gICAgY2FzZSAnNic6XG4gICAgY2FzZSAnNyc6XG4gICAgY2FzZSAnOCc6XG4gICAgY2FzZSAnOSc6XG4gICAgICByZXN1bHQgPSBfcmVhZE51bWJlcihjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJy4nOlxuICAgIGNhc2UgJysnOlxuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLkxheE51bWJlclBhcnNpbmdBbGxvd2VkKSA9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IF9yZWFkTnVtYmVyKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnXFwnJzpcbiAgICBjYXNlICdcIic6XG4gICAgICByZXN1bHQgPSBfcmVhZFN0cmluZyhjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ0knOlxuICAgICAgaWYgKChjb250ZXh0Lm1vZGUgJiBKc29uUGFyc2VNb2RlLk51bWJlckNvbnN0YW50c0FsbG93ZWQpID09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRKc29uQ2hhcmFjdGVyRXhjZXB0aW9uKGNvbnRleHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gX3JlYWROdW1iZXIoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdOJzpcbiAgICAgIGlmICgoY29udGV4dC5tb2RlICYgSnNvblBhcnNlTW9kZS5OdW1iZXJDb25zdGFudHNBbGxvd2VkKSA9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSnNvbkNoYXJhY3RlckV4Y2VwdGlvbihjb250ZXh0KTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IF9yZWFkTmFOKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAndCc6XG4gICAgICByZXN1bHQgPSBfcmVhZFRydWUoY29udGV4dCwgY29tbWVudHMpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZic6XG4gICAgICByZXN1bHQgPSBfcmVhZEZhbHNlKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ24nOlxuICAgICAgcmVzdWx0ID0gX3JlYWROdWxsKGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnWyc6XG4gICAgICByZXN1bHQgPSBfcmVhZEFycmF5KGNvbnRleHQsIGNvbW1lbnRzKTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAneyc6XG4gICAgICByZXN1bHQgPSBfcmVhZE9iamVjdChjb250ZXh0LCBjb21tZW50cyk7XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZEpzb25DaGFyYWN0ZXJFeGNlcHRpb24oY29udGV4dCk7XG4gIH1cblxuICAvLyBDbGVhbiB1cCBhZnRlci5cbiAgX3JlYWRCbGFua3MoY29udGV4dCk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG4vKipcbiAqIFRoZSBQYXJzZSBtb2RlIHVzZWQgZm9yIHBhcnNpbmcgdGhlIEpTT04gc3RyaW5nLlxuICovXG5leHBvcnQgZW51bSBKc29uUGFyc2VNb2RlIHtcbiAgU3RyaWN0ICAgICAgICAgICAgICAgICAgICA9ICAgICAgMCwgIC8vIFN0YW5kYXJkIEpTT04uXG4gIENvbW1lbnRzQWxsb3dlZCAgICAgICAgICAgPSAxIDw8IDAsICAvLyBBbGxvd3MgY29tbWVudHMsIGJvdGggc2luZ2xlIG9yIG11bHRpIGxpbmVzLlxuICBTaW5nbGVRdW90ZXNBbGxvd2VkICAgICAgID0gMSA8PCAxLCAgLy8gQWxsb3cgc2luZ2xlIHF1b3RlZCBzdHJpbmdzLlxuICBJZGVudGlmaWVyS2V5TmFtZXNBbGxvd2VkID0gMSA8PCAyLCAgLy8gQWxsb3cgaWRlbnRpZmllcnMgYXMgb2JqZWN0cCBwcm9wZXJ0aWVzLlxuICBUcmFpbGluZ0NvbW1hc0FsbG93ZWQgICAgID0gMSA8PCAzLFxuICBIZXhhZGVjaW1hbE51bWJlckFsbG93ZWQgID0gMSA8PCA0LFxuICBNdWx0aUxpbmVTdHJpbmdBbGxvd2VkICAgID0gMSA8PCA1LFxuICBMYXhOdW1iZXJQYXJzaW5nQWxsb3dlZCAgID0gMSA8PCA2LCAgLy8gQWxsb3cgYC5gIG9yIGArYCBhcyB0aGUgZmlyc3QgY2hhcmFjdGVyIG9mIGEgbnVtYmVyLlxuICBOdW1iZXJDb25zdGFudHNBbGxvd2VkICAgID0gMSA8PCA3LCAgLy8gQWxsb3cgLUluZmluaXR5LCBJbmZpbml0eSBhbmQgTmFOLlxuXG4gIERlZmF1bHQgICAgICAgICAgICAgICAgICAgPSBTdHJpY3QsXG4gIExvb3NlICAgICAgICAgICAgICAgICAgICAgPSBDb21tZW50c0FsbG93ZWQgfCBTaW5nbGVRdW90ZXNBbGxvd2VkIHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIElkZW50aWZpZXJLZXlOYW1lc0FsbG93ZWQgfCBUcmFpbGluZ0NvbW1hc0FsbG93ZWQgfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSGV4YWRlY2ltYWxOdW1iZXJBbGxvd2VkIHwgTXVsdGlMaW5lU3RyaW5nQWxsb3dlZCB8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBMYXhOdW1iZXJQYXJzaW5nQWxsb3dlZCB8IE51bWJlckNvbnN0YW50c0FsbG93ZWQsXG5cbiAgSnNvbiAgICAgICAgICAgICAgICAgICAgICA9IFN0cmljdCxcbiAgSnNvbjUgICAgICAgICAgICAgICAgICAgICA9IExvb3NlLFxufVxuXG5cbi8qKlxuICogUGFyc2UgdGhlIEpTT04gc3RyaW5nIGFuZCByZXR1cm4gaXRzIEFTVC4gVGhlIEFTVCBtYXkgYmUgbG9zaW5nIGRhdGEgKGVuZCBjb21tZW50cyBhcmVcbiAqIGRpc2NhcmRlZCBmb3IgZXhhbXBsZSwgYW5kIHNwYWNlIGNoYXJhY3RlcnMgYXJlIG5vdCByZXByZXNlbnRlZCBpbiB0aGUgQVNUKSwgYnV0IGFsbCB2YWx1ZXNcbiAqIHdpbGwgaGF2ZSBhIHNpbmdsZSBub2RlIGluIHRoZSBBU1QgKGEgMS10by0xIG1hcHBpbmcpLlxuICogQHBhcmFtIGlucHV0IFRoZSBzdHJpbmcgdG8gdXNlLlxuICogQHBhcmFtIG1vZGUgVGhlIG1vZGUgdG8gcGFyc2UgdGhlIGlucHV0IHdpdGguIHtAc2VlIEpzb25QYXJzZU1vZGV9LlxuICogQHJldHVybnMge0pzb25Bc3ROb2RlfSBUaGUgcm9vdCBub2RlIG9mIHRoZSB2YWx1ZSBvZiB0aGUgQVNULlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKc29uQXN0KGlucHV0OiBzdHJpbmcsIG1vZGUgPSBKc29uUGFyc2VNb2RlLkRlZmF1bHQpOiBKc29uQXN0Tm9kZSB7XG4gIGlmIChtb2RlID09IEpzb25QYXJzZU1vZGUuRGVmYXVsdCkge1xuICAgIG1vZGUgPSBKc29uUGFyc2VNb2RlLlN0cmljdDtcbiAgfVxuXG4gIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgcG9zaXRpb246IHsgb2Zmc2V0OiAwLCBsaW5lOiAwLCBjaGFyYWN0ZXI6IDAgfSxcbiAgICBwcmV2aW91czogeyBvZmZzZXQ6IDAsIGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9LFxuICAgIG9yaWdpbmFsOiBpbnB1dCxcbiAgICBjb21tZW50czogdW5kZWZpbmVkLFxuICAgIG1vZGUsXG4gIH07XG5cbiAgY29uc3QgYXN0ID0gX3JlYWRWYWx1ZShjb250ZXh0KTtcbiAgaWYgKGNvbnRleHQucG9zaXRpb24ub2Zmc2V0IDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgY29uc3QgcmVzdCA9IGlucHV0LnN1YnN0cihjb250ZXh0LnBvc2l0aW9uLm9mZnNldCk7XG4gICAgY29uc3QgaSA9IHJlc3QubGVuZ3RoID4gMjAgPyByZXN0LnN1YnN0cigwLCAyMCkgKyAnLi4uJyA6IHJlc3Q7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBlbmQgb2YgZmlsZSwgZ290IFwiJHtpfVwiIGF0IGBcbiAgICAgICAgKyBgJHtjb250ZXh0LnBvc2l0aW9uLmxpbmV9OiR7Y29udGV4dC5wb3NpdGlvbi5jaGFyYWN0ZXJ9LmApO1xuICB9XG5cbiAgcmV0dXJuIGFzdDtcbn1cblxuXG4vKipcbiAqIFBhcnNlIGEgSlNPTiBzdHJpbmcgaW50byBpdHMgdmFsdWUuICBUaGlzIGRpc2NhcmRzIHRoZSBBU1QgYW5kIG9ubHkgcmV0dXJucyB0aGUgdmFsdWUgaXRzZWxmLlxuICogQHBhcmFtIGlucHV0IFRoZSBzdHJpbmcgdG8gcGFyc2UuXG4gKiBAcGFyYW0gbW9kZSBUaGUgbW9kZSB0byBwYXJzZSB0aGUgaW5wdXQgd2l0aC4ge0BzZWUgSnNvblBhcnNlTW9kZX0uXG4gKiBAcmV0dXJucyB7SnNvblZhbHVlfSBUaGUgdmFsdWUgcmVwcmVzZW50ZWQgYnkgdGhlIEpTT04gc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VKc29uKGlucHV0OiBzdHJpbmcsIG1vZGUgPSBKc29uUGFyc2VNb2RlLkRlZmF1bHQpOiBKc29uVmFsdWUge1xuICAvLyBUcnkgcGFyc2luZyBmb3IgdGhlIGZhc3Rlc3QgcGF0aCBhdmFpbGFibGUsIGlmIGVycm9yLCB1c2VzIG91ciBvd24gcGFyc2VyIGZvciBiZXR0ZXIgZXJyb3JzLlxuICBpZiAobW9kZSA9PSBKc29uUGFyc2VNb2RlLlN0cmljdCkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShpbnB1dCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gcGFyc2VKc29uQXN0KGlucHV0LCBtb2RlKS52YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFyc2VKc29uQXN0KGlucHV0LCBtb2RlKS52YWx1ZTtcbn1cbiJdfQ==