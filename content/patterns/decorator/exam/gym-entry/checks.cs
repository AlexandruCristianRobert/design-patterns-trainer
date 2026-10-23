using System.Reflection;
using DesignPatterns.Checks;

static class GymEntryChecks
{
    // A gate the program has never seen: lets in the names it was given and counts how often it was asked.
    sealed class TestGate(params string[] allowed) : IEntryGate
    {
        public int Asked { get; private set; }

        public bool Swipe(string member)
        {
            Asked++;
            return allowed.Contains(member);
        }
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every instance field of the type, including those declared in its base classes.
    static List<FieldInfo> Fields(Type type)
    {
        var fields = new List<FieldInfo>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            fields.AddRange(t.GetFields(Declared));
        return fields;
    }

    static string Answers(IEntryGate gate, params string[] names) =>
        string.Join(", ", names.Select(n => gate.Swipe(n) ? "open" : "closed"));

    [Check("member-gate-decides")]
    static void MemberGateDecides()
    {
        var answers = Answers(new MemberGate(["ana", "radu"]), "ana", "zoe", "radu");

        Expect.That(answers == "open, closed, open", "wrongDecision", new { actual = answers });
    }

    [Check("log-records-every-swipe")]
    static void LogRecordsEverySwipe()
    {
        var gate = new TestGate("ana");
        List<string> lines = [];
        var answers = Answers(new EntryLog(gate, lines), "ana", "zoe");
        var logged = string.Join(", ", lines);

        Expect.That(answers == "open, closed", "logChangedAnswer", new { actual = answers });
        Expect.That(logged == "ana: in, zoe: refused", "wrongLog", new { actual = logged.Length == 0 ? "nothing" : logged });
        Expect.That(gate.Asked == 2, "askedWrongTimes", new { asked = gate.Asked, swipes = 2 });
    }

    [Check("counter-counts-visits")]
    static void CounterCountsVisits()
    {
        var gate = new TestGate("ana");
        var counter = new VisitCounter(gate);
        var answers = Answers(counter, "ana", "zoe", "ana");

        Expect.That(answers == "open, closed, open", "counterChangedAnswer", new { actual = answers });
        Expect.That(counter.Visits == 2, "wrongVisits", new { visits = counter.Visits });
        Expect.That(gate.Asked == 3, "askedWrongTimes", new { asked = gate.Asked, swipes = 3 });
    }

    [Check("extras-combine-in-any-order")]
    static void ExtrasCombineInAnyOrder()
    {
        List<string> outerLog = [];
        var innerCounter = new VisitCounter(new MemberGate(["ana"]));
        var countedFirst = Answers(new EntryLog(innerCounter, outerLog), "ana", "zoe");

        List<string> innerLog = [];
        var outerCounter = new VisitCounter(new EntryLog(new MemberGate(["ana"]), innerLog));
        var loggedFirst = Answers(outerCounter, "ana", "zoe");

        List<string> manager = [];
        List<string> security = [];
        var gate = new TestGate("radu");
        Answers(new EntryLog(new EntryLog(gate, security), manager), "radu");

        Expect.That(countedFirst == "open, closed" && innerCounter.Visits == 1 && string.Join(", ", outerLog) == "ana: in, zoe: refused",
            "wrongLogOutside", new { answers = countedFirst, visits = innerCounter.Visits, log = string.Join(", ", outerLog) });
        Expect.That(loggedFirst == "open, closed" && outerCounter.Visits == 1 && string.Join(", ", innerLog) == "ana: in, zoe: refused",
            "wrongCounterOutside", new { answers = loggedFirst, visits = outerCounter.Visits, log = string.Join(", ", innerLog) });
        Expect.That(string.Join(", ", manager) == "radu: in" && string.Join(", ", security) == "radu: in" && gate.Asked == 1,
            "wrongTwoLogs", new { manager = string.Join(", ", manager), security = string.Join(", ", security), asked = gate.Asked });
    }

    [Check("extras-take-any-gate")]
    static void ExtrasTakeAnyGate()
    {
        var gate = typeof(IEntryGate);
        foreach (var type in new[] { typeof(EntryLog), typeof(VisitCounter) })
        {
            Expect.That(gate.IsAssignableFrom(type), "notAGate", new { type = type.Name });
            Expect.That(!typeof(MemberGate).IsAssignableFrom(type), "extendsMemberGate", new { type = type.Name });

            var fields = Fields(type);
            Expect.That(fields.Any(f => f.FieldType == gate), "holdsNoGate", new { type = type.Name });

            var concrete = fields.FirstOrDefault(f => f.FieldType != gate && gate.IsAssignableFrom(f.FieldType));
            Expect.That(concrete is null, "holdsConcreteGate", new { type = type.Name, held = concrete?.FieldType.Name });
        }
    }
}
