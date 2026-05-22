var CustomScript;
(function (CustomScript) {
    function InitUNSPSC() {
        function FillUNSPSC() {
            if (Controls.UNSPSC__.GetValue()) {
                Sys.GenericAPI.PromisedQuery({
                    table: "UNSPSC",
                    filter: Sys.Helpers.LdapUtil.FilterEqual("code", Controls.UNSPSC__.GetValue()),
                    attributes: ["code", "title", "description"],
                }).Then((result) => {
                    if (result.length > 0) {
                        Controls.UNSPSCTitle__.SetValue(result[0].title);
                        Controls.UNSPSCDescription__.SetValue(result[0].description);
                    }
                });
            }
        }
        function OnSelectItem(item) {
            Controls.UNSPSCTitle__.SetValue(item.GetValue("title"));
            Controls.UNSPSCDescription__.SetValue(item.GetValue("description"));
        }
        function OnUnknownValue() {
            Controls.UNSPSCTitle__.SetValue("");
            Controls.UNSPSCDescription__.SetValue("");
        }
        Controls.UNSPSC__.SetAttributes("code|title|description");
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.UNSPSC__, OnSelectItem, OnUnknownValue, OnUnknownValue);
        FillUNSPSC();
    }
    InitUNSPSC();
})(CustomScript || (CustomScript = {}));
//# sourceMappingURL=customscript.js.map