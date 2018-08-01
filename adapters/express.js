const smart = require("../lib");


module.exports = function(options) {
    const cfg = { getStorage: smart.getSessionStorage, ...options };

    // Return the Express-specific high-level API
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
         * @param {Object} res
         * @param {Function} next
         */
        authorize(req, res, next) {
            let { launch, iss, fhirServiceUrl } = req.query;
            if ((launch && iss) || fhirServiceUrl || cfg.serverUrl) {
                return smart.authorize(req, res, cfg, cfg.getStorage(req));
            }
            next();
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
         * @param {Object} res
         * @param {Function} next
         */
        completeAuth(req, res, next) {
            let { code, state, error, error_description } = req.query;
            if (error) {
                let msg = error + (error_description ? ":\n" + error_description : "");
                return res.end(msg);
            }
            if (code && state) {
                return smart.completeAuth(req, cfg.getStorage(req))
                    .then(
                        () => res.redirect(cfg.redirectUri),
                        e => {
                            res.writeHead(e.httpCode || 500, { 'Content-Type': 'text/plain' });
                            res.end(e.message, "utf8");
                        }
                    );
            }
            next();
        },

        /**
         * You don't typically need to use this because if you have a refresh
         * token (which you should if your scope includes `offline_access`),
         * then the request method will automatically use it when your access
         * token expires.
         * @param {Object} req
         * @param {Object} res
         * @param {Function} next
         */
        async refreshAuth(req, res, next) {
            const client = await this.getClient(req);

            // Perhaps the server was restarted or lost it's session for some other reason
            if (!client) {
                return res.end("No smart state found in session. Please re-authorize your app.")
            }

            return client.refresh().then(() => next(), error => res.end(error.message));
        }
    }
};
