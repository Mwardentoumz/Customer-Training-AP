/* eslint-disable @typescript-eslint/no-unused-vars */
/* LIB_DEFINITION{
  "name": "Lib_Budget_Management_Customization_Server_Sample",
  "libraryType": "Lib",
  "scriptType": "SERVER",
  "comment": "Custom library extending Budget Management scripts on SERVER side",
  "versionable": false,
  "require": [
    "Sys/Sys"
  ]
}*/
/**
 * Package Budget common script customization callbacks
 * @namespace Lib.Budget.Management.Customization.Server
 */
var Lib;
(function (Lib) {
    var Budget;
    (function (Budget) {
        var Management;
        (function (Management) {
            var Customization;
            (function (Customization) {
                var Server;
                (function (Server) {
                    /**
                     * @method Lib.Budget.Management.Customization.Server.OnExtractionScriptEnd
                     * @description Allows you to perform operations after the budget management process extraction.
                     * This user exit is called at the end of the extraction script.
                     * @since 311
                     * @param {string} currentAction String value specifying the type of action that triggered the execution of the script. This value is retrieved using the Processing scripts API: Data.GetActionType function.
                     * @param {string} currentName String value specifying the name of the action that triggered the execution of the script. This value is retrieved using the Processing scripts API: Data.GetActionName function.
                     * @example
                     * <pre><code>
                     *	OnExtractionScriptEnd: function (currentAction, currentName)
                     *	{
                     *		Log.Info("ExtractionScript called with action <" + currentAction + "> (" + currentName + ")");
                     *	};
                     * </code></pre>
                     */
                    Server.OnExtractionScriptEnd = function () {
                    };
                    /**
                     * @method Lib.Budget.Management.Customization.Server.OnValidationScriptEnd
                     * @description Allows you to perform operations after the budget management process validation.
                     * This user exit is called at the end of the validation script.
                     * @since 311
                     * @param {string} currentAction String value specifying the type of action that triggered the execution of the script. This value is retrieved using the Processing scripts API: Data.GetActionType function.
                     * @param {string} currentName String value specifying the name of the action that triggered the execution of the script. This value is retrieved using the Processing scripts API: Data.GetActionName function.
                     * @example
                     * <pre><code>
                     *	OnValidationScriptEnd: function (currentAction, currentName)
                     *	{
                     *		Log.Info("ValidationScript called with action <" + currentAction + "> (" + currentName + ")");
                     *	};
                     * </code></pre>
                     */
                    Server.OnValidationScriptEnd = function (currentAction, currentName) {
                    };
                    /**
                     * @method Lib.Budget.Management.Customization.Server.OnExecuteAction
                     * @description Allows you to perform operations before the action starts.
                     * @since 311
                     * @param {string} currentAction String value specifying the type of action that triggered the execution of the script. This value is retrieved using the Processing scripts API: Data.GetActionType function.
                     * @param {string} currentName String value specifying the name of the action that triggered the execution of the script. This value is retrieved using the Processing scripts API: Data.GetActionName function.
                     * @example
                     * <pre><code>
                     *	OnExecuteAction: function (currentName)
                     *	{
                     *		Log.Info("ValidationScript will execute action <" + currentName + ">");
                     *	};
                     * </code></pre>
                     */
                    Server.OnExecuteAction = function (currentName) {
                    };
                })(Server = Customization.Server || (Customization.Server = {}));
            })(Customization = Management.Customization || (Management.Customization = {}));
        })(Management = Budget.Management || (Budget.Management = {}));
    })(Budget = Lib.Budget || (Lib.Budget = {}));
})(Lib || (Lib = {}));
//# sourceMappingURL=LIB_BUDGET_MANAGEMENT_CUSTOMIZATION_SERVER_SAMPLE.js.map