using DesignPatterns.Checks;

static class XrayChecks
{
    // All Checks share one load of the program, so XrayImage.Opened may already be above 0 when a Check starts.
    // Each Check therefore counts only the images opened while it runs.

    [Check("nothing-opened-before-first-look")]
    static void NothingOpenedBeforeFirstLook()
    {
        var before = XrayImage.Opened;
        var xray = new XrayProxy("Ana", "doctor");
        var screen = new PatientScreen(xray);
        var early = XrayImage.Opened - before;
        Expect.That(early == 0, "openedTooEarly", new { opened = early });

        screen.Open();
        var opened = XrayImage.Opened - before;
        Expect.That(opened == 1, "notOpenedOnFirstLook", new { opened });
    }

    [Check("opened-once-for-many-looks")]
    static void OpenedOnceForManyLooks()
    {
        var before = XrayImage.Opened;
        var screen = new PatientScreen(new XrayProxy("Cy", "doctor"));
        for (var i = 0; i < 4; i++)
            screen.Open();
        var opened = XrayImage.Opened - before;

        Expect.That(opened == 1, "openedMoreThanOnce", new { opened });
    }

    [Check("only-doctors-see-it")]
    static void OnlyDoctorsSeeIt()
    {
        var before = XrayImage.Opened;
        var nurse = new XrayProxy("Bo", "nurse").Show();
        var porter = new XrayProxy("Bo", "porter").Show();
        var opened = XrayImage.Opened - before;

        Expect.That(nurse == "Only doctors can see the X-ray of Bo" && porter == "Only doctors can see the X-ray of Bo",
            "wrongRefusal", new { nurse, porter });
        Expect.That(opened == 0, "openedForRefusal", new { opened });
    }

    [Check("shows-what-the-image-shows")]
    static void ShowsWhatTheImageShows()
    {
        var shown = new XrayProxy("Dee", "doctor").Show();
        var real = new XrayImage("Dee").Show();

        Expect.That(shown == real, "differentResult", new { shown, real });
    }

    [Check("proxy-is-an-xray")]
    static void ProxyIsAnXray()
    {
        Expect.That(typeof(IXray).IsAssignableFrom(typeof(XrayProxy)), "notAnXray");
        Expect.That(!typeof(XrayImage).IsAssignableFrom(typeof(XrayProxy)), "derivesFromImage");
    }
}
