"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const Crypto = require("crypto");
const Url = require("url");
const qs = require("querystring");
const debug_1 = require("debug");
const errors_1 = require("./errors");
const client_1 = require("./client");
const debug = debug_1.default('smart');
/**
 * Walks thru an object (or array) and returns the value found at the
 * provided path. This function is very simple so it intentionally does not
 * support any argument polymorphism, meaning that the path can only be a
 * dot-separated string. If the path is invalid returns undefined.
 * @param {Object} obj The object (or Array) to walk through
 * @param {String} path The path (eg. "a.b.4.c")
 * @returns {*} Whatever is found in the path or undefined
 */
function getPath(obj, path = "") {
    path = path.trim();
    if (!path) {
        return obj;
    }
    return path.split(".").reduce((out, key) => out ? out[key] : undefined, obj);
}
exports.getPath = getPath;
/**
 * Encodes the given input
 * @param str The string to encode
 */
function base64encode(str) {
    return Buffer.from(str).toString("base64");
}
exports.base64encode = base64encode;
;
/**
 * Simplified version of printf. Just replaces all the occurrences of "%s" with
 * whatever is supplied in the rest of the arguments. If no argument is supplied
 * the "%s" token is replaced with an empty string.
 * @param {String} s The string to format
 * @param {*} ... The rest of the arguments are used for the replacements
 * @return {String}
 */
function printf(s, ...args) {
    let l = args.length, i = 0;
    return String(s || "").replace(/(%s)/g, a => i >= l ? "" : args[i++]);
}
exports.printf = printf;
/**
 * Returns the error message for the given error name, replacing any "%s"
 * occurrences with the rest of the given arguments
 * @param name The error name
 * @param rest Any other arguments passed to printf
 */
function getErrorText(name, ...rest) {
    return printf(errors_1.default[name], ...rest);
}
exports.getErrorText = getErrorText;
/**
 * For custom error objects that also have an httpCode property
 */
class HttpError extends Error {
    constructor(name, httpCode = 500, ...params) {
        super(getErrorText(name, ...params));
        this.httpCode = httpCode;
    }
}
exports.HttpError = HttpError;
/**
 * Given a fhir server returns an object with it's Oauth security endpoints
 * @param baseUrl Fhir server base URL
 */
async function getSecurityExtensions(baseUrl) {
    const url = String(baseUrl || "").replace(/\/*$/, "/") + "metadata";
    const metadata = await axios_1.default(url);
    const extensions = (getPath(metadata, "data.rest.0.security.extension") || [])
        .filter((e) => e.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris")
        .map((o) => o.extension)[0];
    let out = {
        registrationUri: "",
        authorizeUri: "",
        tokenUri: ""
    };
    if (extensions) {
        extensions.forEach((ext) => {
            if (ext.url === "register") {
                out.registrationUri = ext.valueUri;
            }
            else if (ext.url === "authorize") {
                out.authorizeUri = ext.valueUri;
            }
            else if (ext.url === "token") {
                out.tokenUri = ext.valueUri;
            }
        });
    }
    return Promise.resolve(out);
    // return out
}
exports.getSecurityExtensions = getSecurityExtensions;
/**
 * Converts the given relative URL to absolute based on the request origin
 * @param req The http request object
 * @param url The url to convert
 */
function resolveUrl(req, url) {
    let protocol = req.connection.encrypted ? 'https' : 'http';
    return Url.resolve(protocol + "://" + req.headers.host, url);
}
exports.resolveUrl = resolveUrl;
/**
 * First discovers the fhir server base URL from query.iis or query.fhirServiceUrl
 * or options.serverUrl. Then compiles the proper authorization URL for that server.
 * For open server that URL is the options.redirectUri so that we can skip the
 * authorization part.
 */
async function buildAuthorizeUrl(req, options, storage) {
    // If this is raw request (not an augmented express.Request object)
    // extract the query manually
    const url = Url.parse(req.url, true);
    const { launch, iss, fhirServiceUrl } = url.query;
    const serverUrl = iss || fhirServiceUrl || options.serverUrl || "";
    if (!serverUrl) {
        debug(`No serverUrl found. It must be specified as query.iss or query.fhirServiceUrl or options.serverUrl (in that order)`);
        return Promise.reject(new Error(getErrorText("no_server_url_provided")));
    }
    // debugger
    debug(`Looking up the authorization endpoint for "${serverUrl}"`);
    const extensions = await getSecurityExtensions(serverUrl);
    debug(`Found security extensions: `, extensions);
    // Prepare the object that will be stored in the session
    const state = Object.assign({ serverUrl, clientId: options.clientId, redirectUri: resolveUrl(req, options.redirectUri), scope: options.scope || "" }, extensions);
    if (options.clientSecret) {
        debug(`Adding clientSecret to the state`);
        state.clientSecret = options.clientSecret;
    }
    // Create an unique key. We could use the session ID for that but we
    // don't want it to be visible in the browser URL bar (as the state
    // parameter) while redirecting.
    const id = "smart-" + Crypto.randomBytes(8).toString("hex");
    const oldId = await storage.get("smartId");
    if (oldId) {
        debug(`Deleting previous state by id ("${oldId}")`);
        await storage.unset(id);
    }
    debug(`Saving new state by id ("${id}")`);
    await storage.set(id, state);
    await storage.set("smartId", id);
    let redirectUrl = state.redirectUri;
    if (state.authorizeUri) {
        debug(`authorizeUri: ${state.authorizeUri}`);
        const params = [
            "response_type=code",
            "client_id=" + encodeURIComponent(state.clientId),
            "scope=" + encodeURIComponent(state.scope),
            "redirect_uri=" + encodeURIComponent(state.redirectUri),
            "aud=" + encodeURIComponent(state.serverUrl),
            "state=" + id
        ];
        // also pass this in case of EHR launch
        if (launch) {
            params.push("launch=" + encodeURIComponent(launch));
        }
        redirectUrl = state.authorizeUri + "?" + params.join("&");
    }
    debug(`Making authorize redirect to ${redirectUrl}`);
    return redirectUrl;
}
exports.buildAuthorizeUrl = buildAuthorizeUrl;
/**
 * Calls the buildAuthorizeUrl function to construct the redirect URL and then
 * just redirects to it.
 */
async function authorize(req, res, options, storage) {
    debug(`Authorizing...`);
    const url = await buildAuthorizeUrl(req, options, storage);
    debug(`Making authorize redirect to ${url}`);
    res.writeHead(303, { Location: url });
    res.end();
}
exports.authorize = authorize;
/**
 * After successful authorization we have received a code and state parameters.
 * Use this function to exchange that code for an access token and complete the
 * authorization flow.
 */
async function completeAuth(req, storage) {
    debug("Completing the code flow");
    // If this is raw request (not an augmented express.Request object)
    // extract the query manually
    const query = Url.parse(req.url, true).query;
    const { state, code } = query;
    const cached = await storage.get(state);
    // First make sure we have such state and it contains everything we need
    if (!cached) {
        debug(`No state found by the given id (${state})`);
        throw new HttpError("missing_state_by_id", 400, state);
    }
    if (!cached.redirectUri) {
        debug(`Missing state.redirectUri`);
        throw new HttpError("missing_state_redirectUri", 400);
    }
    if (!cached.tokenUri) {
        debug(`Missing state.tokenUri`);
        throw new HttpError("missing_state_tokenUri", 400);
    }
    if (!cached.clientId) {
        debug(`Missing state.clientId`);
        throw new HttpError("missing_state_clientId", 400);
    }
    const requestOptions = {
        method: "POST",
        url: cached.tokenUri,
        headers: {
            "content-type": "application/x-www-form-urlencoded"
        },
        data: {
            code,
            grant_type: "authorization_code",
            redirect_uri: cached.redirectUri
        }
    };
    // For public apps, authentication is not possible (and thus not
    // required), since the app cannot be trusted to protect a secret.
    // For confidential apps, an Authorization header using HTTP Basic
    // authentication is required, where the username is the app’s client_id
    // and the password is the app’s client_secret
    if (cached.clientSecret) {
        requestOptions.headers = {
            Authorization: "Basic " + base64encode(cached.clientId + ':' + cached.clientSecret)
        };
        debug(`Using state.clientSecret to construct the authorization header: "${requestOptions.headers.Authorization}"`);
    }
    else {
        debug(`No clientSecret found in state. Adding client_id to the POST body`);
        requestOptions.data.client_id = cached.clientId;
    }
    requestOptions.data = qs.stringify(requestOptions.data);
    // The EHR authorization server SHALL return a JSON structure that
    // includes an access token or a message indicating that the
    // authorization request has been denied.
    // debug("Exchanging the code for an access token...");
    debug(`Exchanging the code ("${code}) for access token...`);
    return axios_1.default(requestOptions)
        .then(({ data }) => {
        debug(`Received tokenResponse. Saving it to the state...`);
        cached.tokenResponse = data;
        return storage.set(state, cached);
    })
        .then(() => new client_1.default(cached))
        .catch(result => {
        let msg = result.message;
        if (result.response && result.response.data && result.response.data.error) {
            msg += "\n" + result.response.data.error;
            if (result.response.data.error_description) {
                msg += ": " + result.response.data.error_description;
            }
        }
        debug(result.stack);
        return Promise.reject(new HttpError(msg, result.status));
    });
}
exports.completeAuth = completeAuth;
