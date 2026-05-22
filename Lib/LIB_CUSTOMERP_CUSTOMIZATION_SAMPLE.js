/* eslint-disable no-empty-function, no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* LIB_DEFINITION{
  "name": "LIB_CUSTOMERP_CUSTOMIZATION_SAMPLE",
  "scriptType": "SERVER",
  "libraryType": "Lib",
  "comment": "Server side script CustomERP User Exits",
  "versionable": false,
  "require": []
}*/
/**
 * Package AP HTML page script customization callbacks for all processes
 * @namespace Lib.CustomERP.Customization
 */
var Lib;
(function (Lib) {
    var CustomERP;
    (function (CustomERP) {
        var Customization;
        (function (Customization) {
            const ERPInfo = {
                ERP: Data.GetValue("ERP__"),
                CompanyCode: Data.GetValue("CompanyCode__")
            };
            /**
             * @namespace Lib.CustomERP.Customization.InvoiceExporter
             */
            Customization.InvoiceExporter = {
                /**
                 * @method Lib.CustomERP.Customization.InvoiceExporter.GetPostInvoiceCustomPayload
                 * @since 336
                 * @description
                 * Allows you to customize the payload sent when posting an invoice.
                 * This user exit is called from the validation script of the Vendor invoice process, when the invoice is posted.
                 * @param {any} invoiceJSON A JSON object representing the full data of the invoice.
                 * @param {any} defaultPostInvoicePayload A JSON object representing the default posting payload.
                 * @param {string} invoiceType The type of the invoice, e.g., "nonpoinvoice" or "poinvoice".
                 * @returns {any} A JSON object representing the customized posting payload, or nothing to use the default payload.
                 * @example <caption>This example replaces the order number with a custom field value when the invoice type is "poinvoice" & ERP is "CustomERP_ERP1-test". Instead, if ERP is "CustomERP_ERP2-test", it adds the tax amount and local tax amount as new parameters.</caption>
                 * GetPostInvoiceCustomPayload: function (invoiceJSON, defaultPostInvoicePayload, invoiceType)
                 * {
                 * 		if(ERPInfo.ERP === "CustomERP_ERP1-test" && invoiceType === "poinvoice")
                 * 		{
                 * 			defaultPostInvoicePayload.flexible.fields.OrderNumber = invoiceJSON.flexible.fields.Z_OrderNumber__;
                 * 		}
                 * 		else if(ERPInfo.ERP === "CustomERP_ERP2-test")
                 * 		{
                 * 			defaultPostInvoicePayload.flexible.fields.ExternalTaxAmount = invoiceJSON.flexible.fields.TaxAmount__ ;
                 * 			defaultPostInvoicePayload.flexible.fields.InternalTaxAmount = invoiceJSON.flexible.fields.LocalTaxAmount__ ;
                 * 		}
                 * 		return defaultPostInvoicePayload;
                 * }
                 */
                GetPostInvoiceCustomPayload: function (invoiceJSON, defaultPostInvoicePayload, invoiceType) {
                },
                /**
                 * @method Lib.CustomERP.Customization.InvoiceExporter.GetUnblockPaymentCustomPayload
                 * @since 336
                 * @description
                 * Allows you to customize the payload sent when unblocking a payment for an invoice.
                 * This user exit is called from the validation script of the Vendor invoice process, when the invoice is posted or when the payment is released.
                 * @param {any} invoiceJSON A JSON object representing the full data of the invoice.
                 * @param {any} defaultUnblockPaymentPayload A JSON object representing the default unblock payment payload.
                 * @returns {any} A JSON object representing the customized unblock payment payload, or nothing to use the default payload.
                 * @example <caption>This example adds the invoice type to the unblock payment payload.</caption>
                 * GetUnblockPaymentCustomPayload: function (invoiceJSON, defaultUnblockPaymentPayload)
                 * {
                 * 		defaultUnblockPaymentPayload.invoiceType = invoiceJSON.flexible.fields.InvoiceType__;
                 * 		return defaultUnblockPaymentPayload;
                 * }
                 */
                GetUnblockPaymentCustomPayload: function (invoiceJSON, defaultUnblockPaymentPayload) {
                }
            };
            /**
             * @method Lib.CustomERP.Customization.HandleCustomERPResponse
             * @since 336
             * @description
             * Allows you to customize the handling of the response of the invoice posting.
             * @param {any} response A JSON object representing the invoice posting response.
             * @returns {any} The ERP acknowledgement object with the ERP ID and any posting error. The expected structure is:
             * {
             *		"ERPAck": {
             *			"ERPID": string,
             *			"ERPPostingError": string
             *		}
             *	}
             * @example <caption>This example assume the structure of the response object contains a success property.</caption>
             * HandleCustomERPResponse: function (response)
             * {
             *		if (response && response.success)
             *		{
             *			return {
             *				"ERPAck": {
             *					"ERPID": response.id,
             *					"ERPPostingError": ""
             *				}
             *			};
             *		}
             *		if (response && response.error)
             *		{
             *			return {
             *				"ERPAck": {
             *					"ERPID": "",
             *					"ERPPostingError": response.error
             *				}
             *			};
             *		}
             *		return {
             *			"ERPAck": {
             *				"ERPID": "",
             *				"ERPPostingError": "_Error posting invoice in ERP"
             *			}
             *		};
             *	}
             * @example <caption>This example assumes we need to cater to different structures of different ERP for different company codes.</caption>
             * HandleCustomERPResponse: function (response)
             * {
             * 		if (ERPInfo.ERP === "CustomERP_ERP1-test" && ERPInfo.CompanyCode === "CC1")
             * 		{
             * 			// Custom logic for CustomERP_ERP1-test and CC1
             * 			if (response && response.success)
             * 			{
             *				return {
             *					"ERPAck": {
             *						"ERPID": response.id,
             *						"ERPPostingError": ""
             *					}
             *				};
             *			}
             *			return {
             *				"ERPAck": {
             *					"ERPID": "",
             *					"ERPPostingError": "Error posting to CustomERP_ERP1-test and CC1"
             *				}
             *			};
             * 		}
             * 		if (ERPInfo.ERP === "CustomERP_ERP2-test" && ERPInfo.CompanyCode === "CC2")
             * 		{
             * 			// Custom logic for CustomERP_ERP2-test and CC2
             * 			if (response && response.postingStatus)
             * 			{
             * 				return {
             *					"ERPAck": {
             *						"ERPID": response.erpId,
             *						"ERPPostingError": ""
             *					}
             *				};
             * 			}
             * 			return {
             *				"ERPAck": {
             *					"ERPID": "",
             *					"ERPPostingError": "Error posting to CustomERP_ERP2-test and CC2"
             *				}
             *			};
             * 		}
             * }
             */
            Customization.HandleCustomERPResponse = function (response) {
            };
            /**
             * @method Lib.CustomERP.Customization.HandleCustomUnblockPaymentResponse
             * @since 336
             * @description
             * Allows you to customize the handling of the response of the unblock payment request for an invoice.
             * @param {any} response A JSON object representing the unblock payment response.
             * @returns {{boolean, string}} A boolean indicating whether the payment was unblocked successfully or not, and an error message if it failed.
             * @example <caption>This example assume the structure of the response object contains a success property.</caption>
             * HandleCustomUnblockPaymentResponse: function (response)
             * {
             *		if (response && response.unblocked)
             *		{
             *			return { unblocked: response.unblocked, errorMsg: "" };
             *		}
             *		return { unblocked: false, errorMsg: "_Payment not unblocked in response data" };
             * }
             * @example <caption>This example assumes we need to cater to different structures of different ERP for different company codes.</caption>
             * HandleCustomUnblockPaymentResponse: function (response)
             * {
             * 		if (ERPInfo.ERP === "CustomERP_ERP1-test" && ERPInfo.CompanyCode === "CC1")
             * 		{
             * 			// Custom logic for CustomERP_ERP1-test and CC1
             * 			if (response && response.unblockedStatus)
             * 			{
             * 				return { unblocked: response.unblockedStatus, errorMsg: "" };
             * 			}
             * 			return { unblocked: false, errorMsg: "_Payment not unblocked in response data for CustomERP_ERP1-test and CC1" };
             * 		}
             * 		if (ERPInfo.ERP === "CustomERP_ERP2-test" && ERPInfo.CompanyCode === "CC2")
             * 		{
             * 			// Custom logic for CustomERP_ERP2-test and CC2
             * 			if (response && response.paymentBlockedStatus)
             * 			{
             * 				return { unblocked: response.paymentBlockedStatus, errorMsg: "" };
             * 			}
             * 			return { unblocked: false, errorMsg: "_Payment not unblocked in response data for ERP2 and CC2" };
             * 		}
             * }
             */
            Customization.HandleCustomUnblockPaymentResponse = function (response) {
            };
        })(Customization = CustomERP.Customization || (CustomERP.Customization = {}));
    })(CustomERP = Lib.CustomERP || (Lib.CustomERP = {}));
})(Lib || (Lib = {}));
//# sourceMappingURL=LIB_CUSTOMERP_CUSTOMIZATION_SAMPLE.js.map