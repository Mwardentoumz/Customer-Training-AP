function ShouldPreferredReplyBeVisible()
{
	if (Controls.DocumentType__.GetSelectedOption())
	{
		return true;
	}
	return false;
}

function HideControls()
{
	// The control has always a null value which is equal to '='
	Controls.DocumentType__.Hide(Controls.DocumentType__.GetAvailableValues().length <= 1);
	Controls.PreferredReply__.Hide(!ShouldPreferredReplyBeVisible());
}

var FillFamilyControl = function ()
{
	function CallBackWithFamiliesResults(families)
	{
		Controls.Family__.SetAvailableValues(families);
	}

	Lib.DD_Client.RetrieveFamiliesAsOptions(CallBackWithFamiliesResults);
};

function Main()
{
	HideControls();
	Query.NotifyOnCurrentRequestsDone(HideControls);
	Controls.DocumentType__.OnChange = function ()
	{
		HideControls();
	};

	FillFamilyControl();
}

Main();