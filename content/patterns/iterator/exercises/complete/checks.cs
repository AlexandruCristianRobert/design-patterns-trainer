using System.Reflection;
using DesignPatterns.Checks;

static class LockerBankChecks
{
    // A bank of the given size with Maya in 2, Lena in 3, Omar in 5 and Ivo in 6, stored out of order.
    static LockerBank Filled()
    {
        var bank = new LockerBank(6);
        bank.Store(5, new Bag("Omar", 1));
        bank.Store(2, new Bag("Maya", 3));
        bank.Store(6, new Bag("Ivo", 1));
        bank.Store(3, new Bag("Lena", 2));
        return bank;
    }

    // The owners a walk over the bank meets, such as "Maya, Lena", or "(none)".
    static string Owners(LockerBank bank)
    {
        var owners = new List<string>();
        foreach (var bag in bank)
        {
            owners.Add(bag.Owner);
            if (owners.Count > 50) break;
        }
        return owners.Count == 0 ? "(none)" : string.Join(", ", owners);
    }

    [Check("walks-the-bags-in-locker-order")]
    static void WalksTheBagsInLockerOrder()
    {
        var four = Owners(Filled());
        Expect.That(four == "Maya, Lena, Omar, Ivo", "wrongOrder",
            new { bank = "Maya in 2, Lena in 3, Omar in 5, Ivo in 6", expected = "Maya, Lena, Omar, Ivo", actual = four });

        var ends = new LockerBank(4);
        ends.Store(4, new Bag("Ruth", 2));
        ends.Store(1, new Bag("Sami", 1));
        var both = Owners(ends);
        Expect.That(both == "Sami, Ruth", "wrongOrder",
            new { bank = "Sami in 1, Ruth in 4", expected = "Sami, Ruth", actual = both });

        var full = new LockerBank(3);
        full.Store(3, new Bag("Cora", 1));
        full.Store(2, new Bag("Bo", 1));
        full.Store(1, new Bag("Ada", 1));
        var all = Owners(full);
        Expect.That(all == "Ada, Bo, Cora", "wrongOrder",
            new { bank = "Ada in 1, Bo in 2, Cora in 3", expected = "Ada, Bo, Cora", actual = all });
    }

    [Check("steps-over-empty-lockers")]
    static void StepsOverEmptyLockers()
    {
        var bank = Filled();
        bank.Collect(3);
        bank.Collect(6);
        var left = Owners(bank);
        Expect.That(left == "Maya, Omar", "wrongAfterCollect",
            new { expected = "Maya, Omar", actual = left });

        var sparse = new LockerBank(9);
        sparse.Store(8, new Bag("Ines", 4));
        var one = Owners(sparse);
        Expect.That(one == "Ines", "wrongSparse", new { expected = "Ines", actual = one });

        var walker = sparse.GetEnumerator();
        var moved = walker.MoveNext();
        Expect.That(moved && walker.Current.Owner == "Ines", "wrongFirstStop",
            new { expected = "Ines", actual = moved ? walker.Current.Owner : "(no bag)" });
        var again = walker.MoveNext();
        var stillDone = walker.MoveNext();
        Expect.That(!again && !stillDone, "keptGoing");
    }

    [Check("two-walks-keep-their-own-place")]
    static void TwoWalksKeepTheirOwnPlace()
    {
        var bank = Filled();
        var first = bank.GetEnumerator();
        var second = bank.GetEnumerator();
        first.MoveNext();
        var a = first.MoveNext() ? first.Current.Owner : "(no bag)";
        var b = second.MoveNext() ? second.Current.Owner : "(no bag)";
        var places = $"{a} / {b}";
        Expect.That(places == "Lena / Maya", "sharedPlace", new { expected = "Lena / Maya", actual = places });

        while (second.MoveNext()) { }
        var next = first.MoveNext() ? first.Current.Owner : "(no bag)";
        Expect.That(next == "Omar", "disturbedByOther", new { expected = "Omar", actual = next });

        var nested = new List<string>();
        foreach (var outer in Filled())
            foreach (var inner in bank)
                if (nested.Count < 50) nested.Add($"{outer.Owner[0]}{inner.Owner[0]}");
        var pairs = string.Join(" ", nested);
        const string expected = "MM ML MO MI LM LL LO LI OM OL OO OI IM IL IO II";
        Expect.That(pairs == expected, "wrongNested", new { expected, actual = pairs });
    }

    [Check("an-empty-bank-has-nothing-to-walk")]
    static void AnEmptyBankHasNothingToWalk()
    {
        var unused = Owners(new LockerBank(5));
        Expect.That(unused == "(none)", "wrongEmpty", new { bank = "5 empty lockers", expected = "(none)", actual = unused });

        var none = Owners(new LockerBank(0));
        Expect.That(none == "(none)", "wrongEmpty", new { bank = "no lockers at all", expected = "(none)", actual = none });

        var cleared = new LockerBank(2);
        cleared.Store(1, new Bag("Tom", 1));
        cleared.Collect(1);
        var gone = Owners(cleared);
        Expect.That(gone == "(none)", "wrongEmpty", new { bank = "2 lockers, the only bag collected", expected = "(none)", actual = gone });
    }

    [Check("fees-add-up-every-bag")]
    static void FeesAddUpEveryBag()
    {
        var owed = LockerFees.Owed(Filled());
        Expect.That(owed == 42, "wrongFees", new { bank = "bags of 3, 2, 1 and 1 days", expected = 42, actual = owed });

        var bank = Filled();
        bank.Collect(2);
        var less = LockerFees.Owed(bank);
        Expect.That(less == 24, "wrongFees", new { bank = "bags of 2, 1 and 1 days", expected = 24, actual = less });

        var empty = LockerFees.Owed(new LockerBank(3));
        Expect.That(empty == 0, "wrongFees", new { bank = "no bags", expected = 0, actual = empty });
    }

    [Check("the-bank-keeps-its-lockers-to-itself")]
    static void TheBankKeepsItsLockersToItself()
    {
        var shown = StorageShown(typeof(LockerBank));
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
