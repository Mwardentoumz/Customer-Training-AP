class MandatoryInfo {
    constructor(invoiceNumber, invoiceIssueDate) {
        this.invoiceNumber = invoiceNumber;
        this.invoiceIssueDate = invoiceIssueDate;
        this.vendorId = {
            SIREN: "",
            SIRET: "",
            vendorNumber: ""
        };
        this.customerId = {
            SIREN: "",
            SIRET: "",
            companyCode: ""
        };
    }
}
function tryGetFirstVendorRecord(searchedField, value, companyCode) {
    let firstRecordResult = null;
    let filter = Sys.Helpers.LdapUtil.FilterEqual(searchedField, value).toString();
    filter = filter.AddCompanyCodeFilter(companyCode);
    const attributes = Lib.AP.GetExtendedVendorAttributes();
    Sys.GenericAPI.Query(Lib.P2P.TableNames.Vendors, filter, attributes, function (records, error) {
        if (!error && records && records.length === 1) {
            firstRecordResult = records[0];
        }
        else if (records.length > 1) {
            Log.Error("More than one Vendor Number have been retrieved");
        }
        else {
            Log.Error("No Vendor Number retrieved");
        }
    });
    return firstRecordResult;
}
function tryQueryVendorFromTable(mandatoryInfo, companyCode) {
    let result;
    if (mandatoryInfo.vendorId.SIREN) {
        const vendorVat = Lib.AP.GetVATFromSIREN(mandatoryInfo.vendorId.SIREN);
        Data.SetValue("VATNumber__", vendorVat);
        result = tryGetFirstVendorRecord("VATNumber__", vendorVat, companyCode);
    }
    if (!result && mandatoryInfo.vendorId.SIRET) {
        result = tryGetFirstVendorRecord("Siret__", mandatoryInfo.vendorId.SIRET, companyCode);
    }
    return result;
}
function getCompanyCode(mandatoryInfo) {
    var _a;
    let customerVat;
    Log.Verbose(JSON.stringify(mandatoryInfo));
    if (mandatoryInfo.customerId.SIREN) {
        customerVat = Lib.AP.GetVATFromSIREN(mandatoryInfo.customerId.SIREN);
    }
    let foundCompanyCode;
    if (customerVat || mandatoryInfo.customerId.SIRET) {
        foundCompanyCode = (_a = Lib.AP.CompanyCodeDetermination.DetermineWithTaxInformationNoFormReprocess({
            vatNumber: customerVat, siret: mandatoryInfo.customerId.SIRET
        })) === null || _a === void 0 ? void 0 : _a.companyCode;
    }
    if (!foundCompanyCode) {
        return false;
    }
    mandatoryInfo.customerId.companyCode = foundCompanyCode;
    return true;
}
function run() {
    const cdvRaw = Attach.GetAttach(0).GetInputFile();
    let cdvData = null;
    try {
        cdvData = Sys.EDI.FRB2B.XMLExtraction.CDV.Extract();
    }
    catch (e) {
        Log.Error("Failed to extract CDV data from attachment");
        return false;
    }
    if (cdvData.status.code !== Sys.EDI.FRB2B.CDV.Utils.EInvoicingNotificationCodes.Encaissee) {
        Log.Error("AP currently only handles Cashed 212 CDV");
        return false;
    }
    let parties = cdvData.recipients;
    if (cdvData.issuer) {
        parties.push(cdvData.issuer);
    }
    if (cdvData.sender) {
        parties.push(cdvData.sender);
    }
    if (!cdvData.document.objectID || !cdvData.document.objectReceiptTimestamp) {
        Log.Error("Miss mandatory infos in CDV (invoice number and/or Invoice receipt timestamps)");
        return false;
    }
    Data.SetValue("InvoiceNumber__", cdvData.document.objectID);
    Data.SetValue("InvoiceReceivedDate__", cdvData.document.objectReceiptTimestamp);
    let mandatoryInfo = new MandatoryInfo(cdvData.document.objectID, cdvData.document.objectReceiptTimestamp);
    const notificationParty = Sys.EDI.FRB2B.CDV.Utils.tryGetEDIFrenchB2BNotificationParty(parties, Sys.EDI.FRB2B.CDV.Utils.RoleCode.Seller, mandatoryInfo.vendorId);
    if (!notificationParty) {
        Log.Error("Needed/Mandatory information about Supplier/Seller not found");
        return false;
    }
    Data.SetValue("VendorSIREN__", mandatoryInfo.vendorId.SIREN);
    Data.SetValue("VendorSIRET__", mandatoryInfo.vendorId.SIRET);
    Sys.EDI.FRB2B.CDV.Utils.tryGetEDIFrenchB2BNotificationParty(parties, Sys.EDI.FRB2B.CDV.Utils.RoleCode.Buyer, mandatoryInfo.customerId);
    Data.SetValue("CustomerSIREN__", mandatoryInfo.customerId.SIREN);
    Data.SetValue("CustomerSIRET__", mandatoryInfo.customerId.SIRET);
    if (!getCompanyCode(mandatoryInfo)) {
        Log.Error("Cannot retrieve CompanyCode");
        return false;
    }
    Data.SetValue("CompanyCode__", mandatoryInfo.customerId.companyCode);
    let result;
    result = tryQueryVendorFromTable(mandatoryInfo, mandatoryInfo.customerId.companyCode);
    if (!result) {
        Log.Error("Cannot retrieve Vendor Number");
        return false;
    }
    mandatoryInfo.vendorId.vendorNumber = result === null || result === void 0 ? void 0 : result.Number__;
    Data.SetValue("VendorNumber__", mandatoryInfo.vendorId.vendorNumber);
    if (!mandatoryInfo.invoiceNumber || !mandatoryInfo.vendorId.vendorNumber || !mandatoryInfo.customerId.companyCode || !mandatoryInfo.invoiceIssueDate) {
        Log.Error("Miss needed informations for querying for RuidEx VIP");
        return false;
    }
    const sharedInfo = {
        companyCode: mandatoryInfo.customerId.companyCode,
        vendorNumber: mandatoryInfo.vendorId.vendorNumber,
        invoiceNumber: mandatoryInfo.invoiceNumber,
        PDPConfigurationName: Variable.GetValueAsString(Sys.EDI.FRB2B.Helpers.PDPConfigurationName) || ""
    };
    return Sys.FRB2B.AP.UpdateOrCreateVICDVFromNotification(sharedInfo, cdvRaw, true);
}
if (run()) {
    Data.SetValue("State", 100);
}
else {
    Data.SetValue("State", 200);
}
//# sourceMappingURL=extractionscript.js.map