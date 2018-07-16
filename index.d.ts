
export namespace SMART {
    export interface objectLiteral {
        [key: string]: any;
    }

    export interface ClientOptions extends OAuthSecurityExtensions {
        serverUrl    ?: string;
        clientId      : string;
        redirectUri   : string;
        launchUri     : string;
        scope        ?: string;
        clientSecret ?: string;
        // access_token ?: string;
    }

    export interface ClientState extends OAuthSecurityExtensions {
        serverUrl     : string;
        clientId      : string;
        launchUri     : string;
        redirectUri   : string;
        scope         : string;
        clientSecret ?: string;
        access_token ?: string;
        tokenResponse?: TokenResponse;
    }

    export interface TokenResponse extends objectLiteral {
        need_patient_banner ?: boolean;
        smart_style_url     ?: string;
        patient             ?: string;
        encounter           ?: string;
        client_id           ?: string;

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
    }

    export interface OAuthSecurityExtensions {
        registrationUri : string;
        authorizeUri    : string;
        tokenUri        : string;
    }

    export interface HttpRequest {
        url: string;
        query?: objectLiteral;
        headers: objectLiteral;
        protocol: "http" | "https";
    }

    export interface HttpResponse {
        writeHead: (code: number, headers: objectLiteral) => void;
        end: (body?: string, encoding?: string) => void;
        send: (body: string) => HttpResponse;
        status: (code: number) => HttpResponse;
    }

    export interface SmartStorage {
        set: (key: string, value: any) => Promise<any>;
        get: (key: string) => Promise<any>;
        unset: (key: string) => Promise<any>;
    }
}
