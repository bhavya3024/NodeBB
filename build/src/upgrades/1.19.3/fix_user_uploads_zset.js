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
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require('crypto');
const database = __importStar(require("../../database"));
const db = database;
const batch = require('../../batch');
const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
exports.default = {
    name: 'Fix paths in user uploads sorted sets',
    timestamp: Date.UTC(2022, 1, 10),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const { progress } = this;
            yield batch.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                progress.incr(uids.length);
                yield Promise.all(uids.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    const key = `uid:${uid}:uploads`;
                    // Rename the paths within
                    let uploads = yield db.getSortedSetRangeWithScores(key, 0, -1);
                    if (uploads.length) {
                        // Don't process those that have already the right format
                        uploads = uploads.filter(upload => upload.value.startsWith('/files/'));
                        yield db.sortedSetRemove(key, uploads.map(upload => upload.value));
                        yield db.sortedSetAdd(key, uploads.map(upload => upload.score), uploads.map(upload => upload.value.slice(1)));
                        // Add uid to the upload's hash object
                        uploads = yield db.getSortedSetMembers(key);
                        yield db.setObjectBulk(uploads.map(relativePath => [`upload:${md5(relativePath)}`, { uid: uid }]));
                    }
                })));
            }), {
                batch: 500,
                progress: progress,
            });
        });
    },
};
