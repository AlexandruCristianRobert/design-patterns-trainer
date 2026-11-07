using System.Reflection;
using DesignPatterns.Checks;

static class LockerBankChecks
{
    // A bank of 6 lockers with Maya in 2, Lena in 3, Omar in 5 and Ivo in 6, stored out of order.
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
        Expect.That(four == "Maya, Lena, Omar, Ivo", "wrongOrder", new { expected = "Maya, Lena, Omar, Ivo", actual = four });

        var bank = Filled();
        bank.Collect(3);
        var left = Owners(bank);
        Expect.That(left == "Maya, Omar, Ivo", "wrongAfterCollect", new { expected = "Maya, Omar, Ivo", actual = left });

        var walker = bank.GetEnumerator();
        for (var i = 0; i < 3; i++) walker.MoveNext();
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

        var guard = 0;
        while (second.MoveNext() && ++guard < 50) { }
        var next = first.MoveNext() ? first.Current.Owner : "(no bag)";
        Expect.That(next == "Omar", "disturbedByOther", new { expected = "Omar", actual = next });
    }

    [Check("an-empty-bank-has-nothing-to-walk")]
    static void AnEmptyBankHasNothingToWalk()
    {
        var unused = Owners(new LockerBank(5));
        Expect.That(unused == "(none)", "wrongEmpty", new { expected = "(none)", actual = unused });
    }

    [Check("fees-add-up-every-bag")]
    static void FeesAddUpEveryBag()
    {
        var owed = LockerFees.Owed(Filled());
        Expect.That(owed == 42, "wrongFees", new { bank = "bags of 3, 2, 1 and 1 days", expected = 42, actual = owed });

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
