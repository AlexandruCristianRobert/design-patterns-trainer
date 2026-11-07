using System.Reflection;
using DesignPatterns.Checks;

static class MeetingRoomChecks
{
    // A request for that many people, given straight to the first room of a line of the named rooms, in this order.
    static string Ask(int people, params string[] line) => ((Room)LineOf(line)).Book(people);

    [Check("each-request-reaches-the-room-that-fits")]
    static void EachRequestReachesTheRoomThatFits()
    {
        foreach (var (people, expected) in new[] { (2, "Booth booked for 2"), (5, "Small room booked for 5"), (15, "Hall booked for 15") })
        {
            var actual = Ask(people, "Booth", "SmallRoom", "Hall");
            Expect.That(actual == expected, "wrongRoom", new { line = "Booth, SmallRoom, Hall", people, expected, actual });
        }

        var desk = new Reception((Room)LineOf("Booth", "SmallRoom", "Hall")).Request(5);
        Expect.That(desk == "Small room booked for 5", "wrongDesk", new { people = 5, expected = "Small room booked for 5", actual = desk });
    }

    [Check("order-of-the-rooms-matters")]
    static void OrderOfTheRoomsMatters()
    {
        var hallFirst = Ask(2, "Hall", "Booth");
        Expect.That(hallFirst == "Hall booked for 2", "wrongRoom",
            new { line = "Hall, then Booth", people = 2, expected = "Hall booked for 2", actual = hallFirst });

        var skipsBooth = Ask(5, "Booth", "Hall");
        Expect.That(skipsBooth == "Hall booked for 5", "wrongRoom",
            new { line = "Booth, then Hall", people = 5, expected = "Hall booked for 5", actual = skipsBooth });
    }

    [Check("no-room-fits")]
    static void NoRoomFits()
    {
        var crowd = Ask(25, "Booth", "SmallRoom", "Hall");
        Expect.That(crowd == "No room for 25", "wrongRoom",
            new { line = "Booth, SmallRoom, Hall", people = 25, expected = "No room for 25", actual = crowd });

        var alone = Ask(10, "SmallRoom");
        Expect.That(alone == "No room for 10", "wrongRoom",
            new { line = "SmallRoom on its own", people = 10, expected = "No room for 10", actual = alone });
    }

    [Check("rooms-know-only-the-next")]
    static void RoomsKnowOnlyTheNext()
    {
        foreach (var type in new[] { typeof(Booth), typeof(SmallRoom), typeof(Hall) })
        {
            Expect.That(typeof(Room).IsAssignableFrom(type), "notARoom", new { type = type.Name });
            Expect.That(FieldsOf(type).Any(f => !f.IsStatic && HoldsOne(f.FieldType)), "noNext", new { type = type.Name });
        }

        var held = FieldsOf(typeof(Reception)).Count(f => HoldsOne(f.FieldType) || HoldsMany(f.FieldType));
        Expect.That(held == 1, "receptionHoldsMore", new { expected = 1, actual = held });

        foreach (var type in typeof(Room).Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType), "keptInACollection", new { type = type.Name, field = field.Name });
    }

    // ---- Fields that hold rooms ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every field of a type: its own and the ones it inherits, private ones included.
    static IEnumerable<FieldInfo> FieldsOf(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var field in t.GetFields(AnyField))
                yield return field;
    }

    // A field of this type holds one room: Room itself, a wider type, or one kind of room (never object).
    static bool HoldsOne(Type type) =>
        type != typeof(object) && (type.IsAssignableFrom(typeof(Room)) || typeof(Room).IsAssignableFrom(type));

    // A field of this type holds many rooms: an array or a collection of them.
    static bool HoldsMany(Type type) =>
        type.GetInterfaces().Append(type).Any(i =>
            i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>) && HoldsOne(i.GetGenericArguments()[0]));

    // ---- Building a line ----

    // A new room of this type, joined to the next one the way the code allows: a public constructor that takes
    // the next room (null when there is none), or a public constructor without parameters and a public method that takes it.
    static object Make(Type type, object? next)
    {
        bool TakesRoom(ParameterInfo[] ps) => ps is [var p] && p.ParameterType != typeof(object) && p.ParameterType.IsAssignableFrom(typeof(Room));

        var withNext = type.GetConstructors().FirstOrDefault(c => TakesRoom(c.GetParameters()));
        if (withNext is not null) return withNext.Invoke([next]);

        var bare = type.GetConstructor(Type.EmptyTypes);
        if (bare is null) Expect.Fail("cannotLink", new { type = type.Name });
        var made = bare.Invoke([]);
        if (next is null) return made;

        var setter = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => TakesRoom(m.GetParameters()));
        if (setter is null) Expect.Fail("cannotLink", new { type = type.Name });
        setter.Invoke(made, [next]);
        return made;
    }

    // A line of the named rooms, in this order; returns the first one.
    static object LineOf(params string[] names)
    {
        object? next = null;
        for (var i = names.Length - 1; i >= 0; i--)
            next = Make(Code.Type(names[i]).Clr, next);
        return next!;
    }
}
