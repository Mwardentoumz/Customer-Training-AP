function Approve() {
    // Allow approve if a document was added
    if (Attach.GetNbAttach() > 0) {
        ProcessInstance.Approve("approve");
    }
    else {
        Popup.Alert(["_Upload an invoice"], true, null, "_No invoice found");
    }
    return false;
}
function run() {
    Controls.Approve.OnClick = Approve;
}
run();
//# sourceMappingURL=customscript.js.map