// The page holds a stand-in. The real scan is loaded on the first Render, and only if access is allowed.
var page = new ListingPage(new FloorPlanProxy("12 Elm Street", canView: true));
Console.WriteLine($"Scans loaded: {ScannedFloorPlan.Loaded}");
page.ShowPlan();
Console.WriteLine($"Scans loaded: {ScannedFloorPlan.Loaded}");
page.ShowPlan();
Console.WriteLine($"Scans loaded: {ScannedFloorPlan.Loaded}");

var hidden = new ListingPage(new FloorPlanProxy("9 Mill Lane", canView: false));
hidden.ShowPlan();
Console.WriteLine($"Scans loaded: {ScannedFloorPlan.Loaded}");
Console.WriteLine($"Scan renders: {ScannedFloorPlan.Renders}");

public interface IFloorPlan
{
    string Render();
}

public class ScannedFloorPlan : IFloorPlan
{
    public static int Loaded { get; private set; }
    public static int Renders { get; private set; }

    private readonly string address;

    public ScannedFloorPlan(string address)
    {
        this.address = address;
        Loaded++;   // stands for reading a large scan: slow and heavy
    }

    public string Render()
    {
        Renders++;
        return $"Floor plan of {address}: 3 rooms";
    }
}

public class FloorPlanProxy(string address, bool canView) : IFloorPlan
{
    private ScannedFloorPlan? scan;

    public string Render()
    {
        if (!canView)
            return $"Plans of {address} are not available";

        scan ??= new ScannedFloorPlan(address);
        return scan.Render();
    }
}

public class ListingPage(IFloorPlan plan)
{
    public void ShowPlan() => Console.WriteLine(plan.Render());
}
