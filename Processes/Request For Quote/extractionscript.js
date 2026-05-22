var ExtractionScript;
(function (ExtractionScript) {
    var NamedLog = Lib.P2P.Logger.NamedLog;
    class Main {
        constructor() {
            this.logger = new NamedLog({ namespace: "Request for Quote" });
        }
        async Start() {
            let actionName = Data.GetActionName();
            let actionType = Data.GetActionType();
            Log.Info(`-- RFQ Extraction Script -- Name: '${actionName || "<empty>"}', Action: '${actionType || "<empty>"}'`);
            Lib.P2P.SetTablesToIndex(["ItemsToSource__", "Suppliers__"]);
            const rfqDataStr = Variable.GetValueAsString("RFQData");
            if ((actionName === "" && actionType === "") && (rfqDataStr !== "")) {
                const rfqData = this.ParseRFQData(rfqDataStr);
                if (rfqData) {
                    const companyCode = (await Lib.P2P.UserProperties.QueryValues(Lib.P2P.GetOwner().GetValue("Login"))).CompanyCode__;
                    const CCValues = await Lib.P2P.CompanyCodesValue.QueryValues(companyCode);
                    if (Object.keys(CCValues).length > 0) {
                        await Lib.Sourcing.RFQ.InitConfiguration(CCValues.DefaultConfiguration__);
                    }
                    else {
                        Log.Error(`The requested company code (${companyCode}) is not in the company code table.`);
                    }
                    this.logger.Info("Filling RFQ from external RFQData variable");
                    await Lib.Sourcing.RFQ.FillRFQFromData(rfqData);
                }
            }
        }
        ParseRFQData(rfqDataStr) {
            try {
                return JSON.parse(rfqDataStr);
            }
            catch (e) {
                this.logger.Error(`Error parsing RFQData: ${e}`);
            }
        }
    }
    ExtractionScript.Main = Main;
    if (typeof _ENV_TEST_ENABLED === "undefined") {
        const main = new Main();
        Lib.P2P.HandleScriptError(main.Start());
    }
})(ExtractionScript || (ExtractionScript = {}));
//# sourceMappingURL=extractionscript.js.map