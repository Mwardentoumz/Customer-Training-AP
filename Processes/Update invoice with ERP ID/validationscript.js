let ERPID = Data.GetValue("Document_ERP_ID__");
let ERPVendorNumber = Data.GetValue("ERP_Vendor_Number__");
let EskerID = Data.GetValue("EskerID__");
let ERPError = Data.GetValue("ERPPostingError__");
let ERPAckData = GetERPAckData();
let Holds = Variable.GetValueAsString("Holds__");
let VALIDITY_DURATION = 6;
let FormErrors = [];
const validationXpathVendorRegistrationID = "/ERPAck/EskerVendorRegistrationID";
const validationXpathDetailedAccrualReportLauncherID = "/ERPAck/DetailedAccrualReportLauncherID";
const validationXpathEskerPOID = "/ERPAck/EskerPOID";
const validationXpathEskerGRID = "/ERPAck/EskerGRID";
const ProcessType = {
    VendorRegistration: "Vendor Registration",
    VendorInvoice: "Vendor Invoice",
    DetailedAccrualReportLauncher: "Detailed Accrual Report Launcher",
    PurchaseOrder: "Purchase Order V2",
    GoodsReceipt: "Goods receipt V2"
};
function retryScript(errorMsg, longMsg) {
    Log.Error(`${errorMsg} : ${longMsg}`);
    if (Process.GetScriptRetryCount() < Process.GetScriptMaxRetryCount() - 1) {
        // Generate an exception for script to retry
        throw new Error(errorMsg + ". Retrying...");
    }
    else {
        Data.SetError("EskerID__", errorMsg);
    }
}
function GetERPAckData() {
    const ERPactionDataStr = Variable.GetValueAsString("ERPAckData");
    if (ERPactionDataStr) {
        return JSON.parse(ERPactionDataStr);
    }
    return {};
}
/*******************************
Update the Vendor registration or the Vendor Invoice
********************************/
function updateProcess(transport, process) {
    const vars = transport.GetUninheritedVars();
    const externalVariables = transport.GetExternalVars();
    const state = vars.GetValue_Long("State", 0);
    const waitingForUpdate = vars.GetValue_Long("WaitingForUpdate", 0);
    const contFlag = vars.GetValue_Long("ContainerFlag", 0);
    const invoiceState = vars.GetValue_String("InvoiceStatus__", 0);
    const LastSavedDateTime = vars.GetValue_Date("LastSavedDateTime", 0);
    const vendorRegistrationState = vars.GetValue_String("ProcessStatus__", 0);
    // Fix RD00031845 : ensure CompareDate returns -1 when ERPIntegrationTimeout has never been set
    const ERPIntegrationTimeoutDateTime = new Date(externalVariables.GetValue_String("ERPIntegrationTimeout", 0) || 0);
    const bProcessInERPIntegrationTimeout = Sys.Helpers.Date.CompareDate(ERPIntegrationTimeoutDateTime, LastSavedDateTime) !== -1;
    // FT-025989 - The vendor invoice process is frozen, add an automatic retry mechanism waiting for the invoice process to be resumed
    if (contFlag === 123456789) // invoice is frozen
     {
        updateProcessInFrozenState(state, process, transport, waitingForUpdate, bProcessInERPIntegrationTimeout);
    }
    else if ((state === 90 && waitingForUpdate) || (state === 70 && bProcessInERPIntegrationTimeout) ||
        (state === 100 && (invoiceState === Lib.AP.InvoiceStatus.ToPost || invoiceState === Lib.AP.InvoiceStatus.ToVerify || vendorRegistrationState === "ToValidate"))) {
        updateProcessInExpectedState(process, vars, externalVariables, transport, state);
    }
    else {
        // The process is not in the expected state: failure
        updateProcessInInvalidState(state, waitingForUpdate, bProcessInERPIntegrationTimeout, process);
    }
}
function updateProcessInExpectedState(process, vars, externalVariables, transport, state) {
    switch (process) {
        case ProcessType.VendorRegistration:
            if (ERPVendorNumber === null || ERPVendorNumber === void 0 ? void 0 : ERPVendorNumber.trim()) {
                Log.Info("Updating vendor registration with vendor number:" + ERPVendorNumber);
                vars.AddValue_String("VendorNumber__", ERPVendorNumber, true);
            }
            else {
                Log.Info("Cannot update vendor registration because the vendor number is empty");
            }
            break;
        case ProcessType.DetailedAccrualReportLauncher:
            Log.Info("Updating detailed accrual report with document ID:" + ERPID);
            vars.AddValue_String("ERPID__", ERPID, true);
            break;
        default:
            Log.Info("Updating invoice with document ID:" + ERPID);
            vars.AddValue_String("ERPInvoiceNumber__", ERPID, true);
            externalVariables.AddValue_String("ScheduledActionParameters", Holds, true);
            break;
    }
    vars.AddValue_String("ERPPostingError__", ERPError, true);
    vars.AddValue_String("ERPAckRuidEx__", Data.GetValue("RuidEx"), true);
    Sys.Helpers.TryCallFunction("Lib.AP.Customization.Validation.FinalizeERPAckUpdateInvoice", transport, process);
    // Update custom fields
    Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Server.ERPAckProcessing.UpdateProcessVars", process, vars, externalVariables);
    const scheduledAction = new Lib.CallScheduledAction.ScheduledAction();
    scheduledAction.msnEx = vars.GetValue_String("MsnEx", 0);
    scheduledAction.actionName = "continueAfterERPAck";
    const isSuccess = Lib.CallScheduledAction.executeAction(vars, scheduledAction, transport, true);
    if (isSuccess) {
        // Fix RD00031845 : ensure ERPIntegrationTimeout is reset so invoice will not be considered
        // as in ERPAck timeout if it has been re-posted without user interaction
        externalVariables.AddValue_String("ERPIntegrationTimeout", "", true);
    }
    else if (state === 100) {
        Log.Info("VIP state 100 - try to reopen it and call scheduled action again");
        Lib.CallScheduledAction.executeAction(vars, scheduledAction, transport, true);
    }
    else {
        retryScript("Failed resume processing on " + process, transport.GetLastErrorMessage());
    }
}
function updateProcessInFrozenState(state, process, transport, waitingForUpdate, bProcessInERPIntegrationTimeout) {
    if (state <= 90) {
        retryScript(`Waiting frozen process ${process} to be resumed`, transport.GetLastErrorMessage());
    }
    else {
        // The process is not in the expected state: failure
        updateProcessInInvalidState(state, waitingForUpdate, bProcessInERPIntegrationTimeout, process);
    }
}
/**
 * Manage records in state other than 90 or waiting state
 * Add a log error in the current process and set in error
 */
function updateProcessInInvalidState(state, waitingForUpdate, dateCompare, process) {
    let errorMsg = `Cannot update invoice with document ID ${ERPID} because it is not in the expected state (state=${state}`;
    errorMsg += `, waitingForUpdate=${waitingForUpdate}, date compare=${dateCompare})`;
    if (process === ProcessType.VendorRegistration) {
        errorMsg = `Cannot update vendor registration with vendor number ${ERPVendorNumber}`;
        errorMsg += ` because it is not in the expected state (state=${state}, waitingForUpdate=${waitingForUpdate})`;
    }
    Log.Error(errorMsg);
    if (!waitingForUpdate) {
        FormErrors.push(`The ${process} is not expecting an update from the ERP`);
    }
    if (state !== 90) {
        FormErrors.push(`The ${process} is not in the expected state: ${state} instead of '90'`);
    }
    if (!dateCompare) {
        FormErrors.push(`The ${process} is not in the expected state: The date comparison shows the process has been updated during the waiting period.`);
    }
    const errors = FormErrors.join("\n");
    Data.SetValue("ProcessingError__", errors);
    Data.SetValue("State", 200);
}
/*******************************
Find the process to update
********************************/
function findAndUpdateProcess(process) {
    const eddTransport = findRecordToUpdate(process);
    if (eddTransport) {
        updateProcess(eddTransport, process);
        if (Data.GetValue("State") !== 200) {
            // Activate a timeout on the process
            const newValidityDate = new Date();
            newValidityDate.setHours(newValidityDate.getHours() + VALIDITY_DURATION);
            Data.SetValue("ValidityDateTime", newValidityDate);
            // Wait for a response from the record
            Process.WaitForUpdate();
        }
    }
    else {
        Data.SetValue("ProcessingError__", `Cannot find any ${process} matching the Esker ID: ${EskerID}`);
        Data.SetValue("State", 200);
    }
}
/**
 * Generate the Query and return the eddTransport to update
 * @param process {string} Type of the process to update (VIP, VR)
 * @return {xTransport} The transport that match the RUID/MSNEX from the XML
 */
function findRecordToUpdate(process) {
    //MSN and ProcessID are mandatory to commit modification
    Query.Reset();
    Query.AddAttribute("MSN");
    Query.AddAttribute("ProcessID");
    Query.AddAttribute("ContainerFlag");
    switch (process) {
        case ProcessType.VendorRegistration:
            Query.AddAttribute("ERPVendorNumber__");
            break;
        case ProcessType.VendorInvoice:
            Query.AddAttribute("ERPInvoiceNumber__");
            break;
        case ProcessType.DetailedAccrualReportLauncher:
            Query.AddAttribute("ERPID__");
            break;
        default:
            break;
    }
    Query.AddAttribute("State");
    Query.AddAttribute("WaitingForUpdate");
    Query.AddAttribute("OwnerId");
    Query.AddAttribute("OwnerPb");
    Query.AddAttribute("MainAccountId");
    Query.AddAttribute("RuidEx");
    Query.AddAttribute("MsnEx");
    Query.AddAttribute("InvoiceStatus__");
    Query.AddAttribute("ProcessStatus__");
    Query.AddAttribute("LastSavedDateTime");
    Query.AddAttribute("ValidityDateTime");
    Query.SetSearchInArchive(true);
    Query.SetOptionEx("DoNotGetLocalDBFiles=1");
    let ruid = EskerID;
    if (ruid && !ruid.includes("#")) {
        // add missing process ID
        switch (process) {
            case ProcessType.VendorRegistration:
                ruid = `CD#${Process.GetProcessID("Vendor Registration")}.${EskerID}`;
                break;
            case ProcessType.VendorInvoice:
                ruid = `CD#${Process.GetProcessID("Vendor invoice")}.${EskerID}`;
                break;
            case ProcessType.DetailedAccrualReportLauncher:
                ruid = `CD#${Process.GetProcessID("DetailedAccrualReportLauncher")}.${EskerID}`;
                break;
            case ProcessType.PurchaseOrder:
                ruid = `CD#${Process.GetProcessID(ProcessType.PurchaseOrder)}.${EskerID}`;
                break;
            case ProcessType.GoodsReceipt:
                ruid = `CD#${Process.GetProcessID(ProcessType.GoodsReceipt)}.${EskerID}`;
                break;
            default:
                break;
        }
    }
    Query.SetFilter(`RUIDEX=${ruid}`);
    Query.MoveFirst();
    return Query.MoveNext();
}
function validationGetERPAckXML() {
    const xmlFile = Attach.GetInputFile(0);
    if (xmlFile) {
        try {
            return Process.CreateXMLDOMElement(xmlFile);
        }
        catch (error) {
            Log.Error("Cannot parse the XML file: ", error);
            return null;
        }
    }
    return null;
}
function handleErpAcknowledgmentProcessed() {
    Log.Info("Notification received from the target process. ErpAck completed successfully.");
    // In case the VIP says ok, restore the ValidityDateTime to 2 month
    const validityDateTime = Data.GetValue("ValidityDateTime");
    validityDateTime.setMonth(validityDateTime.getMonth() + 2);
    Data.SetValue("ValidityDateTime", validityDateTime);
}
function updatePurchaseOrderProcess() {
    Log.Info(`Update the Purchase order process with id ${EskerID}`);
    let ruid = EskerID;
    if (ruid && !ruid.includes("#")) {
        ruid = `CD#${Process.GetProcessID(ProcessType.PurchaseOrder)}.${EskerID}`;
    }
    try {
        const updatableDocument = Process.GetUpdatableTransportAsProcessAdmin(ruid);
        const vars = updatableDocument.GetUninheritedVars();
        const externalVariables = updatableDocument.GetExternalVars();
        const actionParts = [ERPError ? "OnERPAckError" : "OnERPAckReceived"];
        if (ERPAckData.action && ERPAckData.action !== "Create") {
            actionParts.push(ERPAckData.action);
        }
        else {
            externalVariables.AddValue_String("ERPACK_OrderNumber__", ERPID, true);
        }
        externalVariables.AddValue_String("ERPACK_TransactionID__", ERPAckData.transactionID, true);
        externalVariables.AddValue_String("ERPACK_Error__", ERPError, true);
        Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Server.ERPAckProcessing.UpdateProcessVars", ProcessType.PurchaseOrder, vars, externalVariables);
        const action = actionParts.join("-");
        updatableDocument.ResumeWithActionAsync(action);
    }
    catch (error) {
        Log.Error(`Cannot find any ${ProcessType.PurchaseOrder} matching the Esker ID: ${EskerID}`, error);
        Data.SetValue("ProcessingError__", `Cannot find any ${ProcessType.PurchaseOrder} matching the Esker ID: ${EskerID}`);
        Data.SetValue("State", 200);
    }
}
function updateGoodsReceiptProcess() {
    Log.Info("Update the Goods receipt process");
    let ruid = EskerID;
    if (ruid && !ruid.includes("#")) {
        ruid = `CD#${Process.GetProcessID(ProcessType.GoodsReceipt)}.${EskerID}`;
    }
    try {
        const updatableDocument = Process.GetUpdatableTransportAsProcessAdmin(ruid);
        const vars = updatableDocument.GetExternalVars();
        vars.AddValue_String("ERPACK_GRNumber__", ERPID, true);
        vars.AddValue_String("ERPACK_Error__", ERPError, true);
        const action = ERPError ? "OnERPAckError" : "OnERPAckReceived";
        updatableDocument.ResumeWithActionAsync(action);
    }
    catch (error) {
        Log.Error(`Cannot find any ${ProcessType.GoodsReceipt} matching the Esker ID: ${EskerID}`, error);
        Data.SetValue("ProcessingError__", `Cannot find any ${ProcessType.GoodsReceipt} matching the Esker ID: ${EskerID}`);
        Data.SetValue("State", 200);
    }
}
function main() {
    if (Data.GetValue("State") < 50) {
        // Validation script executed after extraction script, don't do anything
        // Validation script will be re-executed as the process don't expect a manual approval
        return;
    }
    const xmlDoc = validationGetERPAckXML();
    const isAccrualReport = xmlDoc === null || xmlDoc === void 0 ? void 0 : xmlDoc.selectSingleNode(validationXpathDetailedAccrualReportLauncherID);
    // Require at least an ERP error or an identifier (invoice ID, vendor ID) except for Accrual Report
    if ((!isAccrualReport && !(ERPID === null || ERPID === void 0 ? void 0 : ERPID.trim())) && !(ERPVendorNumber === null || ERPVendorNumber === void 0 ? void 0 : ERPVendorNumber.trim()) && !ERPError) {
        Data.SetValue("ProcessingError__", "Neither ERP Id nor ERP Error were provided");
        Data.SetValue("State", 200);
        return;
    }
    if (Data.GetActionName() === Lib.AP.ERPAcknowledgment.Actions.ErpAcknowledgmentProcessed) {
        handleErpAcknowledgmentProcessed();
    }
    else if (xmlDoc === null || xmlDoc === void 0 ? void 0 : xmlDoc.selectSingleNode(validationXpathVendorRegistrationID)) {
        Log.Info("Update the Vendor Registration process");
        findAndUpdateProcess(ProcessType.VendorRegistration);
    }
    else if (xmlDoc === null || xmlDoc === void 0 ? void 0 : xmlDoc.selectSingleNode(validationXpathDetailedAccrualReportLauncherID)) {
        Log.Info("Update the Detailed Accrual Report Launcher process");
        findAndUpdateProcess(ProcessType.DetailedAccrualReportLauncher);
    }
    else if (xmlDoc === null || xmlDoc === void 0 ? void 0 : xmlDoc.selectSingleNode(validationXpathEskerPOID)) {
        updatePurchaseOrderProcess();
    }
    else if (xmlDoc === null || xmlDoc === void 0 ? void 0 : xmlDoc.selectSingleNode(validationXpathEskerGRID)) {
        updateGoodsReceiptProcess();
    }
    else {
        // By default, update the VIP
        Log.Info("Update the Vendor Invoice process");
        findAndUpdateProcess(ProcessType.VendorInvoice);
    }
}
main();
//# sourceMappingURL=validationscript.js.map