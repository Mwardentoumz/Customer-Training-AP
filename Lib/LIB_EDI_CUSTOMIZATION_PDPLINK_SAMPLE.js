/* eslint-disable no-empty-function, no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* LIB_DEFINITION{
  "name": "LIB_EDI_CUSTOMIZATION_PDPLINK_SAMPLE",
  "scriptType": "SERVER",
  "libraryType": "Lib",
  "comment": "Customization library for PDP link features",
  "versionable": false,
  "require": []
}*/
/**
 * Customization library for PDP link feature.
 * @namespace Lib.EDI.Customization.PDPLink
 */
var Lib;
(function (Lib) {
    var EDI;
    (function (EDI) {
        var Customization;
        (function (Customization) {
            var PDPLink;
            (function (PDPLink) {
                /**
                 * @method Lib.EDI.Customization.PDPLink.CustomizeOAuth2TokenRequest
                 * @since 352
                 * @description
                 * Callback used by PDP OAuth2 authentication to customize the token request parameters
                 * before calling the token endpoint.
                 *
                 * This sample shows how to disable basic authentication and pass client credentials
                 * in the request body (data) instead.
                 *
                 * Return the updated params to apply changes. Return `undefined` to keep default params.
                 *
                 * @param {Sys.GenericAPI.HTTPRequestParam} httpParams Default token request parameters.
                 * @returns {Sys.GenericAPI.HTTPRequestParam | void} Updated token request parameters.
                 * @example
                 * <pre><code>
                 * CustomizeOAuth2TokenRequest: function (httpParams)
                 * {
                 * 	const clientId = httpParams.user;
                 * 	const clientSecret = httpParams.password;
                 *
                 * 	delete httpParams.authentType;
                 * 	delete httpParams.user;
                 * 	delete httpParams.password;
                 *
                 * 	httpParams.data = `${httpParams.data || "grant_type=client_credentials"}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
                 * 	return httpParams;
                 * }
                 * </code></pre>
                 */
                PDPLink.CustomizeOAuth2TokenRequest = function (httpParams) {
                };
                /**
                 * @method Lib.EDI.Customization.PDPLink.CustomizeFetchUnprocessedInvoicesQueryParam
                 * @since 353
                 * @description
                 * Callback used to customize the HTTP query parameters sent to PDP when searching
                 * unprocessed invoices in `fetchUnprocessedInvoices`.
                 *
                 * Return the updated params to apply changes. Return `undefined`/`null` to keep default params.
                 * Mutating the input object without returning it is not supported.
                 *
                 * @param {Sys.GenericAPI.HTTPRequestParam} queryParam Default HTTP query parameters.
                 * @returns {Sys.GenericAPI.HTTPRequestParam | void} Updated HTTP query parameters.
                 * @example
                 * <pre><code>
                 * CustomizeFetchUnprocessedInvoicesQueryParam: function (queryParam)
                 * {
                 * 	queryParam.headers["X-Custom-Header"] = "Invoices";
                 * 	return queryParam;
                 * }
                 * </code></pre>
                 */
                PDPLink.CustomizeFetchUnprocessedInvoicesQueryParam = function (queryParam) {
                };
                /**
                 * @method Lib.EDI.Customization.PDPLink.CustomizeFetchUnprocessedCDVsQueryParam
                 * @since 353
                 * @description
                 * Callback used to customize the HTTP query parameters sent to PDP when searching
                 * unprocessed CDVs in `fetchUnprocessedCDVs`.
                 *
                 * Return the updated params to apply changes. Return `undefined`/`null` to keep default params.
                 * Mutating the input object without returning it is not supported.
                 *
                 * @param {Sys.GenericAPI.HTTPRequestParam} queryParam Default HTTP query parameters.
                 * @returns {Sys.GenericAPI.HTTPRequestParam | void} Updated HTTP query parameters.
                 * @example
                 * <pre><code>
                 * CustomizeFetchUnprocessedCDVsQueryParam: function (queryParam)
                 * {
                 * 	queryParam.headers["X-Custom-Header"] = "CDVs";
                 * 	return queryParam;
                 * }
                 * </code></pre>
                 */
                PDPLink.CustomizeFetchUnprocessedCDVsQueryParam = function (queryParam) {
                };
                /**
                 * @method Lib.EDI.Customization.PDPLink.CustomizeFetchSelfBilledInvoicesQueryParam
                 * @since 353
                 * @description
                 * Callback used to customize the HTTP query parameters sent to PDP when searching
                 * self-billed invoices in `fetchSelfBilledInvoices`.
                 *
                 * Return the updated params to apply changes. Return `undefined`/`null` to keep default params.
                 * Mutating the input object without returning it is not supported.
                 *
                 * @param {Sys.GenericAPI.HTTPRequestParam} queryParam Default HTTP query parameters.
                 * @returns {Sys.GenericAPI.HTTPRequestParam | void} Updated HTTP query parameters.
                 * @example
                 * <pre><code>
                 * CustomizeFetchSelfBilledInvoicesQueryParam: function (queryParam)
                 * {
                 * 	queryParam.headers["X-Custom-Header"] = "SelfBilled";
                 * 	return queryParam;
                 * }
                 * </code></pre>
                 */
                PDPLink.CustomizeFetchSelfBilledInvoicesQueryParam = function (queryParam) {
                };
                /**
                 * @method Lib.EDI.Customization.PDPLink.CustomizeFetchUnprocessedEReportingsQueryParam
                 * @since 353
                 * @description
                 * Callback used to customize the HTTP query parameters sent to PDP when searching
                 * unprocessed e-reportings in `fetchUnprocessedEReportings`.
                 *
                 * Return the updated params to apply changes. Return `undefined`/`null` to keep default params.
                 * Mutating the input object without returning it is not supported.
                 *
                 * @param {Sys.GenericAPI.HTTPRequestParam} queryParam Default HTTP query parameters.
                 * @returns {Sys.GenericAPI.HTTPRequestParam | void} Updated HTTP query parameters.
                 * @example
                 * <pre><code>
                 * CustomizeFetchUnprocessedEReportingsQueryParam: function (queryParam)
                 * {
                 * 	queryParam.headers["X-Custom-Header"] = "EReportings";
                 * 	return queryParam;
                 * }
                 * </code></pre>
                 */
                PDPLink.CustomizeFetchUnprocessedEReportingsQueryParam = function (queryParam) {
                };
                /**
                 * @method Lib.EDI.Customization.PDPLink.OnCreateInvoiceFailure
                 * @description
                 * Callback function called when an invoice retrieval/creation fails after maximum retry attempts.
                 * @param {string} invoiceId Invoice id of the failed invoice (Flux id for SG5)
                 * @example
                 * <pre><code>
                 * OnCreateInvoiceFailure: function (invoiceId)
                 * {
                 * 	const email = Process.CreateTransport("mail");
                 * 	const emailVars = email.GetUninheritedVars();
                 * 	emailVars.AddValue_String("Subject", "Retrieve invoice from PDP failure", true);
                 * 	emailVars.AddValue_String("emailAddress", "user1@example.com", true);
                 * 	emailVars.AddValue_String("Message", `Invoice id: ${invoiceId}`, true);
                 * 	email.Process();
                 * }
                 * </code></pre>
                 */
                PDPLink.OnCreateInvoiceFailure = function (invoiceId) {
                };
            })(PDPLink = Customization.PDPLink || (Customization.PDPLink = {}));
        })(Customization = EDI.Customization || (EDI.Customization = {}));
    })(EDI = Lib.EDI || (Lib.EDI = {}));
})(Lib || (Lib = {}));
//# sourceMappingURL=LIB_EDI_CUSTOMIZATION_PDPLink_SAMPLE.js.map