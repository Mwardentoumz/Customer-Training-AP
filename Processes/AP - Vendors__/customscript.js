
Lib.P2P.Address.SetFormattedAddressControl(Controls.VendorAddress__);

Controls.Sub__.OnChange = Lib.P2P.Address.ComputeFormattedAddress;
Controls.Street__.OnChange = Lib.P2P.Address.ComputeFormattedAddress;
Controls.PostalCode__.OnChange = Lib.P2P.Address.ComputeFormattedAddress;
Controls.Country__.OnChange = Lib.P2P.Address.ComputeFormattedAddress;
Controls.Region__.OnChange = Lib.P2P.Address.ComputeFormattedAddress;
Controls.City__.OnChange = Lib.P2P.Address.ComputeFormattedAddress;
Controls.PostOfficeBox__.OnChange = Lib.P2P.Address.ComputeFormattedAddress;

Lib.P2P.Address.ComputeFormattedAddress();

function run()
{
	Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Tables.Client.Common.OnHTMLScriptEnd");
	Sys.Helpers.TryCallFunction("Lib.P2P.Customization.Tables.Client.Vendors.OnHTMLScriptEnd");
}

run();