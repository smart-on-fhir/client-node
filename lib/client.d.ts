import { AxiosRequestConfig } from "axios";
import { SMART } from "..";
/**
 * A SMART Client instance will simplify some tasks for you. It will authorize
 * requests automatically, use refresh tokens, handle errors and so on.
 */
export default class Client {
    /**
     * The serialized state as it is stored in the session (or other storage).
     * Contains things like tokens, client secrets, settings and so on.
     */
    protected state: SMART.ClientState;
    constructor(state: SMART.ClientState);
    /**
     * Allows you to do the following:
     * 1. Use relative URLs (treat them as relative to the "serverUrl" option)
     * 2. Automatically authorize requests with your accessToken (if any)
     * 3. Automatically re-authorize using the refreshToken (if available)
     * 4. Automatically parse error operation outcomes and turn them into
     *   JavaScript Error objects with which the resulting promises are rejected
     * @param {object|string} options URL or axios request options
     */
    request(options?: AxiosRequestConfig | string): Promise<any>;
    /**
     * Use the refresh token to obtain new access token.
     * If the refresh token is expired it will be deleted from the state, so
     * that we don't enter into loops trying to re-authorize.
     */
    refresh(): Promise<any>;
    /**
     * Returns the ID of the selected patient or null. You should have requested
     * "launch/patient" scope. Otherwise this will return null.
     */
    getPatientId(): string | null;
    /**
     * Returns the ID of the selected encounter or null. You should have
     * requested "launch/encounter" scope. Otherwise this will return null.
     * Note that not all servers support the "launch/encounter" scope so this
     * will be null if they don't.
     */
    getEncounterId(): string | null;
    /**
     * Returns the (decoded) id_token if any. You need to request "openid" and
     * "profile" scopes if you need to receive an id_token (if you need to know
     * who the logged-in user is).
     */
    getIdToken(): SMART.IDToken | null;
    /**
     * Returns the profile of the logged_in user (if any). This is a string
     * having the following shape "{user type}/{user id}". For example:
     * "Practitioner/abc" or "Patient/xyz".
     */
    getUserProfile(): string | null;
    /**
     * Returns the user ID or null.
     */
    getUserId(): string | null;
    /**
     * Returns the type of the logged-in user or null. The result can be
     * "Practitioner", "Patient" or "RelatedPerson".
     */
    getUserType(): string | null;
    /**
     * Gets multiple bundle entries from multiple pages and returns an array
     * with all their entries. This can be used to walk a server and download
     * all the resources from certain type for example
     * @param options Request options
     * @param maxPages Max number of pages to fetch. Defaults to 100.
     */
    getPages(options: AxiosRequestConfig | string, maxPages?: number, result?: SMART.FhirBundleEntry[]): Promise<SMART.FhirBundleEntry[]>;
}
