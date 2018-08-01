# Using the SMART client with Hapi

[Working Example](../examples/hapi-patients-list.js)

**IMPORTANT!** This module assumes that you use `hapi-server-session` in your app.
However, it does not matter how you configure the session and what storage mechanism
you are using for that. If you are not using `hapi-server-session`, then you will
have to create a custom storage. See [The storage interface](storage.md) for
details.

#### `authorize(request, h)`
This is typically used as handler for your `launchUri`:
```js
const Hapi = require("hapi");
const smart = require("smart-client/adapters/hapi")({
    scope      : "openid profile offline_access",
    redirectUri: "/",
    clientId   : "my-client-id"
});

const server = Hapi.server({ port: 3000 });

server.route({ method: "GET", path: "/launch", handler: smart.authorize });

async function start() {
    try {
        await server.register({ plugin: require("hapi-server-session") });
        await server.start();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }
    console.log('Server running at:', server.info.uri);
};

start();

```
In this example the `/launch` endpoint should be called with `iss` and `launch` query
parameters. The handler will redirect you to the authorization URL for the
given (as `iss` parameter) FHIR server. If that happens to be an open server
you will be redirected directly to your `options.redirectUri` which is `/` in
this example.

Alternatively, the `/launch` endpoint can be called with `fhirServiceUrl`
parameter instead of `iss` and `launch` (or you can use options.serverUrl)
which will initiate a standalone launch sequence.

If there is something wrong with the query parameters the `authorize` function
will not redirect the user for authorization but will return `h.continue` instead.
The following example this will give the user a chance to re-try with the entered
FHIR Server URL:
```js
server.route({ method: "GET", path: "/launch", handler(request, h) => {
    if (!request.query.fhirServiceUrl) {
        return (
            '<form>' +
                '<label>Fhir Server URL: </label>' +
                '<input value="http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir" name="fhirServiceUrl" size="100">' +
                '<button type="submit">Go</button>' +
            '</form>'
        );
    }
    return smart.authorize(request, h);
});
```

### `completeAuth(request, h)`
The `authorize` function above will redirect the browser to the authorization
endpoint of the SMART server. Depending on the requested scopes, the user might be
asked to select a patient or practitioner, authorize the app and so on. Eventually,
the user will be redirected back to your site at your `options.redirectUri`. At that
point you should have received a code that needs to be exchanged for an access
token. To do so, you can use the `completeAuth` function like so:
```js
// This is the smartOnFhirOptions.redirectUri endpoint
server.route({ method: "GET", path: "/", async handler(request, h) {
    if (request.query.code && request.query.state) {
        return smart.completeAuth(request, h);
    }

    const client = await smart.getClient(request);

    // Perhaps the server was restarted or lost it's session for some other reason
    if (!client) { 
        throw new Error("No client found in session");
    }

    return client.request("/Patient").then(result => result.data);
}});
```

### `getClient(request)`
See the snippet above for usage example. Given a request object this function will
return a Promise that will eventually be resolved with a SMART Client object or with
`null` if there is a problem. It will lookup the storage for stored SMART state.
If such state is found, it will create and return a SMART Client instance that knows
how to use that (automatically authorize any requests made with `client.request`,
use clientSecret and refresh tokens etc.). See the [Client API](client.md) for details.

### `refreshAuth(request, h)`
You don't typically need to use this because if ou have a refresh token (which
you should if your scope includes `offline_access`), then the request method
will automatically use it when your access token expires. If you still want to
refresh manually you can use it like so:
```js
server.route({ method: "GET", path: "/refresh", async handler(request, h) => {
    
    await smart.refreshAuth(request);

    // Get the "refreshed" client and use it as usual
    const client = await smart.getClient(req);
    const result = await client.request("/Patient");
    return result.data;
});
```
