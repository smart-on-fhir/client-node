/**
 * This is an example of how the SMART Client can be used with vanilla JS app.
 * @author Vladimir Ignatov <vlad.ignatov@gmail.com>
 */
const http    = require('http');
const fs      = require("fs");
const Url     = require("url");
const Session = require("./session");
const smart   = require('../../lib');

const smartOnFhirOptions = {
    scope      : "openid profile offline_access",
    clientId   : "31488081-2a0f-467d-8888-ef53a3d5fe24",
    redirectUri: "/"
};

function handleLaunchUri(req, res) {
    let session = Session.fromRequest(req) || new Session()
    res.setHeader("Set-Cookie", session.cookie);
    if (!req.query.fhirServiceUrl) {
        res.setHeader("Content-type", "text/html");
        return res.end(fs.readFileSync(__dirname + "/../form.html"));
    }
    smart.authorize(req, res, smartOnFhirOptions, session);
}

function handleRedirectUri(req, res) {
    const session = Session.fromRequest(req) || new Session();
    res.setHeader("Set-Cookie", session.cookie);

    if (req.query.code && req.query.state) {
        return smart.completeAuth(req, session).then(() => {
            // On success redirect back to itself to get rid of url.query
            res.writeHead(303, { Location: "/" });
            return res.end();
        });
    }

    const id = session.data.smartId || "";
    const state = session.data[id];

    // Perhaps the server was restarted or lost it's session for some other reason
    if (!state) {
        console.log("No state found in session");
        res.writeHead(303, { Location: "/demo" });
        return res.end();
    }

    const client = new smart.Client(state);

    client.request("/Patient").then(result => {
        res.setHeader("Content-type", "text/html");
        res.end(
            '<a href="/logout">Logout</a><hr/><pre>' +
            JSON.stringify(result.data, null, 4).replace(/</g, "&lt;")
            .replace(/>/g, "&gt;") + '</pre>'
        );
    });
}

function handleLogout(req, res) {
    const session = Session.fromRequest(req);
    if (session) {
        session.destroy();
        res.setHeader("Set-Cookie", session.cookie);// delete it
    }
    res.writeHead(303, { location: "/demo" });
    res.end()
}

const server = http.createServer((req, res) => {
    const url = Url.parse(req.url, true);
    req.query = Url.parse(req.url, true).query;
    switch (url.pathname) {
        case "/":
            handleRedirectUri(req, res);
            break;
        case "/demo":
            handleLaunchUri(req, res);
            break;
        case "/logout":
            handleLogout(req, res);
            break;
        default:
            res.writeHead(404);
            res.end("Cannot get " + url.pathname);
            break;
    }
});

server.listen(3000);
