# Using the SMART client with Express

**IMPORTANT!** This module assumes that you use `express-session` in your app.
However, it does not matter how you configure the session and what storage mechanism
you are using for that. If you are not using `express-session`, then you will have to
create a custom storage (see [storage interface](https://github.com/smart-on-fhir/client-node/blob/master/docs/storage.md) below for details).

#### `authorize(req, res, next)`
This is typically used as handler for your launchUri:
```js
const express = require("express");
const session = require("express-session");
const app = express();
const smart = require("smart-client/adapters/express")({
    scope      : "openid profile offline_access",
    redirectUri: "/",
    clientId   : "my-client-id"
});

app.use(session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false,
}));

app.get("/launch", smart.authorize)

app.listen(3000);
```
In this example the `/launch` endpoint should be called with `iss` and `launch` query
parameters. The middleware will redirect you to the authorization URL for the
given (as `iss` parameter) FHIR server. If that happens to be an open server
you will be redirected directly to your `options.redirectUri` which is `/` in
this example.

Alternatively, the `/launch` endpoint can be called with `fhirServiceUrl`
parameter instead of `iss` and `launch` (or you can use options.serverUrl)
which will initiate a standalone launch sequence.

If there is something wrong with the query parameters the `authorize`
middleware will not redirect the user for authorization. You can add another
function to the chain to handle such cases. For example this will give the user
a chance to re-try with the entered FHIR Server URL:
```js
app.get("/launch", smart.authorize, (req, res) => {
    return res.type('html').end(
        '<form>' +
            '<label>Fhir Server URL: </label>' +
            '<input value="http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir" name="fhirServiceUrl" size="100">' +
            '<button type="submit">Go</button>' +
        '</form>'
    );
});
```

### `completeAuth(req, res, next)`
The `authorize` function above will redirect the browser to the authorization
endpoint of the SMART server. Depending on the requested scopes, the user might be
asked to select a patient or practitioner, authorize the app and so on. Eventually,
the user will be redirected back to your site at your `options.redirectUri`. At that
point you should have received a code that needs to be exchanged for an access
token. To do so, you can use the `completeAuth` middleware like so:
```js

// This is the smartOnFhirOptions.redirectUri endpoint
app.get("/", smart.completeAuth, async (req, res) => {
    const client = await smart.getClient(req);

    // Perhaps the server was restarted or lost it's session for some other reason
    if (!client) { 
        return res.end("No client found in session");
    }
    
    const result = await client.request("/Patient");
    res.json(result.data);
});
```

### `getClient(req)`
See the snippet above for usage example. Given a request object this function will
return a Promise that will eventually be resolved with a SMART Client object or with
`null` if there is a problem. It will lookup the storage for stored SMART state.
If such state is found, it will create and return a SMART Client instance that knows
how to use that (automatically authorize any requests made with `client.request`,
use clientSecret and refresh tokens etc.). See the [Client API](client.md) for details.

### `refreshAuth(req, res, next)`
You don't typically need to use this because if ou have a refresh token (which
you should if your scope includes `offline_access`), then the request method
will automatically use it when your access token expires. If you still want to
refresh manually you can use it like so:
```js
app.get("/refresh", refreshAuth, async (req, res) => {
    
    // Get the "refreshed" client and use it as usual
    const client = await smart.getClient(req);

    // Perhaps the server was restarted or lost it's session for some other reason
    if (!client) { 
        return res.end("No client found in session");
    }
    
    const result = await client.request("/Patient");
    res.json(result.data);
});
```
