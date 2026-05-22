/* eslint-disable no-empty-function, no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* LIB_DEFINITION{
  "name": "LIB_GR_CUSTOMIZATION_CLIENT_SAMPLE",
  "libraryType": "Lib",
  "scriptType": "CLIENT",
  "comment": "Custom library extending Goods Receipt scripts on client side",
  "versionable": false,
  "require": [
    "Sys/Sys",
    "Sys/SYS_HELPERS_DATA",
    "Sys/SYS_HELPERS_DATE",
    "Sys/Sys_GenericAPI_Client"
  ]
}*/
/**
 * Package Good Receipt client script customization callbacks
 * @namespace Lib.GR.Customization.Client
 */
var Lib;
(function (Lib) {
    var GR;
    (function (GR) {
        var Customization;
        (function (Customization) {
            var Client;
            (function (Client) {
                /**
                 * @method Lib.GR.Customization.Client.CustomizeLayout
                 * @description Allows you to customize the Goods Receipt process form. This user exit is called from the HTML page script of the Goods Receipt process, after loading the form.
                 * 		This user exit is typically used to customize:
                 * 			Objects from the included script libraries.
                 * 			Objects from the HTML page script.
                 * @since 127
                 * @example
                 * The following user exit hides the z_ProjectCode__ field.
                 * <pre><code>
                 *	CustomiseLayout: function ()
                 *	{
                 *		Controls.LineItems__.z_ProjectCode__.Hide(true);
                 *		Controls.LineItems__.z_ProjectCode__.SetReadOnly(true);
                 *	}
                 * </code></pre>
                 *
                 */
                Client.CustomizeLayout = function () {
                };
                /**
                 * @method Lib.GR.Customization.Client.IsDeliveryDateValid
                 * @description Asynchronously checks if the delivery date is valid. This user exit is called from the HTML page script when the delivery date changes and when the form is submitted.
                 * @param {Date} deliveryDate The delivery date to check.
                 * Errors on fields should be set and reset via the user exit, as it won't be managed by standard code if the UE is active
                 * @returns {boolean} True if the delivery date is valid, false otherwise.
                 * @since 329
                 * @example
                 * The following UE allows item receipt only if
                 *	- the GR delivery date is in the past or
                 *	- the item is amount-based, has the item category "Services", and the GR delivery date matches its requested receipt date
                 * <pre><code>
                 *
                 *export const IsDeliveryDateValid = async function (date: Date): Promise<boolean>
                 *{
                 *	let dateIsValid = true;
                 *	let lineItems = Data.GetTable("LineItems__");
                 *	if (Sys.Helpers.Date.CompareDateToToday(date) > 0)
                 *	{
                 *		let orderNumber = Data.GetValue("OrderNumber__");
                 *		let tableAsObjectArray = Sys.Helpers.Data.GetTableAsObjectArray(lineItems, ["LineNumber__", "ItemType__", "ReceivedQuantity__", "NetAmount__", "RequestedDeliveryDate__"]);
                 *		let map_DateIsValid = {}
                 *		for (const item of tableAsObjectArray)
                 *		{
                 *			//Item with no quantity to received are considered as valid
                 *			map_DateIsValid[item["LineNumber__"].toString()] = (item.NetAmount__ == 0 || item.NetAmount__ == null) && (item.ReceivedQuantity__ == 0 || item.ReceivedQuantity__ == null);
                 *		}
                 *
                 *		//Amount based item with item category equal to "Services" can be received in advance on their requested delivery date
                 *		let itemToQuery = tableAsObjectArray
                 *			.filter((item) =>
                 *				item.ItemType__ === "AmountBased"
                 *				&& item.NetAmount__ > 0
                 *				&& item.RequestedDeliveryDate__.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0) === 0)
                 *			.map((item) => item.LineNumber__.toString());
                 *		if (itemToQuery.length > 0)
                 *		{
                 *			const POItemsQueryOptions = {
                 *				table: "CDLNAME#Purchase order V2.LineItems__",
                 *			attributes: ["OrderNumber__", "Line_LineItemNumber__", "Line_SupplyTypeId__"],
                 *			filter: Sys.Helpers.LdapUtil.FilterAnd(
                 *					Sys.Helpers.LdapUtil.FilterEqual("OrderNumber__", orderNumber),
                 *					Sys.Helpers.LdapUtil.FilterIn("Line_LineItemNumber__", itemToQuery)
                 *				),
                 *				maxRecords: "NO_LIMIT",
                 *			};
                 *			await Sys.GenericAPI.PromisedQuery(POItemsQueryOptions)
                 *				.then((result) =>
                 *				{
                 *					return result.forEach(
                 *						(poLine) =>
                 *							poLine.Line_SupplyTypeId__.toLowerCase() === "4" ? map_DateIsValid[poLine.Line_LineItemNumber__] = true : map_DateIsValid[poLine.Line_LineItemNumber__] = false);
                 *				});
                 *		}
                 *		Log.Info("[Lib.GR.Customization.Client.IsDeliveryDateValid]" + JSON.stringify(map_DateIsValid));
                 *		dateIsValid = Object.values(map_DateIsValid).every((value) => value === true);
                 *	}
                 *
                 *	if (dateIsValid)
                 *	{
                 *		// Reset the error message if the date is valid
                 *		Data.SetError("DeliveryDate__", "");
                 *	}
                 *	else
                 *	{
                 *		// Set the error message if the date is invalid
                 *		Data.SetError("DeliveryDate__", "Only services items can be received in advance on their requested delivery date.");
                 *	}
                 *	return dateIsValid;
                 *};
                 * </code></pre>
                 *
                 */
                Client.IsDeliveryDateValid = async function (date) {
                    return true;
                };
            })(Client = Customization.Client || (Customization.Client = {}));
        })(Customization = GR.Customization || (GR.Customization = {}));
    })(GR = Lib.GR || (Lib.GR = {}));
})(Lib || (Lib = {}));
//# sourceMappingURL=LIB_GR_CUSTOMIZATION_CLIENT_SAMPLE.js.map