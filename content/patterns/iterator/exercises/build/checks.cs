using System.Reflection;
using DesignPatterns.Checks;

static class SnackMachineChecks
{
    // The slots and snacks a walk meets, such as "A1 water, B2 crisps", or "(none)".
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

    // The rest of a walk that has already started, in the same form.
    static string Rest(IEnumerator<Snack> walk)
    {
        var met = new List<string>();
        while (met.Count <= 50 && walk.MoveNext())
            met.Add($"{walk.Current.Slot} {walk.Current.Name}");
        return met.Count == 0 ? "(none)" : string.Join(", ", met);
    }

    static string Step(IEnumerator<Snack> walk) => walk.MoveNext() ? $"{walk.Current.Slot} {walk.Current.Name}" : "(none)";

    // 3 rows and 4 columns: water in A1, gum in A4, crisps in B2, toffee in C2, filled out of order.
    static SnackMachine Stocked()
    {
        var machine = new SnackMachine(3, 4);
        machine.Fill("C2", "toffee");
        machine.Fill("A4", "gum");
        machine.Fill("B2", "crisps");
        machine.Fill("A1", "water");
        return machine;
    }

    [Check("a-walk-goes-row-by-row")]
    static void AWalkGoesRowByRow()
    {
        var all = Met(Stocked());
        const string expected = "A1 water, A4 gum, B2 crisps, C2 toffee";
        Expect.That(all == expected, "wrongOrder", new { machine = "water in A1, gum in A4, crisps in B2, toffee in C2", expected, actual = all });

        var wide = new SnackMachine(2, 12);
        wide.Fill("A10", "nuts");
        wide.Fill("A2", "mints");
        wide.Fill("B1", "cola");
        wide.Fill("A12", "fudge");
        var met = Met(wide);
        const string expectedWide = "A2 mints, A10 nuts, A12 fudge, B1 cola";
        Expect.That(met == expectedWide, "wrongOrder", new { machine = "2 rows of 12, mints in A2, nuts in A10, fudge in A12, cola in B1", expected = expectedWide, actual = met });
    }

    [Check("a-walk-steps-over-empty-slots")]
    static void AWalkStepsOverEmptySlots()
    {
        var machine = Stocked();
        machine.Take("A1");
        machine.Take("B2");
        var left = Met(machine);
        Expect.That(left == "A4 gum, C2 toffee", "wrongAfterTake", new { expected = "A4 gum, C2 toffee", actual = left });

        var walk = machine.GetEnumerator();
        Step(walk);
        Step(walk);
        var after = Step(walk);
        var again = Step(walk);
        Expect.That(after == "(none)" && again == "(none)", "keptGoing", new { actual = after == "(none)" ? again : after });
    }

    [Check("a-column-walk-goes-down-one-column")]
    static void AColumnWalkGoesDownOneColumn()
    {
        var machine = Stocked();
        machine.Fill("A2", "chocolate");
        var two = Met(machine.Column(2));
        Expect.That(two == "A2 chocolate, B2 crisps, C2 toffee", "wrongColumn",
            new { column = 2, expected = "A2 chocolate, B2 crisps, C2 toffee", actual = two });

        var four = Met(machine.Column(4));
        Expect.That(four == "A4 gum", "wrongColumn", new { column = 4, expected = "A4 gum", actual = four });

        var three = Met(machine.Column(3));
        Expect.That(three == "(none)", "wrongColumn", new { column = 3, expected = "(none)", actual = three });
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
        Expect.That(places == "A4 gum / A1 water", "sharedPlace", new { expected = "A4 gum / A1 water", actual = places });

        Rest(second);
        var next = Step(first);
        Expect.That(next == "B2 crisps", "disturbedByOther", new { expected = "B2 crisps", actual = next });

        var down = machine.Column(2).GetEnumerator();
        var other = machine.Column(2).GetEnumerator();
        Step(down);
        var c = Step(down);
        var d = Step(other);
        var columnPlaces = $"{c} / {d}";
        Expect.That(columnPlaces == "C2 toffee / B2 crisps", "sharedColumnPlace", new { expected = "C2 toffee / B2 crisps", actual = columnPlaces });
    }

    [Check("a-walk-looks-into-a-slot-when-it-gets-there")]
    static void AWalkLooksIntoASlotWhenItGetsThere()
    {
        var machine = Stocked();
        var walk = machine.GetEnumerator();
        Step(walk);
        machine.Fill("A3", "mints");
        machine.Take("B2");
        machine.Fill("C4", "raisins");
        var rest = Rest(walk);
        const string expected = "A3 mints, A4 gum, C2 toffee, C4 raisins";
        Expect.That(rest == expected, "readTooEarly", new { expected, actual = rest });

        var column = Stocked();
        var down = column.Column(2).GetEnumerator();
        var firstStop = Step(down);
        column.Take("C2");
        column.Fill("C2", "liquorice");
        var restDown = Rest(down);
        Expect.That(firstStop == "B2 crisps" && restDown == "C2 liquorice", "columnReadTooEarly",
            new { expected = "B2 crisps, then C2 liquorice", actual = $"{firstStop}, then {restDown}" });
    }

    [Check("an-empty-machine-gives-empty-walks")]
    static void AnEmptyMachineGivesEmptyWalks()
    {
        var empty = new SnackMachine(2, 3);
        var all = Met(empty);
        var column = Met(empty.Column(1));
        Expect.That(all == "(none)" && column == "(none)", "wrongEmpty", new { all, column });

        var sold = new SnackMachine(1, 1);
        sold.Fill("A1", "pretzels");
        sold.Take("A1");
        var gone = Met(sold);
        Expect.That(gone == "(none)", "wrongSoldOut", new { expected = "(none)", actual = gone });
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
