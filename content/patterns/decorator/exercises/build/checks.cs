using System.Reflection;
using DesignPatterns.Checks;

static class EnchantmentChecks
{
    // An attack the program has never seen: a test club with the given damage. Counts how often it was asked.
    sealed class TestClub(int damage) : IAttack
    {
        public int Asked { get; private set; }

        public int Damage()
        {
            Asked++;
            return damage;
        }

        public string Describe() => "test club";
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

    static string Show(IAttack attack) => $"{attack.Describe()}: {attack.Damage()}";

    [Check("weapon-on-its-own")]
    static void WeaponOnItsOwn()
    {
        var axe = Show(new Weapon("axe", 12));

        Expect.That(axe == "axe: 12", "wrongWeapon", new { actual = axe });
    }

    [Check("fiery-adds-five")]
    static void FieryAddsFive()
    {
        var club = new TestClub(7);
        var result = Show(new Fiery(club));

        Expect.That(result == "fiery test club: 12", "wrongFiery", new { actual = result });
        Expect.That(club.Asked == 1, "askedWrongTimes", new { asked = club.Asked });
    }

    [Check("sharp-doubles")]
    static void SharpDoubles()
    {
        var club = new TestClub(7);
        var result = Show(new Sharp(club));

        Expect.That(result == "sharp test club: 14", "wrongSharp", new { actual = result });
        Expect.That(club.Asked == 1, "askedWrongTimes", new { asked = club.Asked });
    }

    [Check("rusty-takes-four-but-leaves-one")]
    static void RustyTakesFourButLeavesOne()
    {
        var club = new TestClub(7);
        var seven = Show(new Rusty(club));
        var five = new Rusty(new TestClub(5)).Damage();
        var two = new Rusty(new TestClub(2)).Damage();

        Expect.That(seven == "rusty test club: 3", "wrongRusty", new { actual = seven });
        Expect.That(five == 1 && two == 1, "rustyBelowOne", new { five, two });
        Expect.That(club.Asked == 1, "askedWrongTimes", new { asked = club.Asked });
    }

    [Check("enchantments-stack-in-any-order")]
    static void EnchantmentsStackInAnyOrder()
    {
        var sharpLast = Show(new Sharp(new Fiery(new Weapon("sword", 10))));
        var fieryLast = Show(new Fiery(new Sharp(new Weapon("sword", 10))));
        var twice = Show(new Fiery(new Fiery(new Weapon("dagger", 4))));
        var rustyLast = Show(new Rusty(new Sharp(new Weapon("needle", 2))));

        Expect.That(sharpLast == "sharp fiery sword: 30", "wrongSharpLast", new { actual = sharpLast });
        Expect.That(fieryLast == "fiery sharp sword: 25", "wrongFieryLast", new { actual = fieryLast });
        Expect.That(twice == "fiery fiery dagger: 14", "wrongTwice", new { actual = twice });
        Expect.That(rustyLast == "rusty sharp needle: 1", "wrongRustyLast", new { actual = rustyLast });
    }

    [Check("enchantments-hold-any-attack")]
    static void EnchantmentsHoldAnyAttack()
    {
        var attack = typeof(IAttack);
        var enchantments = new[] { typeof(Fiery), typeof(Sharp), typeof(Rusty) };

        foreach (var type in enchantments)
        {
            Expect.That(attack.IsAssignableFrom(type), "notAnAttack", new { type = type.Name });
            Expect.That(!typeof(Weapon).IsAssignableFrom(type), "extendsWeapon", new { type = type.Name });

            var fields = Fields(type);
            Expect.That(fields.Any(f => f.FieldType == attack), "holdsNoAttack", new { type = type.Name });

            var concrete = fields.FirstOrDefault(f => f.FieldType != attack && attack.IsAssignableFrom(f.FieldType));
            Expect.That(concrete is null, "holdsConcreteAttack", new { type = type.Name, held = concrete?.FieldType.Name });
        }

        var allowed = enchantments.Append(typeof(Weapon)).ToHashSet();
        var other = attack.Assembly.GetTypes().FirstOrDefault(t => t.IsClass && !t.IsAbstract && attack.IsAssignableFrom(t) &&
            !allowed.Contains(t) && t.DeclaringType != typeof(EnchantmentChecks));
        Expect.That(other is null, "otherAttackClass", new { type = other?.Name });
    }
}
