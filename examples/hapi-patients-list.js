const Hapi  = require("hapi");
const smart = require("../lib/hapi")({
    scope      : "openid profile offline_access",
    clientId   : "31488081-2a0f-467d-8888-ef53a3d5fe24",
    redirectUri: "/"
});

const server = Hapi.server({ port: 3000 });

server.route({ method: "GET", path: "/demo", handler(request, h) {
    if (!request.query.fhirServiceUrl) {
        return (
            '<form>' +
            '<label>Fhir Server URL: </label>' +
            '<input value="http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir" name="fhirServiceUrl" size="100">' +
            '<button type="submit">Go</button>' +
            '</form>'
        );
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
        '<a href="/logout">Logout</a>' +
        '<hr/>' +
        '<pre>' + JSON.stringify(result.data, null, 4)
            .replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</pre>'
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
};

start();
