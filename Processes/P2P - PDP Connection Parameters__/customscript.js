/**
 * Manage the General step
 */
const fieldsToShowPerConnectorType = {
    "TokenURI__": [Sys.EDI.FRB2B.PDPConnector.ConnectorType.SG5_V1],
    "ClientId__": [Sys.EDI.FRB2B.PDPConnector.ConnectorType.SG5_V1],
    "ClientSecret__": [Sys.EDI.FRB2B.PDPConnector.ConnectorType.SG5_V1],
    "API_Key_Identifier__": [Sys.EDI.FRB2B.PDPConnector.ConnectorType.EOD],
    "API_Key__": [Sys.EDI.FRB2B.PDPConnector.ConnectorType.EOD]
};
let generalStep = {
    panels: [Controls.GeneralPane],
    icon: "fa-cog",
    title: "_General",
    description: "_Configure the PDP connection settings",
    helpId: 2623,
    onStart: function () {
        generalStep.initLayout();
        generalStep.handleErrorMessage();
    },
    onQuit: function () {
        return true;
    },
    updateWizard: function () {
        Sys.Wizard.Wizard.DrawSteps();
    },
    handleErrorMessage: function () {
        // Handle error message
    },
    initLayout: function () {
        Controls.ConnectorType__.OnChange = function () {
            cleanFieldsBasedOnConnectorType();
            showFieldsBasedOnConnectorType();
            setConnectorTypeDefaults(true); // Force defaults when user changes connector type
        };
        showFieldsBasedOnConnectorType();
        setConnectorTypeDefaults(false); // Don't overwrite when opening existing config
    }
};
function InitializePDPConfiguration(callback) {
    callback();
}
const steps = [generalStep];
function OnSave() {
    for (const step of steps) {
        if (!step.onQuit()) {
            return false;
        }
    }
    const configurationName = Controls.Name__.GetValue();
    if (configurationName) {
        const options = {
            table: Process.GetName(),
            filter: Sys.Helpers.LdapUtil.FilterAnd(Sys.Helpers.LdapUtil.FilterEqual("Name__", configurationName), Sys.Helpers.LdapUtil.FilterNot(Sys.Helpers.LdapUtil.FilterEqual("MSNEX", Data.GetValue("MSNEX")))).toString(),
            attributes: ["Name__"],
            maxRecords: 1,
            additionalOptions: {
                queryOptions: "FastSearch=1"
            }
        };
        Sys.GenericAPI.PromisedQuery(options).Then(function (results) {
            if (results.length > 0) {
                Controls.Name__.SetError("_errorExistingConfigurationName");
                Process.ShowFirstError();
            }
            else {
                cleanFieldsBasedOnConnectorType();
                ProcessInstance.SaveAndQuit("Save");
            }
        });
    }
    else {
        Process.ShowFirstError();
    }
    return false;
}
function showFieldsBasedOnConnectorType() {
    const connectorType = Controls.ConnectorType__.GetValue();
    for (const field in fieldsToShowPerConnectorType) {
        const connectorTypes = fieldsToShowPerConnectorType[field];
        Controls[field].Hide(!connectorTypes.includes(connectorType));
    }
}
function cleanFieldsBasedOnConnectorType() {
    const connectorType = Controls.ConnectorType__.GetValue();
    for (const field in fieldsToShowPerConnectorType) {
        if (!fieldsToShowPerConnectorType[field].includes(connectorType)) {
            Controls[field].SetValue(null);
        }
    }
}
function setConnectorTypeDefaults(forceDefaults) {
    const connectorType = Controls.ConnectorType__.GetValue();
    if (connectorType === Sys.EDI.FRB2B.PDPConnector.ConnectorType.SG5_V1) {
        // When changing connector type (forceDefaults=true), always set defaults
        // When opening existing config (forceDefaults=false), only set if empty to preserve custom URLs
        if (forceDefaults || !Controls.URI__.GetValue()) {
            Controls.URI__.SetValue(Sys.EDI.FRB2B.PDPConnector.PAApi.SG5_URI);
        }
        if (forceDefaults || !Controls.TokenURI__.GetValue()) {
            Controls.TokenURI__.SetValue(Sys.EDI.FRB2B.PDPConnector.PAApi.TOKEN_URI);
        }
    }
}
function Main() {
    var _a;
    Sys.Wizard.Wizard.Init({
        steps: steps,
        previousButton: Controls.Previous,
        nextButton: Controls.Next,
        wizardControl: Controls.Wizard_steps__,
        descriptionControl: Controls.Wizard_step_desc__,
        LoadFirstStep: function () {
            return Variable.GetValueAsString("currentStep");
        },
        SaveCurrentStep: function (currentStep) {
            ProcessInstance.SetSilentChange(true);
            Variable.SetValueAsString("currentStep", currentStep);
            ProcessInstance.SetSilentChange(false);
        },
        RefreshDefaultValues: function (runWizardCb) {
            if (!Variable.GetValueAsString("currentStep")) {
                InitializePDPConfiguration(runWizardCb);
            }
            else {
                runWizardCb();
            }
        }
    });
    // Other layout initializations
    (_a = Controls.Spacer__) === null || _a === void 0 ? void 0 : _a.Hide(true);
    Controls.Save.OnClick = OnSave;
    Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Tables.Client.Common.OnHTMLScriptEnd");
}
/// ==================================
/// Entry point !!!
/// ==================================
Main();
//# sourceMappingURL=customscript.js.map