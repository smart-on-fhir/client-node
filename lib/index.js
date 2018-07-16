"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lib = require("./lib");
const client_1 = require("./client");
exports.authorize = lib.authorize, exports.completeAuth = lib.completeAuth, exports.buildAuthorizeUrl = lib.buildAuthorizeUrl;
exports.Client = client_1.default;
