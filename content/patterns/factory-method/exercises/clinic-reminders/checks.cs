using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ClinicReminderChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // The method `owner` declares that returns a `made`: abstract or virtual, public or protected, taking `parameters`.
    static MethodInfo MakingMethod(Type owner, Type made, params Type[] parameters)
    {
        var found = owner.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { owner = owner.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
        if (method is null) Expect.Fail("makingMethodParameters", new { owner = owner.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { owner = owner.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly, "makingMethodPrivate", new { owner = owner.Name, method = method.Name });
        return method;
    }

    // Each subclass derives from `owner`, and neither it nor a class between them declares its own `operation`.
    static void OperationWrittenOnce(Type owner, string operation, params Type[] subclasses)
    {
        foreach (var sub in subclasses)
        {
            Expect.That(sub != owner && owner.IsAssignableFrom(sub), "notASubclass", new { type = sub.Name, owner = owner.Name });
            for (var t = sub; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Instance | BindingFlags.DeclaredOnly).Any(m => m.Name == operation),
                    "operationRedeclared", new { type = t.Name, method = operation });
        }
    }

    // The source of `owner` names none of the program's classes that implement `made`.
    static void NamesNoMadeClass(string owner, Type made)
    {
        var classes = made.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(ClinicReminderChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
        }
    }

    // Asks a new `type` twice through `making` and expects two new objects of class `expected`.
    static void MakesItsOwn(MethodInfo making, Type type, Type expected)
    {
        var instance = Activator.CreateInstance(type);
        var first = making.Invoke(instance, null);
        var second = making.Invoke(instance, null);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    static string Lines(ReminderRound round, List<string> patients, string day) => string.Join(" | ", round.SendAll(patients, day));

    [Check("reminders-name-the-day")]
    static void RemindersNameTheDay()
    {
        var sms = new SmsReminder().Write("Ana", "Monday");
        var letter = new LetterReminder().Write("Radu", "Friday");

        Expect.That(sms == "SMS to Ana: dentist on Monday", "wrongSms", new { actual = sms });
        Expect.That(letter == "Dear Radu, your appointment is on Friday.", "wrongLetter", new { actual = letter });
    }

    [Check("sms-round-texts-everyone")]
    static void SmsRoundTextsEveryone()
    {
        var lines = Lines(new SmsRound(), ["Ana", "Radu", "Zoe"], "Tuesday");

        Expect.That(lines == "SMS to Ana: dentist on Tuesday | SMS to Radu: dentist on Tuesday | SMS to Zoe: dentist on Tuesday | 3 reminders sent",
            "wrongSmsRound", new { actual = lines });
    }

    [Check("letter-round-writes-to-everyone")]
    static void LetterRoundWritesToEveryone()
    {
        var lines = Lines(new LetterRound(), ["Ana", "Radu"], "Friday");

        Expect.That(lines == "Dear Ana, your appointment is on Friday. | Dear Radu, your appointment is on Friday. | 2 reminders sent",
            "wrongLetterRound", new { actual = lines });
    }

    [Check("empty-round-sends-nothing")]
    static void EmptyRoundSendsNothing()
    {
        var lines = Lines(new SmsRound(), [], "Monday");

        Expect.That(lines == "0 reminders sent", "wrongEmptyRound", new { actual = lines });
    }

    [Check("round-knows-only-ireminder")]
    static void RoundKnowsOnlyIReminder()
    {
        var making = MakingMethod(typeof(ReminderRound), typeof(IReminder));
        OperationWrittenOnce(typeof(ReminderRound), "SendAll", typeof(SmsRound), typeof(LetterRound));
        NamesNoMadeClass("ReminderRound", typeof(IReminder));
        MakesItsOwn(making, typeof(SmsRound), typeof(SmsReminder));
        MakesItsOwn(making, typeof(LetterRound), typeof(LetterReminder));
    }
}
