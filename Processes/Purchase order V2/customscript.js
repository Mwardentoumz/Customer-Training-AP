var CustomScript;
(function (CustomScript) {
    const poSpendingDispatcher = Lib.Purchasing.poSpendingDispatcher;
    const ContractSpendingHandler = Lib.Spending.Contract.Handler;
    const POContractSpending = Lib.Purchasing.POContractSpending;
    const ProjectSpendingHandler = Lib.Spending.Project.Handler;
    const POProjectSpending = Lib.Purchasing.POProjectSpending;
    const POStatus = Lib.Purchasing.POStatus;
    const viewer = Lib.Purchasing.PO.viewer;
    const wkfController = Lib.Purchasing.PO.Workflow.controller;
    Log.Time("CustomScript");
    const g_initialStatus = Data.GetValue("OrderStatus__");
    const g_state = Data.GetValue("State");
    const g_hideSynchronizeItemsButton = !(((Lib.P2P.IsAdmin() && g_state === "90") || g_state === "70") && Data.GetValue("OrderStatus__") === POStatus.toReceive);
    const g_isInternal = Sys.Helpers.String.ToBoolean(Variable.GetValueAsString("IsInternal"));
    const g_waitingForEditAck = Lib.Purchasing.PO.ERP.IsWaitingForAck()
        && !Lib.Purchasing.PO.ERP.IsWaitingForAck("ERPAckCreate" /* Lib.Purchasing.PO.ERP.SubStatus.Create */);
    const g_hasERPEditError = Lib.Purchasing.PO.ERP.HasERPError([
        "ERPAckEdit" /* Lib.Purchasing.PO.ERP.SubStatus.Edit */,
        "ERPAckCancelItems" /* Lib.Purchasing.PO.ERP.SubStatus.CancelItems */,
        "ERPAckReOpenItems" /* Lib.Purchasing.PO.ERP.SubStatus.ReOpenItems */
    ]);
    const g_hasERPCancelError = Lib.Purchasing.PO.ERP.HasERPError([
        "ERPAckCancel" /* Lib.Purchasing.PO.ERP.SubStatus.Cancel */,
    ]);
    async function CheckResumeWithActionPending(action) {
        let result = null;
        if (Data.GetValue("RuidEx")) {
            try {
                result = await ProcessInstance.CheckResumeWithActionPending(action);
            }
            catch (error) {
                Log.Error("Error checking Cancel action pending status: " + error);
            }
        }
        return result && result.hasResumeActionPending;
    }
    let g_hasCancelActionPending = false;
    async function UpdateCancelActionPendingStatus() {
        g_hasCancelActionPending = await CheckResumeWithActionPending(["Cancel_purchase_order"]);
    }
    let g_hasSkippedActionPending = false;
    async function UpdateSkippedActionPendingStatus() {
        g_hasSkippedActionPending = await CheckResumeWithActionPending(["OnERPAckReceived-Cancel"]);
    }
    function IsGeneralInfoDisplayed() {
        const status = Data.GetValue("OrderStatus__");
        return [POStatus.toReceive, POStatus.awaitingAutoGRProcessing, POStatus.received].includes(status)
            || g_waitingForEditAck
            || !Sys.Helpers.IsEmpty(Controls.ERPError__.GetValue());
    }
    function IsCancelable() {
        const isBuyerOrBackUpOrAdmin = CustomScript.IsBuyerOrBackUp() || Lib.P2P.IsAdminNotOwner();
        return !Lib.Purchasing.PO.ERP.IsWaitingForAck()
            && isBuyerOrBackUpOrAdmin
            && !Lib.Purchasing.POItems.g_hasValidGoodsReceipt
            && ProcessInstance.state < 100
            && ProcessInstance.state !== 50
            && !ProcessInstance.isEditing
            && !g_isInternal
            && !Lib.Purchasing.POItems.IsBillingCompleted()
            && !g_hasCancelActionPending;
    }
    function RequiredUpdateFromGR() {
        return g_initialStatus === POStatus.awaitingAutoGRProcessing || g_initialStatus === POStatus.toReceive || g_initialStatus === POStatus.received || g_waitingForEditAck;
    }
    async function IsProcessingERPAck() {
        try {
            const results = await ProcessInstance.CheckResumeWithActionPending([
                "OnERPAckReceived",
                "OnERPAckReceived-Update",
                "OnERPAckReceived-CancelItems",
                "OnERPAckReceived-ReOpenItems",
                "OnERPAckReceived-Cancel"
            ]);
            return results.hasResumeActionPending;
        }
        catch (error) {
            Log.Info(JSON.stringify(error.errors));
            return true;
        }
    }
    let topMessageWarning = Lib.P2P.TopMessageWarning(Controls.TopPaneWarning, Controls.TopMessageWarning__);
    let g_editButtonVisible = false;
    CustomScript.g_isEditing = Lib.Purchasing.POItems.g_isEditing;
    const banner = Sys.Helpers.Banner;
    let g_hasInvoices = false;
    banner.SetStatusCombo(Controls.OrderStatus__);
    banner.SetHTMLBanner(Controls.HTMLBanner__);
    banner.SetMainTitle("Purchase order");
    poSpendingDispatcher.Register(Lib.Purchasing.poBudgetSpending);
    const contractSpendingHandler = new ContractSpendingHandler();
    const poContractSpending = new POContractSpending(contractSpendingHandler, null);
    poSpendingDispatcher.Register(poContractSpending);
    const projectSpendingHandler = new ProjectSpendingHandler();
    const poProjectSpending = new POProjectSpending(projectSpendingHandler, null);
    poSpendingDispatcher.Register(poProjectSpending);
    function IsOwner() {
        return Lib.P2P.IsOwner();
    }
    function IsLineRecipientOrBackup(lineItem) {
        const recipientLogin = lineItem.GetValue("RecipientDN__");
        return User.loginId.toUpperCase() === recipientLogin.toUpperCase() || User.IsMemberOf(recipientLogin) || User.IsBackupUserOf(recipientLogin);
    }
    function IsBuyerOrBackUp() {
        let buyerLogin = Controls.BuyerLogin__.GetValue() || "";
        return User.loginId.toUpperCase() === buyerLogin.toUpperCase()
            || User.IsMemberOf(buyerLogin)
            || User.IsBackupUserOf(buyerLogin);
    }
    CustomScript.IsBuyerOrBackUp = IsBuyerOrBackUp;
    function IsRecipientOrBackup() {
        let isRecipientOrBackup = false;
        Sys.Helpers.Data.ForEachTableItem("LineItems__", function (lineItem) {
            if (IsLineRecipientOrBackup(lineItem)) {
                isRecipientOrBackup = true;
            }
            return isRecipientOrBackup;
        });
        return isRecipientOrBackup;
    }
    function IsCurrentUserApSpecialist() {
        let isCurrentUserApSpecialist = false;
        try {
            const apClerkLogin = Lib.P2P.ResolveDemoLogin(Sys.Parameters.GetInstance("PAC").GetParameter("APClerkLogin"));
            isCurrentUserApSpecialist = Lib.P2P.CurrentUserMatchesLogin(apClerkLogin, User);
        }
        catch (_a) {
            //SU might throw expection when calling Lib.P2P.ResolveDemoLogin from client side
        }
        return isCurrentUserApSpecialist;
    }
    CustomScript.IsCurrentUserApSpecialist = IsCurrentUserApSpecialist;
    function IsRoleAuthorizedForBillingCompleted() {
        return CustomScript.IsCurrentUserApSpecialist() || CustomScript.IsBuyerOrBackUp() || Lib.P2P.IsAdminNotOwner();
    }
    CustomScript.IsRoleAuthorizedForBillingCompleted = IsRoleAuthorizedForBillingCompleted;
    function GoodsReceiptNeeded(byCurrentUser = false) {
        let goodsReceiptNeeded = g_isInternal && CustomScript.IsBuyerOrBackUp();
        Sys.Helpers.Data.ForEachTableItem("LineItems__", function (line) {
            if (!line.GetValue("NoGoodsReceipt__") && !line.GetValue("ItemDeliveryComplete__")) {
                if (byCurrentUser) {
                    if (!g_isInternal && IsLineRecipientOrBackup(line)) {
                        goodsReceiptNeeded = true;
                    }
                }
                else {
                    goodsReceiptNeeded = true;
                }
            }
            return goodsReceiptNeeded;
        });
        return goodsReceiptNeeded;
    }
    function ShouldDisplayNewGR() {
        const goodReceiptNeeded = GoodsReceiptNeeded();
        const buyerLogin = Controls.BuyerLogin__.GetValue() || "";
        return g_state !== "70" && !g_hasERPEditError && !g_hasERPCancelError && (GoodsReceiptNeeded(true) ||
            (Lib.P2P.IsAdminNotOwner() && goodReceiptNeeded) ||
            (Lib.Purchasing.ReceivingItems.BuyerCanReceiveOnBehalf(buyerLogin) && goodReceiptNeeded));
    }
    CustomScript.ShouldDisplayNewGR = ShouldDisplayNewGR;
    async function LoadItemsPriceCondition() {
        const status = Data.GetValue("OrderStatus__");
        const canAddItems = (!Lib.P2P.IsAdminNotOwner() && status === POStatus.toOrder) || (status === POStatus.toReceive && CustomScript.g_isEditing && !Lib.Purchasing.POItems.g_hasValidGoodsReceipt);
        if (canAddItems) {
            let itemSelector = [];
            Sys.Helpers.Data.ForEachTableItem("LineItems__", function (item) {
                itemSelector.push({
                    ItemNumber__: item.GetValue("ItemNumber__"),
                    VendorNumber__: Data.GetValue("VendorNumber__")
                });
            });
            await Lib.Purchasing.ConditionedPricing.PopulateCacheConditionedPricingData(itemSelector);
            await Sys.Helpers.Data.ForEachTableItemAsync("LineItems__", async function (lineItem) {
                await Lib.Purchasing.POItems.ComputePriceCondition(lineItem);
            });
        }
    }
    CustomScript.LoadItemsPriceCondition = LoadItemsPriceCondition;
    function UpdateVendorEmailLayout() {
        if (Data.GetValue("EmailNotificationOptions__") == "SendToVendor") {
            Controls.VendorEmail__.Hide(false);
            Controls.VendorEmail__.SetRequired(true);
        }
        else {
            Controls.VendorEmail__.Hide(true);
            Controls.VendorEmail__.SetRequired(false);
        }
    }
    ///////////////////////////////////////////////PROGRESS END////////////////////////////////////////////////////////////////////
    //#region PO in punchout mode
    function UpdatePOLayoutAsPunchoutMode() {
        if (Data.GetValue("EmailNotificationOptions__") == "PunchoutMode") {
            Lib.Purchasing.Punchout.PO.UpdatePane();
            Controls.AddFee__.Hide(true);
            Controls.AdditionalFees_pane.Hide(true);
            Controls.AdditionalFees__.SetItemCount(0);
            if (Lib.Purchasing.IsMultiShipTo()) {
                Lib.Purchasing.ShipTo.CheckAllSameDeliveryAddress();
            }
        }
        else {
            Lib.Purchasing.Punchout.PO.ResetPane();
            Controls.AddFee__.Hide(Lib.ERP.IsSAP());
        }
    }
    function SetPunchoutLineItemsToReadOnly() {
        let nbItem = Math.min(Controls.LineItems__.GetItemCount(), Controls.LineItems__.GetLineCount());
        for (let lineIdx = 0; lineIdx < nbItem; lineIdx++) {
            let row = Controls.LineItems__.GetRow(lineIdx);
            if (row.IsVisible()) {
                Lib.Purchasing.POItems.Items.OnRefreshRow(lineIdx);
            }
        }
    }
    //#endregion
    Controls.CloseReception.OnClick = () => {
        Log.Info("OnClickCloseReception");
        Popup.Confirm("_PO close reception information", false, () => {
            ProcessInstance.ResumeWithActionAsynchronous("Cancel_unreceived_items");
        }, null, "_PO close reception confirmation");
        return false; //to not launch the next process
    };
    Controls.ReOpenReception.OnClick = () => {
        Log.Info("OnClickReOpenReception");
        Popup.Confirm("_PO re-open reception information", false, () => {
            ProcessInstance.ResumeWithActionAsynchronous("Reopen_unreceived_items");
        }, null, "_PO re-open reception confirmation");
        return false; //to not launch the next process
    };
    function OnClickCancelPO() {
        function OnConfirmCancel(comment) {
            if (g_state !== "90") {
                ProcessInstance.ApproveAsynchronous("Cancel_purchase_order");
            }
            else {
                ProcessInstance.ResumeWithActionAsynchronous("Cancel_purchase_order", { "Comments__": comment });
            }
        }
        let CancelConfirmationPopup = (() => {
            let $comment = null;
            let onCommitted = null;
            const warnWhenInvoiced = Lib.Purchasing.InvoicedProcessCancellationBehavior.IsWarned();
            const preventWhenInvoiced = Lib.Purchasing.InvoicedProcessCancellationBehavior.IsPrevented();
            function Fill(dialog /*, tabId, event, control*/) {
                if (Data.GetValue("OrderStatus__") !== POStatus.toOrder && !Lib.Purchasing.PO.ERP.IsUniversalCancelEnabled()) {
                    Lib.ERP.Procurement.AddERPWarningToDialog(dialog, "PO", "cancel");
                }
                let warningCtrl = dialog.AddDescription("warningCtrlDesc", null, 466);
                let ctrl = dialog.AddDescription("ctrlDesc", null, 466);
                ctrl.SetText(Language.Translate("_Cancel_PO_explanation"));
                let commentCtrl = dialog.AddMultilineText("ctrlComments", "_Comment", 400);
                if (IsInternalCommentRequired()) {
                    dialog.RequireControl(commentCtrl);
                }
                if (g_hasInvoices && (warnWhenInvoiced || preventWhenInvoiced)) {
                    let message;
                    if (warnWhenInvoiced) {
                        warningCtrl.SetWarningStyle();
                        message = Language.Translate("_Cancel_invoiced_PO_warning");
                    }
                    else if (preventWhenInvoiced) {
                        warningCtrl.SetErrorStyle();
                        dialog.HideDefaultButtons();
                        dialog.HideControl(ctrl);
                        dialog.HideControl(commentCtrl);
                        dialog.RequireControl(commentCtrl, false);
                        dialog.AddButton("CancelButton", "_Cancel");
                        message = Language.Translate("_Cancel_invoiced_PO_error");
                    }
                    if (message) {
                        warningCtrl.SetText(message);
                    }
                }
                const commitButton = dialog.GetControl("ButtonOk");
                commitButton.SetText(Language.Translate("_CancelPOPopupCommitButton"));
                const cancelButton = dialog.GetControl("ButtonCancel");
                cancelButton.SetText(Language.Translate("_CancelPOPopupCancelButton"));
            }
            function Commit(dialog /*, tabId, event, control*/) {
                $comment = dialog.GetControl("ctrlComments").GetValue();
                Controls.Comments__.SetValue($comment);
                if (Sys.Helpers.IsFunction(onCommitted)) {
                    onCommitted($comment);
                }
            }
            function Validate(dialog /*, tabId, event, control*/) {
                if (!dialog.GetControl("ctrlComments").GetValue() && IsInternalCommentRequired()) {
                    dialog.GetControl("ctrlComments").SetError("This field is required!");
                    return false;
                }
                return true;
            }
            function IsInternalCommentRequired() {
                return Data.GetValue("OrderStatus__") !== POStatus.toOrder;
            }
            function Handle(dialog, tabId, event, control) {
                const controlName = control ? control.GetName() : "";
                if (dialog && event === "OnClick" && controlName === "CancelButton") {
                    Log.Info("Closing the dialog by pressing 'CancelButton'");
                    dialog.Cancel();
                }
            }
            function Display(_onCommitted) {
                $comment = null;
                onCommitted = _onCommitted;
                if (g_hasInvoices && warnWhenInvoiced) {
                    Popup.Dialog("_Cancel purchase order warning", null, Fill, Commit, Validate, Handle);
                }
                else if (g_hasInvoices && preventWhenInvoiced) {
                    Controls.Cancel_purchase_order.SetReadOnly(true);
                    Popup.Dialog("_Cancel purchase order prevent", null, Fill, Commit, Validate, Handle);
                }
                else {
                    Popup.Dialog("_Cancel purchase order confirmation", null, Fill, Commit, Validate, Handle);
                }
            }
            return {
                get comment() {
                    return $comment;
                },
                Display: Display
            };
        })();
        CancelConfirmationPopup.Display(OnConfirmCancel);
        return false;
    }
    function OnSelectShipToItem(item) {
        const row = this.GetRow();
        const firstItem = row && row.GetLineNumber(true) === 1;
        if (!row) {
            Lib.Purchasing.ShipTo.SetByUser();
        }
        if (item.GetValue("ShipToCompany__") === "__my address__") {
            Lib.Purchasing.ShipTo.FillFromUser(User.loginId, row);
        }
        else {
            Lib.Purchasing.ShipTo.Fill((field) => item.GetValue(field), row ? row.GetItem() : null, firstItem);
        }
        if (Lib.Purchasing.IsMultiShipTo() && Lib.Purchasing.Punchout.PO.IsEnabled()) {
            if (firstItem) {
                Lib.Purchasing.ShipTo.CheckAllSameDeliveryAddress();
            }
            else {
                let deliveryAddressID = Controls.LineItems__.GetRow(0).ItemDeliveryAddressID__.GetValue();
                Lib.Purchasing.Punchout.PO.CheckDeliveryAddressID(row, deliveryAddressID);
            }
        }
    }
    async function CheckSpendingRemaining(check) {
        globalLayout.ShowWaitScreen();
        try {
            const errors = await poSpendingDispatcher[check]();
            Sys.Helpers.Data.ForEachTableItem("LineItems__", function (lineItem) {
                // /!\ don't work with Translate with args.
                if (lineItem.GetError("ContractName__") === Language.Translate("_ContractSpendingNotEnoughRemaining")) {
                    lineItem.SetError("ContractName__", "");
                }
                if (lineItem.GetError("ProjectName__") === Language.Translate("_ProjectSpendingNotEnoughRemaining")) {
                    lineItem.SetError("ProjectName__", "");
                }
            });
            const table = Data.GetTable("LineItems__");
            for (const error of errors) {
                if (error instanceof Lib.Spending.CheckRemainingError) {
                    for (const spending of error.withoutEnoughRemaining) {
                        for (const itemIndex of spending.Items) {
                            const item = table.GetItem(itemIndex);
                            switch (error.spendingType) {
                                case Lib.Spending.ErrorSpendingType.Contract:
                                    item.SetError("ContractName__", Language.Translate("_ContractSpendingNotEnoughRemaining"));
                                    break;
                                case Lib.Spending.ErrorSpendingType.Project:
                                    item.SetError("ProjectName__", Language.Translate("_ProjectSpendingNotEnoughRemaining"));
                                    break;
                                // no default
                            }
                        }
                    }
                }
            }
        }
        finally {
            globalLayout.HideWaitScreen();
        }
    }
    function CanValidateAfterERPError() {
        const nextAlert = Lib.CommonDialog.NextAlert.GetNextAlert();
        const isDuplicateAlert = nextAlert && nextAlert.title === Lib.Purchasing.PODuplicateNumberTitle;
        return Data.GetValue("OrderStatus__") === POStatus.toOrder
            && !Sys.Helpers.IsEmpty(Controls.ERPError__.GetValue())
            && (!Sys.Helpers.IsEmpty(Controls.OrderNumber__.GetValue()) || isDuplicateAlert);
    }
    function SetSubmitButtonLabel() {
        if (CanValidateAfterERPError()) {
            Controls.Submit_.SetLabel(Language.Translate("_ValidateERPAck"));
        }
        else if (Lib.Purchasing.PO.Workflow.IsCurrentContributor()) {
            const wkfAction = Lib.Purchasing.PO.Workflow.GetCurrentAction();
            if (wkfAction === Lib.Purchasing.PO.Workflow.parameters.actions.approval.GetName()) {
                Controls.Submit_.SetLabel(Language.Translate("_Approve"));
            }
            else if (wkfAction === Lib.Purchasing.PO.Workflow.parameters.actions.submission.GetName()) {
                Controls.Submit_.SetLabel(Language.Translate("_Submit purchase order"));
            }
        }
    }
    function ResetERPErrorIfNeeded() {
        const ERPError = Controls.ERPError__.GetValue();
        const PONumberError = Controls.OrderNumber__.GetError();
        const isERPAckError = PONumberError && ERPError && PONumberError.includes(ERPError);
        if (isERPAckError) {
            Controls.OrderNumber__.SetError("");
        }
    }
    CustomScript.ResetERPErrorIfNeeded = ResetERPErrorIfNeeded;
    //DeclareEvent
    (() => {
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.LineItems__.FreeDimension1__, Lib.P2P.FreeDimension.DefineOnSelectItem("FreeDimension1ID__", "Code__"), Lib.P2P.FreeDimension.DefineOnUnknownOrEmptyValue("FreeDimension1ID__"), Lib.P2P.FreeDimension.DefineOnUnknownOrEmptyValue("FreeDimension1ID__"));
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.LineItems__.FreeDimension1ID__, Lib.P2P.FreeDimension.DefineOnSelectItem("FreeDimension1__", "Description__"), Lib.P2P.FreeDimension.DefineOnUnknownOrEmptyValue("FreeDimension1__"), Lib.P2P.FreeDimension.DefineOnUnknownOrEmptyValue("FreeDimension1__"));
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.LineItems__.ProjectName__, Lib.Purchasing.POItems.ColumsBehaviour.ItemProjectName.OnSelectItem, Lib.Purchasing.POItems.ColumsBehaviour.ItemProjectName.OnUnknownOrEmptyValue, Lib.Purchasing.POItems.ColumsBehaviour.ItemProjectName.OnUnknownOrEmptyValue);
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.LineItems__.ProjectNumber__, Lib.Purchasing.POItems.ColumsBehaviour.ItemProjectNumber.OnSelectItem, Lib.Purchasing.POItems.ColumsBehaviour.ItemProjectNumber.OnUnknownOrEmptyValue, Lib.Purchasing.POItems.ColumsBehaviour.ItemProjectNumber.OnUnknownOrEmptyValue);
        class CurrencyManager {
            static OnChange() {
                if (Sys.Parameters.GetInstance("PAC").GetParameterBool("AllowAutomaticPOCurrencyConversion", false) && CurrencyManager.currency != Data.GetValue("Currency__")) {
                    Popup.Confirm("_Any fields related to the currency will be reset. Are you sure you want to continue ?", false, () => CurrencyManager.Update(), () => CurrencyManager.Revert(), "_Warning : Fields related to the currency will be updated");
                }
                else {
                    CurrencyManager.Update();
                }
            }
            static Revert() {
                Controls.Currency__.SetValue(CurrencyManager.currency);
            }
            static async Update() {
                CurrencyManager.currency = Data.GetValue("Currency__");
                await Lib.Purchasing.POItems.OnOrderCurrencyChange();
                await Lib.Purchasing.CheckPO.CheckDataCoherency(true);
            }
        }
        CurrencyManager.currency = Data.GetValue("Currency__");
        function OnClickSynchronizeItems() {
            Popup.Confirm("_SynchronizePOItemsASAP", false, () => {
                if (g_state === "90") {
                    ProcessInstance.ResumeWithActionAsynchronous("SynchronizeItems");
                    return false;
                }
                ProcessInstance.Approve("SynchronizeItems");
                return false;
            }, () => {
                return false;
            }, "_SynchronizePOItemsASAPTitle");
        }
        function OnManualReceptionClick() {
            Log.Info("OnManualReceptionClick");
            Popup.Confirm("_PO_Revert_To_Manual_Receipt", false, () => ProcessInstance.ResumeWithActionAsynchronous("ManualReceipt"), null, "_PO_Revert_To_Manual_Receipt_confirmation");
            return false;
        }
        function OnSubmit() {
            if (Lib.Purchasing.Vendor.Client.PO.IsVendorRegistrationInProgress()) {
                Popup.Alert("_impossible_to_send_order_because_vendor_is_current_onboarding_popup_message", false, null, "_impossible_to_send_order_because_vendor_is_current_onboarding_popup_title");
                return false;
            }
            // Remove potential budget errors, server side will check for them again
            const table = Data.GetTable("LineItems__");
            const tableSize = table.GetItemCount();
            for (let i = 0; i < tableSize; i++) {
                const item = table.GetItem(i);
                if (item.GetError("ItemDescription__") === Language.Translate("_No budget allocated following user changes", false)) {
                    table.GetItem(i).SetError("ItemDescription__", "");
                }
                table.GetItem(i).SetWarning("ItemRequestedDeliveryDate__", "");
            }
            CheckSpendingRemaining("CheckAsOrdered")
                .Then(() => Lib.Purchasing.CheckPO.CheckAll())
                .Then(function (lastErrorMessage) {
                if (!lastErrorMessage) {
                    if (Lib.Purchasing.IsMultiShipTo() && tableSize > 0) {
                        const firstItem = table.GetItem(0);
                        //Filling header ship to with first line ship to, useful in punchout mode (Electronical Order).
                        Data.SetValue("DeliveryAddressID__", firstItem.GetValue("ItemDeliveryAddressID__"));
                        Data.SetValue("ShipToCompany__", firstItem.GetValue("ItemShipToCompany__"));
                        Data.SetValue("ShipToAddress__", firstItem.GetValue("ItemShipToAddress__"));
                    }
                }
                ResetERPErrorIfNeeded();
                if (Process.ShowFirstError() === null && !lastErrorMessage) {
                    ProcessInstance.Approve("Submit_");
                }
            });
            return false;
        }
        function OnReject() {
            function FillDialog(dialog) {
                let commentValue = Controls.Comments__.GetValue();
                let ctrl = dialog.AddDescription("ctrlDesc", null, 466);
                if (Sys.Helpers.IsEmpty(commentValue)) {
                    ctrl.SetText(Language.Translate("_Please write your comment:"));
                }
                else {
                    ctrl.SetText(Language.Translate("_Please confirm your comment:"));
                }
                let commentCtrl = dialog.AddMultilineText("ctrlComments", "_Comment", 400);
                dialog.RequireControl(commentCtrl);
                commentCtrl.SetValue(commentValue);
            }
            function ValidateDialog(dialog) {
                if (!dialog.GetControl("ctrlComments").GetValue()) {
                    dialog.GetControl("ctrlComments").SetError("This field is required!");
                    return false;
                }
                return true;
            }
            function CommitDialog(dialog) {
                let comment = dialog.GetControl("ctrlComments").GetValue();
                Controls.Comments__.SetValue(comment);
                Controls.Comments__.SetError("");
                ProcessInstance.ApproveAsynchronous("Reject");
            }
            let title = Controls.Comments__.GetValue() ? "_Approval comments confirmation" : "_Approval comments required";
            Popup.Dialog(title, null, FillDialog, CommitDialog, ValidateDialog);
            return false;
        }
        function OnBackToBuyer() {
            Lib.Purchasing.PO.Workflow.ApprovalCommentCheck.OnClick("BackToBuyer");
            return false;
        }
        /* Buttons */
        Controls.ManualReception.OnClick = OnManualReceptionClick;
        Controls.SynchronizeItems.OnClick = OnClickSynchronizeItems;
        Controls.PaymentPercent__.OnChange = Lib.Purchasing.PO.DownPayment.OnChange;
        Controls.PaymentAmount__.OnChange = Lib.Purchasing.PO.DownPayment.OnChange;
        Controls.RequestPayment.OnClick = Lib.Purchasing.PO.DownPayment.Request;
        Controls.ConfirmPayment.OnClick = Lib.Purchasing.PO.DownPayment.Confirm;
        Controls.Submit_.OnClick = OnSubmit;
        Controls.Reject.OnClick = OnReject;
        Controls.BackToBuyer.OnClick = OnBackToBuyer;
        Controls.NewPR.OnClick = function () {
            ProcessInstance.OpenInProcess({
                processName: "Purchase requisition V2",
                attachmentsMode: "none",
                willBeChild: false,
                startWithoutProcessing: true,
                doNotCopyExternalVarsFromAncestor: true
            });
        };
        Controls.DownloadCrystalReportsDataFile.OnClick = function () {
            let poTemplateInfos = Lib.Purchasing.PO.Export.GetPOTemplateInfos();
            if (poTemplateInfos.fileFormat === "RPT") {
                Process.OpenPreview({
                    "conversionType": Lib.P2P.GetCrystalConverterByParameter(),
                    "templateName": poTemplateInfos.template,
                    "language": poTemplateInfos.escapedCompanyCode,
                    "outputFormat": "mdb",
                    "data": async function (fnDataBuildDone) {
                        await Lib.Purchasing.Vendor.PO.SetVendorCommunicationCultureAndLanguage();
                        const jsonString = await Lib.Purchasing.PO.Export.CreatePOJsonString(poTemplateInfos);
                        fnDataBuildDone(jsonString);
                        if (jsonString === null) {
                            Lib.CommonDialog.NextAlert.Show();
                        }
                    }
                });
            }
            return false;
        };
        Controls.Preview_purchase_order.OnClick = function () {
            (async () => {
                try {
                    const poTemplateInfos = Lib.Purchasing.PO.Export.GetPOTemplateInfos();
                    const result = await Lib.P2P.Export.IsAvailableTemplate(Sys.Helpers.Globals.User, "PO_template_V2.docx", poTemplateInfos.escapedCompanyCode);
                    const preview = poTemplateInfos.termsConditions ? {
                        "converter": "PDF Modifier",
                        "mergeKey": "merge",
                        "mergeValue": poTemplateInfos.termsConditions
                    } : null;
                    if (result.exist && poTemplateInfos.template == "PurchaseOrder.rpt") {
                        Log.Info("Old .docx purchase order template detected.");
                        poTemplateInfos.fileFormat = "DOCX";
                        poTemplateInfos.template = "PO_template_V2.docx";
                    }
                    if (poTemplateInfos.fileFormat === "RPT") {
                        Process.OpenPreview({
                            "conversionType": Lib.P2P.GetCrystalConverterByParameter(),
                            "templateName": poTemplateInfos.template,
                            "language": poTemplateInfos.escapedCompanyCode,
                            "data": async function (fnDataBuildDone) {
                                await Lib.Purchasing.Vendor.PO.SetVendorCommunicationCultureAndLanguage();
                                const jsonString = await Lib.Purchasing.PO.Export.CreatePOJsonString(poTemplateInfos);
                                fnDataBuildDone(jsonString);
                                if (jsonString === null) {
                                    Lib.CommonDialog.NextAlert.Show();
                                }
                            },
                            "preview": preview
                        });
                    }
                    else {
                        const csvString = await Lib.Purchasing.PO.Export.CreatePOCsv(poTemplateInfos.poNumber);
                        Process.OpenPreview({
                            "conversionType": "mailMerge",
                            "templateName": poTemplateInfos.template,
                            "language": poTemplateInfos.escapedCompanyCode,
                            "csv": csvString,
                            "preview": preview
                        });
                    }
                }
                catch (e) {
                    Log.Error("Failed to IsAvailableTemplate: " + e);
                }
            })();
            return false;
        };
        Controls.Cancel_purchase_order.OnClick = OnClickCancelPO;
        function BypassPONumber() {
            function Fill(dialog /*, tabId, event, control*/) {
                let ctrl = dialog.AddDescription("ctrlDesc", null, 466);
                ctrl.SetText(Language.Translate("_Enter_PONumber_explanation"));
                let ctrlPONumber = dialog.AddText("ctrlPONumber", "_PONumber", 400);
                dialog.RequireControl(ctrlPONumber);
            }
            function Commit(dialog /*, tabId, event, control*/) {
                const ctrlPONumber = dialog.GetControl("ctrlPONumber").GetValue();
                Controls.OrderNumber__.SetValue(ctrlPONumber);
                BypassERPAck({ "OrderNumber__": ctrlPONumber });
            }
            function Validate(dialog /*, tabId, event, control*/) {
                const PONumber = dialog.GetControl("ctrlPONumber").GetValue();
                if (!PONumber) {
                    dialog.GetControl("ctrlPONumber").SetError("This field is required!");
                    return false;
                }
                return true;
            }
            function Handle(dialog, tabId, event, control) {
                const controlName = control ? control.GetName() : "";
                if (dialog && event === "OnClick" && controlName === "CancelButton") {
                    Log.Info("Closing the dialog by pressing 'CancelButton'");
                    dialog.Cancel();
                }
            }
            Popup.Dialog("_Enter a PO number", null, Fill, Commit, Validate, Handle);
        }
        function BypassERPAck(additionalData) {
            const action = Lib.Purchasing.PO.ERP.ComputeBypassAction();
            ProcessInstance.ResumeWithActionAsynchronous(action, {
                ...additionalData,
                "EXTERNAL_VARIABLE_ERPACK_TRANSACTIONID__": Data.GetValue("ERPNextTransactionID__")
            });
        }
        Controls.EnterPONumber.OnClick = function () {
            BypassPONumber();
            return false;
        };
        Controls.BypassERPAck.OnClick = function () {
            Lib.CommonDialog.PopupYesCancel((action) => {
                if (action === "Yes") {
                    BypassERPAck();
                }
            }, "_BypassERPackPopupTitle", "_BypassERPackPopupMessage", "_BypassERPackPopupYes");
            return false;
        };
        Controls.RollbackCancellation.OnClick = function () {
            Lib.CommonDialog.PopupYesCancel((action) => {
                if (action === "Yes") {
                    ProcessInstance.ResumeWithActionAsynchronous("Rollback_cancellation");
                }
            }, "_RollbackCancellationPopupTitle", "_RollbackCancellationPopupMessage", "_RollbackCancellationPopupYes");
            return false;
        };
        Controls.EmailNotificationOptions__.OnChange = function () {
            UpdateVendorEmailLayout();
            UpdatePOLayoutAsPunchoutMode();
        };
        /* Line Items */
        Controls.LineItems__.ItemRequestedDeliveryDate__.OnChange = function () {
            if (!CustomScript.g_isEditing) {
                Lib.Purchasing.CheckPO.CheckLeadTime(this.GetItem());
            }
            Lib.Purchasing.CheckPO.CheckItemsDeliveryDates({
                // return item index - call with inWholeTable (1-based API)
                specificItemIndex: this.GetRow().GetLineNumber(/*inWholeTable*/ true) - 1
            });
        };
        Controls.LineItems__.ItemQuantity__.OnChange = Lib.Purchasing.POItems.Items.ItemQuantity.OnChange;
        Controls.LineItems__.ItemUnitPrice__.OnChange = Lib.Purchasing.POItems.Items.Unit_Price.OnChange;
        Controls.LineItems__.ItemDescription__.OnChange = Lib.Purchasing.POItems.Items.Description.OnChange;
        Controls.LineItems__.ItemTaxCode__.SetAttributes(Lib.Purchasing.POItems.Items.TaxCode.Attributes);
        Controls.LineItems__.ItemTaxCode__.OnSelectItem = Lib.Purchasing.POItems.Items.TaxCode.OnSelectItem;
        Controls.LineItems__.OnDeleteItem = Lib.Purchasing.POItems.Items.OnDeleteItem;
        Controls.LineItems__.OnAddItem = Lib.Purchasing.POItems.Items.OnAddItem;
        Controls.LineItems__.OnRefreshRow = Lib.Purchasing.POItems.Items.OnRefreshRow;
        Controls.LineItems__.OnCheckIfItemDeletable = Lib.Purchasing.POItems.Items.OnCheckIfItemDeletable;
        Controls.LineItems__.ContractInformation__.OnClick = Lib.Purchasing.POItems.Items.Contract.Open;
        Controls.LineItems__.PRNumber__.OnClick = Lib.Purchasing.POItems.Items.PRNumber.OnClick;
        Controls.LineItems__.ItemGLAccount__.OnSelectItem = Lib.Purchasing.POItems.Items.GLAccount.OnSelectItem;
        Controls.LineItems__.ItemGLAccount__.OnChange = Lib.Purchasing.POItems.Items.GLAccount.OnChange;
        Controls.LineItems__.ItemNetAmount__.OnChange = Lib.Purchasing.POItems.Items.NetAmount.OnChange;
        /* Vendor */
        Controls.VendorNumber__.SetDisplayedColumns("Name__|Number__|Street__|City__|PostalCode__|Country__|Currency__");
        Controls.VendorNumber__.SetAttributes("Region__|PostOfficeBox__|Sub__|Email__|VATNumber__|FaxNumber__|PaymentTermCode__|PaymentTermCode__.Description__");
        Controls.VendorName__.SetDisplayedColumns("Name__|Number__|Street__|City__|PostalCode__|Country__|Currency__");
        Controls.VendorName__.SetAttributes("Region__|PostOfficeBox__|Sub__|Email__|VATNumber__|FaxNumber__|PaymentTermCode__|PaymentTermCode__.Description__");
        Controls.VendorNumber__.OnSelectItem = Lib.Purchasing.Vendor.Client.PO.OnSelectItem;
        Controls.VendorName__.OnSelectItem = Lib.Purchasing.Vendor.Client.PO.OnSelectItem;
        Controls.VendorName__.OnChange = Lib.Purchasing.Vendor.Client.PO.OnChange;
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.Currency__, CurrencyManager.OnChange, CurrencyManager.OnChange, CurrencyManager.OnChange);
        let contactEmail = "";
        Controls.VendorEmail__.SetAttributes("login");
        Controls.VendorEmail__.OnSelectItem = function (item) {
            let login = item.GetValue("Login");
            contactEmail = item.GetValue("EmailAddress");
            Variable.SetValueAsString("ContactLogin", login);
        };
        Controls.VendorEmail__.OnChange = function () {
            if (contactEmail !== Controls.VendorEmail__.GetValue()) {
                Lib.P2P.Email.TrimAndCheckEmailControl(Controls.VendorEmail__);
                Variable.SetValueAsString("ContactLogin", "");
            }
        };
        Controls.NewVendorRequest__.OnClick = Lib.Purchasing.Vendor.Client.PO.OpenNewVendorRequestForm;
        Controls.NewVendorRegistration__.OnClick = OnClickNewVendorRegistration;
        Lib.Purchasing.Vendor.Client.SetVendorsExtraFilter(Controls.VendorName__);
        let lastSelectedPaymentTermCode;
        /* Payment terms */
        Controls.PaymentTermCode__.OnSelectItem = function (item) {
            lastSelectedPaymentTermCode = item.GetValue("PaymentTermCode__");
            this.SetValue(lastSelectedPaymentTermCode); // In SAP, the payment term is always uppercase.
            Controls.PaymentTermDescription__.SetValue(item.GetValue("Description__"));
        };
        Controls.PaymentTermCode__.OnChange = function () {
            // Reset PaymentTermDescription__ only if we haven't selected an existing item
            if (lastSelectedPaymentTermCode !== Controls.PaymentTermCode__.GetValue()) {
                Controls.PaymentTermDescription__.SetValue("");
            }
        };
        /* Payment method */
        Controls.PaymentMethodCode__.OnSelectItem = function (item) {
            Controls.PaymentMethodDescription__.SetValue(item.GetValue("Description__"));
        };
        Controls.PaymentMethodCode__.OnChange = function () {
            if (!Controls.PaymentMethodCode__.GetValue()) {
                Controls.PaymentMethodDescription__.SetValue("");
            }
        };
        Controls.ValidityStart__.OnChange = function () {
            Lib.Purchasing.CheckPO.CheckValidityPeriod("ValidityStart__");
        };
        Controls.ValidityEnd__.OnChange = function () {
            Lib.Purchasing.CheckPO.CheckValidityPeriod("ValidityEnd__");
        };
        /* Additional fees */
        Controls.AdditionalFees__.ItemTaxCode__.OnSelectItem = Lib.Purchasing.POItems.Items.TaxCode.OnSelectItem;
        Controls.AdditionalFees__.ItemTaxCode__.SetAttributes(Lib.Purchasing.POItems.Items.TaxCode.Attributes);
        Controls.AddFee__.OnClick = function () {
            let filter = "&";
            if (!Sys.Helpers.IsEmpty(Data.GetValue("CompanyCode__"))) {
                // same company code as already selected Items
                filter += "(CompanyCode__=" + Data.GetValue("CompanyCode__") + ")";
            }
            Controls.BrowseAddFees__.SetFilter(filter);
            Controls.BrowseAddFees__.DoBrowse();
        };
        Controls.BrowseAddFees__.OnSelectItem = function (item) {
            let table = Data.GetTable("AdditionalFees__");
            let index = table.GetItemCount();
            table.AddItem();
            let row = table.GetItem(index);
            let newFee = {
                AdditionalFeeID__: item.GetValue("AdditionalFeeID__"),
                Description__: item.GetValue("Description__"),
                MaxAmount__: parseInt(item.GetValue("MaxAmount__"), 10)
            };
            row.SetValue("AdditionalFeeID__", newFee.AdditionalFeeID__);
            row.SetValue("AdditionalFeeDescription__", newFee.Description__);
            // Reset the hidden browse to avoid a hidden error
            Controls.BrowseAddFees__.SetValue("");
            Controls.AdditionalFees_pane.Hide(false);
            Lib.Purchasing.AdditionalFees.PushValues(Data.GetValue("CompanyCode__"), newFee);
        };
        Controls.AdditionalFees__.Price__.OnChange = function () {
            Lib.Purchasing.CheckPO.CheckAdditionalFeesAmounts()
                .Then(() => Lib.Purchasing.POItems.CalculateTaxAmount(this.GetItem()))
                .Then(Lib.Purchasing.POItems.ComputeTotalAmount);
        };
        Controls.AdditionalFees__.ItemTaxCode__.OnChange = function () {
            Lib.Purchasing.POItems.FillTaxSummary();
            Lib.Purchasing.POItems.ComputeTotalAmount();
        };
        Controls.AdditionalFees__.OnDeleteItem = function ( /*item, index*/) {
            Lib.Purchasing.CheckPO.CheckAdditionalFeesAmounts()
                .Then(Lib.Purchasing.POItems.FillTaxSummary)
                .Then(Lib.Purchasing.POItems.ComputeTotalAmount);
        };
        Controls.BillingCompleted.OnClick = OnClickBillingCompleted;
        Controls.ReopenBilling.OnClick = OnClickReopenBilling;
        Controls.RollbackEditionAndQuit.OnClick = function () {
            var _a;
            if (((_a = Lib.CommonDialog.NextAlert.GetNextAlert()) === null || _a === void 0 ? void 0 : _a.behaviorName) === "POEditionError" && !!Data.GetActionName()) {
                Lib.Purchasing.ResetAllFieldsInError();
                Variable.SetValueAsString("SaveEditingAction", "RollbackEditOrder");
                Controls.SaveEditing_.Click();
            }
            else if (g_state === "90") {
                ProcessInstance.ResumeWithActionAsynchronous("RollbackEditOrder");
            }
            else {
                ProcessInstance.Approve("RollbackEditOrder");
            }
        };
    })();
    /** ******************* **/
    /** Form initialization **/
    /** ******************* **/
    const panes = ["TopPaneWarning", "Banner", "Requisition_information", "AdditionalDataPane", "Vendor_details", "Ship_to", "Vendor_notification_pane", "Down_payment_request", "Line_items", "TaxSummaryPane", "DocumentsPanel", "ApprovalWorkflow", "Delivery_history", "Event_history", "AdditionalFees_pane", "LocalActionPane", "RelatedInvoicesPane", "RelatedEditPORequestPanel", "RelatedShippingNoticePane", "RelatedReturnOrdersPane"];
    const buttons = ["Save", "Close", "Cancel_purchase_order", "Submit_", "NewGR2", "CloseReception", "RequestPayment", "Generate_Invoice", "ConfirmPayment", "Generate_CO", "Finalize_PO", "Preview_purchase_order", "DownloadCrystalReportsDataFile", "SynchronizeItems", "Edit_", "SaveEditing_", "SaveEditOrder", "RollbackEditionAndQuit", "NewPR", "ReOpenReception", "BypassERPAck", "Reject", "BackToBuyer"];
    const deprecatedControls = ["RelatedGoodsReceipt__", "NewGR", "ItemsButtons", "EditOC", "GenerateOC"];
    const globalLayout = new Lib.P2P.Layout.Manager(panes, buttons, Object.values(Lib.P2P.Layout.Splitter), deprecatedControls);
    async function InitRelatedASN() {
        const isAdvancedShippingNoticeEnabled = Sys.Parameters.GetInstance("P2P").GetParameterBool("EnableAdvancedShippingNotice", false);
        let relatedShippingNoticePaneShown;
        if (isAdvancedShippingNoticeEnabled) {
            SetRelatedASNVisibility(false);
            Controls.DisplayAdvancedShippingNotices__.OnClick = () => SetRelatedASNVisibility(!relatedShippingNoticePaneShown);
            const itemCount = await Lib.Purchasing.ASN.InitRelatedASNPane(Controls.RelatedShippingNoticeTable__, Controls.RelatedShippingNoticePane, true);
            Controls.RelatedShippingNoticePane.Hide(true);
            Controls.DisplayAdvancedShippingNotices__.Hide(itemCount === 0);
        }
        function SetRelatedASNVisibility(isVisible) {
            relatedShippingNoticePaneShown = isVisible;
            Controls.RelatedShippingNoticePane.Hide(!isVisible);
            Controls.DisplayAdvancedShippingNotices__.SetText(isVisible ? "_DisplayAdvancedShippingNotices_hide" : "_DisplayAdvancedShippingNotices_show");
        }
    }
    CustomScript.InitRelatedASN = InitRelatedASN;
    async function InitRelatedReturnOrders() {
        let relatedROPaneShown;
        if (Lib.Purchasing.ReturnManagement.IsEnabled()) {
            SetRelatedROPaneVisibility(false);
            Controls.DisplayReturnOrders__.OnClick = () => SetRelatedROPaneVisibility(!relatedROPaneShown);
            const itemCount = await Lib.Purchasing.ReturnManagement.InitRelatedROPane(Controls.RelatedReturnOrdersTable__, Controls.RelatedReturnOrdersPane, true);
            Controls.RelatedReturnOrdersPane.Hide(true);
            Controls.DisplayReturnOrders__.Hide(itemCount === 0);
        }
        function SetRelatedROPaneVisibility(isVisible) {
            relatedROPaneShown = isVisible;
            Controls.RelatedReturnOrdersPane.Hide(!isVisible);
            Controls.DisplayReturnOrders__.SetText(isVisible ? "_DisplayRelatedRO_hide" : "_DisplayRelatedRO_show");
        }
    }
    CustomScript.InitRelatedReturnOrders = InitRelatedReturnOrders;
    async function InitRelatedEditPORequest() {
        let relatedEditPORequestPaneShown = false;
        SetRelatedEditPORequestVisibility(false);
        Controls.DisplayEditPORequest__.OnClick = () => SetRelatedEditPORequestVisibility(!relatedEditPORequestPaneShown);
        function SetRelatedEditPORequestVisibility(isVisible) {
            relatedEditPORequestPaneShown = isVisible;
            Controls.RelatedEditPORequestPanel.Hide(!isVisible);
            Controls.DisplayEditPORequest__.SetText(isVisible ? "_DisplayEditPORequest_hide" : "_DisplayEditPORequest_show");
        }
        const itemCount = await Lib.Purchasing.EditPORequest.InitRelatedEditPORequestPanel(Controls.RelatedEditPORequestTable__, Controls.RelatedEditPORequestPanel, true);
        Controls.RelatedEditPORequestPanel.Hide(true);
        Controls.DisplayEditPORequest__.Hide(itemCount === 0);
    }
    function InitRelatedDocumentPane() {
        const promises = [];
        [Controls.RelatedEditPORequestTable__, Controls.RelatedReturnOrdersTable__, Controls.RelatedShippingNoticeTable__, Controls.RelatedGoodsReceiptDetailedTable__, Controls.RelatedGoodsReceiptTable__, Controls.RelatedInvoicesTable__, Controls.RelatedInvoicesDetailedTable__, Controls.RelatedOrderConfirmationsTable__]
            .forEach(control => {
            control.SetItemCount(0);
            control.SetAtLeastOneLine(false);
        });
        // Panes
        Controls.LocalActionPane.Hide(true);
        Controls.RelatedInvoicesPane.Hide(true);
        Controls.Delivery_history.Hide(true);
        Controls.RelatedEditPORequestPanel.Hide(true);
        Controls.RelatedShippingNoticePane.Hide(true);
        Controls.RelatedReturnOrdersPane.Hide(true);
        Controls.RelatedOrderConfirmationsPane.Hide(true);
        // Buttons
        Controls.DisplayGoodsReceipt__.Hide(true);
        Controls.DisplayInvoices__.Hide(true);
        Controls.DisplayOrderConfirmations__.Hide(true);
        if (Data.GetValue("OrderStatus__") !== POStatus.toOrder) {
            promises.push(Sys.Parameters.GetInstance("PAC").PromisedIsReady()
                .Then(() => {
                const promisesWithParams = [];
                if (!Sys.Helpers.IsEmpty(Data.GetValue("OrderNumber__"))) {
                    if (!Sys.Parameters.GetInstance("PAC").GetParameterBool("EnableDetailedInvoicesTableOnPO", false)) {
                        promisesWithParams.push(Lib.Purchasing.RelatedVIP.InitRelatedInvoice(null, Controls.LocalActionPane));
                    }
                    else {
                        promisesWithParams.push(Lib.Purchasing.RelatedVIP.InitRelatedDetailedInvoice(Controls.LocalActionPane));
                    }
                    if (!Sys.Parameters.GetInstance("PAC").GetParameterBool("EnableDetailedGoodsReceiptTableOnPO", false)) {
                        promisesWithParams.push(Lib.Purchasing.ReceivingHistory.InitRelatedGoodsReceipt(g_isInternal));
                    }
                    else {
                        promisesWithParams.push(Lib.Purchasing.ReceivingHistory.InitRelatedDetailedGoodsReceipt(g_isInternal));
                    }
                    if (Sys.Parameters.GetInstance("P2P").GetParameterBool("EnableOrderConfirmation", false)) {
                        promisesWithParams.push(Lib.Purchasing.RelatedOC.InitRelatedOC());
                    }
                }
                return Sys.Helpers.Promise.All(promisesWithParams);
            }));
            promises.push(InitRelatedASN());
            promises.push(InitRelatedEditPORequest());
            promises.push(InitRelatedReturnOrders());
        }
        return Sys.Helpers.Promise.All(promises).Then(() => {
            // If any of the below table have an item we show the action pane
            Controls.LocalActionPane.Hide(Controls.RelatedEditPORequestTable__.GetItemCount() === 0 &&
                Controls.RelatedReturnOrdersTable__.GetItemCount() === 0 &&
                Controls.RelatedShippingNoticeTable__.GetItemCount() === 0 &&
                Controls.RelatedGoodsReceiptDetailedTable__.GetItemCount() === 0 &&
                Controls.RelatedGoodsReceiptTable__.GetItemCount() === 0 &&
                Controls.RelatedInvoicesTable__.GetItemCount() == 0 &&
                Controls.RelatedInvoicesDetailedTable__.GetItemCount() === 0 &&
                Controls.RelatedOrderConfirmationsTable__.GetItemCount() === 0);
        });
    }
    function InitAdditionalFees() {
        const status = Data.GetValue("OrderStatus__");
        const isToOrderOrEditing = (status === POStatus.toOrder || status === POStatus.toReceive || g_hasERPEditError) && !viewer.IsReadOnly;
        const canModifyAdditionalFees = isToOrderOrEditing && !Lib.ERP.IsSAP();
        Controls.AddFee__.Hide(!canModifyAdditionalFees);
        Controls.AdditionalFees__.SetReadOnly(!canModifyAdditionalFees);
        Controls.AdditionalFees__.Price__.SetReadOnly(Lib.P2P.IsAdminNotOwner() || !isToOrderOrEditing);
        Controls.AdditionalFees__.ItemTaxCode__.Hide(!Lib.Purchasing.POItems.showTax);
        Controls.AdditionalFees__.ItemTaxCode__.SetReadOnly(!Lib.Purchasing.POItems.showTax);
        Controls.AdditionalFees__.ItemTaxCode__.SetRequired(Lib.Purchasing.POItems.showTax);
        //display table as sum of fields width
        Controls.AdditionalFees__.SetWidth("auto");
        Controls.AdditionalFees__.SetAtLeastOneLine(false);
        Controls.BrowseAddFees__.SetAttributes("AdditionalFeeID__");
        // Hide AdditionalFees table by default if no value has been set in it
        if (Data.GetTable("AdditionalFees__").GetItemCount() == 0) {
            Controls.AdditionalFees_pane.Hide(true);
        }
    }
    function InitTechnicalFields() {
        Controls.TaxSummaryPane.Hide(true);
        Controls.TaxSummary__.SetAtLeastOneLine(false);
        globalLayout.HideDeprecatedControls();
        /**
         * Button for debug purpose, in order to enable them, use Lib.PO.Customization.Client.CustomizeLayout
         */
        Controls.Generate_CO.Hide();
        Controls.Finalize_PO.Hide();
    }
    function InitConversationPane() {
        const conversationInfo = Lib.P2P.Conversation.ExtendConversationInfoWithBusinessInfo({ Options: Lib.P2P.Conversation.defaultOptions }, Lib.P2P.Conversation.GetBusinessInfoFromUser(User));
        Controls.ConversationUI__.Init(conversationInfo);
        Controls.ConversationUI__.SetOptions(Lib.P2P.Conversation.Options.GetDefault(Lib.Purchasing.SenderType.IsCustomer));
        // Show event history
        if (Variable.GetValueAsString("CustomerOrderNumber")) {
            // Add vendor name into Event history panel title
            let title = Language.Translate("_Event_history", false, Controls.VendorName__.GetValue());
            Controls.Event_history.SetText(title);
            Controls.Event_history.Hide(false);
        }
        else {
            Controls.Event_history.Hide(true);
        }
    }
    function InitGeneralInformations() {
        let status = Data.GetValue("OrderStatus__");
        Controls.Requisition_information.Hide(!IsGeneralInfoDisplayed());
        Controls.RevisionDateTime__.Hide(Sys.Helpers.IsEmpty(Data.GetValue("RevisionDateTime__")));
        if (Controls.ERPError__.GetValue() == Language.Translate("_No error provided by ERP")) {
            Controls.OrderNumber__.SetError(Language.Translate("_No error provided by ERP Tooltip"));
        }
        else if (g_hasERPEditError) {
            // Do not display error in edit mode to allow Edit PO submision
            Controls.OrderNumber__.SetError(CustomScript.g_isEditing ? "" : Language.Translate("_ERPError {0} update", false, Controls.ERPError__.GetValue()));
        }
        else if (g_hasERPCancelError) {
            Controls.OrderNumber__.SetError(Language.Translate("_ERPError {0} cancellation", false, Controls.ERPError__.GetValue()));
        }
        else if (Sys.Helpers.IsEmpty(Controls.ERPError__.GetValue())) {
            Controls.OrderNumber__.SetError("");
        }
        else {
            const errorTranslationKey = Sys.Helpers.IsEmpty(Controls.OrderNumber__.GetValue()) ? "_ERPError {0}" : "_ERPError {0} with number";
            Controls.OrderNumber__.SetError(Language.Translate(errorTranslationKey, false, Controls.ERPError__.GetValue()));
        }
        const isPOInDraft = status === POStatus.toOrder;
        const isOrderNumberEditable = CanValidateAfterERPError();
        Controls.OrderNumber__.Hide(Sys.Helpers.IsEmpty(Data.GetValue("OrderNumber__"))
            && Sys.Helpers.IsEmpty(Controls.OrderNumber__.GetError()));
        Controls.OrderNumber__.SetReadOnly(!isOrderNumberEditable);
        Controls.OrderNumber__.SetRequired(isOrderNumberEditable);
        Controls.BuyerName__.Hide(status === POStatus.canceled || isPOInDraft);
        Controls.OrderDate__.Hide(status === POStatus.canceled || isPOInDraft);
        Controls.ConfirmationDatetime__.Hide(true);
        Controls.OrderStatus__.Hide(true);
    }
    function InitAdditionalDataPane() {
        let isEditable = Data.GetValue("OrderStatus__") === POStatus.toOrder && !viewer.IsReadOnly;
        Controls.ValidityStart__.SetReadOnly(!isEditable);
        Controls.ValidityEnd__.SetReadOnly(!isEditable);
        Controls.AdditionalDataPane.Hide(true);
    }
    async function InitButton() {
        const promises = [];
        let status = Data.GetValue("OrderStatus__");
        const isBuyerOrBackUp = CustomScript.IsBuyerOrBackUp();
        const hideNewPRButton = g_state === "70" || CustomScript.g_isEditing
            || Sys.Helpers.IsEmpty(Controls.OrderNumber__.GetValue())
            || (Controls.EmailNotificationOptions__.GetValue() == "PunchoutMode")
            || (!IsOwner() && !User.IsBackupUserOf(Data.GetValue("OwnerId")) && !IsRecipientOrBackup());
        Controls.NewPR.Hide(hideNewPRButton);
        Controls.NewGR2.Hide(true);
        Controls.CloseReception.Hide(true);
        Controls.ReOpenReception.Hide(true);
        Controls.Reject.Hide(true);
        Controls.RollbackCancellation.Hide(true);
        if (g_isInternal) {
            Controls.NewGR2.SetLabel("_NewPickUp");
            Controls.NewGR2.OnClick = function () {
                ProcessInstance.OpenInProcess({
                    processName: "Inventory Pickup__",
                    attachmentsMode: "none",
                    willBeChild: true,
                    startWithoutProcessing: true,
                    doNotCopyExternalVarsFromAncestor: true
                });
                return false;
            };
        }
        const isPreviewHidden = Lib.P2P.IsAdminNotOwner() ||
            !((status === POStatus.toOrder) || status === POStatus.toReceive && CustomScript.g_isEditing);
        Controls.Preview_purchase_order.Hide(isPreviewHidden);
        Controls.DownloadCrystalReportsDataFile.Hide(true);
        Controls.BypassERPAck.Hide(true);
        promises.push(UpdateCancelActionPendingStatus().then(() => {
            Controls.Cancel_purchase_order.Hide(!IsCancelable());
        }));
        promises.push(UpdateSkippedActionPendingStatus());
        Controls.SynchronizeItems.Hide(g_hideSynchronizeItemsButton);
        Controls.SaveEditing_.Hide(true);
        Controls.SaveEditOrder.Hide(true);
        Controls.RollbackEditionAndQuit.Hide(true);
        g_editButtonVisible = Controls.Edit_.IsVisible() && isBuyerOrBackUp && !g_isInternal
            && !Lib.Purchasing.PO.ERP.IsWaitingForAck(["ERPAckCancelItems" /* Lib.Purchasing.PO.ERP.SubStatus.CancelItems */, "ERPAckReOpenItems" /* Lib.Purchasing.PO.ERP.SubStatus.ReOpenItems */, "ERPAckCreate" /* Lib.Purchasing.PO.ERP.SubStatus.Create */, "ERPAckCancel" /* Lib.Purchasing.PO.ERP.SubStatus.Cancel */]);
        Controls.Edit_.Hide(true);
        Controls.EnterPONumber.Hide(true);
        if (g_state === "90") {
            promises.push(IsProcessingERPAck()
                .then(function (isprocessing) {
                if (!isprocessing) {
                    if (status === POStatus.waitingForERPAck) {
                        const isCreatingInERP = Sys.Helpers.IsEmpty(Controls.OrderNumber__.GetValue());
                        Controls.EnterPONumber.Hide(!isCreatingInERP);
                        Controls.EnterPONumber.SetDisabled(!isCreatingInERP);
                        Controls.BypassERPAck.Hide(isCreatingInERP || ProcessInstance.isEditing || g_hasSkippedActionPending);
                        Controls.BypassERPAck.SetDisabled(isCreatingInERP);
                        Controls.RollbackCancellation.Hide(!Lib.Purchasing.PO.ERP.HasERPError("ERPAckCancel" /* Lib.Purchasing.PO.ERP.SubStatus.Cancel */) || !!Variable.GetValueAsString("RejectionAction__"));
                    }
                }
            }));
        }
        SetSubmitButtonLabel();
        Controls.Submit_.Hide(Lib.P2P.IsAdminNotOwner()
            || !Lib.Purchasing.PO.Workflow.IsCurrentContributor()
            || status === POStatus.toReceive
            || status === POStatus.awaitingAutoGRProcessing
            || status === POStatus.received
            || status === POStatus.waitingForERPAck);
        Controls.BackToBuyer.Hide(Lib.P2P.IsAdminNotOwner()
            || !Lib.Purchasing.PO.Workflow.IsCurrentContributorWithAction(Lib.Purchasing.PO.Workflow.parameters.actions.approval.GetName())
            || Data.GetValue("OrderStatus__") !== POStatus.toApprove);
        Controls.Save.Hide(Lib.P2P.IsAdminNotOwner()
            || (!Lib.Purchasing.PO.Workflow.IsCurrentContributor() && !Lib.P2P.IsOwnerOrBackupOrAdmin())
            || ![POStatus.toPay, POStatus.toOrder].includes(status));
        promises.push(InitManualReceiptButton());
        promises.push(InitROButton());
        promises.push(InitBillingCompleteControls());
        /*
        * DemoEnableInvoiceCreation :
        * 0 = Nothing to do
        * 1 = User can generate his invoice when he want
        * 2 = Global invoice is generated when the P.O is sent to the vendor
        * 3 = Partial invoices are generated whenever items are delivered
        */
        if (Sys.Parameters.GetInstance("PAC").GetParameterNumber("DemoEnableInvoiceCreation") !== 1) {
            Controls.Generate_Invoice.Hide();
        }
        await Promise.all(promises);
    }
    function InitVendorPanes() {
        let status = Data.GetValue("OrderStatus__");
        const isReadOnly = (status !== POStatus.toOrder) || viewer.IsReadOnly;
        Controls.VendorName__.SetReadOnly(isReadOnly);
        Controls.CombinedVendor__.SetReadOnly(isReadOnly);
        // To avoid error "This field is required" in the following 3 fields when creating PO from Items, the fields are defined as not required in process template and reset here to required.
        Controls.VendorName__.SetRequired(true);
        Controls.VendorEmail__.SetRequired(true);
        Controls.EmailCarbonCopy__.Hide(true);
        Controls.Vendor_notification_pane.Hide(g_isInternal || Data.GetValue("OrderStatus__") !== POStatus.toOrder);
        Controls.Vendor_notification_pane.SetReadOnly(isReadOnly);
        Controls.NewVendorRequest__.Hide(isReadOnly || Lib.Purchasing.Vendor.IsVendorRegistrationAvailable());
        Controls.NewVendorRegistration__.Hide(isReadOnly || !Lib.Purchasing.Vendor.IsVendorRegistrationAvailable());
        Controls.VendorName__.Hide(true);
        Lib.Purchasing.Vendor.Client.InitCombinedVendorValue();
        Controls.CombinedVendor__.Hide(false);
        Controls.CombinedVendor__.SetRequired(true);
        Controls.Vendor_details.Hide(g_isInternal);
        Controls.VendorCurrency__.SetWidth("275");
        Controls.VendorNumber__.DisplayAs({ type: "Link" });
        Controls.VendorNumber__.OnClick = OpenCompanyDashboardOrVRProcess;
        UpdateVendorEmailLayout();
        Lib.Purchasing.Vendor.Client.PO.CheckAndDisplayScore();
        Lib.Purchasing.Vendor.Client.PO.UpdateIconForLifeCycleStatus();
    }
    CustomScript.InitVendorPanes = InitVendorPanes;
    function InitBrowsePRItems() {
        let attributes = "";
        Sys.Helpers.Object.ForEach(Lib.Purchasing.Items.PRItemsDBInfo.fields, function (field) {
            attributes += Sys.Helpers.IsPlainObject(field) ? field.name : field;
            attributes += "|";
        });
        //remove trailing | character
        attributes = attributes.slice(0, -1);
        Controls.BrowsePRItems__.SetAttributes(attributes);
    }
    function InitProgressOrderPane() {
        // Always hide old progress bar
        Controls.ProgressBar__.Hide(true);
        // New one
        const isVisible = Lib.Purchasing.POProgressBar.IsProgressBarVisible(g_isInternal);
        Controls.ProgressChart__.Hide(false);
        Controls.progressBarPanel.Hide(!isVisible);
    }
    function InitContractBrowses() {
        function On() {
            Lib.Purchasing.CheckPO.CheckContractCoherency(this.GetItem(), Data.GetValue("VendorNumber__"), Data.GetValue("Currency__"), true);
        }
        Lib.Purchasing.Contract.InitContractBrowses(Controls.LineItems__, null, On, On);
    }
    //#region billing completion
    function IsBillingCompleteAuthorized() {
        const status = Data.GetValue("OrderStatus__");
        return status === POStatus.received
            && CustomScript.IsRoleAuthorizedForBillingCompleted()
            && !Lib.ERP.IsDocCreatedInERP() //hide feature button when using ERP as long as EoD billing completed is not synchronized with ERP
            && !Lib.P2P.Inventory.IsInternalOrder(); //No invoice on internal orders
    }
    CustomScript.IsBillingCompleteAuthorized = IsBillingCompleteAuthorized;
    function UpdateVisibilityForBillingCompletedButtons(invoiceStatusOnPO) {
        if (CustomScript.IsBillingCompleteAuthorized()) {
            switch (invoiceStatusOnPO) {
                case Lib.Purchasing.RelatedVIP.InvoicingStatus.ALL_LINES_FULLY_INVOICED:
                    Controls.BillingCompleted.Hide(true);
                    Controls.ReopenBilling.Hide(false);
                    break;
                case Lib.Purchasing.RelatedVIP.InvoicingStatus.ALL_LINES_AMOUNTS_FULLY_INVOICED:
                    Controls.BillingCompleted.Hide(true);
                    Controls.ReopenBilling.Hide(true);
                    break;
                case Lib.Purchasing.RelatedVIP.InvoicingStatus.NO_LINE_FULLY_INVOICED:
                    Controls.BillingCompleted.Hide(false);
                    Controls.ReopenBilling.Hide(true);
                    break;
                default:
                    Controls.BillingCompleted.Hide(false);
                    Controls.ReopenBilling.Hide(false);
                    break;
            }
        }
        else {
            Controls.BillingCompleted.Hide(true);
            Controls.ReopenBilling.Hide(true);
        }
    }
    CustomScript.UpdateVisibilityForBillingCompletedButtons = UpdateVisibilityForBillingCompletedButtons;
    async function InitBillingCompleteControls() {
        const invoiceStatus = await Lib.Purchasing.RelatedVIP.GetPOInvoiceStatus();
        await CustomScript.UpdateAvailabilityForBillingCompleteButtons();
        CustomScript.UpdateVisibilityForBillingCompletedButtons(invoiceStatus);
    }
    CustomScript.InitBillingCompleteControls = InitBillingCompleteControls;
    async function UpdateAvailabilityForBillingCompleteButtons() {
        Controls.BillingCompleted.SetDisabled(true);
        Controls.ReopenBilling.SetDisabled(true);
        try {
            const result = await ProcessInstance.CheckResumeWithActionPending(["UpdateBillingCompleted", "ReopenBilling"]);
            if (!result.hasResumeActionPending && ProcessInstance.state >= 90) {
                Controls.BillingCompleted.SetDisabled(false);
                Controls.ReopenBilling.SetDisabled(false);
            }
        }
        catch (errorResult) {
            // Error retrieving hasResumeActionPending
            Log.Info(JSON.stringify(errorResult.errors));
        }
    }
    CustomScript.UpdateAvailabilityForBillingCompleteButtons = UpdateAvailabilityForBillingCompleteButtons;
    //#endregion
    function FixLayout() {
        const isReadOnly = viewer.IsReadOnly;
        const promisesToWait = [];
        globalLayout.Hide(false);
        globalLayout.HideWaitScreen();
        if (CustomScript.IsBuyerOrBackUp()) {
            Process.SetHelpId("5031");
        }
        InitTechnicalFields();
        Lib.Purchasing.POItems.Items.InitLayout();
        InitAdditionalFees();
        InitConversationPane();
        const IsShipToReadOnly = Data.GetValue("OrderStatus__") !== POStatus.toOrder
            || isReadOnly
            || (!Lib.Purchasing.IsMultiShipTo() && Lib.P2P.Inventory.HasReplenishmentItems(Data.GetTable("LineItems__")));
        Lib.Purchasing.ShipTo.InitControls(IsShipToReadOnly, OnSelectShipToItem);
        InitGeneralInformations();
        InitAdditionalDataPane();
        promisesToWait.push(InitButton());
        Lib.Purchasing.PO.Workflow.InitWorkflowLayout(g_initialStatus);
        promisesToWait.push(InitRelatedDocumentPane());
        InitVendorPanes();
        InitBrowsePRItems();
        InitProgressOrderPane();
        InitContractBrowses();
        promisesToWait.push(InitBillingCompleteControls());
        if (Lib.Purchasing.Vendor.IsVendorRegistrationAvailable()) {
            Lib.Purchasing.Vendor.Client.DetermineCombinedVendorTooltip();
        }
        Controls.BuyerComment__.SetPlaceholder("_buyerComment_Placeholder");
        Controls.BuyerComment__.SetHelpData("_buyerComment_HelpText");
        Lib.Purchasing.POItems.SetupFormTemplateManager();
        Lib.Purchasing.PO.DownPayment.UpdateGui(Data.GetValue("OrderStatus__"));
        return Sys.Helpers.Promise.All(promisesToWait);
    }
    CustomScript.FixLayout = FixLayout;
    async function InitManualReceiptButton() {
        let status = Data.GetValue("OrderStatus__");
        const hasNoGoodsReceiptItemsReceivable = await Lib.Purchasing.POItems.HasNoGoodsReceiptItems({
            onlyOutdatedItems: false,
            onlyNonInvoicedItems: true
        });
        // Possible improvement : check both receivability and role BY LINE to determine diplsay of manual receipt button
        const hasUserAuthorizedRole = IsCurrentUserApSpecialist() || IsBuyerOrBackUp() || IsRecipientOrBackup() || Lib.P2P.IsAdminNotOwner();
        const isOrderedAndNotClosedForReception = (status === POStatus.toReceive || status === POStatus.received);
        // Hidden if PO is not receivable or noGR items are invoiced (even partially)
        Controls.ManualReception.Hide(!(hasNoGoodsReceiptItemsReceivable
            && isOrderedAndNotClosedForReception
            && hasUserAuthorizedRole
            && !Lib.ERP.IsDocCreatedInERP()
            && !Lib.Purchasing.POItems.IsBillingCompleted()
            && !ProcessInstance.isEditing));
    }
    CustomScript.InitManualReceiptButton = InitManualReceiptButton;
    async function InitROButton() {
        await Sys.Parameters.GetInstance("P2P").PromisedIsReady();
        const isReturnManagementEnabled = Lib.Purchasing.ReturnManagement.IsEnabled();
        Controls.CreateReturnOrder.Hide(true);
        if (Data.GetValue("OrderStatus__") !== POStatus.waitingForERPAck) {
            const isProcessing = await IsProcessingERPAck();
            if (!isProcessing) {
                const notReturnable = g_state === "70" || (CustomScript.g_isEditing || g_isInternal || !isReturnManagementEnabled || !ComputeReturnabilityOfItems() || Lib.Purchasing.POItems.IsBillingCompleted());
                if (notReturnable === false) {
                    if (Number(g_state) < 100) // if state >= 100 all GR are returnable request is useless.
                     {
                        const returnableGr = await Lib.Purchasing.ReturnManagement.GetFirstReturnableGR(Data.GetValue("OrderNumber__"));
                        Controls.CreateReturnOrder.Hide(returnableGr.length === 0);
                    }
                    else {
                        Controls.CreateReturnOrder.Hide(false);
                    }
                }
                else {
                    Controls.CreateReturnOrder.Hide(true);
                }
            }
        }
    }
    CustomScript.InitROButton = InitROButton;
    function ComputeReturnabilityOfItems() {
        // At lease one quantity based item received with a received quantity < returned quantity
        const table = Data.GetTable("LineItems__");
        let i = 0;
        let returnableItemFound = false;
        let item;
        const isAdmin = Lib.P2P.IsAdminNotOwner();
        while (i < table.GetItemCount() && !returnableItemFound) {
            item = table.GetItem(i);
            returnableItemFound =
                item.GetValue("ItemType__") === Lib.P2P.ItemType.QUANTITY_BASED
                    && Sys.Helpers.Data.IsFalse(item.GetValue("NoGoodsReceipt__"))
                    && item.GetValue("ItemTotalDeliveredQuantity__") > 0
                    && item.GetValue("ItemReturnQuantity__") < item.GetValue("ItemTotalDeliveredQuantity__")
                    && (isAdmin || IsLineRecipientOrBackup(item));
            i++;
        }
        return returnableItemFound;
    }
    async function ConditionalLayout() {
        const promisesToWait = [];
        function SetBannerLabel(poBanner, poStatus) {
            switch (poStatus) {
                case POStatus.toOrder:
                    poBanner.SetSubTitle("_Banner to order");
                    break;
                case POStatus.toApprove:
                    poBanner.SetSubTitle("_Banner to approve");
                    break;
                case POStatus.toPay:
                    poBanner.SetSubTitle("_Banner to pay");
                    break;
                case POStatus.canceled:
                    poBanner.SetSubTitle("_Banner order canceled");
                    break;
                case POStatus.toReceive:
                    poBanner.SetSubTitle("_Banner waiting for delivery");
                    break;
                case POStatus.rejected:
                    poBanner.SetSubTitle("_Banner order rejected");
                    break;
                case POStatus.waitingForERPAck:
                    {
                        let subtitle = "_Banner waiting for ERP ack";
                        const status = Data.GetValue("OrderSubStatus__");
                        switch (status) {
                            case "ERPAckEdit":
                                subtitle = "_Banner waiting for ERP edit ack";
                                break;
                            case "ERPAckCancelItems":
                                subtitle = "_Banner waiting for ERP cancel items ack";
                                break;
                            case "ERPAckReOpenItems":
                                subtitle = "_Banner waiting for ERP reopen items ack";
                                break;
                            case "ERPAckCancel":
                                subtitle = "_Banner waiting for ERP cancel ack";
                                break;
                            default:
                                break;
                        }
                        poBanner.SetSubTitle(subtitle);
                    }
                    break;
                default:
                    poBanner.SetSubTitle("_Banner deliveredPO");
            }
        }
        let status = Data.GetValue("OrderStatus__");
        Controls.PaymentTermCode__.SetReadOnly(Lib.P2P.IsAdminNotOwner() || status !== POStatus.toOrder);
        Controls.PaymentMethodCode__.SetReadOnly(Lib.P2P.IsAdminNotOwner() || status !== POStatus.toOrder);
        if (status !== POStatus.toOrder || Lib.P2P.IsAdminNotOwner()) {
            if (Lib.P2P.IsAdminNotOwner()) {
                Controls.DocumentsPanel.SetReadOnly(true);
            }
            let nbAttach = Attach.GetNbAttach();
            Controls.DocumentsPanel.SetNumberOfNonRemovableAttachments(nbAttach);
        }
        else if (status === POStatus.toOrder && viewer.IsReadOnly) {
            Controls.DocumentsPanel.SetReadOnly(true);
        }
        else if (ProcessInstance.isDesignActive) {
            let poTemplateInfos = Lib.Purchasing.PO.Export.GetPOTemplateInfos();
            if (poTemplateInfos.fileFormat === "RPT") {
                Controls.DownloadCrystalReportsDataFile.Hide(false);
            }
        }
        let controlsToDisableIfPendingAction = [];
        // reception pending and completed
        if (status === POStatus.toReceive || status === POStatus.awaitingAutoGRProcessing || status === POStatus.received || g_hasERPEditError) {
            // computing the current status...
            banner.SetSubTitle("");
            const hasRightsToCloseOrReopenReception = IsCurrentUserApSpecialist() || IsBuyerOrBackUp() || IsRecipientOrBackup() || Lib.P2P.IsAdmin();
            if (status !== POStatus.received) {
                // enable editable all modifiable fields such as delivery date
                if (CustomScript.g_isEditing) {
                    let nextAlert = Lib.CommonDialog.NextAlert.GetNextAlert();
                    if (!nextAlert || !nextAlert.isError) {
                        promisesToWait.push(EditingLayout());
                    }
                }
                else {
                    Controls.NewGR2.Hide(!ShouldDisplayNewGR());
                    Controls.NewGR2.SetDisabled(true);
                    Controls.Edit_.Hide(!g_editButtonVisible);
                    Controls.RollbackEditionAndQuit.Hide(!g_hasERPEditError);
                    Controls.Edit_.SetDisabled(true);
                    const shouldHideCloseReception = g_isInternal || Lib.Purchasing.POItems.IsOverDeliveredButNotComplete() || g_hasERPEditError || g_hasERPCancelError;
                    Controls.CloseReception.Hide(!hasRightsToCloseOrReopenReception || shouldHideCloseReception);
                    Controls.CloseReception.SetDisabled(true);
                    Controls.CreateReturnOrder.SetDisabled(true);
                    promisesToWait.push(ProcessInstance.CheckResumeWithActionPending()
                        .then(function (result) {
                        if (!result.hasResumeActionPending) {
                            Controls.CloseReception.SetDisabled(g_isInternal || shouldHideCloseReception);
                            Controls.NewGR2.SetDisabled(!ShouldDisplayNewGR());
                            Controls.Edit_.SetDisabled(!g_editButtonVisible);
                            Controls.CreateReturnOrder.SetDisabled(false);
                        }
                    })
                        .catch(function (errorResult) {
                        // Error retrieving hasResumeActionPending
                        Log.Info(JSON.stringify(errorResult.errors));
                    }));
                }
                controlsToDisableIfPendingAction.push(Controls.ManualReception);
            }
            else {
                Controls.ReOpenReception.Hide(!hasRightsToCloseOrReopenReception || !Lib.Purchasing.POItems.HasLinesToReopen());
                controlsToDisableIfPendingAction.push(Controls.ReOpenReception);
            }
            promisesToWait.push(CheckPendingActions(controlsToDisableIfPendingAction));
        }
        SetBannerLabel(banner, status);
        SetPunchoutLineItemsToReadOnly();
        if (Lib.Purchasing.HasOnlyPunchoutItems()) {
            if (status === POStatus.toOrder) {
                // Set punchout mode by default if all items are punchout (and only in draft)
                Data.SetValue("EmailNotificationOptions__", "PunchoutMode");
            }
            UpdateVendorEmailLayout();
            UpdatePOLayoutAsPunchoutMode();
        }
        else if (status === POStatus.toOrder) {
            promisesToWait.push(Lib.Purchasing.CheckPO.CheckDataCoherency(false));
            const isNew = ProcessInstance.id == null;
            if (isNew) {
                promisesToWait.push(Lib.Purchasing.Vendor.QueryVendorPreferences(Data.GetValue("CompanyCode__"), Data.GetValue("VendorNumber__"))
                    .Then((preferences) => {
                    let POMethod = preferences === null || preferences === void 0 ? void 0 : preferences.POMethod__;
                    if (POMethod) {
                        if (POMethod == "SendToVendor" || POMethod == "DontSend") {
                            Data.SetValue("EmailNotificationOptions__", POMethod);
                            UpdateVendorEmailLayout();
                        }
                    }
                })
                    .Catch((e) => {
                    Log.Error("Error querying preferred PO method: " + e);
                }));
            }
        }
        Controls.WarehouseID__.Hide(true);
        Controls.WarehouseName__.Hide(!g_isInternal);
        if (Lib.P2P.Inventory.IsInventoryManager()) {
            Controls.WarehouseName__.DisplayAs({ type: "Link" });
            Controls.WarehouseName__.OnClick = function OpenWarehouseLink() {
                Lib.P2P.Inventory.OpenWarehouse(Data.GetValue("CompanyCode__"), Data.GetValue("WarehouseID__"));
            };
        }
        return Sys.Helpers.Promise.All(promisesToWait);
    }
    CustomScript.ConditionalLayout = ConditionalLayout;
    function CheckPendingActions(controlsToDisable) {
        if (!controlsToDisable || controlsToDisable.length === 0) {
            return Promise.resolve();
        }
        controlsToDisable.forEach(control => control.SetDisabled(true));
        return ProcessInstance.CheckResumeWithActionPending()
            .then(function (result) {
            if (!result.hasResumeActionPending && ProcessInstance.state >= 90) {
                controlsToDisable.forEach(control => control.SetDisabled(false));
            }
        })
            .catch(function (errorResult) {
            // Error retrieving hasResumeActionPending
            Log.Info(JSON.stringify(errorResult.errors));
        });
    }
    CustomScript.CheckPendingActions = CheckPendingActions;
    class ERPPopup {
        //#region static Members
        static GetERPMessage(messageName) {
            return Lib.ERP.ExecuteERPFunc("GetMessage", "PO", messageName);
        }
        static HandleDialog(title, messageName) {
            const dialog = new ERPPopup(title, messageName);
            if (!dialog.Display()) {
                dialog.Commit();
            }
        }
        //#endregion static Members
        //#region class Members
        constructor(title, messageName) {
            this.title = title;
            this.messageName = messageName;
        }
        Display() {
            const erpMessage = Lib.ERP.ExecuteERPFunc("GetMessage", "PO", this.messageName);
            if (!erpMessage.error && erpMessage.ret) {
                Popup.Dialog(Language.Translate(this.title, false), null, this.Fill.bind(this), this.Commit.bind(this), null, null, null);
                return true;
            }
            return false;
        }
        Fill(dialog) {
            Lib.ERP.Procurement.AddERPWarningToDialog(dialog, "PO", this.messageName);
        }
        // eslint-disable-next-line class-methods-use-this
        Commit() {
            Controls.SaveEditing_.Click();
        }
    }
    CustomScript.ERPPopup = ERPPopup;
    function OnClickSaveEditing() {
        Variable.SetValueAsString("SendOption", JSON.stringify({
            sendOption: "POEdit_EmailToVendor",
            email: Data.GetValue("VendorEmail__")
        }));
        Lib.Purchasing.PO.Edition.ChangesManager.Serialize();
        // Display the popup only if their are changes that require PO regeneration
        if (Lib.Purchasing.PO.Edition.ChangesManager.NeedToRegeneratePO()) {
            Variable.SetValueAsString("regeneratePO", "0");
            Lib.Purchasing.PO.RegenerationPopup.Display({
                onSendOptionChanged: (data) => {
                    Variable.SetValueAsString("SendOption", JSON.stringify(data));
                },
                onConfirmRegeneration: () => {
                    Variable.SetValueAsString("regeneratePO", "1");
                    Controls.SaveEditing_.Click();
                }
            });
        }
        else {
            ERPPopup.HandleDialog("_ERPManualUpdateRequiredTitle", "manualUpdateRequired");
        }
        return false;
    }
    CustomScript.OnClickSaveEditing = OnClickSaveEditing;
    async function EditingLayout() {
        Controls.LineItems__.ItemNetAmount__.SetLabel("_ItemToOrderAmount");
        Controls.LineItems__.ItemOpenAmount__.Hide(true);
        Controls.SaveEditOrder.Hide(false);
        Controls.SaveEditOrder.OnClick = function () {
            (async () => // Wrap for not return a promise in OnClick
             {
                try {
                    globalLayout.ShowWaitScreen();
                    await Process.CheckAllControls();
                    await CheckSpendingRemaining("CheckAsOrderedAfterEditing");
                    if (g_hasERPEditError) {
                        // Clear error to allow resubmit of Edit PO
                        Controls.OrderNumber__.SetError("");
                    }
                    const lastErrorMessage = await Lib.Purchasing.CheckPO.CheckAll();
                    if (Process.ShowFirstError(true) === null && !lastErrorMessage) {
                        OnClickSaveEditing();
                    }
                    else {
                        globalLayout.HideWaitScreen();
                    }
                }
                catch (_a) {
                    Log.Error("EditingLayout failed");
                    // Hide Wait screen only if exception and not in 'Finally'
                    // Because SaveEditing_.Click() made the Framework Show it 2 times
                    // And the Finally made the WaitScreen blink because it is executed between these 2 times
                    globalLayout.HideWaitScreen();
                }
            })();
        };
        Lib.CommonDialog.NextAlert.Reset();
        let focusCtrl;
        let table = Controls.LineItems__;
        let lineItemsCount = Math.min(table.GetItemCount(), table.GetLineCount());
        for (let i = lineItemsCount - 1; i >= 0; i--) {
            let row = table.GetRow(i);
            if (!row.ItemDeliveryComplete__.IsChecked()) {
                focusCtrl = row.ItemRequestedDeliveryDate__;
                focusCtrl.SetReadOnly(false);
            }
        }
        if (focusCtrl) {
            focusCtrl.Focus();
        }
        Lib.Purchasing.POItems.ItemsNumberHandler.StockItemsNumberBeforeEdit();
        Lib.Purchasing.PO.Edition.WatchAllEditionChanges();
        await Lib.Purchasing.CheckPO.CheckDataCoherency(false);
    }
    async function RollbackOrRetryPOChanges(nextAlert) {
        let firstSaveReturn = false;
        if (nextAlert.behaviorName === "POEditionError") {
            // first time, we are still in editing mode. We cannot do any action in this mode.
            await EditingLayout();
            firstSaveReturn = !!Data.GetActionName();
        }
        else {
            Lib.Purchasing.POItems.g_isOpenCloseReceptionInError = true;
        }
        let rollbackNeeded = Lib.Purchasing.PO.Edition.Rollback.IsRollbackNeeded();
        if (rollbackNeeded) {
            Lib.Purchasing.SetDocumentReadonlyAndHideAllButtonsExceptQuit("RollbackEditionAndQuit");
            Popup.Alert(nextAlert.message, true, null, nextAlert.title);
        }
        else {
            Lib.CommonDialog.NextAlert.PopupYesCancel(function (action) {
                switch (action) {
                    case "Yes":
                        if (firstSaveReturn) {
                            Controls.SaveEditing_.Click();
                        }
                        else {
                            const actions = {
                                POEditionError: "RetryEditOrder",
                                CancelUnreceivedItemsError: "Cancel_unreceived_items",
                                ReOpenUnreceivedItemsError: "Reopen_unreceived_items"
                            };
                            if (g_state !== "90") {
                                ProcessInstance.Approve(actions[nextAlert.behaviorName]);
                            }
                            else {
                                ProcessInstance.ResumeWithActionAsynchronous(actions[nextAlert.behaviorName]);
                            }
                        }
                        break;
                    default:
                        break;
                }
            }, nextAlert, "_Retry now", "_Retry later");
        }
    }
    /** ***** **/
    /** START **/
    /** ***** **/
    function Start() {
        const promisesToWait = [];
        Log.Time("Start");
        promisesToWait.push(Lib.Purchasing.InitTechnicalFields());
        /** ************************** **/
        /** ERP Specific initialization */
        /** ************************** **/
        Lib.Purchasing.Browse.Init();
        promisesToWait.push(FixLayout());
        promisesToWait.push(ConditionalLayout());
        if (wkfController.GetTableIndex() === 0) {
            Lib.Purchasing.PO.Workflow.UpdateRolesSequence(Lib.Purchasing.PO.DownPayment.IsAsked());
        }
        Lib.Purchasing.POItems.DisableButtonsIfNeeded();
        Lib.Purchasing.PO.Workflow.UpdateWorkflowLayout();
        Lib.CommonDialog.NextAlert.Show({
            // special behavior for Synchronize Items error
            "syncItemsFromActionError": {
                IsShowable: function () {
                    // just show the button and Popup
                    Controls.SynchronizeItems.Hide(false);
                    return true;
                }
            },
            // special behavior for Unexpected error
            "onUnexpectedError": {
                IsShowable: function () {
                    // In PO workflow we just advise user to check logs and retry last action.
                    // In post PO workflow we show the "SynchronizeItems" button (we change label) and advise user to check logs and retry
                    const status = Data.GetValue("OrderStatus__");
                    const inPOWorkflow = POStatus.ForPOWorkflow.indexOf(status) !== -1;
                    if (!inPOWorkflow) {
                        Controls.SynchronizeItems.SetText(Language.Translate("_Retry"));
                        Controls.SynchronizeItems.Hide(false);
                    }
                    return true;
                }
            },
            // special behaviors for PO creation
            "POCreationInfo": {
                IsShowable: function () {
                    let showable = !!Data.GetActionName();
                    // Avoid when popup is shown the "PO changed" warning
                    if (showable) {
                        Controls.PaymentType__.Hide(true);
                        Controls.PaymentDate__.Hide(true);
                        Controls.PaymentReference__.Hide(true);
                    }
                    return showable;
                },
                OnOK: function () {
                    // Close or go to the next document
                    if (!ProcessInstance.Next("next")) {
                        ProcessInstance.Quit("quit");
                    }
                }
            },
            "POCreationError": {
                Popup: function (nextAlert) {
                    Lib.CommonDialog.NextAlert.PopupYesCancel(function (action) {
                        switch (action) {
                            case "Yes":
                                ProcessInstance.Approve("Retry_");
                                break;
                            case "Cancel":
                                Lib.Purchasing.SetDocumentReadonlyAndHideAllButtonsExceptQuit();
                                break;
                            default:
                                break;
                        }
                    }, nextAlert, "_PO not found in ERP");
                }
            },
            "POEditInfo": {
                IsShowable: function () {
                    return !!Data.GetActionName();
                },
                OnOK: function () {
                    ProcessInstance.Quit("quit");
                }
            },
            "SendToVendorError": {
                Popup: function (nextAlert) {
                    Lib.CommonDialog.NextAlert.PopupYesCancel(function (action) {
                        switch (action) {
                            case "Yes":
                                ProcessInstance.Approve("DoCurrentWorkflowAction");
                                break;
                            case "Cancel":
                                Lib.Purchasing.SetDocumentReadonlyAndHideAllButtonsExceptQuit();
                                break;
                            default:
                                break;
                        }
                    }, nextAlert, "_Retry now", "_Retry later");
                }
            },
            "SendEmailNotifications": {
                Popup: function (nextAlert) {
                    Lib.CommonDialog.NextAlert.PopupYesCancel(function (action) {
                        switch (action) {
                            case "Yes":
                                ProcessInstance.Approve("SendEmailNotifications");
                                break;
                            case "Cancel":
                                Lib.Purchasing.SetDocumentReadonlyAndHideAllButtonsExceptQuit();
                                break;
                            default:
                                break;
                        }
                    }, nextAlert, "_Retry now", "_Retry later");
                }
            },
            "ClearSequence": {
                IsShowable: function () {
                    Data.SetValue("OrderNumber__", "");
                    return true;
                }
            },
            "CancelUnreceivedItemsError": {
                Popup: function (nextAlert) {
                    RollbackOrRetryPOChanges(nextAlert);
                }
            },
            "ReOpenUnreceivedItemsError": {
                Popup: function (nextAlert) {
                    RollbackOrRetryPOChanges(nextAlert);
                }
            },
            "POEditionError": {
                Popup: function (nextAlert) {
                    RollbackOrRetryPOChanges(nextAlert);
                }
            },
            "POCancelError": {
                Popup: function (nextAlert) {
                    Lib.CommonDialog.NextAlert.PopupYesCancel(function (action) {
                        switch (action) {
                            case "Yes":
                                OnClickCancelPO();
                                break;
                            case "Cancel":
                                Lib.Purchasing.SetDocumentReadonlyAndHideAllButtonsExceptQuit();
                                break;
                            default:
                                break;
                        }
                    }, nextAlert, "_Retry PO cancel");
                }
            },
            "EditPOREquestError": {
                Popup: function (nextAlert) {
                    EditingLayout();
                    Popup.Alert(nextAlert.message, true, null, nextAlert.title);
                }
            }
        });
        Controls.TopPaneWarning.Hide(true);
        promisesToWait.push(Lib.P2P.DisplayArchiveDurationWarning("PAC", () => Lib.P2P.DisplayArchiveDurationWarningAsTopMessageWarning(topMessageWarning)));
        promisesToWait.push(Lib.P2P.DisplayAdminWarning("PAC", function (displayName) {
            topMessageWarning.Add(Language.Translate("_View as admin on bealf of {0}", false, displayName));
        }));
        promisesToWait.push(Lib.P2P.DisplayBackupUserWarning("PAC", function (displayName) {
            topMessageWarning.Add(Language.Translate("_View on bealf of {0}", false, displayName));
        }, function () {
            if (Data.GetValue("OwnerID") == Sys.Helpers.Globals.User.loginId) {
                return null;
            }
            let buyerLogin = Controls.BuyerLogin__.GetValue() || "";
            let login = null;
            if (g_state === "50" || g_state === "70" || g_state === "90") {
                // Display banner for the backup of the buyer
                if (User.IsBackupUserOf(buyerLogin)) {
                    login = buyerLogin;
                }
                else {
                    // Display banner for the backup of the recipient
                    let g = Sys.Helpers.Globals;
                    let recipientDn;
                    let i = 0;
                    let table = Data.GetTable("LineItems__");
                    let count = table.GetItemCount();
                    while (!recipientDn && i < count) {
                        let row = table.GetItem(i);
                        recipientDn = row.GetValue("RecipientDN__");
                        if (!g.User.IsBackupUserOf(recipientDn)) {
                            recipientDn = null;
                        }
                        ++i;
                    }
                    // Display warning on state = 90 and 70
                    if ((g_state === "70" || g_state === "90") && User.IsBackupUserOf(Data.GetValue("OwnerId"))) {
                        recipientDn = Data.GetValue("OwnerId");
                    }
                    let recipientLogin = recipientDn ? Sys.Helpers.String.ExtractLoginFromDN(recipientDn) : null;
                    login = recipientLogin;
                }
            }
            return login;
        }));
        promisesToWait.push(Lib.Purchasing.RelatedVIP.HasInvoicesOnPOItems()
            .Then(function (HasInvoices) {
            g_hasInvoices = HasInvoices;
        }));
        if (ProcessInstance.state === 50) {
            const status = Data.GetValue("OrderStatus__");
            if (status === POStatus.toOrder) {
                Lib.Purchasing.SetDocumentReadonlyAndHideAllButtonsExceptQuit();
            }
        }
        if (!ProcessInstance.state) {
            ProcessInstance.DisableExtractionScript();
        }
        Process.ShowFirstError();
        return Sys.Helpers.Promise.All(promisesToWait)
            .Then(() => {
            /* All the layout is fixed, try to call for PS customization */
            const func = Sys.Helpers.TryGetFunction("Lib.PO.Customization.Client.CustomizeLayout");
            if (func) {
                return func();
            }
            else {
                return Sys.Helpers.TryCallFunction("Lib.PO.Customization.Client.CustomiseLayout");
            }
        })
            .Finally(() => {
            Log.TimeEnd("Start");
        });
    }
    /** *************** **/
    /** BEFORE STARTING **/
    /** *************** **/
    function FixLayoutBeforeStarting() {
        Log.Info("FixLayoutBeforeStarting");
        Process.ShowFirstErrorAfterBoot(false);
        globalLayout.Hide(true);
        globalLayout.ShowWaitScreen();
    }
    async function FillPurchaseOrder() {
        Log.Time("FillPurchaseOrder");
        Log.Info("Filling purchase order...");
        let prRuidEx;
        let filter = "";
        let options = { resetItems: true, orderByMsn: null, orderByClause: null };
        // ancestor:
        // - we either come from a PR, so we read items from it
        // - or we come from a PR Items admin list, and so we read those PR items
        let ancestorsids = ProcessInstance.selectedRuidFromView;
        if (ancestorsids) {
            let i = 0;
            for (i = 0; i < ancestorsids.length; i++) {
                if (ancestorsids[i].startsWith("CT#")) {
                    // It's a PR item
                    let msn = ancestorsids[i].split(".")[1];
                    filter += "(MSN=" + msn + ")";
                    if (!options.orderByMsn) {
                        options.orderByMsn = [];
                    }
                    options.orderByMsn.push(msn);
                }
                else {
                    // It's a PR
                    prRuidEx = ancestorsids[i];
                    filter += "(PRRUIDEX__=" + prRuidEx + ")";
                    Variable.SetValueAsString("PR_RuidEx__", prRuidEx);
                    options.orderByClause = "LineNumber__ ASC";
                }
            }
            if (i > 1) {
                filter = "(|" + filter + ")";
            }
        }
        if (!filter) {
            Log.Info("No PR RuidEx found on record because this PO is created from scratch. Skip this step.");
            Log.TimeEnd("FillPurchaseOrder");
            return Sys.Helpers.Promise.Resolve();
        }
        // Since the PR can be multi-buyers and the PO mono-buyer => pick only current buyer's items
        filter = "(&(BuyerDN__=$submit-owner)" + filter + "(Status__=" + Lib.Purchasing.PRStatus.toOrder + "))";
        // only no completely ordered items for this ruidex
        Log.Info("Filling PO Form with items from filter: " + filter);
        try {
            await Lib.Purchasing.POItems.FillForm(filter, options);
            Lib.Purchasing.Vendor.Client.PO.lastSelectedVendorName = Data.GetValue("VendorName__");
        }
        catch (e) {
            Lib.CommonDialog.NextAlert.Define("_Purchase order creation error", e, {
                isError: true,
                behaviorName: "POInitError"
            });
        }
        finally {
            Log.TimeEnd("FillPurchaseOrder");
        }
    }
    function UpdatePOFromGR() {
        const promisesToWait = [];
        const status = Data.GetValue("OrderStatus__");
        if (!Lib.Purchasing.ReturnManagement.IsEnabled() && status === POStatus.received) {
            Lib.Purchasing.POProgressBar.UpdateProgressBarIfVisible(g_isInternal);
            return Sys.Helpers.Promise.Resolve();
        }
        if (CustomScript.g_isEditing) {
            Lib.Purchasing.PO.Edition.ChangesManager.Watch("OrderStatus__");
            Lib.Purchasing.PO.Edition.ChangesManager.Watch("ItemUndeliveredQuantity__", "LineItems__");
            Lib.Purchasing.PO.Edition.ChangesManager.Watch("ItemDeliveryComplete__", "LineItems__");
            Lib.Purchasing.PO.Edition.ChangesManager.Watch("ItemNetAmount__", "LineItems__");
            promisesToWait.push(Lib.Purchasing.POItems.UpdatePOFromPRAndPO());
        }
        promisesToWait.push(FetchReturnQuantitiesFromReturnOrders()
            .Then((returnedQuantities) => Lib.Purchasing.POItems.UpdatePOFromGR(returnedQuantities))
            .Then(({ hasValidGoodsReceipt }) => {
            Lib.Purchasing.POItems.g_hasValidGoodsReceipt = hasValidGoodsReceipt;
            Lib.Purchasing.POProgressBar.UpdateProgressBarIfVisible(g_isInternal);
        })
            .Then(() => {
            //insure that RO related fields/buttons on PO are well updated after RO modifications
            //even if associated GRs are not updated yet
            Lib.Purchasing.POItems.ManageReturnedQuantityVisibility();
            return InitROButton();
        })
            .Catch(error => {
            Log.Error("Error updating progress bar");
            Log.Error(error);
        }));
        return Sys.Helpers.Promise.All(promisesToWait);
    }
    /**
     * When we're back on the PO after having created a Return Order, return quantities are not yet up to date on the GR, so we fetch return quantities on return orders.
     */
    async function FetchReturnQuantitiesFromReturnOrders() {
        if (false == Lib.Purchasing.ReturnManagement.IsEnabled()) {
            return {};
        }
        const results = await Lib.Purchasing.ROItems.GetReturnOrderItems(Data.GetValue("CompanyCode__"), Sys.Helpers.LdapUtil.FilterEqual("OrderNumber__", Data.GetValue("OrderNumber__")));
        Log.Info(`[FetchReturnQuantitiesFromReturnOrders] ${results.length} lines`);
        return Lib.Purchasing.ROItems.GroupResultByPOLineNumber(results);
    }
    function OpenCompanyDashboardOrVRProcess() {
        if (!Sys.Helpers.IsEmpty(Controls.VendorName__.GetValue())) {
            const vendorNumber = Controls.VendorNumber__.GetValue(), companyCode = Controls.CompanyCode__.GetValue();
            if (vendorNumber && companyCode) {
                Lib.P2P.SIM.OpenCompanyDashboard(vendorNumber, companyCode);
            }
        }
        //it's a vendor registration so opened VR process instead of dash of company
        else if (!Sys.Helpers.IsEmpty(Controls.VendorRegistrationID__.GetValue())) {
            Process.OpenMessage({
                ruidEx: Controls.VendorRegistrationID__.GetValue(),
                goBackOnQuit: false,
                inNewTab: true,
                additionalParameters: null
            });
        }
    }
    //#region Billing completed
    function OnClickBillingCompleted() {
        Log.Info("OnClickBillingCompleted");
        Popup.Confirm("_PO billing completed information", false, ResumePOBillingCompleted, null, "_PO billing completed confirmation");
        return false; //to not launch the next process
    }
    function GetResumeWithActionAsyncData() {
        const userLogin = User.loginId;
        const resumeWithActionAsyncData = {
            userLogin: userLogin
        };
        return JSON.stringify(resumeWithActionAsyncData);
    }
    function ResumePOBillingCompleted() {
        Log.Info("ResumePOBillingCompleted");
        return ProcessInstance.ResumeWithActionAsynchronous("UpdateBillingCompleted", {
            "ResumeWithActionAsyncData__": GetResumeWithActionAsyncData()
        });
    }
    function OnClickReopenBilling() {
        Log.Info("OnClickReopenBilling");
        Popup.Confirm("_PO reopen billing information", false, ResumePOReopenBilling, null, "_PO reopen billing confirmation");
        return false; //to not launch the next process
    }
    function ResumePOReopenBilling() {
        Log.Info("ResumePOReopenBilling");
        return ProcessInstance.ResumeWithActionAsynchronous("ReopenBilling", {
            "ResumeWithActionAsyncData__": GetResumeWithActionAsyncData()
        });
    }
    function OnErrorDuringInitialization() {
        globalLayout.HideActionButtons();
        Controls.Cancel_purchase_order.Hide(!IsCancelable());
        Controls.Close.Hide(false);
    }
    //#endregion
    //#region New vendor registration
    function OnClickNewVendorRegistration() {
        Lib.Purchasing.Vendor.Client.PO.OpenNewVendorRegistrationPopupFromPO();
    }
    //#endregion
    Sys.Helpers.EnableSmartSilentChange();
    // START - ignore all changes on form during the initialization processing
    Log.Info({
        "ReadOnly": ProcessInstance.isReadOnly,
        "State": ProcessInstance.state
    });
    ProcessInstance.SetSilentChange(true);
    FixLayoutBeforeStarting();
    Log.Info(`OrderStatus__ before update: ${g_initialStatus}`);
    async function preloadAndStart() {
        try {
            Log.Time("LoadParameters");
            await Lib.Purchasing.LoadParameters();
            Log.TimeEnd("LoadParameters");
            //Set up vendor registration custom query (no param check because field will be hidden if param is deactivated)
            Lib.Purchasing.Vendor.Client.PO.InitCombinedVendorBrowsePropertiesAndEventCallbacks();
            await Lib.Purchasing.Vendor.Client.PO.InitVendorCommunicationCultureAndLanguage();
            if (!g_state) {
                await FillPurchaseOrder();
            }
            if (g_initialStatus === POStatus.toOrder) {
                await Lib.Purchasing.Items.CheckProjectFields(Data.GetValue("CompanyCode__"), true);
                Lib.Purchasing.CheckPO.CheckAllLeadTimes();
                Lib.Purchasing.CheckPO.CheckItemsDeliveryDates();
            }
            Lib.Purchasing.Vendor.Client.PO.UpdateCombinedVendorBrowsePropertiesOnConfigurationChange();
            await Lib.Purchasing.Vendor.Client.PO.UpdateVendorFromVendorRegistration();
            if (RequiredUpdateFromGR()) {
                await UpdatePOFromGR();
            }
            await Sys.Helpers.TryCallFunction("Lib.PO.Customization.Client.OnLoad");
            await LoadItemsPriceCondition();
            await Start();
        }
        catch (e) {
            Log.Error("OnErrorDuringInitialization: " + e);
            OnErrorDuringInitialization();
        }
        finally {
            ProcessInstance.SetSilentChange(false);
        }
    }
    CustomScript.preloadAndStart = preloadAndStart;
    const promiseLayoutLoadAndStart = preloadAndStart();
    Sys.Helpers.Synchronizer.OnProgressFromPromise(promiseLayoutLoadAndStart, { progressDelay: 15000 });
})(CustomScript || (CustomScript = {}));
//# sourceMappingURL=customscript.js.map