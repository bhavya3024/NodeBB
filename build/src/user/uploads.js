'use strict';
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const crypto = require('crypto');
const database = __importStar(require("../database"));
const db = database;
const posts = require('../posts');
const file = require('../file');
const batch = require('../batch');
const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
const _getFullPath = relativePath => path_1.default.resolve(nconf_1.default.get('upload_path'), relativePath);
const _validatePath = (relativePaths) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof relativePaths === 'string') {
        relativePaths = [relativePaths];
    }
    else if (!Array.isArray(relativePaths)) {
        throw new Error(`[[error:wrong-parameter-type, relativePaths, ${typeof relativePaths}, array]]`);
    }
    const fullPaths = relativePaths.map(path => _getFullPath(path));
    const exists = yield Promise.all(fullPaths.map((fullPath) => __awaiter(void 0, void 0, void 0, function* () { return file.exists(fullPath); })));
    if (!fullPaths.every(fullPath => fullPath.startsWith(nconf_1.default.get('upload_path'))) || !exists.every(Boolean)) {
        throw new Error('[[error:invalid-path]]');
    }
});
function default_1(User) {
    User.associateUpload = (uid, relativePath) => __awaiter(this, void 0, void 0, function* () {
        yield _validatePath(relativePath);
        yield Promise.all([
            db.sortedSetAdd(`uid:${uid}:uploads`, Date.now(), relativePath),
            db.setObjectField(`upload:${md5(relativePath)}`, 'uid', uid),
        ]);
    });
    User.deleteUpload = function (callerUid, uid, uploadNames) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof uploadNames === 'string') {
                uploadNames = [uploadNames];
            }
            else if (!Array.isArray(uploadNames)) {
                throw new Error(`[[error:wrong-parameter-type, uploadNames, ${typeof uploadNames}, array]]`);
            }
            yield _validatePath(uploadNames);
            const [isUsersUpload, isAdminOrGlobalMod] = yield Promise.all([
                db.isSortedSetMembers(`uid:${callerUid}:uploads`, uploadNames),
                User.isAdminOrGlobalMod(callerUid),
            ]);
            if (!isAdminOrGlobalMod && !isUsersUpload.every(Boolean)) {
                throw new Error('[[error:no-privileges]]');
            }
            yield batch.processArray(uploadNames, (uploadNames) => __awaiter(this, void 0, void 0, function* () {
                const fullPaths = uploadNames.map(path => _getFullPath(path));
                yield Promise.all(fullPaths.map((fullPath, idx) => __awaiter(this, void 0, void 0, function* () {
                    winston_1.default.verbose(`[user/deleteUpload] Deleting ${uploadNames[idx]}`);
                    yield Promise.all([
                        file.delete(fullPath),
                        file.delete(file.appendToFileName(fullPath, '-resized')),
                    ]);
                    yield Promise.all([
                        db.sortedSetRemove(`uid:${uid}:uploads`, uploadNames[idx]),
                        db.delete(`upload:${md5(uploadNames[idx])}`),
                    ]);
                })));
                // Dissociate the upload from pids, if any
                const pids = yield db.getSortedSetsMembers(uploadNames.map(relativePath => `upload:${md5(relativePath)}:pids`));
                yield Promise.all(pids.map((pids, idx) => __awaiter(this, void 0, void 0, function* () {
                    return Promise.all(pids.map((pid) => __awaiter(this, void 0, void 0, function* () { return posts.uploads.dissociate(pid, uploadNames[idx]); })));
                })));
            }), { batch: 50 });
        });
    };
    User.collateUploads = function (uid, archive) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet(`uid:${uid}:uploads`, (files, next) => {
                files.forEach((file) => {
                    archive.file(_getFullPath(file), {
                        name: path_1.default.basename(file),
                    });
                });
                setImmediate(next);
            }, { batch: 100 });
        });
    };
}
exports.default = default_1;
;
