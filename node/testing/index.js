"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TempScopedNodeJsSyncHost = void 0;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const src_1 = require("../../src");
const host_1 = require("../host");
/**
 * A Sync Scoped Host that creates a temporary directory and scope to it.
 */
class TempScopedNodeJsSyncHost extends src_1.virtualFs.ScopedHost {
    _sync;
    _root;
    constructor() {
        const root = (0, src_1.normalize)(path.join(os.tmpdir(), `devkit-host-${crypto.randomUUID()}-${process.pid}`));
        fs.mkdirSync((0, src_1.getSystemPath)(root));
        super(new host_1.NodeJsSyncHost(), root);
        this._root = root;
    }
    get files() {
        const sync = this.sync;
        function _visit(p) {
            return sync
                .list(p)
                .map((fragment) => (0, src_1.join)(p, fragment))
                .reduce((files, path) => {
                if (sync.isDirectory(path)) {
                    return files.concat(_visit(path));
                }
                else {
                    return files.concat(path);
                }
            }, []);
        }
        return _visit((0, src_1.normalize)('/'));
    }
    get root() {
        return this._root;
    }
    get sync() {
        if (!this._sync) {
            this._sync = new src_1.virtualFs.SyncDelegateHost(this);
        }
        return this._sync;
    }
}
exports.TempScopedNodeJsSyncHost = TempScopedNodeJsSyncHost;
