/* Purchase requisition extraction script */
var extractionscript;
(function (extractionscript) {
    let currentName = Data.GetActionName(), currentAction = Data.GetActionType(), companyCode = Data.GetValue("CompanyCode__");
    Log.Info("-- PR Extraction Script -- Name: '" + (currentName ? currentName : "<empty>") + "', Action: '" + (currentAction ? currentAction : "<empty>") + "'");
    // When the document is submitted from the mobile app, the wkfdata is already computed. We need to keep it.
    // We reset the flag 'SubmittedFromMobileApp' after submission to avoid any issue when cloning document.
    if (!Sys.Helpers.Data.IsTrue(Variable.GetValueAsString("SubmittedFromMobileApp")) && !(currentAction === "reprocess")) {
        Log.Info("Clear WorkflowData");
        Variable.SetValueAsString("wkfdata", "");
        Variable.SetValueAsString("wkfdata_history", "");
    }
    if (currentAction === "reprocess") {
        if (Sys.Parameters.GetInstance("PAC").GetParameterBool("EnableChatGPT", false)) {
            // Recognition Engine will be called client side, because all the existing set functions on the PR are client side only.
            const doc = Sys.RecognitionEngine.GPT.LoadAndFormatDocument();
            //Sys.GDR.HighlightOrderedPages(doc.clusteredPages);
            Variable.SetValueAsString("ChatGPTAnswer", doc.formattedText);
            Log.Info("[RecognitionEngine] Launch requested, client side processing, call Sys.RecognitionEngine.Debugger to access complete logs.");
        }
    }
    function SetFatalError(status) {
        Variable.SetValueAsString("Extraction_status__", status);
        throw { fatalError: true };
    }
    function OnInboundEmail() {
        // Process created from an inbound email ?
        if (Data.GetValue("SourceRuid").toUpperCase().indexOf("ISM.") === 0) {
            let fromAdress = Data.GetValue("FromAddress");
            Log.Info("OnInboundEmail: try to forward this process to the quote by email sender: " + fromAdress);
            let user = Users.GetUser(fromAdress), forwarded = user && Process.Forward(fromAdress); //Check if user exists and is accessible
            if (!forwarded) {
                Log.Error("OnInboundEmail: Process forwarding to " + fromAdress + " failed");
                let defaultRequester = Sys.Parameters.GetInstance("PAC").GetParameter("DefaultQuoteByEmailRequester");
                if (defaultRequester) {
                    user = Lib.P2P.GetOwner();
                    defaultRequester = Lib.P2P.ResolveDemoLogin(defaultRequester);
                    Log.Info("OnInboundEmail: try to forward this process to the default quote by email requester: " + defaultRequester);
                    forwarded = Process.Forward(defaultRequester);
                    if (!forwarded) {
                        Log.Error("OnInboundEmail: Process forwarding to " + defaultRequester + " failed");
                    }
                    else {
                        user = Users.GetUser(defaultRequester);
                    }
                }
                else {
                    Log.Info("OnInboundEmail: No default quote by email requester defined");
                }
            }
            if (forwarded) {
                Log.Info("OnInboundEmail: Process forwarding succeeded");
                Log.Info("OnInboundEmail: Schedule a notification by email");
                Variable.SetValueAsString("NotifyQuoteByEmailRequester__", "1");
                let vars = user.GetVars(), fullName = vars.GetValue_String("DisplayName", 0);
                Data.SetValue("RequisitionInitiator__", vars.GetValue_String("Login", 0));
                Data.SetValue("RequesterName__", fullName);
                Sys.TechnicalData.SetValue("requesterMSN", vars.GetValue_String("Msn", 0));
                let originatingUserLogin = vars.GetValue_String("Login", 0);
                Log.Info("Grant read right to originating user: " + originatingUserLogin);
                Process.SetRight(originatingUserLogin, "read");
            }
            else {
                SetFatalError(Language.Translate("_Unable to forward this purchase requisition following receipt of the quotation"));
            }
        }
        else {
            Log.Info("OnInboundEmail: no treatment to do");
        }
    }
    async function ProcessPurchaseRequisitionData() {
        const purchaseRequisitionData = Variable.GetValueAsString("PurchaseRequisitionData");
        if (purchaseRequisitionData) {
            Log.Info("ProcessPurchaseRequisitionData: Purchase requisition data found, processing...");
            const user = Lib.P2P.GetOwner();
            Data.SetValue("RequisitionInitiator__", user.GetValue("Login"));
            Data.SetValue("RequesterName__", user.GetValue("DisplayName"));
            Sys.TechnicalData.SetValue("requesterMSN", user.GetValue("Msn"));
            SetRequisitionNumber();
            const purchaseRequisitionDataObject = JSON.parse(purchaseRequisitionData);
            if (purchaseRequisitionDataObject.Reason__) {
                Data.SetValue("Reason__", purchaseRequisitionDataObject.Reason__);
            }
            const purchaseRequisitionItems = purchaseRequisitionDataObject.lineItems__;
            const items = await Lib.Purchasing.CatalogHelper.PurchaseRequisitionItems2CatalogItems(purchaseRequisitionItems);
            if (items === null || items === void 0 ? void 0 : items.length) {
                Log.Info("ProcessPurchaseRequisitionData: Fill the form using PurchaseRequisitionData");
                // TODO: await Lib.Purchasing.CatalogHelper.AddCatalogItemToPR(items);
            }
            return true;
        }
        return false;
    }
    function SetRequisitionNumber() {
        if (Sys.Helpers.IsEmpty(Data.GetValue("RequisitionNumber__"))) {
            const ReqNumber = Lib.P2P.NextNumber("PR", "RequisitionNumber__");
            Log.Info("SetRequisitionNumber: New requisition number generated: " + ReqNumber);
            Data.SetValue("RequisitionNumber__", ReqNumber);
        }
    }
    /** ****************** **/
    /** Vendor recognition **/
    /** ****************** **/
    function GetDocumentCulture() {
        let documentCulture = Variable.GetValueAsString("DocumentCulture");
        if (!documentCulture) {
            documentCulture = Sys.Parameters.GetInstance("PAC").GetParameter("AvailableDocumentCultures");
            if (!documentCulture) {
                documentCulture = ["en-US", "en-GB", "fr-FR"];
            }
        }
        if (typeof documentCulture === "string") {
            documentCulture = documentCulture.split(",");
        }
        return documentCulture;
    }
    let Vendor = {
        Fill: function (result, lookupValue, desc) {
            if (result) {
                Variable.SetValueAsString("lastExtractedVendorName", result.Name__);
                Variable.SetValueAsString("lastExtractedVendorNumber", result.Number__);
                Sys.Helpers.TryCallFunction("Lib.PR.Customization.Server.OnVendorRecognition", result);
            }
        },
        Highlight: function (area) {
            if (area) {
                /*
                 * Can't highlight from field in table / wait for workaround
                let highlightColor_border = 0xFFFFFF,
                    highlightColor_background = 0xFFCC00;
                area.zone.Highlight(true, highlightColor_background, highlightColor_border, "VendorName__");
                area.zone.Highlight(true, highlightColor_background, highlightColor_border, "VendorAddress__");
                */
            }
            else {
                let areaList = Document.GetHighlightedAreaList();
                for (let i = areaList.length - 1; i >= 0; i--) {
                    areaList[i].zone.Highlight(false);
                }
            }
        },
        DuplicateToCombinedVendor: function () {
            if (Sys.Helpers.Data.IsTrue(Variable.GetValueAsString("SubmittedFromMobileApp") && currentAction === "")) {
                //CombinedVendor__ is the displayed field, we need to align it on VendorName__
                Sys.Helpers.Data.ForEachTableItem("LineItems__", function (item) {
                    item.SetValue("CombinedVendor__", item.GetValue("VendorName__"));
                });
            }
        }
    };
    /** ******** **/
    /** RUN PART **/
    /** ******** **/
    async function Start() {
        Lib.Purchasing.InitTechnicalFields();
        Lib.P2P.InitSAPConfiguration("PAC");
        Vendor.Highlight();
        const UserPropertiesValues = await Lib.P2P.UserProperties.QueryValues(Lib.P2P.GetOwner().GetValue("Login"));
        companyCode = companyCode || UserPropertiesValues.CompanyCode__;
        Data.SetValue("CompanyCode__", companyCode);
        Log.Info("Company code=" + companyCode);
        let vendorsExtraFilters = Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Common.GetVendorsExtraFilter");
        let LDAPvendorExtraFilter = null;
        if (vendorsExtraFilters && vendorsExtraFilters.length > 0) {
            LDAPvendorExtraFilter = Sys.Helpers.LdapUtil.FilterAnd(...vendorsExtraFilters).toString();
        }
        //CombinedVendor__ is the displayed field, we need to align it on VendorName__
        Vendor.DuplicateToCombinedVendor();
        Lib.P2P.FirstTimeRecognition_Vendor.Recognize(GetDocumentCulture(), companyCode, null, null, Vendor.Fill, Vendor.Highlight, null, null, null, LDAPvendorExtraFilter);
        try {
            if (currentAction !== "reprocess") {
                if (!await ProcessPurchaseRequisitionData()) {
                    OnInboundEmail();
                }
                Variable.SetValueAsString("Extraction_status__", "SUCCESS");
            }
        }
        catch (e) {
            if (!("fatalError" in e)) {
                throw e;
            }
        }
        Sys.Helpers.TryCallFunction("Lib.PR.Customization.Server.OnExtractionScriptEnd");
    }
    Lib.P2P.HandleScriptError(Start());
})(extractionscript || (extractionscript = {}));
//# sourceMappingURL=extractionscript.js.map