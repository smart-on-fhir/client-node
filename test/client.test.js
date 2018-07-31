const { expect } = require("code");
const { it, describe } = exports.lab = require("lab").script();
const lib = require("../lib/lib");
const axios = require("axios");
const Client = require("../lib/client").default;
const jwt = require("jsonwebtoken");

function getDummyStorage(initialState = {}) {
    const __SESSION = { ...initialState };
    return {
        set(key, value) {
            __SESSION[key] = value;
            return Promise.resolve(value);
        },
        get(key) {
            if (!key) {
                return Promise.resolve(__SESSION);
            }
            return Promise.resolve(__SESSION[key]);
        },
        unset(key) {
            if (__SESSION.hasOwnProperty(key)) {
                delete __SESSION[key];
                return Promise.resolve(true);
            }
            return Promise.resolve(false);
        }
    };
}

describe("Client", () => {
    describe("constructor", () => {
        it("throws if no state is given", () => {
            expect(() => new Client()).to.throw("No state provided to the client")
        });
    });

    describe("request", () => {
        it ("the url defaults to the serverUrl", () => {
            return new Client({ serverUrl: "https://r3.smarthealthit.org" }).request().then(
                () => {
                    throw new Error("This should have failed!");
                },
                error => {
                    expect(error.message).to.include('This is the base URL of FHIR server')
                }
            )
        });

        it ("accepts url string", () => {
            return new Client({ serverUrl: "https://r3.smarthealthit.org" }).request("/Patient").then(
                result => {
                    expect(result.data.resourceType).to.equal("Bundle");
                }
            )
        });

        it ("accepts options object", () => {
            return new Client({ serverUrl: "https://r3.smarthealthit.org" }).request({ url: "/Patient" }).then(
                result => {
                    expect(result.data.resourceType).to.equal("Bundle");
                }
            )
        });

        it ("handles OperationOutcome errors", () => {
            return new Client({ serverUrl: "https://r3.smarthealthit.org" }).request("/Patient/dddd").then(
                () => {
                    throw new Error("This should have failed!");
                },
                error => {
                    expect(error.message).to.include('Resource Patient/dddd is not known')
                }
            )
        });

        it ("handles other errors", () => {
            const client = new Client({ serverUrl: "http://devnull" });
            return client.request("/Patient/dddd")
            .then(
                () => {
                    throw new Error("This should have failed!");
                },
                error => {
                    expect(error.message).to.include('No response received from the FHIR server')
                }
            )
            .then(() => {
                client.state.serverUrl = null;
                return client.request("/Patient/dddd")
            })
            .then(() => {
                throw new Error("This should have failed!");
            })
            .catch(() => "OK")
        });

        it ("rejects invalid access tokens", () => {
            return new Client({
                serverUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                tokenResponse: {
                    access_token: "x"
                }
            }).request("/Patient").then(
                () => {
                    throw new Error("This should have failed!");
                },
                error => {
                    expect(error.response.status).to.equal(401)
                    expect(error.response.statusText).to.equal("Unauthorized")
                    expect(error.response.data).to.equal('JsonWebTokenError: jwt malformed');
                }
            )
        });

        it ("tries to use the refresh token on 401", () => {
            let refreshCalled = 0;

            const client = new Client({
                serverUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                tokenResponse: {
                    access_token: "x",
                    refresh_token: "y"
                }
            });

            client.refresh = function() {
                refreshCalled += 1;
                if (this.state.tokenResponse && this.state.tokenResponse.refresh_token) {
                    delete this.state.tokenResponse.refresh_token;
                }
                return Promise.resolve(this);
            };

            return client.request("/Patient").then(
                () => { throw new Error("This should have failed!"); },
                () => { expect(refreshCalled).to.equal(1); }
            );
        });
    });

    describe("refresh", () => {
        it ("rejects with no state.tokenResponse", () => {
            return new Client({}).refresh().then(
                () => { throw new Error("This should have failed!"); },
                error => {
                    expect(error.message).to.equal("Trying to refresh but there is no refresh token")
                }
            )
        });

        it ("rejects with no state.tokenResponse.refresh_token", () => {
            return new Client({ tokenResponse: {} }).refresh().then(
                () => { throw new Error("This should have failed!"); },
                error => {
                    expect(error.message).to.equal("Trying to refresh but there is no refresh token")
                }
            )
        });

        it ("deletes invalid refresh tokens", () => {
            const client = new Client({
                serverUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                tokenUri: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/token",
                tokenResponse: {
                    access_token : "x",
                    refresh_token: "y"
                }
            });

            return client.refresh().then(
                () => {
                    throw new Error("This should have failed!");
                },
                () => {
                    expect(client.state.tokenResponse.refresh_token).to.not.exist()
                }
            )
        });

        it ("handles other errors", () => {
            const client = new Client({
                serverUrl: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                tokenUri: null,
                tokenResponse: {
                    access_token : "x",
                    refresh_token: "y"
                }
            });

            return client.refresh().then(() => {
                throw new Error("This should have failed!");
            }).catch(() => "ok");
        });

        it ("works as expected", async () => {

            let client;

            const storage = getDummyStorage();

            const request = {
                url: "/?launch=123&iss=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                connection: {},
                headers: { host : "whatever" }
            };

            const options = {
                clientId   : "myTestApp",
                redirectUri: "http://whatever",
                scope: "offline_access"
            };

            const authUrl = await lib.buildAuthorizeUrl(request, options, storage);

            return axios({
                url: authUrl,
                maxRedirects: 0
            })
            .then(
                () => { throw new Error("This should have produced a redirect response") },
                result => {
                    expect(result.response.status).to.equal(302)
                    expect(result.response.headers.location).to.exist();
                    return result.response.headers.location;
                }
            )
            .then(redirectUrl => {
                const req = {
                    url: redirectUrl
                };
                return lib.completeAuth(req, storage);
            })
            .then(_client => {
                client = _client;
                return client.refresh();
            })
            .then(() => {
                expect(client.state.tokenResponse.refresh_token).to.exist();
            })
        });
    });
    describe ("getIdToken", async () => {
        it ("returns null if if the client is not authorized", async () => {
            expect(new Client({}).getIdToken()).to.equal(null);
        });
        it ("returns null if if the profile is not available", async () => {
            expect(new Client({ tokenResponse: {} }).getIdToken()).to.equal(null);
        });
        it ("returns null if if the client is not authorized yet", async () => {
            expect(new Client({ authorizeUri: "whatever" }).getIdToken()).to.equal(null);
        });
        it ("returns null if if the client is authorized but has no id_token", async () => {
            expect(new Client({ tokenResponse: {}, scope: "openid connect" }).getIdToken()).to.equal(null);
        });
        it ("returns null if if the client is authorized but has no openid scope", async () => {
            expect(new Client({ tokenResponse: {}, scope: "connect" }).getIdToken()).to.equal(null);
        });
        it ("returns null if if the client is authorized but has no connect scope", async () => {
            expect(new Client({ tokenResponse: {}, scope: "openid" }).getIdToken()).to.equal(null);
        });
        it ("works", async () => {
            expect(new Client({
                tokenResponse: {
                    id_token: jwt.sign({ foo: 'bar' }, "secret")
                }
            }).getIdToken().foo).to.equal('bar');
        });
    });

    describe ("getUserProfile", () => {
        it ("returns null if if the client is not authorized", async () => {
            expect(new Client({}).getUserProfile()).to.equal(null);
        });
        it ("returns null if if the profile is not available", async () => {
            expect(new Client({ tokenResponse: {} }).getUserProfile()).to.equal(null);
        });
        it ("works as expected", async () => {
            expect(new Client({
                tokenResponse: {
                    id_token: jwt.sign({ profile: 'Practitioner/CORE-PRACTITIONER-1' }, "secret")
                }
            }).getUserProfile()).to.equal('Practitioner/CORE-PRACTITIONER-1');
        })
    });

    describe ("getUserId", () => {
        it ("returns null if if the client is not authorized", async () => {
            expect(new Client({}).getUserId()).to.equal(null);
        });
        it ("returns null if if the profile is not available", async () => {
            expect(new Client({ tokenResponse: {} }).getUserId()).to.equal(null);
        });
        it ("works as expected", async () => {
            expect(new Client({
                tokenResponse: {
                    id_token: jwt.sign({ profile: 'Practitioner/CORE-PRACTITIONER-1' }, "secret")
                }
            }).getUserId()).to.equal('CORE-PRACTITIONER-1');
        })
    });

    describe ("getUserType", () => {
        it ("returns null if if the client is not authorized", async () => {
            expect(new Client({}).getUserType()).to.equal(null);
        });
        it ("returns null if if the profile is not available", async () => {
            expect(new Client({ tokenResponse: {} }).getUserType()).to.equal(null);
        });
        it ("works as expected", async () => {
            expect(new Client({
                tokenResponse: {
                    id_token: jwt.sign({ profile: 'Practitioner/CORE-PRACTITIONER-1' }, "secret")
                }
            }).getUserType()).to.equal('Practitioner');
        })
    });
});