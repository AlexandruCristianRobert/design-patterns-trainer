var parcel = new Parcel("PX-1042");
var sms = new SmsAlert("+40 700 000 000");
var shop = new ShopOrderPage();
parcel.Track(sms);
parcel.Track(shop);

parcel.UpdateStatus("Shipped");
parcel.UpdateStatus("Shipped");
parcel.UpdateStatus("Out for delivery");

parcel.Untrack(sms);
parcel.UpdateStatus("Delivered");

public interface IParcelAlertSink
{
    void StatusChanged(string trackingCode, string status);
}

public class Parcel(string trackingCode)
{
    private readonly List<IParcelAlertSink> _sinks = [];

    public string Status { get; private set; } = "Registered";

    public void Track(IParcelAlertSink sink) => _sinks.Add(sink);

    public void Untrack(IParcelAlertSink sink) => _sinks.Remove(sink);

    public void UpdateStatus(string status)
    {
        if (status == Status) return;
        Status = status;
        foreach (var sink in _sinks.ToList())
            sink.StatusChanged(trackingCode, status);
    }
}

public class SmsAlert(string phone) : IParcelAlertSink
{
    public void StatusChanged(string trackingCode, string status) =>
        Console.WriteLine($"sms to {phone}: {trackingCode} is {status}");
}

public class ShopOrderPage : IParcelAlertSink
{
    public void StatusChanged(string trackingCode, string status) =>
        Console.WriteLine($"order page: {trackingCode} -> {status}");
}
