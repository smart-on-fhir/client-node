
import request, { AxiosRequestConfig } from "axios";
import * as querystring                from "querystring";
import * as _debug                     from "debug";
import { SMART }                       from "..";
import { getPath, getErrorText }       from "./lib";

const debug = _debug("smart");

/**
 * A SMART Client instance will simplify some tasks for you. It will authorize
 * requests automatically, use refresh tokens, handle errors and so on.
 */
export default class Client
{
    /**
     * The serialized state as it is stored in the session (or other storage).
     * Contains things like tokens, client secrets, settings and so on.
     */
    protected state: SMART.ClientState;

    constructor(state: SMART.ClientState)
    {
        // This might happen if the state have been lost (for example the server
        // was restarted and a memory storage was used).
        if (!state) {
            throw new Error("No state provided to the client");
        }
        this.state = state;
    }

    /**
     * Allows you to do the following:
     * 1. Use relative URLs (treat them as relative to the "serverUrl" option)
     * 2. Automatically authorize requests with your accessToken (if any)
     * 3. Automatically re-authorize using the refreshToken (if available)
     * 4. Automatically parse error operation outcomes and turn them into
     *   JavaScript Error objects with which the resulting promises are rejected
     * @param {object|string} options URL or axios request options
     */
    public async request(options: AxiosRequestConfig | string): Promise<any>
    {
        if (typeof options == "string") {
            options = { url: options };
        }

        options.baseURL = this.state.serverUrl.replace(/\/?$/, "/");

        const accessToken = getPath(this.state, "tokenResponse.access_token");
        if (accessToken) {
            options.headers = {
                ...options.headers,
                Authorization: `Bearer ${accessToken}`
            };
        }

        return request(options)
            .catch(error => {

                // The request was made and the server responded with a
                // status code that falls out of the range of 2xx
                if (error.response) {

                    if (error.response.status == 401) {
                        debug("401 received");
                        if (getPath(this.state, "tokenResponse.refresh_token")) {
                            debug("Refreshing using the refresh token");
                            return this.refresh().then(() => this.request(options));
                        }
                    }

                    const body = error.response.data;
                    if (body &&
                        typeof body == "object" &&
                        body.resourceType == "OperationOutcome" &&
                        Array.isArray(body.issue) &&
                        body.issue.length
                    ) {
                        debug("OperationOutcome error response detected");
                        const errors = body.issue.map((o: any) => `${o.severity} ${o.code} ${o.diagnostics || ""}`);
                        return Promise.reject(new Error(errors.join("\n")));
                    }
                    return Promise.reject(error);
                }

                // The request was made but no response was received
                // "error.request" is an instance of http.ClientRequest
                else if (error.request) {
                    return Promise.reject(new Error(getErrorText("no_fhir_response")));
                }

                // Something happened in setting up the request that triggered an Error
                else {
                    console.log("Error", error.message);
                }

                return Promise.reject(error);
            });
    }

    /**
     * Use the refresh token to obtain new access token.
     * If the refresh token is expired it will be deleted from the state, so
     * that we don't enter into loops trying to re-authorize.
     */
    public refresh()
    {
        if (!this.state.tokenResponse || !this.state.tokenResponse.refresh_token) {
            return Promise.reject(new Error("Trying to refresh but there is no refresh token"));
        }
        const refreshToken = getPath(this.state, "tokenResponse.refresh_token");

        return request({
            method: "POST",
            url: this.state.tokenUri,
            headers: {
                "content-type": "application/x-www-form-urlencoded"
            },
            data: querystring.stringify({
                grant_type: "refresh_token",
                refresh_token: refreshToken
            })
        }).then(({ data }) => {
            this.state.tokenResponse = { ...this.state.tokenResponse, ...data as SMART.TokenResponse };
            return data;
        })
        .catch(error => {
            if (error.response && error.response.status == 401) {
                debug("401 received - refresh token expired or invalid");
                if (this.state.tokenResponse) {
                    debug("Deleting the expired or invalid refresh token");
                    delete this.state.tokenResponse.refresh_token;
                }
            }
            return error;
        });
    }
}
