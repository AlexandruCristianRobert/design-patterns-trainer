using System.Reflection;
using DesignPatterns.Checks;

static class SnackMachineChecks
{
    // The slots and snacks a walk meets, such as "1 water, 4 gum", or "(none)".
    static string Met(IEnumerable<Snack> walk)
    {
        var met = new List<string>();
        foreach (var snack in walk)
        {
            met.Add($"{snack.Slot} {snack.Name}");
            if (met.Count > 50) break;
        }
        return met.Count == 0 ? "(none)" : string.Join(", ", met);
    }

    static string Step(IEnumerator<Snack> walk) => walk.MoveNext() ? $"{walk.Current.Slot} {walk.Current.Name}" : "(none)";

    // 6 slots: water in 1, crisps in 2, gum in 4, toffee in 5, filled out of order.
    static SnackMachine Stocked()
    {
        var machine = new SnackMachine(6);
        machine.Fill(5, "toffee");
        machine.Fill(4, "gum");
        machine.Fill(2, "crisps");
        machine.Fill(1, "water");
        return machine;
    }

    [Check("a-walk-goes-from-slot-1-up-over-the-full-slots")]
    static void AWalkGoesFromSlot1UpOverTheFullSlots()
    {
        var all = Met(Stocked());
        const string expected = "1 water, 2 crisps, 4 gum, 5 toffee";
        Expect.That(all == expected, "wrongOrder", new { expected, actual = all });

        var machine = Stocked();
        machine.Take(2);
        var left = Met(machine);
        Expect.That(left == "1 water, 4 gum, 5 toffee", "wrongAfterTake", new { expected = "1 water, 4 gum, 5 toffee", actual = left });
    }

    [Check("two-walks-keep-their-own-place")]
    static void TwoWalksKeepTheirOwnPlace()
    {
        var machine = Stocked();
        var first = machine.GetEnumerator();
        var second = machine.GetEnumerator();
        Step(first);
        var a = Step(first);
        var b = Step(second);
        var places = $"{a} / {b}";
        Expect.That(places == "2 crisps / 1 water", "sharedPlace", new { expected = "2 crisps / 1 water", actual = places });

        var guard = 0;
        while (second.MoveNext() && ++guard < 50) { }
        var next = Step(first);
        Expect.That(next == "4 gum", "disturbedByOther", new { expected = "4 gum", actual = next });
    }

    [Check("an-empty-machine-gives-an-empty-walk")]
    static void AnEmptyMachineGivesAnEmptyWalk()
    {
        var all = Met(new SnackMachine(3));
        Expect.That(all == "(none)", "wrongEmpty", new { expected = "(none)", actual = all });
    }

    [Check("the-machine-keeps-its-slots-to-itself")]
    static void TheMachineKeepsItsSlotsToItself()
    {
        var shown = StorageShown(typeof(SnackMachine));
        Expect.That(shown is null, "storageShown", new { member = shown });
    }

    // The first public member of the type that hands out an array or a collection: a field, a property or a method; null when there is none.
    static string? StorageShown(Type type)
    {
        const BindingFlags Public = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static;
        var field = type.GetFields(Public).FirstOrDefault(f => IsStorage(f.FieldType));
        if (field is not null) return field.Name;
        var property = type.GetProperties(Public).FirstOrDefault(p => IsStorage(p.PropertyType));
        if (property is not null) return property.Name;
        return type.GetMethods(Public).FirstOrDefault(m => !m.IsSpecialName && IsStorage(m.ReturnType))?.Name;
    }

    // An array, or a type that can be counted and changed like a list: anything beyond a walk.
    static bool IsStorage(Type type) =>
        type.IsArray
        || typeof(System.Collections.ICollection).IsAssignableFrom(type)
        || type.GetInterfaces().Append(type).Any(i => i.IsGenericType
            && (i.GetGenericTypeDefinition() == typeof(ICollection<>) || i.GetGenericTypeDefinition() == typeof(IReadOnlyCollection<>)));
}
