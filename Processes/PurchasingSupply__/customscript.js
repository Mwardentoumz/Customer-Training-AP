var CustomScript;
(function (CustomScript) {
    const panes = ["AccessRestrictionPane", "AnalyticsPane", "DataPanel"];
    const buttons = ["Save", "Close"];
    const g_layout = new Lib.P2P.Layout.Manager(panes, buttons);
    var LdapUtil = Sys.Helpers.LdapUtil;
    var SupplyType = Lib.Purchasing.SupplyType;
    class SupplyTypeLinker extends Lib.LinkerManagerClient {
        constructor() {
            super("Purchasing Supply Updater");
        }
        async Process(action, companyCode, supplyId) {
            if (!supplyId) {
                throw `Supply Id is required`;
            }
            const msnex = await this.CreateLinker(action, {
                CompanyCode__: companyCode,
                SupplyID__: supplyId
            });
            return await this.WaitLinker(msnex);
        }
        async Update(companyCode, supplyTypeId) {
            return await this.Process(SupplyType.Action.UpdateChildrenTree, companyCode, supplyTypeId);
        }
    }
    CustomScript.SupplyTypeLinker = SupplyTypeLinker;
    class UsersBrowse {
        constructor() {
            this.userSeparator = ";";
        }
        async Configure() {
            await Lib.P2P.UsersBrowse.Init(Controls.AllowedUsersOrGroups__, "TechnicalAllowedUsersOrGroups__", Lib.P2P.UsersBrowse.StorageType.Control, "_UserPopup_Title", this.ComputeUsersSelectionOption(), "_UserPopup_UsersOrGroups", false);
        }
        GetUsersFilter() {
            const notLockedFilter = LdapUtil.FilterOr(LdapUtil.FilterEqual("ACCOUNTLOCKED", "0"), LdapUtil.FilterNotExist("ACCOUNTLOCKED"));
            const technicalFilter = LdapUtil.FilterOr(LdapUtil.FilterEqual("TECHNICALUSER", "0"), LdapUtil.FilterNotExist("TECHNICALUSER"));
            const filters = [
                notLockedFilter,
                technicalFilter,
                LdapUtil.FilterEqual("Customer", "0"),
                LdapUtil.FilterEqual("Vendor", "0"),
                Sys.Helpers.LdapUtil.FilterEqualOrEmpty("PortalUser", "0")
            ];
            return LdapUtil.FilterAnd(...filters).toString();
        }
        ComputeUsersSelectionOption() {
            return {
                SavedColumn: "Login",
                Tables: JSON.stringify([
                    {
                        TableName: "ODUSER",
                        CustomFilter: this.GetUsersFilter(),
                        SortOrder: "DisplayName ASC",
                        DisplayedColumns: "DisplayName|IsGroup"
                    }
                ]),
                SortAndGroup: JSON.stringify([
                    {
                        column: "IsGroup",
                        sort: "ASC",
                        groups: {
                            "1": {
                                label: Language.Translate("_UserPopup_Groups", false),
                                tagClassNames: "lightEmailTag",
                                groupIndex: 1
                            }
                        },
                        defaultGroup: {
                            label: Language.Translate("_UserPopup_Users", false),
                            tagClassNames: "lightEmailTag",
                            groupIndex: 0
                        }
                    },
                    {
                        column: "DisplayName",
                        sort: "ASC"
                    },
                    {
                        column: "EmailAddress",
                        sort: "ASC"
                    }
                ]),
                Multiple: true,
                DisplayFormat: "%%DisplayName%%",
                TitleDisplayFormat: "%%DisplayName%%",
                FreeEntryCheck: "^([a-zA-Z0-9-'_!#$%&*+/=?^`{|}~]+(\\.[a-zA-Z0-9-'_!#$%&*+/=?^`{|}~]+)*)@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.)|(([a-zA-Z0-9-]+\\.)+))([a-zA-Z]{2,}|[0-9]{1,3})(\\]?)$",
                CopyPasteCheck: "([a-zA-Z0-9-'_!#$%&*+/=?^`{|}~]+(\\.[a-zA-Z0-9-'_!#$%&*+/=?^`{|}~]+)*)@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.)|(([a-zA-Z0-9-]+\\.)+))([a-zA-Z]{2,}|[0-9]{1,3})(\\]?)",
                Separator: this.userSeparator,
                TokenSeparators: [",", ";"],
                RegexSeparators: /,|;/,
                Placeholder: Language.Translate("_SelectOrEnterEmailAddress"),
                keepInputOnDelete: false
            };
        }
    }
    async function OnCompanyCodeChange() {
        g_layout.ShowWaitScreen();
        const companyCode = Data.GetValue("CompanyCode__");
        const filter = Sys.Helpers.IsEmpty(companyCode)
            ? Sys.Helpers.LdapUtil.FilterEqualOrEmpty("CompanyCode__", "")
            : Sys.Helpers.LdapUtil.FilterEqual("CompanyCode__", companyCode);
        Controls.ParentSupplyID__.SetFilter(filter.toString());
        Controls.DefaultGLAccount__.SetFilter(filter.toString());
        await Process.CheckAllControls();
        await SupplyType.manager.Query(companyCode);
        await OnParentOrIDChange();
        g_layout.HideWaitScreen();
    }
    async function OnDependencyChange() {
        const fieldDependencies = ["CompanyCode__", "SupplyID__", "ParentSupplyID__", "Name__"];
        const updateDependencies = fieldDependencies.every(fieldName => !Data.GetError(fieldName));
        if (updateDependencies) {
            ProcessInstance.SetSilentChange(true);
            const companyCode = Data.GetValue("CompanyCode__");
            const id = Data.GetValue("SupplyID__");
            const parentId = Data.GetValue("ParentSupplyID__");
            const name = Data.GetValue("Name__");
            const allowedLogins = Data.GetValue("TechnicalAllowedUsersOrGroups__");
            const updatedSupply = SupplyType.manager.UpdateSupplyTypeInCache(ruidex, {
                CompanyCode__: companyCode,
                SupplyID__: id,
                ParentSupplyID__: parentId,
                Name__: name,
                DisableRestrictionInheritance__: Data.GetValue("DisableRestrictionInheritance__"),
                TechnicalAllowedUsersOrGroups__: allowedLogins ? allowedLogins.split(";") : null,
            });
            await UpdateFormValues(updatedSupply);
        }
        ProcessInstance.SetSilentChange(false);
    }
    async function OnParentOrIDChange() {
        await Controls.ParentSupplyID__.WaitForCheck();
        const companyCode = Data.GetValue("CompanyCode__");
        const id = Data.GetValue("SupplyID__");
        const parentId = Data.GetValue("ParentSupplyID__");
        let error = "";
        if (!Sys.Helpers.IsEmpty(id) && id === parentId) {
            error = Language.Translate("_SupplyTypeError_IdenticalIdAndParent", false);
        }
        else if (SupplyType.manager.GetRecursionID(companyCode, id, parentId)) {
            const parent = SupplyType.manager.GetFromCache(companyCode, parentId);
            error = Language.Translate("_SupplyTypeError_Recursion", false, parent.name);
        }
        if (error) {
            Data.SetCategorizedError("ParentSupplyID__", Lib.P2P.ErrorCategory.SupplyType, error);
        }
        else {
            Lib.P2P.ResetCategorizedError("ParentSupplyID__", Lib.P2P.ErrorCategory.SupplyType);
        }
        OnDependencyChange();
    }
    async function UpdateFormValues(supply) {
        Data.SetValue("FullName__", supply.GetPath());
        const parent = SupplyType.manager.GetParent(supply.companyCode, supply.id);
        const inhUsersLogins = parent ? parent.computedAllowedLogins : [];
        const inhUsersInfo = inhUsersLogins.length ? await Lib.P2P.UsersBrowse.GetCompleteUsersOrGroups(inhUsersLogins) : [];
        Controls.InheritedTechnicalAllowedLogins__.SetValue(inhUsersLogins.join(";"));
        Controls.InheritedAllowedLogins__.SetValue(inhUsersInfo.map(userOrGroup => userOrGroup.name).join("\n"));
        Data.SetValue("ComputedTechnicalAllowedLogins__", supply.computedAllowedLogins.join(";"));
        UpdateLayout();
    }
    function UpdateLayout() {
        const hideParentDependencies = !Data.GetValue("ParentSupplyID__") || !Controls.InheritedTechnicalAllowedLogins__.GetValue();
        Controls.InheritedAllowedLogins__.Hide(hideParentDependencies);
        Controls.DisableRestrictionInheritance__.Hide(hideParentDependencies);
        if (Controls.DisableRestrictionInheritance__.IsChecked()) {
            Controls.InheritedAllowedLogins__.AddStyle("highlight-grayed");
        }
        else {
            Controls.InheritedAllowedLogins__.RemoveStyle("highlight-grayed");
        }
    }
    async function OnSubmitForm() {
        await Process.CheckAllControls();
        if (!Process.ShowFirstError()) {
            const children = SupplyType.manager.GetChildrenTree(Data.GetValue("CompanyCode__"), Data.GetValue("SupplyID__"));
            const childrenUpdate = children && children.some(child => SupplyType.manager.UpdateParentDependencies(child));
            if (childrenUpdate) {
                Lib.CommonDialog.PopupYesCancel(function (action) {
                    switch (action) {
                        case "Yes":
                            const linkerManager = new SupplyTypeLinker();
                            linkerManager.Update(Data.GetValue("CompanyCode__"), Data.GetValue("SupplyID__"));
                            ProcessInstance.SaveAndQuit("Save");
                            break;
                        default:
                            break;
                    }
                }, "_LongProcessingWarningTitle", "_LongProcessingWarning", "_UpdateChildren");
            }
            else {
                ProcessInstance.SaveAndQuit("Save");
            }
        }
    }
    function InitControls() {
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.CompanyCode__, OnCompanyCodeChange, OnCompanyCodeChange, OnCompanyCodeChange);
        Sys.Helpers.Controls.OnDatabaseComboboxEvents(Controls.ParentSupplyID__, OnParentOrIDChange, OnParentOrIDChange, OnParentOrIDChange);
        Controls.SupplyID__.OnChange = OnParentOrIDChange;
        Controls.Name__.OnChange = OnDependencyChange;
        Controls.SupplyID__.SetRequired(true);
        Controls.Name__.SetRequired(true);
        Controls.FullName__.SetReadOnly(true);
        Controls.AccessRestrictionPane.Hide(false);
        Controls.DisableRestrictionInheritance__.OnChange = OnDependencyChange;
        Controls.AllowedUsersOrGroups__.OnSetValue = OnDependencyChange;
        Controls.AllowedUsersOrGroups__.SetReadOnly(true);
        Controls.AllowedUsersOrGroups__.SetBrowsable(!ProcessInstance.isReadOnly);
        Controls.TechnicalAllowedUsersOrGroups__.OnSetValue = OnDependencyChange;
        Controls.Save.OnClick = function () {
            OnSubmitForm();
            return false;
        };
    }
    const usersBrowse = new UsersBrowse();
    const ruidex = Data.GetValue("RuidEx");
    async function Init() {
        Sys.Helpers.EnableSmartSilentChange();
        g_layout.Hide(true);
        g_layout.ShowWaitScreen();
        await Sys.Parameters.GetInstance("P2P").PromisedIsReady();
        await usersBrowse.Configure();
        // Display errors if any + Set Parent filter
        await OnCompanyCodeChange();
        g_layout.Hide(false);
        g_layout.HideWaitScreen();
        InitControls();
    }
    CustomScript.Init = Init;
    async function Main() {
        return Sys.Helpers.TryCallFunctionAsync("Lib.P2P.Customization.Tables.Client.PurchasingSupply.OnHTMLScriptBegin")
            .Then(() => {
            return CustomScript.Init();
        }).Then(() => {
            Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Tables.Client.Common.OnHTMLScriptEnd");
            Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Tables.Client.PurchasingSupply.OnHTMLScriptEnd");
        });
    }
    CustomScript.Main = Main;
    Main();
})(CustomScript || (CustomScript = {}));
//# sourceMappingURL=customscript.js.map