/**
 * Check whether this Export Invoices instance was triggered by the EReporting Batch Export
 * scheduler. The batch process sets a dedicated "SendToPA" external variable to "true".
 */
function isSendToPAEnabled() {
    return Variable.GetValueAsString("SendToPA") === "true";
}
let maxInvoicesPerRecall = 5000;
const maxInvoicesPerFlush = 10;
// Module-level File object for Flux 10.1 exports — safe because handleBars mode
// processes all invoices in a single pass with no RecallScript cycles.
let flux10ExportFile = null;
const ruidExesToUpdateStr = Variable.GetValueAsString("RuidExesToUpdate") || "[]";
const ruidExesToUpdate = JSON.parse(ruidExesToUpdateStr);
Process.SetTimeOut(2 * 60 * 60);
const date = new Date();
const ERROR = -1;
const NOT_FINISHED = 0;
const ALL_INVOICE_PROCESSED = 1;
/**
* Determine the current export mode (all invoices, custom selection, differential export)
* @return {string} A string containing the export mode
**/
function getExportMode() {
    if (Variable.GetValueAsString("AncestorsRuid")) {
        return "CustomSelectionFromAdminList";
    }
    return "NoRestrictions";
}
/**
* Return the filter when a selection of invoices to export was done
* @return {string} a string containing an LDAP filter based on selection
**/
function getQueryFilterForCustomSelectionFromAdminList() {
    let filter = "";
    const ancestorsRuid = Variable.GetValueAsString("AncestorsRuid");
    if (ancestorsRuid) {
        const list = ancestorsRuid.split("|");
        if (list.length === 1) {
            filter = "RUIDEX=" + ancestorsRuid;
        }
        else {
            filter = `|(RUIDEX=${list.join(")(RUIDEX=")})`;
        }
    }
    return filter;
}
/**
* Build the filter of the query based on the invoice export mode and options
**/
function getQueryFilter() {
    const filterElements = [];
    if (getExportMode() === "CustomSelectionFromAdminList") {
        filterElements.push(getQueryFilterForCustomSelectionFromAdminList());
    }
    else {
        filterElements.push(Sys.Helpers.LdapUtil.FilterEqual("ERPPostingDate__", "*"));
        const dateOfStartExport = Data.GetValue("DateOfStartExport__");
        if (dateOfStartExport) {
            filterElements.push(Sys.Helpers.LdapUtil.FilterStrictlyLesser("ERPPostingDate__", Sys.Helpers.Date.Date2DBDateTime(dateOfStartExport)));
        }
        if (Data.GetValue("SchedulingOptions__") === "Execute now" && Data.GetValue("Then_repeat__") === "Never") {
            const exportEndDate = Data.GetValue("ExportEndDate__");
            if (exportEndDate && exportEndDate < dateOfStartExport) {
                const index = filterElements.indexOf(Sys.Helpers.LdapUtil.FilterStrictlyLesser("ERPPostingDate__", Sys.Helpers.Date.Date2DBDateTime(dateOfStartExport)));
                filterElements.splice(index, 1, Sys.Helpers.LdapUtil.FilterStrictlyLesser("ERPPostingDate__", Sys.Helpers.Date.Date2DBDateTime(exportEndDate)));
            }
            const exportStartDate = Data.GetValue("ExportStartDate__");
            if (exportStartDate) {
                filterElements.push(Sys.Helpers.LdapUtil.FilterStrictlyGreater("ERPPostingDate__", Sys.Helpers.Date.Date2DBDateTime(exportStartDate)));
            }
        }
        const companyCode = Data.GetValue("CompanyCode__");
        if (companyCode) {
            filterElements.push(Sys.Helpers.LdapUtil.FilterEqual("CompanyCode__", companyCode));
        }
        if (Data.GetValue("Converter__") === "Flux_10_1") {
            filterElements.push(Sys.Helpers.LdapUtil.FilterEqual("IsFlux10_1Compliant__", "1"));
        }
        if (Data.GetValue("SkipInvoicesAlreadyExported__")) {
            filterElements.push(Sys.Helpers.LdapUtil.FilterNotEqual("LastExportDate__", "*"));
            filterElements.push(Sys.Helpers.LdapUtil.FilterNotEqual("LastPaymentApprovalExportDate__", "*"));
        }
        else {
            filterElements.push(Sys.Helpers.LdapUtil.FilterIn("InvoiceStatus__", ["Paid", "To pay", "Being paid"]));
        }
    }
    const lastMsnEx = Data.GetValue("LastMsnEx__");
    if (lastMsnEx) {
        filterElements.push(Sys.Helpers.LdapUtil.FilterStrictlyGreater("msnex", lastMsnEx));
    }
    if (filterElements.length === 0) {
        return "";
    }
    else if (filterElements.length === 1) {
        return filterElements[0].toString();
    }
    return Sys.Helpers.LdapUtil.FilterAnd(...filterElements).toString();
}
function PaymentAuthorization(formdata) {
    const status = formdata.GetValue("InvoiceStatus__");
    if (status && (status === "Being paid" || status === "To pay" || status === "Paid") && Data.GetValue("Converter__") !== "Flux_10_1") {
        return true;
    }
    return false;
}
/**
* Update transport given: set LastExportDateed
* @param {transport} the transport to update
* @param {date} date to set
**/
let updateInvoiceAndPaymentAuthorization = {
    UpdateInvoice: false,
    UpdatePaymentAuthorization: false,
    init: function (transport) {
        this.UpdateInvoice = false;
        this.UpdatePaymentAuthorization = false;
        if (!transport.GetUninheritedVars().GetValue_Date("LastExportDate__", 0) || !Data.GetValue("SkipInvoicesAlreadyExported__")) {
            this.UpdateInvoice = true;
        }
        if (PaymentAuthorization(transport.GetFormData()) && (!transport.GetUninheritedVars().GetValue_Date("LastPaymentApprovalExportDate__", 0) || !Data.GetValue("SkipInvoicesAlreadyExported__"))) {
            this.UpdatePaymentAuthorization = true;
        }
        return true;
    }
};
function appendInTempFile(converterName, fieldName, content) {
    let result = true;
    if (converterName === "Flux_10_1" && fieldName === "InvoicesToExportTempFile__") {
        // Flux 10.1 uses a File object so the same reference can be passed directly
        // to sendEReportingFile() on the PDP connector.
        if (!flux10ExportFile) {
            Lib.FormDataConverter.SetActiveConverter(converterName);
            flux10ExportFile = TemporaryFile.CreateFile(Lib.FormDataConverter.GetExtension(), Lib.FormDataConverter.GetEncoding());
            Data.SetValue(fieldName, "flux10"); // sentinel so endOfExport cleanup still fires
            result = TemporaryFile.Append(flux10ExportFile, Lib.FormDataConverter.GetHeader(), Lib.FormDataConverter.GetEOLFormat());
        }
        result = result && TemporaryFile.Append(flux10ExportFile, content, Lib.FormDataConverter.GetEOLFormat());
    }
    else {
        let tempFileName = Data.GetValue(fieldName);
        if (!tempFileName) {
            Lib.FormDataConverter.SetActiveConverter(converterName);
            tempFileName = TemporaryFile.Create(Lib.FormDataConverter.GetExtension(), Lib.FormDataConverter.GetEncoding());
            Data.SetValue(fieldName, tempFileName);
            // Add header
            result = TemporaryFile.Append(tempFileName, Lib.FormDataConverter.GetHeader(), Lib.FormDataConverter.GetEOLFormat());
        }
        result = result && TemporaryFile.Append(tempFileName, content, Lib.FormDataConverter.GetEOLFormat());
    }
    if (!result) {
        Log.Error("Failed to append data in file (filesize limit is 100MB) - adjust parameters");
    }
    return result;
}
function convertFormData(transport, formData, counter, buffer, pushToBuffer = true) {
    if (updateInvoiceAndPaymentAuthorization.init(transport)) {
        const fieldsToUpdate = [];
        if (updateInvoiceAndPaymentAuthorization.UpdateInvoice && Lib.FormDataConverter.SetActiveConverter(Data.GetValue("Converter__"))) {
            if (pushToBuffer) {
                buffer.exported.push(Lib.FormDataConverter.Convert(formData));
            }
            fieldsToUpdate.push("LastExportDate__");
            counter.exported++;
        }
        if (updateInvoiceAndPaymentAuthorization.UpdatePaymentAuthorization && Lib.FormDataConverter.SetActiveConverter("CSV_PaymentApproval")) {
            if (pushToBuffer) {
                buffer.exportedApproved.push(Lib.FormDataConverter.Convert(formData));
            }
            fieldsToUpdate.push("LastPaymentApprovalExportDate__");
            counter.exportedApproved++;
        }
        if (fieldsToUpdate.length > 0) {
            ruidExesToUpdate.push({ ruidEx: transport.ruid, date: date, fieldsToUpdate: fieldsToUpdate });
        }
        return true;
    }
    return false;
}
function convertTransport(transport, counter, buffer, pushToBuffer = true) {
    let success = true;
    const ownerShipToken = "INVEXP_" + Process.GetProcessID();
    transport.ruid = transport.GetUninheritedVars().GetValue_String("ruidex", 0);
    const formData = transport.GetFormData();
    // if ApproversList is null then another export is in progress
    if (formData && formData.GetTable("ApproversList__")) {
        if (Sys.Helpers.GetOwnershipIfNeeded(transport, ownerShipToken)) {
            if (!convertFormData(transport, formData, counter, buffer, pushToBuffer)) {
                counter.skipped++;
            }
            transport.ReleaseAsyncOwnership(ownerShipToken);
        }
        else {
            Log.Warn(`Invoice ${transport.ruid}: Unable to update form because it is currently used by another user.`);
            counter.skipped++;
        }
    }
    else {
        Log.Warn(`Invoice ${transport.ruid}: Unable to get form data. Check that the attribute DataFile has been added in Query.SetAttributesList.`);
        counter.skipped++;
    }
    // Flush if needed
    if (buffer.exported.length === maxInvoicesPerFlush) {
        success = success && appendInTempFile(Data.GetValue("Converter__"), "InvoicesToExportTempFile__", buffer.exported.join(""));
        buffer.exported = [];
    }
    if (buffer.exportedApproved.length === maxInvoicesPerFlush) {
        success = success && appendInTempFile("CSV_PaymentApproval", "InvoicesApprovedTempFile__", buffer.exportedApproved.join(""));
        buffer.exportedApproved = [];
    }
    return success;
}
// Main function
function queryAndConvert(nbInvoiceMax) {
    Process.StateOnLastScriptFailure(200);
    let lastMsnEx = "";
    let success = true;
    const counter = {
        skipped: 0,
        exported: 0,
        exportedApproved: 0
    };
    const buffer = {
        exported: [],
        exportedApproved: []
    };
    let transport = null;
    Query.Reset();
    Query.SetSpecificTable("CDNAME#Vendor invoice");
    const attributes = [
        "DataFile", "ValidationURL", "ProcessID", "RuidEx", "msnex", "State",
        "LastExportDate__", "LastPaymentApprovalExportDate__", "InvoiceStatus__", "ERPPostingDate__",
        "CompanyCode__", "InvoiceNumber__", "InvoiceDate__", "EDIInvoiceType__", "InvoiceCurrency__",
        "VendorNumber__", "VendorCountry__",
        "InvoicePeriodStartDate__", "InvoicePeriodEndDate__",
        "NetAmount__", "TaxAmount__", "LineItems__", "PaymentTerm__", "Comment__", "RelatedInvoice__", "RelatedInvoiceRuidEx__"
    ];
    if (Data.GetValue("Converter__") === "Flux_10_1") {
        const flux10_attributes = [
            "Flux10_1_TaxDueDateTypeCode__", "Flux10_1_InvoiceNoteSubject__", "Flux10_1_InvoiceNoteContent__",
            "EDIBusinessProcessType__", "Flux10_1_InvoiceDeliveryDate__", "Flux10_1_BuyerCompanyId__", "Flux10_1_BuyerCompanyIdSchemeId__",
            "Flux10_1_SellerIdSchemeId__", "Flux10_1_SellerId__", "Flux10_1_SellerTaxRepresentativeId__", "Flux10_1_SellerTaxRepresentativeIdSchemeId__",
            "Flux10_1_DeliveryCityName__", "Flux10_1_DeliveryCountryID__", "Flux10_1_DeliveryCountrySubEntity__",
            "Flux10_1_DeliveryLocLine1__", "Flux10_1_DeliveryLocLine2__", "Flux10_1_DeliveryLocLine3__", "Flux10_1_PostalZone__",
            "Flux10_1_SellerCompanyId", "Flux10_1_SellerCompanyIdSchemeId", "Flux10_1_SellerId", "Flux10_1_SellerIdSchemeId"
        ];
        Query.SetAttributesList([...attributes, ...flux10_attributes].join(","));
    }
    else {
        Query.SetAttributesList(attributes.join(","));
    }
    Query.SetSortOrder("msnex ASC");
    Query.SetOptionEx(`limit=${maxInvoicesPerRecall + 1}`);
    Query.SetSearchInArchive(true);
    const filter = getQueryFilter();
    Query.SetFilter(filter);
    try {
        // Parse invoices and build attachement
        if (Query.MoveFirst()) {
            transport = Query.MoveNext();
            const recordsData = [];
            let minPostDate = new Date();
            if (transport) {
                const formData = transport.GetFormData();
                minPostDate = formData.GetValue("ERPPostingDate__");
            }
            while (transport && nbInvoiceMax > 0) {
                if (Lib.FormDataConverter.IsUsingHandleBars()) {
                    const VIPdata = Sys.EDI.FRB2B.Flow10.PDPInvoice.GetVIPDataFromRecord(transport);
                    recordsData.push(VIPdata);
                    const formData = transport.GetFormData();
                    const currentRecordPostDate = formData.GetValue("ERPPostingDate__");
                    minPostDate = currentRecordPostDate < minPostDate ? currentRecordPostDate : minPostDate;
                }
                success = success && convertTransport(transport, counter, buffer, !Lib.FormDataConverter.IsUsingHandleBars());
                nbInvoiceMax--;
                lastMsnEx = transport.GetUninheritedVars().GetValue_String("msnex", 0);
                transport = Query.MoveNext();
            }
            if (Lib.FormDataConverter.IsUsingHandleBars()) {
                if (!Data.GetValue("ExportStartDate__")) {
                    Data.SetValue("ExportStartDate__", minPostDate);
                }
                if (!Data.GetValue("ExportEndDate__")) {
                    Data.SetValue("ExportEndDate__", new Date());
                }
                buffer.exported.push(Lib.FormDataConverter.Convert(recordsData));
                counter.exported = recordsData.length;
            }
        }
        else {
            Log.Error("Cannot read query result");
            success = false;
        }
        // Flush the rest
        if (buffer.exported.length > 0) {
            success = success && appendInTempFile(Data.GetValue("Converter__"), "InvoicesToExportTempFile__", buffer.exported.join(""));
        }
        if (buffer.exportedApproved.length > 0) {
            success = success && appendInTempFile("CSV_PaymentApproval", "InvoicesApprovedTempFile__", buffer.exportedApproved.join(""));
        }
        if (success) {
            Data.SetValue("NumberOfInvoicesInError__", Data.GetValue("NumberOfInvoicesInError__") + counter.skipped);
            Data.SetValue("NumberOfExportedInvoices__", Data.GetValue("NumberOfExportedInvoices__") + counter.exported);
            Data.SetValue("NumberOfExportedApprovedInvoices__", Data.GetValue("NumberOfExportedApprovedInvoices__") + counter.exportedApproved);
            Data.SetValue("LastMsnEx__", lastMsnEx);
        }
    }
    catch (e) {
        Log.Error("An exception occured : " + e);
        success = false;
    }
    if (!success) {
        return ERROR;
    }
    if (!transport) {
        return ALL_INVOICE_PROCESSED;
    }
    return NOT_FINISHED;
}
function initialize() {
    if (Data.GetActionName() !== "export_in_progress") {
        Data.SetValue("NumberOfExportedInvoices__", 0);
        Data.SetValue("NumberOfExportedApprovedInvoices__", 0);
        Data.SetValue("NumberOfInvoicesInError__", 0);
        Data.SetValue("DateOfStartExport__", date);
        // Clear any previous PA configuration retry tracking from prior scheduled exports
        // This ensures each new scheduled export starts fresh and doesn't attempt to retry
        // old files that are no longer available (flux10ExportFile is recreated each run)
        if (Transaction.Read("PDP Submission Failures") !== null) {
            Log.Warn("Clearing previous PA configuration retry tracking from prior export - those submissions are considered failed");
            Transaction.Delete("PDP Submission Failures");
        }
        // When triggered by the scheduler with SendToPA, set default values for automated e-reporting
        if (isSendToPAEnabled()) {
            // Force Flux 10.1 converter for e-reporting
            if (!Data.GetValue("Converter__")) {
                Data.SetValue("Converter__", "Flux_10_1");
            }
            // Skip already exported invoices by default for automated runs
            if (Data.GetValue("SkipInvoicesAlreadyExported__") === undefined || Data.GetValue("SkipInvoicesAlreadyExported__") === null) {
                Data.SetValue("SkipInvoicesAlreadyExported__", true);
            }
        }
    }
}
function endOfExport(status) {
    Data.SetValue("ExportStatus__", status);
    Data.SetValue("CompletedDateTime__", new Date());
    Process.AllowScriptRetries(false);
    /** Clean technical fields */
    Data.SetValue("InvoicesToExportTempFile__", "");
    Data.SetValue("InvoicesApprovedTempFile__", "");
    Data.SetValue("DateOfStartExport__", "");
    Data.SetValue("LastMsnEx__", "");
}
function AddFooter(converter, fileName) {
    Lib.FormDataConverter.SetActiveConverter(converter);
    const appendResult = flux10ExportFile && converter === "Flux_10_1"
        ? TemporaryFile.Append(flux10ExportFile, Lib.FormDataConverter.GetFooter(), Lib.FormDataConverter.GetEOLFormat())
        : TemporaryFile.Append(fileName, Lib.FormDataConverter.GetFooter(), Lib.FormDataConverter.GetEOLFormat());
    if (!appendResult) {
        Log.Error("Failed to append footer in file (filesize limit is 100MB) - adjust parameters");
    }
}
/**
* Get temporaries files and save them as attachments
*/
function attachFiles() {
    const dateISO = date.toISOString().substr(0, 10);
    if (Data.GetValue("NumberOfExportedInvoices__") > 0) {
        const attachName = `${Language.Translate("Posted invoices", false)} ${dateISO}`;
        if (flux10ExportFile) {
            // Use File-object overload so Attach.GetAttach can retrieve it if needed
            AddFooter(Data.GetValue("Converter__"), "");
            Attach.AttachTemporaryFile(flux10ExportFile, {
                name: attachName,
                attachAsConverted: false,
                attachAsFirst: false
            });
        }
        else {
            const tempFileName = Data.GetValue("InvoicesToExportTempFile__");
            AddFooter(Data.GetValue("Converter__"), tempFileName);
            Attach.AttachTemporaryFile(tempFileName, attachName);
        }
    }
    if (Data.GetValue("NumberOfExportedApprovedInvoices__") > 0) {
        const invoicesApprovedTempFileName = Data.GetValue("InvoicesApprovedTempFile__");
        AddFooter("CSV_PaymentApproval", invoicesApprovedTempFileName);
        const attachNameApprovedInvoices = `${Language.Translate("Approved invoices", false)} ${dateISO}`;
        Attach.AttachTemporaryFile(invoicesApprovedTempFileName, attachNameApprovedInvoices);
    }
}
/**
 * Create one Sys_AP B2B E-Reporting child process for the PA configuration associated with the company code.
 * Called after a successful export when the scheduler requested e-reporting submission (SendToPA=true).
 */
async function createB2BEReportingProcesses(flux10AttachIndex) {
    Log.Info("Checking conditions to submit e-reporting file to PDP");
    if (!isSendToPAEnabled()) {
        Log.Info("SendToPA not enabled, skipping PDP submission");
        return;
    }
    if (Data.GetValue("Converter__") !== "Flux_10_1") {
        return;
    }
    if (Data.GetValue("NumberOfExportedInvoices__") === 0) {
        Log.Info("No e-reporting invoices exported, skipping B2B E-Reporting submission");
        return;
    }
    if (flux10AttachIndex < 0) {
        Log.Error("No e-reporting XML attachment available for B2B E-Reporting submission");
        return;
    }
    const companyCode = Data.GetValue("CompanyCode__");
    if (!companyCode) {
        Log.Error("No company code set, cannot determine PA configuration for E-Reporting submission");
        return;
    }
    const pdpConfiguration = await Sys.FRB2B.AP.Helpers.GetPDPConfigurationForCompanyCode(companyCode);
    if (!pdpConfiguration) {
        Log.Error(`No PA configuration found for company code ${companyCode}, cannot submit E-Reporting`);
        return;
    }
    const directInputFile = Attach.GetInputFile(flux10AttachIndex);
    if (directInputFile) {
        Log.Info(`Creating B2B E-Reporting process for PA configuration: ${pdpConfiguration.Name}`);
        const eReportingProcess = Process.CreateProcessInstance("Sys_AP B2B E-Reporting", false, false, false);
        eReportingProcess.AddAttachEx(directInputFile);
        eReportingProcess.GetExternalVars().AddValue_String("Configuration", pdpConfiguration.Name, true);
        eReportingProcess.Process();
        return;
    }
    const flux10Attach = Attach.GetAttach(flux10AttachIndex);
    if (!flux10Attach) {
        Log.Error("Could not retrieve e-reporting XML attachment at index " + flux10AttachIndex + ". Fallback approach failed.");
        return;
    }
    Log.Info(`Creating B2B E-Reporting process for PA configuration: ${pdpConfiguration.Name}`);
    const eReportingProcess = Process.CreateProcessInstance("Sys_AP B2B E-Reporting", false, false, false);
    eReportingProcess.AddAttachEx(flux10Attach.GetInputFile() || flux10Attach);
    eReportingProcess.GetExternalVars().AddValue_String("Configuration", pdpConfiguration.Name, true);
    eReportingProcess.Process();
}
/**
 * Update all invoices exported
 */
function updateExportDates() {
    ruidExesToUpdate.forEach(ruidEx => {
        const toUpdate = { fields: {} };
        ruidEx.fieldsToUpdate.forEach(field => {
            toUpdate.fields[field] = ruidEx.date;
        });
        Process.UpdateProcessInstanceDataAsync(ruidEx.ruidEx, JSON.stringify(toUpdate));
    });
}
async function processExportResult(res) {
    if (res === NOT_FINISHED) {
        Variable.SetValueAsString("RuidExesToUpdate", JSON.stringify(ruidExesToUpdate));
        Process.RecallScript("export_in_progress");
    }
    else if (res === ALL_INVOICE_PROCESSED) {
        // Capture the index before attachFiles() consumes the flux10ExportFile File object.
        // After AttachTemporaryFile runs, the File's internal path is cleared so we must
        // use Attach.GetAttach(index) to retrieve a valid xAttach reference.
        const flux10AttachIndex = flux10ExportFile ? Attach.GetNbAttach() : -1;
        attachFiles();
        updateExportDates();
        endOfExport("Completed");
        try {
            await createB2BEReportingProcesses(flux10AttachIndex);
        }
        catch (err) {
            Log.Error("Error creating B2B E-Reporting processes: " + err.message);
        }
    }
    else {
        Log.Error("Error during the export");
        endOfExport("Error");
    }
}
async function run() {
    if (Data.GetValue("ExportStatus__") !== "Cancelled") {
        initialize();
        if (Process.GetScriptRetryCount() === 0 && Data.GetValue("RecordAbortedCount") === 0) {
            Lib.FormDataConverter.SetActiveConverter(Data.GetValue("Converter__"));
            const res = queryAndConvert(maxInvoicesPerRecall);
            await processExportResult(res);
        }
        else if (Process.GetScriptRetryCount() > 0) {
            Log.Error(`Script retry :${Process.GetScriptRetryCount()}. Set process in error`);
            endOfExport("Error");
        }
        else {
            Log.Error("This process was aborted during execution. Export may not be correct.");
            endOfExport("Error");
            Data.SetValue("State", 200);
        }
    }
}
Lib.P2P.HandleScriptError(run());
//# sourceMappingURL=finalizationscript.js.map