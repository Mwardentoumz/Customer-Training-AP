// Load Parameter in extractionScript to avoid access issue from HTML customerScript.
var ExtractionScript;
(function (ExtractionScript) {
    function Run() {
        const companyCodeBeforeSynchronization = Data.GetValue("CompanyCode");
        const contractRuidEx = Variable.GetValueAsString("P2PContractRuidEx");
        if (!companyCodeBeforeSynchronization && contractRuidEx) {
            Lib.CustomerContract.Publication.SynchronizeWithP2PContract();
        }
        const companyCode = Data.GetValue("CompanyCode__");
        if (companyCode) {
            Lib.P2P.CompanyCodesValue
                .QueryValues(companyCode, { asAdmin: true })
                .Then(function (CCValues) {
                if (Object.keys(CCValues).length > 0) {
                    Lib.P2P.ChangeConfiguration(CCValues.DefaultConfiguration__);
                    Variable.SetValueAsString("CustomerCompany", CCValues.CompanyName__);
                }
                else {
                    Log.Error("The requested company code is not in the company code table.");
                }
            })
                .Then(() => {
                // Must be done when the configuration is loaded
                Lib.P2P.InitValidityDateTime("PAC");
                Lib.P2P.InitArchiveDuration("PAC", "ContractArchiveDurationPortalInMonths");
            });
        }
    }
    ExtractionScript.Run = Run;
    if (typeof _ENV_TEST_ENABLED === "undefined") {
        Run();
    }
})(ExtractionScript || (ExtractionScript = {}));
//# sourceMappingURL=extractionscript.js.map