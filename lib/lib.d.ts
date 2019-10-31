/// <reference types="node" />
import Client from "./client";
import { SMART } from "../types";
import { IncomingMessage, ServerResponse } from "http";
export { Client };
/**
 * Walks thru an object (or array) and returns the value found at the
 * provided path. This function is very simple so it intentionally does not
 * support any argument polymorphism, meaning that the path can only be a
 * dot-separated string. If the path is invalid returns undefined.
 * @param {Object} obj The object (or Array) to walk through
 * @param {String} path The path (eg. "a.b.4.c")
 * @returns {*} Whatever is found in the path or undefined
 */
export declare function getPath(obj: object | any[], path?: string): any;
/**
 * Simplified version of printf. Just replaces all the occurrences of "%s" with
 * whatever is supplied in the rest of the arguments. If no argument is supplied
 * the "%s" token is replaced with an empty string.
 * @param {String} s The string to format
 * @param {*} ... The rest of the arguments are used for the replacements
 * @return {String}
 */
export declare function printf(s: string, ...args: any[]): string;
/**
 * Returns the error message for the given error name, replacing any "%s"
 * occurrences with the rest of the given arguments
 * @param name The error name
 * @param rest Any other arguments passed to printf
 */
export declare function getErrorText(name?: string, ...rest: any[]): string;
/**
 * For custom error objects that also have an httpCode property
 */
export declare class HttpError extends Error {
    httpCode: number;
    constructor(name?: string, httpCode?: number, ...params: any[]);
}
/**
 * Given a fhir server returns an object with it's Oauth security endpoints
 * @param baseUrl Fhir server base URL
 */
export declare function getSecurityExtensions(baseUrl: string): Promise<SMART.OAuthSecurityExtensions>;
/**
 * Converts the given relative URL to absolute based on the request origin
 * @param req The http request object
 * @param url The url to convert
 */
export declare function resolveUrl(req: IncomingMessage, url: string): string;
/**
 * Given a fhir bundle finds it's link having the given rel attribute.
 * @param {Object} bundle FHIR JSON Bundle object
 * @param {String} rel The rel attribute to look for: prev|next|self... (see
 * http://www.iana.org/assignments/link-relations/link-relations.xhtml#link-relations-1)
 * @returns {String|null} Returns the url of the link or null if the link was
 *                        not found.
 */
export declare function getBundleURL(bundle: SMART.FhirBundle, rel: string): string | null;
/**
 * First discovers the fhir server base URL from query.iis or query.fhirServiceUrl
 * or options.serverUrl. Then compiles the proper authorization URL for that server.
 * For open server that URL is the options.redirectUri so that we can skip the
 * authorization part.
 */
export declare function buildAuthorizeUrl(req: IncomingMessage, options: SMART.ClientOptions, storage: SMART.Storage): Promise<string>;
/**
 * Calls the buildAuthorizeUrl function to construct the redirect URL and then
 * just redirects to it.
 */
export declare function authorize(req: IncomingMessage, res: ServerResponse, options: SMART.ClientOptions, storage: SMART.Storage): Promise<any>;
/**
 * Builds the token request options for axios. Does not make the request, just
 * creates it's configuration and returns it in a Promise.
 * NOTE that this function has side effects because it modifies the storage
 * contents.
 * @param req
 * @param storage
 */
export declare function buildTokenRequest(req: IncomingMessage, storage: SMART.Storage): Promise<any>;
/**
 * Creates and returns an HttpError that should explain why the token request
 * have failed
 */
export declare function handleTokenError(result: any): HttpError;
/**
 * After successful authorization we have received a code and state parameters.
 * Use this function to exchange that code for an access token and complete the
 * authorization flow.
 */
export declare function completeAuth(req: IncomingMessage, storage: SMART.Storage): Promise<Client>;
/**
 * The default storage factory assumes that the request object has a session
 * property which is an object that we are free to manipulate. This happens to
 * be the case for Express using `express-session` and for Hapi using
 * hapi-server-session`.
 */
export declare function getSessionStorage(req: SMART.HttpRequestWithSession): SMART.Storage;
