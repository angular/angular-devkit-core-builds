"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const fs_1 = require("fs");
var fs;
(function (fs) {
    function isFile(filePath) {
        let stat;
        try {
            stat = fs_1.statSync(filePath);
        }
        catch (e) {
            if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
                return false;
            }
            throw e;
        }
        return stat.isFile() || stat.isFIFO();
    }
    fs.isFile = isFile;
    function isDirectory(filePath) {
        let stat;
        try {
            stat = fs_1.statSync(filePath);
        }
        catch (e) {
            if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
                return false;
            }
            throw e;
        }
        return stat.isDirectory();
    }
    fs.isDirectory = isDirectory;
})(fs = exports.fs || (exports.fs = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnMuanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2NvcmUvbm9kZS9mcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILDJCQUE4QjtBQUU5QixJQUFpQixFQUFFLENBOEJsQjtBQTlCRCxXQUFpQixFQUFFO0lBQ2pCLFNBQWdCLE1BQU0sQ0FBQyxRQUFnQjtRQUNyQyxJQUFJLElBQUksQ0FBQztRQUNULElBQUk7WUFDRixJQUFJLEdBQUcsYUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQzNCO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssU0FBUyxDQUFDLEVBQUU7Z0JBQ3RELE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFDRCxNQUFNLENBQUMsQ0FBQztTQUNUO1FBRUQsT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ3hDLENBQUM7SUFaZSxTQUFNLFNBWXJCLENBQUE7SUFHRCxTQUFnQixXQUFXLENBQUMsUUFBZ0I7UUFDMUMsSUFBSSxJQUFJLENBQUM7UUFDVCxJQUFJO1lBQ0YsSUFBSSxHQUFHLGFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUMzQjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFNBQVMsQ0FBQyxFQUFFO2dCQUN0RCxPQUFPLEtBQUssQ0FBQzthQUNkO1lBQ0QsTUFBTSxDQUFDLENBQUM7U0FDVDtRQUVELE9BQU8sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFaZSxjQUFXLGNBWTFCLENBQUE7QUFFSCxDQUFDLEVBOUJnQixFQUFFLEdBQUYsVUFBRSxLQUFGLFVBQUUsUUE4QmxCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgc3RhdFN5bmMgfSBmcm9tICdmcyc7XG5cbmV4cG9ydCBuYW1lc3BhY2UgZnMge1xuICBleHBvcnQgZnVuY3Rpb24gaXNGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBsZXQgc3RhdDtcbiAgICB0cnkge1xuICAgICAgc3RhdCA9IHN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSAmJiAoZS5jb2RlID09PSAnRU5PRU5UJyB8fCBlLmNvZGUgPT09ICdFTk9URElSJykpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RhdC5pc0ZpbGUoKSB8fCBzdGF0LmlzRklGTygpO1xuICB9XG5cblxuICBleHBvcnQgZnVuY3Rpb24gaXNEaXJlY3RvcnkoZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGxldCBzdGF0O1xuICAgIHRyeSB7XG4gICAgICBzdGF0ID0gc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlICYmIChlLmNvZGUgPT09ICdFTk9FTlQnIHx8IGUuY29kZSA9PT0gJ0VOT1RESVInKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHJldHVybiBzdGF0LmlzRGlyZWN0b3J5KCk7XG4gIH1cblxufVxuIl19