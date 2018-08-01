/**
 * This is an example of how the SMART Client can be used with HAPI 17.
 * @author Vladimir Ignatov <vlad.ignatov@gmail.com>
 */
const Hapi  = require("hapi");
const fs    = require("fs");
const smart = require("smart-client/adapters/hapi")({
    scope      : "openid profile offline_access",
    clientId   : "31488081-2a0f-467d-8888-ef53a3d5fe24",
    redirectUri: "/"
});

const server = Hapi.server({ port: 3000 });

server.route({ method: "GET", path: "/demo", handler(request, h) {
    if (!request.query.fhirServiceUrl) {
        return fs.readFileSync(__dirname + "/../form.html", "utf8");
    }
    return smart.authorize(request, h)
}});

server.route({ method: "GET", path: "/logout", handler(request, h) {
    h.unstate("id")
    request.session = {};
    return h.redirect("/demo");
}});

server.route({ method: "GET", path: "/", async handler(request, h) {
    if (request.query.code && request.query.state) {
        return smart.completeAuth(request, h);
    }

    const client = await smart.getClient(request);

    // Perhaps the server was restarted or lost it's session for some other reason
    if (!client) {
        return h.redirect("/demo" );
    }

    return client.request("/Patient").then(result => (
        '<a href="/logout">Logout</a><hr/><pre>' +
        JSON.stringify(result.data, null, 4).replace(/</g, "&lt;")
        .replace(/>/g, "&gt;") + '</pre>'
    ));
}});

async function start() {
    try {
        await server.register({
            plugin: require("hapi-server-session"),
            options: {
                cookie: { isSecure: false }
            }
        });
        await server.start();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }

    console.log('Server running at:', server.info.uri);
}

start();
