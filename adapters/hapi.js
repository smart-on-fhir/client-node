const smart  = require("../lib");


module.exports = function(options) {
    const cfg = { getStorage: smart.getSessionStorage, ...options };

    // Return the HAPI-specific high-level API
    return {

        /**
         * Given a request object this function will return a Promise that will
         * eventually be resolved with a Fhir Client object or with `null` if
         * there is a problem. It will lookup the storage for stored SMART state.
         * If such state is found, it will create and return a Fhir Client
         * instance that knows how to use that (automatically authorize any
         * requests made with `client.request`, use clientSecret and refresh
         * tokens etc.).
         * @param {Object} request
         * @returns {Promise<Client|null>}
         */
        async getClient(request) {
            const storage = cfg.getStorage(request);
            const id = await storage.get("smartId");
            if (id) {
                const state = await storage.get(id);
                if (state) {
                    return new smart.Client(state);
                }
            }
            return null;
        },

        /**
         * If the fhir server base can be determined (from query.iss or
         * query.fhirServiceUrl or options.serverUrl), then the user will be
         * redirected to the authorization endpoint (or to your redirectUri if
         * it happens to be an open server). Otherwise, the `next` callback
         * will be called.
         * @param {Object} req
         * @param {Object} h
         * @returns {Promise<any>|Symbol}
         */
        authorize(req, h) {
            let { launch, iss, fhirServiceUrl } = req.query;
            if ((launch && iss) || fhirServiceUrl || cfg.serverUrl) {
                return smart.buildAuthorizeUrl(req.raw.req, cfg, cfg.getStorage(req))
                    .then(url => h.redirect(url));
            }
            return h.continue;
        },

        /**
         * The `authorize` function above will redirect the browser to the
         * authorization endpoint of the SMART server. Depending on the requested
         * scopes, the user might be asked to select a patient or practitioner,
         * authorize the app and so on. Eventually, the user will be redirected
         * back to your site at your `options.redirectUri`. At that point you
         * should have received a code that needs to be exchanged for an access
         * token.
         * @param {Object} req
         * @param {Object} h
         * @returns {Promise<any>|Symbol}
         */
        completeAuth(req, h) {
            let { code, state, error, error_description } = req.query;
            if (error) {
                throw new Error(error + (error_description ? ":\n" + error_description : ""));
            }
            if (code && state) {
                return smart.completeAuth(req.raw.req, cfg.getStorage(req))
                    .then(() => h.redirect(cfg.redirectUri));
            }
            return h.continue;
        },

        /**
         * You don't typically need to use this because if you have a refresh
         * token (which you should if your scope includes `offline_access`),
         * then the request method will automatically use it when your access
         * token expires.
         * @param {Object} request
         * @param {Object} h
         */
        async refreshAuth(request, h) {
            const client = await this.getClient(request);

            // Perhaps the server was restarted or lost it's session for some other reason
            if (!client) {
                throw new Error("No smart state found in session. Please re-authorize your app.");
            }

            return client.refresh().then(() => h.continue, error => { throw error });
        }
    };
}

