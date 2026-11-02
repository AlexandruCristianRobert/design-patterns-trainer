var screen = new PatientScreen(new XrayProxy("Ana", "doctor"));
Console.WriteLine($"Images opened: {XrayImage.Opened}");
Console.WriteLine(screen.Open());
Console.WriteLine(screen.Open());
Console.WriteLine($"Images opened: {XrayImage.Opened}");
Console.WriteLine(new PatientScreen(new XrayProxy("Bo", "nurse")).Open());
Console.WriteLine($"Images opened: {XrayImage.Opened}");

// What the patient screen shows. Leave as is.
public interface IXray
{
    string Show();
}

// The real X-ray. Opening one is slow and heavy, so the static Opened count goes up for every image opened. Leave as is.
public class XrayImage : IXray
{
    public static int Opened { get; private set; }

    private readonly string patient;

    public XrayImage(string patient)
    {
        this.patient = patient;
        Opened++;
    }

    public string Show() => $"X-ray of {patient}, 2 views";
}

// The proxy: the patient screen holds it in place of the real image.
public class XrayProxy(string patient, string role) : IXray
{
    private XrayImage? image;

    public string Show()
    {
        if (role != "doctor")
            return $"Only doctors can see the X-ray of {patient}";

        image ??= new XrayImage(patient);
        return image.Show();
    }
}

// The screen in the consulting room. It only knows IXray. Leave it as it is.
public class PatientScreen(IXray xray)
{
    public string Open() => xray.Show();
}
