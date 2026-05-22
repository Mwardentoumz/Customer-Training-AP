/* eslint-disable no-empty-function, no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* LIB_DEFINITION{
  "name": "LIB_P2P_CUSTOMIZATION_CLIENT_SAMPLE",
  "libraryType": "Lib",
  "scriptType": "CLIENT",
  "comment": "Custom library extending P2P scripts",
  "versionable": false,
  "require": [
    "Sys/Sys"
  ]
}*/
/**
 * P2P packages script customization callbacks
 * @namespace Lib.P2P.Customization.Client
 */
var Lib;
(function (Lib) {
    var P2P;
    (function (P2P) {
        var Customization;
        (function (Customization) {
            var Client;
            (function (Client) {
                /**
                 * Specifics customization for conversation options
                 * @namespace Lib.P2P.Customization.Client.Conversation.Options
                 */
                let Conversation;
                (function (Conversation) {
                    let Options;
                    (function (Options) {
                        /**
                         * @method Lib.P2P.Customization.Client.Conversation.Options.GetDefault
                         * @since 312
                         * @description Allows you to customize options for external conversations.
                         *
                         * @param {IConversationUI_Option} options The default options for the conversation.
                         * @param {Lib.Purchasing.SenderType} senderType The type of the sender (IsSupplier or IsCustomer)
                         * @returns {IConversationUI_Option} The customized options for the conversation.
                         * @example
                         * Options.GetDefault = function (options, senderType) {
                         * 	if (senderType === Lib.Purchasing.SenderType.IsSupplier)
                         * 	{
                         * 		options.fromEmailAddress = "suppliernotification@eskerondemand.com";
                         * 	}
                         * 	else if(senderType === Lib.Purchasing.SenderType.IsCustomer)
                         * 	{
                         * 		options.fromEmailAddress = "customernotification@gmail.com";
                         * 	}
                         * 	return options;
                         * };
                         */
                        Options.GetDefault = function (options, senderType) {
                            return options;
                        };
                    })(Options = Conversation.Options || (Conversation.Options = {}));
                })(Conversation = Client.Conversation || (Client.Conversation = {}));
                /**
                 * Specifics customization for the P2P Browse
                 * @namespace Lib.P2P.Customization.Client.Browse
                 */
                Client.Browse = {
                    /**
                     * @method Lib.P2P.Customization.Client.Browse.OnInitializeEnd
                     * @since 324
                     * @description
                     * Use this function to customize browse control once they have been initialized in LIB_P2P_Browse.
                     * You can use it to customize browse controls, like redefine the customquery option, display condition or even configure custom fields.
                     * @param {Lib.ERP.Invoice.Instance<Lib.ERP.Manager.Instance>} erpInvoiceInstance instance of the ERP invoice
                     * @param {string} parameterInstance instance name of the application the browse init is called from ("AP" or "PAC")
                     * @param {string?} tableName (optional) - name of the table that contains browse fields (For vendor invoices: "LineItems__").
                     * @param {Lib.AP.Browse.BrowseConfigurations} sapConfigs SAP configurations
                     * @example
                     * Browse.OnInitializeEnd = function(erpInvoiceInstance, parameterInstance, tableName, sapConfigs)
                     * {
                     *   function IsBrowseControl(ctrlToTest) {
                     *       return ctrlToTest !== undefined && Sys.Helpers.IsFunction(ctrlToTest.ClearSearchFields);
                     *   }
                     *
                     *   if (IsBrowseControl(Controls.Z_Custom_Control__)) {
                     *      Lib.P2P.Customization.Common.Init(Controls.Z_Custom_Control__);
                     *   }
                     * };
                     */
                    OnInitializeEnd: function (erpInvoiceInstance, parameterInstance, tableName, sapConfigs) {
                    },
                    /**
                     * @method Lib.P2P.Customization.Client.Browse.GetCustomVendorFilter
                     * @since 338
                     * @description
                     * User exit to allow dynamic modification of the vendor filter in GetVendor function.
                     * This enables customizations to add additional filter criteria.
                     * @param {string} filter - The filter constructed by the standard logic
                     * @returns {void | string} - Modified filter to use instead of the original, or nothing to use the original filter
                     *
                     * @example <caption>Add MCU filter for Veolia concept</caption>
                     * Browse.GetCustomVendorFilter= function(filter)
                     * {
                     *     // Add custom MCU comparison filter
                     *     var customMCUFilter = "(Z_MCU__=VEOLIA_CONCEPT)";
                     *     return "(&" + filter + customMCUFilter + ")";
                     * }
                     */
                    GetCustomVendorFilter: function (filter) {
                        // Use the original filter unchanged
                    },
                    /**
                     * @method Lib.P2P.Customization.Client.Browse.ExtendBrowseUsersCriterias
                     * @since 340
                     * @description Use this function to add criteria in the browse page that add reviewer/approver to the workflow.
                     * The user exit CreateExtraFilterPromise must be called afterward to construct a filter based on those criterias
                     * @param {Sys.Helpers.Browse.SearchCriterion[]} searchCriterias the standard default search criterias.
                     * @returns {Sys.Helpers.Browse.SearchCriterion[]} The modified search criterias that will be used and displayed
                     * @example <caption>Add criterias in the add reviewer/approver browse page</caption>
                     * Common.ExtendBrowseUsersCriterias = function(searchCriterias)
                     * {
                     * 	searchCriterias.push({ id: "CompCodeFilter__", label: "Company Code", required: false, toUpper: false, visible: true, used: false, defaultValue: Data.GetValue("CompanyCode__")});
                     * 	searchCriterias.push({ id: "CostCenterFilter__", label: "Cost Center(s)", required: false, toUpper: false, visible: true, used: false});
                     *	return searchCriterias;
                     * };
                     */
                    ExtendBrowseUsersCriterias: function (searchCriterias) {
                    },
                    /**
                     * @method Lib.P2P.Customization.Client.Browse.CreateExtraFilterPromise
                     * @since 340
                     * @description create an extrafilter to be added to the browse query that look for reviewer/approver to add
                     * @param {Dialog} dialog the browse page Dialog
                     * @returns {Promise<string>} A promise that resolve a filter that will be added to the request.
                     * @example <caption>Based the filter on a query with the company code</caption>
                     * Common.CustomBrowseUsersRequest: function(dialog)
                     * {
                     *  var ldapUtil = Sys.Helpers.LdapUtil;
                     *	var table = "P2P - User properties__";
                     *	var attributes = ["UserLogin__", "AllowedCompanyCodes__"];
                     *	var compCode = dialog.GetControl("searchCriteria_CompCodeFilter__").GetValue();
                     *  var compCodeFilter = ldapUtil.FilterEqual("AllowedCompanyCodes__", compCode).toString();
                     *
                     *	function userPropertiesQuery()
                     *	{
                     *		return Sys.GenericAPI.PromisedQuery({
                     *			table: table,
                     *			filter: compCodeFilter,
                     *			attributes: attributes,
                     *			maxRecords: 100
                     *		});
                     *	}
                     *	function parsePropertiesResults(userPropertiesResults) {
                     *		var filters = [];
                     *		for (var recordIndex = 0; recordIndex < userPropertiesResults.length; recordIndex++)
                     *		{
                     *			var userID = userPropertiesResults[recordIndex].UserLogin__;
                     *			userID = userID.toLowerCase();
                     *			if (userID) {
                     *				var name = userID.substring(0, userID.lastIndexOf("@"));
                     *				filters.push(ldapUtil.FilterStartsWith("LOGIN", name));
                     *			}
                     *		}
                     *		if (filters.length === 0) {
                     * 			// No user should be returned, add a filter that always fails
                     *			filters.push(ldapUtil.FilterEqual("1", "0"));
                     *		}
                     *		return ldapUtil.FilterOr(...filters).toString();
                     *	}
                     *	return userPropertiesQuery().Then(parsePropertiesResults);
                     *}
                     */
                    CreateExtraFilterPromise: function (dialog) {
                    },
                    /**
                     * @method Lib.P2P.Customization.Client.Browse.CustomizeBrowseUsersColumns
                     * @since 342
                     * @description
                     * Allows you to customize the columns to request user information in BrowseUsers dialog.
                     * This user exit is called before the browse dialog is created, allowing you to add, remove, or modify column definitions.
                     * @param {Sys.Helpers.Browse.DisplayColumn[]} columns the standard columns array containing default column definitions
                     * @returns {Sys.Helpers.Browse.DisplayColumn[] | void} the customized columns array, or void to use the original columns
                     *
                     * @example <caption>Add custom Approver Amount column at second position</caption>
                     * Browse.CustomizeBrowseUsersColumns = function(columns)
                     * {
                     *		// Create custom column for approval amount limit
                     *		const customColumn = { id: "Z_ApproverAmount", label: "Amount Limit", type: "DECIMAL", width: 150 };
                     *
                     * 		// Add customColumn at second position of array columns
                     *		columns.splice(1, 0, customColumn);
                     *		return columns;
                     * }
                     */
                    CustomizeBrowseUsersColumns: function (columns) {
                    },
                    /**
                     * @method Lib.P2P.Customization.Client.Browse.OnRefreshUserRow
                     * @since 342
                     * @description
                     * Allows you to modify the User row display in the User Browse dialog during the refresh action.
                     * This user exit is called for each row when the browse dialog refreshes its data, allowing you to populate custom fields or modify row appearance.
                     * Only populate fields that were added via CustomizeBrowseUsersColumns. Standard columns are automatically populated.
                     * @param {BrowseUsersRow} row the table row to update
                     *
                     * @example <caption>Populate custom Approver Amount field from user properties</caption>
                     * Browse.OnRefreshUserRow = function(row)
                     * {
                     *		// Ensure custom column exists
                     * 		if (!row || !row.hasOwnProperty("Z_ApproverAmount")) {
                     * 			return; // Skip if custom column not present
                     * 		}
                     *
                     *		// Get user login for database lookup
                     *		let login = row.LOGIN ? row.LOGIN.GetValue() : null;
                     * 		if (!login) {
                     * 			Log.Warn("LOGIN column missing or empty in OnRefreshUserRow");
                     * 			return;
                     * 		}
                     *
                     *		// Check cache
                     *		let cache = {};
                     *		let usersAmountCache = Variable.GetValueAsString("Z_UsersAmountCache");
                     *		if (usersAmountCache) {
                     *			try {
                     *				cache = JSON.parse(usersAmountCache);
                     *				if (cache[login] && cache[login].amount !== undefined) {
                     *					row.Z_ApproverAmount.SetValue(cache[login].amount);
                     *					return; // Use cached value, avoid database query
                     *				}
                     *			} catch (e) {
                     *				Log.Warn("Failed to parse user amount cache: " + e.message);
                     *				Variable.SetValueAsString("Z_UsersAmountCache", "{}"); // Reset corrupted cache
                     *			}
                     *		}
                     *
                     * 		// Query database for user's approval limit
                     *		Query.DBQuery(function () {
                     *			let error = this.GetQueryError();
                     *			if (error) {
                     *				Log.Error("Failed to retrieve user approval amount: " + error);
                     *			} else if (this.GetRecordsCount() > 0) {
                     *				let amount = this.GetQueryValue("LOAAmount__", 0) || "0.00";
                     *				row.Z_ApproverAmount.SetValue(amount);
                     *
                     *				// Update cache
                     *				try {
                     *					usersAmountCache = Variable.GetValueAsString("Z_UsersAmountCache");
                     *					cache = usersAmountCache ? JSON.parse(usersAmountCache) : {};
                     *					cache[login] = { amount: amount };
                     *					Variable.SetValueAsString("Z_UsersAmountCache", JSON.stringify(cache));
                     *				} catch (e) {
                     *					Log.Warn("Failed to update user amount cache: " + e.message);
                     *				}
                     *			}
                     *		}, "P2P - User properties__", "LOAAmount__", "UserLogin__=" + login));
                     * }
                    */
                    OnRefreshUserRow: function (row) {
                    }
                };
                /**
                 * Specifics customization SAP Connected
                 * @namespace Lib.P2P.Customization.Client.SAP
                 */
                Client.SAP = {
                    /**
                     * @method Lib.P2P.Customization.Client.SAP.ComputeTotalsForGR
                     * @since 334
                     * @description
                     * This user exit allows to override the standard ComputeTotalsForGR method in charge of computing total amounts and quantities for the goods reception (Amounts are expressed in the refCurrency specified in the options).
                     * If the user exit returns a Promise<Lib.AP.SAP.PurchaseOrder.TotalsForGR> then the standard ComputeTotalsForGR is skipped and the Promise resolution is used instead.
                     * The server side synchronous version of the user exit should also be implemented in Lib.P2P.Customization.Server.SAP.ComputeTotalsForGR.
                     * @param {Lib.AP.SAP.PurchaseOrder.POItemHistory} purchaseItemHistory the current historic dealt with
                     * @param {Lib.AP.SAP.PurchaseOrder.POItemHistory[]} purchaseItemHistorics all retrieved historics for the current PO Item
                     * @param {Lib.AP.SAP.PurchaseOrder.POItemData} poItem the internal structure describing the PO Item
                     * @param {Lib.AP.SAP.PurchaseOrder.ComputeTotalsForGROptions} options options mainly for exchange rate computation
                     * @return {Promise<Lib.AP.SAP.PurchaseOrder.TotalsForGR>} A promise with the totals structure or null to apply the standard method
                     * @example <caption>Same as function ComputeTotalsForGR, except that purchaseItemHistoryKey and historyKey do not contain SERIAL_NO for Transport orders</caption>
                     * SAP.ComputeTotalsForGR: function (purchaseItemHistory, purchaseItemHistorics, poItem, options)
                     * {
                     * 	const totals = {
                     * 		totalInvoicedAmount: 0,
                     * 		totalInvoicedQty: 0,
                     * 		totalDeliveredAmount: 0,
                     * 		totalDeliveredQty: 0,
                     * 		reverse: false
                     * 	};
                     * 	let purchaseItemHistoryKey = purchaseItemHistory.PO_ITEM + purchaseItemHistory.REF_DOC + purchaseItemHistory.REF_DOC_IT + purchaseItemHistory.REF_DOC_YR;
                     * 	const computePromises: Promise<void>[] = [];
                     * 	for (let idx = 0; idx < purchaseItemHistorics.length; idx++)
                     * 	{
                     * 		let aPoItemHistory = purchaseItemHistorics[idx];
                     * 		let historyKey = void 0;
                     * 		if (purchaseItemHistory.SERIAL_NO === "00")
                     * 		{
                     * 			historyKey = aPoItemHistory.PO_ITEM + "00" + aPoItemHistory.REF_DOC + aPoItemHistory.REF_DOC_IT + aPoItemHistory.REF_DOC_YR;
                     * 		}
                     * 		else
                     * 		{
                     * 			historyKey = aPoItemHistory.PO_ITEM + aPoItemHistory.REF_DOC + aPoItemHistory.REF_DOC_IT + aPoItemHistory.REF_DOC_YR;
                     * 		}
                     * 		if (purchaseItemHistoryKey === historyKey)
                     * 		{
                     * 			totals.reverse = aPoItemHistory.HIST_TYPE === "E" && aPoItemHistory.DB_CR_IND === "H";
                     * 			if (aPoItemHistory.PROCESS_ID === "1")
                     * 			{
                     * 				const computePromise = Lib.AP.SAP.PurchaseOrder.ComputeTotalsOfGoodsReceipt(totals, aPoItemHistory, poItem, otpions);
                     * 				computePromises.push(computePromise);
                     * 			}
                     * 			else if (aPoItemHistory.PROCESS_ID === "2")
                     * 			{
                     * 				const computePromise = Lib.AP.SAP.PurchaseOrder.ComputeTotalsOfInvoicesReceipt(totals, aPoItemHistory, options);
                     * 				computePromises.push(computePromise);
                     * 			}
                     * 		}
                     * 	}
                     * 	return Sys.Helpers.Promise.All(computePromises)
                     * 		.Then((): Lib.AP.SAP.PurchaseOrder.TotalsForGR =>
                     * 		{
                     * 			return totals;
                     * 		});
                     * }
                    */
                    ComputeTotalsForGR: function (purchaseItemHistory, purchaseItemHistorics, poItem, options) {
                    }
                };
                /**
                 * @method Lib.P2P.Customization.Client.OverrideErrorType
                 * @since 331
                 * @description
                 * Use this function override an error or a warning.
                 * Important: You must remove the error from the item before setting a warning.
                 * @param {Item} item item that contains the field set in warning or error
                 * @param {string} message default message set on the field
                 * @param {boolean} isError (since sprint 334) flag set to true if it was by default considered as an error, if false it's considered as a warning
                 * @param {string} fieldName (since sprint 334) the field of the item on which the message was set
                 * @example
                 * <caption>Display an warning instead of an error for Quantity</caption>
                 * OverrideErrorType = function(item, message, isError, fieldName)
                 * {
                 *   if (fieldName === "Quantity__")
                 *   {
                 *     if (isError)
                 *     {
                 *   	  item.SetError("Quantity__", null);
                 * 	   }
                 *     item.SetWarning("Quantity__", message);
                 *   }
                 * };
                 */
                function OverrideErrorType(item, message, isError, fieldName) {
                }
                Client.OverrideErrorType = OverrideErrorType;
            })(Client = Customization.Client || (Customization.Client = {}));
        })(Customization = P2P.Customization || (P2P.Customization = {}));
    })(P2P = Lib.P2P || (Lib.P2P = {}));
})(Lib || (Lib = {}));
//# sourceMappingURL=LIB_P2P_CUSTOMIZATION_CLIENT_SAMPLE.js.map