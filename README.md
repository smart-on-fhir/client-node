# SMART Client for NodeJS

[![CircleCI](https://circleci.com/gh/smart-on-fhir/client-node.svg?style=svg)](https://circleci.com/gh/smart-on-fhir/client-node)
[![codecov](https://codecov.io/gh/smart-on-fhir/client-node/branch/master/graph/badge.svg)](https://codecov.io/gh/smart-on-fhir/client-node)

### High-level API
In this mode you create a framework-specific API that is easier to use. Currently,
we have adapters for Express and HAPI. Pull requests are welcome for other frameworks.
Here is how to use that:
```js
const smart = require("smart-client/adapters/express")(options);
// or
const smart = require("smart-client/adapters/hapi")(options);
```
Then just use the `smart.authorize` or other methods as described in their manuals:
- [Express](docs/express.md)
- [HAPI](docs/hapi.md)


### Low-level API

In this mode you start by creating one configuration (`options`) object and one
`storage` object (that implements [The storage interface](docs/storage.md))
and pass those as parameters for the functions as shown below.

#### `authorize(request, response, options, storage)`
This function should be called when you have a request to an URL with
`launch` and `iss` parameters or alternatively a `fhirServiceUrl` parameter.
When you launch your app from outside (from an EHR or a test launcher like
https://launch.smarthealthit.org), your `launchUri` endpoint will be called
with `launch` and `iss` parameters. Than you can use this function to initiate
the launch sequence. An **express** example might look like this:
```js
const smart = require("smart-client");
// ...
app.get("/launch", (req, res) => smart.authorize(req, res, options, storage));
```


#### `completeAuth(request, storage)`
The login function above will redirect the browser to the authorization endpoint
of the SMART server. Depending on the requested scopes, the user might be asked
to select a patient or practitioner, authorize the app and so on. Eventually, the
user will be redirected back to your site at your `options.redirectUri`. At that
point you should have received a code that needs to be exchanged for an access
token. To do so, you can use the `completeAuth` function like so (express example):
```js
const smart = require("smart-client");
// ...
app.get("/redirect", (req, res) => {
    smart.completeAuth(req, storage)
        .then(client => client.request("/Patient"))
        .then(result => res.json(result.data))
        .catch(error => res.status(500).send(error.stack));
})
```


### Configuration Options
The following options are supported:
- **`clientId`** - *string, **required*** - The Client ID that you were given after registering your app with the authorization server.
- **`redirectUri`** - *string, **required*** - The location to redirect to, once the user have authorized the launch.
- **`serverUrl`** - *string, optional* - The base URL of the Fhir server. If you specify this in your options you will be able to call your launchUri endpoint without any parameters and it will initiate a standalone launch sequence against this server. You can also pass a `fhirServiceUrl` query parameter to your launchUri endpoint which will take precedence over the config option value. Finally, if your launch endpoint is called with `iss` and `launch` parameters (which will happen when launched from EHR), `iss` will become the used server and the `fhirServiceUrl` url parameter (if any) and the `serverUrl` option (if any) will be ignored.
- **`scope`** - *string, optional* - Space-separated list of scopes as described in http://docs.smarthealthit.org/authorization/scopes-and-launch-context/. Strictly speaking, this is option is not required but you will typically want access to certain resources and the scope should be used to request that access.
- **`clientSecret`** - *string, optional* If you registered your app as confidential client you should have been given a `clientSecret` that you have to set here.
- **`getStorage(request)`** - *function, optional* A function that will return a custom storage object. See *The storage interface* below for details.

Use these options while creating a SMART api:
```js
const smart = require("smart-client/adapters/express")({
    scope      : "openid profile offline_access",
    redirectUri: "/",
    clientId   : "my-client-id"
});
// ...
```
or you just pass them to functions if you prefer the low-level api:
```js
const smart = require("smart-client");
const options = {
    scope      : "openid profile offline_access",
    redirectUri: "/",
    clientId   : "my-client-id"
};
smart.authorize(req, res, options, storage)
// ...
```

### Contribution and development
This library is written in typescript and the framework adapters are written in pure JavaScript. For best development experience you might want to have a few terminals running (`cd` into the project folder first):
- `npm run build:watch` - will watch TS files for changes and automatically re-build the JS versions in /lib.
- `npm run test:watch` - will run tests on any change so that if you introduce an issue you will know immediately.
- `npm start` - will run the node example on http://localhost:3000
    - `npm run start:express` - will run the express example on http://localhost:3000. You will have to do `cd examples/express && npm i` when you run this for the first time.
    - `npm run start:hapi` - will run the HAPI example on http://localhost:3000. You will have to do `cd examples/hapi && npm i` when you run this for the first time.
- `npm run build` or `npm test` if you want to build or test on demand instead of in watch mode.

#### Debugging
This library uses the `debug` module to log specific SMART information. In development mode you might want to enable that before starting a server like so:
```sh
DEBUG=smart npm run start:express
```
