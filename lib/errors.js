"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    "": "Unknown error",
    unknown_error: "Unknown error",
    missing_url_parameter: `Missing url parameter "%s"`,
    missing_state_by_id: `No state found using the given id: "%s".`,
    missing_state_redirectUri: "Missing state.redirectUri",
    missing_state_tokenUri: "Missing state.tokenUri",
    missing_state_clientId: "Missing state.clientId",
    no_fhir_response: "No response received from the FHIR server",
    no_server_url_provided: "Cannot detect which FHIR server to launch against. " +
        "For EHR launch call your endpoint with 'launch' " +
        "and 'iss' parameters. For standalone launch pass " +
        "'fhirServiceUrl' parameter or set it as 'serverUrl'" +
        "in your configuration."
};
