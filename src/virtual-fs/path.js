"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.path = exports.NormalizedRoot = exports.NormalizedSep = exports.PathCannotBeFragmentException = exports.PathMustBeAbsoluteException = exports.InvalidPathException = void 0;
exports.split = split;
exports.extname = extname;
exports.basename = basename;
exports.dirname = dirname;
exports.join = join;
exports.isAbsolute = isAbsolute;
exports.relative = relative;
exports.resolve = resolve;
exports.fragment = fragment;
exports.resetNormalizeCache = resetNormalizeCache;
exports.normalize = normalize;
exports.noCacheNormalize = noCacheNormalize;
exports.asWindowsPath = asWindowsPath;
exports.asPosixPath = asPosixPath;
exports.getSystemPath = getSystemPath;
const exception_1 = require("../exception");
class InvalidPathException extends exception_1.BaseException {
    constructor(path) {
        super(`Path ${JSON.stringify(path)} is invalid.`);
    }
}
exports.InvalidPathException = InvalidPathException;
class PathMustBeAbsoluteException extends exception_1.BaseException {
    constructor(path) {
        super(`Path ${JSON.stringify(path)} must be absolute.`);
    }
}
exports.PathMustBeAbsoluteException = PathMustBeAbsoluteException;
class PathCannotBeFragmentException extends exception_1.BaseException {
    constructor(path) {
        super(`Path ${JSON.stringify(path)} cannot be made a fragment.`);
    }
}
exports.PathCannotBeFragmentException = PathCannotBeFragmentException;
/**
 * The Separator for normalized path.
 */
exports.NormalizedSep = '/';
/**
 * The root of a normalized path.
 */
exports.NormalizedRoot = exports.NormalizedSep;
/**
 * Split a path into multiple path fragments. Each fragments except the last one will end with
 * a path separator.
 * @param {Path} path The path to split.
 * @returns {Path[]} An array of path fragments.
 */
function split(path) {
    const fragments = path.split(exports.NormalizedSep).map((x) => fragment(x));
    if (fragments[fragments.length - 1].length === 0) {
        fragments.pop();
    }
    return fragments;
}
/**
 *
 */
function extname(path) {
    const base = basename(path);
    const i = base.lastIndexOf('.');
    if (i < 1) {
        return '';
    }
    else {
        return base.slice(i);
    }
}
/**
 * Return the basename of the path, as a Path. See path.basename
 */
function basename(path) {
    const i = path.lastIndexOf(exports.NormalizedSep);
    if (i == -1) {
        return fragment(path);
    }
    else {
        return fragment(path.slice(path.lastIndexOf(exports.NormalizedSep) + 1));
    }
}
/**
 * Return the dirname of the path, as a Path. See path.dirname
 */
function dirname(path) {
    const index = path.lastIndexOf(exports.NormalizedSep);
    if (index === -1) {
        return '';
    }
    const endIndex = index === 0 ? 1 : index; // case of file under root: '/file'
    return normalize(path.slice(0, endIndex));
}
/**
 * Join multiple paths together, and normalize the result. Accepts strings that will be
 * normalized as well (but the original must be a path).
 */
function join(p1, ...others) {
    if (others.length > 0) {
        return normalize((p1 ? p1 + exports.NormalizedSep : '') + others.join(exports.NormalizedSep));
    }
    else {
        return p1;
    }
}
/**
 * Returns true if a path is absolute.
 */
function isAbsolute(p) {
    return p.startsWith(exports.NormalizedSep);
}
/**
 * Returns a path such that `join(from, relative(from, to)) == to`.
 * Both paths must be absolute, otherwise it does not make much sense.
 */
function relative(from, to) {
    if (!isAbsolute(from)) {
        throw new PathMustBeAbsoluteException(from);
    }
    if (!isAbsolute(to)) {
        throw new PathMustBeAbsoluteException(to);
    }
    let p;
    if (from == to) {
        p = '';
    }
    else {
        const splitFrom = split(from);
        const splitTo = split(to);
        while (splitFrom.length > 0 && splitTo.length > 0 && splitFrom[0] == splitTo[0]) {
            splitFrom.shift();
            splitTo.shift();
        }
        if (splitFrom.length == 0) {
            p = splitTo.join(exports.NormalizedSep);
        }
        else {
            p = splitFrom
                .map(() => '..')
                .concat(splitTo)
                .join(exports.NormalizedSep);
        }
    }
    return normalize(p);
}
/**
 * Returns a Path that is the resolution of p2, from p1. If p2 is absolute, it will return p2,
 * otherwise will join both p1 and p2.
 */
function resolve(p1, p2) {
    if (isAbsolute(p2)) {
        return p2;
    }
    else {
        return join(p1, p2);
    }
}
function fragment(path) {
    if (path.indexOf(exports.NormalizedSep) != -1) {
        throw new PathCannotBeFragmentException(path);
    }
    return path;
}
/**
 * normalize() cache to reduce computation. For now this grows and we never flush it, but in the
 * future we might want to add a few cache flush to prevent this from growing too large.
 */
let normalizedCache = new Map();
/**
 * Reset the cache. This is only useful for testing.
 * @private
 */
function resetNormalizeCache() {
    normalizedCache = new Map();
}
/**
 * Normalize a string into a Path. This is the only mean to get a Path type from a string that
 * represents a system path. This method cache the results as real world paths tend to be
 * duplicated often.
 * Normalization includes:
 *   - Windows backslashes `\\` are replaced with `/`.
 *   - Windows drivers are replaced with `/X/`, where X is the drive letter.
 *   - Absolute paths starts with `/`.
 *   - Multiple `/` are replaced by a single one.
 *   - Path segments `.` are removed.
 *   - Path segments `..` are resolved.
 *   - If a path is absolute, having a `..` at the start is invalid (and will throw).
 * @param path The path to be normalized.
 */
function normalize(path) {
    let maybePath = normalizedCache.get(path);
    if (!maybePath) {
        maybePath = noCacheNormalize(path);
        normalizedCache.set(path, maybePath);
    }
    return maybePath;
}
/**
 * The no cache version of the normalize() function. Used for benchmarking and testing.
 */
function noCacheNormalize(path) {
    if (path == '' || path == '.') {
        return '';
    }
    else if (path == exports.NormalizedRoot) {
        return exports.NormalizedRoot;
    }
    // Match absolute windows path.
    const original = path;
    if (path.match(/^[A-Z]:[/\\]/i)) {
        path = '\\' + path[0].toUpperCase() + '\\' + path.slice(3);
    }
    // We convert Windows paths as well here.
    const p = path.split(/[/\\]/g);
    let relative = false;
    let i = 1;
    // Special case the first one.
    if (p[0] != '') {
        p.unshift('.');
        relative = true;
    }
    while (i < p.length) {
        if (p[i] == '.') {
            p.splice(i, 1);
        }
        else if (p[i] == '..') {
            if (i < 2 && !relative) {
                throw new InvalidPathException(original);
            }
            else if (i >= 2 && p[i - 1] != '..') {
                p.splice(i - 1, 2);
                i--;
            }
            else {
                i++;
            }
        }
        else if (p[i] == '') {
            p.splice(i, 1);
        }
        else {
            i++;
        }
    }
    if (p.length == 1) {
        return p[0] == '' ? exports.NormalizedSep : '';
    }
    else {
        if (p[0] == '.') {
            p.shift();
        }
        return p.join(exports.NormalizedSep);
    }
}
const path = (strings, ...values) => {
    return normalize(String.raw(strings, ...values));
};
exports.path = path;
function asWindowsPath(path) {
    const drive = path.match(/^\/(\w)(?:\/(.*))?$/);
    if (drive) {
        const subPath = drive[2] ? drive[2].replace(/\//g, '\\') : '';
        return `${drive[1]}:\\${subPath}`;
    }
    return path.replace(/\//g, '\\');
}
function asPosixPath(path) {
    return path;
}
function getSystemPath(path) {
    if (process.platform.startsWith('win32')) {
        return asWindowsPath(path);
    }
    else {
        return asPosixPath(path);
    }
}
