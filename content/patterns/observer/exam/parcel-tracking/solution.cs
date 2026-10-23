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

public interface ITrackingListener
{
    void StatusChanged(string trackingCode, string status);
}

public class Parcel(string trackingCode)
{
    private readonly List<ITrackingListener> _listeners = [];

    public string Status { get; private set; } = "Registered";

    public void Track(ITrackingListener listener) => _listeners.Add(listener);

    public void Untrack(ITrackingListener listener) => _listeners.Remove(listener);

    public void UpdateStatus(string status)
    {
        if (status == Status) return;
        Status = status;
        foreach (var listener in _listeners.ToList())
            listener.StatusChanged(trackingCode, status);
    }
}

public class SmsAlert(string phone) : ITrackingListener
{
    public void StatusChanged(string trackingCode, string status) =>
        Console.WriteLine($"sms to {phone}: {trackingCode} is {status}");
}

public class ShopOrderPage : ITrackingListener
{
    public void StatusChanged(string trackingCode, string status) =>
        Console.WriteLine($"order page: {trackingCode} -> {status}");
}
