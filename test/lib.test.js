const { expect } = require("code");
const { it, describe } = exports.lab = require("lab").script();
const lib = require("../lib/lib");
const Url = require("url");
const axios = require("axios");

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

describe("lib", () => {

    describe("getPath", () => {
        it ("returns the first arg if no path", () => {
            const data = {}
            expect(lib.getPath(data)).to.equal(data);
        })
        it ("returns the first arg for empty path", () => {
            const data = {}
            expect(lib.getPath(data, "")).to.equal(data);
        })
        it ("works as expected", () => {
            const data = {a:1, b:[0, {a:2}]}
            expect(lib.getPath(data, "b.1.a")).to.equal(2);
            expect(lib.getPath(data, "b.4.a")).to.equal(undefined);
        })
    });

    describe("printf", () => {
        it ("works as expected", () => {
            expect(lib.printf("aaaa")).to.equal("aaaa");
            expect(lib.printf("")).to.equal("");
            expect(lib.printf()).to.equal("");
            expect(lib.printf("a%sa%sa%s", "b", "c", "d", "e")).to.equal("abacad");
            expect(lib.printf("a%sa%sa%s", "b", "c")).to.equal("abaca");
        })
    });

    describe("getErrorText", () => {
        it ("works as expected", () => {
            expect(lib.getErrorText("unknown_error")).to.equal("Unknown error");
            expect(lib.getErrorText("")).to.equal("Unknown error");
            expect(lib.getErrorText()).to.equal("Unknown error");
            expect(lib.getErrorText("missing_url_parameter", "test")).to.equal(`Missing url parameter "test"`);
        })
    });

    describe("HttpError", () => {
        describe("constructor", () => {
            it("The message defaults to 'Unknown error'", () => {
                const error = new lib.HttpError();
                expect(error.message).to.equal("Unknown error")
            })
            it("The httpCode defaults to 500", () => {
                const error = new lib.HttpError();
                expect(error.httpCode).to.equal(500)
            })
            it("The httpCode can be set", () => {
                const error = new lib.HttpError("", 444);
                expect(error.httpCode).to.equal(444)
            })
            it("Variable substitution works", () => {
                const error = new lib.HttpError("missing_url_parameter", 400, "test");
                expect(error.message).to.equal(`Missing url parameter "test"`)
            })
        })
    });

    describe("getSecurityExtensions", { timeout: 15000 }, () => {
        it ("Works without arguments", async() => {
            const extensions = await lib.getSecurityExtensions();
            expect(extensions).to.equal({
                registrationUri : "",
                authorizeUri    : "",
                tokenUri        : ""
            })
        });

        it ("Works with HSPC", { timeout: 5000 }, async() => {
            const extensions = await lib.getSecurityExtensions("https://api-stu3.hspconsortium.org/STU301withSynthea/data");
            expect(extensions).to.equal({
                registrationUri : "https://auth.hspconsortium.org/register",
                authorizeUri    : "https://auth.hspconsortium.org/authorize",
                tokenUri        : "https://auth.hspconsortium.org/token"
            });
        });

        it ("Works with R3 - Protected", async() => {
            const extensions = await lib.getSecurityExtensions("http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir");
            expect(extensions).to.equal({
                registrationUri : "",
                authorizeUri    : "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/authorize",
                tokenUri        : "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/token"
            });
        });

        it ("Works with R3 - Open", async() => {
            const extensions = await lib.getSecurityExtensions("http://r3.smarthealthit.org");
            expect(extensions).to.equal({
                registrationUri : "",
                authorizeUri    : "",
                tokenUri        : ""
            });
        });
    });

    describe("resolveUrl", () => {
        it ("works as expected", () => {
            let req = {
                connection: {
                    encrypted: true
                },
                headers: {
                    host: "localhost"
                }
            };

            expect(lib.resolveUrl(req, "")).to.equal("https://localhost/")
            expect(lib.resolveUrl(req, "/")).to.equal("https://localhost/")
            expect(lib.resolveUrl(req, "./")).to.equal("https://localhost/")
            expect(lib.resolveUrl(req, "../")).to.equal("https://localhost/")
            expect(lib.resolveUrl(req, "..")).to.equal("https://localhost/")
            expect(lib.resolveUrl(req, "../..")).to.equal("https://localhost/")
            expect(lib.resolveUrl(req, "../../")).to.equal("https://localhost/")
            expect(lib.resolveUrl(req, "../../a")).to.equal("https://localhost/a")
            expect(lib.resolveUrl(req, "../../b")).to.equal("https://localhost/b")
            expect(lib.resolveUrl(req, "b")).to.equal("https://localhost/b")
            expect(lib.resolveUrl(req, "/b")).to.equal("https://localhost/b")
            expect(lib.resolveUrl(req, "/a/b")).to.equal("https://localhost/a/b")

            req.connection.encrypted = false

            expect(lib.resolveUrl(req, "")).to.equal("http://localhost/")
            expect(lib.resolveUrl(req, "/")).to.equal("http://localhost/")
            expect(lib.resolveUrl(req, "./")).to.equal("http://localhost/")
            expect(lib.resolveUrl(req, "../")).to.equal("http://localhost/")
            expect(lib.resolveUrl(req, "..")).to.equal("http://localhost/")
            expect(lib.resolveUrl(req, "../..")).to.equal("http://localhost/")
            expect(lib.resolveUrl(req, "../../")).to.equal("http://localhost/")
            expect(lib.resolveUrl(req, "../../a")).to.equal("http://localhost/a")
            expect(lib.resolveUrl(req, "../../b")).to.equal("http://localhost/b")
            expect(lib.resolveUrl(req, "b")).to.equal("http://localhost/b")
            expect(lib.resolveUrl(req, "/b")).to.equal("http://localhost/b")
            expect(lib.resolveUrl(req, "/a/b")).to.equal("http://localhost/a/b")
        })
    });

    describe("buildAuthorizeUrl", () => {
        it ("Rejects if no serverUrl can be found", () => {
            const req = { url: "" };
            return lib.buildAuthorizeUrl(req, {}).then(
                () => { throw new Error("This should have failed"); },
                error => expect(error.message.indexOf("Cannot detect which FHIR server to launch")).to.equal(0)
            )
        });

        it ("Works with open servers", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever/?iss=abc&launch=123",
                connection: {},
                headers: {
                    host : "something"
                }
            };
            const options = { redirectUri: "/xyz" }
            return lib.buildAuthorizeUrl(request, options, storage).then(
                url => {
                    expect(url).to.equal("http://something/xyz");
                }
            )
        })

        it ("Works with query.fhirServiceUrl parameter", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever/?fhirServiceUrl=abc",
                connection: {},
                headers: { host : "something" }
            };
            const options = { redirectUri: "/xyz" }
            return lib.buildAuthorizeUrl(request, options, storage).then(
                url => {
                    expect(url).to.equal("http://something/xyz");
                }
            )
        })

        it ("Works with options.serverUrl parameter", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever",
                connection: {},
                headers: { host : "something" }
            };
            const options = { redirectUri: "/xyz", serverUrl: "abc" }
            return lib.buildAuthorizeUrl(request, options, storage).then(
                url => {
                    expect(url).to.equal("http://something/xyz");
                }
            )
        })

        it ("requires 'launch' param if 'iss' is used", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever?iss=abc",
                connection: {},
                headers: { host : "something" }
            };
            const options = {
                redirectUri: "/xyz"
            };
            return lib.buildAuthorizeUrl(request, options, storage)
                .then(
                    () => { throw new Error("This should have failed"); },
                    error => expect(error.message).to.equal(`Missing url parameter "launch"`)
                );
        });

        it ("clears previous state", () => {
            const storage = getDummyStorage({
                smartId: "oldId",
                oldId: {
                    x: "whatever"
                }
            });
            const request = {
                url: "http://whatever/?iss=abc&launch=123",
                connection: {},
                headers: {
                    host : "something"
                }
            };
            const options = { redirectUri: "/xyz" };
            return lib.buildAuthorizeUrl(request, options, storage)
                .then(() => storage.get())
                .then(data => {
                    const smartId = data.smartId;
                    expect(smartId).to.not.equal("oldId")
                    expect(data.oldId).to.equal(undefined)
                });
        })

        it ("Works with clientSecret", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever/?iss=abc&launch=123",
                connection: {},
                headers: {
                    host : "something"
                }
            };
            const options = {
                redirectUri: "/xyz",
                clientSecret: "a1b2"
            }
            return lib.buildAuthorizeUrl(request, options, storage)
                .then(() => storage.get())
                .then(data => {
                    const smartId = data.smartId;
                    expect(data[smartId].clientSecret).to.equal("a1b2")
                });
        })

        it ("Works with protected servers", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever?launch=123&iss=" + encodeURIComponent("http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"),
                connection: {},
                headers: { host : "something" }
            };
            const options = { redirectUri: "/xyz" };
            return lib.buildAuthorizeUrl(request, options, storage).then(
                url => {
                    const _url = Url.parse(url, true);
                    expect(_url.hostname).to.equal('launch.smarthealthit.org')
                    expect(_url.pathname).to.equal('/v/r3/sim/eyJhIjoiMSJ9/auth/authorize')
                    expect(_url.query.response_type).to.equal("code")
                    expect(_url.query.scope).to.equal('');
                    expect(_url.query.redirect_uri).to.equal('http://something/xyz');
                    expect(_url.query.aud).to.equal('http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir');
                }
            )
        });

        it ("Works with protected servers standalone", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever?fhirServiceUrl=" + encodeURIComponent("http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"),
                connection: {},
                headers: { host : "something" }
            };
            const options = { redirectUri: "/xyz" };
            return lib.buildAuthorizeUrl(request, options, storage).then(
                url => {
                    const _url = Url.parse(url, true);
                    expect(_url.hostname).to.equal('launch.smarthealthit.org')
                    expect(_url.pathname).to.equal('/v/r3/sim/eyJhIjoiMSJ9/auth/authorize')
                    expect(_url.query.response_type).to.equal("code")
                    expect(_url.query.scope).to.equal('');
                    expect(_url.query.redirect_uri).to.equal('http://something/xyz');
                    expect(_url.query.aud).to.equal('http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir');
                }
            )
        });
    });

    describe("authorize", { timeout: 5000 }, () => {
        it ("works as expected", () => {
            const storage = getDummyStorage();
            const request = {
                url: "http://whatever?launch=123&iss=" + encodeURIComponent("http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir"),
                connection: {},
                headers: { host : "something" }
            };
            const options = { redirectUri: "/xyz" };
            const res = {
                writeHead(code, headers) {
                    this.code = code
                    this.headers = { ...(this.headers || {}), ...headers }
                },
                end() {
                    this.ended = true
                }
            };
            return lib.authorize(request, res, options, storage).then(
                () => {
                    expect(res.ended).to.equal(true)
                    expect(res.code).to.equal(302)
                    const url = Url.parse(res.headers.location, true)
                    expect(url.hostname).to.equal('launch.smarthealthit.org')
                    expect(url.pathname).to.equal('/v/r3/sim/eyJhIjoiMSJ9/auth/authorize')
                    expect(url.query.response_type).to.equal("code")
                    expect(url.query.scope).to.equal('');
                    expect(url.query.redirect_uri).to.equal('http://something/xyz');
                    expect(url.query.aud).to.equal('http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir');
                }
            )
        })
    });

    describe("buildTokenRequest", () => {
        it ("rejects if no state is found", () => {
            const storage = getDummyStorage();
            const request = { url: "http://whatever?state=abc" };
            return lib.buildTokenRequest(request, storage).then(
                () => { throw new Error("This should have failed"); },
                error => expect(error.message).to.equal(
                    `No state found using the given id: "abc".`
                )
            );
        });
        it ("rejects if there is no redirectUri in state", () => {
            const storage = getDummyStorage({ abc: {} });
            const request = { url: "http://whatever?state=abc" };
            return lib.buildTokenRequest(request, storage).then(
                () => { throw new Error("This should have failed"); },
                error => expect(error.message).to.equal(`Missing state.redirectUri`)
            );
        });
        it ("rejects if there is no tokenUri in state", () => {
            const storage = getDummyStorage({ abc: { redirectUri: "a" } });
            const request = { url: "http://whatever?state=abc" };
            return lib.buildTokenRequest(request, storage).then(
                () => { throw new Error("This should have failed"); },
                error => expect(error.message).to.equal(`Missing state.tokenUri`)
            );
        });
        it ("rejects if there is no clientId in state", () => {
            const storage = getDummyStorage({ abc: { redirectUri: "a", tokenUri: "b" } });
            const request = { url: "http://whatever?state=abc" };
            return lib.buildTokenRequest(request, storage).then(
                () => { throw new Error("This should have failed"); },
                error => expect(error.message).to.equal(`Missing state.clientId`)
            );
        });
        it ("works as expected", () => {
            const storage = getDummyStorage({
                abc: {
                    redirectUri: "a",
                    tokenUri   : "b",
                    clientId   : "c"
                }
            });
            const request = { url: "http://whatever?state=abc" };
            return lib.buildTokenRequest(request, storage).then(
                options => {
                    expect(options).to.equal({
                        method: 'POST',
                        url: 'b',
                        headers: {
                            'content-type': 'application/x-www-form-urlencoded'
                        },
                        data: {
                            code: undefined,
                            grant_type: 'authorization_code',
                            redirect_uri: 'a',
                            client_id: 'c'
                        }
                    })
                }
            );
        });
        it ("works with clientSecret", () => {
            const storage = getDummyStorage({
                abc: {
                    redirectUri : "a",
                    tokenUri    : "b",
                    clientId    : "c",
                    clientSecret: "d"
                }
            });
            const request = { url: "http://whatever?state=abc" };
            return lib.buildTokenRequest(request, storage).then(
                options => {
                    expect(options.headers.Authorization).to.equal("Basic Yzpk")
                }
            );
        });
    });

    describe("handleTokenError", () => {
        it ("works as expected", () => {
            const error = lib.handleTokenError({ message: "This is a test" });
            expect(error.message).to.equal("This is a test");
            expect(error.httpCode).to.equal(500);
        });

        it ("message can be set", () => {
            const error = lib.handleTokenError({ message: "whatever" });
            expect(error.message).to.equal("whatever");
        });

        it ("catches 'error' property in response payloads", () => {
            const error = lib.handleTokenError({
                message: "whatever",
                response: {
                    data: {
                        error: "This is a test error"
                    }
                }
            });
            expect(error.message).to.equal("whatever\nThis is a test error");
        });

        it ("catches 'error_description' property in response payloads", () => {
            const error = lib.handleTokenError({
                message: "whatever",
                response: {
                    data: {
                        error: "This is a test error",
                        error_description: "This is a test error description"
                    }
                }
            });
            expect(error.message).to.equal("whatever\nThis is a test error: This is a test error description");
        });

        it ("catches errors from string payloads", () => {
            const error = lib.handleTokenError({
                message: "whatever",
                response: {
                    data: "This is a test error"
                }
            });
            expect(error.message).to.equal("whatever\nThis is a test error");
        });
    });

    describe("completeAuth", { timeout: 5000 }, () => {
        it ("handles errors", { timeout: 5000 }, () => {
            const storage = getDummyStorage({
                abc: {
                    redirectUri: "/",
                    tokenUri: "http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/auth/token",
                    clientId: "x"
                }
            });
            const req = { url: "/?state=abc" };
            return lib.completeAuth(req, storage).then(
                () => { throw new Error("This should have failed"); },
                (e) => {
                    expect(e.message).to.equal("Request failed with status code 401\nInvalid token: jwt must be provided");
                    return true
                }
            )
        });

        it ("works as expected", { timeout: 5000 }, async () => {
            const storage = getDummyStorage();

            const request = {
                url: "/?launch=123&iss=http://launch.smarthealthit.org/v/r3/sim/eyJhIjoiMSJ9/fhir",
                connection: {},
                headers: { host : "whatever" }
            };

            const options = {
                clientId   : "myTestApp",
                redirectUri: "http://whatever"
            };

            const authUrl = await lib.buildAuthorizeUrl(request, options, storage);

            return axios({
                url: authUrl,
                maxRedirects: 0
            }).then(
                () => { throw new Error("This should have produced a redirect response") },
                result => {
                    expect(result.response.status).to.equal(302)
                    expect(result.response.headers.location).to.exist();
                    return result.response.headers.location;
                }
            ).then(redirectUrl => {
                const req = {
                    url: redirectUrl
                };
                return lib.completeAuth(req, storage);
            })
        });
    });

    describe("getBundleURL", () => {
        it ("returns null if there are no links", () => {
            expect(lib.getBundleURL({})).to.equal(null);
        });
        it ("returns null if there is no next link", () => {
            expect(lib.getBundleURL({ link: [] })).to.equal(null);
        });
    });
});
