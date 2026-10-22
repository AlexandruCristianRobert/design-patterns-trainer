using DesignPatterns.Checks;

static class WeatherStationChecks
{
    sealed class Recorder : IObserver
    {
        public List<int> Received { get; } = [];
        public void Update(int temperature) => Received.Add(temperature);
    }

    [Check("every-subscriber-notified")]
    static void EverySubscriberNotified()
    {
        var station = new WeatherStation();
        var observers = new[] { new Recorder(), new Recorder(), new Recorder() };
        foreach (var o in observers) station.Subscribe(o);

        station.SetTemperature(20);

        for (var i = 0; i < observers.Length; i++)
            Expect.That(observers[i].Received.Count == 1, "wrongCallCount",
                new { subscriber = i + 1, calls = observers[i].Received.Count });
    }

    [Check("unsubscribed-not-notified")]
    static void UnsubscribedNotNotified()
    {
        var station = new WeatherStation();
        var leaving = new Recorder();
        var staying = new Recorder();
        station.Subscribe(leaving);
        station.Subscribe(staying);

        station.Unsubscribe(leaving);
        station.SetTemperature(20);

        Expect.That(leaving.Received.Count == 0, "notifiedAfterUnsubscribe");
        Expect.That(staying.Received.Count > 0, "stayingMissed");
    }

    [Check("notified-with-new-value")]
    static void NotifiedWithNewValue()
    {
        var station = new WeatherStation();
        var observer = new Recorder();
        station.Subscribe(observer);

        station.SetTemperature(18);
        station.SetTemperature(21);

        Expect.That(observer.Received.SequenceEqual([18, 21]), "wrongValues", new
        {
            actual = observer.Received.Count == 0 ? "nothing" : string.Join(", ", observer.Received),
        });
    }

    [Check("no-subscribers-ok")]
    static void NoSubscribersOk()
    {
        var station = new WeatherStation();
        station.SetTemperature(5);

        var stranger = new Recorder();
        station.Unsubscribe(stranger);
        station.SetTemperature(6);

        Expect.That(stranger.Received.Count == 0, "strangerNotified");
    }
}
