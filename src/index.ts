import * as lib              from "./lib"
import { default as client } from "./client"

export const {
    authorize,
    completeAuth,
    buildAuthorizeUrl
} = lib;
export const Client = client;
