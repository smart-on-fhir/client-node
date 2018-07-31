import { IncomingMessage } from "http";

export namespace SMART {
    
    /**
     * Describes the options that one can/should pass to the functions that
     * accept configuration argument
     */
    interface ClientOptions extends OAuthSecurityExtensions {
        /**
         * The base URL of the Fhir server. If provided in the options, the app
         * will be launch-able byy simply accessing your launch URI without
         * requiring any parameters.
         */
        serverUrl?: string;

        /**
         * The client_id that you should have obtained while registering your
         * app with the auth server or EHR.
         */
        clientId: string;

        /**
         * The URI to redirect to after successful authorization. This must be
         * absolute path, relative to your site root, i.e. must begin with "/"
         */
        redirectUri: string;

        /**
         * The access scopes that you need.
         * @see http://docs.smarthealthit.org/authorization/scopes-and-launch-context/
         */
        scope?: string;

        /**
         * Your client secret if you have one (for confidential clients)
         */
        clientSecret?: string;
    }

    /**
     * Describes the state that should be passed to the Client constructor
     */
    interface ClientState extends OAuthSecurityExtensions {
        /**
         * The base URL of the Fhir server. The library should have detected it
         * at authorization time from request query params of from config options.
         */
        serverUrl: string;

        /**
         * The client_id that you should have obtained while registering your
         * app with the auth server or EHR (as set in the configuration options)
         */
        clientId: string;

        /**
         * The URI to redirect to after successful authorization, as set in the
         * configuration options.
         */
        redirectUri: string;

        /**
         * The access scopes that you requested in your options (or an empty string).
         * @see http://docs.smarthealthit.org/authorization/scopes-and-launch-context/
         */
        scope: string;

        /**
         * Your client secret if you have one (for confidential clients)
         */
        clientSecret?: string;

        /**
         * The (encrypted) access token, in case you have completed the auth flow
         * already.
         */
        access_token?: string;

        /**
         * The response object received from the token endpoint while trying to
         * exchange the auth code for an access token (if you have reached that point).
         */
        tokenResponse?: TokenResponse;
    }

    /**
     * Describes the state that you should for an active session (after auth).
     * The difference with ClientState is that `access_token` and
     * `TokenResponse` **must** be present (even if they happen to be expired).
     */
    interface ActiveClientState extends ClientState {
        
        /**
         * The (encrypted) access token
         */
        access_token : string;

        /**
         * The response object received from the token endpoint while trying to
         * exchange the auth code for an access token.
         */
        tokenResponse: TokenResponse;
    }

    /**
     * The response object received from the token endpoint while trying to
     * exchange the auth code for an access token. This object has a well-known
     * base structure but the auth servers are free to augment it with
     * additional properties.
     * @see http://docs.smarthealthit.org/authorization/
     */
    interface TokenResponse {

        /**
         * If present, this tells the app that it is being rendered within an
         * EHR frame and the UI outside that frame already displays the selected
         * patient's name, age, gender etc. The app can decide to hide those
         * details to prevent the UI from duplicated information.
         */
        need_patient_banner?: boolean;

        /**
         * This could be a public location of some style settings that the EHR
         * would like to suggest. The app might look it up and optionally decide
         * to apply some or all of it.
         * @see https://launch.smarthealthit.org/smart-style.json
         */
        smart_style_url?: string;

        /**
         * If you have requested that require it (like `launch` or `launch/patient`)
         * the selected patient ID will be available here.
         */
        patient?: string;

        /**
         * If you have requested that require it (like `launch` or `launch/encounter`)
         * the selected encounter ID will be available here.
         * **NOTE:** This is not widely supported as of 2018. 
         */
        encounter?: string;

        /**
         * If you have requested `openid` and `profile` scopes the profile of
         * the active user will be available as `client_id`.
         * **NOTE:** Regardless of it's name, this property does not store an ID
         * but a token that also suggests the user type like `Patient/123`,
         * `Practitioner/xyz` etc.
         */
        client_id?: string;

        /**
         * Fixed value: bearer
         */
        token_type: "bearer" | "Bearer";

        /**
         * Scope of access authorized. Note that this can be different from the
         * scopes requested by the app.
         */
        scope: string,

        /**
         * Lifetime in seconds of the access token, after which the token SHALL NOT
         * be accepted by the resource server
         */
        expires_in ?: number;

        /**
         * The access token issued by the authorization server
         */
        access_token: string;

        /**
         * Authenticated patient identity and profile, if requested
         */
        id_token ?: string;

        /**
         * Token that can be used to obtain a new access token, using the same or a
         * subset of the original authorization grants
         */
        refresh_token ?: string;

        /**
         * Other properties might be passed by the server
         */
        [key: string]: any;
    }

    /**
     * The three security endpoints that SMART servers might declare in the
     * conformance statement
     */
    interface OAuthSecurityExtensions {

        /**
         * You could register new SMART client at this endpoint (if the server
         * supports dynamic client registration)
         */
        registrationUri: string;

        /**
         * You must call this endpoint to ask for authorization code
         */
        authorizeUri: string;

        /**
         * You must call this endpoint to exchange your authorization code
         * for an access token.
         */
        tokenUri: string;
    }

    /**
     * Simple key/value storage interface
     */
    interface Storage {
        
        /**
         * Sets the `value` on `key` and returns a promise that will be resolved
         * with the value that was set.
         */
        set: (key: string, value: any) => Promise<any>;
        
        /**
         * Gets the value at `key`. Returns a promise that will be resolved
         * with that value (or undefined for missing keys).
         */
        get: (key: string) => Promise<any>;

        /**
         * Deletes the value at `key`. Returns a promise that will be resolved
         * with true if the key was deleted or with false if it was not (eg. if
         * did not exist).
         */
        unset: (key: string) => Promise<boolean>;
    }

    /**
     * HTTP Request object that have been augmented with a session
     */
    interface HttpRequestWithSession extends IncomingMessage {
        session: {
            [key: string]: any;
        };
    }

    interface IDToken {
        profile: string;
        aud: string;
        sub: string;
        iss: string;
        iat: number;
        exp: number;
        [key: string]: any;
    }

    interface FhirBundle {
        link: FhirBundleNavLink[];
        entry?: FhirBundleEntry[];
    }

    interface FhirBundleNavLink {
        relation: string;
        url: string;
    }

    interface FhirBundleEntry {
        fullUrl: string; // This is optional on POSTs
        resource?: {
            [key: string]: any;
        }
    }
}
