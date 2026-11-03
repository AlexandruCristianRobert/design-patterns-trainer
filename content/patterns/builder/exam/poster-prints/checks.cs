using System.Reflection;
using System.Runtime.CompilerServices;
using DesignPatterns.Checks;

static class PosterPrintChecks
{
    // Calls a choice on the order and returns the exception it threw, or null. A choice may return nothing or the order.
    static Exception? Try(PosterOrder order, string name, params object[] args)
    {
        var method = typeof(PosterOrder).GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m =>
            m.Name == name && m.GetParameters().Select(p => p.ParameterType).SequenceEqual(args.Select(a => a.GetType())));
        if (method is null) Expect.Fail("missingChoice", new { choice = Shown(name, args) });
        try
        {
            method.Invoke(order, args);
            return null;
        }
        catch (TargetInvocationException e)
        {
            return e.InnerException ?? e;
        }
    }

    static string Shown(string name, object[] args) => $"{name}({string.Join(", ", args.Select(a => a is int ? "int" : "string"))})";

    // Calls a choice on an order that is still open; the choice must not throw.
    static void Choose(PosterOrder order, string name, params object[] args)
    {
        if (Try(order, name, args) is { } e) Expect.Fail("choiceThrew", new { choice = Shown(name, args), message = e.Message });
    }

    // "rejected" when Send() throws an InvalidOperationException, otherwise the ticket.
    static string Outcome(PosterOrder order)
    {
        try { return order.Send().Ticket(); }
        catch (InvalidOperationException) { return "rejected"; }
    }

    [Check("ticket-lists-the-choices")]
    static void TicketListsTheChoices()
    {
        var gig = new PosterOrder("gig.pdf");
        Choose(gig, "Size", "A2");
        Choose(gig, "Copies", 50);
        Choose(gig, "Laminate");
        var laminated = Outcome(gig);

        var map = new PosterOrder("map.pdf");
        Choose(map, "Fold");
        var folded = Outcome(map);

        Expect.That(laminated == "gig.pdf: 50 x A2, laminated", "wrongTicket", new { expected = "gig.pdf: 50 x A2, laminated", actual = laminated });
        Expect.That(folded == "map.pdf: 1 x A3, folded", "wrongDefaults", new { expected = "map.pdf: 1 x A3, folded", actual = folded });
    }

    [Check("choices-in-any-order")]
    static void ChoicesInAnyOrder()
    {
        var order = new PosterOrder("fair.pdf");
        Choose(order, "Fold");
        Choose(order, "Copies", 4);
        Choose(order, "Size", "A1");
        Choose(order, "Copies", 12);
        var ticket = Outcome(order);

        Expect.That(ticket == "fair.pdf: 12 x A1, folded", "wrongOrder", new { expected = "fair.pdf: 12 x A1, folded", actual = ticket });
    }

    [Check("send-rejects-impossible-orders")]
    static void SendRejectsImpossibleOrders()
    {
        var both = new PosterOrder("menu.pdf");
        Choose(both, "Laminate");
        Choose(both, "Fold");
        var bothOutcome = Outcome(both);

        var none = new PosterOrder("menu.pdf");
        Choose(none, "Copies", 0);
        var noneOutcome = Outcome(none);
        Choose(none, "Copies", 2);
        var fixedOutcome = Outcome(none);

        Expect.That(bothOutcome == "rejected", "laminatedFoldAccepted", new { expected = "rejected", actual = bothOutcome });
        Expect.That(noneOutcome == "rejected", "noCopiesAccepted", new { expected = "rejected", actual = noneOutcome });
        Expect.That(fixedOutcome == "menu.pdf: 2 x A3", "fixNotAccepted", new { expected = "menu.pdf: 2 x A3", actual = fixedOutcome });
    }

    [Check("sent-orders-are-closed")]
    static void SentOrdersAreClosed()
    {
        var order = new PosterOrder("gig.pdf");
        Choose(order, "Copies", 20);
        var job = order.Send();

        foreach (var (name, args) in new (string, object[])[] { ("Copies", new object[] { 30 }), ("Size", new object[] { "A0" }), ("Laminate", Array.Empty<object>()), ("Fold", Array.Empty<object>()) })
        {
            var thrown = Try(order, name, args);
            Expect.That(thrown is InvalidOperationException, "choiceAfterSend",
                new { choice = Shown(name, args), actual = thrown?.GetType().Name ?? "nothing" });
        }

        string again;
        try { order.Send(); again = "a second print job"; }
        catch (InvalidOperationException) { again = "rejected"; }

        Expect.That(again == "rejected", "sentTwice");
        Expect.That(job.Ticket() == "gig.pdf: 20 x A3", "jobChanged", new { expected = "gig.pdf: 20 x A3", actual = job.Ticket() });
    }

    [Check("print-jobs-are-read-only")]
    static void PrintJobsAreReadOnly()
    {
        var type = typeof(PrintJob);
        var setter = type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .FirstOrDefault(p => p.SetMethod is { IsPublic: true } s &&
                !s.ReturnParameter.GetRequiredCustomModifiers().Contains(typeof(IsExternalInit)));
        Expect.That(setter is null, "publicSetter", new { member = setter?.Name });

        var field = type.GetFields(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(f => !f.IsInitOnly);
        Expect.That(field is null, "publicField", new { member = field?.Name });
    }
}
