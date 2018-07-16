const express = require("express");
const session = require("express-session");
const app = express();
const smart = require("../lib/express")({
    scope      : "openid profile offline_access",
    redirectUri: "/",

    // this is registered at https://auth.hspconsortium.org so that you can try
    // launching this app using https://api-stu3.hspconsortium.org/STU301withSynthea/data
    // as fhirServiceUrl
    clientId   : "31488081-2a0f-467d-8888-ef53a3d5fe24"
});

app.use(session({
    secret: 'my secret',
    resave: false,
    saveUninitialized: false
}));

// This is the smartOnFhirOptions.redirectUri endpoint
app.get("/", smart.completeAuth, async (req, res) => {
    const client = await smart.getClient(req);

    // Perhaps the server was restarted or lost it's session for some other reason
    if (!client) { 
        console.log("No client found in session");
        return res.redirect("/demo")
    }
    
    const result = await client.request("/Patient");
    res.type('html').end(
        '<a href="/logout">Logout</a>' +
        '<hr/>' +
        '<pre>' + JSON.stringify(result.data, null, 4)
            .replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</pre>'
    );
});

// This is the launchUri endpoint
app.get("/demo",  smart.authorize, (req, res) => {
    // this is ONLY invoked if smart.authorizeSmart did not redirect due to
    // missing parameters
    return res.type('html').end(
        '<form>' +
        '<label>Fhir Server URL: </label>' +
        '<input value="http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir" name="fhirServiceUrl" size="100">' +
        '<button type="submit">Go</button>' +
        '</form>'
    );
});

// Clear the session and start over
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/demo")
    });
});

app.listen(3000);
