import request     from "axios"
import * as Crypto from "crypto"
import * as Url    from "url"
import * as qs     from "querystring"
import * as _debug from "debug"
import errors      from "./errors"
import Client      from "./client"
import { SMART }   from "../"
import { IncomingMessage, ServerResponse } from "http";


const debug = _debug('smart');


/**
 * Walks thru an object (or array) and returns the value found at the
 * provided path. This function is very simple so it intentionally does not
 * support any argument polymorphism, meaning that the path can only be a
 * dot-separated string. If the path is invalid returns undefined.
 * @param {Object} obj The object (or Array) to walk through
 * @param {String} path The path (eg. "a.b.4.c")
 * @returns {*} Whatever is found in the path or undefined
 */
export function getPath(obj: object|any[], path: string = ""): any
{
    path = path.trim();
    if (!path) {
        return obj;
    }
    return path.split(".").reduce((out, key) => out ? (out as any)[key] : undefined, obj);
}

/**
 * Encodes the given input 
 * @param str The string to encode
 */
export function base64encode(str: string): string
{
    return Buffer.from(str).toString("base64");
}

/**
 * Simplified version of printf. Just replaces all the occurrences of "%s" with
 * whatever is supplied in the rest of the arguments. If no argument is supplied
 * the "%s" token is replaced with an empty string.
 * @param {String} s The string to format
 * @param {*} ... The rest of the arguments are used for the replacements
 * @return {String}
 */
export function printf(s: string, ...args: any[]): string
{
    let l = args.length, i = 0;
    return String(s || "").replace(/(%s)/g, () => i >= l ? "" : args[i++]);
}

/**
 * Returns the error message for the given error name, replacing any "%s"
 * occurrences with the rest of the given arguments
 * @param name The error name
 * @param rest Any other arguments passed to printf
 */
export function getErrorText(name:string, ...rest: any[])
{
    return printf((errors as SMART.objectLiteral)[name], ...rest);
}

/**
 * For custom error objects that also have an httpCode property
 */
export class HttpError extends Error
{
    public httpCode: number;

    constructor(name: string, httpCode = 500, ...params: any[]) {
        super(getErrorText(name, ...params))
        this.httpCode = httpCode;
    }
}

/**
 * Given a fhir server returns an object with it's Oauth security endpoints
 * @param baseUrl Fhir server base URL
 */
export async function getSecurityExtensions(baseUrl: string): Promise<SMART.OAuthSecurityExtensions>
{
    const url = String(baseUrl || "").replace(/\/*$/, "/") + "metadata";
    const metadata = await request(url);
    const extensions = (getPath(metadata, "data.rest.0.security.extension") || [])
        .filter((e:SMART.objectLiteral) => e.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris")
        .map((o:SMART.objectLiteral) => o.extension)[0];
        
    let out: SMART.OAuthSecurityExtensions = {
        registrationUri : "",
        authorizeUri    : "",
        tokenUri        : ""
    };

    if (extensions) {
        extensions.forEach((ext:SMART.objectLiteral) => {
            if (ext.url === "register") {
                out.registrationUri = ext.valueUri;
            } else if (ext.url === "authorize") {
                out.authorizeUri = ext.valueUri;
            } else if (ext.url === "token") {
                out.tokenUri = ext.valueUri;
            }
        });
    }
    return Promise.resolve(out)
    // return out
}

/**
 * Converts the given relative URL to absolute based on the request origin
 * @param req The http request object
 * @param url The url to convert
 */
export function resolveUrl(req: IncomingMessage, url: string)
{
    let protocol = (req.connection as SMART.objectLiteral).encrypted ? 'https' : 'http';
    return Url.resolve(protocol + "://" + req.headers.host, url)
}

/**
 * First discovers the fhir server base URL from query.iis or query.fhirServiceUrl
 * or options.serverUrl. Then compiles the proper authorization URL for that server.
 * For open server that URL is the options.redirectUri so that we can skip the
 * authorization part.
 */
export async function buildAuthorizeUrl(req: IncomingMessage, options: SMART.ClientOptions, storage: SMART.SmartStorage): Promise<string>
{
    // If this is raw request (not an augmented express.Request object)
    // extract the query manually
    const url = Url.parse(req.url as string, true);
    
    const { launch, iss, fhirServiceUrl } = url.query;
    const serverUrl = iss || fhirServiceUrl || options.serverUrl || "";

    if (!serverUrl) {
        debug(`No serverUrl found. It must be specified as query.iss or query.fhirServiceUrl or options.serverUrl (in that order)`)
        return Promise.reject(new Error(getErrorText("no_server_url_provided")));
    }
    // debugger
    debug(`Looking up the authorization endpoint for "${serverUrl}"`)
    const extensions = await getSecurityExtensions(serverUrl as string);
    debug(`Found security extensions: `, extensions)

    // Prepare the object that will be stored in the session
    const state: any = {
        serverUrl,
        clientId   : options.clientId,
        redirectUri: resolveUrl(req, options.redirectUri),
        scope      : options.scope || "",
        ...extensions
    };

    if (options.clientSecret) {
        debug(`Adding clientSecret to the state`)
        state.clientSecret = options.clientSecret;
    }

    // Create an unique key. We could use the session ID for that but we
    // don't want it to be visible in the browser URL bar (as the state
    // parameter) while redirecting.
    const id = "smart-" + Crypto.randomBytes(8).toString("hex");
    const oldId = await storage.get("smartId");
    if (oldId) {
        debug(`Deleting previous state by id ("${oldId}")`)
        await storage.unset(id);
    }
    debug(`Saving new state by id ("${id}")`)
    await storage.set(id, state);
    await storage.set("smartId", id);

    let redirectUrl = state.redirectUri;

    if (state.authorizeUri) {
        debug(`authorizeUri: ${state.authorizeUri}`)
        const params = [
            "response_type=code",
            "client_id="    + encodeURIComponent(state.clientId),
            "scope="        + encodeURIComponent(state.scope),
            "redirect_uri=" + encodeURIComponent(state.redirectUri),
            "aud="          + encodeURIComponent(state.serverUrl),
            "state="        + id
        ];

        // also pass this in case of EHR launch
        if (launch) {
            params.push("launch=" + encodeURIComponent(launch as string))
        }

        redirectUrl = state.authorizeUri + "?" + params.join("&");
    }
    debug(`Making authorize redirect to ${redirectUrl}`)
    return redirectUrl;
}

/**
 * Calls the buildAuthorizeUrl function to construct the redirect URL and then
 * just redirects to it.
 */
export async function authorize(req: IncomingMessage, res: ServerResponse, options: SMART.ClientOptions, storage: SMART.SmartStorage)
{
    debug(`Authorizing...`)
    const url = await buildAuthorizeUrl(req, options, storage)
    debug(`Making authorize redirect to ${url}`)
    res.writeHead(303, { Location: url })
    res.end()
}

/**
 * After successful authorization we have received a code and state parameters.
 * Use this function to exchange that code for an access token and complete the
 * authorization flow.
 */
export async function completeAuth(req: IncomingMessage, storage: SMART.SmartStorage): Promise<Client>
{
    debug("Completing the code flow")

    // If this is raw request (not an augmented express.Request object)
    // extract the query manually
    const query = Url.parse(req.url as string, true).query;

    const { state, code } = query;

    const cached = await storage.get(state as string);

    // First make sure we have such state and it contains everything we need
    if (!cached) {
        debug(`No state found by the given id (${state})`)
        throw new HttpError("missing_state_by_id", 400, state);
    }

    if (!cached.redirectUri) {
        debug(`Missing state.redirectUri`)
        throw new HttpError("missing_state_redirectUri", 400);
    }

    if (!cached.tokenUri) {
        debug(`Missing state.tokenUri`)
        throw new HttpError("missing_state_tokenUri", 400);
    }

    if (!cached.clientId) {
        debug(`Missing state.clientId`)
        throw new HttpError("missing_state_clientId", 400);
    }

    const requestOptions: any = {
        method: "POST",
        url   : cached.tokenUri,
        headers: {
            "content-type": "application/x-www-form-urlencoded"
        },
        data: {
            code,
            grant_type  : "authorization_code",
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
            Authorization: "Basic " + base64encode(
                cached.clientId + ':' + cached.clientSecret
            )
        };
        debug(`Using state.clientSecret to construct the authorization header: "${requestOptions.headers.Authorization}"`)
    }
    else {
        debug(`No clientSecret found in state. Adding client_id to the POST body`)
        requestOptions.data.client_id = cached.clientId;
    }

    requestOptions.data = qs.stringify(requestOptions.data);
    
    // The EHR authorization server SHALL return a JSON structure that
    // includes an access token or a message indicating that the
    // authorization request has been denied.
    // debug("Exchanging the code for an access token...");
    debug(`Exchanging the code ("${code}) for access token...`)
    return request(requestOptions)
        .then(({ data }) => {
            debug(`Received tokenResponse. Saving it to the state...`)
            cached.tokenResponse = data
            return storage.set(state as string, cached);
        })
        .then(() => new Client(cached))
        .catch(result => {
            let msg = result.message
            if (result.response && result.response.data && result.response.data.error) {
                msg += "\n" + result.response.data.error
                if (result.response.data.error_description) {
                    msg += ": " + result.response.data.error_description
                }
            }
            debug(result.stack);
            return Promise.reject(new HttpError(msg, result.status))
        })   
}
