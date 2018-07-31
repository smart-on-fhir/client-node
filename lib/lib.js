"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const Crypto = require("crypto");
const Url = require("url");
const qs = require("querystring");
const _debug = require("debug");
const errors_1 = require("./errors");
const client_1 = require("./client");
exports.Client = client_1.default;
const debug = _debug("smart");
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
 * Simplified version of printf. Just replaces all the occurrences of "%s" with
 * whatever is supplied in the rest of the arguments. If no argument is supplied
 * the "%s" token is replaced with an empty string.
 * @param {String} s The string to format
 * @param {*} ... The rest of the arguments are used for the replacements
 * @return {String}
 */
function printf(s, ...args) {
    const l = args.length;
    let i = 0;
    return String(s || "").replace(/(%s)/g, () => i >= l ? "" : args[i++]);
}
exports.printf = printf;
/**
 * Returns the error message for the given error name, replacing any "%s"
 * occurrences with the rest of the given arguments
 * @param name The error name
 * @param rest Any other arguments passed to printf
 */
function getErrorText(name = "", ...rest) {
    return printf(errors_1.default[name], ...rest);
}
exports.getErrorText = getErrorText;
/**
 * For custom error objects that also have an httpCode property
 */
class HttpError extends Error {
    constructor(name = "", httpCode = 500, ...params) {
        super(getErrorText(name, ...params) || name);
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
    let metadata;
    try {
        metadata = await axios_1.default(url);
    }
    catch (ex) {
        metadata = {};
    }
    const nsUri = "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris";
    const extensions = (getPath(metadata, "data.rest.0.security.extension") || [])
        .filter((e) => e.url === nsUri)
        .map((o) => o.extension)[0];
    const out = {
        registrationUri: "",
        authorizeUri: "",
        tokenUri: ""
    };
    if (extensions) {
        extensions.forEach((ext) => {
            if (ext.url === "register") {
                out.registrationUri = ext.valueUri;
            }
            if (ext.url === "authorize") {
                out.authorizeUri = ext.valueUri;
            }
            if (ext.url === "token") {
                out.tokenUri = ext.valueUri;
            }
        });
    }
    return out;
}
exports.getSecurityExtensions = getSecurityExtensions;
/**
 * Converts the given relative URL to absolute based on the request origin
 * @param req The http request object
 * @param url The url to convert
 */
function resolveUrl(req, url) {
    const protocol = req.connection.encrypted ? "https" : "http";
    return Url.resolve(protocol + "://" + req.headers.host, url);
}
exports.resolveUrl = resolveUrl;
/**
 * Given a fhir bundle fins it's link having the given rel attribute.
 * @param {Object} bundle FHIR JSON Bundle object
 * @param {String} rel The rel attribute to look for: prev|next|self... (see
 * http://www.iana.org/assignments/link-relations/link-relations.xhtml#link-relations-1)
 * @returns {String|null} Returns the url of the link or null if the link was
 *                        not found.
 */
function getBundleURL(bundle, rel) {
    if (bundle.link) {
        const nextLink = bundle.link.find(l => l.relation === rel);
        return nextLink && nextLink.url ? nextLink.url : null;
    }
    return null;
}
exports.getBundleURL = getBundleURL;
/**
 * First discovers the fhir server base URL from query.iis or query.fhirServiceUrl
 * or options.serverUrl. Then compiles the proper authorization URL for that server.
 * For open server that URL is the options.redirectUri so that we can skip the
 * authorization part.
 */
async function buildAuthorizeUrl(req, options, storage) {
    const url = Url.parse(req.url, true);
    const { launch, iss, fhirServiceUrl } = url.query;
    const serverUrl = iss || fhirServiceUrl || options.serverUrl || "";
    if (iss && !launch) {
        throw new Error(getErrorText("missing_url_parameter", "launch"));
    }
    if (!serverUrl) {
        debug("No serverUrl found. It must be specified as query.iss or " +
            "query.fhirServiceUrl or options.serverUrl (in that order)");
        throw new Error(getErrorText("no_server_url_provided"));
    }
    debug(`Looking up the authorization endpoint for "${serverUrl}"`);
    const extensions = await getSecurityExtensions(serverUrl);
    debug(`Found security extensions: `, extensions);
    // Prepare the object that will be stored in the session
    const state = Object.assign({ serverUrl: serverUrl, clientId: options.clientId, redirectUri: resolveUrl(req, options.redirectUri), scope: options.scope || "" }, extensions);
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
        await storage.unset(oldId);
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
    const location = await buildAuthorizeUrl(req, options, storage);
    debug(`Making authorize redirect to ${location}`);
    res.writeHead(302, { location });
    res.end();
}
exports.authorize = authorize;
/**
 * Builds the token request options for axios. Does not make the request, just
 * creates it's configuration and returns it in a Promise.
 * NOTE that this function has side effects because it modifies the storage
 * contents.
 * @param req
 * @param storage
 */
async function buildTokenRequest(req, storage) {
    const { state, code } = Url.parse(req.url, true).query;
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
        requestOptions.headers.Authorization = "Basic " + Buffer.from(cached.clientId + ":" + cached.clientSecret).toString("base64");
        debug(`Using state.clientSecret to construct the authorization header: "${requestOptions.headers.Authorization}"`);
    }
    else {
        debug(`No clientSecret found in state. Adding client_id to the POST body`);
        requestOptions.data.client_id = cached.clientId;
    }
    return requestOptions;
}
exports.buildTokenRequest = buildTokenRequest;
/**
 * Creates and returns an HttpError that should explain why the token request
 * have failed
 */
function handleTokenError(result) {
    let msg = result.message;
    // Some auth servers will respond with a payload that contains "error" and
    // optionally an "error_description" properties
    const body = getPath(result, "response.data");
    if (body) {
        if (body.error) {
            msg += "\n" + body.error;
            if (body.error_description) {
                msg += ": " + body.error_description;
            }
        }
        else {
            msg += "\n" + body;
        }
    }
    debug(msg + " - " + result.stack);
    return new HttpError(msg, result.status);
}
exports.handleTokenError = handleTokenError;
/**
 * After successful authorization we have received a code and state parameters.
 * Use this function to exchange that code for an access token and complete the
 * authorization flow.
 */
async function completeAuth(req, storage) {
    debug("Completing the code flow");
    const { state } = Url.parse(req.url, true).query;
    const cached = await storage.get(state);
    const requestOptions = await buildTokenRequest(req, storage);
    requestOptions.data = qs.stringify(requestOptions.data);
    // The EHR authorization server SHALL return a JSON structure that
    // includes an access token or a message indicating that the
    // authorization request has been denied.
    return axios_1.default(requestOptions)
        .then(async ({ data }) => {
        debug(`Received tokenResponse. Saving it to the state...`);
        cached.tokenResponse = data;
        return storage.set(state, cached);
    })
        .then(() => new client_1.default(cached))
        .catch(result => {
        throw handleTokenError(result);
    });
}
exports.completeAuth = completeAuth;
/**
 * The default storage factory assumes that the request object has a session
 * property which is an object that we are free to manipulate. This happens to
 * be the case for Express using `express-session` and for Hapi using
 * hapi-server-session`.
 */
function getSessionStorage(req) {
    return {
        /**
         * Sets (adds or updates) a value at the given key
         * @param {String} key
         * @param {any} value
         * @returns {Promise<any>} A promise resolved with the stored value
         */
        async set(key, value) {
            req.session[key] = value;
            return value;
        },
        /**
         * Reads the value at the given key
         * @param {String} key
         * @returns {Promise<any>} A promise resolved with the stored value or undefined
         */
        async get(key) {
            return req.session[key];
        },
        /**
         * Deletes the value at the given key (if one exists)
         * @param {String} key
         * @returns {Promise<Boolean>} A promise resolved with true if the value
         * was removed or with false otherwise
         */
        async unset(key) {
            if (req.session.hasOwnProperty(key)) {
                delete req.session[key];
                return true;
            }
            return false;
        }
    };
}
exports.getSessionStorage = getSessionStorage;
