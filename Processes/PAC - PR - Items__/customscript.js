var CustomScript;
(function (CustomScript) {
    function HideLegacyFields() {
        const deprecatedFields = [
            "QuantityTakenFromStock__",
            "AmountTakenFromStock__",
        ];
        for (let deprecatedField of deprecatedFields) {
            if (Controls[deprecatedField]) {
                Controls[deprecatedField].Hide(true);
            }
        }
    }
    function Start() {
        HideLegacyFields();
        Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Tables.Client.Common.OnHTMLScriptEnd");
    }
    Start();
})(CustomScript || (CustomScript = {}));
//# sourceMappingURL=customscript.js.map