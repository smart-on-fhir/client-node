const http   = require('http');
const smart  = require('../lib/lib');
const Client = require('../lib/client').default;
const Url    = require("url");

const smartOnFhirOptions = {
    scope      : "openid profile offline_access",
    clientId   : "31488081-2a0f-467d-8888-ef53a3d5fe24",
    redirectUri: "/"
};

// Dummy Global Memory Storage - for demo purposes ONLY! -----------------------
const __SESSION = {};
const storage = {
    set(key, value) {
        __SESSION[key] = value;
        return Promise.resolve(value);
    },
    get(key) {
        return Promise.resolve(__SESSION[key]);
    },
    unset(key) {
        if (request.session.hasOwnProperty(key)) {
            delete __SESSION[key];
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
};
// -----------------------------------------------------------------------------

const server = http.createServer((req, res) => {
    const url = Url.parse(req.url, true);
    switch (url.pathname) {
        
        // The redirectURI -----------------------------------------------------
        case "/":

            if (url.query.code && url.query.state) {
                return smart.completeAuth(req, storage).then(() => {
                    // On success redirect back to itself to get rid of url.query
                    res.writeHead(303, { Location: "/" });
                    return res.end();
                });
            }

            const id = __SESSION.smartId || "";
            const state = __SESSION[id];

            // Perhaps the server was restarted or lost it's session for some other reason
            if (!state) { 
                console.log("No state found in session");
                res.writeHead(303, { Location: "/demo" });
                return res.end();
            }

            const client = new Client(state);

            client.request("/Patient").then(result => {
                res.setHeader("Content-type", "text/html");
                res.end(
                    '<a href="/logout">Logout</a>' +
                    '<hr/>' +
                    '<pre>' + JSON.stringify(result.data, null, 4)
                        .replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</pre>'
                );
            });
            break;

        // The launchURI -------------------------------------------------------
        case "/demo":
            if (!url.query.fhirServiceUrl) {
                res.setHeader("Content-type", "text/html");
                return res.end(
                    '<form>' +
                    '<label>Fhir Server URL: </label>' +
                    '<input value="http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir" name="fhirServiceUrl" size="100">' +
                    '<button type="submit">Go</button>' +
                    '</form>'
                );
            }
            smart.authorize(req, res, smartOnFhirOptions, storage);
            break;

        // logout --------------------------------------------------------------
        case "/logout":
            for (let id in __SESSION) {
                delete __SESSION[id]
            }
            res.writeHead(303, { Location: "/demo" });
            res.end()
            break;

        // Anything else is 404 ------------------------------------------------
        default:
            res.writeHead(404);
            res.end("Cannot get " + url.pathname);
            break;
    }
});

server.listen(3000);
