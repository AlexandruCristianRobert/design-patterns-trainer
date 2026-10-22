var station = new WeatherStation();
var phone = new PhoneDisplay();
var tv = new TvDisplay();

station.Subscribe(phone);
station.Subscribe(tv);
station.SetTemperature(23);

station.Unsubscribe(tv);
station.SetTemperature(25);

public interface IObserver
{
    void Update(int temperature);
}

public class WeatherStation
{
    private readonly List<IObserver> _observers = [];

    public int Temperature { get; private set; }

    public void Subscribe(IObserver observer) => _observers.Add(observer);

    public void Unsubscribe(IObserver observer) => _observers.Remove(observer);

    public void SetTemperature(int temperature)
    {
        Temperature = temperature;
        // Iterate over a copy: an observer may unsubscribe while being notified.
        foreach (var observer in _observers.ToList())
            observer.Update(temperature);
    }
}

public class PhoneDisplay : IObserver
{
    public void Update(int temperature) => Console.WriteLine($"Phone: {temperature}°C");
}

public class TvDisplay : IObserver
{
    public void Update(int temperature) => Console.WriteLine($"TV: {temperature}°C");
}
